import { db } from '@/lib/Supabase/supabaseClient'

export type BroilerCycleStage = 'placement' | 'growing' | 'delivery' | 'cleanup'

export type CyclePlacementRecord = {
  id: number
  documentId: number
  documentNo: string
  status: string
  vendor: string
  receiveDate: string
  receiveTime: string
  productionDate: string
  hatcheryReference: string
  itemCode: string
  itemName: string
  batchNumber: string
  quantityReceived: number
  actualReceived: number
  shortCount: number
  doaQuantity: number
  rejectCount: number
  isVoided: boolean
}

export type CycleGrowingLine = {
  id: number
  age: number
  mortalityAm: number
  mortalityPm: number
  mortalityTotal: number
  thinningAm: number
  thinningPm: number
  thinningTotal: number
  docBatch: string
  cumulative: number
  feedActual: number
  feedType: string
  feedStandard: number
  feedBatch: string
  waterLiters: number
  waterPerBird: number
  waterGuideline: number
  actualWeight: number
  standardWeight: number
  actualAdg: number
  standardAdg: number
  isVoided: boolean
  hasMortality: boolean
  hasFeed: boolean
  hasWater: boolean
  hasWeight: boolean
}

export type CycleMovementRecord = {
  id: number
  documentId: number
  documentNo: string
  date: string
  status: string
  remarks: string
  itemCode: string
  itemName: string
  batchNumber: string
  quantity: number
  uom: string
  baseQuantity: number
  baseUom: string
  varianceQuantity: number
  lineRemarks: string
  isVoided: boolean
}

export type BroilerCycleBuilding = {
  flockCardId: number
  cycleLabel: string
  cardNo: string
  flockCode: string
  buildingWarehouseId: number | null
  buildingCode: string
  buildingName: string
  startDate: string
  breed: string
  startingPopulation: number
  status: string
  remarks: string
  isVoided: boolean
  placements: CyclePlacementRecord[]
  growingNumber: string
  growingStatus: string
  growingLines: CycleGrowingLine[]
  deliveries: CycleMovementRecord[]
  cleanups: CycleMovementRecord[]
}

export type BroilerCycleReport = {
  id: number
  cycleNumber: number
  status: string
  farmId: number
  farmCode: string
  farmName: string
  createdAt: string
  closedAt: string
  buildings: BroilerCycleBuilding[]
}

type UnknownRow = Record<string, unknown>

const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const textValue = (value: unknown) => String(value ?? '').trim()
const normalized = (value: unknown) => textValue(value).toUpperCase()

export type BroilerCycleReportOptions = {
  postedOnly?: boolean
  openBuildingsOnly?: boolean
}

function throwQueryError(error: unknown, context: string): never {
  if (error instanceof Error) throw new Error(`${context}: ${error.message}`)
  const row = error && typeof error === 'object' ? error as UnknownRow : {}
  throw new Error(`${context}: ${textValue(row.message) || 'Unknown database error'}`)
}

function movementMatchesCard(
  header: UnknownRow,
  line: UnknownRow,
  card: UnknownRow,
  originKeys: Set<string>,
  consolidatedBatchNumber: string,
) {
  const lineWarehouseId = numberValue(line.from_warehouse_id)
  const headerWarehouseId = numberValue(header.from_warehouse_id)
  const cardWarehouseId = numberValue(card.building_whse_id)
  const movementWarehouseId = lineWarehouseId || headerWarehouseId
  const lineWarehouseCode = normalized(line.from_warehouse_code)
  const headerWarehouseCode = normalized(header.from_warehouse_code)
  const cardWarehouseCode = normalized(card.building_code)
  const movementWarehouseCode = lineWarehouseCode || headerWarehouseCode
  const warehouseMatches = cardWarehouseId > 0 && movementWarehouseId > 0
    ? movementWarehouseId === cardWarehouseId
    : Boolean(cardWarehouseCode) && movementWarehouseCode === cardWarehouseCode
  const lineBatchNumber = normalized(line.batch_number)
  const itemBatchKey = `${normalized(line.item_code)}|${lineBatchNumber}`
  const batchMatches = originKeys.has(itemBatchKey)
    || Boolean(consolidatedBatchNumber && lineBatchNumber === consolidatedBatchNumber)
  return warehouseMatches && batchMatches
}

