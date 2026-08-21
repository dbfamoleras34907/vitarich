import { db } from '@/lib/Supabase/supabaseClient'

export type ItemGroup = {
  id?: number
  code: string
  name: string
  remarks?: string
  void?: string
  father?: number | null
  created_at?: string
  updated_at?: string | null
}

export type NewSubItemGroup = Pick<ItemGroup, 'code' | 'name' | 'remarks'>

export async function getRootItemGroups() {
  const { data, error } = await db
    .from('item_groups')
    .select('*')
    .eq('void', '1')
    .is('father', null)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []) as ItemGroup[]
}

export async function addItemGroup(payload: ItemGroup) {
  const { data, error } = await db
    .from('item_groups')
    .insert({
      code: payload.code,
      name: payload.name,
      remarks: payload.remarks || null,
      father: null,
      void: '1',
    })
    .select()
    .single()

  if (error) throw error

  return data as ItemGroup
}

export async function getItemGroupById(id: number) {
  const { data, error } = await db
    .from('item_groups')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as ItemGroup
}

export async function getSubItemGroups(fatherId: number) {
  const { data, error } = await db
    .from('item_groups')
    .select('*')
    .eq('father', fatherId)
    .eq('void', '1')
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []) as ItemGroup[]
}

export async function addSubItemGroup(fatherId: number, payload: NewSubItemGroup) {
  const { data, error } = await db
    .from('item_groups')
    .insert({
      code: payload.code,
      name: payload.name,
      remarks: payload.remarks || null,
      father: fatherId,
      void: '1',
    })
    .select()
    .single()

  if (error) throw error

  return data as ItemGroup
}

export async function updateItemGroup(
  id: number,
  payload: Pick<ItemGroup, 'name' | 'remarks'>,
) {
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

  return data as ItemGroup
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

  return data as ItemGroup
}
