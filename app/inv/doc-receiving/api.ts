'use client'

import { db } from '@/lib/Supabase/supabaseClient'
import { saveDocReceivingWithSources, type ReceivingAllocation } from '@/lib/data/repositories/receivingSources'

export type GoodsReceiptStatus = 'Draft' | 'Posted' | 'Cancelled'
type GoodsReceiptDbStatus = GoodsReceiptStatus | 'Received'

const FUTURE_RECEIVING_DATE_MESSAGE = 'DOC Placement dates cannot be advanced/future-dated.'

const localToday = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const isFutureReceivingDate = (value: string) => Boolean(value) && value > localToday()

export async function getFirstDocPlacementDates(flockCardIds: number[]) {
  const ids = Array.from(new Set(flockCardIds.filter(id => Number.isFinite(id) && id > 0)))
  if (ids.length === 0) return {} as Record<number, string>

  const result = await db
    .from('goods_receipt_doc')
    .select('flock_card_id, receive_date')
    .in('flock_card_id', ids)
    .eq('void', '1')
    .not('receive_date', 'is', null)
    .order('receive_date', { ascending: true })

  if (result.error) throw new Error(`Unable to load first DOC placement dates: ${result.error.message}`)

  return (result.data ?? []).reduce<Record<number, string>>((dates, row) => {
    const flockCardId = Number(row.flock_card_id ?? 0)
    const receiveDate = String(row.receive_date ?? '').slice(0, 10)
    if (flockCardId > 0 && receiveDate && !dates[flockCardId]) dates[flockCardId] = receiveDate
    return dates
  }, {})
}

export type GoodsReceiptLine = {
  sourceDispatchLineId?: number | null
  sourceRef2?: string | null
  id: number | string
  itemId: number | null
  itemCode: string
  description: string
  batchRuleId: number | null
  batchNumber: string
  supplierBatchNumber: string
  manufacturingDate: string
  expiryDate: string
  altQty: number
  altUom: string
  baseQty: number
  baseUom: string
  warehouseId: number | null
  warehouseCode: string
  warehouseName: string
  returnedQty: number
  docLineNo?: number | null
  docBatchSeparated?: boolean
  docBatchReference?: string
  docBatchReferenceKey?: string
  docBatchReferenceColumn?: string
}

export type GoodsReceiptDocLine = {
  source_allocations?: ReceivingAllocation[]
  id: number | string
  receive_date: string
  receive_time: string
  mnf_date: string
  doc_source: string
  building_warehouse_id: number | null
  flock_card_id: number | null
  transfer_slip: string
  average_doc_weight: string
  quantity_received: string
  actual_received: string
  short_count?: string
  short_count_remarks: string
  doa_quantity: string
  doa_count_remarks: string
  reject_count: string
  reject_count_remarks: string
}

export type GoodsReceipt = {
  id: number | null
  grNo: string
  vendor: string
  receiveDate: string
  fmsType: string
  farmId: number | null
  farmCode: string
  farmName: string
  defaultWarehouseId: number | null
  remarks: string
  status: GoodsReceiptDbStatus
  lines: GoodsReceiptLine[]
  docDetails: GoodsReceiptDocLine[]
  createdAt: string
}

type GoodsReceiptRow = {
  id: number
  gr_no: string
  vendor: string
  receive_date: string
  fms_type: string | null
  farm_id: number | null
  farm_code: string | null
  farm_name: string | null
  default_warehouse_id: number | null
  remarks: string | null
  status: GoodsReceiptStatus
  created_at: string
}

type GoodsReceiptItemRow = {
  source_dispatch_line_id?: number | null
  source_ref2?: string | null
  id: number
  goods_reciept_id: number
  item_id: number | null
  item_code: string
  description: string | null
  batch_rule_id: number | null
  batch_number: string | null
  supplier_batch_number: string | null
  manufacturing_date: string | null
  expiry_date: string | null
  alt_qty: number
  alt_uom: string
  base_qty: number
  base_uom: string
  warehouse_id: number | null
  warehouse_code: string | null
  warehouse_name: string | null
  returned_qty: number
  doc_line_no: number | null
  void: string
}

