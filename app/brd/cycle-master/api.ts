import { db } from '@/lib/Supabase/supabaseClient'

export type FarmCycleMasterRow = {
  id: number
  farmId: number
  cycleNumber: number
  status: 'Saved' | 'Closed' | 'Cancelled'
  createdAt: string
  closedAt: string | null
  participatingBuildings: number
  openBuildings: number
}

type FarmCycleDbRow = {
  id: number
  farm_id: number
  cycle_no: number
  status: 'Saved' | 'Closed' | 'Cancelled'
  created_at: string
  closed_at: string | null
}

type FlockCardCycleRow = {
  farm_cycle_id: number | null
  building_whse_id: number | null
  status: string | null
}

export async function getFarmCycleMasterRows(farmId: number): Promise<FarmCycleMasterRow[]> {
  if (!Number.isFinite(farmId) || farmId <= 0) return []

  const cycleResult = await db
    .from('doc_farm_cycles')
    .select('id, farm_id, cycle_no, status, created_at, closed_at')
    .eq('farm_id', farmId)
    .order('cycle_no', { ascending: false })

  if (cycleResult.error) throw cycleResult.error
  const cycles = (cycleResult.data ?? []) as FarmCycleDbRow[]
  if (cycles.length === 0) return []

  const cardResult = await db
    .from('flock_card')
    .select('farm_cycle_id, building_whse_id, status')
    .in('farm_cycle_id', cycles.map(cycle => cycle.id))
    .eq('void', '1')

  if (cardResult.error) throw cardResult.error
  const cards = (cardResult.data ?? []) as FlockCardCycleRow[]

  return cycles.map(cycle => {
    const cycleCards = cards.filter(card => Number(card.farm_cycle_id) === Number(cycle.id))
    const participatingBuildings = new Set(
      cycleCards.map(card => Number(card.building_whse_id)).filter(id => Number.isFinite(id) && id > 0),
    ).size
    const openBuildings = new Set(
      cycleCards
        .filter(card => card.status === 'Saved')
        .map(card => Number(card.building_whse_id))
        .filter(id => Number.isFinite(id) && id > 0),
    ).size

    return {
      id: Number(cycle.id),
      farmId: Number(cycle.farm_id),
      cycleNumber: Number(cycle.cycle_no),
      status: cycle.status,
      createdAt: cycle.created_at,
      closedAt: cycle.closed_at,
      participatingBuildings,
      openBuildings,
    }
  })
}
