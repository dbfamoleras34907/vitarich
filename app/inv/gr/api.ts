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
}

export type GoodsReceipt = {
  id: number | null
  grNo: string
  vendor: string
  receiveDate: string
  farmId: number | null
  farmCode: string
  farmName: string
  defaultWarehouseId: number | null
  status: GoodsReceiptDbStatus
  lines: GoodsReceiptLine[]
  createdAt: string
}

type GoodsReceiptRow = {
  id: number
  gr_no: string
  vendor: string
  receive_date: string
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

type GoodsReceiptListItemRow = {
  goods_reciept_id: number
  item_code: string
  description: string | null
  base_qty: number
  returned_qty: number
}

type ItemBatchRow = {
  id: number
  batch_number: string
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

const normalizeReceiptStatus = (status: GoodsReceiptDbStatus): GoodsReceiptStatus =>
  status === 'Received' ? 'Posted' : status

const toReceipt = (
  row: GoodsReceiptRow,
  lines: GoodsReceiptItemRow[],
): GoodsReceipt => ({
  id: row.id,
  grNo: row.gr_no,
  vendor: row.vendor,
  receiveDate: row.receive_date,
  farmId: row.farm_id,
  farmCode: row.farm_code ?? '',
  farmName: row.farm_name ?? '',
  defaultWarehouseId: row.default_warehouse_id,
  status: normalizeReceiptStatus(row.status),
  lines: lines.map(toReceiptLine),
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
  farmId: row.farm_id,
  farmCode: row.farm_code ?? '',
  farmName: row.farm_name ?? '',
  defaultWarehouseId: row.default_warehouse_id,
  status: normalizeReceiptStatus(row.status),
  lines: lines.map(toReceiptListLine),
  createdAt: row.created_at,
})

async function getSessionUserId() {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  return data.session?.user.id ?? null
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

  const batchKey = `${line.itemCode.trim().toUpperCase()}|${line.manufacturingDate}|${line.expiryDate || 'NO_EXP'}`
  const existingLineBatchNumber = batchNumberByKey.get(batchKey)
  if (existingLineBatchNumber) {
    return { batchNumber: existingLineBatchNumber, created: false }
  }

  let existingBatchQuery = db
    .from('item_batches')
    .select('id, batch_number')
    .eq('item_code', line.itemCode)
    .eq('manufacturing_date', line.manufacturingDate)
    .eq('void', '1')

  existingBatchQuery = line.expiryDate
    ? existingBatchQuery.eq('expiry_date', line.expiryDate)
    : existingBatchQuery.is('expiry_date', null)

  const { data: existingBatch, error: existingBatchError } = await existingBatchQuery.maybeSingle()

  if (existingBatchError) throw existingBatchError
  if (existingBatch) {
    batchNumberByKey.set(batchKey, (existingBatch as ItemBatchRow).batch_number)
    return {
      batchNumber: (existingBatch as ItemBatchRow).batch_number,
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
    .eq('manufacturing_date', line.manufacturingDate)
    .eq('void', '1')

  racedBatchQuery = line.expiryDate
    ? racedBatchQuery.eq('expiry_date', line.expiryDate)
    : racedBatchQuery.is('expiry_date', null)

  const { data: racedBatch, error: racedBatchError } = await racedBatchQuery.maybeSingle()

  if (racedBatchError) throw racedBatchError

  const resolvedBatchNumber = racedBatch ? (racedBatch as ItemBatchRow).batch_number : batchNumber
  batchNumberByKey.set(batchKey, resolvedBatchNumber)

  return {
    batchNumber: resolvedBatchNumber,
    created: false,
  }
}

export async function getGoodsReceipts(limit = 50): Promise<GoodsReceipt[]> {
  const { data: receiptRows, error: receiptError } = await db
    .from('goods_receipt')
    .select('id, gr_no, vendor, receive_date, farm_id, farm_code, farm_name, default_warehouse_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

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

  return toReceipt(
    receiptRow as GoodsReceiptRow,
    (itemRows ?? []) as GoodsReceiptItemRow[],
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
    vendor: receipt.vendor,
    receive_date: receipt.receiveDate,
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

  let { data: savedHeader, error: headerError } = await saveHeader(headerPayload)

  if (headerError?.code === '23514' && receipt.status === 'Posted') {
    const fallbackHeaderPayload = {
      ...headerPayload,
      status: 'Received' as GoodsReceiptDbStatus,
    }
    const fallbackResult = await saveHeader(fallbackHeaderPayload)
    savedHeader = fallbackResult.data
    headerError = fallbackResult.error
  }

  if (headerError) throw headerError

  const header = savedHeader as GoodsReceiptRow

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
