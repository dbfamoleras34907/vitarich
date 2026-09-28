import { listAssignedUserFarmOptions } from './farmOptions.client'
import { getActiveFarmById } from './farmManagement.client'
import { getCycleMasterListRows } from './broilerFarmCycles'
import { getBroilerBuildingCycleReport, getBroilerCycleReport } from './broilerCycleReport'
import type { ComplianceSource } from '@/lib/broiler/dataCompliance'
import { listFarmAssignedUsers, type FarmAssignedUser } from './farmAssignedUsers'
import { USER_TYPES } from '@/lib/notifications/types'

export type ComplianceCycleScope = 'current' | 'all'
export type ComplianceFarm = { id: number; name: string; region: string; assignedTas: FarmAssignedUser[] }
export type ComplianceDataset = { sources: ComplianceSource[]; farms: ComplianceFarm[]; warnings: string[]; loadedAt: string }

/** Reuse Cycle Master's farm and standalone lineage, under the signed-in user's RLS. */
export async function getBroilerDataCompliance(scope: ComplianceCycleScope = 'current'): Promise<ComplianceDataset> {
  const farms = await listAssignedUserFarmOptions(['BR'], { requireComplete: true })
  const assignments = await listFarmAssignedUsers(farms, USER_TYPES.USER)
  const farmCatalog: ComplianceFarm[] = []
  const sources: ComplianceSource[] = []
  const warnings: string[] = []
  // Bound concurrent farm work. Any failed read rejects the complete report:
  // silently omitting a farm would produce a misleading compliance percentage.
  for (let offset = 0; offset < farms.length; offset += 3) {
    const results = await Promise.all(farms.slice(offset, offset + 3).map(async farm => {
      const [profile, catalog] = await Promise.all([getActiveFarmById(farm.id), getCycleMasterListRows(farm.id, { requireComplete: true })])
      const assignedTas = assignments.get(farm.id) ?? []
      const region = profile.region?.trim() || 'Region not set'
      farmCatalog.push({ id: farm.id, name: farm.name, region, assignedTas })
      const cycles = catalog.filter(cycle => scope === 'current' ? cycle.status === 'Saved' : cycle.status !== 'Cancelled')
      const rows: ComplianceSource[] = []
      for (const cycle of cycles) {
        const report = cycle.kind === 'farm'
          ? await getBroilerCycleReport(cycle.id, { postedOnly: true, requireComplete: true })
          : await getBroilerBuildingCycleReport(farm.id, cycle.id, { requireComplete: true })
        if (!report || report.farmId !== farm.id) throw new Error(`Unable to load cycle ${cycle.cycleMask || cycle.id} for ${farm.name}.`)
        for (const building of report.buildings) {
          rows.push({ farmId: farm.id, farmName: farm.name, region, assignedTas,
            ta: assignedTas.map(user => user.name).join(', ') || null, cycleKey: `${farm.id}:${cycle.kind}:${cycle.id}`, cycleLabel: cycle.cycleMask || building.cycleLabel || String(cycle.cycleNumber),
            cycleStatus: report.status, closedAt: report.closedAt || cycle.closedAt || '', building })
        }
        if (!report.buildings.length) warnings.push(`${farm.name}: cycle ${cycle.cycleMask || cycle.id} has no visible building records and cannot be scored.`)
      }
      return rows
    }))
    sources.push(...results.flat())
  }
  return { sources, farms: farmCatalog.sort((a, b) => a.name.localeCompare(b.name)), warnings, loadedAt: new Date().toISOString() }
}
