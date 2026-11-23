import { createUuid } from "@/lib/utils/createUuid"

export const LOCAL_NOTIFICATION_HISTORY_CHANGED = "vitarich:local-notification-history-changed"

const STORAGE_KEY = "vitarich.local-notification-history.v1"
const MAX_HISTORY_ITEMS = 200

export type LocalNotificationType = "success" | "warning" | "error" | "info" | "loading" | "default"

export type LocalNotificationHistoryItem = {
  id: string
  occurredAt: string
  type: LocalNotificationType
  message: string
  moduleLabel: string
  targetUrl: string
}

function isHistoryItem(value: unknown): value is LocalNotificationHistoryItem {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<LocalNotificationHistoryItem>
  return typeof item.id === "string"
    && typeof item.occurredAt === "string"
    && typeof item.type === "string"
    && typeof item.message === "string"
    && typeof item.moduleLabel === "string"
    && typeof item.targetUrl === "string"
}

export function readLocalNotificationHistory(): LocalNotificationHistoryItem[] {
  if (typeof window === "undefined") return []

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter(isHistoryItem).slice(0, MAX_HISTORY_ITEMS) : []
  } catch {
    return []
  }
}

export function getLocalNotificationHistorySnapshot(): string {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(STORAGE_KEY) ?? ""
}

export function subscribeToLocalNotificationHistory(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined

  window.addEventListener(LOCAL_NOTIFICATION_HISTORY_CHANGED, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(LOCAL_NOTIFICATION_HISTORY_CHANGED, onChange)
    window.removeEventListener("storage", onChange)
  }
}

export function appendLocalNotificationHistory(
  item: Omit<LocalNotificationHistoryItem, "id" | "occurredAt">,
): LocalNotificationHistoryItem | null {
  if (typeof window === "undefined") return null

  const historyItem: LocalNotificationHistoryItem = {
    ...item,
    id: createUuid(),
    occurredAt: new Date().toISOString(),
  }

  try {
    const history = [historyItem, ...readLocalNotificationHistory()].slice(0, MAX_HISTORY_ITEMS)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    window.dispatchEvent(new CustomEvent(LOCAL_NOTIFICATION_HISTORY_CHANGED))
    return historyItem
  } catch {
    return null
  }
}
