import { getFarmCycleMasterRows, getStandaloneBuildingCycleOptions } from './broilerFarmCycles'
import { getFarmBuildingsForFlockCard } from './broilerFlockCards'
import { getBroilerCycleReport, getBroilerBuildingCycleReport, type BroilerCycleBuilding } from './broilerCycleReport'
import { listAssignedUserFarmOptions } from './farmOptions.client'

export type DashboardCycleBuilding = BroilerCycleBuilding & {
  cycleId: number | null
  cycleNumber: number | string
  cycleClosedAt?: string
}

export type DashboardBuilding = {
  key: string
  code: string
  name: string
  cycles: DashboardCycleBuilding[]
}

export type DashboardCycleOption = {
  key: string
  kind: 'farm' | 'building'
  id: number
  label: string
  status: string
}

export type CycleDashboardCatalog = {
  farmId: number
  cycleOptions: DashboardCycleOption[]
  selectedCycle: DashboardCycleOption | null
}

export type CycleDashboardData = CycleDashboardCatalog & {
  buildings: DashboardBuilding[]
  warnings: string[]
}

const queryMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error
  ? String(error.message) : String(error || 'Unknown database error')

export async function getBroilerCycleDashboard(
  farmId: number, options: {
    cycleKey?: string
    onCatalogLoaded?: (catalog: CycleDashboardCatalog) => void
  } = {},
): Promise<CycleDashboardData> {
  const farms = await listAssignedUserFarmOptions(['BR'])
  if (!farms.some(farm => farm.id === farmId)) {
    throw new Error('You do not have an active assignment to this Broiler farm.')
  }
  const farmCycles = await getFarmCycleMasterRows(farmId)
  // Keep farm cycles first, newest cycle number first, regardless of open status.
  const cycleOptions: DashboardCycleOption[] = [
    ...[...farmCycles].sort((a, b) => b.cycleNumber - a.cycleNumber || b.id - a.id).map(cycle => ({
      key: `farm:${cycle.id}`, kind: 'farm' as const, id: cycle.id,
      label: `Cycle ${cycle.cycleNumber}`, status: cycle.status,
    })),
  ]
  const selectCycle = () => (options.cycleKey
    ? cycleOptions.find(cycle => cycle.key === options.cycleKey)
    : cycleOptions.find(cycle => cycle.status === 'Saved') ?? cycleOptions[0]) ?? null
  // Publish the exact Cycle Master list before any unrelated detail query.
  options.onCatalogLoaded?.({ farmId, cycleOptions: [...cycleOptions], selectedCycle: selectCycle() })

  const [buildingsResult, standaloneResult] = await Promise.allSettled([
    getFarmBuildingsForFlockCard(farmId, { includePlacementInventory: false }),
    getStandaloneBuildingCycleOptions(farmId),
  ])
  const warnings: string[] = []
  const buildings = buildingsResult.status === 'fulfilled' ? buildingsResult.value : []
  if (buildingsResult.status === 'rejected') warnings.push(`Additional farm buildings could not be loaded: ${queryMessage(buildingsResult.reason)}`)
  if (standaloneResult.status === 'rejected') warnings.push(`Standalone building cycles could not be loaded: ${queryMessage(standaloneResult.reason)}`)
  const standaloneCycles = standaloneResult.status === 'fulfilled' ? standaloneResult.value : []
  cycleOptions.push(...standaloneCycles.map(cycle => ({
      key: `building:${cycle.id}`, kind: 'building' as const, id: cycle.id,
      label: `${cycle.cycleLabel} - ${cycle.buildingName}`, status: cycle.status,
    })))
  let selectedCycle = selectCycle()
  options.onCatalogLoaded?.({ farmId, cycleOptions: [...cycleOptions], selectedCycle })
  if (!farmCycles.length && standaloneResult.status === 'rejected') {
    throw new Error(warnings.join(' '))
  }
  if (options.cycleKey?.startsWith('building:') && standaloneResult.status === 'rejected') {
    throw new Error(`Unable to load the selected standalone cycle: ${queryMessage(standaloneResult.reason)}`)
  }
  if (options.cycleKey && !selectedCycle) throw new Error('This cycle does not belong to the selected farm or is no longer available.')

  const report = !selectedCycle ? null : selectedCycle.kind === 'farm'
    ? await getBroilerCycleReport(selectedCycle.id, { postedOnly: true })
    : await getBroilerBuildingCycleReport(farmId, selectedCycle.id)
  if (selectedCycle && (!report || report.farmId !== farmId)) {
    throw new Error('Unable to load the selected cycle for this farm. Refresh and select the cycle again.')
  }
  if (selectedCycle && report) selectedCycle = { ...selectedCycle, status: report.status }
  options.onCatalogLoaded?.({ farmId, cycleOptions: [...cycleOptions], selectedCycle })

  const tabs = new Map<string, DashboardBuilding>()
  for (const building of buildings) {
    const key = building.id ? `warehouse:${building.id}` : building.key
    if (!tabs.has(key)) tabs.set(key, { key, code: building.code, name: building.name, cycles: [] })
  }
  for (const building of report?.buildings ?? []) {
    if (building.isVoided) continue
    const key = building.buildingWarehouseId ? `warehouse:${building.buildingWarehouseId}`
      : [...tabs.values()].find(tab => tab.code === building.buildingCode)?.key ?? `card:${building.flockCardId}`
    const tab = tabs.get(key) ?? { key, code: building.buildingCode, name: building.buildingName, cycles: [] }
    tab.cycles.push({ ...building, cycleId: report?.id || null,
      cycleNumber: building.cycleLabel || report?.cycleNumber || '', cycleClosedAt: report?.closedAt })
    tabs.set(key, tab)
  }
  return { farmId, cycleOptions, selectedCycle, warnings,
    buildings: [...tabs.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }) || a.name.localeCompare(b.name)),
  }
}
