'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, Loader2, Pencil, Plus, RefreshCcw, Search } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePermission } from '@/hooks/usePermission'
import Breadcrumb from '@/lib/Breadcrumb'
import {
  createBrCleanupType,
  listBrCleanupTypes,
  renameBrCleanupType,
  setBrCleanupTypeVoid,
  type BrCleanupType,
} from '@/lib/data/repositories/brCleanupTypes'

type EditorState = { mode: 'create'; row: null } | { mode: 'edit'; row: BrCleanupType }

export default function GeneralSettingsLayout() {
  const cannotInsert = usePermission('/brd/settings/general/insert')
  const cannotEdit = usePermission('/brd/settings/general/edit')
  const cannotVoid = usePermission('/brd/settings/general/void')
  const [rows, setRows] = useState<BrCleanupType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingId, setChangingId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [showVoided, setShowVoided] = useState(false)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [name, setName] = useState('')

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listBrCleanupTypes())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load Cleanup Types.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadRows() }, [loadRows])

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return rows.filter(row => {
      if (!showVoided && row.is_void) return false
      return !normalizedQuery
        || row.code.toLowerCase().includes(normalizedQuery)
        || row.name.toLowerCase().includes(normalizedQuery)
    })
  }, [query, rows, showVoided])

  const openCreate = () => {
    setName('')
    setEditor({ mode: 'create', row: null })
  }

  const openEdit = (row: BrCleanupType) => {
    setName(row.name)
    setEditor({ mode: 'edit', row })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editor || !name.trim()) return

    setSaving(true)
    try {
      const saved = editor.mode === 'create'
        ? await createBrCleanupType(name)
        : await renameBrCleanupType(editor.row.id, name)
      setRows(current => editor.mode === 'create'
        ? [...current, saved].sort((left, right) => left.id - right.id)
        : current.map(row => row.id === saved.id ? saved : row))
      setEditor(null)
      toast.success(editor.mode === 'create' ? `${saved.code} created.` : `${saved.code} renamed.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save the Cleanup Type.')
    } finally {
      setSaving(false)
    }
  }

  const toggleVoid = async (row: BrCleanupType) => {
    const nextVoid = !row.is_void
    const action = nextVoid ? 'void' : 'restore'

    setChangingId(row.id)
    try {
      const saved = await setBrCleanupTypeVoid(row.id, nextVoid)
      setRows(current => current.map(item => item.id === saved.id ? saved : item))
      toast.success(`${saved.code} ${nextVoid ? 'voided' : 'restored'}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to ${action} the Cleanup Type.`)
    } finally {
      setChangingId(null)
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-3 p-3 sm:p-4">
      <Breadcrumb FirstPreviewsPageName="Broiler" FirstPreviewsPageLink="/brd" CurrentPageName="General Settings" />

      <header className="flex flex-col gap-2 rounded-md border bg-card p-3 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">General Settings</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Maintain global Broiler settings shared by every farm.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void loadRows()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            Refresh
          </Button>
        </div>
      </header>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="gap-2 border-b bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm">Cleanup Types</CardTitle>
            <CardDescription className="text-xs">Codes are generated automatically. Voided types remain recoverable and are hidden from Cleanup transactions.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex h-8 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              <input type="checkbox" checked={showVoided} onChange={event => setShowVoided(event.target.checked)} />
              Show voided
            </label>
            <div className="relative">
              {/* <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" /> */}
              <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search code or name..." className="h-8 w-full pl-8 sm:w-64" />
            </div>
            <Button size="sm" onClick={openCreate} disabled={cannotInsert}>
              <Plus className="size-4" />
              New Cleanup Type
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-52 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow>
                ) : visibleRows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No Cleanup Types found.</TableCell></TableRow>
                ) : visibleRows.map(row => (
                  <TableRow key={row.id} className={row.is_void ? 'text-muted-foreground' : undefined}>
                    <TableCell className="font-mono font-medium">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell><Badge variant={row.is_void ? 'secondary' : 'default'}>{row.is_void ? 'Voided' : 'Active'}</Badge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" disabled={cannotEdit || changingId === row.id} onClick={() => openEdit(row)}>
                          <Pencil className="size-4" /> Edit
                        </Button>
                        <Button size="sm" variant={row.is_void ? 'outline' : 'destructive'} disabled={cannotVoid || changingId === row.id} onClick={() => void toggleVoid(row)}>
                          {changingId === row.id ? <Loader2 className="size-4 animate-spin" /> : row.is_void ? <CheckCircle2 className="size-4" /> : <Ban className="size-4" />}
                          {row.is_void ? 'Unvoid' : 'Void'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open && !saving) setEditor(null) }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{editor?.mode === 'edit' ? 'Edit Cleanup Type' : 'New Cleanup Type'}</DialogTitle>
              <DialogDescription>
                {editor?.mode === 'edit' ? `Update the name for ${editor.row.code}.` : 'Enter a name. The system will assign the next CT code.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="cleanup-type-name">Name</Label>
              <Input id="cleanup-type-name" value={name} maxLength={80} autoFocus disabled={saving} onChange={event => setName(event.target.value)} placeholder="Enter Cleanup Type name" />
              <p className="text-xs text-muted-foreground">Only the name is entered manually.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {saving ? 'Saving...' : editor?.mode === 'edit' ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
