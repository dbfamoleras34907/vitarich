'use client'

import { db } from '@/lib/Supabase/supabaseClient'

import type { GoodsReceipt, GoodsReceiptLine, GoodsReceiptStatus } from './api'

type GoodsReceiptListRow = {
  id: number
  gr_no: string
  dr_reference: string
  vendor: string
  receive_date: string
  fms_type: string | null
  farm_id: number | null
  farm_code: string | null
  farm_name: string | null
  default_warehouse_id: number | null
  status: GoodsReceiptStatus | 'Received'
  created_at: string
}

type GoodsReceiptListItemRow = {
  goods_reciept_id: number
  item_code: string
  description: string | null
  base_qty: number
  returned_qty: number
}

export type GoodsReceiptListParams = {
  limit?: number
  farmId?: number | string
  dateFrom?: string
  dateTo?: string
}

const toReceiptLine = (row: GoodsReceiptListItemRow): GoodsReceiptLine => ({
  id: `${row.goods_reciept_id}-${row.item_code}`,
  itemId: null,
  itemCode: row.item_code,
  description: row.description ?? '',
  batchRuleId: null,
  batchNumber: '',
  supplierBatchNumber: '',
  manufacturingDate: '',
  expiryDate: '',
  altQty: 0,
  altUom: '',
  baseQty: Number(row.base_qty),
  baseUom: '',
  warehouseId: null,
  warehouseCode: '',
  warehouseName: '',
  returnedQty: Number(row.returned_qty),
})

const toReceipt = (
  row: GoodsReceiptListRow,
  items: GoodsReceiptListItemRow[],
): GoodsReceipt => ({
  id: row.id,
  grNo: row.gr_no,
  drReference: row.dr_reference,
  vendor: row.vendor,
  receiveDate: row.receive_date,
  fmsType: row.fms_type ?? '',
  farmId: row.farm_id,
  farmCode: row.farm_code ?? '',
  farmName: row.farm_name ?? '',
  defaultWarehouseId: row.default_warehouse_id,
  status: row.status === 'Received' ? 'Posted' : row.status,
  lines: items.map(toReceiptLine),
  createdAt: row.created_at,
})

async function getDocumentReceivingReceiptIds() {
  const { data, error } = await db
    .from('goods_receipt_doc')
    .select('goods_reciept_id')
    .eq('void', '1')

  if (error) throw error

  return Array.from(new Set(
    (data ?? [])
      .map(row => Number(row.goods_reciept_id))
      .filter(Number.isFinite),
  ))
}

export async function getGoodsReceipts({
  limit = 50,
  farmId,
  dateFrom,
  dateTo,
}: GoodsReceiptListParams = {}): Promise<GoodsReceipt[]> {
  const documentReceivingReceiptIds = await getDocumentReceivingReceiptIds()

  let query = db
    .from('goods_receipt')
    .select('id, gr_no, dr_reference, vendor, receive_date, fms_type, farm_id, farm_code, farm_name, default_warehouse_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (farmId !== undefined && farmId !== '') query = query.eq('farm_id', farmId)
  if (dateFrom) query = query.gte('receive_date', dateFrom)
  if (dateTo) query = query.lte('receive_date', dateTo)

  if (documentReceivingReceiptIds.length > 0) {
    query = query.not('id', 'in', `(${documentReceivingReceiptIds.join(',')})`)
  }

  const { data, error } = await query
  if (error) throw error

  const receipts = (data ?? []) as GoodsReceiptListRow[]
  const receiptIds = receipts.map(receipt => receipt.id)
  if (receiptIds.length === 0) return []

  const { data: itemData, error: itemError } = await db
    .from('goods_receipt_items')
    .select('goods_reciept_id, item_code, description, base_qty, returned_qty')
    .in('goods_reciept_id', receiptIds)
    .eq('void', '1')
    .order('line_no', { ascending: true })

  if (itemError) throw itemError

  const itemsByReceiptId = new Map<number, GoodsReceiptListItemRow[]>()
  for (const item of (itemData ?? []) as GoodsReceiptListItemRow[]) {
    const items = itemsByReceiptId.get(item.goods_reciept_id) ?? []
    items.push(item)
    itemsByReceiptId.set(item.goods_reciept_id, items)
  }

  return receipts.map(receipt => toReceipt(receipt, itemsByReceiptId.get(receipt.id) ?? []))
}

export function getReceiptItemSummary(receipt: GoodsReceipt) {
  const descriptions = receipt.lines
    .filter(line => line.itemCode)
    .map(line => line.description || line.itemCode)

  if (descriptions.length === 0) return '-'
  if (descriptions.length === 1) return descriptions[0]
  return `${descriptions[0]} +${descriptions.length - 1} more`
}
