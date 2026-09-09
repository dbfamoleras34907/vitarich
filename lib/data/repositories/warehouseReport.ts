import { db } from '@/lib/Supabase/supabaseClient'
import { activeApprovedFarmsQuery } from '@/lib/data/repositories/farms'

export type WarehouseReportFarm = {
  id: number
  code: string
  name: string
}

export type WarehouseReportWarehouse = {
  id: number
  code: string
  name: string
  type: string
  farmCode: string
}

type AssignedWarehouseReportFarm = WarehouseReportFarm & {
  associatedWarehouses: unknown
}

type AssociatedWarehouseReference = {
  id: number | null
  code: string
  order: number
}

export type WarehouseReportRow = {
  id: number
  createdAt: string
  sourceDocType: string
  sourceDocEntry: number
  documentNo: string
  documentUrl: string
  reference: string
  itemCode: string
  itemName: string
  warehouseCode: string
  warehouseName: string
  batchNumber: string
  transferType: string
  inQty: number
  outQty: number
  beginningBalance: number
  runningBalance: number
}

export type WarehouseReportFilters = {
  farmId: number
  warehouseCodes: string[]
  from: string
  to: string
  separateByBatch: boolean
}

type PostingRow = {
  id: number
  source_doc_type: string | null
  source_docentry: number | null
  item_code: string | null
  warehouse_code: string | null
  qty: number | null
  transfer_type: string | null
  batch_number: string | null
  ref: string | null
  ref2: string | null
  created_at: string | null
}

type DocumentConfig = {
  table: string
  numberColumn: string
  url: (id: number) => string
}

const DOCUMENT_CONFIG: Record<string, DocumentConfig> = {
  GOODS_RECEIPT: { table: 'goods_receipt', numberColumn: 'gr_no', url: id => `/inv/gr/post?id=${id}` },
  GOODS_ISSUE: { table: 'goods_issue', numberColumn: 'gi_no', url: id => `/inv/gi/post?id=${id}` },
  INVENTORY_TRANSFER: { table: 'inventory_transfer', numberColumn: 'it_no', url: id => `/inv/it/post?id=${id}` },
  BR_DELIVERY: { table: 'br_delivery', numberColumn: 'gi_no', url: id => `/brd/dr/post?id=${id}` },
  BR_CLEANUP: { table: 'br_cleanup', numberColumn: 'gi_no', url: id => `/brd/cu/post?id=${id}` },
  BR_CLEANUP_VARIANCE: { table: 'br_cleanup', numberColumn: 'gi_no', url: id => `/brd/cu/post?id=${id}` },
}

const PAGE_SIZE = 1000

function nextDayIso(value: string) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return date.toISOString()
}

function signedQty(row: PostingRow) {
  const quantity = Math.abs(Number(row.qty ?? 0))
  return String(row.transfer_type ?? '').toUpperCase() === 'OUT' ? -quantity : quantity
}

function batchReference(row: PostingRow) {
  return [row.batch_number, row.ref, row.ref2]
    .map(value => String(value ?? '').trim())
    .find(Boolean) ?? ''
}

function balanceKey(row: PostingRow, separateByBatch: boolean) {
  return [
    String(row.warehouse_code ?? '').trim().toUpperCase(),
    String(row.item_code ?? '').trim().toUpperCase(),
    separateByBatch ? batchReference(row).toUpperCase() : '',
  ].join('|')
}

async function getAllPostings(warehouseCodes: string[], to: string) {
  const rows: PostingRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db
      .from('inventory_postings')
      .select('id, source_doc_type, source_docentry, item_code, warehouse_code, qty, transfer_type, batch_number, ref, ref2, created_at')
      .in('warehouse_code', warehouseCodes)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (to) query = query.lt('created_at', nextDayIso(to))

    const { data, error } = await query
    if (error) throw error

    const page = (data ?? []) as PostingRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
}

async function getDocumentLabels(postings: PostingRow[]) {
  const labels = new Map<string, string>()

  await Promise.all(Object.entries(DOCUMENT_CONFIG).map(async ([type, config]) => {
    const ids = Array.from(new Set(
      postings
        .filter(row => String(row.source_doc_type ?? '').toUpperCase() === type)
        .map(row => Number(row.source_docentry ?? 0))
        .filter(id => id > 0),
    ))
    if (ids.length === 0) return

    const { data, error } = await db
      .from(config.table)
      .select(`id, ${config.numberColumn}`)
      .in('id', ids)

    if (error) {
      console.warn(`Unable to resolve ${type} document numbers:`, error.message)
      return
    }

    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      labels.set(`${type}|${row.id}`, String(row[config.numberColumn] ?? ''))
    }
  }))

  return labels
}

