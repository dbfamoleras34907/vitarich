import { db } from '@/lib/Supabase/supabaseClient'
import { activeApprovedFarmsQuery } from '@/lib/data/repositories/farms'

export type BroilerFarmOption = {
  id: number
  code: string
  name: string
  address: string | null
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
