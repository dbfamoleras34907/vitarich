'use client'

import { db } from '@/lib/Supabase/supabaseClient'
import {
  getGoodsIssueOnHandShortages,
  getItemWarehouseOnHand,
  getOnHandBatches,
  type GoodsIssueOnHandBatch,
  type GoodsIssueOnHandShortage,
} from '@/app/inv/gi/api'

export type InventoryTransferStatus = 'Draft' | 'Posted' | 'Cancelled'

export type InventoryTransferLine = {
  id: number | string
  itemId: number | null
  itemCode: string
  description: string
  batchRuleId: number | null
  batchNumber: string
  manufacturingDate: string
  expiryDate: string
  altQty: number
  altUom: string
  baseQty: number
  baseUom: string
  fromWarehouseId: number | null
  fromWarehouseCode: string
  fromWarehouseName: string
  toWarehouseId: number | null
  toWarehouseCode: string
  toWarehouseName: string
  remarks: string
  onHandQty: number
}

export type InventoryTransfer = {
  id: number | null
  itNo: string
  transferDate: string
  farmId: number | null
  farmCode: string
  farmName: string
  fromWarehouseId: number | null
  fromWarehouseCode: string
  fromWarehouseName: string
  toWarehouseId: number | null
  toWarehouseCode: string
  toWarehouseName: string
  requestedBy: string
  referenceDocNo: string
  remarks: string
  status: InventoryTransferStatus
  lines: InventoryTransferLine[]
  createdAt: string
}

type InventoryTransferRow = {
  id: number
  it_no: string
  transfer_date: string
  farm_id: number | null
  farm_code: string | null
  farm_name: string | null
  from_warehouse_id: number | null
  from_warehouse_code: string | null
  from_warehouse_name: string | null
  to_warehouse_id: number | null
  to_warehouse_code: string | null
  to_warehouse_name: string | null
  requested_by: string | null
  reference_doc_no: string | null
  remarks: string | null
  status: InventoryTransferStatus
  created_at: string
}

type InventoryTransferItemRow = {
  id: number
  inventory_transfer_id: number
  item_id: number | null
  item_code: string
  description: string | null
  batch_rule_id: number | null
  batch_number: string | null
  manufacturing_date: string | null
  expiry_date: string | null
  alt_qty: number
  alt_uom: string
  base_qty: number
  base_uom: string
  from_warehouse_id: number | null
  from_warehouse_code: string | null
  from_warehouse_name: string | null
  to_warehouse_id: number | null
  to_warehouse_code: string | null
  to_warehouse_name: string | null
  remarks: string | null
  void: string
}

type InventoryTransferListItemRow = {
  inventory_transfer_id: number
  item_code: string
  description: string | null
  base_qty: number
}

function errorDetails(error: unknown) {
  return typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error)
}

async function getSessionUserId() {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  return data.session?.user.id ?? null
}

const toTransferLine = (row: InventoryTransferItemRow): InventoryTransferLine => ({
  id: row.id,
  itemId: row.item_id,
  itemCode: row.item_code,
  description: row.description ?? '',
  batchRuleId: row.batch_rule_id ?? null,
  batchNumber: row.batch_number ?? '',
  manufacturingDate: row.manufacturing_date ?? '',
  expiryDate: row.expiry_date ?? '',
  altQty: Number(row.alt_qty),
  altUom: row.alt_uom,
  baseQty: Number(row.base_qty),
  baseUom: row.base_uom,
  fromWarehouseId: row.from_warehouse_id,
  fromWarehouseCode: row.from_warehouse_code ?? '',
  fromWarehouseName: row.from_warehouse_name ?? '',
  toWarehouseId: row.to_warehouse_id,
  toWarehouseCode: row.to_warehouse_code ?? '',
  toWarehouseName: row.to_warehouse_name ?? '',
  remarks: row.remarks ?? '',
  onHandQty: 0,
})

const toTransfer = (
  row: InventoryTransferRow,
  lines: InventoryTransferItemRow[],
): InventoryTransfer => ({
  id: row.id,
  itNo: row.it_no,
  transferDate: row.transfer_date,
  farmId: row.farm_id,
  farmCode: row.farm_code ?? '',
  farmName: row.farm_name ?? '',
  fromWarehouseId: row.from_warehouse_id,
  fromWarehouseCode: row.from_warehouse_code ?? '',
  fromWarehouseName: row.from_warehouse_name ?? '',
  toWarehouseId: row.to_warehouse_id,
  toWarehouseCode: row.to_warehouse_code ?? '',
  toWarehouseName: row.to_warehouse_name ?? '',
  requestedBy: row.requested_by ?? '',
  referenceDocNo: row.reference_doc_no ?? '',
  remarks: row.remarks ?? '',
  status: row.status,
  lines: lines.map(toTransferLine),
  createdAt: row.created_at,
})

