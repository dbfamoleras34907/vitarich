import { admin_db } from "@/lib/Supabase/supabaseAdmin"

export type StoredPermissionTemplateItem = {
  group_name: string
  title: string
  is_visible: boolean
  ilink: string
  type: string
}

export async function listPermissionTemplatesWithAssignments() {
  const [templatesResult, itemsResult, assignmentsResult] = await Promise.all([
    admin_db
      .from("permission_templates")
      .select("id, template_name, remarks, void, created_at")
      .order("template_name", { ascending: true }),
    admin_db
      .from("permission_template_items")
      .select("template_id, group_name, title, is_visible, ilink, type"),
    admin_db
      .from("user_permission_template_assignments")
      .select("user_id, template_id, assigned_by, assigned_at, reapplied_at"),
  ])

  if (templatesResult.error) throw templatesResult.error
  if (itemsResult.error) throw itemsResult.error
  if (assignmentsResult.error) throw assignmentsResult.error

  const itemsByTemplate = new Map<number, StoredPermissionTemplateItem[]>()
  for (const item of itemsResult.data ?? []) {
    const templateId = Number(item.template_id)
    const current = itemsByTemplate.get(templateId) ?? []
    current.push({
      group_name: item.group_name,
      title: item.title,
      is_visible: Boolean(item.is_visible),
      ilink: item.ilink ?? "",
      type: item.type ?? "list",
    })
    itemsByTemplate.set(templateId, current)
  }

  return {
    templates: (templatesResult.data ?? []).map(template => ({
      ...template,
      id: Number(template.id),
      void: Number(template.void ?? 0),
      permissions: itemsByTemplate.get(Number(template.id)) ?? [],
    })),
    assignments: (assignmentsResult.data ?? []).map(assignment => ({
      ...assignment,
      template_id: Number(assignment.template_id),
    })),
  }
}

export async function savePermissionTemplate(input: {
  templateId?: number | null
  templateName: string
  remarks: string
  permissions: StoredPermissionTemplateItem[]
  actorAuthId: string
}) {
  const { data, error } = await admin_db.rpc("save_permission_template_v2", {
    p_template_id: input.templateId ?? null,
    p_template_name: input.templateName,
    p_remarks: input.remarks,
    p_permissions: input.permissions,
    p_actor_auth_id: input.actorAuthId,
  })
  if (error) throw error
  return Number(data)
}

export async function setPermissionTemplateVoided(templateId: number, voided: boolean) {
  const { data, error } = await admin_db
    .from("permission_templates")
    .update({ void: voided ? 1 : 0 })
    .eq("id", templateId)
    .select("id")
    .single()
  if (error) throw error
  return data
}

export async function previewPermissionTemplate(templateId: number, userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)]
  const [templateResult, usersResult, permissionsResult] = await Promise.all([
    admin_db
      .from("permission_template_items")
      .select("group_name, title")
      .eq("template_id", templateId)
      .eq("is_visible", true),
    admin_db
      .from("users")
      .select("auth_id, firstname, lastname, email, isactive")
      .in("auth_id", uniqueUserIds),
    admin_db
      .from("user_permissions")
      .select("user_id, group_name, title")
      .in("user_id", uniqueUserIds)
      .eq("is_visible", true),
  ])
  if (templateResult.error) throw templateResult.error
  if (usersResult.error) throw usersResult.error
  if (permissionsResult.error) throw permissionsResult.error

  const templateKeys = new Set((templateResult.data ?? []).map(item => `${item.group_name}\u0000${item.title}`))
  const currentByUser = new Map<string, Set<string>>()
  for (const permission of permissionsResult.data ?? []) {
    const current = currentByUser.get(permission.user_id) ?? new Set<string>()
    current.add(`${permission.group_name}\u0000${permission.title}`)
    currentByUser.set(permission.user_id, current)
  }

  const users = (usersResult.data ?? []).filter(user =>
    ["1", "true", "active", "yes"].includes(String(user.isactive ?? "").trim().toLowerCase()),
  ).map(user => {
    const current = currentByUser.get(user.auth_id) ?? new Set<string>()
    const addedPermissions = [...templateKeys].filter(key => !current.has(key)).map(key => key.replace("\u0000", " — ")).sort()
    const removedPermissions = [...current].filter(key => !templateKeys.has(key)).map(key => key.replace("\u0000", " — ")).sort()
    return {
      userId: user.auth_id,
      name: [user.firstname, user.lastname].filter(Boolean).join(" ") || user.email || "Unnamed user",
      added: addedPermissions.length,
      removed: removedPermissions.length,
      unchanged: templateKeys.size - addedPermissions.length,
      addedPermissions,
      removedPermissions,
    }
  })

  return {
    users,
    permissionCount: templateKeys.size,
    added: users.reduce((sum, user) => sum + user.added, 0),
    removed: users.reduce((sum, user) => sum + user.removed, 0),
    unchanged: users.reduce((sum, user) => sum + user.unchanged, 0),
  }
}

export async function applyPermissionTemplate(input: {
  templateId: number
  userIds: string[]
  actorAuthId: string
}) {
  const { data, error } = await admin_db.rpc("apply_permission_template_v2", {
    p_template_id: input.templateId,
    p_user_ids: [...new Set(input.userIds)],
    p_actor_auth_id: input.actorAuthId,
  })
  if (error) throw error
  return data
}