type GoodsReceiptDocRow = {
  source_allocations?: ReceivingAllocation[]
  id: number
  goods_reciept_id: number
  line_no: number
  receive_date: string | null
  receive_time: string | null
  mnf_date: string | null
  doc_source: string | null
  building_warehouse_id: number | null
  flock_card_id: number | null
  transfer_slip: string | null
  average_doc_weight: number | null
  quantity_received: number
  actual_received: number
  short_count_remarks: string | null
  doa_quantity: number
  doa_count_remarks: string | null
  reject_count: number
  reject_count_remarks: string | null
  void: string
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

const toReceiptLine = (row: GoodsReceiptItemRow): GoodsReceiptLine => ({
  sourceDispatchLineId: row.source_dispatch_line_id,
  sourceRef2: row.source_ref2,
  id: row.id,
  itemId: row.item_id,
  itemCode: row.item_code,
  description: row.description ?? '',
  batchRuleId: row.batch_rule_id ?? null,
  batchNumber: row.batch_number ?? '',
  supplierBatchNumber: row.supplier_batch_number ?? '',
  manufacturingDate: row.manufacturing_date ?? '',
  expiryDate: row.expiry_date ?? '',
  altQty: Number(row.alt_qty),
  altUom: row.alt_uom,
  baseQty: Number(row.base_qty),
  baseUom: row.base_uom,
  warehouseId: row.warehouse_id,
  warehouseCode: row.warehouse_code ?? '',
  warehouseName: row.warehouse_name ?? '',
  returnedQty: Number(row.returned_qty),
  docLineNo: row.doc_line_no ?? null,
})

const toReceiptDocLine = (row: GoodsReceiptDocRow): GoodsReceiptDocLine => ({
  source_allocations: row.source_allocations ?? [],
  id: row.id,
  receive_date: row.receive_date ?? '',
  receive_time: row.receive_time ?? '',
  mnf_date: row.mnf_date ?? '',
  doc_source: row.doc_source ?? '',
  building_warehouse_id: row.building_warehouse_id ?? null,
  flock_card_id: row.flock_card_id ?? null,
  transfer_slip: row.transfer_slip ?? '',
  average_doc_weight: row.average_doc_weight == null ? '' : String(row.average_doc_weight),
  quantity_received: String(row.quantity_received ?? ''),
  actual_received: String(row.actual_received ?? ''),
  short_count_remarks: row.short_count_remarks ?? '',
  doa_quantity: String(row.doa_quantity ?? ''),
  doa_count_remarks: row.doa_count_remarks ?? '',
  reject_count: String(row.reject_count ?? ''),
  reject_count_remarks: row.reject_count_remarks ?? '',
})

const normalizeReceiptStatus = (status: GoodsReceiptDbStatus): GoodsReceiptStatus =>
  status === 'Received' ? 'Posted' : status

const toReceipt = (
  row: GoodsReceiptRow,
  lines: GoodsReceiptItemRow[],
  docDetails: GoodsReceiptDocRow[] = [],
): GoodsReceipt => ({
  id: row.id,
  grNo: row.gr_no,
  vendor: row.vendor,
  receiveDate: row.receive_date,
  fmsType: row.fms_type ?? '',
  farmId: row.farm_id,
  farmCode: row.farm_code ?? '',
  farmName: row.farm_name ?? '',
  defaultWarehouseId: row.default_warehouse_id,
  remarks: row.remarks ?? '',
  status: normalizeReceiptStatus(row.status),
  lines: lines.map(toReceiptLine),
  docDetails: docDetails.map(toReceiptDocLine),
  createdAt: row.created_at,
})

const toReceiptListLine = (row: GoodsReceiptListItemRow): GoodsReceiptLine => ({
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

const toReceiptListItem = (
  row: GoodsReceiptRow,
  lines: GoodsReceiptListItemRow[],
): GoodsReceipt => ({
  id: row.id,
  grNo: row.gr_no,
  vendor: row.vendor,
  receiveDate: row.receive_date,
  fmsType: row.fms_type ?? '',
  farmId: row.farm_id,
  farmCode: row.farm_code ?? '',
  farmName: row.farm_name ?? '',
  defaultWarehouseId: row.default_warehouse_id,
  remarks: row.remarks ?? '',
  status: normalizeReceiptStatus(row.status),
  lines: lines.map(toReceiptListLine),
  docDetails: [],
  createdAt: row.created_at,
})

async function getReceiptIdsWithDocReceiving() {
  const { data, error } = await db
    .from('goods_receipt_doc')
    .select('goods_reciept_id')
    .eq('void', '1')

  if (error) throw error

  return Array.from(
    new Set(
      (data ?? [])
        .map(row => Number(row.goods_reciept_id))
        .filter(id => Number.isFinite(id))
    )
  )
}

export async function getGoodsReceipts({
  limit = 50,
  farmId,
  dateFrom,
  dateTo,
}: GoodsReceiptListParams = {}): Promise<GoodsReceipt[]> {
  const docReceivingReceiptIds = await getReceiptIdsWithDocReceiving()

  if (docReceivingReceiptIds.length === 0) return []

  let receiptQuery = db
    .from('goods_receipt')
    .select('id, gr_no, vendor, receive_date, fms_type, farm_id, farm_code, farm_name, default_warehouse_id, remarks, status, created_at')
    .in('id', docReceivingReceiptIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (farmId !== undefined && farmId !== '') receiptQuery = receiptQuery.eq('farm_id', farmId)
  if (dateFrom) receiptQuery = receiptQuery.gte('receive_date', dateFrom)
  if (dateTo) receiptQuery = receiptQuery.lte('receive_date', dateTo)

  const { data: receiptRows, error: receiptError } = await receiptQuery

  if (receiptError) throw receiptError

  const receipts = (receiptRows ?? []) as GoodsReceiptRow[]
  const receiptIds = receipts.map(receipt => receipt.id)

  if (receiptIds.length === 0) return []

  const { data: itemRows, error: itemError } = await db
    .from('goods_receipt_items')
    .select('goods_reciept_id, item_code, description, base_qty, returned_qty')
    .in('goods_reciept_id', receiptIds)
    .eq('void', '1')
    .order('line_no', { ascending: true })

  if (itemError) throw itemError

  const items = (itemRows ?? []) as GoodsReceiptListItemRow[]

  return receipts.map(receipt =>
    toReceiptListItem(
      receipt,
      items.filter(item => item.goods_reciept_id === receipt.id),
    )
  )
}

export async function getGoodsReceiptById(id: number): Promise<GoodsReceipt | null> {
  const { data: receiptRow, error: receiptError } = await db
    .from('goods_receipt')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (receiptError) throw receiptError
  if (!receiptRow) return null

  const { data: itemRows, error: itemError } = await db
    .from('goods_receipt_items')
    .select('*')
    .eq('goods_reciept_id', id)
    .eq('void', '1')
    .order('line_no', { ascending: true })

  if (itemError) throw itemError

  const { data: docRows, error: docError } = await db
    .from('goods_receipt_doc')
    .select('*')
    .eq('goods_reciept_id', id)
    .eq('void', '1')
    .order('line_no', { ascending: true })

  if (docError) throw docError

  return toReceipt(
    receiptRow as GoodsReceiptRow,
    (itemRows ?? []) as GoodsReceiptItemRow[],
    (docRows ?? []) as GoodsReceiptDocRow[],
  )
}

export async function saveGoodsReceipt(receipt: GoodsReceipt) {
  if (isFutureReceivingDate(receipt.receiveDate) || receipt.docDetails.some(row => isFutureReceivingDate(row.receive_date || receipt.receiveDate))) {
    throw new Error(FUTURE_RECEIVING_DATE_MESSAGE)
  }
  let payload = { ...receipt }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const id = await saveDocReceivingWithSources(payload)
      return getGoodsReceiptById(id)
    } catch (error) {
      const failure = error as { code?: string; details?: string; message?: string }
      const duplicateNumber = failure.code === '23505' && /gr_no/i.test(`${failure.details ?? ''} ${failure.message ?? ''}`)
      if (receipt.id || !duplicateNumber) throw error
      if (attempt === 3) throw new Error('Unable to generate a unique GR number after 3 attempts. Please try again.')
      payload = { ...payload, grNo: await createGoodsReceiptNumber() }
    }
  }
  throw new Error('Unable to save DOC Placement.')
}

export async function createGoodsReceiptNumber() {
  const year = new Date().getFullYear()
  const yearSuffix = String(year).slice(-2)

  const { data, error } = await db
    .from('goods_receipt')
    .select('gr_no')
    .ilike('gr_no', `GR-${yearSuffix}-%`)
    .order('gr_no', { ascending: false })
    .limit(1)

  if (error) throw error

  const latestNo = data?.[0]?.gr_no ?? ''
  const latestSequence = Number(latestNo.match(/(\d+)$/)?.[1] ?? 0)
  const sequence = Number.isFinite(latestSequence) ? latestSequence + 1 : 1

  return `GR-${yearSuffix}-${String(sequence).padStart(6, '0')}`
}

export function getReceiptItemSummary(receipt: GoodsReceipt) {
  const descriptions = receipt.lines
    .filter(line => line.itemCode)
    .map(line => line.description || line.itemCode)

  if (descriptions.length === 0) return '-'
  if (descriptions.length === 1) return descriptions[0]
  return `${descriptions[0]} +${descriptions.length - 1} more`
}
