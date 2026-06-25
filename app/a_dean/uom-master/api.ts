import { db } from '@/lib/Supabase/supabaseClient'

export type UomMaster = {
  id?: number
  code: string
  name: string
  remarks?: string | null
  void?: string
  created_at?: string
}

export async function getUomMasterData() {
  const { data, error } = await db
    .from('uom_master_data')
    .select('*')
    .eq('void', '1')
    .order('code', { ascending: true })

  if (error) throw error
  return (data || []) as UomMaster[]
}

export async function addUomMaster(payload: UomMaster) {
  const { data: authData } = await db.auth.getUser()
  const { data, error } = await db
    .from('uom_master_data')
    .insert({
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      remarks: payload.remarks?.trim() || null,
      created_by: authData.user?.id || null,
      void: '1',
    })
    .select()
    .single()

  if (error) throw error
  return data as UomMaster
}

export async function getUomMasterById(id: number) {
  const { data, error } = await db
    .from('uom_master_data')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as UomMaster
}

export async function updateUomMaster(id: number, payload: UomMaster) {
  const { data: authData } = await db.auth.getUser()
  const { data, error } = await db
    .from('uom_master_data')
    .update({
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      remarks: payload.remarks?.trim() || null,
      updated_by: authData.user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as UomMaster
}

export async function voidUomMaster(id: number) {
  const { data: authData } = await db.auth.getUser()
  const { data, error } = await db
    .from('uom_master_data')
    .update({
      void: '0',
      updated_by: authData.user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as UomMaster
}
