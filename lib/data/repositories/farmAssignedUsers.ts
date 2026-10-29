import { db } from '@/lib/Supabase/supabaseClient'
import { assertCompleteRead } from '@/lib/data/assertCompleteRead'

export type FarmAssignedUser = { id: number; name: string; userType?: 1 | 2 | 3 }

export type FarmAssignableUser = Required<FarmAssignedUser> & { userTypeLabel: 'Admin' | 'User' }

type FarmAssignableUserRow = {
  id: number
  firstname: string | null
  middlename: string | null
  lastname: string | null
  user_type: number | null
  isactive: string | boolean | null
}

const activeUserValue = (value: unknown) => ['1', 'true', 'active'].includes(String(value ?? '').trim().toLowerCase())

const userName = (user: { id: unknown; firstname?: unknown; middlename?: unknown; lastname?: unknown }) => {
  const id = Number(user.id)
  return [user.firstname, user.middlename, user.lastname]
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ') || `User ${id}`
}

/** Active Admin and User accounts that may be assigned to a farm. */
export async function listFarmAssignableUsers(): Promise<FarmAssignableUser[]> {
  const users: FarmAssignableUserRow[] = []
  const pageSize = 500

  for (let offset = 0; ; offset += pageSize) {
    const result = await db
      .from('users')
      .select('id, firstname, middlename, lastname, user_type, isactive')
      .in('user_type', [2, 3])
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (result.error) throw result.error
    const page = (result.data ?? []) as FarmAssignableUserRow[]
    users.push(...page)
    if (page.length < pageSize) break
  }

  return users
    .filter(user => activeUserValue(user.isactive))
    .map(user => {
      const id = Number(user.id)
      const userType = Number(user.user_type) as 2 | 3
      return {
        id,
        name: userName(user),
        userType,
        userTypeLabel: userType === 2 ? 'Admin' as const : 'User' as const,
      }
    })
    .filter(user => Number.isSafeInteger(user.id) && user.id > 0)
}

/** Resolve active farm memberships through canonical IDs (validated legacy codes only as a fallback). */
export async function listFarmAssignedUsers(
  farms: { id: number; code: string }[],
  userType: 1 | 2 | 3 | readonly (1 | 2 | 3)[],
  options: { activeUsersOnly?: boolean } = {},
): Promise<Map<number, FarmAssignedUser[]>> {
  const assignments: { farm_id: number | null; farm_code: string | null; users_id: number }[] = []
  const users = new Map<number, FarmAssignedUser>()
  for (let offset = 0; offset < farms.length; offset += 100) {
    const batch = farms.slice(offset, offset + 100)
    const results = await Promise.all([
      db.from('users_farms').select('farm_id, farm_code, users_id', { count: 'exact' }).eq('void', 1).in('farm_id', batch.map(farm => farm.id)),
      db.from('users_farms').select('farm_id, farm_code, users_id', { count: 'exact' }).eq('void', 1).in('farm_code', batch.map(farm => farm.code)),
    ])
    for (const result of results) {
      if (result.error) throw result.error
      assertCompleteRead(result, 'Farm user assignments')
      assignments.push(...(result.data ?? []))
    }
  }
  const userIds = [...new Set(assignments.map(row => Number(row.users_id)).filter(id => Number.isSafeInteger(id) && id > 0))]
  for (let offset = 0; offset < userIds.length; offset += 100) {
    const userTypes = Array.isArray(userType) ? userType : [userType]
    const result = await db.from('users').select('id, firstname, middlename, lastname, user_type, isactive', { count: 'exact' })
      .in('id', userIds.slice(offset, offset + 100)).in('user_type', userTypes)
    if (result.error) throw result.error
    assertCompleteRead(result, 'Assigned user profiles')
    for (const user of result.data ?? []) {
      if (options.activeUsersOnly && !activeUserValue(user.isactive)) continue
      const id = Number(user.id)
      users.set(id, { id, name: userName(user), userType: Number(user.user_type) as 1 | 2 | 3 })
    }
  }
  const byCode = new Map(farms.map(farm => [farm.code, farm.id]))
  const result = new Map(farms.map(farm => [farm.id, new Map<number, FarmAssignedUser>()]))
  for (const assignment of assignments) {
    const numericId = Number(assignment.farm_id)
    const farmId = Number.isSafeInteger(numericId) && numericId > 0 ? numericId : byCode.get(String(assignment.farm_code ?? '').trim())
    const user = users.get(Number(assignment.users_id))
    if (farmId && user) result.get(farmId)?.set(user.id, user)
  }
  return new Map([...result].map(([id, members]) => [id, [...members.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)]))
}
