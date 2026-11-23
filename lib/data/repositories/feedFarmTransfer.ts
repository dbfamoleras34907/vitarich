'use client'

import { getItems } from '@/app/a_dean/items/api'
import { db } from '@/lib/Supabase/supabaseClient'
import { getConfiguredFeedItemCodes } from '@/lib/data/repositories/feedInventoryReport'
import { listAssignedUserFarmOptions } from '@/lib/data/repositories/farmOptions.client'
import { getWarehouseInventoryBalances } from '@/lib/data/repositories/warehouseReport'

export type FeedFarmTransferStatus = 'Draft' | 'Pending Approval' | 'Approved'

export type FeedFarmTransferFarm = {
  id: number
  code: string
  name: string
}

export type FeedFarmTransferWarehouse = {
  id: number
  code: string
  name: string
}

export type FeedFarmTransferLine = {
  id: number | string
  itemId: number
  itemCode: string
  description: string
  sourceBatchNumber: string
  destinationBatchNumber: string
  manufacturingDate: string
  expiryDate: string
  quantity: number
  baseUom: string
  sourceUnitCost: number | null
}

export type FeedFarmTransfer = {
  id: number
  transferNo: string
  transferDate: string
  sourceFarmId: number
  sourceFarmCode: string
  sourceFarmName: string
  destinationFarmId: number
  destinationFarmCode: string
  destinationFarmName: string
  sourceWarehouseId: number
  sourceWarehouseCode: string
  sourceWarehouseName: string
  destinationWarehouseId: number
  destinationWarehouseCode: string
  destinationWarehouseName: string
  status: FeedFarmTransferStatus
  remarks: string
  requestedAt: string | null
  approvedAt: string | null
  createdAt: string
  lines: FeedFarmTransferLine[]
}

export type FeedFarmTransferDraft = {
  id: number | null
  transferDate: string
  sourceFarmId: number | null
  destinationFarmId: number | null
  remarks: string
  lines: FeedFarmTransferLine[]
}

type TransferRow = {
  id: number
  transfer_no: string
  transfer_date: string
  source_farm_id: number
  source_farm_code: string
  source_farm_name: string
  destination_farm_id: number
  destination_farm_code: string
  destination_farm_name: string
  source_warehouse_id: number
  source_warehouse_code: string
  source_warehouse_name: string
  destination_warehouse_id: number
  destination_warehouse_code: string
  destination_warehouse_name: string
  status: FeedFarmTransferStatus
  remarks: string | null
  requested_at: string | null
  approved_at: string | null
  created_at: string
}

type TransferLineRow = {
  id: number
  feed_farm_transfer_id: number
  item_id: number
  item_code: string
  description: string | null
  source_batch_number: string
  destination_batch_number: string | null
  manufacturing_date: string | null
  expiry_date: string | null
  base_qty: number
  base_uom: string
  source_unit_cost: number | null
}

type ItemRecord = {
  id?: number | null
  item_code?: string | null
  item_name?: string | null
  description?: string | null
  inventory_uom?: string | null
  unit_measure?: string | null
}

const toLine = (row: TransferLineRow): FeedFarmTransferLine => ({
  id: row.id,
  itemId: Number(row.item_id),
  itemCode: row.item_code,
  description: row.description ?? '',
  sourceBatchNumber: row.source_batch_number,
  destinationBatchNumber: row.destination_batch_number ?? '',
  manufacturingDate: row.manufacturing_date ?? '',
  expiryDate: row.expiry_date ?? '',
  quantity: Number(row.base_qty),
  baseUom: row.base_uom,
  sourceUnitCost: row.source_unit_cost == null ? null : Number(row.source_unit_cost),
})

const toTransfer = (row: TransferRow, lines: TransferLineRow[]): FeedFarmTransfer => ({
  id: Number(row.id),
  transferNo: row.transfer_no,
  transferDate: row.transfer_date,
  sourceFarmId: Number(row.source_farm_id),
  sourceFarmCode: row.source_farm_code,
  sourceFarmName: row.source_farm_name,
  destinationFarmId: Number(row.destination_farm_id),
  destinationFarmCode: row.destination_farm_code,
  destinationFarmName: row.destination_farm_name,
  sourceWarehouseId: Number(row.source_warehouse_id),
  sourceWarehouseCode: row.source_warehouse_code,
  sourceWarehouseName: row.source_warehouse_name,
  destinationWarehouseId: Number(row.destination_warehouse_id),
  destinationWarehouseCode: row.destination_warehouse_code,
  destinationWarehouseName: row.destination_warehouse_name,
  status: row.status,
  remarks: row.remarks ?? '',
  requestedAt: row.requested_at,
  approvedAt: row.approved_at,
  createdAt: row.created_at,
  lines: lines.filter(line => Number(line.feed_farm_transfer_id) === Number(row.id)).map(toLine),
})

