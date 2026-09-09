'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Edit, List, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import DynamicTable, { type Column } from '@/components/ui/DataTableV2'
import { usePermission } from '@/hooks/usePermission'
import Breadcrumb from '@/lib/Breadcrumb'
import {
  addSubItemGroup,
  getItemGroupById,
  getSubItemGroups,
  updateItemGroup,
  voidItemGroup,
  type ItemGroup,
} from '../../api'
import { ITEM_GROUP_MAX_SUBGROUP_LEVELS } from '@/lib/data/repositories/itemGroups'

type ItemGroupForm = {
  code: string
  name: string
  remarks: string
  father: number | null
}

type SubItemGroupForm = {
  code: string
  name: string
  remarks: string
}

type InlineSubItemGroup = {
  draftId: string
  level: number
  name: string
  remarks: string
}

type LevelRow = Record<string, unknown> & {
  id: number | string
  code: string
  name: string
  remarks: string
  level: number
  itemGroup?: ItemGroup
  isDraft?: boolean
  draftId?: string
}

const emptySubItemGroup: SubItemGroupForm = { code: '', name: '', remarks: '' }

function getSaveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error != null && 'message' in error) {
    const message = error.message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}

function getPastedSubItemGroups(text: string) {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map(row => {
      const cells = row.split('\t').map(cell => cell.trim())
      const offset = cells[0] === '#' || (cells.length >= 3 && /^(id|\d+)$/i.test(cells[0])) ? 1 : 0
      return {
        name: cells[offset] ?? '',
        remarks: cells[offset + 1] ?? '',
      }
    })
    .filter(entry => entry.name && entry.name.toLowerCase() !== 'category segment')
}

function ItemGroupEditSkeleton() {
  return (
    <main className="min-h-[calc(100vh-4rem)] text-stone-950 dark:text-foreground">
      <div className="flex items-center justify-between gap-3 px-4 mt-4">
        <Skeleton className="h-5 w-80" />
        <Skeleton className="h-9 w-36" />
      </div>
      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-card">
        <div className="grid gap-x-16 gap-y-3 p-5 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-9 w-full" />)}
        </div>
        <Skeleton className="m-5 h-64 w-[calc(100%-2.5rem)]" />
      </section>
    </main>
  )
}

