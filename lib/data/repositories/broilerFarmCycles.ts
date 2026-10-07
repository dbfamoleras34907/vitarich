import { db } from '@/lib/Supabase/supabaseClient'
import { getFarmBuildingsForFlockCard } from '@/lib/data/repositories/broilerFlockCards'
import { assertCompleteRead } from '@/lib/data/assertCompleteRead'

export type FarmCycleMasterRow = {
  id: number
  farmId: number
  cycleNumber: number
  cycleKey: string
  cycleMask: string | null
  startDate: string | null
  status: BroilerFarmCycleStatus
  displayStatus: BroilerFarmCycleDisplayStatus
  createdAt: string
  closedAt: string | null
  closedByName: string | null
  reopenedAt: string | null
  reopenedByName: string | null
  participatingBuildings: number
  openBuildings: number
}

export type BroilerFarmCycleStatus = 'Saved' | 'Past Open' | 'Closed' | 'Cancelled'
export type BroilerFarmCycleDisplayStatus = 'Current Cycle' | 'Past Open Cycle' | 'Closed Cycle' | 'Cancelled Cycle'

export type SelectableBroilerFarmCycle = {
  id: number
  farmId: number
  cycleNumber: number
  cycleKey: string
  cycleMask: string | null
  status: Extract<BroilerFarmCycleStatus, 'Saved' | 'Past Open'>
  displayStatus: Extract<BroilerFarmCycleDisplayStatus, 'Current Cycle' | 'Past Open Cycle'>
  startDate: string | null
}

export type BroilerPastCycleBuildingOption = {
  id: number
  code: string
  name: string
}

export type OpenBroilerPastCycleInput = {
  farmId: number
  buildingWarehouseId: number
  cycleMonth: string
}

export const getBroilerFarmCycleDisplayStatus = (status: BroilerFarmCycleStatus): BroilerFarmCycleDisplayStatus => {
  if (status === 'Saved') return 'Current Cycle'
  if (status === 'Past Open') return 'Past Open Cycle'
  if (status === 'Closed') return 'Closed Cycle'
  return 'Cancelled Cycle'
}

type FarmCycleDbRow = {
  id: number
  farm_id: number
  cycle_no: number
  cycle_key: string
  cycle_mask: string | null
  status: BroilerFarmCycleStatus
  created_at: string
  closed_at: string | null
  closed_by: string | null
  reopened_at: string | null
  reopened_by: string | null
}

type CycleActorRow = {
  auth_id: string
  firstname: string | null
  middlename: string | null
  lastname: string | null
  email: string | null
}

const actorName = (actor: CycleActorRow | undefined) => {
  if (!actor) return null
  return [actor.firstname, actor.middlename, actor.lastname].filter(Boolean).join(' ') || actor.email || null
}

type FlockCardCycleRow = {
  start_date: string | null
  farm_cycle_id: number | null
  building_whse_id: number | null
  status: string | null
}

export type CycleMasterListRow = Omit<FarmCycleMasterRow, 'cycleNumber' | 'status' | 'createdAt'> & {
  kind: 'farm' | 'building'
  buildingName?: string
  cycleNumber: number | string
  status: string
  createdAt: string | null
}

export async function getCycleMasterListRows(farmId: number, options: { requireComplete?: boolean } = {}): Promise<CycleMasterListRow[]> {
  const farmCycles = await getFarmCycleMasterRows(farmId, options)
  return farmCycles.map(cycle => ({ ...cycle, kind: 'farm' as const }))
}

