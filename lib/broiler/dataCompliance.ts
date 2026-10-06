import type { BroilerCycleBuilding, CycleEncodingMetadata } from '@/lib/data/repositories/broilerCycleReport'
import { activeGrowingLines, movementQuantity } from './cycleDashboard'
import type { FarmAssignedUser } from '@/lib/data/repositories/farmAssignedUsers'
import type { ComplianceFarm } from '@/lib/data/repositories/broilerDataCompliance'

export const COMPLIANCE_STAGES = ['placement', 'growing', 'harvest', 'cleanup'] as const
export type ComplianceStage = typeof COMPLIANCE_STAGES[number]
export type ComplianceStatus = 'updated' | 'overdue' | 'not-due' | 'review' | 'not-assessed'
export const COMPLIANCE_LABELS: Record<ComplianceStatus, string> = {
  updated: 'Updated', overdue: 'Overdue', 'not-due': 'Not yet due', review: 'Needs review', 'not-assessed': 'No deadline',
}
export const COMPLIANCE_RULE = 'Compliance covers posted Placement and daily Growing entries from age 1. A Growing day counts when at least one measurement is saved; this does not certify every field is complete. Harvest and Cleanup dates are shown but are not scored without agreed deadlines.'
export const COMPLIANCE_HISTORY_NOTE = 'Evaluated from currently saved records, not a historical audit snapshot. Encoding timestamps may reflect later edits. TA assignment history is not available.'

export type ComplianceSource = {
  farmId: number
  farmName: string
  island: string
  region: string
  ta: string | null
  assignedTas: FarmAssignedUser[]
  cycleKey: string
  cycleLabel: string
  cycleStatus: string
  closedAt: string
  building: BroilerCycleBuilding
}
export type StageCompliance = {
  status: ComplianceStatus
  latestDate: string | null
  latestSavedAt: string | null
  daysLate: number
  missingDates: string[]
  note: string
}
export type ComplianceRow = Omit<ComplianceSource, 'building'> & {
  key: string
  building: BroilerCycleBuilding
  buildingId: number | null
  buildingName: string
  cardNo: string
  status: ComplianceStatus
  daysLate: number
  stages: Record<ComplianceStage, StageCompliance>
}

/** Calendar dates only: UTC arithmetic avoids local timezone and DST shifts. */
export function complianceDate(value: string | null | undefined): string | null {
  const date = (value ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null
}
export function shiftComplianceDate(date: string, days: number): string {
  if (!complianceDate(date)) throw new Error('Choose a valid reporting date.')
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}
export function manilaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
const latest = (values: (string | null | undefined)[]) => values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null
const savedAt = (rows: CycleEncodingMetadata[]) => latest(rows.flatMap(row => [row.createdAt, row.updatedAt]))
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)

