import { db } from '@/lib/Supabase/supabaseClient'

export type WarehouseReportWarehouse = {
  id: number
  code: string
  name: string
  type: string
  farmCode: string
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

export async function getWarehouseReportWarehouses(): Promise<WarehouseReportWarehouse[]> {
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
    .select('farm_code')
    .eq('users_id', user.id)
    .eq('void', 1)

  if (userFarmError) throw userFarmError

  const assignedFarmCodes = Array.from(new Set(
    (userFarmRows ?? []).map(row => String(row.farm_code ?? '').trim()).filter(Boolean),
  ))
  if (assignedFarmCodes.length === 0) return []

  const { data: farmRows, error: farmError } = await db
    .from('farms')
    .select('id, code')
    .in('code', assignedFarmCodes)

  if (farmError) throw farmError

  const farmCodeById = new Map(
    (farmRows ?? []).map(farm => [Number(farm.id), String(farm.code ?? '').trim()]),
  )
  const assignedFarmCodeSet = new Set(assignedFarmCodes.map(code => code.toUpperCase()))

  const { data, error } = await db
    .from('i_warehouse')
    .select('id, whse_code, whse_name, warehouse_type, farm_id, farm_code')
    .eq('is_active', true)
    .order('whse_code')

  if (error) throw error

  return (data ?? []).flatMap(row => {
    const code = String(row.whse_code ?? '').trim()
    const farmCode = String(row.farm_code ?? '').trim() || farmCodeById.get(Number(row.farm_id)) || ''
    if (!code || !assignedFarmCodeSet.has(farmCode.toUpperCase())) return []

    return [{
      id: Number(row.id),
      code,
      name: String(row.whse_name ?? ''),
      type: String(row.warehouse_type ?? ''),
      farmCode,
    }]
  })
}

export async function getWarehouseReport(filters: WarehouseReportFilters): Promise<WarehouseReportRow[]> {
  if (filters.warehouseCodes.length === 0) return []

  const allowedWarehouses = await getWarehouseReportWarehouses()
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
