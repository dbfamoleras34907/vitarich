'use client'

import { db } from '@/lib/Supabase/supabaseClient'

export type GoodsIssueStatus = 'Draft' | 'Posted' | 'Cancelled'

export type GoodsIssueLine = {
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
  onHandQty: number
}

export type GoodsIssue = {
  id: number | null
  giNo: string
  triggeredBy: string
  issueDate: string
  farmId: number | null
  farmCode: string
  farmName: string
  fromWarehouseId: number | null
  fromWarehouseCode: string
  fromWarehouseName: string
  remarks: string
  status: GoodsIssueStatus
  lines: GoodsIssueLine[]
  createdAt: string
}

type GoodsIssueRow = {
  id: number
  gi_no: string
  issue_date: string
  farm_id: number | null
  farm_code: string | null
  farm_name: string | null
  from_warehouse_id: number | null
  from_warehouse_code: string | null
  from_warehouse_name: string | null
  triggered_by: string | null
  remarks: string | null
  status: GoodsIssueStatus
  created_at: string
}

type GoodsIssueItemRow = {
  id: number
  goods_issue_id: number
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
  void: string
}

type GoodsIssueListItemRow = {
  goods_issue_id: number
  item_code: string
  description: string | null
  base_qty: number
}

export type GoodsIssueOnHandBatch = {
  itemCode: string
  warehouseCode: string
  batchNumber: string
  manufacturingDate: string
  expiryDate: string
  onHandQty: number
}

export type GoodsIssueOnHandShortage = {
  itemCode: string
  warehouseCode: string
  batchNumber: string
  requiredQty: number
  onHandQty: number
}

type InventoryPostingRow = {
  item_code: string | null
  warehouse_code: string | null
  qty: number | null
  transfer_type: string | null
  ref: string | null
}

type ItemBatchRow = {
  item_code: string
  batch_number: string
  manufacturing_date: string | null
  expiry_date: string | null
}

function errorDetails(error: unknown) {
  return typeof error === 'object' && error !== null
    ? JSON.stringify(error)
    : String(error)
}

const toIssueLine = (row: GoodsIssueItemRow): GoodsIssueLine => ({
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
  onHandQty: 0,
})

const toIssue = (row: GoodsIssueRow, lines: GoodsIssueItemRow[]): GoodsIssue => ({
  id: row.id,
  giNo: row.gi_no,
  triggeredBy: row.triggered_by ?? 'GI',
  issueDate: row.issue_date,
  farmId: row.farm_id,
  farmCode: row.farm_code ?? '',
  farmName: row.farm_name ?? '',
  fromWarehouseId: row.from_warehouse_id,
  fromWarehouseCode: row.from_warehouse_code ?? '',
  fromWarehouseName: row.from_warehouse_name ?? '',
  remarks: row.remarks ?? '',
  status: row.status,
  lines: lines.map(toIssueLine),
  createdAt: row.created_at,
})

const toIssueListLine = (row: GoodsIssueListItemRow): GoodsIssueLine => ({
  id: `${row.goods_issue_id}-${row.item_code}`,
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
  onHandQty: 0,
})

const toIssueListItem = (
  row: GoodsIssueRow,
  lines: GoodsIssueListItemRow[],
): GoodsIssue => ({
  ...toIssue(row, []),
  lines: lines.map(toIssueListLine),
})

async function getSessionUserId() {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  return data.session?.user.id ?? null
}

function signedQty(row: InventoryPostingRow) {
  const qty = Number(row.qty ?? 0)
  return row.transfer_type === 'OUT' ? -qty : qty
}

const inventoryRequirementKey = (line: GoodsIssueLine) =>
  [
    line.itemCode,
    line.fromWarehouseCode,
    line.batchNumber || '',
  ].map(value => value.trim().toUpperCase()).join('|')

function getRequiredInventoryQuantities(lines: GoodsIssueLine[]) {
  const requiredByKey = new Map<string, GoodsIssueOnHandShortage>()

  for (const line of lines) {
    const requiredQty = Number(line.baseQty || 0)
    if (!line.itemCode || !line.fromWarehouseCode || requiredQty <= 0) continue

    const key = inventoryRequirementKey(line)
    const current = requiredByKey.get(key)

    if (current) {
      current.requiredQty += requiredQty
      continue
    }

    requiredByKey.set(key, {
      itemCode: line.itemCode.trim(),
      warehouseCode: line.fromWarehouseCode.trim(),
      batchNumber: line.batchNumber.trim(),
      requiredQty,
      onHandQty: 0,
    })
  }

  return Array.from(requiredByKey.values())
}

export async function getItemWarehouseOnHand(
  itemCode: string,
  warehouseCode: string,
  batchNumber?: string,
) {
  if (!itemCode || !warehouseCode) return 0

  let query = db
    .from('inventory_postings')
    .select('item_code, warehouse_code, qty, transfer_type, ref')
    .eq('item_code', itemCode)
    .eq('warehouse_code', warehouseCode)

  if (batchNumber) {
    query = query.eq('ref', batchNumber)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as InventoryPostingRow[]).reduce(
    (total, row) => total + signedQty(row),
    0,
  )
}

