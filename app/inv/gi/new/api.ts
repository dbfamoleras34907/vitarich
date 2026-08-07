'use client'

import { db } from '@/lib/Supabase/supabaseClient'
import { calculateFlockAgeFromStartDate } from '@/app/brd/fc/age'
import { activeApprovedFarmsQuery } from '@/lib/data/repositories/farms'
import { Items, WarehouseData } from '@/lib/types'
import {
  AssociatedWarehouse,
  GoodsReceiptBatchRule,
  GoodsReceiptFarm,
  GoodsReceiptItemGroup,
  getAssignedFarmCodesByAuthId,
  UomConversionOption,
  UomGroupOption,
} from '@/app/inv/gr/new/api'

export type GoodsIssueReferences = {
  items: Items[]
  warehouses: WarehouseData[]
  farms: GoodsReceiptFarm[]
  uomGroups: UomGroupOption[]
  conversions: UomConversionOption[]
  itemGroups: GoodsReceiptItemGroup[]
  batchRules: GoodsReceiptBatchRule[]
}

export type GoodsIssueFlockCardInfo = {
  id: number
  cardNo: string
  farmId: number | null
  farmCode: string
  farmName: string
  buildingWarehouseId: number | null
  buildingCode: string
  buildingName: string
  age: number
  startDate: string
  broilerType: string
  breed: string
  flockCode: string
  cycleNumber: string
  animalQty: number
  bodyWeight: number | null
  status: string
}

export type GoodsIssuePlacementBatch = {
  id: string
  itemCode: string
  itemName: string
  batchNumber: string
  manufacturingDate: string
  expiryDate: string
  warehouseCode: string
  onHandQty: number
}

export type CleanupCycleSummary = {
  flockCardId: number
  buildingCode: string
  buildingName: string
  flockCard: string
  cycleCount: string
  age: number
  totalPlacement: number
  totalMortality: number
  totalDelivered: number
  totalCleaned: number
}

type CleanupSummaryCardRow = FlockCardInfoRow & {
  extra: Record<string, unknown> | null
}

type CleanupSummaryPostingRow = {
  source_doc_type: string | null
  item_code: string | null
  warehouse_code: string | null
  batch_number: string | null
  ref: string | null
  qty: number | null
  transfer_type: string | null
}

