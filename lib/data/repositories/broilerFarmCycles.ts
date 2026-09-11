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

export type StandaloneBuildingCycleOption = {
  id: number
  cycleLabel: string
  buildingName: string
  status: string
  createdAt: string | null
}

export async function getStandaloneBuildingCycleOptions(farmId: number): Promise<StandaloneBuildingCycleOption[]> {
  if (!Number.isInteger(farmId) || farmId <= 0) return []
  const { data, error } = await db.from('flock_card')
    .select('id, cycle_no, building_name, building_code, status, created_at')
    .eq('farm_id', farmId).is('farm_cycle_id', null).eq('void', '1')
    .order('start_date', { ascending: false }).order('id', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: Number(row.id), cycleLabel: String(row.cycle_no ?? ''),
    buildingName: String(row.building_name || row.building_code || ''), status: String(row.status ?? ''),
    createdAt: row.created_at ?? null,
  }))
}

export type CycleMasterListRow = Omit<FarmCycleMasterRow, 'cycleNumber' | 'status' | 'createdAt'> & {
  kind: 'farm' | 'building'
  cycleNumber: number | string
  status: string
  createdAt: string | null
}

export async function getCycleMasterListRows(farmId: number): Promise<CycleMasterListRow[]> {
  const [farmCycles, standaloneCycles] = await Promise.all([
    getFarmCycleMasterRows(farmId),
    getStandaloneBuildingCycleOptions(farmId),
  ])
  return [
    ...farmCycles.map(cycle => ({ ...cycle, kind: 'farm' as const })),
    ...standaloneCycles.map(cycle => ({
      id: cycle.id,
      kind: 'building' as const,
      farmId,
      cycleNumber: `${cycle.cycleLabel} - ${cycle.buildingName}`,
      status: cycle.status,
      createdAt: cycle.createdAt,
      closedAt: null,
      participatingBuildings: 1,
      openBuildings: cycle.status === 'Saved' ? 1 : 0,
    })),
  ]
}

export async function getFarmCycleMasterRows(
  farmId: number,
  options: { status?: FarmCycleMasterRow['status'] } = {},
): Promise<FarmCycleMasterRow[]> {
  if (!Number.isFinite(farmId) || farmId <= 0) return []

  let cycleQuery = db
    .from('doc_farm_cycles')
    .select('id, farm_id, cycle_no, status, created_at, closed_at')
    .eq('farm_id', farmId)
    .order('cycle_no', { ascending: false })

  if (options.status) cycleQuery = cycleQuery.eq('status', options.status)
  const cycleResult = await cycleQuery

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