export async function getBroilerCycleReport(
  cycleId: number,
  options: BroilerCycleReportOptions = {},
): Promise<BroilerCycleReport | null> {
  if (!Number.isFinite(cycleId) || cycleId <= 0) return null

  const cycleResult = await db
    .from('doc_farm_cycles')
    .select('id, farm_id, cycle_no, status, created_at, closed_at')
    .eq('id', cycleId)
    .maybeSingle()
  if (cycleResult.error) throwQueryError(cycleResult.error, 'Unable to load the farm cycle')
  if (!cycleResult.data) return null

  const cycle = cycleResult.data as UnknownRow
  return loadBroilerCycleReport(cycleId, cycle, options)
}

async function loadCycleGrowingLines(growingIds: number[]): Promise<UnknownRow[]> {
  const rows: UnknownRow[] = []
  for (let offset = 0; growingIds.length; offset += 500) {
    const result = await db.from('brd_fc_line')
      .select('id, fc_id, age, mort_am, mort_pm, mort_total, thin_am, thin_pm, row_total, cum_total, feed_kg, feed_guideline, feed_batch_text, water_l, water_bird, body_wt, body_guideline, extra, void')
      .in('fc_id', growingIds).order('age').order('id').range(offset, offset + 499)
    if (result.error) throwQueryError(result.error, 'Unable to load Growing lines')
    rows.push(...(result.data ?? []) as UnknownRow[])
    if ((result.data?.length ?? 0) < 500) break
  }
  return rows
}

/** Read both Broiler movement types without silently truncating farm history. */
async function loadCycleMovements(farmId: number, stage: 'delivery' | 'cleanup', postedOnly: boolean) {
  const cleanup = stage === 'cleanup'
  const label = cleanup ? 'Clean Up' : 'Harvest & Delivery'
  const headers: UnknownRow[] = []
  const lines: UnknownRow[] = []
  for (let offset = 0; ; offset += 500) {
    let query = db.from(cleanup ? 'br_cleanup' : 'br_delivery')
      .select('id, gi_no, issue_date, from_warehouse_id, from_warehouse_code, status, remarks')
      .eq('farm_id', farmId).order('id').range(offset, offset + 499)
    if (postedOnly) query = query.eq('status', 'Posted')
    const result = await query
    if (result.error) throwQueryError(result.error, `Unable to load ${label} headers`)
    headers.push(...(result.data ?? []) as UnknownRow[])
    if ((result.data?.length ?? 0) < 500) break
  }
  // Bound the ID list as well as the response size for farms with long histories.
  for (let index = 0; index < headers.length; index += 100) {
    const ids = headers.slice(index, index + 100).map(header => numberValue(header.id))
    for (let offset = 0; ; offset += 500) {
      const result = cleanup
        ? await db.from('br_cleanup_lines')
          .select('id, br_cleanup_id, item_code, description, batch_number, alt_qty, alt_uom, base_qty, base_uom, variance_qty, remarks, from_warehouse_id, from_warehouse_code, void')
          .in('br_cleanup_id', ids).order('id').range(offset, offset + 499)
        : await db.from('br_delivery_lines')
          .select('id, br_delivery_id, delivered_date, item_code, description, batch_number, alt_qty, alt_uom, base_qty, base_uom, from_warehouse_id, from_warehouse_code, void')
          .in('br_delivery_id', ids).order('id').range(offset, offset + 499)
      if (result.error) throwQueryError(result.error, `Unable to load ${label} lines`)
      lines.push(...(result.data ?? []) as UnknownRow[])
      if ((result.data?.length ?? 0) < 500) break
    }
  }
  return { headers, lines }
}

/** Excluded Buildings own an open placement cycle without doc_farm_cycles. */
export async function getBroilerOpenBuildingCycleReport(farmId: number, flockCardId: number) {
  return getBroilerBuildingCycleReport(farmId, flockCardId, { openBuildingsOnly: true })
}