export async function getCleanupCycleSummaries(params: {
  farmId: number
  cleanupDocumentId: number | null
  buildings: Array<{ warehouseId: number | null; warehouseCode: string }>
}): Promise<CleanupCycleSummary[]> {
  const farmId = Number(params.farmId)
  if (!Number.isFinite(farmId) || farmId <= 0 || params.buildings.length === 0) return []

  const cardResult = await db
    .from('flock_card')
    .select('id, card_no, farm_id, farm_code, farm_name, building_whse_id, building_code, building_name, age, start_date, broiler_type, breed, flock_code, cycle_no, animal_qty, status, extra')
    .eq('farm_id', farmId)
    .eq('void', '1')
    .in('status', ['Saved', 'Closed'])
    .order('start_date', { ascending: false })
    .order('id', { ascending: false })

  if (cardResult.error) throwReferenceError('Clean up cycle summary', cardResult.error)
  const cards = (cardResult.data ?? []) as CleanupSummaryCardRow[]
  const documentId = Number(params.cleanupDocumentId ?? 0)

  const selectedCards = params.buildings.flatMap(building => {
    const matches = cards.filter(card =>
      (building.warehouseId && Number(card.building_whse_id) === Number(building.warehouseId)) ||
      String(card.building_code ?? '').trim().toUpperCase() === building.warehouseCode.trim().toUpperCase(),
    )
    const card = documentId > 0
      ? matches.find(candidate => Number(candidate.extra?.closed_by_docentry ?? 0) === documentId)
        ?? matches.find(candidate => candidate.status === 'Saved')
      : matches.find(candidate => candidate.status === 'Saved')
    return card ? [card] : []
  })

  const uniqueCards = Array.from(new Map(selectedCards.map(card => [card.id, card])).values())
  if (uniqueCards.length === 0) return []
  const getCardBuildingCode = (card: CleanupSummaryCardRow) =>
    params.buildings.find(building =>
      (building.warehouseId && Number(card.building_whse_id) === Number(building.warehouseId)) ||
      building.warehouseCode.trim().toUpperCase() === String(card.building_code ?? '').trim().toUpperCase(),
    )?.warehouseCode.trim() || String(card.building_code ?? '').trim()

  const originResult = await db
    .from('flock_card_origin')
    .select('fc_id, item_code, batch_no')
    .in('fc_id', uniqueCards.map(card => card.id))
    .eq('void', '1')

  if (originResult.error) throwReferenceError('Clean up placement batches', originResult.error)
  const origins = (originResult.data ?? []) as Array<{ fc_id: number; item_code: string | null; batch_no: string | null }>
  const warehouseCodes = Array.from(new Set(uniqueCards.map(getCardBuildingCode).filter(Boolean)))
  const itemCodes = Array.from(new Set(origins.map(origin => String(origin.item_code ?? '').trim()).filter(Boolean)))

  let postings: CleanupSummaryPostingRow[] = []
  if (warehouseCodes.length > 0 && itemCodes.length > 0) {
    const postingResult = await db
      .from('inventory_postings')
      .select('source_doc_type, item_code, warehouse_code, batch_number, ref, qty, transfer_type')
      .in('warehouse_code', warehouseCodes)
      .in('item_code', itemCodes)
      .in('source_doc_type', [
        'FLOCK_CARD_ORIGIN',
        'FLOCK_CARD_ORIGIN_VOID',
        'BRD_FC_MORT_THIN_USAGE',
        'BRD_FC_MORT_THIN_TRANSFER_OUT',
        'BRD_FC_MORT_THIN_REVERSAL',
        'BR_DELIVERY',
        'BR_CLEANUP',
      ])

    if (postingResult.error) throwReferenceError('Clean up inventory summary', postingResult.error)
    postings = (postingResult.data ?? []) as CleanupSummaryPostingRow[]
  }

  const signedQty = (posting: CleanupSummaryPostingRow) =>
    String(posting.transfer_type ?? '').toUpperCase() === 'OUT'
      ? -Number(posting.qty ?? 0)
      : Number(posting.qty ?? 0)

  return uniqueCards.map(card => {
    const cardOrigins = origins.filter(origin => Number(origin.fc_id) === Number(card.id))
    const originKeys = new Set(cardOrigins.map(origin =>
      `${String(origin.item_code ?? '').trim().toUpperCase()}|${String(origin.batch_no ?? '').trim().toUpperCase()}`,
    ))
    const buildingCode = getCardBuildingCode(card)
    const cardPostings = postings.filter(posting => {
      const key = `${String(posting.item_code ?? '').trim().toUpperCase()}|${String(posting.batch_number ?? posting.ref ?? '').trim().toUpperCase()}`
      return String(posting.warehouse_code ?? '').trim().toUpperCase() === buildingCode.toUpperCase() && originKeys.has(key)
    })
    const movementTotal = (types: string[]) => cardPostings
      .filter(posting => types.includes(String(posting.source_doc_type ?? '').toUpperCase()))
      .reduce((total, posting) => total + signedQty(posting), 0)
    const totalPlacement = Math.max(movementTotal(['FLOCK_CARD_ORIGIN', 'FLOCK_CARD_ORIGIN_VOID']), 0)
    const totalMortality = Math.max(-movementTotal([
      'BRD_FC_MORT_THIN_USAGE',
      'BRD_FC_MORT_THIN_TRANSFER_OUT',
      'BRD_FC_MORT_THIN_REVERSAL',
    ]), 0)
    const totalDelivered = Math.max(-movementTotal(['BR_DELIVERY']), 0)
    const postedCleaned = Math.max(-movementTotal(['BR_CLEANUP']), 0)
    const remainingAfterHarvest = Math.max(totalPlacement - totalMortality - totalDelivered, 0)

    return {
      flockCardId: Number(card.id),
      buildingCode,
      buildingName: String(card.building_name ?? '').trim(),
      flockCard: String(card.card_no ?? '').trim(),
      cycleCount: String(card.cycle_no ?? '').trim(),
      age: card.start_date ? calculateFlockAgeFromStartDate(card.start_date) : Number(card.age ?? 0),
      totalPlacement,
      totalMortality,
      totalDelivered,
      totalCleaned: postedCleaned > 0 ? postedCleaned : remainingAfterHarvest,
    }
  }).sort((left, right) =>
    (left.buildingName || left.buildingCode).localeCompare(right.buildingName || right.buildingCode, undefined, { numeric: true }),
  )
}

