export const INACTIVITY_TIMEOUT_STORAGE_KEY = "vita-fms:inactivity-timeout-minutes"
export const LAST_ACTIVITY_STORAGE_KEY = "vita-fms:last-user-activity"
export const INACTIVITY_LOGOUT_STORAGE_KEY = "vita-fms:inactivity-logout"
export const INACTIVITY_SETTINGS_EVENT = "vita-fms:inactivity-settings-changed"

export const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 30
export const MIN_INACTIVITY_TIMEOUT_MINUTES = 1
export const MAX_INACTIVITY_TIMEOUT_MINUTES = 24 * 60
export const DEFAULT_INACTIVITY_WARNING_MILLISECONDS = 60_000

export function normalizeInactivityTimeoutMinutes(value: unknown) {
  const minutes = Number(value)

  if (!Number.isFinite(minutes)) return DEFAULT_INACTIVITY_TIMEOUT_MINUTES

  return Math.min(
    MAX_INACTIVITY_TIMEOUT_MINUTES,
    Math.max(MIN_INACTIVITY_TIMEOUT_MINUTES, Math.round(minutes)),
  )
}

export function readInactivityTimeoutMinutes(storage?: Pick<Storage, "getItem">) {
  if (!storage && typeof window === "undefined") return DEFAULT_INACTIVITY_TIMEOUT_MINUTES

  const value = (storage ?? window.localStorage).getItem(INACTIVITY_TIMEOUT_STORAGE_KEY)
  return value === null
    ? DEFAULT_INACTIVITY_TIMEOUT_MINUTES
    : normalizeInactivityTimeoutMinutes(value)
}

export function saveInactivityTimeoutMinutes(minutes: number) {
  const normalizedMinutes = normalizeInactivityTimeoutMinutes(minutes)
  window.localStorage.setItem(INACTIVITY_TIMEOUT_STORAGE_KEY, String(normalizedMinutes))
  window.dispatchEvent(new CustomEvent(INACTIVITY_SETTINGS_EVENT, {
    detail: { minutes: normalizedMinutes },
  }))
  return normalizedMinutes
}

export function readLastUserActivity(storage?: Pick<Storage, "getItem">) {
  if (!storage && typeof window === "undefined") return null

  const value = Number((storage ?? window.localStorage).getItem(LAST_ACTIVITY_STORAGE_KEY))
  return Number.isFinite(value) && value > 0 ? value : null
}

export function recordUserActivity(timestamp = Date.now()) {
  window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(timestamp))
  return timestamp
}

export function getInactivityWarningMilliseconds(timeoutMilliseconds: number) {
  return Math.min(DEFAULT_INACTIVITY_WARNING_MILLISECONDS, Math.floor(timeoutMilliseconds / 2))
}
