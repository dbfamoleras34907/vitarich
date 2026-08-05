import { db } from '@/lib/Supabase/supabaseClient'
import { Items, WarehouseData } from '@/lib/types'
import { activeApprovedFarmsQuery } from '@/lib/data/repositories/farms'

export type AssociatedWarehouse = {
  id?: number | null
  whse_code?: string | null
  whse_name?: string | null
  is_default_receiving?: boolean | null
  is_default_receiving_warehouse?: boolean | null
  is_default_disposal?: boolean | null
  is_default_disposal_warehouse?: boolean | null
}

export type GoodsReceiptOpenFlockBuilding = {
  flockCardId: number
  farmId: number
  warehouseId: number
  warehouseCode: string
  warehouseName: string
  cardNo: string
  flockCode: string
  cycleAge: number
}

export type GoodsReceiptFarm = {
  id: number
  code: string
  name: string | null
  farm_type?: string | null
  associated_warehouses: AssociatedWarehouse[] | string[] | null
}

export type GoodsReceiptBatchRule = {
  id: number
  series_id: number | null
  item_group_id: number | null
  item_id: number | null
  warehouse_id: number | null
  branch_id: number | null
  auto_generate: boolean
  manual_entry: boolean
  require_manufacturing_date: boolean
  require_expiry_date: boolean
  require_supplier_batch: boolean
  active: boolean
}

export type GoodsReceiptBatchSeries = {
  id: number
  code: string
  name: string
  prefix: string | null
  suffix: string | null
  separator: string
  next_number: number
  number_length: number
  date_format: 'NONE' | 'YYYYMMDD' | 'YYMMDD' | 'YYYYMM' | 'YYMM' | 'YYYY' | 'YY'
  include_expiry_date: boolean | null
  active: boolean
}

export type GoodsReceiptItemGroup = {
  id: number
  code: string
  name: string
}

export type GoodsReceiptExistingBatch = {
  id: number
  item_id: number | null
  item_code: string
  batch_number: string
  manufacturing_date: string
  expiry_date: string
}

export type UomGroupOption = {
  id: number
  code: string
  name: string
  baseUomCode: string
}

export type UomConversionOption = {
  groupId: number
  groupCode: string
  baseUomCode: string
  uomCode: string
  baseQty: number
}

export type GoodsReceiptPrefetchReferences = {
  farms: GoodsReceiptFarm[]
  openFlockBuildings: GoodsReceiptOpenFlockBuilding[]
  uomGroups: UomGroupOption[]
  conversions: UomConversionOption[]
  itemGroups: GoodsReceiptItemGroup[]
  batchRules: GoodsReceiptBatchRule[]
  batchSeries: GoodsReceiptBatchSeries[]
}

type OpenFlockCardRow = {
  id: number
  farm_id: number
  building_whse_id: number | null
  building_code: string | null
  building_name: string | null
  card_no: string | null
  flock_code: string | null
  start_date: string | null
}

const calculateCycleAge = (startDate: string | null) => {
  if (!startDate) return 0
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Number.isNaN(start.getTime())
    ? 0
    : Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000))
}

const buildOpenFlockBuildings = (
  rows: OpenFlockCardRow[],
  warehouses: WarehouseData[],
): GoodsReceiptOpenFlockBuilding[] => {
  const warehouseById = new Map(
    warehouses.flatMap(warehouse =>
      typeof warehouse.id === 'number' ? [[warehouse.id, warehouse] as const] : []
    ),
  )

  const seenWarehouseIds = new Set<number>()

  return rows.flatMap(card => {
    const warehouseId = Number(card.building_whse_id ?? 0)
    const warehouse = warehouseById.get(warehouseId)
    if (!warehouseId || !warehouse || seenWarehouseIds.has(warehouseId)) return []
    seenWarehouseIds.add(warehouseId)

    return [{
      flockCardId: Number(card.id),
      farmId: Number(card.farm_id),
      warehouseId,
      warehouseCode: String(warehouse.whse_code ?? card.building_code ?? '').trim(),
      warehouseName: String(warehouse.whse_name ?? card.building_name ?? '').trim(),
      cardNo: String(card.card_no ?? '').trim(),
      flockCode: String(card.flock_code ?? '').trim(),
      cycleAge: calculateCycleAge(card.start_date),
    }]
  })
}

const singleRelation = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] || null : value

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

export async function getAssignedFarmCodesByAuthId(authId?: string) {
  if (!authId) return []

  const { data: user, error: userError } = await db
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .maybeSingle()

  if (userError) throw userError
  if (!user?.id) return []

  const { data: userFarms, error: userFarmsError } = await db
    .from('users_farms')
    .select('farm_code')
    .eq('users_id', user.id)
    .eq('void', 1)

  if (userFarmsError) throw userFarmsError

  return (userFarms ?? [])
    .map((row) => String(row.farm_code ?? '').trim())
    .filter(Boolean)
}

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

const getAuthenticatedAssignedFarmCodes = async () => {
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError

  return getAssignedFarmCodesByAuthId(sessionData.session?.user.id)
}

const getActiveFarmsByCodes = async (farmCodes: string[]) => {
  if (!farmCodes.length) return []

  const { data, error } = await activeApprovedFarmsQuery(db.from('farms').select('*'))
    .in('code', farmCodes)
    .order('code')

  if (error) throw error

  return (data ?? []) as GoodsReceiptFarm[]
}