export async function listFeedFarmTransferFarms(): Promise<FeedFarmTransferFarm[]> {
  return (await listAssignedUserFarmOptions(['BR', 'BROILER'], { requireComplete: true }))
    .map(farm => ({ id: farm.id, code: farm.code, name: farm.name }))
}

export async function getDefaultFeedWarehouse(farmId: number): Promise<FeedFarmTransferWarehouse | null> {
  if (!Number.isInteger(farmId) || farmId <= 0) return null
  const { data, error } = await db
    .from('i_warehouse')
    .select('id, whse_code, whse_name')
    .eq('farm_id', farmId)
    .eq('is_default_feed_warehouse', true)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data ? { id: Number(data.id), code: String(data.whse_code), name: String(data.whse_name ?? data.whse_code) } : null
}

export async function copyRemainingFeedInventory(farmId: number): Promise<FeedFarmTransferLine[]> {
  const warehouse = await getDefaultFeedWarehouse(farmId)
  if (!warehouse) throw new Error('The source farm has no active default feed storage.')

  const configuredCodes = await getConfiguredFeedItemCodes(farmId)
  if (!configuredCodes) throw new Error('The source farm has no Feed Group configured.')
  const feedCodes = Array.from(configuredCodes)
  const balances = await getWarehouseInventoryBalances([warehouse.code], feedCodes)
  if (balances.length === 0) return []

  const batchNumbers = Array.from(new Set(balances.map(row => row.batchNumber)))
  const [{ data: batchRows, error: batchError }, items] = await Promise.all([
    db
      .from('item_batches')
      .select('item_code, batch_number, manufacturing_date, expiry_date')
      .eq('void', '1')
      .in('batch_number', batchNumbers),
    getItems(),
  ])
  if (batchError) throw batchError

  const itemByCode = new Map((items as ItemRecord[]).map(item => [String(item.item_code ?? '').trim().toUpperCase(), item]))
  const batchByKey = new Map((batchRows ?? []).map(batch => [
    `${String(batch.item_code ?? '').trim().toUpperCase()}|${String(batch.batch_number ?? '').trim().toUpperCase()}`,
    batch,
  ]))

  return balances.flatMap((balance, index) => {
    const item = itemByCode.get(balance.itemCode.toUpperCase())
    if (!item?.id) return []
    const batch = batchByKey.get(`${balance.itemCode.toUpperCase()}|${balance.batchNumber.toUpperCase()}`)
    return [{
      id: `remaining-${index}-${balance.itemCode}-${balance.batchNumber}`,
      itemId: Number(item.id),
      itemCode: balance.itemCode,
      description: String(item.item_name ?? item.description ?? balance.itemCode),
      sourceBatchNumber: balance.batchNumber,
      destinationBatchNumber: '',
      manufacturingDate: String(batch?.manufacturing_date ?? ''),
      expiryDate: String(batch?.expiry_date ?? ''),
      quantity: balance.onHand,
      baseUom: String(item.inventory_uom ?? item.unit_measure ?? 'KG'),
      sourceUnitCost: null,
    }]
  })
}

export async function listFeedFarmTransfers(status?: FeedFarmTransferStatus): Promise<FeedFarmTransfer[]> {
  let query = db
    .from('feed_farm_transfers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (status) query = query.eq('status', status)

  const { data: headerRows, error: headerError } = await query
  if (headerError) throw headerError
  const headers = (headerRows ?? []) as TransferRow[]
  if (headers.length === 0) return []

  const { data: lineRows, error: lineError } = await db
    .from('feed_farm_transfer_items')
    .select('*')
    .in('feed_farm_transfer_id', headers.map(header => header.id))
    .order('line_no')
  if (lineError) throw lineError

  const lines = (lineRows ?? []) as TransferLineRow[]
  return headers.map(header => toTransfer(header, lines))
}

export async function saveFeedFarmTransfer(document: FeedFarmTransferDraft, submitForApproval: boolean): Promise<number> {
  const { data, error } = await db.rpc('save_feed_farm_transfer', {
    p_document: {
      id: document.id,
      transferDate: document.transferDate,
      sourceFarmId: document.sourceFarmId,
      destinationFarmId: document.destinationFarmId,
      remarks: document.remarks,
      lines: document.lines.map(line => ({
        itemId: line.itemId,
        itemCode: line.itemCode,
        sourceBatchNumber: line.sourceBatchNumber,
        quantity: line.quantity,
        baseUom: line.baseUom,
      })),
    },
    p_submit: submitForApproval,
  })
  if (error) throw error
  return Number(data)
}

export async function approveFeedFarmTransfer(id: number): Promise<void> {
  const { error } = await db.rpc('approve_feed_farm_transfer', { p_transfer_id: id })
  if (error) throw error
}
