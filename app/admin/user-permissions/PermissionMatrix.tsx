"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getPermissionMatrix, type PermissionAction, type PermissionFolder, type PermissionMatrixUser } from "./api"

const matrixActions: PermissionAction[] = ["list", "view", "edit", "void", "approval"]

function permissionKey(groupName: string, title: string) {
  return `${groupName}|${title}`
}

function userLabel(user: PermissionMatrixUser) {
  const name = [user.firstname, user.middlename, user.lastname].filter(Boolean).join(" ")
  return name || user.email || "Unnamed user"
}

function isActive(user: PermissionMatrixUser) {
  const value = String(user.isactive ?? "").trim().toLowerCase()
  return value === "1" || value === "true" || value === "active"
}

function permissionTitle(title: string, action: PermissionAction) {
  return action === "list" ? title : `${title}/${action}`
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function PermissionMatrix({ permissionFolders }: { permissionFolders: PermissionFolder[] }) {
  const [users, setUsers] = useState<PermissionMatrixUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true
    getPermissionMatrix()
      .then(result => active && setUsers(result.users))
      .catch(error => {
        if (!active) return
        setLoadError(true)
        toast.error(error instanceof Error ? error.message : "Unable to load permission matrix.")
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const rows = useMemo(() => permissionFolders.flatMap(folder => folder.rows.map((row, index) => ({
    row,
    key: `${folder.id}|${row.group}|${row.title}|${index}`,
  }))), [permissionFolders])

  function isAllowed(user: PermissionMatrixUser, row: PermissionFolder["rows"][number], action: PermissionAction) {
    if (!row.actions.includes(action)) return false
    const permissions = new Set(user.permissions.map(item => permissionKey(item.group_name, item.title)))
    return user.user_type === 1 || permissions.has(permissionKey(row.group, permissionTitle(row.title, action)))
  }

  function exportMatrix(format: "tsv" | "json") {
    const exportRows = users.flatMap(user => rows.map(({ row }) => ({
      user: userLabel(user),
      username: user.email ?? "",
      email: user.email ?? "",
      accountOwner: userLabel(user),
      fmsType: user.fms_type ?? "",
      userType: user.user_type === 1 ? "Super Admin" : user.user_type === 2 ? "Admin" : "User",
      accountCreationDate: user.created_at ?? "",
      deactivationDate: isActive(user) ? null : user.updated_at ?? null,
      lastModificationDate: user.updated_at ?? "",
      accountStatus: isActive(user) ? "Active" : "Inactive",
      group: row.group,
      module: row.title,
      list: isAllowed(user, row, "list"),
      view: isAllowed(user, row, "view"),
      edit: isAllowed(user, row, "edit"),
      void: isAllowed(user, row, "void"),
      approve: isAllowed(user, row, "approval"),
    })))
    const date = new Date().toISOString().slice(0, 10)

    if (format === "json") {
      const groupedRows = users.map(user => ({
        user: userLabel(user),
        username: user.email ?? "",
        email: user.email ?? "",
        accountOwner: userLabel(user),
        fmsType: user.fms_type ?? "",
        userType: user.user_type === 1 ? "Super Admin" : user.user_type === 2 ? "Admin" : "User",
        accountCreationDate: user.created_at ?? null,
        deactivationDate: isActive(user) ? null : user.updated_at ?? null,
        lastModificationDate: user.updated_at ?? null,
        accountStatus: isActive(user) ? "Active" : "Inactive",
        modules: rows.map(({ row }) => ({
          group: row.group,
          module: row.title,
          list: isAllowed(user, row, "list"),
          view: isAllowed(user, row, "view"),
          edit: isAllowed(user, row, "edit"),
          void: isAllowed(user, row, "void"),
          approve: isAllowed(user, row, "approval"),
        })),
      }))
      downloadText(`user-permission-matrix-${date}.json`, JSON.stringify(groupedRows, null, 2), "application/json")
      return
    }

    const headers = ["User", "Username", "Email", "Account Owner", "FMS Type", "User Access Role", "Account Creation Date", "Deactivation Date", "Last Modification Date", "Account Status", "Group", "Module", "List", "View", "Edit", "Void", "Approve"]
    const clean = (value: unknown) => String(value).replace(/[\t\r\n]/g, " ")
    const content = [headers, ...exportRows.map(row => [
      row.user, row.username, row.email, row.accountOwner, row.fmsType, row.userType,
      row.accountCreationDate, row.deactivationDate, row.lastModificationDate, row.accountStatus,
      row.group, row.module,
      row.list, row.view, row.edit, row.void, row.approve,
    ])].map(row => row.map(clean).join("\t")).join("\r\n")
    downloadText(`user-permission-matrix-${date}.txt`, content, "text/plain")
  }

  if (loading) return <div className="space-y-2" aria-label="Loading permission matrix">
    {[1, 2].map(index => <div key={index} className="rounded-md border bg-card p-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-2 h-6 w-full" />
      <Skeleton className="mt-1 h-6 w-full" />
    </div>)}
  </div>

  if (loadError) return <p role="alert" className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Unable to load the permission matrix. Reopen this tab to retry.</p>
  if (!users.length) return <div className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No manageable users found.</div>

  return <div className="space-y-2">
    <div className="flex flex-col gap-2 rounded-md border bg-card px-2 py-1.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>A check means the user is allowed to perform the action. A dash means the action is not available for that module.</span>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" className="h-7 px-2 text-xs" variant="outline" onClick={() => exportMatrix("tsv")}>Export Text-Tab</Button>
        <Button size="sm" className="h-7 px-2 text-xs" variant="outline" onClick={() => exportMatrix("json")}>Export JSON</Button>
      </div>
    </div>
    {users.map(user => {
      return <section key={user.auth_id} className="overflow-hidden rounded-md border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-1 border-b bg-muted/20 px-2 py-1.5">
          <div>
            <h2 className="text-xs font-semibold leading-tight">{userLabel(user)}</h2>
            {user.email && userLabel(user) !== user.email && <p className="text-[10px] leading-tight text-muted-foreground">{user.email}</p>}
          </div>
          <div className="flex items-center gap-1">
            {user.fms_type && <Badge className="h-5 px-1.5 text-[10px]" variant="outline">{user.fms_type}</Badge>}
            <Badge className="h-5 px-1.5 text-[10px]" variant="secondary">{user.user_type === 1 ? "Super Admin" : user.user_type === 2 ? "Admin" : "User"}</Badge>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] table-fixed text-xs leading-tight">
            <thead className="sticky top-0 z-10 border-b bg-muted">
              <tr>
                <th className="w-[55%] px-2 py-1 text-left font-medium">Module</th>
                {matrixActions.map(action => <th key={action} className="w-[9%] px-1 py-1 text-center font-medium">{action === "approval" ? "Approve" : action[0].toUpperCase() + action.slice(1)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ row, key }) => <tr key={key} className="border-b last:border-0 odd:bg-muted/5 hover:bg-muted/20">
                <td className="truncate px-2 py-1"><span className="font-medium">{row.title}</span><span className="ml-1.5 text-[10px] text-muted-foreground">{row.group}</span></td>
                {matrixActions.map(action => {
                  const eligible = row.actions.includes(action)
                  const allowed = isAllowed(user, row, action)
                  return <td key={action} className="px-1 py-1 text-center font-semibold" aria-label={`${row.title} ${action}: ${eligible ? allowed ? "allowed" : "not allowed" : "not applicable"}`}>
                    {eligible ? allowed ? <span className="text-green-600 dark:text-green-400">✓</span> : <span className="text-muted-foreground">—</span> : <span className="text-muted-foreground/50">—</span>}
                  </td>
                })}
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    })}
  </div>
}
