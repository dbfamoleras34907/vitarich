import { db } from '@/lib/Supabase/supabaseClient'

export type FarmCycleMasterRow = {
  id: number
  farmId: number
  cycleNumber: number
  cycleMask: string | null
  startDate: string | null
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
  cycle_mask: string | null
  status: 'Saved' | 'Closed' | 'Cancelled'
  created_at: string
  closed_at: string | null
}

type FlockCardCycleRow = {
  start_date: string | null
  farm_cycle_id: number | null
  building_whse_id: number | null
  status: string | null
}

export type StandaloneBuildingCycleOption = {
  id: number
  cycleLabel: string
  cycleMask: string | null
  buildingName: string
  status: string
  createdAt: string | null
}

export async function getStandaloneBuildingCycleOptions(farmId: number): Promise<StandaloneBuildingCycleOption[]> {
  if (!Number.isInteger(farmId) || farmId <= 0) return []
  const { data, error } = await db.from('flock_card')
    .select('id, cycle_no, cycle_mask, building_name, building_code, status, created_at')
    .eq('farm_id', farmId).is('farm_cycle_id', null).eq('void', '1')
    .order('start_date', { ascending: false }).order('id', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: Number(row.id), cycleLabel: String(row.cycle_no ?? ''),
    cycleMask: row.cycle_mask ?? null,
    buildingName: String(row.building_name || row.building_code || ''), status: String(row.status ?? ''),
    createdAt: row.created_at ?? null,
  }))
}

export type CycleMasterListRow = Omit<FarmCycleMasterRow, 'cycleNumber' | 'status' | 'createdAt'> & {
  kind: 'farm' | 'building'
  buildingName?: string
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
      buildingName: cycle.buildingName,
      farmId,
      cycleNumber: `${cycle.cycleLabel} - ${cycle.buildingName}`,
      cycleMask: cycle.cycleMask,
      startDate: null,
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
    .select('id, farm_id, cycle_no, cycle_mask, status, created_at, closed_at')
    .eq('farm_id', farmId)
    .order('cycle_no', { ascending: false })

  if (options.status) cycleQuery = cycleQuery.eq('status', options.status)
  const cycleResult = await cycleQuery

  if (cycleResult.error) throw cycleResult.error
  const cycles = (cycleResult.data ?? []) as FarmCycleDbRow[]
  if (cycles.length === 0) return []

  const cardResult = await db
    .from('flock_card')
    .select('farm_cycle_id, building_whse_id, status, start_date')
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
      cycleMask: cycle.cycle_mask ?? null,
      startDate: cycleCards.map(card => card.start_date).filter((date): date is string => !!date).sort()[0] ?? null,
      status: cycle.status,
      createdAt: cycle.created_at,
      closedAt: cycle.closed_at,
      participatingBuildings,
      openBuildings,
    }
  })
}
