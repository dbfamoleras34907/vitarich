import type { SupabaseClient } from '@supabase/supabase-js'

export const ACTIVE_FARM_VOID = 1
export const APPROVED_FARM_STATUS = 'approved'

type FarmFilterQuery = {
  eq: (column: string, value: string | number) => FarmFilterQuery
}

export function activeApprovedFarmsQuery<Query>(query: Query): Query {
  return (query as unknown as FarmFilterQuery)
    .eq('void', ACTIVE_FARM_VOID)
    .eq('approval_status', APPROVED_FARM_STATUS) as unknown as Query
}

export function farmFmsType(value: unknown): 'Broiler' | 'Breeder' | 'Hatchery' | null {
  switch (String(value ?? '').trim().toUpperCase()) {
    case 'BR': case 'BROILER': return 'Broiler'
    case 'BE': case 'BREEDER': return 'Breeder'
    case 'HA': case 'HATCHERY': return 'Hatchery'
    default: return null
  }
}

export async function listApprovedFarmAccessOptions(client: SupabaseClient, codes?: string[]) {
  let query = activeApprovedFarmsQuery(client.from('farms').select('id, code, name, farm_type'))
  if (codes) query = query.in('code', codes)
  const { data, error } = await query.order('name')
  if (error) throw error
  return (data ?? []).map(farm => ({
    id: Number(farm.id), code: String(farm.code), name: String(farm.name ?? farm.code),
    farm_type: String(farm.farm_type ?? ''),
  }))
}
