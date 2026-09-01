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

export const ITEM_GROUP_MAX_SUBGROUP_LEVELS = 5
export const ITEM_GROUP_MAX_DEPTH = ITEM_GROUP_MAX_SUBGROUP_LEVELS + 1

export function getItemGroupChildren(groups: ItemGroup[], fatherId: number) {
  return groups.filter(group =>
    group.id != null && group.father != null && Number(group.father) === fatherId,
  )
}

export function getItemGroupDescendants(groups: ItemGroup[], rootId: number) {
  const descendants: ItemGroup[] = []
  const pendingParentIds = new Set([rootId])

  for (let depth = 2; depth <= ITEM_GROUP_MAX_DEPTH; depth += 1) {
    const level = groups.filter(group =>
      group.id != null && group.father != null && pendingParentIds.has(Number(group.father)),
    )
    if (level.length === 0) break

    descendants.push(...level)
    pendingParentIds.clear()
    level.forEach(group => pendingParentIds.add(Number(group.id)))
  }

  return descendants
}

export function getLeafItemGroups(groups: ItemGroup[], rootId: number) {
  const descendants = getItemGroupDescendants(groups, rootId)
  const activeParentIds = new Set(descendants.map(group => Number(group.father)))
  return descendants.filter(group => group.id != null && !activeParentIds.has(Number(group.id)))
}

export function getItemGroupPath(groups: ItemGroup[], rootId: number, groupId: number) {
  const byId = new Map(groups.flatMap(group => group.id == null ? [] : [[Number(group.id), group]]))
  const path: ItemGroup[] = []
  const visited = new Set<number>()
  let currentId: number | null = groupId

  while (currentId != null && currentId !== rootId && !visited.has(currentId)) {
    visited.add(currentId)
    const group = byId.get(currentId)
    if (!group) return []
    path.unshift(group)
    currentId = group.father == null ? null : Number(group.father)
  }

  return currentId === rootId ? path : []
}

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
    body: JSON.stringify({ fatherId, actionId: crypto.randomUUID(), ...payload }),
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
    body: JSON.stringify({ id, actionId: crypto.randomUUID(), ...payload }),
  })

  const result = await response.json() as { data?: ItemGroup; error?: string }
  if (!response.ok || !result.data) {
    throw new Error(result.error || 'Unable to update item group.')
  }

  return result.data
}

export async function voidItemGroup(id: number) {
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError

  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Your session has expired. Please sign in again.')

  const response = await fetch('/api/a_dean/itemgroups/void', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, actionId: crypto.randomUUID() }),
  })

  const result = await response.json() as { data?: ItemGroup; error?: string }
  if (!response.ok || !result.data) {
    throw new Error(result.error || 'Unable to void item group.')
  }

  return result.data
}
