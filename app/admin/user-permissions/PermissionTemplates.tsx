"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import SearchableDropdown from "@/lib/SearchableDropdown"
import {
  applyPermissionTemplate,
  getPermissionTemplates,
  previewPermissionTemplate,
  savePermissionTemplate,
  setPermissionTemplateVoided,
  type PermissionAction,
  type PermissionFolder,
  type PermissionTemplate,
  type PermissionTemplateAssignment,
  type PermissionTemplatePreview,
  type PermissionUser,
} from "./api"

const ACTIONS: PermissionAction[] = ["list", "view", "insert", "edit", "void", "approval"]

function permissionKey(group: string, title: string) {
  return `${group}|${title}`
}

function actionTitle(title: string, action: PermissionAction) {
  return action === "list" ? title : `${title}/${action}`
}

function isActiveUser(user: PermissionUser) {
  return ["1", "true", "active", "yes"].includes(String(user.isactive ?? "").trim().toLowerCase())
}

function userName(user: PermissionUser) {
  return [user.firstname, user.lastname].filter(Boolean).join(" ") || user.email || "Unnamed user"
}

function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  permissionFolders,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: PermissionTemplate | null
  permissionFolders: PermissionFolder[]
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState("")
  const [remarks, setRemarks] = useState("")
  const [permissions, setPermissions] = useState<Set<string>>(() => new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(template?.template_name ?? "")
    setRemarks(template?.remarks ?? "")
    setPermissions(new Set((template?.permissions ?? [])
      .filter(item => item.is_visible)
      .map(item => permissionKey(item.group_name, item.title))))
  }, [open, template])

  function toggle(key: string, checked: boolean) {
    setPermissions(current => {
      const next = new Set(current)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Enter a template name.")
      return
    }
    setSaving(true)
    try {
      const selected = permissionFolders.flatMap(folder => folder.rows.flatMap(row => row.actions
        .map(action => ({ groupName: row.group, title: actionTitle(row.title, action) }))))
        .filter(item => permissions.has(permissionKey(item.groupName, item.title)))
      await savePermissionTemplate({
        templateId: template?.id || undefined,
        templateName: name.trim(),
        remarks: remarks.trim(),
        permissions: selected,
      })
      toast.success(template?.id ? "Permission template updated." : "Permission template created.")
      await onSaved()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save permission template.")
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={value => !saving && onOpenChange(value)}>
    <DialogContent className="max-w-5xl" showCloseButton={!saving}>
      <DialogHeader>
        <DialogTitle>{template?.id ? "Edit Permission Template" : "New Permission Template"}</DialogTitle>
        <DialogDescription>Template permissions are copied to users when the template is applied.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="permission-template-name" required>Template name</Label>
          <Input id="permission-template-name" value={name} onChange={event => setName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="permission-template-remarks">Remarks</Label>
          <Textarea id="permission-template-remarks" className="min-h-8" value={remarks} onChange={event => setRemarks(event.target.value)} />
        </div>
      </div>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
        {permissionFolders.map(folder => <section key={folder.id} className="overflow-hidden rounded-md border">
          <div className="border-b bg-muted/20 px-3 py-2 text-sm font-semibold">{folder.title}</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/20">
                <tr><th className="px-3 py-2 text-left">Module</th>{ACTIONS.map(action => <th key={action} className="w-24 px-2 py-2 text-center capitalize">{action}</th>)}</tr>
              </thead>
              <tbody>{folder.rows.map(row => <tr key={`${row.group}|${row.title}`} className="border-b last:border-0">
                <td className="px-3 py-2"><span className="font-medium">{row.title}</span><span className="ml-2 text-xs text-muted-foreground">{row.group}</span></td>
                {ACTIONS.map(action => {
                  const eligible = row.actions.includes(action)
                  const title = actionTitle(row.title, action)
                  const key = permissionKey(row.group, title)
                  return <td key={action} className="px-2 py-2 text-center">{eligible
                    ? <Checkbox checked={permissions.has(key)} onCheckedChange={value => toggle(key, value === true)} />
                    : <span className="text-muted-foreground">—</span>}</td>
                })}
              </tr>)}</tbody>
            </table>
          </div>
        </section>)}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button disabled={saving} onClick={save}>{saving ? "Saving..." : "Save Template"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

function ApplyTemplateDialog({
  open,
  onOpenChange,
  template,
  users,
  initialUserId,
  onApplied,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: PermissionTemplate | null
  users: PermissionUser[]
  initialUserId: string
  onApplied: (userIds: string[], templateId: number) => Promise<void>
}) {
  const activeUsers = useMemo(() => users.filter(isActiveUser), [users])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState("")
  const [preview, setPreview] = useState<PermissionTemplatePreview | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(new Set(initialUserId && activeUsers.some(user => user.auth_id === initialUserId) ? [initialUserId] : []))
    setSearch("")
    setPreview(null)
  }, [activeUsers, initialUserId, open])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return activeUsers.filter(user => !needle || `${userName(user)} ${user.email ?? ""}`.toLowerCase().includes(needle))
  }, [activeUsers, search])
  const allActiveSelected = activeUsers.length > 0 && activeUsers.every(user => selected.has(user.auth_id))

  function toggleUser(userId: string, checked: boolean) {
    setPreview(null)
    setSelected(current => {
      const next = new Set(current)
      if (checked) next.add(userId)
      else next.delete(userId)
      return next
    })
  }

  async function loadPreview() {
    if (!template || !selected.size) return
    setWorking(true)
    try {
      setPreview(await previewPermissionTemplate(template.id, [...selected]))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to preview template changes.")
    } finally {
      setWorking(false)
    }
  }

  async function apply() {
    if (!template || !preview) return
    setWorking(true)
    try {
      const response = await applyPermissionTemplate(template.id, [...selected])
      const userIds = response.result.affectedUserIds
      toast.success(`Applied ${template.template_name} to ${response.result.affectedUsers} active user${response.result.affectedUsers === 1 ? "" : "s"}.`)
      await onApplied(userIds, template.id)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to apply permission template.")
    } finally {
      setWorking(false)
    }
  }

  return <Dialog open={open} onOpenChange={value => !working && onOpenChange(value)}>
    <DialogContent className="max-w-3xl" showCloseButton={!working}>
      <DialogHeader>
        <DialogTitle>Apply {template?.template_name ?? "Permission Template"}</DialogTitle>
        <DialogDescription>Applying replaces every selected user&apos;s current permissions. Their permissions can be customized afterward.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5"><Label htmlFor="template-user-search">Active users</Label><Input id="template-user-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search active users..." /></div>
          <Button variant="outline" onClick={() => { setPreview(null); setSelected(allActiveSelected ? new Set() : new Set(activeUsers.map(user => user.auth_id))) }}>
            {allActiveSelected ? "Clear All" : `Select All (${activeUsers.length})`}
          </Button>
        </div>
        <div className="max-h-56 overflow-y-auto rounded-md border">
          {filtered.map(user => <label key={user.auth_id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-0 hover:bg-muted/30">
            <Checkbox checked={selected.has(user.auth_id)} onCheckedChange={value => toggleUser(user.auth_id, value === true)} />
            <span className="min-w-0"><span className="block truncate text-sm font-medium">{userName(user)}</span><span className="block truncate text-xs text-muted-foreground">{user.email ?? "—"}</span></span>
          </label>)}
          {!filtered.length && <p className="p-6 text-center text-sm text-muted-foreground">No active users found.</p>}
        </div>
        <p className="text-sm text-muted-foreground">{selected.size} active user{selected.size === 1 ? "" : "s"} selected</p>
        {preview && <div className="rounded-md border bg-muted/20 p-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{preview.permissionCount} template permissions</Badge>
            <Badge variant="secondary">{preview.added} additions</Badge>
            <Badge variant="secondary">{preview.removed} removals</Badge>
            <Badge variant="secondary">{preview.unchanged} unchanged</Badge>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Complete template</p>
              <div className="max-h-40 overflow-y-auto rounded-md border bg-card p-2">
                {template?.permissions.filter(item => item.is_visible).map(item => <p key={`${item.group_name}|${item.title}`} className="py-0.5 text-xs">{item.group_name} — {item.title}</p>)}
                {!template?.permissions.some(item => item.is_visible) && <p className="text-xs text-muted-foreground">This template has no permissions.</p>}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Changes by user</p>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border bg-card p-2">
                {preview.users.map(user => <div key={user.userId} className="border-b pb-2 last:border-0 last:pb-0">
                  <p className="text-xs font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">Add: {user.addedPermissions.join(", ") || "None"}</p>
                  <p className="text-xs text-muted-foreground">Remove: {user.removedPermissions.join(", ") || "None"}</p>
                </div>)}
              </div>
            </div>
          </div>
        </div>}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={working} onClick={() => onOpenChange(false)}>Cancel</Button>
        {!preview
          ? <Button disabled={working || !selected.size} onClick={loadPreview}>{working ? "Loading..." : "Preview Changes"}</Button>
          : <Button disabled={working} onClick={apply}>{working ? "Applying..." : `Apply to ${selected.size} User${selected.size === 1 ? "" : "s"}`}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

export function PermissionTemplateAssignment({ users, selectedUserId, onApplied }: {
  users: PermissionUser[]
  selectedUserId: string
  onApplied: (userIds: string[]) => void
}) {
  const [templates, setTemplates] = useState<PermissionTemplate[]>([])
  const [assignments, setAssignments] = useState<PermissionTemplateAssignment[]>([])
  const [templateId, setTemplateId] = useState("")
  const [applyOpen, setApplyOpen] = useState(false)

  async function refresh() {
    const result = await getPermissionTemplates()
    setTemplates(result.templates)
    setAssignments(result.assignments)
  }

  useEffect(() => {
    let active = true
    getPermissionTemplates()
      .then(result => {
        if (!active) return
        setTemplates(result.templates)
        setAssignments(result.assignments)
      })
      .catch(error => { if (active) toast.error(error instanceof Error ? error.message : "Unable to load permission templates.") })
    return () => { active = false }
  }, [])

  const activeTemplates = templates.filter(template => template.void === 0)
  const selectedTemplate = activeTemplates.find(template => String(template.id) === templateId) ?? null
  const assignment = assignments.find(item => item.user_id === selectedUserId)
  const assignedTemplate = templates.find(template => template.id === assignment?.template_id)

  return <div className="mt-3 border-t pt-3">
    <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label>Permission template</Label>
        <SearchableDropdown list={activeTemplates.map(template => ({ code: String(template.id), name: template.template_name }))} codeLabel="code" nameLabel="name" showNameOnly value={templateId} placeholder="Select template..." onChange={setTemplateId} />
      </div>
      <Button disabled={!selectedTemplate} onClick={() => setApplyOpen(true)}>Preview &amp; Apply</Button>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">Current template: {assignedTemplate?.template_name ?? "None"}{assignedTemplate?.void === 1 ? " (voided)" : ""}. Manual permission changes remain independent until the template is reapplied.</p>
    <ApplyTemplateDialog open={applyOpen} onOpenChange={setApplyOpen} template={selectedTemplate} users={users} initialUserId={selectedUserId} onApplied={async (userIds, appliedTemplateId) => {
      setAssignments(current => {
        const remaining = current.filter(item => !userIds.includes(item.user_id))
        const timestamp = new Date().toISOString()
        return [...remaining, ...userIds.map(userId => ({ user_id: userId, template_id: appliedTemplateId, assigned_by: "", assigned_at: timestamp, reapplied_at: timestamp }))]
      })
      onApplied(userIds)
      await refresh()
    }} />
  </div>
}

export function PermissionTemplatesManager({ permissionFolders }: { permissionFolders: PermissionFolder[] }) {
  const [templates, setTemplates] = useState<PermissionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<PermissionTemplate | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const result = await getPermissionTemplates()
      setTemplates(result.templates)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    let active = true
    getPermissionTemplates()
      .then(result => { if (active) setTemplates(result.templates) })
      .catch(error => { if (active) toast.error(error instanceof Error ? error.message : "Unable to load permission templates.") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function openEditor(template: PermissionTemplate | null) {
    setEditing(template)
    setEditorOpen(true)
  }

  async function toggleVoided(template: PermissionTemplate) {
    try {
      await setPermissionTemplateVoided(template.id, template.void === 0)
      toast.success(template.void === 0 ? "Permission template voided." : "Permission template restored.")
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update permission template.")
    }
  }

  return <div className="space-y-3">
    <div className="flex flex-col gap-2 rounded-md border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-base font-semibold">Permission Templates</h2><p className="text-sm text-muted-foreground">Create reusable permission sets and apply them from Manage Permissions.</p></div>
      <Button onClick={() => openEditor(null)}>New Template</Button>
    </div>
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b bg-muted/20"><tr><th className="px-3 py-2 text-left">Template</th><th className="px-3 py-2 text-left">Remarks</th><th className="px-3 py-2 text-center">Permissions</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
        <tbody>{templates.map(template => <tr key={template.id} className="border-b last:border-0">
          <td className="px-3 py-2 font-medium">{template.template_name}</td><td className="px-3 py-2 text-muted-foreground">{template.remarks || "—"}</td><td className="px-3 py-2 text-center">{template.permissions.filter(item => item.is_visible).length}</td><td className="px-3 py-2 text-center"><Badge variant={template.void === 0 ? "secondary" : "outline"}>{template.void === 0 ? "Active" : "Voided"}</Badge></td>
          <td className="px-3 py-2"><div className="flex justify-end gap-2"><Button size="xs" variant="outline" onClick={() => openEditor(template)}>Edit</Button><Button size="xs" variant="outline" onClick={() => openEditor({ ...template, id: 0, template_name: `${template.template_name} Copy` })}>Duplicate</Button><Button size="xs" variant={template.void === 0 ? "destructive" : "secondary"} onClick={() => toggleVoided(template)}>{template.void === 0 ? "Void" : "Unvoid"}</Button></div></td>
        </tr>)}{!loading && !templates.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No permission templates yet.</td></tr>}</tbody>
      </table>
      {loading && <p className="p-6 text-center text-sm text-muted-foreground">Loading permission templates...</p>}
    </div>
    <TemplateEditorDialog open={editorOpen} onOpenChange={setEditorOpen} template={editing} permissionFolders={permissionFolders} onSaved={refresh} />
  </div>
}
