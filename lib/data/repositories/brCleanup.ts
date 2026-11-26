import { db } from '@/lib/Supabase/supabaseClient'
import type { GoodsIssue } from '@/app/inv/gi/api'
import { getBatchTransactionTrail } from '@/lib/data/repositories/batchTransactionTrail'

function cleanupDatabaseError(error: { code?: string; message?: string; details?: string; hint?: string }): Error {
  if (error.code === 'PGRST202') {
    return new Error('Cycle inventory needs a database update before it can load. Ask your administrator to install the cycle-scoped inventory update, then retry.')
  }
  if (error.code === '57014') {
    return new Error('Cycle inventory lookup timed out. Apply the cycle-scoped inventory update, then retry.')
  }
  return new Error([error.message, error.details, error.hint].filter(Boolean).join(' ') || 'Unable to access cycle inventory data.')
}

export type BrCleanupDraftIdentity = {
  id: number
  status: string
  createdBy: string | null
}

export type CleanupCycleInventoryBatch = {
  flock_card_id: number
  building_warehouse_id: number
  building_code: string
  item_code: string
  item_name: string
  batch_number: string
  warehouse_code: string
  on_hand_qty: number
}

export async function getBrCleanupIdentityByDocumentNo(
  documentNo: string,
): Promise<BrCleanupDraftIdentity | null> {
  const normalizedDocumentNo = documentNo.trim()
  if (!normalizedDocumentNo) return null

  const { data, error } = await db
    .from('br_cleanup')
    .select('id, status, created_by')
    .eq('gi_no', normalizedDocumentNo)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: Number(data.id),
    status: String(data.status ?? ''),
    createdBy: data.created_by ?? null,
  }
}

export async function getCleanupCycleInventoryBatches(farmId: number, farmCycleId: number) {
  return getBroilerCycleInventoryBatches(farmId, farmCycleId)
}

export async function getBroilerCycleInventoryBatches(farmId: number, farmCycleId: number) {
  const { data, error } = await db.rpc('get_cleanup_cycle_inventory_batches', {
    p_farm_id: farmId,
    p_farm_cycle_id: farmCycleId,
  })
  if (error) throw cleanupDatabaseError(error)
  return (data ?? []) as CleanupCycleInventoryBatch[]
}

export async function getBroilerCycleGoodsIssueOutQuantities(
  farmId: number,
  farmCycleId: number,
  flockCardIds?: number[],
): Promise<Record<number, number>> {
  if (!Number.isFinite(farmId) || farmId <= 0 || !Number.isFinite(farmCycleId) || farmCycleId <= 0) {
    return {}
  }

  const requestedFlockCardIds = flockCardIds
    ? new Set(flockCardIds.filter(id => Number.isFinite(id) && id > 0))
    : null
  if (requestedFlockCardIds?.size === 0) return {}

  const batches = (await getBroilerCycleInventoryBatches(farmId, farmCycleId))
    .filter(batch => !requestedFlockCardIds || requestedFlockCardIds.has(Number(batch.flock_card_id)))

  const uniqueBatches = new Map<string, CleanupCycleInventoryBatch>()
  for (const batch of batches) {
    const key = [
      Number(batch.flock_card_id),
      String(batch.item_code ?? '').trim().toUpperCase(),
      String(batch.batch_number ?? '').trim().toUpperCase(),
      String(batch.warehouse_code ?? '').trim().toUpperCase(),
    ].join('|')
    if (batch.item_code && batch.batch_number && batch.warehouse_code && !uniqueBatches.has(key)) {
      uniqueBatches.set(key, batch)
    }
  }

  const quantities: Record<number, number> = {}
  const seenPostingIds = new Set<number>()
  await Promise.all(Array.from(uniqueBatches.values()).map(async batch => {
    const trail = await getBatchTransactionTrail(batch.item_code, batch.batch_number)
    const warehouseKey = batch.warehouse_code.trim().toUpperCase()
    const flockCardId = Number(batch.flock_card_id)

    for (const posting of trail) {
      if (
        seenPostingIds.has(posting.id)
        || posting.sourceDocType.trim().toUpperCase() !== 'GOODS_ISSUE'
        || posting.transferType.trim().toUpperCase() !== 'OUT'
        || posting.warehouseCode.trim().toUpperCase() !== warehouseKey
      ) continue

      seenPostingIds.add(posting.id)
      const quantity = Number(posting.qty ?? 0)
      if (Number.isFinite(quantity) && quantity > 0) {
        quantities[flockCardId] = (quantities[flockCardId] ?? 0) + quantity
      }
    }
  }))

  return quantities
}

export async function saveBroilerCleanup(issue: GoodsIssue) {
  const { data, error } = await db.rpc('save_br_cleanup_transaction', {
    p_document: { ...issue, lines: issue.lines },
  })
  if (error) throw cleanupDatabaseError(error)
  return data as { header: unknown; lines: unknown[]; allocations?: unknown[] } | null
}

export async function reverseBroilerCleanup(documentId: number, reason: string): Promise<void> {
  const { error } = await db.rpc('reverse_br_cleanup_transaction', {
    p_cleanup_id: documentId,
    p_reason: reason.trim(),
  })
  if (error) throw cleanupDatabaseError(error)
}
