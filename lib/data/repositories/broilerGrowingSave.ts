import { db } from '@/lib/Supabase/supabaseClient'
import { isInternetError } from '@/lib/networkError'

export type GrowingSavePayload = {
  id: number | null
  header: Record<string, unknown>
  lines: Array<{
    age: number
    insert: Record<string, unknown>
    update: Record<string, unknown>
    feed: Record<string, unknown> | null
  }>
}

export type GrowingSaveResult = {
  id: number
  fcNo: string
  savedLines: Array<{ id: number; age: number }>
}

type PendingGrowingSave = { signature: string; requestId: string }

const PENDING_SAVE_STORAGE_KEY = 'vitarich:broiler-growing:pending-save'

// Keep the request identity after an ambiguous network failure, including a
// reconnect or page refresh. A retry of the same action returns the committed
// result without reposting inventory/events.
let pendingSave: PendingGrowingSave | null = null

const readPendingSave = (): PendingGrowingSave | null => {
  if (pendingSave) return pendingSave
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(PENDING_SAVE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingGrowingSave>
    if (typeof parsed.signature !== 'string' || typeof parsed.requestId !== 'string') return null
    pendingSave = { signature: parsed.signature, requestId: parsed.requestId }
    return pendingSave
  } catch {
    return null
  }
}

const persistPendingSave = (request: PendingGrowingSave) => {
  pendingSave = request
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(PENDING_SAVE_STORAGE_KEY, JSON.stringify(request))
  } catch {
    // The in-memory identity still protects retries in the current page.
  }
}

const clearPendingSave = (request: PendingGrowingSave) => {
  if (pendingSave?.requestId === request.requestId) pendingSave = null
  if (typeof window === 'undefined') return
  try {
    const stored = window.sessionStorage.getItem(PENDING_SAVE_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) as Partial<PendingGrowingSave> : null
    if (parsed?.requestId === request.requestId) {
      window.sessionStorage.removeItem(PENDING_SAVE_STORAGE_KEY)
    }
  } catch {
    // A storage failure cannot change the database result.
  }
}

async function waitForSaveRequestSettlement(requestId: string) {
  const result = await db.rpc('get_brd_fc_save_request_status', {
    p_request_id: requestId,
  })
  if (result.error) throw result.error
}

export async function saveBroilerGrowingTransaction(payload: GrowingSavePayload): Promise<GrowingSaveResult> {
  const signature = JSON.stringify({
    ...payload,
    header: { ...payload.header, fc_no: payload.id ? payload.header.fc_no : null },
  })
  let request = readPendingSave()
  if (request && request.signature !== signature) {
    await waitForSaveRequestSettlement(request.requestId)
    clearPendingSave(request)
    request = null
  }
  if (!request) {
    request = { signature, requestId: crypto.randomUUID() }
    persistPendingSave(request)
  }

  try {
    const { data, error } = await db.rpc('save_brd_fc_transaction', {
      p_request_id: request.requestId,
      p_payload: payload,
    })
    if (error) {
      if (!isInternetError(error)) clearPendingSave(request)
      throw error
    }
    if (!data) {
      clearPendingSave(request)
      throw new Error('Growing save did not return a result.')
    }
    clearPendingSave(request)
    return data as GrowingSaveResult
  } catch (error) {
    if (!isInternetError(error)) clearPendingSave(request)
    throw error
  }
}
