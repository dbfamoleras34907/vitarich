import { db } from '@/lib/Supabase/supabaseClient'
import type { UomGroupInput } from '@/app/a_dean/uom-conversions/api'

async function saveUomGroup(id: number | null, payload: UomGroupInput) {
  const { data, error } = await db.rpc('save_uom_group', { p_id: id, p_payload: payload })
  if (error) throw error
  return data
}

export const addUomGroup = (payload: UomGroupInput) => saveUomGroup(null, payload)
export const updateUomGroup = (id: number, payload: UomGroupInput) => saveUomGroup(id, payload)

export async function voidUomGroup(id: number) {
  const { error } = await db.rpc('void_uom_group', { p_id: id })
  if (error) throw error
}