export function buildComplianceRow(source: ComplianceSource, asOf: string, cutoff: 'yesterday' | 'today', fromDate?: string): ComplianceRow | null {
  if (!complianceDate(asOf)) throw new Error('Choose a valid reporting date.')
  const rangeStart = fromDate ? complianceDate(fromDate) : null
  if (fromDate && !rangeStart) throw new Error('Choose a valid From Date.')
  if (rangeStart && rangeStart > asOf) throw new Error('From Date cannot be after To Date.')
  const building = source.building
  if (building.isVoided || building.status === 'Cancelled' || source.cycleStatus === 'Cancelled') return null
  const start = complianceDate(building.startDate)
  if (start && start > asOf) return null
  const closed = complianceDate(source.closedAt)
  if (rangeStart && closed && closed < rangeStart) return null
  const dueThrough = shiftComplianceDate(asOf, cutoff === 'yesterday' ? -1 : 0)
  const inRange = (date: string) => (!rangeStart || date >= rangeStart) && date <= asOf
  const allPlacements = building.placements.filter(row => !row.isVoided && row.status === 'Posted' && complianceDate(row.receiveDate) && row.receiveDate.slice(0, 10) <= asOf)
  const allHarvests = building.deliveries.filter(row => !row.isVoided && row.status === 'Posted' && complianceDate(row.date) && row.date.slice(0, 10) <= asOf)
  const allCleanups = building.cleanups.filter(row => !row.isVoided && row.status === 'Posted' && complianceDate(row.date) && row.date.slice(0, 10) <= asOf)
  const allGrowing = activeGrowingLines(building).filter(line => start && Number.isInteger(line.age) && line.age >= 0 && shiftComplianceDate(start, line.age) <= asOf)
  const placements = allPlacements.filter(row => inRange(row.receiveDate.slice(0, 10)))
  const harvests = allHarvests.filter(row => inRange(row.date.slice(0, 10)))
  const cleanups = allCleanups.filter(row => inRange(row.date.slice(0, 10)))
  const growing = allGrowing.filter(line => start && inRange(shiftComplianceDate(start, line.age)))
  const stage = (dates: (string | null)[], records: CycleEncodingMetadata[]): StageCompliance => ({
    status: dates.some(Boolean) ? 'updated' : 'not-assessed', latestDate: latest(dates), latestSavedAt: savedAt(records), daysLate: 0, missingDates: [], note: '',
  })
  const placement = stage(placements.map(row => complianceDate(row.receiveDate)), placements)
  const daily = stage(growing.map(line => start ? shiftComplianceDate(start, line.age) : null), growing)
  const harvest = stage(harvests.map(row => complianceDate(row.date)), harvests)
  const cleanup = stage(cleanups.map(row => complianceDate(row.date)), cleanups)
  harvest.note = cleanup.note = 'No agreed deadline. Recorded dates are informational and excluded from compliance scoring.'
  if (!start) {
    placement.status = daily.status = 'review'
    placement.note = daily.note = 'Missing or invalid cycle start date.'
  } else {
    if (rangeStart && start < rangeStart) {
      placement.status = 'not-assessed'
      placement.note = 'Placement falls before the selected date range.'
    } else if (!placement.latestDate) {
      placement.status = start <= dueThrough ? 'overdue' : 'not-due'
      placement.daysLate = placement.status === 'overdue' ? daysBetween(start, dueThrough) + 1 : 0
      placement.note = 'No posted Placement record is visible for this building cycle.'
    }
    let end = dueThrough
    // A Cleanup ends Growing; a partial harvest does not. Use known live-bird
    // depletion only when every harvest quantity can be expressed in heads.
    const firstCleanup = allCleanups.map(row => row.date.slice(0, 10)).sort()[0]
    if (firstCleanup && firstCleanup < end) end = firstCleanup
    const headCounts = allHarvests.map(row => movementQuantity(row, 'heads'))
    const losses = allGrowing.reduce((sum, line) => sum + (line.mortalityTotal || line.mortalityAm + line.mortalityPm) + line.thinningAm + line.thinningPm, 0)
    const fullyHarvested = allHarvests.length > 0 && building.startingPopulation > 0 && headCounts.every(count => count !== null)
      && headCounts.reduce<number>((sum, count) => sum + (count ?? 0), 0) + losses >= building.startingPopulation
    const finalHarvestDate = latest(allHarvests.map(row => complianceDate(row.date)))
    if (fullyHarvested && finalHarvestDate && finalHarvestDate < end) end = finalHarvestDate
    if (building.status === 'Closed' && closed && closed < end) end = closed
    const endAge = daysBetween(start, end)
    const rangeStartAge = rangeStart ? Math.max(1, daysBetween(start, rangeStart)) : 1
    const unknownEnd = building.status === 'Closed' && !closed && !firstCleanup && !fullyHarvested
    if (unknownEnd || endAge > 45) {
      daily.status = 'review'
      daily.note = unknownEnd ? 'Closed building has no verifiable completion date.' : 'Growing extends beyond the supported age 0–45 grid; verify the cycle completion date.'
    } else if (endAge < rangeStartAge) {
      daily.status = 'not-due'
      daily.note = rangeStart ? 'No daily Growing updates are due in the selected date range.' : 'Daily Growing is evaluated from age 1.'
    } else {
      const recordedAges = new Set(growing.map(line => line.age))
      daily.missingDates = Array.from({ length: endAge - rangeStartAge + 1 }, (_, index) => index + rangeStartAge)
        .filter(age => !recordedAges.has(age)).map(age => shiftComplianceDate(start, age))
      daily.status = daily.missingDates.length ? 'overdue' : 'updated'
      daily.daysLate = daily.missingDates.length ? daysBetween(daily.missingDates[0], dueThrough) + 1 : 0
      daily.note = `Required through ${end}. ${daily.missingDates.length} missing day(s).`
    }
  }
  const assessed = [placement, daily]
  const status: ComplianceStatus = assessed.some(value => value.status === 'overdue') ? 'overdue'
    : assessed.some(value => value.status === 'review') ? 'review'
      : assessed.some(value => value.status === 'updated') ? 'updated' : 'not-due'
  return {
    farmId: source.farmId, farmName: source.farmName, island: source.island, region: source.region, ta: source.ta, assignedTas: source.assignedTas,
    cycleKey: source.cycleKey, cycleLabel: source.cycleLabel, cycleStatus: source.cycleStatus, closedAt: source.closedAt,
    building,
    key: `${source.farmId}:${source.cycleKey}:${building.flockCardId}`, buildingId: building.buildingWarehouseId,
    buildingName: building.buildingName || building.buildingCode || building.cardNo, cardNo: building.cardNo,
    status, daysLate: Math.max(...assessed.map(value => value.daysLate)), stages: { placement, growing: daily, harvest, cleanup },
  }
}

