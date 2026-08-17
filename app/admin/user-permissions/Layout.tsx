"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import SearchableDropdown from "@/lib/SearchableDropdown"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { ShieldCheck } from "lucide-react"
import PermissionEditor, { type PermissionEditorHandle } from "./PermissionEditor"
import { getManageableUsers, type PermissionFolder, type PermissionUser } from "./api"

function userLabel(user: PermissionUser) {
  const name = [user.firstname, user.lastname].filter(Boolean).join(" ")
  const identity = name || user.email || "Unnamed user"
  const email = name && user.email ? ` — ${user.email}` : ""
  const fmsType = user.fms_type ? ` — ${user.fms_type}` : ""
  return `${identity}${email}${fmsType}`
}

function UserPermissionsPageSkeleton() {
  return <div className="space-y-4" aria-label="Loading user permissions page">
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <Skeleton className="h-6 w-44" />
      <Skeleton className="mt-2 h-4 w-full max-w-lg" />
      <div className="mt-5 space-y-2">
        <Skeleton className="h-4 w-12" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </div>
    <div className="rounded-md border border-dashed bg-card p-8">
      <Skeleton className="mx-auto h-4 w-64 max-w-full" />
    </div>
  </div>
}

export default function Layout({ permissionFolders }: { permissionFolders: PermissionFolder[] }) {
  const [users, setUsers] = useState<PermissionUser[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(true)
  const [actorUserType, setActorUserType] = useState<number | null>(null)
  const editorRef = useRef<PermissionEditorHandle>(null)

  useEffect(() => {
    getManageableUsers()
      .then(result => {
        setUsers(result.users)
        setActorUserType(result.actor.user_type)
        if (result.users.some(user => user.auth_id === result.actor.auth_id)) {
          setSelectedId(result.actor.auth_id)
        }
      })
      .catch(error => toast.error(error instanceof Error ? error.message : "Unable to load users."))
      .finally(() => setLoading(false))
  }, [])

  const selectedUser = useMemo(() => users.find(user => user.auth_id === selectedId), [selectedId, users])

  return <div className="min-h-[calc(100vh-120px)] bg-background px-3 py-4 sm:px-5">
    <div className="mx-auto max-w-6xl space-y-4">
      {loading ? <UserPermissionsPageSkeleton /> : <>
      <div className="rounded-md border bg-card p-4 shadow-sm">
        <h1 className="text-xl font-semibold">User Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Select a user, then allocate access for the user&apos;s FMS type.</p>
        {actorUserType === 1 && <Alert className="mt-4 border-primary/30 bg-primary/5">
          <ShieldCheck />
          <AlertTitle>You are a Super Admin</AlertTitle>
          <AlertDescription>
            Your account bypasses module permissions and has access to all FMS types. Permission assignments here apply to the selected user.
          </AlertDescription>
        </Alert>}
        <div className="mt-4 space-y-1.5">
          <Label required>User</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full max-w-xl">
              <SearchableDropdown
                list={users.map(user => ({ code: user.auth_id, name: userLabel(user) }))}
                codeLabel="code"
                nameLabel="name"
                showNameOnly
                value={selectedId}
                placeholder="Search user..."
                onChange={setSelectedId}
              />
            </div>
            <Button variant="secondary" disabled={!selectedUser} onClick={() => editorRef.current?.setAll(true)}>
              Allow All
            </Button>
            <Button variant="destructive" disabled={!selectedUser} onClick={() => editorRef.current?.setAll(false)}>
              Remove All
            </Button>
          </div>
        </div>
      </div>
      {selectedUser
        ? <PermissionEditor ref={editorRef} key={selectedUser.auth_id} user={selectedUser} permissionFolders={permissionFolders} />
        : <div className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Select a user to manage permissions.</div>}
      </>}
    </div>
  </div>
}