export async function getOnHandBatches(
  itemCode: string,
  warehouseCode: string,
): Promise<GoodsIssueOnHandBatch[]> {
  if (!itemCode || !warehouseCode) return []

  const { data: postingRows, error: postingError } = await db
    .from('inventory_postings')
    .select('item_code, warehouse_code, qty, transfer_type, ref')
    .eq('item_code', itemCode)
    .eq('warehouse_code', warehouseCode)
    .not('ref', 'is', null)

  if (postingError) throw postingError

  const quantityByBatch = new Map<string, number>()
  for (const row of (postingRows ?? []) as InventoryPostingRow[]) {
    const batchNumber = String(row.ref ?? '').trim()
    if (!batchNumber) continue
    quantityByBatch.set(batchNumber, (quantityByBatch.get(batchNumber) ?? 0) + signedQty(row))
  }

  const batchNumbers = Array.from(quantityByBatch.entries())
    .filter(([, qty]) => qty > 0)
    .map(([batchNumber]) => batchNumber)

  if (batchNumbers.length === 0) return []

  const { data: batchRows, error: batchError } = await db
    .from('item_batches')
    .select('item_code, batch_number, manufacturing_date, expiry_date')
    .eq('item_code', itemCode)
    .eq('void', '1')
    .in('batch_number', batchNumbers)

  if (batchError) throw batchError

  const batchDateByNumber = new Map(
    ((batchRows ?? []) as ItemBatchRow[]).map(row => [row.batch_number, row]),
  )

  return batchNumbers
    .map(batchNumber => {
      const batch = batchDateByNumber.get(batchNumber)
      return {
        itemCode,
        warehouseCode,
        batchNumber,
        manufacturingDate: batch?.manufacturing_date ?? '',
        expiryDate: batch?.expiry_date ?? '',
        onHandQty: quantityByBatch.get(batchNumber) ?? 0,
      }
    })
    .sort((left, right) => {
      const leftDate = left.expiryDate || '9999-12-31'
      const rightDate = right.expiryDate || '9999-12-31'
      return leftDate.localeCompare(rightDate) || left.batchNumber.localeCompare(right.batchNumber)
    })
}

export async function getGoodsIssueOnHandShortages(
  lines: GoodsIssueLine[],
): Promise<GoodsIssueOnHandShortage[]> {
  const requirements = getRequiredInventoryQuantities(lines)

  const checkedRequirements = await Promise.all(
    requirements.map(async requirement => ({
      ...requirement,
      onHandQty: await getItemWarehouseOnHand(
        requirement.itemCode,
        requirement.warehouseCode,
        requirement.batchNumber || undefined,
      ),
    })),
  )

  return checkedRequirements.filter(
    requirement => requirement.requiredQty > requirement.onHandQty,
  )
}

export async function getGoodsIssues(
  limit = 50,
  triggeredBy = 'GI',
  farmId?: number | string | null,
): Promise<GoodsIssue[]> {
  let query = db
    .from('goods_issue')
    .select('id, gi_no, triggered_by, issue_date, farm_id, farm_code, farm_name, from_warehouse_id, from_warehouse_code, from_warehouse_name, remarks, status, created_at')
    .eq('triggered_by', triggeredBy)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (farmId !== null && farmId !== undefined && String(farmId).trim() !== '') {
    query = query.eq('farm_id', farmId)
  }

  const { data: issueRows, error: issueError } = await query

  if (issueError) throw issueError

  const issues = (issueRows ?? []) as GoodsIssueRow[]
  const issueIds = issues.map(issue => issue.id)
  if (issueIds.length === 0) return []

  const { data: itemRows, error: itemError } = await db
    .from('goods_issue_items')
    .select('goods_issue_id, item_code, description, base_qty')
    .in('goods_issue_id', issueIds)
    .eq('void', '1')
    .order('line_no', { ascending: true })

  if (itemError) throw itemError

  const items = (itemRows ?? []) as GoodsIssueListItemRow[]
  return issues.map(issue =>
    toIssueListItem(issue, items.filter(item => item.goods_issue_id === issue.id)),
  )
}

export async function getGoodsIssueById(id: number): Promise<GoodsIssue | null> {
  const { data: issueRow, error: issueError } = await db
    .from('goods_issue')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (issueError) throw issueError
  if (!issueRow) return null

  const { data: itemRows, error: itemError } = await db
    .from('goods_issue_items')
    .select('*')
    .eq('goods_issue_id', id)
    .eq('void', '1')
    .order('line_no', { ascending: true })

  if (itemError) throw itemError

  return toIssue(issueRow as GoodsIssueRow, (itemRows ?? []) as GoodsIssueItemRow[])
}

async function validateOnHand(lines: GoodsIssueLine[]) {
  const [shortage] = await getGoodsIssueOnHandShortages(lines)
  if (!shortage) return

  const batchText = shortage.batchNumber ? ` batch ${shortage.batchNumber}` : ''
  throw new Error(
    `${shortage.itemCode}${batchText} has only ${shortage.onHandQty} on hand in ${shortage.warehouseCode}.`,
  )
}