export function complianceSummary(rows: ComplianceRow[]) {
  const updated = rows.filter(row => row.status === 'updated').length
  const overdue = rows.filter(row => row.status === 'overdue')
  const due = updated + overdue.length
  return {
    total: rows.length, due, updated, overdue: overdue.length,
    review: rows.filter(row => row.status === 'review').length,
    notDue: rows.filter(row => row.status === 'not-due').length,
    compliance: due ? updated / due * 100 : null,
    farmsWithDelays: new Set(overdue.map(row => row.farmId)).size,
    tasWithDelays: new Set(overdue.flatMap(row => row.assignedTas.map(user => user.id))).size,
    unassigned: rows.filter(row => !row.assignedTas.length).length,
    longestDelay: Math.max(0, ...overdue.map(row => row.daysLate)),
  }
}

export function groupCompliance(rows: ComplianceRow[], by: 'island' | 'region' | 'farm' | 'ta') {
  const groups = new Map<string, { label: string; rows: ComplianceRow[] }>()
  for (const row of rows) {
    const entries = by === 'ta'
      ? row.assignedTas.length ? row.assignedTas.map(user => ({ key: String(user.id), label: user.name })) : [{ key: 'unassigned', label: 'Unassigned' }]
      : [{ key: by === 'farm' ? String(row.farmId) : by === 'island' ? row.island : row.region, label: by === 'farm' ? row.farmName : by === 'island' ? row.island : row.region }]
    for (const { key, label } of entries) {
      const group = groups.get(key) ?? { label, rows: [] }
      group.rows.push(row)
      groups.set(key, group)
    }
  }
  return [...groups].map(([key, group]) => ({
    key, label: group.label, ...complianceSummary(group.rows),
    short: group.rows.filter(row => row.daysLate >= 1 && row.daysLate <= 2).length,
    medium: group.rows.filter(row => row.daysLate >= 3 && row.daysLate <= 5).length,
    long: group.rows.filter(row => row.daysLate >= 6).length,
  })).sort((a, b) => b.overdue - a.overdue || a.label.localeCompare(b.label))
}

function matchesSelection(value: string, selection: string | string[]) {
  return Array.isArray(selection) ? !selection.length || selection.includes(value) : !selection || selection === value
}

