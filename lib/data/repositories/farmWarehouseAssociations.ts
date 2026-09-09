import type { WarehouseData } from '@/lib/types'

type SavedAssociation = {
  id?: number | string | null
  whse_code?: string | null
  is_default_feed?: boolean
  is_default_receiving?: boolean
  is_default_disposal?: boolean
}

// Legacy farms may have JSON associations without i_warehouse.farm_id.
// Recover those drafts for the existing transactional save to synchronize.
export function resolveFarmWarehouseAssociations(
  farmId: number,
  warehouseRows: WarehouseData[],
  associations: unknown,
): { assigned: WarehouseData[]; assignable: WarehouseData[] } {
  const assigned = new Map<number, WarehouseData>()
  for (const warehouse of warehouseRows) {
    if (warehouse.id != null && Number(warehouse.farm_id) === farmId) {
      assigned.set(warehouse.id, warehouse)
    }
  }

  for (const value of Array.isArray(associations) ? associations : []) {
    const association: SavedAssociation = typeof value === 'string'
      ? { whse_code: value }
      : value && typeof value === 'object' ? value : {}
    const code = association.whse_code?.trim()
    const hasId = association.id != null && String(association.id).trim() !== ''
    const matches = warehouseRows.filter((warehouse) => hasId
      ? Number(warehouse.id) === Number(association.id)
      : Boolean(code) && warehouse.whse_code === code)
    const warehouse = matches.length === 1 ? matches[0] : undefined
    const label = code || String(association.id ?? '[unknown]')
    if (!warehouse || warehouse.id == null || (code && warehouse.whse_code !== code)) {
      throw new Error(`Associated warehouse ${label} could not be matched. Check its saved ID/code and your warehouse access before editing this farm.`)
    }
    if (warehouse.farm_id != null && Number(warehouse.farm_id) !== farmId) {
      throw new Error(`Associated warehouse ${label} belongs to farm ${warehouse.farm_id}. Correct the conflicting assignment before editing this farm.`)
    }
    if (assigned.has(warehouse.id)) continue

    assigned.set(warehouse.id, {
      ...warehouse,
      is_default_feed_warehouse: association.is_default_feed === true,
      is_default_receiving_warehouse: association.is_default_receiving === true,
      is_default_disposal_warehouse: association.is_default_disposal === true,
    })
  }

  const byId = (left: WarehouseData, right: WarehouseData) => Number(left.id) - Number(right.id)
  return {
    assigned: [...assigned.values()].sort(byId),
    assignable: warehouseRows.filter((warehouse) =>
      warehouse.id != null && !assigned.has(warehouse.id) &&
      warehouse.farm_id == null && warehouse.is_active !== false &&
      ['Warehouse', 'Building', 'Pen'].includes(String(warehouse.warehouse_type ?? ''))
    ).sort(byId),
  }
}