function getAssociatedWarehouseReferences(value: unknown): AssociatedWarehouseReference[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry, order) => {
    if (typeof entry === 'string') {
      const code = entry.trim()
      return code ? [{ id: null, code, order }] : []
    }

    if (!entry || typeof entry !== 'object') return []

    const record = entry as Record<string, unknown>
    const id = Number(record.id ?? 0)
    const code = String(record.whse_code ?? '').trim()
    if ((!Number.isInteger(id) || id <= 0) && !code) return []

    return [{
      id: Number.isInteger(id) && id > 0 ? id : null,
      code,
      order,
    }]
  })
}

async function getAssignedWarehouseReportFarms(): Promise<AssignedWarehouseReportFarm[]> {
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError

  const authId = sessionData.session?.user.id
  if (!authId) return []

  const { data: user, error: userError } = await db
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .maybeSingle()

  if (userError) throw userError
  if (!user?.id) return []

  const { data: userFarmRows, error: userFarmError } = await db
    .from('users_farms')
    .select('farm_id, farm_code')
    .eq('users_id', user.id)
    .eq('void', 1)

  if (userFarmError) throw userFarmError

  const assignedFarmIds = Array.from(new Set(
    (userFarmRows ?? [])
      .map(row => Number(row.farm_id ?? 0))
      .filter(id => Number.isInteger(id) && id > 0),
  ))
  const legacyFarmCodes = Array.from(new Set(
    (userFarmRows ?? [])
      .filter(row => !Number.isInteger(Number(row.farm_id)) || Number(row.farm_id) <= 0)
      .map(row => String(row.farm_code ?? '').trim())
      .filter(Boolean),
  ))
  if (assignedFarmIds.length === 0 && legacyFarmCodes.length === 0) return []

  const [assignedFarmsResult, legacyFarmsResult] = await Promise.all([
    assignedFarmIds.length
      ? activeApprovedFarmsQuery(db.from('farms').select('id, code, name, associated_warehouses')).in('id', assignedFarmIds)
      : Promise.resolve({ data: [], error: null }),
    legacyFarmCodes.length
      ? activeApprovedFarmsQuery(db.from('farms').select('id, code, name, associated_warehouses')).in('code', legacyFarmCodes)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (assignedFarmsResult.error) throw assignedFarmsResult.error
  if (legacyFarmsResult.error) throw legacyFarmsResult.error

  const farmRows = Array.from(new Map(
    [...(assignedFarmsResult.data ?? []), ...(legacyFarmsResult.data ?? [])]
      .map(farm => [Number(farm.id), farm]),
  ).values()).sort((left, right) => String(left.name ?? '').localeCompare(String(right.name ?? '')))

  return farmRows.flatMap(farm => {
    const id = Number(farm.id)
    const code = String(farm.code ?? '').trim()
    if (!Number.isInteger(id) || id <= 0 || !code) return []

    return [{
      id,
      code,
      name: String(farm.name ?? code),
      associatedWarehouses: farm.associated_warehouses,
    }]
  })
}

export async function getWarehouseReportFarms(): Promise<WarehouseReportFarm[]> {
  return (await getAssignedWarehouseReportFarms()).map(({ id, code, name }) => ({ id, code, name }))
}

export async function getWarehouseReportWarehouses(farmId: number): Promise<WarehouseReportWarehouse[]> {
  if (!Number.isInteger(farmId) || farmId <= 0) return []

  const assignedFarms = await getAssignedWarehouseReportFarms()
  const farm = assignedFarms.find(row => row.id === farmId)
  if (!farm) return []

  const references = getAssociatedWarehouseReferences(farm.associatedWarehouses)
  if (references.length === 0) return []

  const warehouseIds = Array.from(new Set(
    references.map(reference => reference.id).filter((id): id is number => id != null),
  ))
  const warehouseCodes = Array.from(new Set(
    references.map(reference => reference.code).filter(Boolean),
  ))

  const [byIdResult, byCodeResult] = await Promise.all([
    warehouseIds.length
      ? db
          .from('i_warehouse')
          .select('id, whse_code, whse_name, warehouse_type, farm_id, farm_code')
          .eq('is_active', true)
          .in('id', warehouseIds)
      : Promise.resolve({ data: [], error: null }),
    warehouseCodes.length
      ? db
          .from('i_warehouse')
          .select('id, whse_code, whse_name, warehouse_type, farm_id, farm_code')
          .eq('is_active', true)
          .in('whse_code', warehouseCodes)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (byIdResult.error) throw byIdResult.error
  if (byCodeResult.error) throw byCodeResult.error

  const warehouseRows = Array.from(new Map(
    [...(byIdResult.data ?? []), ...(byCodeResult.data ?? [])]
      .map(row => [Number(row.id), row]),
  ).values())
  const referenceOrder = new Map<string, number>()
  for (const reference of references) {
    if (reference.id != null) referenceOrder.set(`id:${reference.id}`, reference.order)
    if (reference.code) referenceOrder.set(`code:${reference.code.toUpperCase()}`, reference.order)
  }

  return warehouseRows.flatMap(row => {
    const code = String(row.whse_code ?? '').trim()
    const id = Number(row.id)
    const isAssociated = referenceOrder.has(`id:${id}`) || referenceOrder.has(`code:${code.toUpperCase()}`)
    if (!code || !isAssociated) return []

    return [{
      id,
      code,
      name: String(row.whse_name ?? ''),
      type: String(row.warehouse_type ?? ''),
      farmCode: farm.code,
    }]
  }).sort((left, right) => {
    const leftOrder = referenceOrder.get(`id:${left.id}`) ?? referenceOrder.get(`code:${left.code.toUpperCase()}`) ?? Number.MAX_SAFE_INTEGER
    const rightOrder = referenceOrder.get(`id:${right.id}`) ?? referenceOrder.get(`code:${right.code.toUpperCase()}`) ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
  })
}

export async function getWarehouseReport(filters: WarehouseReportFilters): Promise<WarehouseReportRow[]> {
  if (!Number.isInteger(filters.farmId) || filters.farmId <= 0 || filters.warehouseCodes.length === 0) return []

  const allowedWarehouses = await getWarehouseReportWarehouses(filters.farmId)
  const allowedCodeSet = new Set(allowedWarehouses.map(warehouse => warehouse.code.toUpperCase()))
  const warehouseCodes = filters.warehouseCodes.filter(code => allowedCodeSet.has(code.toUpperCase()))
  if (warehouseCodes.length === 0) return []

  const postings = await getAllPostings(warehouseCodes, filters.to)
  const fromTimestamp = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY
  const openingByKey = new Map<string, number>()

  for (const posting of postings) {
    const timestamp = new Date(String(posting.created_at ?? '')).getTime()
    if (timestamp >= fromTimestamp) continue
    const key = balanceKey(posting, filters.separateByBatch)
    openingByKey.set(key, (openingByKey.get(key) ?? 0) + signedQty(posting))
  }

  const periodPostings = postings.filter(posting => {
    const timestamp = new Date(String(posting.created_at ?? '')).getTime()
    return timestamp >= fromTimestamp
  })

  const itemCodes = Array.from(new Set(periodPostings.map(row => String(row.item_code ?? '').trim()).filter(Boolean)))
  const [{ data: itemRows, error: itemError }, { data: warehouseRows, error: warehouseError }, documentLabels] =
    await Promise.all([
      itemCodes.length
        ? db.from('items').select('item_code, item_name, description').in('item_code', itemCodes)
        : Promise.resolve({ data: [], error: null }),
      db.from('i_warehouse').select('whse_code, whse_name').in('whse_code', warehouseCodes),
      getDocumentLabels(periodPostings),
    ])

  if (itemError) throw itemError
  if (warehouseError) throw warehouseError

  const itemNames = new Map((itemRows ?? []).map(row => [
    String(row.item_code ?? '').toUpperCase(),
    String(row.item_name ?? row.description ?? ''),
  ]))
  const warehouseNames = new Map((warehouseRows ?? []).map(row => [
    String(row.whse_code ?? '').toUpperCase(),
    String(row.whse_name ?? ''),
  ]))
  const runningByKey = new Map(openingByKey)

  return periodPostings.map(posting => {
    const key = balanceKey(posting, filters.separateByBatch)
    const beginningBalance = openingByKey.get(key) ?? 0
    const movement = signedQty(posting)
    const runningBalance = (runningByKey.get(key) ?? 0) + movement
    runningByKey.set(key, runningBalance)

    const sourceDocType = String(posting.source_doc_type ?? '')
    const normalizedDocType = sourceDocType.toUpperCase()
    const sourceDocEntry = Number(posting.source_docentry ?? 0)
    const config = DOCUMENT_CONFIG[normalizedDocType]
    const documentNo = documentLabels.get(`${normalizedDocType}|${sourceDocEntry}`)
      || `${sourceDocType || 'Document'} #${sourceDocEntry || '-'}`
    const type = String(posting.transfer_type ?? '').toUpperCase()
    const quantity = Math.abs(Number(posting.qty ?? 0))

    return {
      id: posting.id,
      createdAt: String(posting.created_at ?? ''),
      sourceDocType,
      sourceDocEntry,
      documentNo,
      documentUrl: config && sourceDocEntry > 0 ? config.url(sourceDocEntry) : '',
      reference: [posting.ref, posting.ref2].map(value => String(value ?? '').trim()).filter(Boolean).join(' / '),
      itemCode: String(posting.item_code ?? ''),
      itemName: itemNames.get(String(posting.item_code ?? '').toUpperCase()) ?? '',
      warehouseCode: String(posting.warehouse_code ?? ''),
      warehouseName: warehouseNames.get(String(posting.warehouse_code ?? '').toUpperCase()) ?? '',
      batchNumber: filters.separateByBatch ? batchReference(posting) : '',
      transferType: type,
      inQty: type === 'OUT' ? 0 : quantity,
      outQty: type === 'OUT' ? quantity : 0,
      beginningBalance,
      runningBalance,
    }
  })
}
