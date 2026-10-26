import { db } from '@/lib/Supabase/supabaseClient'
import { assertCompleteRead } from '@/lib/data/assertCompleteRead'
import { listFarmAssignedUsers, type FarmAssignedUser } from '@/lib/data/repositories/farmAssignedUsers'
import { USER_TYPES } from '@/lib/notifications/types'

export type ProcessListAttributionSource = {
  farm_id?: number | null
  farm_ids?: readonly number[] | null
  created_by?: string | null
}

export type ProcessListAttribution = {
  createdByName: string
  assignedTaNames: string[]
  assignedTaLabel: string
}

type FarmRow = { id: number; code: string }
type CreatorRow = {
  auth_id: string | null
  firstname: string | null
  middlename: string | null
  lastname: string | null
}

const chunksOf = <T,>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let offset = 0; offset < items.length; offset += size) chunks.push(items.slice(offset, offset + size))
  return chunks
}

const fullName = (user: CreatorRow) =>
  [user.firstname, user.middlename, user.lastname]
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ')

const normalizedFarmIds = (row: ProcessListAttributionSource) => [...new Set([
  ...(row.farm_ids ?? []),
  row.farm_id,
].map(Number).filter(id => Number.isSafeInteger(id) && id > 0))].sort((left, right) => left - right)

export function processListAttributionKey(row: ProcessListAttributionSource) {
  return `${normalizedFarmIds(row).join(',')}:${String(row.created_by ?? '').trim()}`
}

/** Resolve creator names and the current active TA assignment for transaction list rows. */
export async function getProcessListAttributions(
  rows: readonly ProcessListAttributionSource[],
): Promise<Map<string, ProcessListAttribution>> {
  const farmIds = [...new Set(rows.flatMap(normalizedFarmIds))]
  const creatorIds = [...new Set(rows.map(row => String(row.created_by ?? '').trim()).filter(Boolean))]

  const farmResults = await Promise.all(chunksOf(farmIds, 100).map(ids =>
    db.from('farms').select('id, code', { count: 'exact' }).in('id', ids),
  ))
  const farms: FarmRow[] = []
  for (const result of farmResults) {
    if (result.error) throw result.error
    assertCompleteRead(result, 'Process list farms')
    farms.push(...((result.data ?? []) as FarmRow[]))
  }

  const creatorResults = await Promise.all(chunksOf(creatorIds, 100).map(ids =>
    db.from('users').select('auth_id, firstname, middlename, lastname', { count: 'exact' }).in('auth_id', ids),
  ))
  const creators = new Map<string, string>()
  for (const result of creatorResults) {
    if (result.error) throw result.error
    assertCompleteRead(result, 'Process list creators')
    for (const user of (result.data ?? []) as CreatorRow[]) {
      if (user.auth_id) creators.set(user.auth_id, fullName(user) || 'Unknown user')
    }
  }

  const assignedByFarm = farms.length
    ? await listFarmAssignedUsers(farms, [USER_TYPES.ADMIN, USER_TYPES.USER], { activeUsersOnly: true })
    : new Map<number, FarmAssignedUser[]>()
  const byRowKey = new Map<string, ProcessListAttribution>()

  for (const row of rows) {
    const rowFarmIds = normalizedFarmIds(row)
    const createdBy = String(row.created_by ?? '').trim()
    const assignedTaNames = [...new Set(rowFarmIds.flatMap(farmId =>
      (assignedByFarm.get(farmId) ?? []).map(user => user.name),
    ))].sort((left, right) => left.localeCompare(right))
    const farmsWithoutTa = rowFarmIds.filter(farmId => !(assignedByFarm.get(farmId)?.length))
    const assignedTaLabel = !rowFarmIds.length
      ? 'Farm unavailable'
      : assignedTaNames.length
        ? `${assignedTaNames.join(', ')}${farmsWithoutTa.length ? ', Unassigned' : ''}`
        : 'Unassigned'
    byRowKey.set(processListAttributionKey(row), {
      createdByName: creators.get(createdBy) ?? (createdBy ? 'Unknown user' : '—'),
      assignedTaNames,
      assignedTaLabel,
    })
  }

  return byRowKey
}

export async function attachProcessListAttributions<T extends ProcessListAttributionSource>(
  rows: readonly T[],
): Promise<Array<T & ProcessListAttribution>> {
  const attributions = await getProcessListAttributions(rows)
  return rows.map(row => ({
    ...row,
    ...(attributions.get(processListAttributionKey(row)) ?? {
      createdByName: '—',
      assignedTaNames: [],
      assignedTaLabel: 'Farm unavailable',
    }),
  }))
}
