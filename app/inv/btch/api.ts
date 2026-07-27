'use client'

import { db } from '@/lib/Supabase/supabaseClient'
import { activeApprovedFarmsQuery } from '@/lib/data/repositories/farms'

export type BatchResetType = 'Never' | 'Daily' | 'Monthly' | 'Yearly'
export type BatchDateFormat = 'NONE' | 'YYYYMMDD' | 'YYMMDD' | 'YYYYMM' | 'YYMM' | 'YYYY' | 'YY'
export type BatchIssueMethod = 'FIFO' | 'FEFO' | 'LIFO' | 'MANUAL'
export type BatchDefaultStatus = 'Released' | 'Hold' | 'Blocked'

export type BatchNumberSeries = {
  id: number
  created_by: string | null
  created_at: string
  updated_by: number | null
  updated_at: string | null
  code: string
  name: string
  prefix: string | null
  suffix: string | null
  separator: string
  next_number: number
  number_length: number
  reset_type: BatchResetType
  date_format: BatchDateFormat
  include_expiry_date: boolean | null
  active: boolean
  remarks: string | null
  void: string
}

export type BatchNumberSeriesPayload = {
  code: string
  name: string
  prefix: string | null
  suffix: string | null
  separator: string
  next_number: number
  number_length: number
  reset_type: BatchResetType
  date_format: BatchDateFormat
  include_expiry_date: boolean
  active: boolean
  remarks: string | null
}

export type BatchRule = {
  id: number
  created_by: string | null
  created_at: string
  updated_by: number | null
  updated_at: string | null
  code: string
  name: string
  series_id: number
  item_group_id: number | null
  item_id: number | null
  warehouse_id: number | null
  branch_id: number | null
  auto_generate: boolean
  manual_entry: boolean
  allow_duplicate: boolean
  require_manufacturing_date: boolean
  require_expiry_date: boolean
  expiry_days: number | null
  shelf_life_days: number | null
  issue_method: BatchIssueMethod
  require_supplier_batch: boolean
  require_qc: boolean
  default_status: BatchDefaultStatus
  active: boolean
  remarks: string | null
  void: string
}

export type BatchRulePayload = {
  code: string
  name: string
  series_id: number
  item_group_id: number | null
  item_id: number | null
  warehouse_id: number | null
  branch_id: number | null
  auto_generate: boolean
  manual_entry: boolean
  allow_duplicate: boolean
  require_manufacturing_date: boolean
  require_expiry_date: boolean
  expiry_days: number | null
  shelf_life_days: number | null
  issue_method: BatchIssueMethod
  require_supplier_batch: boolean
  require_qc: boolean
  default_status: BatchDefaultStatus
  active: boolean
  remarks: string | null
}

export type BatchLookupOption = {
  id: number
  code: string
  name: string
}

export type BatchReferences = {
  itemGroups: BatchLookupOption[]
  items: BatchLookupOption[]
  warehouses: BatchLookupOption[]
  farms: BatchLookupOption[]
}

export type CreatedBatchInventory = {
  id: string
  batchId: number
  itemId: number | null
  itemCode: string
  itemName: string
  batchNumber: string
  supplierBatchNumber: string
  manufacturingDate: string
  expiryDate: string
  status: string
  sourceGrId: number | null
  sourceGrNo: string
  warehouseCode: string
  onHandQty: number
  createdAt: string
}

export type CreatedBatchInventoryParams = {
  dateFrom?: string
  dateTo?: string
  farmId?: number | string | null
}

export type BatchTransactionTrail = {
  id: number
  sourceDocType: string
  sourceDocEntry: number
  documentLabel: string
  itemCode: string
  warehouseCode: string
  binCode: string
  qty: number
  signedQty: number
  runningQty: number
  transferType: string
  refType: string
  ref: string
  refType2: string
  ref2: string
  createdAt: string
}

type ItemBatchInventoryRow = {
  id: number
  item_id: number | null
  item_code: string
  batch_number: string
  supplier_batch_number: string | null
  manufacturing_date: string | null
  expiry_date: string | null
  source_gr_id: number | null
  status: string | null
  created_at: string
}

