import { db } from '@/lib/Supabase/supabaseClient'

export type ReceivingKind = 'hatchery' | 'broiler'

export type ReceivingSource = {
  sourceLineId: number
  documentId: number
  documentNo: string
  sourceReference: string
  placementId: number | null
  placementDate: string | null
  productionDate: string
  description: string
  buildingName: string
  originFarmCode: string
  originFarmName: string
  dispatchedQuantity: number
  remainingQuantity: number
}

export type ReceivingAllocation = {
  sourceLineId: number
  quantity: number
  shortage: number
  doa: number
  rejects: number
  sourceReference?: string
  documentNo?: string
  receivingBatch?: string
}

function throwSourceError(error: { code?: string; message: string }): never {
  if (['PGRST202', '42P01', '42703'].includes(error.code ?? '')) {
    throw new Error('Receiving source integration requires a database update before it can be used.')
  }
  throw error
}

export function allocationTotals(allocations: ReceivingAllocation[]) {
  return allocations.reduce((total, row) => ({
    quantity: total.quantity + row.quantity,
    shortage: total.shortage + row.shortage,
    doa: total.doa + row.doa,
    rejects: total.rejects + row.rejects,
    actual: total.actual + row.quantity - row.shortage - row.doa - row.rejects,
  }), { quantity: 0, shortage: 0, doa: 0, rejects: 0, actual: 0 })
}

export function validateReceivingAllocations(allocations: ReceivingAllocation[]) {
  const ids = new Set<number>()
  for (const row of allocations) {
    if (!Number.isSafeInteger(row.sourceLineId) || row.sourceLineId <= 0 || ids.has(row.sourceLineId)) {
      throw new Error('Select each source line only once per receiving line.')
    }
    ids.add(row.sourceLineId)
    if (![row.quantity, row.shortage, row.doa, row.rejects].every(value => Number.isSafeInteger(value) && value >= 0) || row.quantity === 0) {
      throw new Error('Source quantities must be whole numbers; allocated quantity must be positive.')
    }
    if (row.shortage + row.doa + row.rejects > row.quantity) {
      throw new Error('Shortage, DOA and rejects cannot exceed the allocated quantity.')
    }
  }
}

export async function listReceivingSources(kind: ReceivingKind, farmId: number, receiptId?: number | null) {
  const { data, error } = await db.rpc('list_receiving_sources', {
    p_kind: kind, p_farm_id: farmId, p_receipt_id: receiptId ?? null,
  })
  if (error) throwSourceError(error)
  return (data ?? []) as ReceivingSource[]
}

export async function linkReceivingSource(kind: ReceivingKind, lineId: number, allocations: ReceivingAllocation[]) {
  validateReceivingAllocations(allocations)
  const { error } = await db.rpc('link_receiving_source', {
    p_kind: kind, p_line_id: lineId, p_allocations: allocations,
  })
  if (error) throwSourceError(error)
}

function requestId(key: string) {
  const storageKey = `receiving-copy:${key}`
  const existing = sessionStorage.getItem(storageKey)
  if (existing) return existing
  const id = crypto.randomUUID()
  sessionStorage.setItem(storageKey, id)
  return id
}

export async function createHatcheryReceiving(payload: Record<string, unknown>) {
  const { data, error } = await db.rpc('save_hatchery_receiving_with_sources', {
    p_payload: payload,
    p_request_id: requestId(`hatchery:${String(payload.clientRequestKey ?? payload.dr_num)}`),
  })
  if (error) throwSourceError(error)
  return data as { docentry: number; approval: { required?: boolean } }
}

export async function saveDocReceivingWithSources(payload: Record<string, unknown>) {
  const { data, error } = await db.rpc('save_doc_receiving_with_sources', {
    p_payload: payload,
    p_request_id: requestId(`broiler:${String(payload.grNo)}`),
  })
  if (error) throwSourceError(error)
  return Number(data)
}