function throwReferenceError(label: string, error: unknown): never {
  const details = typeof error === 'object' && error !== null
    ? JSON.stringify(error)
    : String(error)

  throw new Error(`${label} could not be loaded. ${details}`)
}

type ConversionGroupRecord = {
  id: number
  code: string
  name: string
  base_uom: { code: string } | { code: string }[] | null
  conversions: Array<{
    base_qty: number
    void: string
    uom: { code: string } | { code: string }[] | null
  }> | null
}

const singleRelation = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] || null : value

const buildUomOptions = (data: unknown) => {
  const conversionGroups = (data ?? []) as ConversionGroupRecord[]

  const uomGroups = conversionGroups.flatMap(group => {
    const baseUom = singleRelation(group.base_uom)
    if (!baseUom) return []

    return [{
      id: group.id,
      code: group.code,
      name: group.name,
      baseUomCode: baseUom.code,
    }]
  })

  const conversions = conversionGroups
    .flatMap(group => {
      const baseUom = singleRelation(group.base_uom)
      if (!baseUom) return []

      const groupConversions = (group.conversions ?? []).flatMap(conversion => {
        const uom = singleRelation(conversion.uom)
        if (!uom) return []

        return [{
          groupId: group.id,
          groupCode: group.code,
          baseUomCode: baseUom.code,
          uomCode: uom.code,
          baseQty: Number(conversion.base_qty),
        }]
      })

      const includesBaseUom = groupConversions.some(
        conversion => conversion.uomCode.toUpperCase() === baseUom.code.toUpperCase(),
      )

      return includesBaseUom
        ? groupConversions
        : [
            ...groupConversions,
            {
              groupId: group.id,
              groupCode: group.code,
              baseUomCode: baseUom.code,
              uomCode: baseUom.code,
              baseQty: 1,
            },
          ]
    })

  return { uomGroups, conversions }
}

export function getAssociatedWarehouseCode(warehouse: AssociatedWarehouse | string) {
  if (typeof warehouse === 'string') return warehouse.trim()
  return String(warehouse.whse_code ?? '').trim()
}

