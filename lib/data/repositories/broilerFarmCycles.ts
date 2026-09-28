import { db } from '@/lib/Supabase/supabaseClient'
import { getFarmBuildingsForFlockCard } from '@/lib/data/repositories/broilerFlockCards'

export type FarmCycleMasterRow = {
  id: number
  farmId: number
  cycleNumber: number
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
  reopenBlockedBuildings: number
}

export type BroilerFarmCycleStatus = 'Saved' | 'Past Open' | 'Closed' | 'Cancelled'
export type BroilerFarmCycleDisplayStatus = 'Current Cycle' | 'Past Open Cycle' | 'Closed Cycle' | 'Cancelled Cycle'

export type SelectableBroilerFarmCycle = {
  id: number
  farmId: number
  cycleNumber: number
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
      displayStatus: (cycle.status === 'Saved' ? 'Current Cycle' : cycle.status === 'Closed' ? 'Closed Cycle' : 'Cancelled Cycle') as BroilerFarmCycleDisplayStatus,
      createdAt: cycle.createdAt,
      closedAt: null,
      closedByName: null,
      reopenedAt: null,
      reopenedByName: null,
      participatingBuildings: 1,
      openBuildings: cycle.status === 'Saved' ? 1 : 0,
      reopenBlockedBuildings: 0,
    })),
  ]
}

export async function getFarmCycleMasterRows(
  farmId: number,
  options: { status?: BroilerFarmCycleStatus } = {},
): Promise<FarmCycleMasterRow[]> {
  if (!Number.isFinite(farmId) || farmId <= 0) return []

  let cycleQuery = db
    .from('doc_farm_cycles')
    .select('id, farm_id, cycle_no, cycle_mask, status, created_at, closed_at, closed_by, reopened_at, reopened_by')
    .eq('farm_id', farmId)
    .order('cycle_no', { ascending: false })

  if (options.status) cycleQuery = cycleQuery.eq('status', options.status)
  const cycleResult = await cycleQuery

  if (cycleResult.error) throw cycleResult.error
  const cycles = (cycleResult.data ?? []) as FarmCycleDbRow[]
  if (cycles.length === 0) return []

  const actorIds = Array.from(new Set(cycles.flatMap(cycle => [cycle.closed_by, cycle.reopened_by]).filter((id): id is string => Boolean(id))))
  const actorResult = actorIds.length > 0
    ? await db.from('users').select('auth_id, firstname, middlename, lastname, email').in('auth_id', actorIds)
    : { data: [], error: null }
  if (actorResult.error) throw actorResult.error
  const actors = new Map(((actorResult.data ?? []) as CycleActorRow[]).map(actor => [actor.auth_id, actor]))

  const cardResult = await db
    .from('flock_card')
    .select('farm_cycle_id, building_whse_id, status, start_date')
    .eq('farm_id', farmId)
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
    const cycleBuildingIds = new Set(
      cycleCards.map(card => Number(card.building_whse_id)).filter(id => Number.isFinite(id) && id > 0),
    )
    const reopenBlockedBuildings = new Set(
      cards
        .filter(card =>
          card.status === 'Saved' &&
          Number(card.farm_cycle_id) !== Number(cycle.id) &&
          cycleBuildingIds.has(Number(card.building_whse_id)))
        .map(card => Number(card.building_whse_id)),
    ).size

    return {
      id: Number(cycle.id),
      farmId: Number(cycle.farm_id),
      cycleNumber: Number(cycle.cycle_no),
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
      reopenBlockedBuildings,
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

  const [buildings, openCycleResult] = await Promise.all([
    getFarmBuildingsForFlockCard(farmId, { includePlacementInventory: false }),
    db.from('flock_card').select('building_whse_id')
      .eq('farm_id', farmId).eq('void', '1')
      .eq('status', 'Saved'),
  ])
  if (openCycleResult.error) throw openCycleResult.error

  const openBuildingIds = new Set((openCycleResult.data ?? [])
    .map(row => Number(row.building_whse_id))
    .filter(id => Number.isInteger(id) && id > 0))

  return buildings
    .filter(building => building.id != null && !openBuildingIds.has(Number(building.id)))
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