const toTransferListLine = (row: InventoryTransferListItemRow): InventoryTransferLine => ({
  id: `${row.inventory_transfer_id}-${row.item_code}`,
  itemId: null,
  itemCode: row.item_code,
  description: row.description ?? '',
  batchRuleId: null,
  batchNumber: '',
  manufacturingDate: '',
  expiryDate: '',
  altQty: 0,
  altUom: '',
  baseQty: Number(row.base_qty),
  baseUom: '',
  fromWarehouseId: null,
  fromWarehouseCode: '',
  fromWarehouseName: '',
  toWarehouseId: null,
  toWarehouseCode: '',
  toWarehouseName: '',
  remarks: '',
  onHandQty: 0,
})

const toTransferListItem = (
  row: InventoryTransferRow,
  lines: InventoryTransferListItemRow[],
): InventoryTransfer => ({
  ...toTransfer(row, []),
  lines: lines.map(toTransferListLine),
})

const toGoodsIssueLikeLine = (line: InventoryTransferLine) => ({
  ...line,
  fromWarehouseId: line.fromWarehouseId,
  fromWarehouseCode: line.fromWarehouseCode,
  fromWarehouseName: line.fromWarehouseName,
})

async function validateOnHand(lines: InventoryTransferLine[]) {
  const [shortage] = await getGoodsIssueOnHandShortages(lines.map(toGoodsIssueLikeLine))
  if (!shortage) return

  const batchText = shortage.batchNumber ? ` batch ${shortage.batchNumber}` : ''
  throw new Error(
    `${shortage.itemCode}${batchText} has only ${shortage.onHandQty} on hand in ${shortage.warehouseCode}.`,
  )
}

export async function getInventoryTransferOnHandShortages(
  lines: InventoryTransferLine[],
): Promise<GoodsIssueOnHandShortage[]> {
  return getGoodsIssueOnHandShortages(lines.map(toGoodsIssueLikeLine))
}

export { getItemWarehouseOnHand, getOnHandBatches }
export type { GoodsIssueOnHandBatch as InventoryTransferOnHandBatch }

