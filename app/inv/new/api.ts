import { db } from '@/lib/Supabase/supabaseClient'

export type InventoryMappingHeader = {
  section: string
  module: string
}

export type InventoryMappingRow = {
  itemType?: string
  item?: string | number
  warehouse?: string | number
  transtype?: string | number | null
  [key: string]: unknown
}

export type InventoryMappingPayload = {
  header: InventoryMappingHeader
  rows: InventoryMappingRow[]
}

export async function upsertInventoryMapping(payload: InventoryMappingPayload) {

  const { data, error } = await db.rpc(
    'upsert_inventory_mapping',
    {
      payload
    }
  )

  if (error) {
    console.error('upsert_inventory_mapping error:', error)
    throw new Error(error.message)
  }

  return data
}
