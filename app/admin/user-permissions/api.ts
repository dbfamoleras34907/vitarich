import { db } from "@/lib/Supabase/supabaseClient"

async function authHeaders() {
  const { data } = await db.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Authentication required.")
  return { Authorization: `Bearer ${token}` }
}

async function parseResponse<T>(response: Response) {
  const result = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(result.error || "Request failed.")
  return result
}

export type PermissionUser = {
  id: number
  auth_id: string
  email: string | null
  firstname: string | null
  lastname: string | null
  fms_type: string | null
  user_type: number
}

export async function getManageableUsers() {
  const response = await fetch("/api/admin/user-permissions", { headers: await authHeaders() })
  return parseResponse<{
    actor: { user_type: number; fms_type: string | null }
    users: PermissionUser[]
  }>(response)
}

export async function getManagedUserPermissions(userId: string) {
  const response = await fetch(`/api/admin/user-permissions?userId=${encodeURIComponent(userId)}`, {
    headers: await authHeaders(),
  })
  return parseResponse<{
    target: PermissionUser
    permissions: Array<{ group_name: string; title: string; is_visible: boolean }>
  }>(response)
}

export async function setManagedUserPermission(payload: {
  userId: string
  groupName: string
  title: string
  checked: boolean
}) {
  const response = await fetch("/api/admin/user-permissions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...await authHeaders() },
    body: JSON.stringify(payload),
  })
  return parseResponse<{ success: boolean }>(response)
}
