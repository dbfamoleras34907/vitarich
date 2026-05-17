// app/a_dean/items/api.ts
import { db } from '@/lib/Supabase/supabaseClient'

export type ItemInsert = {
  item_code: string
  item_name?: string
  description?: string
  barcode?: string
  unit_measure?: string
  inventory_uom?: string
  item_group?: string
  group?: string
}

export async function addItem(payload: ItemInsert) {
  const { data, error } = await db
    .from('items')
    .insert({
      ...payload,
      void: 1, // active by default
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}



export async function getRecentItems() {
  const { data, error } = await db
    .from('items')
    .select('*')
    .eq('void', 1)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error

  return data
}


export async function getItems() {
  const { data, error } = await db
    .from('items')
    .select('*')
  // .eq('id', id)
  // .single()

  if (error) throw error

  return data
}


export async function getItemById(id: number) {
  const { data, error } = await db
    .from('items')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data
}

export async function updateItem(
  id: number,
  payload: any
) {
  const { data, error } = await db
    .from('items')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}