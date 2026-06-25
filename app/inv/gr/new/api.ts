import { db } from '@/lib/Supabase/supabaseClient'
import { Farms, Items, WarehouseData } from '@/lib/types'

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

export async function getGoodsReceiptReferences() {
  const [itemsResult, warehousesResult, farmsResult, conversionGroupsResult] = await Promise.all([
    db.from('items').select('*').eq('void', 1).order('item_code'),
    db.from('i_warehouse').select('*').eq('is_active', true).order('whse_code'),
    db.from('vwdmf_get_farmlist').select('*').order('code'),
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
  ])

  if (itemsResult.error) throw itemsResult.error
  if (warehousesResult.error) throw warehousesResult.error
  if (farmsResult.error) throw farmsResult.error
  if (conversionGroupsResult.error) throw conversionGroupsResult.error

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

  const conversionGroups = (conversionGroupsResult.data ?? []) as unknown as ConversionGroupRecord[]

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

  return {
    items: (itemsResult.data ?? []) as Items[],
    warehouses: (warehousesResult.data ?? []) as WarehouseData[],
    farms: (farmsResult.data ?? []) as Farms[],
    uomGroups,
    conversions,
  }
}