export default function EditItemGroupLayout() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const itemGroupId = Number(params.id)
  const insertDisabled = usePermission('/a_dean/itemgroups/insert')
  const voidDisabled = usePermission('/a_dean/itemgroups/void')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subItemGroupsLoading, setSubItemGroupsLoading] = useState(false)
  const [subItemGroupSaving, setSubItemGroupSaving] = useState(false)
  const [inlineSubItemGroupsSaving, setInlineSubItemGroupsSaving] = useState(false)
  const [subItemGroupsVoiding, setSubItemGroupsVoiding] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState(1)
  const [selectedSubItemGroupIds, setSelectedSubItemGroupIds] = useState<Set<number>>(new Set())
  const [inlineSubItemGroups, setInlineSubItemGroups] = useState<InlineSubItemGroup[]>([])
  const [editingSubItemGroup, setEditingSubItemGroup] = useState<ItemGroup | null>(null)
  const [subItemGroups, setSubItemGroups] = useState<ItemGroup[]>([])
  const [subItemGroupForm, setSubItemGroupForm] = useState<SubItemGroupForm>(emptySubItemGroup)
  const [form, setForm] = useState<ItemGroupForm>({ code: '', name: '', remarks: '', father: null })

  const loadSubItemGroups = useCallback(async () => {
    setSubItemGroupsLoading(true)
    try {
      const groups = await getSubItemGroups()
      setSubItemGroups(groups.filter(group => Number(group.root_item_group_id) === itemGroupId))
    } catch (error) {
      toast('Error: ' + getSaveErrorMessage(error, 'Unable to load sub item groups'))
      setSubItemGroups([])
    } finally {
      setSubItemGroupsLoading(false)
    }
  }, [itemGroupId])

  useEffect(() => {
    router.prefetch('/a_dean/itemgroups')
    if (!Number.isInteger(itemGroupId) || itemGroupId <= 0) {
      toast('Invalid item group ID.')
      router.replace('/a_dean/itemgroups')
      return
    }

    const loadItemGroup = async () => {
      try {
        const data = await getItemGroupById(itemGroupId)
        const father = data.father == null ? null : Number(data.father)
        setForm({ code: data.code || '', name: data.name || '', remarks: data.remarks || '', father })
        if (father == null) await loadSubItemGroups()
      } catch (error) {
        toast('Error: ' + getSaveErrorMessage(error, 'Unable to load item group'))
        router.replace('/a_dean/itemgroups')
      } finally {
        setLoading(false)
      }
    }
    void loadItemGroup()
  }, [itemGroupId, loadSubItemGroups, router])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return toast('Please fill in the name.')
    setSaving(true)
    try {
      await updateItemGroup(itemGroupId, {
        code: form.code,
        name: form.name.trim(),
        remarks: form.remarks.trim(),
      })
      toast('Item group updated successfully')
    } catch (error) {
      toast('Error: ' + getSaveErrorMessage(error, 'Unable to update item group'))
    } finally {
      setSaving(false)
    }
  }

  const addDraft = () => {
    setInlineSubItemGroups(current => [
      ...current,
      { draftId: crypto.randomUUID(), level: selectedLevel, name: '', remarks: '' },
    ])
  }

  const saveDrafts = async () => {
    if (inlineSubItemGroups.length === 0) return
    if (inlineSubItemGroups.some(draft => !draft.name.trim())) {
      toast('Please fill in the name for every new sub item group.')
      return
    }

    setInlineSubItemGroupsSaving(true)
    const drafts = [...inlineSubItemGroups]
    try {
      const results: PromiseSettledResult<ItemGroup>[] = []
      for (const draft of drafts) {
        try {
          const savedGroup = await addSubItemGroup(itemGroupId, draft.level, {
            name: draft.name.trim(),
            remarks: draft.remarks.trim(),
          })
          results.push({ status: 'fulfilled', value: savedGroup })
        } catch (error) {
          results.push({ status: 'rejected', reason: error })
        }
      }
      const savedDraftIds = new Set(results.flatMap((result, index) =>
        result.status === 'fulfilled' ? [drafts[index].draftId] : [],
      ))
      const failedResults = results.filter(result => result.status === 'rejected')
      setInlineSubItemGroups(current => current.filter(draft => !savedDraftIds.has(draft.draftId)))

      if (savedDraftIds.size > 0) {
        toast(`${savedDraftIds.size} sub item group${savedDraftIds.size === 1 ? '' : 's'} saved successfully`)
        await loadSubItemGroups()
      }
      if (failedResults.length > 0) {
        const firstFailure = failedResults[0]
        toast('Error: ' + getSaveErrorMessage(
          firstFailure.status === 'rejected' ? firstFailure.reason : null,
          `Unable to save ${failedResults.length} sub item group${failedResults.length === 1 ? '' : 's'}`,
        ))
      }
    } finally {
      setInlineSubItemGroupsSaving(false)
    }
  }

  const openEditSubItemGroup = (itemGroup: ItemGroup) => {
    setEditingSubItemGroup(itemGroup)
    setSubItemGroupForm({ code: itemGroup.code, name: itemGroup.name, remarks: itemGroup.remarks || '' })
  }

  const handleEditSubItemGroup = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingSubItemGroup?.id || !subItemGroupForm.name.trim()) return toast('Please fill in the name.')
    setSubItemGroupSaving(true)
    try {
      await updateItemGroup(editingSubItemGroup.id, {
        code: subItemGroupForm.code.trim(),
        name: subItemGroupForm.name.trim(),
        remarks: subItemGroupForm.remarks.trim(),
      })
      toast('Sub item group updated successfully')
      setEditingSubItemGroup(null)
      setSubItemGroupForm(emptySubItemGroup)
      await loadSubItemGroups()
    } catch (error) {
      toast('Error: ' + getSaveErrorMessage(error, 'Unable to update sub item group'))
    } finally {
      setSubItemGroupSaving(false)
    }
  }

  const handleVoidSelectedSubItemGroups = async () => {
    const selectedGroups = subItemGroups.filter(group =>
      group.id != null && selectedSubItemGroupIds.has(Number(group.id)),
    )
    if (selectedGroups.length === 0) return
    if (!window.confirm(`Void ${selectedGroups.length} selected sub item group${selectedGroups.length === 1 ? '' : 's'}?`)) return

    setSubItemGroupsVoiding(true)
    const voidedIds = new Set<number>()
    const failures: unknown[] = []
    try {
      for (const group of selectedGroups) {
        try {
          await voidItemGroup(Number(group.id))
          voidedIds.add(Number(group.id))
        } catch (error) {
          failures.push(error)
        }
      }

      if (voidedIds.size > 0) {
        setSubItemGroups(current => current.filter(group => !voidedIds.has(Number(group.id))))
        setSelectedSubItemGroupIds(current => new Set(
          Array.from(current).filter(id => !voidedIds.has(id)),
        ))
        toast(`${voidedIds.size} sub item group${voidedIds.size === 1 ? '' : 's'} voided successfully`)
        await loadSubItemGroups()
      }
      if (failures.length > 0) {
        toast('Error: ' + getSaveErrorMessage(
          failures[0],
          `Unable to void ${failures.length} sub item group${failures.length === 1 ? '' : 's'}`,
        ))
      }
    } finally {
      setSubItemGroupsVoiding(false)
    }
  }

  const levelRows = useMemo<LevelRow[]>(() => [
    ...subItemGroups
      .filter(group => Number(group.subgroup_level) === selectedLevel)
      .map(group => ({
        id: Number(group.id),
        code: group.code,
        name: group.name,
        remarks: group.remarks || '',
        level: selectedLevel,
        itemGroup: group,
      })),
    ...inlineSubItemGroups
      .filter(draft => draft.level === selectedLevel)
      .map(draft => ({
        id: `new-${draft.draftId}`,
        code: '#',
        name: draft.name,
        remarks: draft.remarks,
        level: draft.level,
        isDraft: true,
        draftId: draft.draftId,
      })),
  ], [inlineSubItemGroups, selectedLevel, subItemGroups])

  const selectableLevelGroupIds = useMemo(() => subItemGroups
    .filter(group => group.id != null && Number(group.subgroup_level) === selectedLevel)
    .map(group => Number(group.id)), [selectedLevel, subItemGroups])
  const allLevelGroupsSelected = selectableLevelGroupIds.length > 0 &&
    selectableLevelGroupIds.every(id => selectedSubItemGroupIds.has(id))
  const someLevelGroupsSelected = selectableLevelGroupIds.some(id => selectedSubItemGroupIds.has(id))

  const levelColumns: Column<LevelRow>[] = [
    {
      key: 'selected',
      label: 'Select',
      width: 70,
      align: 'center',
      sortable: false,
      editable: false,
      render: row => row.isDraft ? null : (
        <Checkbox
          aria-label={`Select ${row.code} - ${row.name}`}
          checked={selectedSubItemGroupIds.has(Number(row.id))}
          disabled={subItemGroupsVoiding || voidDisabled}
          onPointerDown={event => event.stopPropagation()}
          onCheckedChange={checked => setSelectedSubItemGroupIds(current => {
            const next = new Set(current)
            if (checked === true) next.add(Number(row.id))
            else next.delete(Number(row.id))
            return next
          })}
        />
      ),
    },
    { key: 'code', label: 'ID', width: 110, editable: false },
    {
      key: 'name',
      label: 'Category Segment',
      width: 420,
      editable: false,
      render: row => {
        if (!row.isDraft) return row.name
        const draft = inlineSubItemGroups.find(item => item.draftId === row.draftId)
        return (
          <Input
            autoFocus
            value={draft?.name ?? ''}
            placeholder="Enter category segment"
            className="h-7 rounded-none"
            disabled={inlineSubItemGroupsSaving}
            onPointerDown={event => event.stopPropagation()}
            onKeyDown={event => {
              event.stopPropagation()
              if (event.key === 'Escape' && !inlineSubItemGroupsSaving) {
                setInlineSubItemGroups(current => current.filter(item => item.draftId !== row.draftId))
              }
            }}
            onChange={event => setInlineSubItemGroups(current => current.map(item =>
              item.draftId === row.draftId ? { ...item, name: event.target.value } : item,
            ))}
            onPaste={event => {
              event.preventDefault()
              event.stopPropagation()
              const entries = getPastedSubItemGroups(event.clipboardData.getData('text/plain'))
              if (entries.length === 0) return
              setInlineSubItemGroups(current => current.flatMap(item => item.draftId === row.draftId
                ? [
                    { ...item, ...entries[0] },
                    ...entries.slice(1).map(entry => ({
                      ...item,
                      ...entry,
                      draftId: crypto.randomUUID(),
                    })),
                  ]
                : [item],
              ))
            }}
          />
        )
      },
    },
    { key: 'level', label: 'Level', width: 90, align: 'center', editable: false },
    {
      key: 'remarks',
      label: 'Category Description',
      width: 440,
      editable: false,
      render: row => {
        if (!row.isDraft) return row.remarks || '-'
        return (
          <Input
            value={String(row.remarks ?? '')}
            placeholder="Enter category description"
            className="h-7 rounded-none"
            disabled={inlineSubItemGroupsSaving}
            onPointerDown={event => event.stopPropagation()}
            onKeyDown={event => event.stopPropagation()}
            onChange={event => setInlineSubItemGroups(current => current.map(item =>
              item.draftId === row.draftId ? { ...item, remarks: event.target.value } : item,
            ))}
          />
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      type: 'button',
      sortable: false,
      width: 100,
      align: 'right',
      render: row => {
        if (row.isDraft) return (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[11px]"
            disabled={inlineSubItemGroupsSaving}
            onClick={() => setInlineSubItemGroups(current => current.filter(item => item.draftId !== row.draftId))}
          >
            Cancel
          </Button>
        )
        if (!row.itemGroup?.id) return null
        return (
          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => openEditSubItemGroup(row.itemGroup!)}>
            <Edit className="size-3" /> Edit
          </Button>
        )
      },
    },
  ]

  if (loading) return <ItemGroupEditSkeleton />
  const isRootItemGroup = form.father == null

  return (
    <main className="min-h-[calc(100vh-4rem)] text-stone-950 dark:text-foreground">
      <div className="flex items-center justify-between gap-3 px-4 mt-4">
        <Breadcrumb FirstPreviewsPageName="Inventory" SecondPreviewPageName="Item Groups" SecondPreviewPageLink="/a_dean/itemgroups" CurrentPageName="Edit Item Group" />
        <Button type="button" variant="outline" onClick={() => router.push('/a_dean/itemgroups')}>
          <List className="size-4" /> Item Group List
        </Button>
      </div>

      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-card">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-x-16 gap-y-3 p-5 lg:grid-cols-2">
            <div className="grid items-center gap-2 sm:grid-cols-[112px_minmax(0,300px)]">
              <Label htmlFor="item-group-code" className="font-semibold" required>Code</Label>
              <Input id="item-group-code" value={form.code} readOnly={isRootItemGroup} onChange={event => setForm(current => ({ ...current, code: event.target.value }))} />
            </div>
            <div className="grid items-center gap-2 sm:grid-cols-[112px_minmax(0,300px)]">
              <Label htmlFor="item-group-name" className="font-semibold" required>Name</Label>
              <Input id="item-group-name" value={form.name} required onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="grid items-start gap-2 lg:col-span-2 sm:grid-cols-[112px_minmax(0,1fr)]">
              <Label htmlFor="item-group-remarks" className="pt-2 font-semibold">Remarks</Label>
              <Textarea id="item-group-remarks" value={form.remarks} onChange={event => setForm(current => ({ ...current, remarks: event.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end border-t px-5 py-4">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>

        {isRootItemGroup && (
          <div className="border-t p-5">
            <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm dark:border-border dark:bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3">
                <div>
                  <h2 className="text-base font-semibold">Sub Item Group Lists</h2>
                  <p className="text-xs text-muted-foreground">Paste Category Segment and Category Description columns from Excel. The numeric ID is generated after saving.</p>
                </div>
                <Button type="button" disabled={insertDisabled || inlineSubItemGroupsSaving} onClick={addDraft}>
                  <Plus className="size-4" /> Add Level {selectedLevel} Group
                </Button>
              </div>

              <div className="flex gap-1 border-b bg-muted/30 px-3 pt-3">
                {Array.from({ length: ITEM_GROUP_MAX_SUBGROUP_LEVELS }, (_, index) => index + 1).map(level => {
                  const persistedCount = subItemGroups.filter(group => Number(group.subgroup_level) === level).length
                  const draftCount = inlineSubItemGroups.filter(draft => draft.level === level).length
                  return (
                    <Button
                      key={level}
                      type="button"
                      size="sm"
                      variant={selectedLevel === level ? 'default' : 'ghost'}
                      className="rounded-b-none"
                      onClick={() => {
                        setSelectedLevel(level)
                        setSelectedSubItemGroupIds(new Set())
                      }}
                    >
                      Level {level} ({persistedCount + draftCount})
                    </Button>
                  )
                })}
              </div>

              <div className="flex min-h-11 flex-wrap items-center gap-3 border-b px-3 py-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    aria-label={`Select all Sub Group Level ${selectedLevel} entries`}
                    checked={allLevelGroupsSelected ? true : someLevelGroupsSelected ? 'indeterminate' : false}
                    disabled={selectableLevelGroupIds.length === 0 || subItemGroupsVoiding || voidDisabled}
                    onCheckedChange={checked => setSelectedSubItemGroupIds(
                      checked === true ? new Set(selectableLevelGroupIds) : new Set(),
                    )}
                  />
                  Select all Level {selectedLevel}
                </label>
                <span className="text-xs text-muted-foreground">{selectedSubItemGroupIds.size} selected</span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="ml-auto"
                  disabled={selectedSubItemGroupIds.size === 0 || subItemGroupsVoiding || voidDisabled}
                  onClick={() => void handleVoidSelectedSubItemGroups()}
                >
                  {subItemGroupsVoiding ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  {subItemGroupsVoiding ? 'Voiding...' : `Void Selected (${selectedSubItemGroupIds.size})`}
                </Button>
              </div>

              <DynamicTable
                columns={levelColumns}
                data={levelRows}
                loading={subItemGroupsLoading}
                rowKey="id"
                ExcelTable
                excelRowActions={false}
                enablePagination={false}
                enableFilters={false}
                emptyMessage={`No Sub Group Level ${selectedLevel} entries yet.`}
                searchPlaceholder={`Search Level ${selectedLevel} groups...`}
                frozenColumns={3}
              />

              {inlineSubItemGroups.length > 0 && (
                <div className="flex justify-end border-t px-3 py-3">
                  <Button
                    type="button"
                    disabled={inlineSubItemGroupsSaving || inlineSubItemGroups.some(draft => !draft.name.trim())}
                    onClick={() => void saveDrafts()}
                  >
                    {inlineSubItemGroupsSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {inlineSubItemGroupsSaving ? 'Saving...' : `Save Sub Item Groups (${inlineSubItemGroups.length})`}
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}
      </section>

      <Dialog open={editingSubItemGroup != null} onOpenChange={open => {
        if (!open && !subItemGroupSaving) {
          setEditingSubItemGroup(null)
          setSubItemGroupForm(emptySubItemGroup)
        }
      }}>
        <DialogContent>
          <form onSubmit={handleEditSubItemGroup} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit Sub Item Group</DialogTitle>
              <DialogDescription>Updating this entry affects items that already use it.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label htmlFor="sub-item-code" required>Code</Label><Input id="sub-item-code" value={subItemGroupForm.code} required onChange={event => setSubItemGroupForm(current => ({ ...current, code: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="sub-item-name" required>Category Segment</Label><Input id="sub-item-name" value={subItemGroupForm.name} required onChange={event => setSubItemGroupForm(current => ({ ...current, name: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="sub-item-remarks">Category Description</Label><Textarea id="sub-item-remarks" value={subItemGroupForm.remarks} onChange={event => setSubItemGroupForm(current => ({ ...current, remarks: event.target.value }))} /></div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={subItemGroupSaving}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={subItemGroupSaving}>
                {subItemGroupSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {subItemGroupSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
