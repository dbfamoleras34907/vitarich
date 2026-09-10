import { isInternetError, notifyInternetError, notifyInternetRestored } from '../networkError'

export class HttpResponseError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'HttpResponseError'
  }
}

// Observe connectivity without retrying writes or changing request/auth options.
export const fetchWithInternetErrorNotice: typeof fetch = async (...args) => {
  try {
    const response = await fetch(...args)
    notifyInternetRestored()
    return response
  } catch (error) {
    notifyInternetError(error)
    throw error
  }
}

export async function readJsonResponse<T>(response: Response, fallback = 'Request failed.'): Promise<T> {
  let result: unknown
  try {
    result = await response.json()
  } catch (error) {
    if (isInternetError(error) || (error instanceof Error && error.name === 'AbortError')) {
      notifyInternetError(error)
      throw error
    }
    // Proxies can return HTML/text error pages; never expose their bodies as JSON errors.
    if (!response.ok) throw new HttpResponseError(`${fallback} (HTTP ${response.status})`, response.status)
    throw new HttpResponseError('The server returned an invalid response. Please try again.', response.status)
  }
  if (!response.ok) {
    const message = typeof result === 'object' && result !== null && 'error' in result
      && typeof result.error === 'string' && result.error.trim() ? result.error : `${fallback} (HTTP ${response.status})`
    throw new HttpResponseError(message, response.status)
  }
  if (result === null || typeof result !== 'object') {
    throw new HttpResponseError('The server returned an invalid response. Please try again.', response.status)
  }
  return result as T
}
