"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getManagedUserPermissions,
  setManagedUserPermission,
  type PermissionAction,
  type PermissionFolder,
  type PermissionRow,
  type PermissionUser,
} from "./api"

function permissionKey(row: PermissionRow, action: PermissionAction) {
  return `${row.group}|${action === "list" ? row.title : `${row.title}/${action}`}`
}

function PermissionEditorSkeleton() {
  return <div className="space-y-4" aria-label="Loading user permissions">
    {[5, 4].map((rowCount, sectionIndex) => <section key={sectionIndex} className="overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="overflow-hidden">
        <div className="grid min-w-[760px] grid-cols-[minmax(260px,1fr)_repeat(6,96px)] items-center border-b bg-muted/20 px-4 py-2">
          <Skeleton className="h-4 w-20" />
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="mx-auto h-7 w-16" />)}
        </div>
        {Array.from({ length: rowCount }, (_, rowIndex) => <div
          key={rowIndex}
          className="grid min-w-[760px] grid-cols-[minmax(260px,1fr)_repeat(6,96px)] items-center border-b px-4 py-3 last:border-0"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className={`h-4 ${rowIndex % 2 === 0 ? "w-40" : "w-52"}`} />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="mx-auto size-4 rounded-sm" />)}
        </div>)}
      </div>
    </section>)}
  </div>
}

export type PermissionEditorHandle = {
  setAll: (checked: boolean) => Promise<void>
}

const PermissionEditor = forwardRef<PermissionEditorHandle, { user: PermissionUser; permissionFolders: PermissionFolder[] }>(function PermissionEditor({ user, permissionFolders }, ref) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const folders = useMemo(() => permissionFolders
    .filter(folder => !user.fms_type || !folder.fmsTypes?.length || folder.fmsTypes.includes(user.fms_type as "Broiler" | "Breeder" | "Hatchery"))
    .filter(folder => folder.rows.length), [permissionFolders, user.fms_type])
  const rows = useMemo<PermissionRow[]>(() => folders.flatMap(folder => folder.rows), [folders])

  useEffect(() => {
    let active = true
    setLoading(true)
    getManagedUserPermissions(user.auth_id)
      .then(result => {
        if (!active) return
        setPermissions(Object.fromEntries(result.permissions.map(item => [
          `${item.group_name}|${item.title}`,
          item.is_visible,
        ])))
      })
      .catch(error => toast.error(error instanceof Error ? error.message : "Unable to load permissions."))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [user.auth_id])

  const toggle = useCallback(async (row: PermissionRow, action: PermissionAction, checked: boolean) => {
    const key = permissionKey(row, action)
    setPermissions(current => ({ ...current, [key]: checked }))
    setSaving(key)
    try {
      await setManagedUserPermission({
        userId: user.auth_id,
        groupName: row.group,
        title: action === "list" ? row.title : `${row.title}/${action}`,
        checked,
      })
    } catch (error) {
      setPermissions(current => ({ ...current, [key]: !checked }))
      toast.error(error instanceof Error ? error.message : "Unable to update permission.")
    } finally {
      setSaving(null)
    }
  }, [user.auth_id])

  async function toggleColumn(folderRows: PermissionRow[], action: PermissionAction) {
    const eligible = folderRows.filter(row => row.actions.includes(action))
    const checked = !eligible.every(row => permissions[permissionKey(row, action)])
    for (const row of eligible) await toggle(row, action, checked)
  }

  useImperativeHandle(ref, () => ({
    async setAll(checked: boolean) {
      if (loading) {
        toast.info("Wait for the selected user's permissions to finish loading.")
        return
      }
      const changes = rows.flatMap(row => row.actions.map(action => ({ row, action })))
        .filter(({ row, action }) => Boolean(permissions[permissionKey(row, action)]) !== checked)

      if (!changes.length) {
        toast.info(`All permissions are already ${checked ? "allowed" : "removed"}.`)
        return
      }

      for (const { row, action } of changes) await toggle(row, action, checked)
      toast.success(`${checked ? "Allowed" : "Removed"} ${changes.length} permissions.`)
    },
  }), [loading, permissions, rows, toggle])

  if (loading) return <PermissionEditorSkeleton />

  return <div className="space-y-4">
    {folders.map(folder => {
      const folderRows = folder.rows
      return <section key={folder.id} className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{folder.title}</h2>
            <p className="text-xs text-muted-foreground">Permission controls for this module group</p>
          </div>
          <Badge variant="secondary">{folderRows.length} modules</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/20">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Module</th>
                {(["list", "view", "insert", "edit", "void", "approval"] as PermissionAction[]).map(action =>
                  <th key={action} className="w-24 px-2 py-2 text-center">
                    <Button size="xs" variant="outline" onClick={() => toggleColumn(folderRows, action)}>
                      {action === "list" ? "List" : action[0].toUpperCase() + action.slice(1)}
                    </Button>
                  </th>)}
              </tr>
            </thead>
            <tbody>
              {folderRows.map(row => <tr key={`${row.group}|${row.title}`} className="border-b last:border-0">
                <td className="px-4 py-2"><span className="font-medium">{row.title}</span><span className="ml-2 text-xs text-muted-foreground">{row.group}</span></td>
                {(["list", "view", "insert", "edit", "void", "approval"] as PermissionAction[]).map(action => {
                  const key = permissionKey(row, action)
                  const eligible = row.actions.includes(action)
                  return <td key={action} className="px-2 py-2 text-center">
                    {eligible ? <Checkbox
                      className="border-2 border-black/40"
                      checked={permissions[key] ?? false}
                      disabled={saving !== null}
                      onCheckedChange={value => toggle(row, action, value === true)}
                    /> : <span className="text-muted-foreground">—</span>}
                  </td>
                })}
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    })}
  </div>
})

PermissionEditor.displayName = "PermissionEditor"

export default PermissionEditor
