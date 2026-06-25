import { db } from '@/lib/Supabase/supabaseClient'

export type ItemGroup = {
  id?: number
  code: string
  name: string
  remarks?: string
  void?: string
}

export async function getItemGroups() {
  const { data, error } = await db
    .from('item_groups')
    .select('*')
    .eq('void', '1')
    .order('created_at', { ascending: false })

  if (error) throw error

  return data
}

export async function addItemGroup(payload: ItemGroup) {
  const { data, error } = await db
    .from('item_groups')
    .insert({
      code: payload.code,
      name: payload.name,
      remarks: payload.remarks || null,
      void: '1',
    })
    .select()
    .single()

  if (error) throw error

  return data
}

export async function getItemGroupById(id: number) {
  const { data, error } = await db
    .from('item_groups')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data
}

export async function updateItemGroup(id: number, payload: ItemGroup) {
  const { data, error } = await db
    .from('item_groups')
    .update({
      name: payload.name,
      remarks: payload.remarks || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function voidItemGroup(id: number) {
  const { data, error } = await db
    .from('item_groups')
    .update({
      void: '0',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}
