import { admin_db } from "@/lib/Supabase/supabaseAdmin"
import { FMS_TYPES, USER_TYPES } from "@/lib/notifications/types"
import type {
  FmsType,
  NotificationFarmRouting,
  NotificationInboxItem,
  NotificationEmailDelivery,
  NotificationOutboxHealth,
  NotificationRule,
  NotificationRuleAffectedUsers,
  NotificationRuleAccess,
  NotificationRuleInput,
  NotificationUserGroup,
} from "@/lib/notifications/types"

export async function hasNotificationSetupPermission(authId: string, action: "view" | "edit") {
  const { data, error } = await admin_db
    .from("user_permissions")
    .select("is_visible")
    .eq("user_id", authId)
    .eq("group_name", "Modules")
    .eq("title", `Notification Setup/${action}`)
    .eq("is_visible", true)
    .maybeSingle()

  if (error) throw error
  return Boolean(data?.is_visible)
}

export async function getNotificationActorByToken(token: string) {
  const { data: authData, error: authError } = await admin_db.auth.getUser(token)
  if (authError || !authData.user?.id) return null

  const { data, error } = await admin_db
    .from("users")
    .select("id, auth_id, fms_type, user_type, isactive")
    .eq("auth_id", authData.user.id)
    .maybeSingle()

  if (error || !data || String(data.isactive ?? "").trim() !== "1") return null

  return {
    id: Number(data.id),
    authId: String(data.auth_id),
    fmsType: data.fms_type ? String(data.fms_type) : null,
    userType: Number(data.user_type ?? 3),
  }
}