type InventoryPostingBatchRow = {
  id: number
  source_doc_type?: string | null
  source_docentry?: number | null
  item_code: string | null
  warehouse_code: string | null
  bin_code?: string | null
  qty: number | null
  transfer_type: string | null
  batch_number?: string | null
  ref_type?: string | null
  ref: string | null
  ref_type2?: string | null
  ref2: string | null
  created_at?: string | null
}

type BatchItemNameRow = {
  item_code: string | null
  item_name: string | null
  description: string | null
}

type BatchSourceReceiptRow = {
  id: number
  gr_no: string | null
  farm_id?: number | null
}

type BatchSourceIssueRow = {
  id: number
  gi_no: string | null
}

type SupabaseErrorLike = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

async function getSessionUserId() {
  const { data, error } = await db.auth.getSession()
  if (error) throwSupabaseError(error, 'Unable to read current session')
  return data.session?.user.id ?? null
}

function getSupabaseErrorText(error: unknown) {
  if (error instanceof Error) return error.message
  if (!error || typeof error !== 'object') return String(error ?? '')

  const dbError = error as SupabaseErrorLike
  return [
    dbError.message,
    dbError.details,
    dbError.hint,
    dbError.code ? `Code: ${dbError.code}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function throwSupabaseError(error: unknown, fallbackMessage: string): never {
  const message = getSupabaseErrorText(error)
  if (
    message.includes('include_expiry_date') ||
    message.includes("Could not find the 'include_expiry_date' column") ||
    message.includes('PGRST204')
  ) {
    throw new Error(
      'Database column include_expiry_date is missing on batch_number_series. Run app/inv/btch/batch_number_series_include_expiry_date.sql in Supabase, then refresh the app.',
    )
  }

  throw new Error(message || fallbackMessage)
}

function signedPostingQty(row: InventoryPostingBatchRow) {
  const qty = Number(row.qty ?? 0)
  return row.transfer_type === 'OUT' ? -qty : qty
}

function addPostingQuantities(
  rows: InventoryPostingBatchRow[],
  batchNumbers: Set<string>,
  quantityByBatchWarehouse: Map<string, { warehouseCode: string; qty: number }>,
) {
  const seenPostingIds = new Set<number>()

  for (const row of rows) {
    if (seenPostingIds.has(row.id)) continue
    seenPostingIds.add(row.id)

    const itemCode = String(row.item_code ?? '').trim()
    const warehouseCode = String(row.warehouse_code ?? '').trim()
    const ref = String(row.ref ?? '').trim()
    const ref2 = String(row.ref2 ?? '').trim()
    const refKey = ref.toUpperCase()
    const ref2Key = ref2.toUpperCase()
    const batchNumber = batchNumbers.has(refKey) ? ref : batchNumbers.has(ref2Key) ? ref2 : ''

    if (!itemCode || !batchNumber) continue

    const key = [itemCode.toUpperCase(), batchNumber.toUpperCase(), warehouseCode.toUpperCase()].join('|')
    const current = quantityByBatchWarehouse.get(key)
    quantityByBatchWarehouse.set(key, {
      warehouseCode: current?.warehouseCode || warehouseCode,
      qty: (current?.qty ?? 0) + signedPostingQty(row),
    })
  }
}

function dedupePostings(rows: InventoryPostingBatchRow[]) {
  const seenPostingIds = new Set<number>()

  return rows.filter(row => {
    if (seenPostingIds.has(row.id)) return false
    seenPostingIds.add(row.id)
    return true
  })
}

function getPostingBatchReference(row: InventoryPostingBatchRow, normalizedBatchNumber: string) {
  const batchNumber = String(row.batch_number ?? '').trim()
  const ref = String(row.ref ?? '').trim()
  const ref2 = String(row.ref2 ?? '').trim()

  if (batchNumber.toUpperCase() === normalizedBatchNumber) return batchNumber
  if (ref.toUpperCase() === normalizedBatchNumber) return ref
  if (ref2.toUpperCase() === normalizedBatchNumber) return ref2

  return ''
}

function documentKey(sourceDocType: string, sourceDocEntry: number) {
  return `${sourceDocType.toUpperCase()}|${sourceDocEntry}`
}

export async function getBatchNumberSeries(): Promise<BatchNumberSeries[]> {
  const { data, error } = await db
    .from('batch_number_series')
    .select('*')
    .eq('void', '1')
    .order('created_at', { ascending: false })

  if (error) throwSupabaseError(error, 'Unable to load batch number series')
  return (data ?? []) as BatchNumberSeries[]
}

export async function saveBatchNumberSeries(
  payload: BatchNumberSeriesPayload,
  id?: number | null,
): Promise<BatchNumberSeries> {
  const authId = await getSessionUserId()
  const cleanPayload = {
    ...payload,
    code: payload.code.trim().toUpperCase(),
    name: payload.name.trim(),
    prefix: payload.prefix?.trim() || null,
    suffix: payload.suffix?.trim() || null,
    separator: payload.separator || '-',
    remarks: payload.remarks?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const query = id
    ? db
        .from('batch_number_series')
        .update(cleanPayload)
        .eq('id', id)
        .select('*')
        .single()
    : db
        .from('batch_number_series')
        .insert({
          ...cleanPayload,
          created_by: authId,
        })
        .select('*')
        .single()

  const { data, error } = await query
  if (error) throwSupabaseError(error, 'Unable to save batch number series')
  return data as BatchNumberSeries
}

export async function deleteBatchNumberSeries(id: number) {
  const { error } = await db
    .from('batch_number_series')
    .update({
      void: '0',
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throwSupabaseError(error, 'Unable to delete batch number series')
}

export async function getBatchRules(): Promise<BatchRule[]> {
  const { data, error } = await db
    .from('batch_rules')
    .select('*')
    .eq('void', '1')
    .order('created_at', { ascending: false })

  if (error) throwSupabaseError(error, 'Unable to load batch rules')
  return (data ?? []) as BatchRule[]
}

export async function saveBatchRule(
  payload: BatchRulePayload,
  id?: number | null,
): Promise<BatchRule> {
  const authId = await getSessionUserId()
  const cleanPayload = {
    ...payload,
    code: payload.code.trim().toUpperCase(),
    name: payload.name.trim(),
    remarks: payload.remarks?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const query = id
    ? db
        .from('batch_rules')
        .update(cleanPayload)
        .eq('id', id)
        .select('*')
        .single()
    : db
        .from('batch_rules')
        .insert({
          ...cleanPayload,
          created_by: authId,
        })
        .select('*')
        .single()

  const { data, error } = await query
  if (error) throwSupabaseError(error, 'Unable to save batch rule')
  return data as BatchRule
}

export async function deleteBatchRule(id: number) {
  const { error } = await db
    .from('batch_rules')
    .update({
      void: '0',
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throwSupabaseError(error, 'Unable to delete batch rule')
}

export async function getBatchReferences(): Promise<BatchReferences> {
  const [itemGroupsResult, itemsResult, warehousesResult, farmsResult] = await Promise.all([
    db.from('item_groups').select('id, code, name').eq('void', '1').order('code'),
    db.from('items').select('id, item_code, item_name, description').eq('void', 1).order('item_code'),
    db.from('i_warehouse').select('id, whse_code, whse_name').eq('is_active', true).order('whse_code'),
    activeApprovedFarmsQuery(db.from('farms').select('id, code, name')).order('code'),
  ])

  if (itemGroupsResult.error) throw itemGroupsResult.error
  if (itemsResult.error) throw itemsResult.error
  if (warehousesResult.error) throw warehousesResult.error
  if (farmsResult.error) throw farmsResult.error

  type ItemGroupRow = { id: number; code: string | null; name: string | null }
  type ItemRow = { id: number; item_code: string | null; item_name: string | null; description: string | null }
  type WarehouseRow = { id: number; whse_code: string | null; whse_name: string | null }
  type FarmRow = { id: number; code: string | null; name: string | null }

  return {
    itemGroups: ((itemGroupsResult.data ?? []) as ItemGroupRow[]).map(row => ({
      id: row.id,
      code: row.code ?? '',
      name: row.name ?? '',
    })),
    items: ((itemsResult.data ?? []) as ItemRow[]).map(row => ({
      id: row.id,
      code: row.item_code ?? '',
      name: row.item_name || row.description || '',
    })),
    warehouses: ((warehousesResult.data ?? []) as WarehouseRow[]).map(row => ({
      id: row.id,
      code: row.whse_code ?? '',
      name: row.whse_name ?? '',
    })),
    farms: ((farmsResult.data ?? []) as FarmRow[]).map(row => ({
      id: row.id,
      code: row.code ?? '',
      name: row.name ?? '',
    })),
  }
}

export async function getCreatedBatchInventory({
  dateFrom,
  dateTo,
  farmId,
}: CreatedBatchInventoryParams = {}): Promise<CreatedBatchInventory[]> {
  const authId = await getSessionUserId()
  if (!authId) return []

  const parsedFarmId = Number(String(farmId ?? '').trim())
  const hasFarmParam = Number.isFinite(parsedFarmId) && parsedFarmId > 0
  const needsReceiptParams = Boolean(dateFrom || dateTo || hasFarmParam)
  let scopedReceiptIds: number[] | null = null

  if (needsReceiptParams) {
    let receiptQuery = db
      .from('goods_receipt')
      .select('id')

    if (dateFrom) receiptQuery = receiptQuery.gte('receive_date', dateFrom)
    if (dateTo) receiptQuery = receiptQuery.lte('receive_date', dateTo)
    if (hasFarmParam) receiptQuery = receiptQuery.eq('farm_id', parsedFarmId)

    const { data: receiptRows, error: receiptError } = await receiptQuery
    if (receiptError) throw receiptError

    scopedReceiptIds = (receiptRows ?? [])
      .map(row => Number(row.id))
      .filter(id => Number.isFinite(id) && id > 0)

    if (scopedReceiptIds.length === 0) return []
  }

  let batchQuery = db
    .from('item_batches')
    .select('id, item_id, item_code, batch_number, supplier_batch_number, manufacturing_date, expiry_date, source_gr_id, status, created_at')
    .eq('created_by', authId)
    .eq('void', '1')
    .order('created_at', { ascending: false })

  if (scopedReceiptIds) {
    batchQuery = batchQuery.in('source_gr_id', scopedReceiptIds)
  }

  const { data: batchRows, error: batchError } = await batchQuery

  if (batchError) throw batchError

  const batches = (batchRows ?? []) as ItemBatchInventoryRow[]
  if (batches.length === 0) return []

  const batchNumbers = Array.from(new Set(
    batches
      .map(batch => String(batch.batch_number ?? '').trim())
      .filter(Boolean),
  ))
  const itemCodes = Array.from(new Set(
    batches
      .map(batch => String(batch.item_code ?? '').trim())
      .filter(Boolean),
  ))
  const sourceGrIds = Array.from(new Set(
    batches
      .map(batch => Number(batch.source_gr_id ?? 0))
      .filter(id => Number.isFinite(id) && id > 0),
  ))

  const itemNamesByCode = new Map<string, string>()
  const receiptNumbersById = new Map<number, string>()
  if (itemCodes.length > 0) {
    const { data: itemRows, error: itemError } = await db
      .from('items')
      .select('item_code, item_name, description')
      .in('item_code', itemCodes)

    if (itemError) throw itemError

    for (const item of (itemRows ?? []) as BatchItemNameRow[]) {
      const code = String(item.item_code ?? '').trim().toUpperCase()
      if (!code) continue
      itemNamesByCode.set(code, item.item_name || item.description || '')
    }
  }

  if (sourceGrIds.length > 0) {
    const { data: receiptRows, error: receiptError } = await db
      .from('goods_receipt')
      .select('id, gr_no')
      .in('id', sourceGrIds)

    if (receiptError) throw receiptError

    for (const receipt of (receiptRows ?? []) as BatchSourceReceiptRow[]) {
      receiptNumbersById.set(receipt.id, receipt.gr_no ?? '')
    }
  }

  const postingSelect = 'id, item_code, warehouse_code, qty, transfer_type, ref, ref2'
  const [refPostingsResult, ref2PostingsResult] = await Promise.all([
    batchNumbers.length > 0 && itemCodes.length > 0
      ? db
          .from('inventory_postings')
          .select(postingSelect)
          .in('item_code', itemCodes)
          .in('ref', batchNumbers)
      : Promise.resolve({ data: [], error: null }),
    batchNumbers.length > 0 && itemCodes.length > 0
      ? db
          .from('inventory_postings')
          .select(postingSelect)
          .in('item_code', itemCodes)
          .in('ref2', batchNumbers)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (refPostingsResult.error) throw refPostingsResult.error
  if (ref2PostingsResult.error) throw ref2PostingsResult.error

  const quantityByBatchWarehouse = new Map<string, { warehouseCode: string; qty: number }>()
  const batchNumberSet = new Set(batchNumbers.map(batchNumber => batchNumber.toUpperCase()))
  addPostingQuantities(
    [
      ...((refPostingsResult.data ?? []) as InventoryPostingBatchRow[]),
      ...((ref2PostingsResult.data ?? []) as InventoryPostingBatchRow[]),
    ],
    batchNumberSet,
    quantityByBatchWarehouse,
  )

  return batches.flatMap(batch => {
    const itemCode = String(batch.item_code ?? '').trim()
    const batchNumber = String(batch.batch_number ?? '').trim()
    const keyPrefix = [itemCode.toUpperCase(), batchNumber.toUpperCase()].join('|')
    const warehouseRows = Array.from(quantityByBatchWarehouse.entries())
      .filter(([key]) => key.startsWith(`${keyPrefix}|`))
      .map(([, value]) => ({
        warehouseCode: value.warehouseCode,
        qty: value.qty,
      }))

    const rows = warehouseRows.length > 0
      ? warehouseRows
      : [{ warehouseCode: '', qty: 0 }]

    return rows.map(row => ({
      id: `${batch.id}-${row.warehouseCode || 'none'}`,
      batchId: batch.id,
      itemId: batch.item_id,
      itemCode,
      itemName: itemNamesByCode.get(itemCode.toUpperCase()) ?? '',
      batchNumber,
      supplierBatchNumber: batch.supplier_batch_number ?? '',
      manufacturingDate: batch.manufacturing_date ?? '',
      expiryDate: batch.expiry_date ?? '',
      status: batch.status ?? 'Active',
      sourceGrId: batch.source_gr_id,
      sourceGrNo: batch.source_gr_id ? receiptNumbersById.get(batch.source_gr_id) ?? '' : '',
      warehouseCode: row.warehouseCode,
      onHandQty: row.qty,
      createdAt: batch.created_at,
    }))
  })
}

export async function getBatchTransactionTrail(
  itemCode: string,
  batchNumber: string,
): Promise<BatchTransactionTrail[]> {
  const normalizedItemCode = itemCode.trim()
  const normalizedBatchNumber = batchNumber.trim()

  if (!normalizedItemCode || !normalizedBatchNumber) return []

  const postingSelect = 'id, source_doc_type, source_docentry, item_code, warehouse_code, bin_code, qty, transfer_type, batch_number, ref_type, ref, ref_type2, ref2, created_at'
  const buildPostingQuery = (field: 'batch_number' | 'ref' | 'ref2') =>
    db
      .from('inventory_postings')
      .select(postingSelect)
      .eq('item_code', normalizedItemCode)
      .eq(field, normalizedBatchNumber)

  const [batchPostingsResult, refPostingsResult, ref2PostingsResult] = await Promise.all([
    buildPostingQuery('batch_number'),
    buildPostingQuery('ref'),
    buildPostingQuery('ref2'),
  ])

  if (batchPostingsResult.error) throw batchPostingsResult.error
  if (refPostingsResult.error) throw refPostingsResult.error
  if (ref2PostingsResult.error) throw ref2PostingsResult.error

  const normalizedBatchKey = normalizedBatchNumber.toUpperCase()
  const postings = dedupePostings([
    ...((batchPostingsResult.data ?? []) as InventoryPostingBatchRow[]),
    ...((refPostingsResult.data ?? []) as InventoryPostingBatchRow[]),
    ...((ref2PostingsResult.data ?? []) as InventoryPostingBatchRow[]),
  ])
    .filter(row => getPostingBatchReference(row, normalizedBatchKey))
    .sort((left, right) => {
      const leftDate = String(left.created_at ?? '')
      const rightDate = String(right.created_at ?? '')
      return leftDate.localeCompare(rightDate) || Number(left.id) - Number(right.id)
    })

  if (postings.length === 0) return []

  const receiptIds = Array.from(new Set(
    postings
      .filter(row => String(row.source_doc_type ?? '').toUpperCase() === 'GOODS_RECEIPT')
      .map(row => Number(row.source_docentry ?? 0))
      .filter(id => Number.isFinite(id) && id > 0),
  ))
  const issueIds = Array.from(new Set(
    postings
      .filter(row => String(row.source_doc_type ?? '').toUpperCase() === 'GOODS_ISSUE')
      .map(row => Number(row.source_docentry ?? 0))
      .filter(id => Number.isFinite(id) && id > 0),
  ))
  const deliveryIds = Array.from(new Set(
    postings
      .filter(row => String(row.source_doc_type ?? '').toUpperCase() === 'BR_DELIVERY')
      .map(row => Number(row.source_docentry ?? 0))
      .filter(id => Number.isFinite(id) && id > 0),
  ))

  const documentLabelsByKey = new Map<string, string>()

  if (receiptIds.length > 0) {
    const { data: receiptRows, error: receiptError } = await db
      .from('goods_receipt')
      .select('id, gr_no')
      .in('id', receiptIds)

    if (receiptError) throw receiptError

    for (const receipt of (receiptRows ?? []) as BatchSourceReceiptRow[]) {
      documentLabelsByKey.set(documentKey('GOODS_RECEIPT', receipt.id), receipt.gr_no || `GR #${receipt.id}`)
    }
  }

  if (issueIds.length > 0) {
    const { data: issueRows, error: issueError } = await db
      .from('goods_issue')
      .select('id, gi_no')
      .in('id', issueIds)

    if (issueError) throw issueError

    for (const issue of (issueRows ?? []) as BatchSourceIssueRow[]) {
      documentLabelsByKey.set(documentKey('GOODS_ISSUE', issue.id), issue.gi_no || `GI #${issue.id}`)
    }
  }

  if (deliveryIds.length > 0) {
    const { data: deliveryRows, error: deliveryError } = await db
      .from('br_delivery')
      .select('id, gi_no')
      .in('id', deliveryIds)

    if (deliveryError) throw deliveryError

    for (const delivery of (deliveryRows ?? []) as BatchSourceIssueRow[]) {
      documentLabelsByKey.set(
        documentKey('BR_DELIVERY', delivery.id),
        delivery.gi_no || `BR-DR #${delivery.id}`,
      )
    }
  }

  let runningQty = 0

  return postings.map(row => {
    const sourceDocType = String(row.source_doc_type ?? '')
    const sourceDocEntry = Number(row.source_docentry ?? 0)
    const signedQty = signedPostingQty(row)
    runningQty += signedQty

    return {
      id: row.id,
      sourceDocType,
      sourceDocEntry,
      documentLabel: documentLabelsByKey.get(documentKey(sourceDocType, sourceDocEntry)) || `${sourceDocType || 'Document'} #${sourceDocEntry || '-'}`,
      itemCode: String(row.item_code ?? ''),
      warehouseCode: String(row.warehouse_code ?? ''),
      binCode: String(row.bin_code ?? ''),
      qty: Number(row.qty ?? 0),
      signedQty,
      runningQty,
      transferType: String(row.transfer_type ?? ''),
      refType: String(row.ref_type ?? ''),
      ref: String(row.ref ?? ''),
      refType2: String(row.ref_type2 ?? ''),
      ref2: String(row.ref2 ?? ''),
      createdAt: String(row.created_at ?? ''),
    }
  })
}
