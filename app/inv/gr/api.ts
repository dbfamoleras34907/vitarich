import { db } from '@/lib/Supabase/supabaseClient'

export async function upsertInventoryMapping(payload: any) {

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