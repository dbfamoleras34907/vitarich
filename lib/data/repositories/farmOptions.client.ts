import { db } from '@/lib/Supabase/supabaseClient'
import { activeApprovedFarmsQuery } from '@/lib/data/repositories/farms'

export type BroilerFarmOption = {
  id: number
  code: string
  name: string
  address: string | null
}

export type AssignedFarmOption = {
  id: number
  code: string
  name: string
  farm_type: string
}

export async function listAssignedUserFarmOptions(
  farmTypes: string[] = [],
): Promise<AssignedFarmOption[]> {
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError

  const authId = sessionData.session?.user.id
  if (!authId) return []

  const { data: user, error: userError } = await db
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .maybeSingle()

  if (userError) throw userError
  if (!user?.id) return []

  const { data: assignments, error: assignmentError } = await db
    .from('users_farms')
    .select('farm_id, farm_code')
    .eq('users_id', user.id)
    .eq('void', 1)

  if (assignmentError) throw assignmentError

  const farmIds = Array.from(new Set(
    (assignments ?? [])
      .map(row => Number(row.farm_id ?? 0))
      .filter(id => Number.isInteger(id) && id > 0),
  ))
  const legacyFarmCodes = Array.from(new Set(
    (assignments ?? [])
      .filter(row => !Number.isInteger(Number(row.farm_id)) || Number(row.farm_id) <= 0)
      .map(row => String(row.farm_code ?? '').trim())
      .filter(Boolean),
  ))

  if (!farmIds.length && !legacyFarmCodes.length) return []

  const selectFarms = () => {
    let query = activeApprovedFarmsQuery(
      db.from('farms').select('id, code, name, farm_type'),
    )
    if (farmTypes.length) query = query.in('farm_type', farmTypes)
    return query
  }

  const [byId, byLegacyCode] = await Promise.all([
    farmIds.length ? selectFarms().in('id', farmIds) : Promise.resolve({ data: [], error: null }),
    legacyFarmCodes.length ? selectFarms().in('code', legacyFarmCodes) : Promise.resolve({ data: [], error: null }),
  ])

  if (byId.error) throw byId.error
  if (byLegacyCode.error) throw byLegacyCode.error

  return Array.from(new Map(
    [...(byId.data ?? []), ...(byLegacyCode.data ?? [])]
      .map(farm => [Number(farm.id), farm]),
  ).values())
    .flatMap(farm => {
      const id = Number(farm.id)
      const code = String(farm.code ?? '').trim()
      const name = String(farm.name ?? code).trim()
      const farmType = String(farm.farm_type ?? '').trim()
      if (!Number.isInteger(id) || id <= 0 || !code || !farmType) return []
      return [{ id, code, name, farm_type: farmType }]
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function listBroilerFarmOptions(): Promise<BroilerFarmOption[]> {
  const { data, error } = await activeApprovedFarmsQuery(
    db.from('farms').select('id, code, name, address'),
  )
    .eq('farm_type', 'BR')
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map(farm => ({
    id: Number(farm.id),
    code: String(farm.code ?? ''),
    name: String(farm.name ?? ''),
    address: farm.address ? String(farm.address) : null,
  })).filter(farm => Number.isInteger(farm.id) && farm.id > 0 && farm.name)
}