export async function getGoodsIssueReferences(): Promise<GoodsIssueReferences> {
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError

  const authId = sessionData.session?.user.id
  const assignedFarmCodesQuery = getAssignedFarmCodesByAuthId(authId)

  const [itemsResult, warehousesResult, assignedFarmCodes, conversionGroupsResult, itemGroupsResult, batchRulesResult] = await Promise.all([
    db
      .from('items')
      .select('id, item_code, item_name, description, unit_measure, inventory_uom, item_group, manage_batch_numbers, batch_management_method, default_expiry_required, default_expiration_months')
      .eq('void', 1)
      .order('item_code'),
    db
      .from('i_warehouse')
      .select('id, whse_code, whse_name, warehouse_type, farm_id, farm_code')
      .eq('is_active', true)
      .order('whse_code'),
    assignedFarmCodesQuery,
    db
      .from('uom_groups')
      .select(`
        id,
        code,
        name,
        base_uom:uom_master_data!uom_groups_base_uom_id_fkey(code),
        conversions:uom_group_conversions!uom_group_conversions_uom_group_id_fkey(
          base_qty,
          void,
          uom:uom_master_data!uom_group_conversions_uom_id_fkey(code)
        )
      `)
      .eq('void', '1')
      .eq('conversions.void', '1')
      .order('code'),
    db
      .from('item_groups')
      .select('id, code, name')
      .eq('void', '1')
      .order('code'),
    db
      .from('batch_rules')
      .select('id, series_id, item_group_id, item_id, warehouse_id, branch_id, auto_generate, manual_entry, require_manufacturing_date, require_expiry_date, require_supplier_batch, active')
      .eq('void', '1')
      .eq('active', true),
  ])

  if (itemsResult.error) throwReferenceError('Items', itemsResult.error)
  if (warehousesResult.error) throwReferenceError('Warehouses', warehousesResult.error)
  if (conversionGroupsResult.error) throwReferenceError('UoM conversions', conversionGroupsResult.error)
  if (itemGroupsResult.error) throwReferenceError('Item groups', itemGroupsResult.error)
  if (batchRulesResult.error) throwReferenceError('Batch rules', batchRulesResult.error)

  const farmsResult = assignedFarmCodes.length
    ? await activeApprovedFarmsQuery(db.from('farms').select('id, code, name, associated_warehouses'))
        .in('code', assignedFarmCodes)
        .order('code')
    : { data: [], error: null }

  if (farmsResult.error) throwReferenceError('Farms', farmsResult.error)

  const { uomGroups, conversions } = buildUomOptions(conversionGroupsResult.data ?? [])

  return {
    items: (itemsResult.data ?? []) as Items[],
    warehouses: (warehousesResult.data ?? []) as WarehouseData[],
    farms: (farmsResult.data ?? []) as GoodsReceiptFarm[],
    uomGroups,
    conversions,
    itemGroups: (itemGroupsResult.data ?? []) as GoodsReceiptItemGroup[],
    batchRules: (batchRulesResult.data ?? []) as GoodsReceiptBatchRule[],
  }
}

type FlockCardInfoRow = {
  id: number
  card_no: string | null
  farm_id: number | null
  farm_code: string | null
  farm_name: string | null
  building_whse_id: number | null
  building_code: string | null
  building_name: string | null
  age: number | null
  start_date: string | null
  broiler_type: string | null
  breed: string | null
  flock_code: string | null
  cycle_no: string | null
  animal_qty: number | null
  status: string | null
}

type FlockCardBodyWeightLineRow = {
  body_wt: number | null
}

const toFlockCardInfo = (
  row: FlockCardInfoRow,
  bodyWeight: number | null,
): GoodsIssueFlockCardInfo => ({
  id: Number(row.id),
  cardNo: row.card_no ?? '',
  farmId: row.farm_id,
  farmCode: row.farm_code ?? '',
  farmName: row.farm_name ?? '',
  buildingWarehouseId: row.building_whse_id,
  buildingCode: row.building_code ?? '',
  buildingName: row.building_name ?? '',
  age: row.start_date ? calculateFlockAgeFromStartDate(row.start_date) : Number(row.age ?? 0),
  startDate: row.start_date ?? '',
  broilerType: row.broiler_type ?? '',
  breed: row.breed ?? '',
  flockCode: row.flock_code ?? '',
  cycleNumber: row.cycle_no ?? '',
  animalQty: Number(row.animal_qty ?? 0),
  bodyWeight,
  status: row.status ?? '',
})

async function getLatestFlockCardBodyWeight(row: FlockCardInfoRow) {
  const cardNo = String(row.card_no ?? '').trim()
  if (!cardNo) return null

  let headerQuery = db
    .from('brd_fc')
    .select('id')
    .eq('card_no', cardNo)
    .eq('void', '1')
    .order('id', { ascending: false })
    .limit(1)

  if (row.farm_id) headerQuery = headerQuery.eq('farm_id', row.farm_id)
  if (row.building_whse_id) headerQuery = headerQuery.eq('building_whse_id', row.building_whse_id)
  else if (row.building_code) headerQuery = headerQuery.eq('building_code', row.building_code)

  const headerResult = await headerQuery.maybeSingle()
  if (headerResult.error) throwReferenceError('Flock card body weight', headerResult.error)
  const headerId = Number(headerResult.data?.id ?? 0)
  if (!Number.isFinite(headerId) || headerId <= 0) return null

  const lineResult = await db
    .from('brd_fc_line')
    .select('body_wt')
    .eq('fc_id', headerId)
    .eq('void', '1')
    .not('body_wt', 'is', null)
    .order('age', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lineResult.error) throwReferenceError('Flock card body weight', lineResult.error)

  const line = lineResult.data as FlockCardBodyWeightLineRow | null
  const bodyWeight = Number(line?.body_wt ?? 0)
  return Number.isFinite(bodyWeight) && bodyWeight > 0 ? bodyWeight : null
}