export async function getNotificationRules(access: NotificationRuleAccess) {
  let query = admin_db
    .from("notification_rules")
    .select("id, name, module_key, event_key, source_fms_types, recipient_fms_types, user_types, user_group_ids, title_template, message_template, priority, email_enabled, exclude_actor, require_view_permission, is_active, created_at, updated_at")
    .eq("void", "1")
    .order("created_at", { ascending: false })

  if (access.userType === 2 && access.fmsType) {
    query = query.contains("source_fms_types", [access.fmsType])
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as NotificationRule[]
}

export async function getNotificationRuleById(id: number) {
  const { data, error } = await admin_db
    .from("notification_rules")
    .select("id, name, module_key, event_key, source_fms_types, recipient_fms_types, user_types, user_group_ids, title_template, message_template, priority, email_enabled, exclude_actor, require_view_permission, is_active, created_at, updated_at")
    .eq("id", id)
    .eq("void", "1")
    .maybeSingle()

  if (error) throw error
  return data as NotificationRule | null
}

export async function getActiveNotificationUserGroups() {
  const { data, error } = await admin_db
    .from("users_group")
    .select("id, code, group_name")
    .eq("void", "1")
    .order("group_name", { ascending: true })

  if (error) throw error
  return (data ?? []).map(group => ({
    id: Number(group.id),
    code: String(group.code),
    group_name: String(group.group_name),
  })) as NotificationUserGroup[]
}

export async function getNotificationRuleAffectedUsers(
  rule: NotificationRule,
  options: {
    permissionGroup: string
    permissionTitle: string
    farmRouting: NotificationFarmRouting
  },
) {
  const { data: userRows, error: usersError } = await admin_db
    .from("users")
    .select("id, auth_id, email, firstname, middlename, lastname, fms_type, user_type, users_group_id")
    .not("auth_id", "is", null)
    .eq("isactive", "1")
    .order("firstname", { ascending: true })
    .limit(1000)

  if (usersError) throw usersError

  let candidates = (userRows ?? []).filter(user => {
    const userType = Number(user.user_type ?? USER_TYPES.USER)
    const isSuperAdmin = userType === USER_TYPES.SUPER_ADMIN
    const matchesFms = isSuperAdmin
      || rule.recipient_fms_types.length === 0
      || rule.recipient_fms_types.includes(user.fms_type as FmsType)
    const matchesUserType = rule.user_types.length === 0 || rule.user_types.includes(userType)
    const groupId = user.users_group_id == null ? null : Number(user.users_group_id)
    const matchesGroup = rule.user_group_ids.length === 0
      || (groupId != null && rule.user_group_ids.includes(groupId))
    return matchesFms && matchesUserType && matchesGroup
  })

  if (candidates.length === 0) {
    return {
      users: [],
      farmRouting: options.farmRouting,
      farmDependent: options.farmRouting !== "none",
      excludeInitiator: rule.exclude_actor,
    } satisfies NotificationRuleAffectedUsers
  }

  if (rule.require_view_permission) {
    const nonSuperAuthIds = candidates
      .filter(user => Number(user.user_type ?? USER_TYPES.USER) !== USER_TYPES.SUPER_ADMIN)
      .map(user => String(user.auth_id))
    const permittedAuthIds = new Set<string>()

    if (nonSuperAuthIds.length > 0) {
      const { data: permissions, error: permissionsError } = await admin_db
        .from("user_permissions")
        .select("user_id")
        .in("user_id", nonSuperAuthIds)
        .eq("group_name", options.permissionGroup)
        .eq("title", options.permissionTitle)
        .eq("is_visible", true)

      if (permissionsError) throw permissionsError
      for (const permission of permissions ?? []) permittedAuthIds.add(String(permission.user_id))
    }

    candidates = candidates.filter(user =>
      Number(user.user_type ?? USER_TYPES.USER) === USER_TYPES.SUPER_ADMIN
      || permittedAuthIds.has(String(user.auth_id)),
    )
  }

  const farmDependent = options.farmRouting !== "none"
  const farmsByUserId = new Map<number, Array<{ id: number | null; code: string; name: string | null }>>()

  if (farmDependent && candidates.length > 0) {
    const candidateIds = candidates.map(user => Number(user.id))
    const { data: assignments, error: assignmentsError } = await admin_db
      .from("users_farms")
      .select("users_id, farm_id, farm_code")
      .in("users_id", candidateIds)
      .eq("void", "1")

    if (assignmentsError) throw assignmentsError

    const farmIds = Array.from(new Set((assignments ?? [])
      .map(row => row.farm_id == null ? null : Number(row.farm_id))
      .filter((id): id is number => id != null && Number.isFinite(id))))
    const farmCodes = Array.from(new Set((assignments ?? [])
      .map(row => String(row.farm_code ?? "").trim())
      .filter(Boolean)))
    const farmRows: Array<{ id: number; code: string; name: string | null }> = []

    if (farmIds.length > 0) {
      const { data, error } = await admin_db.from("farms").select("id, code, name").in("id", farmIds)
      if (error) throw error
      farmRows.push(...(data ?? []).map(farm => ({ id: Number(farm.id), code: String(farm.code), name: farm.name ? String(farm.name) : null })))
    }
    if (farmCodes.length > 0) {
      const { data, error } = await admin_db.from("farms").select("id, code, name").in("code", farmCodes)
      if (error) throw error
      farmRows.push(...(data ?? []).map(farm => ({ id: Number(farm.id), code: String(farm.code), name: farm.name ? String(farm.name) : null })))
    }

    const farmsById = new Map(farmRows.map(farm => [farm.id, farm]))
    const farmsByCode = new Map(farmRows.map(farm => [farm.code, farm]))
    for (const assignment of assignments ?? []) {
      const userId = Number(assignment.users_id)
      const assignedFarmId = assignment.farm_id == null ? null : Number(assignment.farm_id)
      const assignedFarmCode = String(assignment.farm_code ?? "").trim()
      const farm = (assignedFarmId == null ? undefined : farmsById.get(assignedFarmId))
        ?? farmsByCode.get(assignedFarmCode)
      const current = farmsByUserId.get(userId) ?? []
      const normalized = {
        id: farm?.id ?? assignedFarmId,
        code: farm?.code ?? assignedFarmCode,
        name: farm?.name ?? null,
      }
      if ((normalized.id != null || normalized.code) && !current.some(item => item.id === normalized.id && item.code === normalized.code)) {
        current.push(normalized)
      }
      farmsByUserId.set(userId, current)
    }
  }

  if (farmDependent) {
    candidates = candidates.filter(user =>
      Number(user.user_type ?? USER_TYPES.USER) === USER_TYPES.SUPER_ADMIN
      || (farmsByUserId.get(Number(user.id))?.length ?? 0) > 0,
    )
  }

  const groups = await getActiveNotificationUserGroups()
  const groupNames = new Map(groups.map(group => [group.id, group.group_name]))
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  return {
    users: candidates.map(user => {
      const id = Number(user.id)
      const userType = Number(user.user_type ?? USER_TYPES.USER)
      const email = String(user.email ?? "").trim() || null
      const groupId = user.users_group_id == null ? null : Number(user.users_group_id)
      const name = [user.firstname, user.middlename, user.lastname]
        .map(value => String(value ?? "").trim())
        .filter(Boolean)
        .join(" ") || email || `User #${id}`
      return {
        id,
        name,
        email,
        fmsType: FMS_TYPES.includes(user.fms_type as FmsType) ? user.fms_type as FmsType : null,
        userType,
        userGroupName: groupId == null ? null : groupNames.get(groupId) ?? `Group #${groupId}`,
        farms: farmsByUserId.get(id) ?? [],
        farmBypass: farmDependent && userType === USER_TYPES.SUPER_ADMIN,
        emailEligible: Boolean(email && emailPattern.test(email)),
      }
    }),
    farmRouting: options.farmRouting,
    farmDependent,
    excludeInitiator: rule.exclude_actor,
  } satisfies NotificationRuleAffectedUsers
}

export async function getNotificationOutboxHealth() {
  const [pendingResult, failedResult, emailPendingResult, emailFailedResult, failuresResult, emailFailuresResult] = await Promise.all([
    admin_db
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin_db
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    admin_db
      .from("notification_email_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin_db
      .from("notification_email_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    admin_db
      .from("notification_outbox")
      .select("id, event_key, document_no, status, attempt_count, last_error, next_attempt_at, occurred_at")
      .eq("status", "failed")
      .order("occurred_at", { ascending: false })
      .limit(10),
    admin_db
      .from("notification_email_deliveries")
      .select("id, event_key, document_no, recipient_email, status, attempt_count, last_error, next_attempt_at, occurred_at")
      .eq("status", "failed")
      .order("occurred_at", { ascending: false })
      .limit(10),
  ])

  if (pendingResult.error) throw pendingResult.error
  if (failedResult.error) throw failedResult.error
  if (emailPendingResult.error) throw emailPendingResult.error
  if (emailFailedResult.error) throw emailFailedResult.error
  if (failuresResult.error) throw failuresResult.error
  if (emailFailuresResult.error) throw emailFailuresResult.error

  return {
    pendingCount: pendingResult.count ?? 0,
    failedCount: failedResult.count ?? 0,
    emailPendingCount: emailPendingResult.count ?? 0,
    emailFailedCount: emailFailedResult.count ?? 0,
    recentFailures: failuresResult.data ?? [],
    recentEmailFailures: emailFailuresResult.data ?? [],
  } as NotificationOutboxHealth
}

export async function saveNotificationRule(input: NotificationRuleInput, actorAuthId: string) {
  const payload = {
    name: input.name,
    module_key: input.module_key,
    event_key: input.event_key,
    source_fms_types: input.source_fms_types,
    recipient_fms_types: input.recipient_fms_types,
    user_types: input.user_types,
    user_group_ids: input.user_group_ids,
    title_template: input.title_template,
    message_template: input.message_template,
    priority: input.priority,
    email_enabled: input.email_enabled,
    exclude_actor: input.exclude_actor,
    require_view_permission: input.require_view_permission,
    is_active: input.is_active,
    updated_by: actorAuthId,
  }

  const query = input.id
    ? admin_db.from("notification_rules").update(payload).eq("id", input.id)
    : admin_db.from("notification_rules").insert({
        ...payload,
        created_by: actorAuthId,
      })

  const { data, error } = await query
    .select("id, name, module_key, event_key, source_fms_types, recipient_fms_types, user_types, user_group_ids, title_template, message_template, priority, email_enabled, exclude_actor, require_view_permission, is_active, created_at, updated_at")
    .single()

  if (error) throw error
  return data as NotificationRule
}

export async function voidNotificationRule(id: number, actorAuthId: string) {
  const { error } = await admin_db
    .from("notification_rules")
    .update({ void: "0", is_active: false, updated_by: actorAuthId })
    .eq("id", id)
    .eq("void", "1")

  if (error) throw error
}

export async function getUserNotifications(authId: string, limit = 50) {
  const safeLimit = Math.max(1, Math.min(limit, 100))
  const { data, error } = await admin_db
    .from("user_notifications")
    .select("id, event_id, module_key, event_key, title, message, priority, target_url, occurred_at, delivered_at, seen_at, read_at")
    .eq("recipient_auth_id", authId)
    .is("archived_at", null)
    .order("occurred_at", { ascending: false })
    .limit(safeLimit)

  if (error) throw error

  const notifications = (data ?? []) as NotificationInboxItem[]
  const { count, error: countError } = await admin_db
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_auth_id", authId)
    .is("archived_at", null)
    .is("read_at", null)

  if (countError) throw countError
  return { notifications, unreadCount: count ?? 0 }
}

export async function markUserNotificationRead(authId: string, id?: number) {
  let query = admin_db
    .from("user_notifications")
    .update({ read_at: new Date().toISOString(), seen_at: new Date().toISOString() })
    .eq("recipient_auth_id", authId)
    .is("read_at", null)

  if (id) query = query.eq("id", id)

  const { error } = await query
  if (error) throw error
}

export async function markUserNotificationsSeen(authId: string) {
  const { error } = await admin_db
    .from("user_notifications")
    .update({ seen_at: new Date().toISOString() })
    .eq("recipient_auth_id", authId)
    .is("seen_at", null)

  if (error) throw error
}

export async function processPendingNotificationEvents(limit = 50) {
  const { data, error } = await admin_db.rpc("process_notification_outbox", {
    p_limit: Math.max(1, Math.min(limit, 200)),
  })

  if (error) throw error
  return Number(data ?? 0)
}

export async function makeFailedNotificationEmailsRetryable() {
  const { data, error } = await admin_db
    .from("notification_email_deliveries")
    .update({ next_attempt_at: new Date().toISOString() })
    .eq("status", "failed")
    .select("id")

  if (error) throw error
  return data?.length ?? 0
}

export async function claimPendingNotificationEmails(limit = 20) {
  const { data, error } = await admin_db.rpc("claim_notification_email_deliveries", {
    p_limit: Math.max(1, Math.min(limit, 100)),
  })

  if (error) throw error
  return (data ?? []) as NotificationEmailDelivery[]
}

export async function completeNotificationEmailDelivery(params: {
  id: number
  success: boolean
  error?: string | null
  providerMessageId?: string | null
}) {
  const { error } = await admin_db.rpc("complete_notification_email_delivery", {
    p_id: params.id,
    p_success: params.success,
    p_error: params.error ?? null,
    p_provider_message_id: params.providerMessageId ?? null,
  })

  if (error) throw error
}

export async function skipNotificationEmailDelivery(id: number, reason: string) {
  const { error } = await admin_db
    .from("notification_email_deliveries")
    .update({
      status: "skipped",
      last_error: reason.slice(0, 2000),
      processing_started_at: null,
    })
    .eq("id", id)
    .eq("status", "processing")

  if (error) throw error
}