export async function getInventoryTransfers(limit = 50): Promise<InventoryTransfer[]> {
  const { data: transferRows, error: transferError } = await db
    .from('inventory_transfer')
    .select('id, it_no, transfer_date, farm_id, farm_code, farm_name, from_warehouse_id, from_warehouse_code, from_warehouse_name, to_warehouse_id, to_warehouse_code, to_warehouse_name, requested_by, reference_doc_no, remarks, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (transferError) throw transferError

  const transfers = (transferRows ?? []) as InventoryTransferRow[]
  const transferIds = transfers.map(transfer => transfer.id)
  if (transferIds.length === 0) return []

  const { data: itemRows, error: itemError } = await db
    .from('inventory_transfer_items')
    .select('inventory_transfer_id, item_code, description, base_qty')
    .in('inventory_transfer_id', transferIds)
    .eq('void', '1')
    .order('line_no', { ascending: true })

  if (itemError) throw itemError

  const items = (itemRows ?? []) as InventoryTransferListItemRow[]
  return transfers.map(transfer =>
    toTransferListItem(
      transfer,
      items.filter(item => item.inventory_transfer_id === transfer.id),
    ),
  )
}

export async function getInventoryTransferById(id: number): Promise<InventoryTransfer | null> {
  const { data: transferRow, error: transferError } = await db
    .from('inventory_transfer')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (transferError) throw transferError
  if (!transferRow) return null

  const { data: itemRows, error: itemError } = await db
    .from('inventory_transfer_items')
    .select('*')
    .eq('inventory_transfer_id', id)
    .eq('void', '1')
    .order('line_no', { ascending: true })

  if (itemError) throw itemError

  return toTransfer(
    transferRow as InventoryTransferRow,
    (itemRows ?? []) as InventoryTransferItemRow[],
  )
}

export async function saveInventoryTransfer(transfer: InventoryTransfer) {
  const userId = await getSessionUserId()
  const previousStatus = transfer.id
    ? await db
        .from('inventory_transfer')
        .select('status')
        .eq('id', transfer.id)
        .maybeSingle()
    : { data: null, error: null }

  if (previousStatus.error) throw previousStatus.error

  const wasPosted = previousStatus.data?.status === 'Posted'
  const shouldPostAfterLines = transfer.status === 'Posted' && !wasPosted
  if (shouldPostAfterLines) await validateOnHand(transfer.lines)

  const saveStatus = shouldPostAfterLines
    ? (previousStatus.data?.status as InventoryTransferStatus | undefined) ?? 'Draft'
    : transfer.status

  const headerPayload = {
    it_no: transfer.itNo,
    transfer_date: transfer.transferDate,
    farm_id: transfer.farmId,
    farm_code: transfer.farmCode || null,
    farm_name: transfer.farmName || null,
    from_warehouse_id: transfer.fromWarehouseId,
    from_warehouse_code: transfer.fromWarehouseCode || null,
    from_warehouse_name: transfer.fromWarehouseName || null,
    to_warehouse_id: transfer.toWarehouseId,
    to_warehouse_code: transfer.toWarehouseCode || null,
    to_warehouse_name: transfer.toWarehouseName || null,
    requested_by: transfer.requestedBy.trim() || null,
    reference_doc_no: transfer.referenceDocNo.trim() || null,
    remarks: transfer.remarks.trim() || null,
    status: saveStatus,
    ...(transfer.id ? { updated_by: userId } : { created_by: userId }),
  }

  const { data: savedHeader, error: headerError } = transfer.id
    ? await db.from('inventory_transfer').update(headerPayload).eq('id', transfer.id).select('*').single()
    : await db.from('inventory_transfer').insert(headerPayload).select('*').single()

  if (headerError) throw headerError
  const header = savedHeader as InventoryTransferRow

  const { data: existingItems, error: existingItemsError } = await db
    .from('inventory_transfer_items')
    .select('id')
    .eq('inventory_transfer_id', header.id)
    .eq('void', '1')

  if (existingItemsError) throw existingItemsError

  for (const item of existingItems ?? []) {
    const itemId = Number(item.id)
    const { error } = await db
      .from('inventory_transfer_items')
      .update({ line_no: -itemId, updated_by: userId })
      .eq('id', itemId)

    if (error) throw error
  }

  const retainedItemIds = new Set(
    transfer.lines
      .map(line => line.id)
      .filter((id): id is number => typeof id === 'number'),
  )
  const removedItemIds = (existingItems ?? [])
    .map(item => Number(item.id))
    .filter(id => !retainedItemIds.has(id))

  if (removedItemIds.length > 0) {
    const { error } = await db
      .from('inventory_transfer_items')
      .update({ void: '0', updated_by: userId })
      .in('id', removedItemIds)

    if (error) throw error
  }

  for (const [index, line] of transfer.lines.entries()) {
    const itemPayload = {
      inventory_transfer_id: header.id,
      line_no: index + 1,
      item_id: line.itemId,
      item_code: line.itemCode,
      description: line.description || null,
      batch_rule_id: line.batchRuleId,
      batch_number: line.batchNumber.trim() || null,
      manufacturing_date: line.manufacturingDate || null,
      expiry_date: line.expiryDate || null,
      alt_qty: line.altQty,
      alt_uom: line.altUom,
      base_qty: line.baseQty,
      base_uom: line.baseUom,
      from_warehouse_id: line.fromWarehouseId,
      from_warehouse_code: line.fromWarehouseCode || null,
      from_warehouse_name: line.fromWarehouseName || null,
      to_warehouse_id: line.toWarehouseId,
      to_warehouse_code: line.toWarehouseCode || null,
      to_warehouse_name: line.toWarehouseName || null,
      remarks: line.remarks.trim() || null,
      void: '1',
      updated_by: userId,
    }

    if (typeof line.id === 'number') {
      const { error } = await db
        .from('inventory_transfer_items')
        .update(itemPayload)
        .eq('id', line.id)

      if (error) throw error
    } else {
      const { error } = await db
        .from('inventory_transfer_items')
        .insert({ ...itemPayload, created_by: userId })

      if (error) throw error
    }
  }

  const staleLineVoid = db
    .from('inventory_transfer_items')
    .update({ void: '0', updated_by: userId })
    .eq('inventory_transfer_id', header.id)
    .eq('void', '1')

  const { error: deleteError } = transfer.lines.length > 0
    ? await staleLineVoid.gt('line_no', transfer.lines.length)
    : await staleLineVoid

  if (deleteError) throw deleteError

  if (shouldPostAfterLines) {
    const { error: postError } = await db
      .from('inventory_transfer')
      .update({ status: 'Posted', updated_by: userId })
      .eq('id', header.id)

    if (postError) throw postError
  }

  return getInventoryTransferById(header.id)
}

export async function createInventoryTransferNumber() {
  const yearSuffix = String(new Date().getFullYear()).slice(-2)

  const { data, error } = await db
    .from('inventory_transfer')
    .select('it_no')
    .ilike('it_no', `IT-${yearSuffix}-%`)
    .order('it_no', { ascending: false })
    .limit(1)

  if (error) throw new Error(`Inventory transfer number could not be created. ${errorDetails(error)}`)

  const latestNo = data?.[0]?.it_no ?? ''
  const latestSequence = Number(latestNo.match(/(\d+)$/)?.[1] ?? 0)
  const sequence = Number.isFinite(latestSequence) ? latestSequence + 1 : 1

  return `IT-${yearSuffix}-${String(sequence).padStart(6, '0')}`
}

export function getTransferItemSummary(transfer: InventoryTransfer) {
  const descriptions = transfer.lines
    .filter(line => line.itemCode)
    .map(line => line.description || line.itemCode)

  if (descriptions.length === 0) return '-'
  if (descriptions.length === 1) return descriptions[0]
  return `${descriptions[0]} +${descriptions.length - 1} more`
}
