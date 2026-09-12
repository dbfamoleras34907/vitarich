import type { CycleGrowingLine, CycleMovementRecord, CyclePlacementRecord } from '@/lib/data/repositories/broilerCycleReport'
import type { DashboardBuilding, DashboardCycleBuilding } from '@/lib/data/repositories/broilerCycleDashboard'
import { getBroilerDepletionSummary } from './performance'
import {
  calculateFeedDailyPerBird, calculateWaterDailyPerBird,
  getBodyWeightGuidelineGrams, getFeedGuidelineGramsPerBird, getWaterGuidelineMillilitersPerBird,
} from '@/app/brd/fc/new/gridMath'

export function selectDashboardBuilding(buildings: DashboardBuilding[], selected: string) {
  if (selected === 'all') return 'all'
  return buildings.find(building => building.key === selected)?.key
    ?? buildings.find(building => building.cycles.some(cycle => cycle.status === 'Saved'))?.key
    ?? buildings.find(building => building.cycles.length)?.key ?? buildings[0]?.key ?? ''
}

export function calendarAge(startDate: string, today = new Date()): number | null {
  if (!startDate) return null
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(today)
  const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`)) / 86400000
  return Number.isFinite(days) ? Math.min(45, Math.max(0, Math.floor(days))) : null
}

export function goodBirdPlacements(rows: CyclePlacementRecord[]) {
  return [...new Map(rows.filter(row => row.status === 'Posted' && !row.isVoided && row.isGoodBirdItem !== false)
    .map(row => [`${row.documentId}:${row.id}`, row])).values()]
}

export function growingWaterLiters(line: CycleGrowingLine, population: number) {
  if (line.hasWater && line.waterLiters > 0) return line.waterLiters
  if (line.waterPerBird > 0) return line.waterPerBird * Math.max(0, population - line.cumulative) / 1000
  return line.hasWater ? line.waterLiters : null
}

export function activeGrowingLines(building: DashboardCycleBuilding) {
  return building.growingLines.filter(line => !line.isVoided &&
    (line.hasMortality || line.hasFeed || line.hasWater || line.waterPerBird > 0 || line.hasWeight)).sort((a, b) => a.age - b.age)
}

export function movementQuantity(row: CycleMovementRecord, kind: 'heads' | 'kg'): number | null {
  const convert = (quantity: number, unit: string) => {
    const normalized = unit.trim().toUpperCase()
    if (kind === 'heads') return ['HEAD', 'HEADS', 'HD', 'HDS', 'BIRD', 'BIRDS', 'PC', 'PCS'].includes(normalized) ? quantity : null
    if (['KG', 'KGS', 'KILOGRAM', 'KILOGRAMS'].includes(normalized)) return quantity
    if (['G', 'GRAM', 'GRAMS'].includes(normalized)) return quantity / 1000
    return null
  }
  return convert(row.baseQuantity, row.baseUom) ?? convert(row.quantity, row.uom)
}

function movementTotal(rows: CycleMovementRecord[], kind: 'heads' | 'kg') {
  if (!rows.length) return kind === 'heads' ? 0 : null
  const values = rows.map(row => movementQuantity(row, kind))
  return values.some(value => value === null) ? null : values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
}

const nullableSum = (values: (number | null)[]) => values.length && values.every(value => value !== null)
  ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null

/** Running estimate using the existing report's live-bird basis, not a final harvest FCR. */
export function estimatedFcr(feedKg: number | null, remainingBirds: number | null, weightGrams: number | null) {
  return feedKg !== null && remainingBirds !== null && remainingBirds > 0 && weightGrams !== null && weightGrams > 0
    ? feedKg / (remainingBirds * weightGrams / 1000) : null
}

function measuredSum(lines: CycleGrowingLine[], kind: 'feed' | 'water') {
  const measured = lines.filter(line => kind === 'feed' ? line.hasFeed : line.hasWater)
  return measured.length ? measured.reduce((sum, line) => sum + (kind === 'feed' ? line.feedActual : line.waterLiters), 0) : null
}

function startingPopulation(building: DashboardCycleBuilding): number | null {
  if (!building.startDate) return null
  const startDate = building.startDate.slice(0, 10)
  const receipts = building.placements.filter(row =>
    row.status === 'Posted' && !row.isVoided && row.receiveDate.slice(0, 10) === startDate)
  // A DOC detail can appear more than once when it has multiple inventory items.
  const uniqueReceipts = new Map(receipts.map(row => [`${row.documentId}:${row.id}`, row]))
  return nullableSum([...uniqueReceipts.values()].map(row => row.actualReceived))
}

export function buildingMetrics(building: DashboardCycleBuilding) {
  const lines = activeGrowingLines(building)
  const mortalityLines = lines.filter(line => line.hasMortality)
  const depletionLines = mortalityLines.map(line => {
    const mortalityTotal = line.mortalityTotal || line.mortalityAm + line.mortalityPm
    const thinningTotal = line.thinningAm + line.thinningPm
    return { mortalityTotal, thinningTotal, depletionTotal: line.thinningTotal || mortalityTotal + thinningTotal }
  })
  const population = building.placements.length ? building.startingPopulation : null
  const placed = nullableSum([...new Map(building.placements.filter(row => row.status === 'Posted' && !row.isVoided)
    .map(row => [`${row.documentId}:${row.id}`, row.actualReceived])).values()])
  const depletion = getBroilerDepletionSummary(population ?? 0, depletionLines)
  const latestWeight = [...lines].reverse().find(line => line.hasWeight && line.actualWeight > 0)
    ?? [...lines].reverse().find(line => line.hasWeight)
  const weight = latestWeight?.actualWeight ?? null
  const standardWeight = latestWeight
    ? latestWeight.standardWeight || getBodyWeightGuidelineGrams(latestWeight.age, building.breed) || null : null
  const feed = measuredSum(lines, 'feed')
  const deliveredHeads = movementTotal(building.deliveries, 'heads')
  const cleanupHeads = movementTotal(building.cleanups, 'heads')
  const remaining = population === null || deliveredHeads === null || cleanupHeads === null ? null
    : Math.max(0, depletion.currentLiveBirds - deliveredHeads - cleanupHeads)
  const waterValues = lines.map(line => growingWaterLiters(line, building.startingPopulation)).filter((value): value is number => value !== null)
  const closedDate = building.status === 'Closed'
    ? building.cleanups.map(row => row.date).filter(Boolean).sort().at(-1) || building.cycleClosedAt : undefined
  return {
    startingPopulation: startingPopulation(building), population, placed, remaining, cleanupHeads,
    mortality: mortalityLines.length ? depletion.totalMortality : null,
    mortalityPercent: mortalityLines.length && population ? depletion.cumulativeMortality : null,
    thinning: mortalityLines.length ? depletion.totalThinning : null,
    feed, water: waterValues.length ? waterValues.reduce((sum, value) => sum + value, 0) : null, weight, standardWeight,
    weightAge: latestWeight?.age ?? null,
    calendarAge: building.status === 'Closed' && !closedDate ? null
      : calendarAge(building.startDate, closedDate ? new Date(closedDate.length > 10 ? closedDate : `${closedDate}T12:00:00+08:00`) : undefined),
    postedAge: lines.length ? Math.min(45, lines.at(-1)!.age) : null,
    deliveredHeads,
    deliveredKg: movementTotal(building.deliveries, 'kg'),
    fcr: estimatedFcr(feed, remaining, weight),
  }
}

export function dashboardMetrics(buildings: DashboardCycleBuilding[]) {
  const metrics = buildings.map(buildingMetrics)
  const population = nullableSum(metrics.map(metric => metric.population))
  const remaining = nullableSum(metrics.map(metric => metric.remaining))
  const mortality = nullableSum(metrics.map(metric => metric.mortality))
  const weighted = (field: 'weight' | 'standardWeight') => {
    if (metrics.length === 1) return metrics[0][field]
    if (!metrics.length || metrics.some(metric => metric[field] === null || metric.population === null)) return null
    return population && population > 0
      ? metrics.reduce((sum, metric) => sum + (metric[field] ?? 0) * (metric.population ?? 0), 0) / population : null
  }
  return {
    startingPopulation: nullableSum(metrics.map(metric => metric.startingPopulation)),
    population, remaining, mortality,
    placed: nullableSum(metrics.map(metric => metric.placed)),
    thinning: nullableSum(metrics.map(metric => metric.thinning)),
    cleanupHeads: nullableSum(metrics.map(metric => metric.cleanupHeads)),
    mortalityPercent: mortality !== null && population ? mortality / population * 100 : null,
    feed: nullableSum(metrics.map(metric => metric.feed)),
    water: nullableSum(metrics.map(metric => metric.water)),
    weight: weighted('weight'), standardWeight: weighted('standardWeight'),
    deliveredHeads: movementTotal([...new Map(buildings.flatMap(building => building.deliveries).map(row => [row.id, row])).values()], 'heads'),
    deliveredKg: movementTotal([...new Map(buildings.flatMap(building => building.deliveries).map(row => [row.id, row])).values()], 'kg'),
    fcr: estimatedFcr(nullableSum(metrics.map(metric => metric.feed)), remaining, weighted('weight')),
    calendarAges: metrics.map(metric => metric.calendarAge),
    postedAges: metrics.map(metric => metric.postedAge),
    weightAges: metrics.map(metric => metric.weightAge),
  }
}

export type PerformancePoint = {
  age: number
  mortality: number | null
  cumulativeMortality: number | null
  weight: number | null
  standardWeight: number | null
  feed: number | null
  standardFeed: number | null
  water: number | null
  standardWater: number | null
  birds: number
}

export function buildingPerformance(building: DashboardCycleBuilding): PerformancePoint[] {
  let depletion = 0
  let cumulativeMortality = 0
  return activeGrowingLines(building).filter(line => line.age <= 45).map(line => {
    const mortality = line.mortalityTotal || line.mortalityAm + line.mortalityPm
    if (line.hasMortality) {
      depletion += line.thinningTotal || mortality + line.thinningAm + line.thinningPm
      cumulativeMortality += mortality
    }
    const args = { numberOfAnimals: building.startingPopulation, cumulativeTotal: depletion }
    const birds = Math.max(0, building.startingPopulation - depletion)
    return {
      age: line.age, birds,
      mortality: line.hasMortality ? mortality : null,
      cumulativeMortality: line.hasMortality ? cumulativeMortality : null,
      weight: line.hasWeight ? line.actualWeight : null,
      standardWeight: line.standardWeight || getBodyWeightGuidelineGrams(line.age, building.breed) || null,
      feed: line.hasFeed && birds > 0 ? calculateFeedDailyPerBird({ ...args, dailyKgFlock: line.feedActual }) : null,
      standardFeed: line.feedStandard || getFeedGuidelineGramsPerBird(line.age, building.breed) || null,
      water: growingWaterLiters(line, building.startingPopulation) !== null && birds > 0
        ? calculateWaterDailyPerBird({ ...args, dailyLitersFlock: growingWaterLiters(line, building.startingPopulation)! }) : null,
      standardWater: line.waterGuideline || getWaterGuidelineMillilitersPerBird(line.age, building.breed) || null,
    }
  })
}

export function dashboardPerformance(buildings: DashboardCycleBuilding[]): PerformancePoint[] {
  if (buildings.length === 1) return buildingPerformance(buildings[0])
  const byAge = new Map<number, PerformancePoint[]>()
  for (const building of buildings) for (const point of buildingPerformance(building)) {
    byAge.set(point.age, [...(byAge.get(point.age) ?? []), point])
  }
  return [...byAge.entries()].sort(([a], [b]) => a - b).map(([age, points]) => {
    const weighted = (key: 'weight' | 'feed' | 'water', standard: 'standardWeight' | 'standardFeed' | 'standardWater') => {
      const measured = points.filter(point => point[key] !== null && point.birds > 0)
      const birds = measured.reduce((sum, point) => sum + point.birds, 0)
      return {
        actual: birds ? measured.reduce((sum, point) => sum + (point[key] ?? 0) * point.birds, 0) / birds : null,
        standard: birds && measured.every(point => point[standard] !== null)
          ? measured.reduce((sum, point) => sum + (point[standard] ?? 0) * point.birds, 0) / birds : null,
      }
    }
    const weight = weighted('weight', 'standardWeight')
    const feed = weighted('feed', 'standardFeed')
    const water = weighted('water', 'standardWater')
    // Do not present an incomplete age as a farm-wide mortality total.
    const complete = points.length === buildings.length
    return {
      age, birds: points.reduce((sum, point) => sum + point.birds, 0),
      mortality: complete ? nullableSum(points.map(point => point.mortality)) : null,
      cumulativeMortality: complete ? nullableSum(points.map(point => point.cumulativeMortality)) : null,
      weight: weight.actual, standardWeight: weight.standard,
      feed: feed.actual, standardFeed: feed.standard,
      water: water.actual, standardWater: water.standard,
    }
  })
}

export function ageRange(values: (number | null)[]) {
  const present = values.filter((value): value is number => value !== null)
  if (!present.length) return '—'
  const min = Math.min(...present), max = Math.max(...present)
  const label = min === max ? String(min) : `${min}–${max}`
  return `${label}${present.length < values.length ? ' (partial)' : ''}`
}
