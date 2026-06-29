import { db } from '@/lib/Supabase/supabaseClient'
import { Items, WarehouseData } from '@/lib/types'

export type AssociatedWarehouse = {
  id?: number | null
  whse_code?: string | null
  whse_name?: string | null
}

export type GoodsReceiptFarm = {
  id: number
  code: string
  name: string | null
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
  uomGroups: UomGroupOption[]
  conversions: UomConversionOption[]
  itemGroups: GoodsReceiptItemGroup[]
  batchRules: GoodsReceiptBatchRule[]
  batchSeries: GoodsReceiptBatchSeries[]
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

export async function getGoodsReceiptReferences() {
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError

  const authId = sessionData.session?.user.id

  const userFarmsQuery = authId
    ? db.from('vw_users_with_farms').select('users_farms').eq('auth_id', authId).maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const [itemsResult, warehousesResult, userFarmsResult, conversionGroupsResult, itemGroupsResult, batchRulesResult, batchSeriesResult] = await Promise.all([
    db
      .from('items')
      .select('id, item_code, item_name, description, unit_measure, inventory_uom, item_group, manage_batch_numbers, batch_management_method, default_expiry_required, default_expiration_months')
      .eq('void', 1)
      .order('item_code'),
    db
      .from('i_warehouse')
      .select('id, whse_code, whse_name')
      .eq('is_active', true)
      .order('whse_code'),
    userFarmsQuery,
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
      .select('id, code, name, prefix, suffix, separator, next_number, number_length, date_format, active')
      .eq('void', '1')
      .eq('active', true),
  ])

  if (itemsResult.error) throw itemsResult.error
  if (warehousesResult.error) throw warehousesResult.error
  if (userFarmsResult.error) throw userFarmsResult.error
  if (conversionGroupsResult.error) throw conversionGroupsResult.error
  if (itemGroupsResult.error) throw itemGroupsResult.error
  if (batchRulesResult.error) throw batchRulesResult.error
  if (batchSeriesResult.error) throw batchSeriesResult.error

  const assignedFarmCodes = Array.isArray(userFarmsResult.data?.users_farms)
    ? userFarmsResult.data.users_farms
        .map((code: unknown) => String(code ?? '').trim())
        .filter(Boolean)
    : []

  const farmsResult = assignedFarmCodes.length
    ? await db
        .from('farms')
        .select('id, code, name, associated_warehouses')
        .eq('void', 1)
        .in('code', assignedFarmCodes)
        .order('code')
    : { data: [], error: null }

  if (farmsResult.error) throw farmsResult.error

  const { uomGroups, conversions } = buildUomOptions(conversionGroupsResult.data ?? [])

  return {
    items: (itemsResult.data ?? []) as Items[],
    warehouses: (warehousesResult.data ?? []) as WarehouseData[],
    farms: (farmsResult.data ?? []) as GoodsReceiptFarm[],
    uomGroups,
    conversions,
    itemGroups: (itemGroupsResult.data ?? []) as GoodsReceiptItemGroup[],
    batchRules: (batchRulesResult.data ?? []) as GoodsReceiptBatchRule[],
    batchSeries: (batchSeriesResult.data ?? []) as GoodsReceiptBatchSeries[],
  }
}

export async function getGoodsReceiptPrefetchReferences(): Promise<GoodsReceiptPrefetchReferences> {
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError

  const authId = sessionData.session?.user.id
  const userFarmsQuery = authId
    ? db.from('vw_users_with_farms').select('users_farms').eq('auth_id', authId).maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const [userFarmsResult, conversionGroupsResult, itemGroupsResult, batchRulesResult, batchSeriesResult] = await Promise.all([
    userFarmsQuery,
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
      .select('id, code, name, prefix, suffix, separator, next_number, number_length, date_format, active')
      .eq('void', '1')
      .eq('active', true),
  ])

  if (userFarmsResult.error) throw userFarmsResult.error
  if (conversionGroupsResult.error) throw conversionGroupsResult.error
  if (itemGroupsResult.error) throw itemGroupsResult.error
  if (batchRulesResult.error) throw batchRulesResult.error
  if (batchSeriesResult.error) throw batchSeriesResult.error

  const assignedFarmCodes = Array.isArray(userFarmsResult.data?.users_farms)
    ? userFarmsResult.data.users_farms
        .map((code: unknown) => String(code ?? '').trim())
        .filter(Boolean)
    : []

  const farmsResult = assignedFarmCodes.length
    ? await db
        .from('farms')
        .select('id, code, name, associated_warehouses')
        .eq('void', 1)
        .in('code', assignedFarmCodes)
        .order('code')
    : { data: [], error: null }

  if (farmsResult.error) throw farmsResult.error

  const { uomGroups, conversions } = buildUomOptions(conversionGroupsResult.data ?? [])

  return {
    farms: (farmsResult.data ?? []) as GoodsReceiptFarm[],
    uomGroups,
    conversions,
    itemGroups: (itemGroupsResult.data ?? []) as GoodsReceiptItemGroup[],
    batchRules: (batchRulesResult.data ?? []) as GoodsReceiptBatchRule[],
    batchSeries: (batchSeriesResult.data ?? []) as GoodsReceiptBatchSeries[],
  }
}

export async function findExistingItemBatch(
  itemCode: string,
  manufacturingDate: string,
  expiryDate: string,
): Promise<GoodsReceiptExistingBatch | null> {
  if (!itemCode || !manufacturingDate || !expiryDate) return null

  const { data, error } = await db
    .from('item_batches')
    .select('id, item_id, item_code, batch_number, manufacturing_date, expiry_date')
    .eq('item_code', itemCode)
    .eq('manufacturing_date', manufacturingDate)
    .eq('expiry_date', expiryDate)
    .eq('void', '1')
    .maybeSingle()

  if (error) throw error
  return data as GoodsReceiptExistingBatch | null
}
