import { db } from '@/lib/Supabase/supabaseClient'
import { fetchWithInternetErrorNotice, readJsonResponse } from '@/lib/network/http'
import { activeApprovedFarmsQuery, farmFmsType } from '@/lib/data/repositories/farms'
import {
  listFarmAssignableUsers,
  listFarmAssignedUsers,
  type FarmAssignableUser,
  type FarmAssignedUser,
} from '@/lib/data/repositories/farmAssignedUsers'

export type FarmAssignmentDirectoryRow = {
  id: number
  code: string
  name: string
  fmsType: 'Broiler' | 'Breeder' | 'Hatchery'
  region: string
  assignedUsers: FarmAssignedUser[]
}

type FarmAssignmentRow = {
  id: number
  code: string | null
  name: string | null
  farm_type: string | null
  administrative_region: string | null
  region: string | null
}

async function listAssignmentFarms(): Promise<FarmAssignmentRow[]> {
  const farms: FarmAssignmentRow[] = []
  const pageSize = 500

  for (let offset = 0; ; offset += pageSize) {
    const result = await activeApprovedFarmsQuery(
      db
        .from('farms')
        .select('id, code, name, farm_type, administrative_region, region')
        .order('code', { ascending: true }),
    ).range(offset, offset + pageSize - 1)
    if (result.error) throw result.error
    const page = (result.data ?? []) as FarmAssignmentRow[]
    farms.push(...page)
    if (page.length < pageSize) break
  }

  return farms
}

export async function getFarmAssignmentDirectory(): Promise<{
  farms: FarmAssignmentDirectoryRow[]
  users: FarmAssignableUser[]
}> {
  const farmRows = await listAssignmentFarms()
  const validFarms = farmRows.flatMap(farm => {
    const id = Number(farm.id)
    const code = String(farm.code ?? '').trim()
    const fmsType = farmFmsType(farm.farm_type)
    if (!Number.isSafeInteger(id) || id <= 0 || !code || !fmsType) return []
    return [{ ...farm, id, code, fmsType }]
  })
  const [users, assignedByFarm] = await Promise.all([
    listFarmAssignableUsers(),
    listFarmAssignedUsers(validFarms, [2, 3], { activeUsersOnly: true }),
  ])

  return {
    users,
    farms: validFarms.map(farm => ({
      id: farm.id,
      code: farm.code,
      name: String(farm.name ?? '').trim() || farm.code,
      fmsType: farm.fmsType,
      region: String(farm.administrative_region ?? farm.region ?? '').trim() || 'Unspecified',
      assignedUsers: assignedByFarm.get(farm.id) ?? [],
    })),
  }
}

export async function saveFarmAssignments(farmId: number, userIds: number[]) {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error('Please log in again.')

  const response = await fetchWithInternetErrorNotice('/api/farm-asmgt', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ farmId, userIds }),
  })
  const result = await readJsonResponse<{ userIds?: number[]; error?: string }>(response)
  if (!response.ok || !result.userIds) throw new Error(result.error || 'Unable to save farm assignments.')
  return result.userIds
}
