export const INTERNET_ERROR_MESSAGE = 'Internet connection error. Please check your connection and try again.'
export const INTERNET_ERROR_EVENT = 'vita:internet-error'
export const INTERNET_RESTORED_EVENT = 'vita:internet-restored'
export const INTERNET_ERROR_CONFIRMATION_MS = 60_000

let lastInternetErrorNoticeAt = 0
let hasPendingInternetError = false
const INTERNET_ERROR_NOTICE_GAP_MS = 3000

export function isInternetError(error: unknown) {
  const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : null
  // An HTTP response or a deliberate cancellation is not proof of lost internet.
  if (record?.name === 'AbortError' || record?.code === 'ERR_CANCELED') return false
  const status = Number(record?.status ?? record?.statusCode)
  if (status >= 400 && status <= 599) return false
  const message = record
    ? [record.message, record.name, record.code, record.details].filter(value => typeof value === 'string').join(' ')
    : String(error ?? '')

  if (message === INTERNET_ERROR_MESSAGE || record?.message === INTERNET_ERROR_MESSAGE) return true

  return [
    'failed to fetch',
    'fetch failed',
    'networkerror',
    'network request failed',
    'network error',
    'err_network',
    'econnreset',
    'econnrefused',
    'enotfound',
    'eai_again',
    'load failed',
    'err_internet_disconnected',
    'err_network_changed',
    'err_connection',
  ].some(pattern => message.toLowerCase().includes(pattern))
}

export function isServiceUnavailableError(error: unknown) {
  const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : null
  const status = Number(record?.status ?? record?.statusCode)
  return isInternetError(error) || status >= 500 || record?.name === 'AuthRetryableFetchError'
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
  hasPendingInternetError = true

  window.dispatchEvent(new CustomEvent(INTERNET_ERROR_EVENT))
}

export function notifyInternetRestored() {
  if (typeof window === 'undefined' || !hasPendingInternetError) return

  hasPendingInternetError = false
  lastInternetErrorNoticeAt = 0
  window.dispatchEvent(new CustomEvent(INTERNET_RESTORED_EVENT))
}
