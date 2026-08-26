'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Edit, List, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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

const emptySubItemGroup: SubItemGroupForm = {
  code: '',
  name: '',
  remarks: '',
}

function getSaveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message

  if (typeof error === 'object' && error != null && 'message' in error) {
    const message = error.message
    if (typeof message === 'string' && message) return message
  }

  return fallback
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
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="grid items-center gap-2 sm:grid-cols-[112px_minmax(0,300px)]">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <div className="border-t p-5">
          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between border-b px-3 py-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-9 w-44" />
            </div>
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
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
  const [voidingId, setVoidingId] = useState<number | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingSubItemGroup, setEditingSubItemGroup] = useState<ItemGroup | null>(null)
  const [subItemGroups, setSubItemGroups] = useState<ItemGroup[]>([])
  const [subItemGroupForm, setSubItemGroupForm] = useState<SubItemGroupForm>(emptySubItemGroup)
  const [form, setForm] = useState<ItemGroupForm>({
    code: '',
    name: '',
    remarks: '',
    father: null,
  })

  const loadSubItemGroups = useCallback(async () => {
    setSubItemGroupsLoading(true)
    try {
      setSubItemGroups(await getSubItemGroups(itemGroupId))
    } catch (error) {
      const message = getSaveErrorMessage(error, 'Unable to load sub item groups')
      toast('Error: ' + message)
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
        setForm({
          code: data.code || '',
          name: data.name || '',
          remarks: data.remarks || '',
          father,
        })

        if (father == null) await loadSubItemGroups()
      } catch (error) {
        const message = getSaveErrorMessage(error, 'Unable to load item group')
        toast('Error: ' + message)
        router.replace('/a_dean/itemgroups')
      } finally {
        setLoading(false)
      }
    }

    loadItemGroup()
  }, [itemGroupId, loadSubItemGroups, router])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.name.trim()) {
      toast('Please fill in the name.')
      return
    }

    setSaving(true)
    try {
      await updateItemGroup(itemGroupId, {
        code: form.code,
        name: form.name.trim(),
        remarks: form.remarks.trim(),
      })
      toast('Item group updated successfully')
    } catch (error) {
      const message = getSaveErrorMessage(error, 'Unable to update item group')
      toast('Error: ' + message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddSubItemGroup = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!subItemGroupForm.name.trim()) {
      toast('Please fill in the name.')
      return
    }

    setSubItemGroupSaving(true)
    try {
      await addSubItemGroup(itemGroupId, {
        name: subItemGroupForm.name.trim(),
        remarks: subItemGroupForm.remarks.trim(),
      })
      toast('Sub item group added successfully')
      setSubItemGroupForm(emptySubItemGroup)
      setAddDialogOpen(false)
      await loadSubItemGroups()
    } catch (error) {
      const message = getSaveErrorMessage(error, 'Unable to add sub item group')
      toast('Error: ' + message)
    } finally {
      setSubItemGroupSaving(false)
    }
  }

  const openEditSubItemGroup = (itemGroup: ItemGroup) => {
    setEditingSubItemGroup(itemGroup)
    setSubItemGroupForm({
      code: itemGroup.code,
      name: itemGroup.name,
      remarks: itemGroup.remarks || '',
    })
  }

  const handleEditSubItemGroup = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingSubItemGroup?.id || !subItemGroupForm.name.trim()) {
      toast('Please fill in the name.')
      return
    }

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
      const message = getSaveErrorMessage(error, 'Unable to update sub item group')
      toast('Error: ' + message)
    } finally {
      setSubItemGroupSaving(false)
    }
  }

  const handleVoidSubItemGroup = async (itemGroup: ItemGroup) => {
    if (!itemGroup.id) return
    if (!window.confirm(`Void sub item group "${itemGroup.code} - ${itemGroup.name}"?`)) return

    setVoidingId(itemGroup.id)
    try {
      await voidItemGroup(itemGroup.id)
      toast('Sub item group voided successfully')
      await loadSubItemGroups()
    } catch (error) {
      const message = getSaveErrorMessage(error, 'Unable to void sub item group')
      toast('Error: ' + message)
    } finally {
      setVoidingId(null)
    }
  }

  if (loading) return <ItemGroupEditSkeleton />

  const isRootItemGroup = form.father == null

  return (
    <main className="min-h-[calc(100vh-4rem)] text-stone-950 dark:text-foreground">
      <div className="flex items-center justify-between gap-3 px-4 mt-4">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          SecondPreviewPageName="Item Groups"
          SecondPreviewPageLink="/a_dean/itemgroups"
          CurrentPageName="Edit Item Group"
        />
        <Button type="button" variant="outline" onClick={() => router.push('/a_dean/itemgroups')}>
          <List className="size-4" />
          Item Group List
        </Button>
      </div>

      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-card">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-x-16 gap-y-3 p-5 lg:grid-cols-2">
            <div className="grid items-center gap-2 sm:grid-cols-[112px_minmax(0,300px)]">
              <Label htmlFor="item-group-code" className="font-semibold" required>Code</Label>
              <Input
                id="item-group-code"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                readOnly={form.father == null}
              />
            </div>
            <div className="grid items-center gap-2 sm:grid-cols-[112px_minmax(0,300px)]">
              <Label htmlFor="item-group-name" className="font-semibold" required>Name</Label>
              <Input
                id="item-group-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
            <div className="grid items-start gap-2 lg:col-span-2 sm:grid-cols-[112px_minmax(0,1fr)]">
              <Label htmlFor="item-group-remarks" className="pt-2 font-semibold">Remarks</Label>
              <Textarea
                id="item-group-remarks"
                value={form.remarks}
                onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
              />
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-3 py-3 dark:border-border">
                <div>
                  <h2 className="text-base font-semibold">Sub Item Groups</h2>
                  <p className="text-xs text-muted-foreground">One level of sub item groups under {form.code}.</p>
                </div>
                <Button
                  type="button"
                  disabled={insertDisabled}
                  onClick={() => {
                    setSubItemGroupForm(emptySubItemGroup)
                    setAddDialogOpen(true)
                  }}
                >
                  <Plus className="size-4" />
                  Add Sub Item Group
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-600 dark:bg-muted dark:text-muted-foreground">
                    <tr>
                      <th className="w-12 px-3 py-3 text-center">#</th>
                      <th className="w-48 px-3 py-3">Code</th>
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Remarks</th>
                      <th className="w-48 px-3 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subItemGroupsLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <tr key={index} className="border-t">
                          <td colSpan={5} className="px-3 py-2"><Skeleton className="h-9 w-full" /></td>
                        </tr>
                      ))
                    ) : subItemGroups.length === 0 ? (
                      <tr className="border-t">
                        <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                          No sub item groups added yet.
                        </td>
                      </tr>
                    ) : subItemGroups.map((itemGroup, index) => (
                      <tr key={itemGroup.id} className="border-t odd:bg-white even:bg-stone-50/70 hover:bg-stone-50 dark:odd:bg-card dark:even:bg-muted/40 dark:hover:bg-muted/60">
                        <td className="px-3 py-3 text-center text-muted-foreground">{index + 1}</td>
                        <td className="px-3 py-3 font-medium">{itemGroup.code}</td>
                        <td className="px-3 py-3">{itemGroup.name}</td>
                        <td className="px-3 py-3 text-muted-foreground">{itemGroup.remarks || '-'}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => openEditSubItemGroup(itemGroup)}>
                              <Edit className="size-4" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={voidDisabled || voidingId === itemGroup.id}
                              onClick={() => handleVoidSubItemGroup(itemGroup)}
                            >
                              {voidingId === itemGroup.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                              {voidingId === itemGroup.id ? 'Voiding...' : 'Void'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>

      <Dialog open={addDialogOpen} onOpenChange={(open) => !subItemGroupSaving && setAddDialogOpen(open)}>
        <DialogContent>
          <form onSubmit={handleAddSubItemGroup} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add Sub Item Group</DialogTitle>
              <DialogDescription>Add a direct child under {form.code} - {form.name}.</DialogDescription>
            </DialogHeader>
            <SubItemGroupFields form={subItemGroupForm} setForm={setSubItemGroupForm} hideCode />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={subItemGroupSaving}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={subItemGroupSaving}>
                {subItemGroupSaving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {subItemGroupSaving ? 'Adding...' : 'Add Sub Item Group'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingSubItemGroup != null}
        onOpenChange={(open) => {
          if (!open && !subItemGroupSaving) {
            setEditingSubItemGroup(null)
            setSubItemGroupForm(emptySubItemGroup)
          }
        }}
      >
        <DialogContent>
          <form onSubmit={handleEditSubItemGroup} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit Sub Item Group</DialogTitle>
              <DialogDescription>Update the selected sub item group details.</DialogDescription>
            </DialogHeader>
            <SubItemGroupFields form={subItemGroupForm} setForm={setSubItemGroupForm} />
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

function SubItemGroupFields({
  form,
  setForm,
  hideCode = false,
}: {
  form: SubItemGroupForm
  setForm: React.Dispatch<React.SetStateAction<SubItemGroupForm>>
  hideCode?: boolean
}) {
  return (
    <div className="space-y-4">
      {!hideCode && <div className="space-y-2">
        <Label htmlFor="sub-item-code" required>Code</Label>
        <Input
          id="sub-item-code"
          value={form.code}
          onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
          required
        />
      </div>}
      <div className="space-y-2">
        <Label htmlFor="sub-item-name" required>Name</Label>
        <Input
          id="sub-item-name"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sub-item-remarks">Remarks</Label>
        <Textarea
          id="sub-item-remarks"
          value={form.remarks}
          onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
        />
      </div>
    </div>
  )
}