async function toFlockCardInfoWithBodyWeight(row: FlockCardInfoRow) {
  return toFlockCardInfo(row, await getLatestFlockCardBodyWeight(row))
}

type FlockCardOriginBatchRow = {
  item_code: string | null
  item_name: string | null
  batch_no: string | null
  whse_code: string | null
  animal_qty: number | null
  onhand_snapshot: number | null
  mfg_date?: string | null
}

type ItemBatchDateRow = {
  item_code: string | null
  batch_number: string | null
  manufacturing_date: string | null
}

const getPlacementBatchId = (itemCode: string, batchNumber: string, warehouseCode: string) =>
  [
    itemCode.trim().toUpperCase(),
    batchNumber.trim().toUpperCase(),
    warehouseCode.trim().toUpperCase(),
  ].join('|')

export async function getDeliveryFlockCardInfo(params: {
  farmId: number | null
  buildingWarehouseId: number | null
  buildingCode: string
}): Promise<GoodsIssueFlockCardInfo | null> {
  const farmId = Number(params.farmId ?? 0)
  const buildingWarehouseId = Number(params.buildingWarehouseId ?? 0)
  const buildingCode = params.buildingCode.trim()

  if (!Number.isFinite(farmId) || farmId <= 0) return null
  if ((!Number.isFinite(buildingWarehouseId) || buildingWarehouseId <= 0) && !buildingCode) return null

  const selectFields = 'id, card_no, farm_id, farm_code, farm_name, building_whse_id, building_code, building_name, age, start_date, broiler_type, breed, flock_code, cycle_no, animal_qty, status'

  if (Number.isFinite(buildingWarehouseId) && buildingWarehouseId > 0) {
    const { data, error } = await db
      .from('flock_card')
      .select(selectFields)
      .eq('farm_id', farmId)
      .eq('building_whse_id', buildingWarehouseId)
      .eq('void', '1')
      .eq('status', 'Saved')
      .order('start_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throwReferenceError('Flock card information', error)
    if (data) return toFlockCardInfoWithBodyWeight(data as FlockCardInfoRow)
  }

  if (!buildingCode) return null

  const { data, error } = await db
    .from('flock_card')
    .select(selectFields)
    .eq('farm_id', farmId)
    .eq('building_code', buildingCode)
    .eq('void', '1')
    .eq('status', 'Saved')
    .order('start_date', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throwReferenceError('Flock card information', error)
  return data ? toFlockCardInfoWithBodyWeight(data as FlockCardInfoRow) : null
}

export async function getBrDeliveryAgeShortage(params: {
  farmId: number
  lines: Array<{
    fromWarehouseId: number | null
    fromWarehouseCode: string
  }>
}) {
  const farmId = Number(params.farmId)
  if (!Number.isFinite(farmId) || farmId <= 0) return null

  const { data: settings, error: settingsError } = await db
    .from('brd_dr_settings')
    .select('target_delivery_age')
    .eq('farm_id', farmId)
    .eq('void', '1')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (settingsError) throwReferenceError('BR Delivery settings', settingsError)

  const targetAge = Number(settings?.target_delivery_age ?? 0)
  if (!Number.isFinite(targetAge) || targetAge <= 0) return null

  const uniqueBuildings = Array.from(new Map(
    params.lines.map(line => [
      `${line.fromWarehouseId ?? ''}|${line.fromWarehouseCode.trim().toUpperCase()}`,
      line,
    ]),
  ).values())

  for (const building of uniqueBuildings) {
    const flock = await getDeliveryFlockCardInfo({
      farmId,
      buildingWarehouseId: building.fromWarehouseId,
      buildingCode: building.fromWarehouseCode,
    })

    if (!flock || flock.age < targetAge) {
      return {
        targetAge,
        currentAge: flock?.age ?? null,
        buildingName: flock?.buildingName || building.fromWarehouseCode,
        hasFlockCard: Boolean(flock),
      }
    }
  }

  return null
}

export async function getBrCleanupAgeShortage(params: {
  farmId: number
  lines: Array<{
    fromWarehouseId: number | null
    fromWarehouseCode: string
  }>
}) {
  const farmId = Number(params.farmId)
  if (!Number.isFinite(farmId) || farmId <= 0) return null

  const { data: settings, error: settingsError } = await db
    .from('brd_cu_settings')
    .select('target_cleanup_age')
    .eq('farm_id', farmId)
    .eq('void', '1')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (settingsError) throwReferenceError('Clean up settings', settingsError)

  const targetAge = Number(settings?.target_cleanup_age ?? 0)
  if (!Number.isFinite(targetAge) || targetAge <= 0) return null

  const uniqueBuildings = Array.from(new Map(
    params.lines.map(line => [
      `${line.fromWarehouseId ?? ''}|${line.fromWarehouseCode.trim().toUpperCase()}`,
      line,
    ]),
  ).values())

  for (const building of uniqueBuildings) {
    const flock = await getDeliveryFlockCardInfo({
      farmId,
      buildingWarehouseId: building.fromWarehouseId,
      buildingCode: building.fromWarehouseCode,
    })

    if (!flock || flock.age < targetAge) {
      return {
        targetAge,
        currentAge: flock?.age ?? null,
        buildingName: flock?.buildingName || building.fromWarehouseCode,
        hasFlockCard: Boolean(flock),
      }
    }
  }

  return null
}

export async function getAvailableDeliveryFlockCards(params: {
  farmId: number
  targetAge: number
}): Promise<GoodsIssueFlockCardInfo[]> {
  const farmId = Number(params.farmId)
  const targetAge = Math.max(0, Number(params.targetAge) || 0)
  if (!Number.isFinite(farmId) || farmId <= 0) return []

  const { data, error } = await db
    .from('flock_card')
    .select('id, card_no, farm_id, farm_code, farm_name, building_whse_id, building_code, building_name, age, start_date, broiler_type, breed, flock_code, cycle_no, animal_qty, status')
    .eq('farm_id', farmId)
    .eq('void', '1')
    .eq('status', 'Saved')
    .order('start_date', { ascending: false })
    .order('id', { ascending: false })

  if (error) throwReferenceError('Available delivery flock cards', error)

  const latestByBuilding = new Map<string, FlockCardInfoRow>()
  ;((data ?? []) as FlockCardInfoRow[]).forEach(row => {
    const buildingKey = row.building_whse_id
      ? `id:${row.building_whse_id}`
      : `code:${String(row.building_code ?? '').trim().toUpperCase()}`
    if (buildingKey !== 'code:' && !latestByBuilding.has(buildingKey)) {
      latestByBuilding.set(buildingKey, row)
    }
  })

  const eligibleCards = (await Promise.all(
    Array.from(latestByBuilding.values()).map(row => toFlockCardInfoWithBodyWeight(row)),
  )).filter(card => card.age >= targetAge)

  const cardsWithAvailableBatches = await Promise.all(
    eligibleCards.map(async card => {
      const batches = await getDeliveryFlockCardPlacementBatches({
        flockCardId: card.id,
        buildingCode: card.buildingCode,
      })
      return batches.some(batch => batch.onHandQty > 0) ? card : null
    }),
  )

  return cardsWithAvailableBatches
    .filter((card): card is GoodsIssueFlockCardInfo => Boolean(card))
    .sort((left, right) =>
      (left.buildingName || left.buildingCode).localeCompare(
        right.buildingName || right.buildingCode,
        undefined,
        { numeric: true, sensitivity: 'base' },
      ),
    )
}

export async function getDeliveryFlockCardPlacementBatches(params: {
  flockCardId: number | null
  buildingCode: string
}): Promise<GoodsIssuePlacementBatch[]> {
  const flockCardId = Number(params.flockCardId ?? 0)
  const destinationWarehouseCode = params.buildingCode.trim()
  if (!Number.isFinite(flockCardId) || flockCardId <= 0) return []

  const { data, error } = await db
    .from('flock_card_origin')
    .select('item_code, item_name, batch_no, whse_code, animal_qty, onhand_snapshot, mfg_date')
    .eq('fc_id', flockCardId)
    .eq('void', '1')
    .order('line_no', { ascending: true })

  if (error) throwReferenceError('Flock card placement', error)

  const originRows = (data ?? []) as FlockCardOriginBatchRow[]
  const itemCodes = Array.from(new Set(
    originRows
      .map(row => String(row.item_code ?? '').trim())
      .filter(Boolean),
  ))
  const liveQtyByBatch = new Map<string, number>()

  if (destinationWarehouseCode && itemCodes.length > 0) {
    const postingResult = await db
      .from('inventory_postings')
      .select('item_code, warehouse_code, qty, transfer_type, batch_number, ref')
      .eq('warehouse_code', destinationWarehouseCode)
      .in('item_code', itemCodes)

    if (postingResult.error) throwReferenceError('Delivery batch inventory', postingResult.error)

    ;(postingResult.data ?? []).forEach(row => {
      const itemCode = String(row.item_code ?? '').trim().toUpperCase()
      const batchNumber = String(row.batch_number ?? row.ref ?? '').trim().toUpperCase()
      if (!itemCode || !batchNumber) return

      const quantity = Number(row.qty ?? 0)
      const signedQuantity = String(row.transfer_type ?? '').toUpperCase() === 'OUT'
        ? -quantity
        : quantity
      const key = `${itemCode}|${batchNumber}`
      liveQtyByBatch.set(key, (liveQtyByBatch.get(key) ?? 0) + signedQuantity)
    })
  }

  const batchNumbers = Array.from(new Set(
    originRows
      .map(row => String(row.batch_no ?? '').trim())
      .filter(Boolean),
  ))
  const batchDateByKey = new Map<string, ItemBatchDateRow>()

  if (batchNumbers.length > 0 && itemCodes.length > 0) {
    const batchResult = await db
      .from('item_batches')
      .select('item_code, batch_number, manufacturing_date')
      .eq('void', '1')
      .in('batch_number', batchNumbers)

    if (batchResult.error) throwReferenceError('Batch manufacturing dates', batchResult.error)

    ;((batchResult.data ?? []) as ItemBatchDateRow[]).forEach(row => {
      const itemCode = String(row.item_code ?? '').trim().toUpperCase()
      const batchNumber = String(row.batch_number ?? '').trim().toUpperCase()
      if (itemCode && batchNumber) batchDateByKey.set(`${itemCode}|${batchNumber}`, row)
      if (batchNumber && !batchDateByKey.has(batchNumber)) batchDateByKey.set(batchNumber, row)
    })
  }

  return originRows.flatMap(row => {
    const itemCode = String(row.item_code ?? '').trim()
    const batchNumber = String(row.batch_no ?? '').trim()
    const sourceWarehouseCode = String(row.whse_code ?? '').trim()
    const warehouseCode = destinationWarehouseCode || sourceWarehouseCode
    const onHandQty = liveQtyByBatch.get(
      `${itemCode.toUpperCase()}|${batchNumber.toUpperCase()}`,
    ) ?? 0
    if (!itemCode || !batchNumber || !warehouseCode) return []
    const batchDate =
      batchDateByKey.get(`${itemCode.toUpperCase()}|${batchNumber.toUpperCase()}`) ??
      batchDateByKey.get(batchNumber.toUpperCase())

    return [{
      id: getPlacementBatchId(itemCode, batchNumber, warehouseCode),
      itemCode,
      itemName: String(row.item_name ?? '').trim(),
      batchNumber,
      manufacturingDate: row.mfg_date ?? batchDate?.manufacturing_date ?? '',
      expiryDate: '',
      warehouseCode,
      onHandQty,
    }]
  })
}
