'use client'

import { db } from '@/lib/Supabase/supabaseClient'

export type GoodsReceiptStatus = 'Draft' | 'Posted' | 'Cancelled'
type GoodsReceiptDbStatus = GoodsReceiptStatus | 'Received'

export type GoodsReceiptLine = {
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
  docBatchSeparated?: boolean
  docBatchReference?: string
  docBatchReferenceKey?: string
  docBatchReferenceColumn?: string
}

export type GoodsReceiptDocLine = {
  id: number | string
  receive_date: string
  receive_time: string
  mnf_date: string
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
  status: GoodsReceiptStatus
  created_at: string
}

type GoodsReceiptItemRow = {
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
  void: string
}

type GoodsReceiptDocRow = {
  id: number
  goods_reciept_id: number
  line_no: number
  receive_date: string | null
  receive_time: string | null
  mnf_date: string | null
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

type ItemBatchRow = {
  id: number
  batch_number: string
}

type DbErrorLike = {
  code?: string
  details?: string | null
  message?: string | null
}

const isDuplicateGoodsReceiptNumberError = (error: DbErrorLike | null | undefined) => {
  if (error?.code !== '23505') return false

  const detailText = `${error.details ?? ''} ${error.message ?? ''}`.toLowerCase()
  return detailText.includes('goods_reciept_gr_no_key') || detailText.includes('gr_no')
}

const numberValue = (value: string | number | null | undefined) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const toReceiptLine = (row: GoodsReceiptItemRow): GoodsReceiptLine => ({
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
})

const toReceiptDocLine = (row: GoodsReceiptDocRow): GoodsReceiptDocLine => ({
  id: row.id,
  receive_date: row.receive_date ?? '',
  receive_time: row.receive_time ?? '',
  mnf_date: row.mnf_date ?? '',
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
  status: normalizeReceiptStatus(row.status),
  lines: lines.map(toReceiptListLine),
  docDetails: [],
  createdAt: row.created_at,
})

async function getSessionUserId() {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  return data.session?.user.id ?? null
}

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

async function getOrCreateItemBatch({
  line,
  goodsReceiptId,
  userId,
  batchNumberByKey,
}: {
  line: GoodsReceiptLine
  goodsReceiptId: number
  userId: string | null
  batchNumberByKey: Map<string, string>
}) {
  const batchNumber = line.batchNumber.trim()
  if (!line.itemCode || !line.manufacturingDate || !batchNumber) {
    return { batchNumber, created: false }
  }

  const batchKey = [
    line.itemCode.trim().toUpperCase(),
    line.manufacturingDate,
    line.expiryDate || 'NO_EXP',
    line.docBatchSeparated ? line.docBatchReferenceKey ?? line.docBatchReference ?? '' : '',
  ].join('|')
  const existingLineBatchNumber = batchNumberByKey.get(batchKey)
  if (existingLineBatchNumber) {
    return { batchNumber: existingLineBatchNumber, created: false }
  }

  const shouldKeepLineBatchNumber = Boolean(line.docBatchSeparated)

  let existingBatchQuery = db
    .from('item_batches')
    .select('id, batch_number')
    .eq('item_code', line.itemCode)
    .eq('void', '1')

  if (shouldKeepLineBatchNumber) {
    existingBatchQuery = existingBatchQuery.eq('batch_number', batchNumber)
  } else {
    existingBatchQuery = existingBatchQuery.eq('manufacturing_date', line.manufacturingDate)

    existingBatchQuery = line.expiryDate
      ? existingBatchQuery.eq('expiry_date', line.expiryDate)
      : existingBatchQuery.is('expiry_date', null)
  }

  const { data: existingBatch, error: existingBatchError } = await existingBatchQuery.maybeSingle()

  if (existingBatchError) throw existingBatchError
  if (existingBatch) {
    const resolvedBatchNumber = shouldKeepLineBatchNumber
      ? batchNumber
      : (existingBatch as ItemBatchRow).batch_number
    batchNumberByKey.set(batchKey, resolvedBatchNumber)
    return {
      batchNumber: resolvedBatchNumber,
      created: false,
    }
  }

  const payload = {
    item_id: line.itemId,
    item_code: line.itemCode,
    batch_number: batchNumber,
    supplier_batch_number: line.supplierBatchNumber.trim() || null,
    manufacturing_date: line.manufacturingDate,
    expiry_date: line.expiryDate || null,
    batch_rule_id: line.batchRuleId,
    source_gr_id: goodsReceiptId,
    status: 'Active',
    void: '1',
    created_by: userId,
    updated_by: userId,
  }

  const { data: insertedBatch, error: insertBatchError } = await db
    .from('item_batches')
    .insert(payload)
    .select('id, batch_number')
    .single()

  if (!insertBatchError) {
    batchNumberByKey.set(batchKey, (insertedBatch as ItemBatchRow).batch_number)
    return {
      batchNumber: (insertedBatch as ItemBatchRow).batch_number,
      created: true,
    }
  }

  if (insertBatchError.code !== '23505') throw insertBatchError

  let racedBatchQuery = db
    .from('item_batches')
    .select('id, batch_number')
    .eq('item_code', line.itemCode)
    .eq('void', '1')

  if (shouldKeepLineBatchNumber) {
    racedBatchQuery = racedBatchQuery.eq('batch_number', batchNumber)
  } else {
    racedBatchQuery = racedBatchQuery.eq('manufacturing_date', line.manufacturingDate)

    racedBatchQuery = line.expiryDate
      ? racedBatchQuery.eq('expiry_date', line.expiryDate)
      : racedBatchQuery.is('expiry_date', null)
  }

  const { data: racedBatch, error: racedBatchError } = await racedBatchQuery.maybeSingle()

  if (racedBatchError) throw racedBatchError

  const resolvedBatchNumber = racedBatch && !shouldKeepLineBatchNumber
    ? (racedBatch as ItemBatchRow).batch_number
    : batchNumber
  batchNumberByKey.set(batchKey, resolvedBatchNumber)

  return {
    batchNumber: resolvedBatchNumber,
    created: false,
  }
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
    .select('id, gr_no, vendor, receive_date, fms_type, farm_id, farm_code, farm_name, default_warehouse_id, status, created_at')
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
  const userId = await getSessionUserId()
  const previousStatus = receipt.id
    ? await db
        .from('goods_receipt')
        .select('status')
        .eq('id', receipt.id)
        .maybeSingle()
    : { data: null, error: null }

  if (previousStatus.error) throw previousStatus.error

  const wasPosted = previousStatus.data
    ? normalizeReceiptStatus(previousStatus.data.status as GoodsReceiptDbStatus) === 'Posted'
    : false
  const targetStatus = normalizeReceiptStatus(receipt.status)
  const shouldPostAfterLines = targetStatus === 'Posted' && !wasPosted
  const saveStatus = shouldPostAfterLines
    ? (previousStatus.data?.status as GoodsReceiptDbStatus | undefined) ?? 'Draft'
    : receipt.status

  const headerPayload = {
    gr_no: receipt.grNo,
    dr_reference: receipt.grNo,
    vendor: receipt.vendor,
    receive_date: receipt.receiveDate,
    fms_type: receipt.fmsType || null,
    farm_id: receipt.farmId,
    farm_code: receipt.farmCode || null,
    farm_name: receipt.farmName || null,
    default_warehouse_id: receipt.defaultWarehouseId,
    status: saveStatus,
    ...(receipt.id ? { updated_by: userId } : { created_by: userId }),
  }

  const saveHeader = async (payload: typeof headerPayload) => receipt.id
    ? db
        .from('goods_receipt')
        .update(payload)
        .eq('id', receipt.id)
        .select('*')
        .single()
    : db
        .from('goods_receipt')
        .insert(payload)
        .select('*')
        .single()

  const saveHeaderWithStatusFallback = async (payload: typeof headerPayload) => {
    let result = await saveHeader(payload)

    if (result.error?.code === '23514' && receipt.status === 'Posted') {
      result = await saveHeader({
        ...payload,
        status: 'Received' as GoodsReceiptDbStatus,
      })
    }

    return result
  }

  let savedHeader = null
  let headerError = null

  if (receipt.id) {
    const result = await saveHeaderWithStatusFallback(headerPayload)
    savedHeader = result.data
    headerError = result.error
  } else {
    let payload = headerPayload

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await saveHeaderWithStatusFallback(payload)
      savedHeader = result.data
      headerError = result.error

      if (!headerError) break
      if (!isDuplicateGoodsReceiptNumberError(headerError)) break
      if (attempt === 3) break

      payload = {
        ...payload,
        gr_no: await createGoodsReceiptNumber(),
      }
    }
  }

  if (isDuplicateGoodsReceiptNumberError(headerError)) {
    throw new Error('Unable to generate a unique GR number after 3 attempts. Please try again.')
  }

  if (headerError) throw headerError

  const header = savedHeader as GoodsReceiptRow

  const { data: existingDocs, error: existingDocsError } = await db
    .from('goods_receipt_doc')
    .select('id')
    .eq('goods_reciept_id', header.id)
    .eq('void', '1')

  if (existingDocsError) throw existingDocsError

  for (const doc of existingDocs ?? []) {
    const docId = Number(doc.id)
    const { error: shiftDocError } = await db
      .from('goods_receipt_doc')
      .update({
        line_no: -docId,
        updated_by: userId,
      })
      .eq('id', docId)

    if (shiftDocError) throw shiftDocError
  }

  const retainedDocIds = new Set(
    receipt.docDetails
      .map(line => line.id)
      .filter((id): id is number => typeof id === 'number')
  )
  const removedDocIds = (existingDocs ?? [])
    .map(doc => Number(doc.id))
    .filter(id => !retainedDocIds.has(id))

  if (removedDocIds.length > 0) {
    const { error: removedDocsError } = await db
      .from('goods_receipt_doc')
      .update({
        void: '0',
        updated_by: userId,
      })
      .in('id', removedDocIds)

    if (removedDocsError) throw removedDocsError
  }

  for (const [index, row] of receipt.docDetails.entries()) {
    const docPayload = {
      goods_reciept_id: header.id,
      line_no: index + 1,
      receive_date: row.receive_date || null,
      receive_time: row.receive_time || null,
      mnf_date: row.mnf_date || null,
      transfer_slip: row.transfer_slip.trim() || null,
      average_doc_weight: numberValue(row.average_doc_weight),
      quantity_received: numberValue(row.quantity_received),
      actual_received: numberValue(row.actual_received),
      short_count_remarks: row.short_count_remarks.trim() || null,
      doa_quantity: numberValue(row.doa_quantity),
      doa_count_remarks: row.doa_count_remarks.trim() || null,
      reject_count: numberValue(row.reject_count),
      reject_count_remarks: row.reject_count_remarks.trim() || null,
      void: '1',
      updated_by: userId,
    }

    if (typeof row.id === 'number') {
      const { error: updateDocError } = await db
        .from('goods_receipt_doc')
        .update(docPayload)
        .eq('id', row.id)

      if (updateDocError) throw updateDocError
    } else {
      const { error: insertDocError } = await db
        .from('goods_receipt_doc')
        .insert({
          ...docPayload,
          created_by: userId,
        })

      if (insertDocError) throw insertDocError
    }
  }

  const staleDocVoid = db
    .from('goods_receipt_doc')
    .update({
      void: '0',
      updated_by: userId,
    })
    .eq('goods_reciept_id', header.id)
    .eq('void', '1')

  const { error: staleDocError } = receipt.docDetails.length > 0
    ? await staleDocVoid.gt('line_no', receipt.docDetails.length)
    : await staleDocVoid

  if (staleDocError) throw staleDocError

  const { data: existingItems, error: existingItemsError } = await db
    .from('goods_receipt_items')
    .select('id')
    .eq('goods_reciept_id', header.id)
    .eq('void', '1')

  if (existingItemsError) throw existingItemsError

  for (const item of existingItems ?? []) {
    const itemId = Number(item.id)
    const { error: shiftLineError } = await db
      .from('goods_receipt_items')
      .update({
        line_no: -itemId,
        updated_by: userId,
      })
      .eq('id', itemId)

    if (shiftLineError) throw shiftLineError
  }

  const retainedItemIds = new Set(
    receipt.lines
      .map(line => line.id)
      .filter((id): id is number => typeof id === 'number')
  )
  const removedItemIds = (existingItems ?? [])
    .map(item => Number(item.id))
    .filter(id => !retainedItemIds.has(id))

  if (removedItemIds.length > 0) {
    const { error: removedItemsError } = await db
      .from('goods_receipt_items')
      .update({
        void: '0',
        updated_by: userId,
      })
      .in('id', removedItemIds)

    if (removedItemsError) throw removedItemsError
  }

  const newlyCreatedBatchRuleIds: number[] = []
  const batchNumberByKey = new Map<string, string>()

  for (const [index, line] of receipt.lines.entries()) {
    const batchResult = await getOrCreateItemBatch({
      line,
      goodsReceiptId: header.id,
      userId,
      batchNumberByKey,
    })

    if (batchResult.created && typeof line.batchRuleId === 'number') {
      newlyCreatedBatchRuleIds.push(line.batchRuleId)
    }

    const itemPayload = {
      goods_reciept_id: header.id,
      line_no: index + 1,
      item_id: line.itemId,
      item_code: line.itemCode,
      description: line.description || null,
      batch_rule_id: line.batchRuleId,
      batch_number: batchResult.batchNumber || null,
      supplier_batch_number: line.supplierBatchNumber.trim() || null,
      manufacturing_date: line.manufacturingDate || null,
      expiry_date: line.expiryDate || null,
      alt_qty: line.altQty,
      alt_uom: line.altUom,
      base_qty: line.baseQty,
      base_uom: line.baseUom,
      warehouse_id: line.warehouseId,
      warehouse_code: line.warehouseCode || null,
      warehouse_name: line.warehouseName || null,
      returned_qty: line.returnedQty,
      void: '1',
      updated_by: userId,
    }

    if (typeof line.id === 'number') {
      const { error: updateItemError } = await db
        .from('goods_receipt_items')
        .update(itemPayload)
        .eq('id', line.id)

      if (updateItemError) throw updateItemError
    } else {
      const { error: insertItemError } = await db
        .from('goods_receipt_items')
        .insert({
          ...itemPayload,
          created_by: userId,
        })

      if (insertItemError) throw insertItemError
    }
  }

  const staleLineVoid = db
    .from('goods_receipt_items')
    .update({
      void: '0',
      updated_by: userId,
    })
    .eq('goods_reciept_id', header.id)
    .eq('void', '1')

  const { error: deleteError } = receipt.lines.length > 0
    ? await staleLineVoid.gt('line_no', receipt.lines.length)
    : await staleLineVoid

  if (deleteError) throw deleteError

  if (newlyCreatedBatchRuleIds.length > 0) {
    const ruleIds = Array.from(new Set(newlyCreatedBatchRuleIds))

    if (ruleIds.length > 0) {
      const { data: rules, error: rulesError } = await db
        .from('batch_rules')
        .select('id, series_id, auto_generate')
        .in('id', ruleIds)
        .eq('auto_generate', true)

      if (rulesError) throw rulesError

      const seriesUsage = new Map<number, number>()
      for (const rule of rules ?? []) {
        const seriesId = Number(rule.series_id)
        if (!seriesId) continue

        const lineCount = newlyCreatedBatchRuleIds.filter(ruleId => ruleId === Number(rule.id)).length

        if (lineCount > 0) {
          seriesUsage.set(seriesId, (seriesUsage.get(seriesId) ?? 0) + lineCount)
        }
      }

      for (const [seriesId, incrementBy] of seriesUsage) {
        const { data: series, error: seriesError } = await db
          .from('batch_number_series')
          .select('next_number')
          .eq('id', seriesId)
          .maybeSingle()

        if (seriesError) throw seriesError
        if (!series) continue

        const { error: updateSeriesError } = await db
          .from('batch_number_series')
          .update({
            next_number: Number(series.next_number ?? 0) + incrementBy,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', seriesId)

        if (updateSeriesError) throw updateSeriesError
      }
    }
  }

  if (shouldPostAfterLines) {
    let { error: postError } = await db
      .from('goods_receipt')
      .update({
        status: 'Posted',
        updated_by: userId,
      })
      .eq('id', header.id)

    if (postError?.code === '23514') {
      const fallbackResult = await db
        .from('goods_receipt')
        .update({
          status: 'Received',
          updated_by: userId,
        })
        .eq('id', header.id)

      postError = fallbackResult.error
    }

    if (postError) throw postError
  }

  return getGoodsReceiptById(header.id)
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
