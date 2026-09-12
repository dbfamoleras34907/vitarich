import { fetchWithInternetErrorNotice, readJsonResponse } from '@/lib/network/http'
import { db } from "@/lib/Supabase/supabaseClient"
import type {
  NotificationInboxItem,
  NotificationOutboxHealth,
  NotificationRule,
  NotificationRuleAffectedUsers,
  NotificationRuleAccess,
  NotificationRuleInput,
  NotificationUserGroup,
} from "@/lib/notifications/types"

async function authHeaders() {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error("Authentication required.")
  return { Authorization: `Bearer ${token}` }
}

async function request<T>(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const authorization = await authHeaders()
  headers.set("Authorization", authorization.Authorization)
  if (init?.body) headers.set("Content-Type", "application/json")

  const response = await fetchWithInternetErrorNotice(url, { ...init, headers })
  const result = await readJsonResponse<T & { error?: string }>(response)
  if (!response.ok) throw new Error(result.error || "Notification request failed.")
  return result
}

export async function getNotificationRuleSetup() {
  return request<{
    actor: NotificationRuleAccess
    rules: NotificationRule[]
    userGroups: NotificationUserGroup[]
    outboxHealth: NotificationOutboxHealth
  }>("/api/admin/notifications")
}

export async function getNotificationRuleAffectedUsersRequest(ruleId: number) {
  return request<NotificationRuleAffectedUsers>(
    `/api/admin/notifications?ruleId=${encodeURIComponent(ruleId)}`,
  )
}

export async function saveNotificationRuleRequest(input: NotificationRuleInput) {
  return request<{ rule: NotificationRule }>("/api/admin/notifications", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function voidNotificationRuleRequest(id: number) {
  return request<{ success: boolean }>("/api/admin/notifications", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  })
}

export async function getNotificationInbox(limit = 50) {
  return request<{ notifications: NotificationInboxItem[]; unreadCount: number }>(
    `/api/notifications?limit=${encodeURIComponent(limit)}`,
  )
}

export async function markNotificationReadRequest(id: number) {
  return request<{ success: boolean }>("/api/notifications", {
    method: "PATCH",
    body: JSON.stringify({ id }),
  })
}

export async function markAllNotificationsReadRequest() {
  return request<{ success: boolean }>("/api/notifications", {
    method: "PATCH",
    body: JSON.stringify({ all: true }),
  })
}

export async function markNotificationsSeenRequest() {
  return request<{ success: boolean }>("/api/notifications", {
    method: "PATCH",
    body: JSON.stringify({ seen: true }),
  })
}

export async function processPendingNotificationsRequest(options?: { retryFailedEmails?: boolean }) {
  return request<{
    processed: number
    emails: { claimed: number; sent: number; failed: number; skipped: number; requeued: number }
    accountEmails: { claimed: number; sent: number; failed: number }
  }>("/api/notifications/process", {
    method: "POST",
    ...(options?.retryFailedEmails ? { body: JSON.stringify({ retryFailedEmails: true }) } : {}),
  })
}