export async function getFarmCycleMasterRows(
  farmId: number,
  options: {
    status?: BroilerFarmCycleStatus
    requireComplete?: boolean
    validateOwnership?: boolean
  } = {},
): Promise<FarmCycleMasterRow[]> {
  if (!Number.isFinite(farmId) || farmId <= 0) return []

  let cycleQuery = db
    .from('doc_farm_cycles')
    .select('id, farm_id, cycle_no, cycle_key, cycle_mask, status, created_at, closed_at, closed_by, reopened_at, reopened_by', options.requireComplete ? { count: 'exact' } : undefined)
    .eq('farm_id', farmId)
    .order('cycle_no', { ascending: false })

  if (options.status) cycleQuery = cycleQuery.eq('status', options.status)
  const cycleResult = await cycleQuery

  if (cycleResult.error) throw cycleResult.error
  assertCompleteRead(cycleResult, 'Farm cycle catalog')
  const cycles = (cycleResult.data ?? []) as FarmCycleDbRow[]

  const cardResult = await db
    .from('flock_card')
    .select('farm_cycle_id, building_whse_id, status, start_date', { count: 'exact' })
    .eq('farm_id', farmId)
    .eq('void', '1')
  if (cardResult.error) throw cardResult.error
  assertCompleteRead(cardResult, 'Cycle Master building ownership')
  const cards = (cardResult.data ?? []) as FlockCardCycleRow[]
  if (cards.some(card => card.status === 'Saved' && card.farm_cycle_id == null)) {
    throw new Error('This farm does not have a Cycle yet.')
  }
  if (cycles.length === 0) return []

  const actorIds = Array.from(new Set(cycles.flatMap(cycle => [cycle.closed_by, cycle.reopened_by]).filter((id): id is string => Boolean(id))))
  const actorResult = actorIds.length > 0
    ? await db.from('users').select('auth_id, firstname, middlename, lastname, email').in('auth_id', actorIds)
    : { data: [], error: null }
  if (actorResult.error) throw actorResult.error
  const actors = new Map(((actorResult.data ?? []) as CycleActorRow[]).map(actor => [actor.auth_id, actor]))

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
      cycleKey: cycle.cycle_key || String(cycle.cycle_no),
      cycleMask: cycle.cycle_mask ?? null,
      startDate: cycleCards.map(card => card.start_date).filter((date): date is string => !!date).sort()[0] ?? null,
      status: cycle.status,
      displayStatus: getBroilerFarmCycleDisplayStatus(cycle.status),
      createdAt: cycle.created_at,
      closedAt: cycle.closed_at,
      closedByName: actorName(actors.get(cycle.closed_by ?? '')),
      reopenedAt: cycle.reopened_at,
      reopenedByName: actorName(actors.get(cycle.reopened_by ?? '')),
      participatingBuildings,
      openBuildings,
    }
  })
}

export async function getSelectableBroilerFarmCycles(farmId: number): Promise<SelectableBroilerFarmCycle[]> {
  const rows = await getFarmCycleMasterRows(farmId)
  return rows
    .filter((row): row is FarmCycleMasterRow & { status: 'Saved' | 'Past Open' } =>
      row.status === 'Saved' || row.status === 'Past Open')
    .map(row => ({
      id: row.id,
      farmId: row.farmId,
      cycleNumber: row.cycleNumber,
      cycleKey: row.cycleKey,
      cycleMask: row.cycleMask,
      status: row.status,
      displayStatus: (row.status === 'Saved' ? 'Current Cycle' : 'Past Open Cycle') as SelectableBroilerFarmCycle['displayStatus'],
      startDate: row.startDate,
    }))
    .sort((left, right) => left.status === right.status ? right.cycleNumber - left.cycleNumber : left.status === 'Saved' ? -1 : 1)
}

export async function setBroilerFarmCycleState(cycleId: number, action: 'close' | 'reopen'): Promise<void> {
  if (!Number.isInteger(cycleId) || cycleId <= 0) throw new Error('Select a valid Broiler cycle.')
  const { error } = await db.rpc('set_broiler_farm_cycle_state', {
    p_farm_cycle_id: cycleId,
    p_action: action,
  })
  if (error) throw error
}

export async function getBroilerPastCycleBuildingOptions(
  farmId: number,
  cycleMonth: string,
): Promise<BroilerPastCycleBuildingOption[]> {
  if (!Number.isInteger(farmId) || farmId <= 0 || !/^\d{4}-\d{2}$/.test(cycleMonth)) return []

  const [year, month] = cycleMonth.split('-').map(Number)
  const nextMonth = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`
  const existingCycleResult = await db
    .from('flock_card')
    .select('building_whse_id', { count: 'exact' })
    .eq('farm_id', farmId)
    .eq('void', '1')
    .gte('start_date', `${cycleMonth}-01`)
    .lt('start_date', nextMonth)
  if (existingCycleResult.error) throw existingCycleResult.error
  assertCompleteRead(existingCycleResult, 'Past cycle building catalog')

  const existingBuildingIds = new Set((existingCycleResult.data ?? [])
    .map(row => Number(row.building_whse_id))
    .filter(id => Number.isInteger(id) && id > 0))
  const buildings = await getFarmBuildingsForFlockCard(farmId, { includePlacementInventory: false })

  return buildings
    .filter(building => building.id != null && !existingBuildingIds.has(Number(building.id)))
    .map(building => ({ id: Number(building.id), code: building.code, name: building.name }))
}

export async function openBroilerPastCycle(input: OpenBroilerPastCycleInput): Promise<void> {
  if (!Number.isInteger(input.farmId) || input.farmId <= 0) throw new Error('Select a valid farm.')
  if (!Number.isInteger(input.buildingWarehouseId) || input.buildingWarehouseId <= 0) {
    throw new Error('Select a valid building.')
  }
  if (!/^\d{4}-\d{2}$/.test(input.cycleMonth)) throw new Error('Select a valid past month.')

  const { error } = await db.rpc('open_broiler_past_cycle', {
    p_farm_id: input.farmId,
    p_building_whse_id: input.buildingWarehouseId,
    p_cycle_month: `${input.cycleMonth}-01`,
  })
  if (error) throw error
}

// 