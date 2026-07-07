'use client'

import { db } from '@/lib/Supabase/supabaseClient'
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
      .select('id, whse_code, whse_name')
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
    ? await db
        .from('farms')
        .select('id, code, name, associated_warehouses')
        .eq('void', 1)
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
