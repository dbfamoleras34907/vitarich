import { db } from '@/lib/Supabase/supabaseClient'
import { assertCompleteRead } from '@/lib/data/assertCompleteRead'

export type FarmAssignedUser = { id: number; name: string }

/** Resolve active farm memberships through canonical IDs (validated legacy codes only as a fallback). */
export async function listFarmAssignedUsers(farms: { id: number; code: string }[], userType: 1 | 2 | 3): Promise<Map<number, FarmAssignedUser[]>> {
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
    const result = await db.from('users').select('id, firstname, middlename, lastname', { count: 'exact' })
      .in('id', userIds.slice(offset, offset + 100)).eq('user_type', userType)
    if (result.error) throw result.error
    assertCompleteRead(result, 'Assigned user profiles')
    for (const user of result.data ?? []) {
      const id = Number(user.id)
      users.set(id, { id, name: [user.firstname, user.middlename, user.lastname].map(value => String(value ?? '').trim()).filter(Boolean).join(' ') || `User ${id}` })
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
