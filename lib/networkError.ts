export const INTERNET_ERROR_MESSAGE = 'Internet connection error. Please check your connection and try again.'
export const INTERNET_ERROR_EVENT = 'vita:internet-error'

let lastInternetErrorNoticeAt = 0
const INTERNET_ERROR_NOTICE_GAP_MS = 3000

export function isInternetError(error: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true

  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null
      ? JSON.stringify(error)
      : String(error ?? '')

  if (message === INTERNET_ERROR_MESSAGE) return true

  return [
    'failed to fetch',
    'fetch failed',
    'networkerror',
    'network request failed',
    'load failed',
    'err_internet_disconnected',
    'err_network_changed',
    'err_connection',
  ].some(pattern => message.toLowerCase().includes(pattern))
}

export function getInternetErrorMessage(error: unknown, fallbackMessage: string) {
  return isInternetError(error) ? INTERNET_ERROR_MESSAGE : fallbackMessage
}

export function notifyInternetError(error?: unknown) {
  if (error && !isInternetError(error)) return
  if (typeof window === 'undefined') return

  const now = Date.now()
  if (now - lastInternetErrorNoticeAt < INTERNET_ERROR_NOTICE_GAP_MS) return
  lastInternetErrorNoticeAt = now

  window.dispatchEvent(new CustomEvent(INTERNET_ERROR_EVENT))
}
