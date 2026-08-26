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

export type NewSubItemGroup = Pick<ItemGroup, 'name' | 'remarks'>

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

export async function getSubItemGroups(fatherId?: number) {
  let query = db
    .from('item_groups')
    .select('*')
    .not('father', 'is', null)
    .eq('void', '1')
    .order('created_at', { ascending: true })

  if (fatherId != null) query = query.eq('father', fatherId)

  const { data, error } = await query

  if (error) throw error

  return (data || []) as ItemGroup[]
}

export async function addSubItemGroup(fatherId: number, payload: NewSubItemGroup) {
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError

  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Your session has expired. Please sign in again.')

  const response = await fetch('/api/a_dean/itemgroups/sub-item-groups', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fatherId, ...payload }),
  })

  const result = await response.json() as { data?: ItemGroup; error?: string }
  if (!response.ok || !result.data) {
    throw new Error(result.error || 'Unable to add sub item group.')
  }

  return result.data
}

export async function updateItemGroup(
  id: number,
  payload: Pick<ItemGroup, 'code' | 'name' | 'remarks'>,
) {
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError

  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Your session has expired. Please sign in again.')

  const response = await fetch('/api/a_dean/itemgroups/update', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, ...payload }),
  })

  const result = await response.json() as { data?: ItemGroup; error?: string }
  if (!response.ok || !result.data) {
    throw new Error(result.error || 'Unable to update item group.')
  }

  return result.data
}

export async function voidItemGroup(id: number) {
  const { error } = await db
    .from('item_groups')
    .update({
      void: '0',
    })
    .eq('id', id)

  if (error) throw error
}
