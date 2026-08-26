'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Pencil, Plus, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import Breadcrumb from '@/lib/Breadcrumb'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePermission } from '@/hooks/usePermission'
import { getWorkspaceTaskStatuses, type WorkspaceTaskStatus } from '@/lib/data/repositories/workspace'
import { saveWorkspaceTaskStatus } from '@/lib/data/mutations/workspace'

const EMPTY_FORM = {
  id: undefined as number | undefined,
  code: '',
  name: '',
  color: '#64748b',
  sort_order: 10,
  is_final: false,
}

export default function Layout() {
  const editDenied = usePermission('/wks/settings/task-workflow/edit')
  const [statuses, setStatuses] = useState<WorkspaceTaskStatus[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadStatuses = useCallback(async () => {
    setLoading(true)
    try {
      setStatuses(await getWorkspaceTaskStatuses({ includeInactive: true }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load task statuses')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatuses()
  }, [loadStatuses])

  const editStatus = (status: WorkspaceTaskStatus) => {
    setForm({
      id: status.id,
      code: status.code,
      name: status.name,
      color: status.color,
      sort_order: status.sort_order,
      is_final: status.is_final,
    })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (editDenied) {
      toast.error('You do not have permission to edit the task workflow')
      return
    }
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Code and name are required')
      return
    }

    setSaving(true)
    try {
      await saveWorkspaceTaskStatus(form)
      toast.success(form.id ? 'Task status updated' : 'Task status added')
      setForm(EMPTY_FORM)
      await loadStatuses()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save task status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Breadcrumb FirstPreviewsPageName="Workspace" CurrentPageName="Task Workflow Settings" />
          <p className="mt-1 text-sm text-muted-foreground">Configure the columns used by My Work and project task boards.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStatuses} disabled={loading || saving}>
          <RefreshCcw className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="shadow-none">
          <div className="border-b p-3">
            <h2 className="font-semibold">Workflow Columns</h2>
            <p className="text-xs text-muted-foreground">Lower order numbers appear first.</p>
          </div>
          <div className="divide-y">
            {statuses.map(status => (
              <div key={status.id} className="flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-medium">
                      {status.name}
                      {status.is_final && <CheckCircle2 className="size-4 text-green-600" aria-label="Final status" />}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{status.code} · Order {status.sort_order}</span>
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => editStatus(status)} disabled={editDenied || saving}>
                  <Pencil /> Edit
                </Button>
              </div>
            ))}
            {!loading && statuses.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No task statuses configured.</div>}
          </div>
        </Card>

        <Card className="h-fit p-4 shadow-none">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{form.id ? 'Edit Status' : 'Add Status'}</h2>
              {form.id && <Button type="button" variant="ghost" size="sm" onClick={() => setForm(EMPTY_FORM)}>Cancel</Button>}
            </div>
            <div>
              <Label required htmlFor="workflow-status-name">Name</Label>
              <Input id="workflow-status-name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="For Review" disabled={editDenied || saving} />
            </div>
            <div>
              <Label required htmlFor="workflow-status-code">Code</Label>
              <Input id="workflow-status-code" value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value }))} placeholder="FOR_REVIEW" disabled={editDenied || saving || Boolean(form.id)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required htmlFor="workflow-status-order">Order</Label>
                <Input id="workflow-status-order" type="number" min={0} value={form.sort_order} onChange={event => setForm(current => ({ ...current, sort_order: Number(event.target.value) }))} disabled={editDenied || saving} />
              </div>
              <div>
                <Label required htmlFor="workflow-status-color">Color</Label>
                <Input id="workflow-status-color" type="color" value={form.color} onChange={event => setForm(current => ({ ...current, color: event.target.value }))} disabled={editDenied || saving} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_final} onCheckedChange={checked => setForm(current => ({ ...current, is_final: checked === true }))} disabled={editDenied || saving} />
              Counts as completed
            </label>
            <Button type="submit" className="w-full" disabled={editDenied || saving}>
              {form.id ? <Pencil /> : <Plus />} {form.id ? 'Update Status' : 'Add Status'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  )
}