export function complianceDateInRange(value: string | null | undefined, fromDate?: string, toDate?: string) {
  if (!fromDate && !toDate) return true
  const date = complianceDate(value)
  return Boolean(date && (!fromDate || date >= fromDate) && (!toDate || date <= toDate))
}

export function filterComplianceRows(rows: ComplianceRow[], filters: { island?: string; region: string; farm: string | string[]; ta: string; cycle: string | string[]; status: string; fromDate?: string; toDate?: string }) {
  return rows.filter(row => (!filters.island || row.island === filters.island)
    && (!filters.region || row.region === filters.region)
    && matchesSelection(String(row.farmId), filters.farm)
    && matchesSelection(row.cycleKey, filters.cycle)
    && complianceDateInRange(row.building.startDate, filters.fromDate, filters.toDate)
    && (!filters.status || row.status === filters.status)
    && (!filters.ta || (filters.ta === 'unassigned' ? !row.assignedTas.length : row.assignedTas.some(user => String(user.id) === filters.ta))))
    .map(row => {
      if (!filters.ta || filters.ta === 'unassigned') return row
      const assignedTas = row.assignedTas.filter(user => String(user.id) === filters.ta)
      return { ...row, assignedTas, ta: assignedTas.map(user => user.name).join(', ') || null }
    })
}

export function complianceFilterOptions(catalog: ComplianceFarm[], island: string, region: string, farm: string | string[]) {
  const farms = catalog.filter(item => (!island || item.island === island) && (!region || item.region === region))
  const selectedFarms = farms.filter(item => matchesSelection(String(item.id), farm))
  const tas = [...new Map(selectedFarms.flatMap(item => item.assignedTas.map(user => [String(user.id), user] as const))).values()]
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
  return { islands: [...new Set(catalog.map(item => item.island))].sort(), regions: [...new Set(catalog.filter(item => !island || item.island === island).map(item => item.region))].sort(), farms, tas,
    hasUnassigned: selectedFarms.some(item => !item.assignedTas.length) }
}

const percentage = (numerator: number, denominator: number) => denominator ? numerator / denominator * 100 : null

export type DataAccuracyRow = {
  key: string
  label: string
  total: number
  placement: number | null
  growing: number | null
  harvest: number | null
  cleanup: number | null
  overallUpdated: number | null
}

/** Stage coverage proxy; it measures saved/up-to-date records, not field-value correctness. */
export function dataAccuracyBy(rows: ComplianceRow[], by: 'island' | 'farm'): DataAccuracyRow[] {
  const groups = new Map<string, { label: string; rows: ComplianceRow[] }>()
  for (const row of rows) {
    const key = by === 'farm' ? String(row.farmId) : row.island
    const label = by === 'farm' ? row.farmName : row.island
    const group = groups.get(key) ?? { label, rows: [] }
    group.rows.push(row)
    groups.set(key, group)
  }
  return [...groups].map(([key, group]) => {
    const total = group.rows.length
    const stageScore = (stage: ComplianceStage) => percentage(group.rows.filter(row => row.stages[stage].status === 'updated').length, total)
    const updatedStages = group.rows.reduce((sum, row) => sum + COMPLIANCE_STAGES.filter(stage => row.stages[stage].status === 'updated').length, 0)
    return {
      key,
      label: group.label,
      total,
      placement: stageScore('placement'),
      growing: stageScore('growing'),
      harvest: stageScore('harvest'),
      cleanup: stageScore('cleanup'),
      overallUpdated: percentage(updatedStages, total * COMPLIANCE_STAGES.length),
    }
  }).sort((a, b) => a.label.localeCompare(b.label))
}

export type FarmDataScorecard = DataAccuracyRow & {
  island: string
  currentStage: string
  latestData: string | null
  updateStatus: 'Updated' | 'Not Updated'
}