export async function getGoodsReceiptReferences() {
  const assignedFarmCodesQuery = getAuthenticatedAssignedFarmCodes()

  const [itemsResult, warehousesResult, assignedFarmCodes, conversionGroupsResult, itemGroupsResult, batchRulesResult, batchSeriesResult, openFlockCardsResult] = await Promise.all([
    db
      .from('items')
      .select('id, item_code, item_name, description, unit_measure, inventory_uom, item_group, fms_group, manage_batch_numbers, batch_management_method, default_expiry_required, default_expiration_months')
      .eq('void', 1)
      .order('item_code'),
    db
      .from('i_warehouse')
      .select('*')
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
    db
      .from('batch_number_series')
      .select('id, code, name, prefix, suffix, separator, next_number, number_length, date_format, include_expiry_date, active')
      .eq('void', '1')
      .eq('active', true),
    db
      .from('flock_card')
      .select('id, farm_id, building_whse_id, building_code, building_name, card_no, flock_code, start_date')
      .eq('void', '1')
      .eq('status', 'Saved')
      .order('start_date', { ascending: false })
      .order('id', { ascending: false }),
  ])

  if (itemsResult.error) throw itemsResult.error
  if (warehousesResult.error) throw warehousesResult.error
  if (conversionGroupsResult.error) throw conversionGroupsResult.error
  if (itemGroupsResult.error) throw itemGroupsResult.error
  if (batchRulesResult.error) throw batchRulesResult.error
  if (batchSeriesResult.error) throw batchSeriesResult.error
  if (openFlockCardsResult.error) throw openFlockCardsResult.error

  const { uomGroups, conversions } = buildUomOptions(conversionGroupsResult.data ?? [])
  const warehouseRows = (warehousesResult.data ?? []) as WarehouseData[]

  return {
    items: (itemsResult.data ?? []) as Items[],
    warehouses: warehouseRows,
    farms: await getActiveFarmsByCodes(assignedFarmCodes),
    openFlockBuildings: buildOpenFlockBuildings(
      (openFlockCardsResult.data ?? []) as OpenFlockCardRow[],
      warehouseRows,
    ),
    uomGroups,
    conversions,
    itemGroups: (itemGroupsResult.data ?? []) as GoodsReceiptItemGroup[],
    batchRules: (batchRulesResult.data ?? []) as GoodsReceiptBatchRule[],
    batchSeries: (batchSeriesResult.data ?? []) as GoodsReceiptBatchSeries[],
  }
}

export async function getGoodsReceiptPrefetchReferences(): Promise<GoodsReceiptPrefetchReferences> {
  const assignedFarmCodesQuery = getAuthenticatedAssignedFarmCodes()

  const [assignedFarmCodes, conversionGroupsResult, itemGroupsResult, batchRulesResult, batchSeriesResult, warehousesResult, openFlockCardsResult] = await Promise.all([
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
    db
      .from('batch_number_series')
      .select('id, code, name, prefix, suffix, separator, next_number, number_length, date_format, include_expiry_date, active')
      .eq('void', '1')
      .eq('active', true),
    db
      .from('i_warehouse')
      .select('*')
      .eq('is_active', true)
      .order('whse_code'),
    db
      .from('flock_card')
      .select('id, farm_id, building_whse_id, building_code, building_name, card_no, flock_code, start_date')
      .eq('void', '1')
      .eq('status', 'Saved')
      .order('start_date', { ascending: false })
      .order('id', { ascending: false }),
  ])

  if (conversionGroupsResult.error) throw conversionGroupsResult.error
  if (itemGroupsResult.error) throw itemGroupsResult.error
  if (batchRulesResult.error) throw batchRulesResult.error
  if (batchSeriesResult.error) throw batchSeriesResult.error
  if (warehousesResult.error) throw warehousesResult.error
  if (openFlockCardsResult.error) throw openFlockCardsResult.error

  const { uomGroups, conversions } = buildUomOptions(conversionGroupsResult.data ?? [])
  const warehouseRows = (warehousesResult.data ?? []) as WarehouseData[]

  return {
    farms: await getActiveFarmsByCodes(assignedFarmCodes),
    openFlockBuildings: buildOpenFlockBuildings(
      (openFlockCardsResult.data ?? []) as OpenFlockCardRow[],
      warehouseRows,
    ),
    uomGroups,
    conversions,
    itemGroups: (itemGroupsResult.data ?? []) as GoodsReceiptItemGroup[],
    batchRules: (batchRulesResult.data ?? []) as GoodsReceiptBatchRule[],
    batchSeries: (batchSeriesResult.data ?? []) as GoodsReceiptBatchSeries[],
  }
}

type ExistingBatchLookupMode = 'single' | 'first'

export async function findExistingItemBatch(
  itemCode: string,
  manufacturingDate: string,
  expiryDate: string,
  mode: ExistingBatchLookupMode = 'single',
): Promise<GoodsReceiptExistingBatch | null> {
  if (!itemCode || !manufacturingDate) return null

  let query = db
    .from('item_batches')
    .select('id, item_id, item_code, batch_number, manufacturing_date, expiry_date')
    .eq('item_code', itemCode)
    .eq('manufacturing_date', manufacturingDate)
    .eq('void', '1')

  query = expiryDate ? query.eq('expiry_date', expiryDate) : query.is('expiry_date', null)

  if (mode === 'first') {
    const { data, error } = await query
      .order('id', { ascending: true })
      .limit(1)

    if (error) throw error
    return (data?.[0] ?? null) as GoodsReceiptExistingBatch | null
  }

  const { data, error } = await query.maybeSingle()

  if (error) throw error
  return data as GoodsReceiptExistingBatch | null
}
