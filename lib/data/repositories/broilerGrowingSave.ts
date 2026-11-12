import { db } from '@/lib/Supabase/supabaseClient'
import { isServiceUnavailableError } from '@/lib/networkError'
import { sleep } from '@/lib/utils'
import { createUuid } from '@/lib/utils/createUuid'

const GROWING_SAVE_BATCH_SIZE = 5
const GROWING_SAVE_MAX_ATTEMPTS = 3
const GROWING_SAVE_RETRY_DELAY_MS = 500

export type GrowingSavePayload = {
  id: number | null
  header: Record<string, unknown>
  actionRequestId?: string
  batchNumber?: number
  totalBatches?: number
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

export type GrowingSaveBatchProgress = {
  batchNumber: number
  totalBatches: number
  attempt: number
  maxAttempts: number
  rowCount: number
}

export type GrowingSaveBatchOptions = {
  onProgress?: (progress: GrowingSaveBatchProgress) => void
  onBatchSaved?: (result: GrowingSaveResult, progress: GrowingSaveBatchProgress) => void
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
    request = { signature, requestId: createUuid() }
    persistPendingSave(request)
  }

  try {
    const { data, error } = await db.rpc('save_brd_fc_transaction', {
      p_request_id: request.requestId,
      p_payload: payload,
    })
    if (error) {
      if (!isServiceUnavailableError(error)) clearPendingSave(request)
      throw error
    }
    if (!data) {
      clearPendingSave(request)
      throw new Error('Growing save did not return a result.')
    }
    clearPendingSave(request)
    return data as GrowingSaveResult
  } catch (error) {
    if (!isServiceUnavailableError(error)) clearPendingSave(request)
    throw error
  }
}

export async function saveBroilerGrowingTransactionInBatches(
  payload: GrowingSavePayload,
  options: GrowingSaveBatchOptions = {},
): Promise<GrowingSaveResult> {
  if (payload.lines.length === 0) return saveBroilerGrowingTransaction(payload)

  const actionRequestId = createUuid()
  const totalBatches = Math.ceil(payload.lines.length / GROWING_SAVE_BATCH_SIZE)
  const savedLines: GrowingSaveResult['savedLines'] = []
  let growingId = payload.id
  let growingNumber = String(payload.header.fc_no ?? '').trim()

  for (let offset = 0; offset < payload.lines.length; offset += GROWING_SAVE_BATCH_SIZE) {
    const batchLines = payload.lines.slice(offset, offset + GROWING_SAVE_BATCH_SIZE)
    const batchNumber = Math.floor(offset / GROWING_SAVE_BATCH_SIZE) + 1
    let batchResult: GrowingSaveResult | null = null
    let lastError: unknown = null

    for (let attempt = 1; attempt <= GROWING_SAVE_MAX_ATTEMPTS; attempt += 1) {
      const progress: GrowingSaveBatchProgress = {
        batchNumber,
        totalBatches,
        attempt,
        maxAttempts: GROWING_SAVE_MAX_ATTEMPTS,
        rowCount: batchLines.length,
      }
      options.onProgress?.(progress)

      try {
        batchResult = await saveBroilerGrowingTransaction({
          ...payload,
          id: growingId,
          header: {
            ...payload.header,
            fc_no: growingId ? growingNumber : payload.header.fc_no,
          },
          actionRequestId,
          batchNumber,
          totalBatches,
          lines: batchLines,
        })
        options.onBatchSaved?.(batchResult, progress)
        break
      } catch (error) {
        lastError = error
        if (attempt < GROWING_SAVE_MAX_ATTEMPTS) {
          await sleep(GROWING_SAVE_RETRY_DELAY_MS * attempt)
        }
      }
    }

    if (!batchResult) {
      const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'Unknown error')
      throw new Error(`Batch ${batchNumber} of ${totalBatches} failed after ${GROWING_SAVE_MAX_ATTEMPTS} attempts: ${message}`)
    }

    growingId = batchResult.id
    growingNumber = batchResult.fcNo
    savedLines.push(...batchResult.savedLines)
  }

  if (!growingId || !growingNumber) {
    throw new Error('Growing batch save completed without a document result.')
  }

  return { id: growingId, fcNo: growingNumber, savedLines }
}