export function farmDataScorecards(rows: ComplianceRow[]): FarmDataScorecard[] {
  const accuracy = dataAccuracyBy(rows, 'farm')
  return accuracy.map(score => {
    const farmRows = rows.filter(row => String(row.farmId) === score.key)
    const latestData = latest(farmRows.flatMap(row => COMPLIANCE_STAGES.map(stage => row.stages[stage].latestDate)))
    const currentStage = [...COMPLIANCE_STAGES].reverse().find(stage => farmRows.some(row => row.stages[stage].latestDate === latestData))
    return {
      ...score,
      island: farmRows[0]?.island ?? 'Island not set',
      currentStage: currentStage ? currentStage[0].toUpperCase() + currentStage.slice(1) : 'Not started',
      latestData,
      updateStatus: farmRows.some(row => row.status === 'overdue') ? 'Not Updated' : 'Updated',
    }
  })
}

export type TaMonthlyCompliance = {
  key: string
  label: string
  requiredUpdates: number
  onTimeUpdates: number
  compliance: number | null
  kpiStatus: 'Meets' | 'Below Target' | 'Needs Improvement' | 'Not assessed'
}

function manilaDateTime(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return manilaToday(date)
}

/** Current-month timeliness based on initial createdAt timestamps and required activity dates. */
export function taPeriodCompliance(rows: ComplianceRow[], fromDate: string, toDate: string, target = 95): TaMonthlyCompliance[] {
  if (!complianceDate(fromDate) || !complianceDate(toDate) || fromDate > toDate) throw new Error('Choose a valid report date range.')
  const dueThrough = shiftComplianceDate(toDate, -1)
  const groups = new Map<string, { label: string; required: number; onTime: number }>()
  for (const row of rows) {
    const obligations: { dueDate: string; createdAt?: string }[] = []
    const start = complianceDate(row.building.startDate)
    if (start && start >= fromDate && start <= dueThrough) {
      const placement = row.building.placements
        .filter(item => !item.isVoided && item.status === 'Posted')
        .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')))[0]
      obligations.push({ dueDate: start, createdAt: placement?.createdAt })
    }
    if (start && row.stages.growing.status !== 'review' && row.stages.growing.status !== 'not-due') {
      const recorded = activeGrowingLines(row.building)
        .filter(line => Number.isInteger(line.age) && line.age >= 1)
        .map(line => ({ dueDate: shiftComplianceDate(start, line.age), createdAt: line.createdAt }))
      const missing = row.stages.growing.missingDates.map(dueDate => ({ dueDate }))
      const byDate = new Map([...recorded, ...missing].filter(item => item.dueDate >= fromDate && item.dueDate <= dueThrough).map(item => [item.dueDate, item]))
      obligations.push(...byDate.values())
    }
    for (const ta of row.assignedTas) {
      const group = groups.get(String(ta.id)) ?? { label: ta.name, required: 0, onTime: 0 }
      group.required += obligations.length
      group.onTime += obligations.filter(item => {
        const savedDate = manilaDateTime(item.createdAt)
        return Boolean(savedDate && savedDate <= item.dueDate)
      }).length
      groups.set(String(ta.id), group)
    }
  }
  return [...groups].map(([key, group]) => {
    const compliance = percentage(group.onTime, group.required)
    const kpiStatus: TaMonthlyCompliance['kpiStatus'] = compliance === null ? 'Not assessed' : compliance >= target ? 'Meets' : compliance >= 85 ? 'Below Target' : 'Needs Improvement'
    return { key, label: group.label, requiredUpdates: group.required, onTimeUpdates: group.onTime, compliance, kpiStatus }
  }).sort((a, b) => (b.compliance ?? -1) - (a.compliance ?? -1) || a.label.localeCompare(b.label))
}

export function taMonthlyCompliance(rows: ComplianceRow[], asOf: string, target = 95): TaMonthlyCompliance[] {
  return taPeriodCompliance(rows, `${asOf.slice(0, 7)}-01`, asOf, target)
}