export async function getBroilerBuildingCycleReport(
  farmId: number, flockCardId: number, options: { openBuildingsOnly?: boolean } = {},
) {
  if (!Number.isInteger(farmId) || farmId <= 0 || !Number.isInteger(flockCardId) || flockCardId <= 0) return null
  const report = await loadBroilerCycleReport(0, { farm_id: farmId, status: 'Saved' },
    { postedOnly: true, openBuildingsOnly: options.openBuildingsOnly }, flockCardId)
  if (report.buildings.length) report.status = report.buildings[0].status
  return report.buildings.length ? report : null
}

async function loadBroilerCycleReport(
  cycleId: number, cycle: UnknownRow, options: BroilerCycleReportOptions, standaloneCardId?: number,
): Promise<BroilerCycleReport> {
  const farmId = numberValue(cycle.farm_id)
  let cardQuery = db.from('flock_card')
    .select('id, card_no, flock_code, building_whse_id, building_code, building_name, cycle_no, start_date, breed, animal_qty, status, remarks, void')
  if (options.postedOnly || standaloneCardId) cardQuery = cardQuery.eq('farm_id', farmId)
  cardQuery = standaloneCardId
    ? cardQuery.eq('id', standaloneCardId).is('farm_cycle_id', null)
    : cardQuery.eq('farm_cycle_id', cycleId)
  const [farmResult, cardResult] = await Promise.all([
    db.from('farms').select('id, code, name').eq('id', farmId).maybeSingle(),
    cardQuery.order('building_name').order('start_date'),
  ])
  if (farmResult.error) throwQueryError(farmResult.error, 'Unable to load the cycle farm')
  if (cardResult.error) throwQueryError(cardResult.error, 'Unable to load participating Buildings')

  const cards = ((cardResult.data ?? []) as UnknownRow[]).filter(card =>
    !options.openBuildingsOnly || (textValue(card.void) === '1' && card.status === 'Saved'))
  const cardIds = cards.map(card => numberValue(card.id)).filter(Boolean)
  if (cardIds.length === 0) {
    const farm = (farmResult.data ?? {}) as UnknownRow
    return {
      id: cycleId,
      cycleNumber: numberValue(cycle.cycle_no),
      status: textValue(cycle.status),
      farmId,
      farmCode: textValue(farm.code),
      farmName: textValue(farm.name),
      createdAt: textValue(cycle.created_at),
      closedAt: textValue(cycle.closed_at),
      buildings: [],
    }
  }

  const [originResult, placementResult, growingHeaderResult] = await Promise.all([
    db
      .from('flock_card_origin')
      .select('id, fc_id, item_code, item_name, batch_no, animal_qty, void')
      .in('fc_id', cardIds),
    db
      .from('goods_receipt_doc')
      .select('id, goods_reciept_id, line_no, flock_card_id, receive_date, receive_time, mnf_date, transfer_slip, quantity_received, actual_received, short_count, doa_quantity, reject_count, void')
      .in('flock_card_id', cardIds)
      .order('receive_date'),
    db
      .from('brd_fc')
      .select('id, fc_no, card_no, status, void')
      .in('card_no', cards.map(card => textValue(card.card_no)).filter(Boolean))
      .order('id', { ascending: false }),
  ])
  if (originResult.error) throwQueryError(originResult.error, 'Unable to load placement batches')
  if (placementResult.error) throwQueryError(placementResult.error, 'Unable to load DOC Placement records')
  if (growingHeaderResult.error) throwQueryError(growingHeaderResult.error, 'Unable to load Growing records')

  const origins = (originResult.data ?? []) as UnknownRow[]
  const placements = (placementResult.data ?? []) as UnknownRow[]
  // Growing saves commit daily measurements and inventory in one RPC. Its
  // header may remain Draft; it has no separate document Post operation.
  const growingHeaders = ((growingHeaderResult.data ?? []) as UnknownRow[]).filter(row =>
    !options.postedOnly || (textValue(row.void) === '1' && row.status !== 'Cancelled'))
  const receiptIds = Array.from(new Set(placements.map(row => numberValue(row.goods_reciept_id)).filter(Boolean)))
  const growingIds = growingHeaders.map(row => numberValue(row.id)).filter(Boolean)

  const [receiptHeaderResult, receiptItemResult, growingLines, deliveryData, cleanupData] = await Promise.all([
    receiptIds.length
      ? db.from('goods_receipt').select('id, gr_no, vendor, status').in('id', receiptIds)
      : Promise.resolve({ data: [], error: null }),
    receiptIds.length
      ? db.from('goods_receipt_items').select('goods_reciept_id, doc_line_no, item_code, description, batch_number, void').in('goods_reciept_id', receiptIds)
      : Promise.resolve({ data: [], error: null }),
    loadCycleGrowingLines(growingIds),
    loadCycleMovements(farmId, 'delivery', options.postedOnly === true),
    loadCycleMovements(farmId, 'cleanup', options.postedOnly === true),
  ])
  if (receiptHeaderResult.error) throwQueryError(receiptHeaderResult.error, 'Unable to load DOC Placement headers')
  if (receiptItemResult.error) throwQueryError(receiptItemResult.error, 'Unable to load DOC Placement items')

  const receiptHeaders = (receiptHeaderResult.data ?? []) as UnknownRow[]
  const receiptItems = (receiptItemResult.data ?? []) as UnknownRow[]
  const { headers: deliveryHeaders, lines: deliveryLines } = deliveryData
  const { headers: cleanupHeaders, lines: cleanupLines } = cleanupData
  const farm = (farmResult.data ?? {}) as UnknownRow

  const buildings = cards.map(card => {
    const flockCardId = numberValue(card.id)
    const cardNo = textValue(card.card_no)
    const cardOrigins = origins.filter(row => numberValue(row.fc_id) === flockCardId)
    const originKeys = new Set(cardOrigins.map(row => `${normalized(row.item_code)}|${normalized(row.batch_no)}`))
    const buildingWarehouseId = numberValue(card.building_whse_id)
    const buildingCycleNumber = textValue(card.cycle_no) || textValue(cycle.cycle_no)
    const consolidatedBatchNumber = farmId > 0 && buildingWarehouseId > 0 && buildingCycleNumber
      ? normalized(`DOC:F${farmId}:B${buildingWarehouseId}:${buildingCycleNumber}`)
      : ''
    const activeGrowingHeader = growingHeaders.find(row => textValue(row.card_no) === cardNo && textValue(row.void) === '1')
      ?? growingHeaders.find(row => textValue(row.card_no) === cardNo)
    const growingId = numberValue(activeGrowingHeader?.id)

    const placementRecords = placements
      .filter(row => numberValue(row.flock_card_id) === flockCardId)
      .flatMap(row => {
        const header = receiptHeaders.find(item => numberValue(item.id) === numberValue(row.goods_reciept_id)) ?? {}
        const items = receiptItems.filter(item =>
          numberValue(item.goods_reciept_id) === numberValue(row.goods_reciept_id)
          && numberValue(item.doc_line_no) === numberValue(row.line_no))
        const matchedItems = items.length ? items : [{}]
        return matchedItems.map(item => ({
          id: numberValue(row.id),
          documentId: numberValue(row.goods_reciept_id),
          documentNo: textValue(header.gr_no),
          status: textValue(header.status),
          vendor: textValue(header.vendor),
          receiveDate: textValue(row.receive_date),
          receiveTime: textValue(row.receive_time),
          productionDate: textValue(row.mnf_date),
          hatcheryReference: textValue(row.transfer_slip),
          itemCode: textValue(item.item_code),
          itemName: textValue(item.description),
          batchNumber: textValue(item.batch_number),
          quantityReceived: numberValue(row.quantity_received),
          actualReceived: numberValue(row.actual_received),
          shortCount: numberValue(row.short_count),
          doaQuantity: numberValue(row.doa_quantity),
          rejectCount: numberValue(row.reject_count),
          isVoided: textValue(row.void) !== '1' || textValue(header.status) === 'Cancelled' || textValue(item.void) === '0',
        }))
      })
      .filter(row => !options.postedOnly || (!row.isVoided && row.status === 'Posted'))

    const toMovementRecords = (headers: UnknownRow[], lines: UnknownRow[], foreignKey: string, cleanup = false) =>
      headers.flatMap(header => lines
        .filter(line => numberValue(line[foreignKey]) === numberValue(header.id))
        .filter(line => movementMatchesCard(header, line, card, originKeys, consolidatedBatchNumber))
        .map(line => ({
          id: numberValue(line.id),
          documentId: numberValue(header.id),
          documentNo: textValue(header.gi_no),
          date: textValue(cleanup ? header.issue_date : line.delivered_date ?? header.issue_date),
          status: textValue(header.status),
          remarks: textValue(header.remarks),
          itemCode: textValue(line.item_code),
          itemName: textValue(line.description),
          batchNumber: textValue(line.batch_number),
          quantity: numberValue(line.alt_qty),
          uom: textValue(line.alt_uom),
          baseQuantity: numberValue(line.base_qty),
          baseUom: textValue(line.base_uom),
          varianceQuantity: cleanup ? numberValue(line.variance_qty) : 0,
          lineRemarks: textValue(line.remarks),
          isVoided: textValue(line.void) !== '1' || textValue(header.status) === 'Cancelled',
        })))
        .filter(row => !options.postedOnly || !row.isVoided)

    return {
      flockCardId,
      cycleLabel: textValue(card.cycle_no) || textValue(cycle.cycle_no),
      cardNo,
      flockCode: textValue(card.flock_code),
      buildingWarehouseId: numberValue(card.building_whse_id) || null,
      buildingCode: textValue(card.building_code),
      buildingName: textValue(card.building_name),
      startDate: textValue(card.start_date),
      breed: textValue(card.breed),
      startingPopulation: cardOrigins
        .filter(row => textValue(row.void) === '1')
        .reduce((sum, row) => sum + numberValue(row.animal_qty), 0) || numberValue(card.animal_qty),
      status: textValue(card.status),
      remarks: textValue(card.remarks),
      isVoided: textValue(card.void) !== '1' || textValue(card.status) === 'Cancelled',
      placements: placementRecords,
      growingNumber: textValue(activeGrowingHeader?.fc_no),
      growingStatus: textValue(activeGrowingHeader?.status),
      growingLines: growingLines
        .filter(row => numberValue(row.fc_id) === growingId)
        .filter(row => !options.postedOnly || textValue(row.void) === '1')
        .map(row => {
          const extra = row.extra && typeof row.extra === 'object' ? row.extra as UnknownRow : {}
          return {
            id: numberValue(row.id),
            age: numberValue(row.age),
            mortalityAm: numberValue(row.mort_am),
            mortalityPm: numberValue(row.mort_pm),
            mortalityTotal: numberValue(row.mort_total),
            thinningAm: numberValue(row.thin_am),
            thinningPm: numberValue(row.thin_pm),
            thinningTotal: numberValue(row.row_total),
            docBatch: cardOrigins.map(origin => textValue(origin.batch_no)).filter(Boolean).join(', '),
            cumulative: numberValue(row.cum_total),
            feedActual: numberValue(row.feed_kg),
            feedType: textValue(extra.feedItemName ?? extra.feedItemCode ?? extra.feedTypeName ?? extra.feedTypeCode ?? extra.feedTypeId),
            feedStandard: numberValue(row.feed_guideline),
            feedBatch: textValue(row.feed_batch_text),
            waterLiters: numberValue(row.water_l),
            waterPerBird: numberValue(row.water_bird),
            waterGuideline: numberValue(extra.waterGuideline),
            actualWeight: numberValue(row.body_wt),
            standardWeight: numberValue(row.body_guideline),
            actualAdg: numberValue(extra.actualAdg ?? extra.addAlw),
            standardAdg: numberValue(extra.standardAdg),
            isVoided: textValue(row.void) !== '1',
            hasMortality: [row.mort_am, row.mort_pm, row.mort_total, row.thin_am, row.thin_pm].some(value => value != null),
            hasFeed: row.feed_kg != null,
            hasWater: row.water_l != null,
            hasWeight: row.body_wt != null,
          }
        }),
      deliveries: toMovementRecords(deliveryHeaders, deliveryLines, 'br_delivery_id'),
      cleanups: toMovementRecords(cleanupHeaders, cleanupLines, 'br_cleanup_id', true),
    }
  })

  return {
    id: cycleId,
    cycleNumber: numberValue(cycle.cycle_no),
    status: textValue(cycle.status),
    farmId,
    farmCode: textValue(farm.code),
    farmName: textValue(farm.name),
    createdAt: textValue(cycle.created_at),
    closedAt: textValue(cycle.closed_at),
    buildings,
  }
}
