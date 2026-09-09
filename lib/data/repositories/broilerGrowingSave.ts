import { db } from '@/lib/Supabase/supabaseClient'

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

// Keep the request identity after an ambiguous network failure. A retry of the
// same action returns the committed result without reposting inventory/events.
let pendingSave: { signature: string; requestId: string; payload: GrowingSavePayload } | null = null

export async function saveBroilerGrowingTransaction(payload: GrowingSavePayload): Promise<GrowingSaveResult> {
  const signature = JSON.stringify({
    ...payload,
    header: { ...payload.header, fc_no: payload.id ? payload.header.fc_no : null },
  })
  if (pendingSave?.signature !== signature) {
    pendingSave = { signature, requestId: crypto.randomUUID(), payload }
  }
  const request = pendingSave
  const { data, error } = await db.rpc('save_brd_fc_transaction', {
    p_request_id: request.requestId,
    p_payload: request.payload,
  })
  if (error) throw error
  if (!data) throw new Error('Growing save did not return a result.')
  if (pendingSave === request) pendingSave = null
  return data as GrowingSaveResult
}
