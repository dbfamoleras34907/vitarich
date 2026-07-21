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
  const batchNumbers = Array.from(new Set(
    originRows
      .map(row => String(row.batch_no ?? '').trim())
      .filter(Boolean),
  ))
  const itemCodes = Array.from(new Set(
    originRows
      .map(row => String(row.item_code ?? '').trim())
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
    const onHandQty = Number(row.animal_qty ?? row.onhand_snapshot ?? 0)
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