export async function saveGoodsIssue(issue: GoodsIssue) {
  const userId = await getSessionUserId()
  const previousStatus = issue.id
    ? await db
        .from('goods_issue')
        .select('status')
        .eq('id', issue.id)
        .maybeSingle()
    : { data: null, error: null }

  if (previousStatus.error) throw previousStatus.error

  const wasPosted = previousStatus.data?.status === 'Posted'
  const shouldPostAfterLines = issue.status === 'Posted' && !wasPosted
  if (shouldPostAfterLines) await validateOnHand(issue.lines)

  const saveStatus = shouldPostAfterLines
    ? (previousStatus.data?.status as GoodsIssueStatus | undefined) ?? 'Draft'
    : issue.status

  const headerPayload = {
    gi_no: issue.giNo,
    issue_date: issue.issueDate,
    farm_id: issue.farmId,
    farm_code: issue.farmCode || null,
    farm_name: issue.farmName || null,
    from_warehouse_id: issue.fromWarehouseId,
    from_warehouse_code: issue.fromWarehouseCode || null,
    from_warehouse_name: issue.fromWarehouseName || null,
    triggered_by: issue.triggeredBy || 'GI',
    remarks: issue.remarks.trim() || null,
    status: saveStatus,
    ...(issue.id ? { updated_by: userId } : { created_by: userId }),
  }

  const { data: savedHeader, error: headerError } = issue.id
    ? await db.from('goods_issue').update(headerPayload).eq('id', issue.id).select('*').single()
    : await db.from('goods_issue').insert(headerPayload).select('*').single()

  if (headerError) throw headerError
  const header = savedHeader as GoodsIssueRow

  const { data: existingItems, error: existingItemsError } = await db
    .from('goods_issue_items')
    .select('id')
    .eq('goods_issue_id', header.id)
    .eq('void', '1')

  if (existingItemsError) throw existingItemsError

  for (const item of existingItems ?? []) {
    const itemId = Number(item.id)
    const { error } = await db
      .from('goods_issue_items')
      .update({ line_no: -itemId, updated_by: userId })
      .eq('id', itemId)

    if (error) throw error
  }

  const retainedItemIds = new Set(
    issue.lines
      .map(line => line.id)
      .filter((id): id is number => typeof id === 'number'),
  )
  const removedItemIds = (existingItems ?? [])
    .map(item => Number(item.id))
    .filter(id => !retainedItemIds.has(id))

  if (removedItemIds.length > 0) {
    const { error } = await db
      .from('goods_issue_items')
      .update({ void: '0', updated_by: userId })
      .in('id', removedItemIds)

    if (error) throw error
  }

  for (const [index, line] of issue.lines.entries()) {
    const itemPayload = {
      goods_issue_id: header.id,
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
      void: '1',
      updated_by: userId,
    }

    if (typeof line.id === 'number') {
      const { error } = await db
        .from('goods_issue_items')
        .update(itemPayload)
        .eq('id', line.id)

      if (error) throw error
    } else {
      const { error } = await db
        .from('goods_issue_items')
        .insert({ ...itemPayload, created_by: userId })

      if (error) throw error
    }
  }

  const staleLineVoid = db
    .from('goods_issue_items')
    .update({ void: '0', updated_by: userId })
    .eq('goods_issue_id', header.id)
    .eq('void', '1')

  const { error: deleteError } = issue.lines.length > 0
    ? await staleLineVoid.gt('line_no', issue.lines.length)
    : await staleLineVoid

  if (deleteError) throw deleteError

  if (shouldPostAfterLines) {
    const { error: postError } = await db
      .from('goods_issue')
      .update({ status: 'Posted', updated_by: userId })
      .eq('id', header.id)

    if (postError) throw postError
  }

  return getGoodsIssueById(header.id)
}

export async function createGoodsIssueNumber(prefix = 'GI') {
  const yearSuffix = String(new Date().getFullYear()).slice(-2)
  const documentPrefix = prefix.trim() || 'GI'

  const { data, error } = await db
    .from('goods_issue')
    .select('gi_no')
    .ilike('gi_no', `${documentPrefix}-${yearSuffix}-%`)
    .order('gi_no', { ascending: false })
    .limit(1)

  if (error) throw new Error(`Item stock out number could not be created. ${errorDetails(error)}`)

  const latestNo = data?.[0]?.gi_no ?? ''
  const latestSequence = Number(latestNo.match(/(\d+)$/)?.[1] ?? 0)
  const sequence = Number.isFinite(latestSequence) ? latestSequence + 1 : 1

  return `${documentPrefix}-${yearSuffix}-${String(sequence).padStart(6, '0')}`
}

export function getIssueItemSummary(issue: GoodsIssue) {
  const descriptions = issue.lines
    .filter(line => line.itemCode)
    .map(line => line.description || line.itemCode)

  if (descriptions.length === 0) return '-'
  if (descriptions.length === 1) return descriptions[0]
  return `${descriptions[0]} +${descriptions.length - 1} more`
}
