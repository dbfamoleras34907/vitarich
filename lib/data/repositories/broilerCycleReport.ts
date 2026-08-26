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
}

export type CycleMovementRecord = {
  id: number
  documentNo: string
  date: string
  status: string
  remarks: string
  itemCode: string
  itemName: string
  batchNumber: string
  quantity: number
  uom: string
  varianceQuantity: number
  lineRemarks: string
  isVoided: boolean
}

export type BroilerCycleBuilding = {
  flockCardId: number
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
) {
  const headerWarehouseId = numberValue(header.from_warehouse_id)
  const cardWarehouseId = numberValue(card.building_whse_id)
  const headerWarehouseCode = normalized(header.from_warehouse_code)
  const cardWarehouseCode = normalized(card.building_code)
  const warehouseMatches = cardWarehouseId > 0
    ? headerWarehouseId === cardWarehouseId
    : Boolean(cardWarehouseCode) && headerWarehouseCode === cardWarehouseCode
  const itemBatchKey = `${normalized(line.item_code)}|${normalized(line.batch_number)}`
  return warehouseMatches && originKeys.has(itemBatchKey)
}

export async function getBroilerCycleReport(cycleId: number): Promise<BroilerCycleReport | null> {
  if (!Number.isFinite(cycleId) || cycleId <= 0) return null

  const cycleResult = await db
    .from('doc_farm_cycles')
    .select('id, farm_id, cycle_no, status, created_at, closed_at')
    .eq('id', cycleId)
    .maybeSingle()
  if (cycleResult.error) throwQueryError(cycleResult.error, 'Unable to load the farm cycle')
  if (!cycleResult.data) return null

  const cycle = cycleResult.data as UnknownRow
  const farmId = numberValue(cycle.farm_id)
  const [farmResult, cardResult] = await Promise.all([
    db.from('farms').select('id, code, name').eq('id', farmId).maybeSingle(),
    db
      .from('flock_card')
      .select('id, card_no, flock_code, building_whse_id, building_code, building_name, start_date, breed, animal_qty, status, remarks, void')
      .eq('farm_cycle_id', cycleId)
      .order('building_name')
      .order('start_date'),
  ])
  if (farmResult.error) throwQueryError(farmResult.error, 'Unable to load the cycle farm')
  if (cardResult.error) throwQueryError(cardResult.error, 'Unable to load participating Buildings')

  const cards = (cardResult.data ?? []) as UnknownRow[]
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
  const growingHeaders = (growingHeaderResult.data ?? []) as UnknownRow[]
  const receiptIds = Array.from(new Set(placements.map(row => numberValue(row.goods_reciept_id)).filter(Boolean)))
  const growingIds = growingHeaders.map(row => numberValue(row.id)).filter(Boolean)

  const [receiptHeaderResult, receiptItemResult, growingLineResult] = await Promise.all([
    receiptIds.length
      ? db.from('goods_receipt').select('id, gr_no, vendor, status').in('id', receiptIds)
      : Promise.resolve({ data: [], error: null }),
    receiptIds.length
      ? db.from('goods_receipt_items').select('goods_reciept_id, doc_line_no, item_code, description, batch_number, void').in('goods_reciept_id', receiptIds)
      : Promise.resolve({ data: [], error: null }),
    growingIds.length
      ? db
        .from('brd_fc_line')
        .select('id, fc_id, age, mort_am, mort_pm, mort_total, thin_am, thin_pm, row_total, cum_total, feed_kg, feed_guideline, feed_batch_text, water_l, water_bird, body_wt, body_guideline, extra, void')
        .in('fc_id', growingIds)
        .order('age')
      : Promise.resolve({ data: [], error: null }),
  ])
  if (receiptHeaderResult.error) throwQueryError(receiptHeaderResult.error, 'Unable to load DOC Placement headers')
  if (receiptItemResult.error) throwQueryError(receiptItemResult.error, 'Unable to load DOC Placement items')
  if (growingLineResult.error) throwQueryError(growingLineResult.error, 'Unable to load Growing lines')

  const receiptHeaders = (receiptHeaderResult.data ?? []) as UnknownRow[]
  const receiptItems = (receiptItemResult.data ?? []) as UnknownRow[]
  const growingLines = (growingLineResult.data ?? []) as UnknownRow[]
  const warehouseIds = Array.from(new Set(cards.map(card => numberValue(card.building_whse_id)).filter(Boolean)))

  const [deliveryHeaderResult, cleanupHeaderResult] = await Promise.all([
    warehouseIds.length
      ? db.from('br_delivery').select('id, gi_no, issue_date, from_warehouse_id, from_warehouse_code, status, remarks').eq('farm_id', farmId).in('from_warehouse_id', warehouseIds)
      : Promise.resolve({ data: [], error: null }),
    warehouseIds.length
      ? db.from('br_cleanup').select('id, gi_no, issue_date, from_warehouse_id, from_warehouse_code, status, remarks').eq('farm_id', farmId).in('from_warehouse_id', warehouseIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (deliveryHeaderResult.error) throwQueryError(deliveryHeaderResult.error, 'Unable to load Harvest & Delivery headers')
  if (cleanupHeaderResult.error) throwQueryError(cleanupHeaderResult.error, 'Unable to load Clean Up headers')

  const deliveryHeaders = (deliveryHeaderResult.data ?? []) as UnknownRow[]
  const cleanupHeaders = (cleanupHeaderResult.data ?? []) as UnknownRow[]
  const deliveryIds = deliveryHeaders.map(row => numberValue(row.id)).filter(Boolean)
  const cleanupIds = cleanupHeaders.map(row => numberValue(row.id)).filter(Boolean)
  const [deliveryLineResult, cleanupLineResult] = await Promise.all([
    deliveryIds.length
      ? db.from('br_delivery_lines').select('id, br_delivery_id, item_code, description, batch_number, alt_qty, alt_uom, void').in('br_delivery_id', deliveryIds)
      : Promise.resolve({ data: [], error: null }),
    cleanupIds.length
      ? db.from('br_cleanup_lines').select('id, br_cleanup_id, item_code, description, batch_number, alt_qty, alt_uom, variance_qty, remarks, void').in('br_cleanup_id', cleanupIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (deliveryLineResult.error) throwQueryError(deliveryLineResult.error, 'Unable to load Harvest & Delivery lines')
  if (cleanupLineResult.error) throwQueryError(cleanupLineResult.error, 'Unable to load Clean Up lines')

  const deliveryLines = (deliveryLineResult.data ?? []) as UnknownRow[]
  const cleanupLines = (cleanupLineResult.data ?? []) as UnknownRow[]
  const farm = (farmResult.data ?? {}) as UnknownRow

  const buildings = cards.map(card => {
    const flockCardId = numberValue(card.id)
    const cardNo = textValue(card.card_no)
    const cardOrigins = origins.filter(row => numberValue(row.fc_id) === flockCardId)
    const originKeys = new Set(cardOrigins.map(row => `${normalized(row.item_code)}|${normalized(row.batch_no)}`))
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

    const toMovementRecords = (headers: UnknownRow[], lines: UnknownRow[], foreignKey: string, cleanup = false) =>
      headers.flatMap(header => lines
        .filter(line => numberValue(line[foreignKey]) === numberValue(header.id))
        .filter(line => movementMatchesCard(header, line, card, originKeys))
        .map(line => ({
          id: numberValue(line.id),
          documentNo: textValue(header.gi_no),
          date: textValue(header.issue_date),
          status: textValue(header.status),
          remarks: textValue(header.remarks),
          itemCode: textValue(line.item_code),
          itemName: textValue(line.description),
          batchNumber: textValue(line.batch_number),
          quantity: numberValue(line.alt_qty),
          uom: textValue(line.alt_uom),
          varianceQuantity: cleanup ? numberValue(line.variance_qty) : 0,
          lineRemarks: textValue(line.remarks),
          isVoided: textValue(line.void) !== '1' || textValue(header.status) === 'Cancelled',
        })))

    return {
      flockCardId,
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
            feedType: textValue(extra.feedTypeName ?? extra.feedTypeCode ?? extra.feedTypeId),
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
