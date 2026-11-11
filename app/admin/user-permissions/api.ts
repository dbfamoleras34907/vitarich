import { fetchWithInternetErrorNotice, readJsonResponse } from '@/lib/network/http'
import { db } from "@/lib/Supabase/supabaseClient"

async function authHeaders() {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error("Authentication required.")
  return { Authorization: `Bearer ${token}` }
}

async function parseResponse<T>(response: Response) {
  const result = await readJsonResponse<T & { error?: string }>(response)
  if (!response.ok) throw new Error(result.error || "Request failed.")
  return result
}

export type PermissionUser = {
  id: number
  auth_id: string
  email: string | null
  firstname: string | null
  middlename: string | null
  lastname: string | null
  created_at: string | null
  updated_at: string | null
  isactive: string | boolean | null
  fms_type: string | null
  fms_types: string[] | null
  user_type: number
}

export type PermissionAction = "list" | "view" | "insert" | "edit" | "void" | "approval"

export type PermissionRow = {
  group: string
  title: string
  actions: PermissionAction[]
}

export type PermissionFolder = {
  id: number
  title: string
  fmsTypes?: string[]
  rows: PermissionRow[]
}

export type PermissionMatrixUser = PermissionUser & {
  permissions: Array<{ group_name: string; title: string }>
}

export type PermissionTemplate = {
  id: number
  template_name: string
  remarks: string | null
  void: number
  created_at: string
  permissions: Array<{
    group_name: string
    title: string
    is_visible: boolean
    ilink: string
    type: string
  }>
}

export type PermissionTemplateAssignment = {
  user_id: string
  template_id: number
  assigned_by: string
  assigned_at: string
  reapplied_at: string
}

export async function getManageableUsers() {
  const response = await fetchWithInternetErrorNotice("/api/admin/user-permissions", { headers: await authHeaders() })
  return parseResponse<{
    actor: { auth_id: string; user_type: number; fms_type: string | null; fms_types: string[] | null }
    users: PermissionUser[]
  }>(response)
}

export async function getPermissionMatrix() {
  const response = await fetchWithInternetErrorNotice("/api/admin/user-permissions?view=matrix", { headers: await authHeaders() })
  return parseResponse<{
    users: PermissionMatrixUser[]
  }>(response)
}

export async function getManagedUserPermissions(userId: string) {
  const response = await fetchWithInternetErrorNotice(`/api/admin/user-permissions?userId=${encodeURIComponent(userId)}`, {
    headers: await authHeaders(),
  })
  return parseResponse<{
    target: PermissionUser
    permissions: Array<{ group_name: string; title: string; is_visible: boolean }>
  }>(response)
}

export type ManagedPermissionChange = {
  groupName: string
  title: string
  checked: boolean
}

export async function setManagedUserPermissions(payload: {
  userId: string
  changes: ManagedPermissionChange[]
}) {
  const response = await fetchWithInternetErrorNotice("/api/admin/user-permissions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...await authHeaders() },
    body: JSON.stringify(payload),
  })
  return parseResponse<{ success: boolean }>(response)
}

async function permissionTemplateRequest<T>(payload?: Record<string, unknown>) {
  const response = await fetchWithInternetErrorNotice("/api/admin/permission-templates", {
    method: payload ? "POST" : "GET",
    headers: { ...(payload ? { "Content-Type": "application/json" } : {}), ...await authHeaders() },
    body: payload ? JSON.stringify(payload) : undefined,
  })
  return parseResponse<T>(response)
}

export function getPermissionTemplates() {
  return permissionTemplateRequest<{
    templates: PermissionTemplate[]
    assignments: PermissionTemplateAssignment[]
  }>()
}

export function savePermissionTemplate(payload: {
  templateId?: number
  templateName: string
  remarks: string
  permissions: Array<{ groupName: string; title: string }>
}) {
  return permissionTemplateRequest<{ success: boolean; templateId: number }>({ action: "save", ...payload })
}

export function setPermissionTemplateVoided(templateId: number, voided: boolean) {
  return permissionTemplateRequest<{ success: boolean }>({ action: "void", templateId, voided })
}

export type PermissionTemplatePreview = {
  users: Array<{
    userId: string
    name: string
    added: number
    removed: number
    unchanged: number
    addedPermissions: string[]
    removedPermissions: string[]
  }>
  permissionCount: number
  added: number
  removed: number
  unchanged: number
}

export function previewPermissionTemplate(templateId: number, userIds: string[]) {
  return permissionTemplateRequest<PermissionTemplatePreview>({ action: "preview", templateId, userIds })
}

export function applyPermissionTemplate(templateId: number, userIds: string[]) {
  return permissionTemplateRequest<{
    success: boolean
    result: { affectedUsers: number; affectedUserIds: string[]; permissionCount: number }
  }>({ action: "apply", templateId, userIds })
}
