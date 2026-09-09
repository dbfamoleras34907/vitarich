// Run: node scripts/tests/cycle-dashboard.cjs
// Executes the real TypeScript repositories/calculations against in-memory data.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')
function loader(mocks = {}) {
  const cache = new Map()
  function load(filename) {
    let resolved = path.resolve(root, filename)
    if (!path.extname(resolved)) resolved += '.ts'
    if (resolved.endsWith('.json')) return JSON.parse(fs.readFileSync(resolved, 'utf8'))
    if (cache.has(resolved)) return cache.get(resolved).exports
    const mod = { exports: {} }
    cache.set(resolved, mod)
    const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    const localRequire = specifier => {
      if (specifier in mocks) return mocks[specifier]
      if (specifier.startsWith('@/')) return load(specifier.slice(2))
      if (specifier.startsWith('.')) return load(path.resolve(path.dirname(resolved), specifier))
      return require(specifier)
    }
    new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports)
    return mod.exports
  }
  return load
}

function database(tables) {
  return { from(table) {
    let rows = structuredClone(tables[table] ?? [])
    let single = false
    let start = 0, end = 999
    const ordering = []
    const query = {
      select() { return query },
      eq(field, value) { rows = rows.filter(row => String(row[field]) === String(value)); return query },
      is(field, value) { rows = rows.filter(row => row[field] === value); return query },
      in(field, values) { rows = rows.filter(row => values.some(value => String(row[field]) === String(value))); return query },
      order(field, options) { ordering.push([field, options?.ascending === false ? -1 : 1]); return query },
      range(from, to) { start = from; end = to; return query },
      maybeSingle() { single = true; return query },
      then(resolve, reject) {
        rows.sort((a, b) => { for (const [field, direction] of ordering) { const diff = (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * direction; if (diff) return diff } return 0 })
        return Promise.resolve({ data: single ? rows[0] ?? null : rows.slice(start, end + 1), error: null }).then(resolve, reject)
      },
    }
    return query
  } }
}

const tables = {
  doc_farm_cycles: [{ id: 1, farm_id: 1, cycle_no: 7, status: 'Saved' }],
  farms: [{ id: 1, code: 'F1', name: 'Test Farm' }],
  flock_card: [
    { id: 10, farm_id: 1, farm_cycle_id: 1, card_no: 'FC10', building_whse_id: 100, building_code: 'B1', building_name: 'Building 1', cycle_no: 7, animal_qty: 100, start_date: '2026-09-01', status: 'Saved', void: '1', breed: 'Unknown' },
    { id: 11, farm_cycle_id: 1, card_no: 'FC11', building_whse_id: 101, status: 'Closed', void: '1' },
    { id: 12, farm_cycle_id: 1, card_no: 'FC12', building_whse_id: 102, status: 'Saved', void: '0' },
    { id: 13, farm_id: 1, farm_cycle_id: null, card_no: 'FC13', building_whse_id: 103, building_code: 'B2', building_name: 'Building 2', cycle_no: 'Backlog Cycle 7', animal_qty: 50, status: 'Saved', void: '1' },
  ],
  flock_card_origin: [{ id: 1, fc_id: 10, item_code: 'DOC', batch_no: 'BATCH1', animal_qty: 100, void: '1' }],
  goods_receipt_doc: [20, 21, 22, 23].map(id => ({ id, goods_reciept_id: id, line_no: 1, flock_card_id: 10, receive_date: '2026-09-01', actual_received: 100, void: id === 22 ? '0' : '1' })),
  goods_receipt: [
    { id: 20, gr_no: 'GR20', status: 'Posted' }, { id: 21, gr_no: 'GR21', status: 'Draft' },
    { id: 22, gr_no: 'GR22', status: 'Posted' }, { id: 23, gr_no: 'GR23', status: 'Cancelled' },
  ],
  goods_receipt_items: [20, 21, 22, 23].map(id => ({ goods_reciept_id: id, doc_line_no: 1, item_code: 'DOC', batch_number: 'BATCH1', void: '1' })),
  brd_fc: [
    { id: 50, card_no: 'FC10', fc_no: 'G50', status: 'Draft', void: '1' },
    { id: 51, card_no: 'FC10', fc_no: 'G51', status: 'Cancelled', void: '0' },
  ],
  brd_fc_line: [
    { id: 1, fc_id: 50, age: 0, feed_guideline: 15, body_guideline: 40, void: '1' },
    { id: 2, fc_id: 50, age: 1, mort_am: 0, mort_pm: 0, feed_kg: 0, water_l: 0, body_wt: 0, body_guideline: 50, void: '1' },
    { id: 3, fc_id: 50, age: 2, mort_am: 2, mort_pm: 0, mort_total: 2, thin_am: 1, thin_pm: 0, row_total: 3, cum_total: 3, feed_kg: 10, feed_guideline: 25, water_l: 15, body_wt: 120, body_guideline: 130, void: '1' },
    { id: 4, fc_id: 50, age: 3, mort_am: 90, feed_kg: 1000, body_wt: 1000, void: '0' },
    { id: 5, fc_id: 50, age: 45, body_guideline: 3000, feed_guideline: 200, void: '1' },
  ],
  br_delivery: [
    { id: 30, farm_id: 1, gi_no: 'DR30', status: 'Posted', from_warehouse_id: 100 },
    { id: 31, farm_id: 1, gi_no: 'DR31', status: 'Draft', from_warehouse_id: 100 },
    { id: 32, farm_id: 1, gi_no: 'DR32', status: 'Cancelled', from_warehouse_id: 100 },
  ],
  br_delivery_lines: [
    { id: 300, br_delivery_id: 30, item_code: 'DOC', batch_number: 'DOC:F1:B100:7', base_qty: 10, base_uom: 'HEAD', alt_qty: 20, alt_uom: 'KG', void: '1' },
    { id: 301, br_delivery_id: 30, item_code: 'DOC', batch_number: 'BATCH1', from_warehouse_id: 101, base_qty: 1000, base_uom: 'HEAD', void: '1' },
    { id: 302, br_delivery_id: 30, item_code: 'DOC', batch_number: 'PREVIOUS-CYCLE', base_qty: 1000, base_uom: 'HEAD', void: '1' },
    { id: 303, br_delivery_id: 31, item_code: 'DOC', batch_number: 'BATCH1', base_qty: 1000, base_uom: 'HEAD', void: '1' },
    { id: 304, br_delivery_id: 32, item_code: 'DOC', batch_number: 'BATCH1', base_qty: 1000, base_uom: 'HEAD', void: '1' },
    { id: 305, br_delivery_id: 30, item_code: 'DOC', batch_number: 'BATCH1', base_qty: 1000, base_uom: 'HEAD', void: '0' },
  ],
  br_cleanup: [{ id: 40, farm_id: 1, gi_no: 'CU40', status: 'Posted', from_warehouse_id: 100 }],
  br_cleanup_lines: [{ id: 400, br_cleanup_id: 40, item_code: 'DOC', batch_number: 'BATCH1', base_qty: 3, base_uom: 'HEAD', alt_qty: 3, alt_uom: 'HEAD', void: '1' }],
}

async function main() {
  const load = loader({ '@/lib/Supabase/supabaseClient': { db: database(tables) } })
  const { getBroilerCycleReport, getBroilerOpenBuildingCycleReport } = load('lib/data/repositories/broilerCycleReport.ts')
  const model = load('lib/broiler/cycleDashboard.ts')
  const { getBroilerDepletionSummary } = load('lib/broiler/performance.ts')
  const report = await getBroilerCycleReport(1, { postedOnly: true, openBuildingsOnly: true })
  assert.equal(report.buildings.length, 1, 'Closed and void buildings are excluded')
  const building = { ...report.buildings[0], cycleId: 1, cycleNumber: 7 }
  assert.deepEqual(building.placements.map(row => row.documentNo), ['GR20'])
  assert.deepEqual(building.deliveries.map(row => row.id), [300], 'Exclude drafts, reversals, other warehouses and other cycle batches')
  assert.equal(building.deliveries[0].documentId, 30)
  assert.equal(building.growingNumber, 'G50', 'Transactional daily saves are included despite Draft header')
  assert.equal(building.growingLines.some(row => row.id === 4), false)
  assert.deepEqual(model.activeGrowingLines(building).map(row => row.age), [1, 2], 'Guidelines alone do not advance posted age')
  const metrics = model.buildingMetrics(building)
  assert.equal(metrics.population, 100)
  assert.equal(metrics.startingPopulation, 100)
  const openingReceipt = building.placements[0]
  const openingPopulation = {
    ...building,
    startingPopulation: 350,
    placements: [
      { ...openingReceipt, quantityReceived: 120, doaQuantity: 10, rejectCount: 10 },
      { ...openingReceipt, itemCode: 'SECOND-ITEM', batchNumber: 'SECOND-BATCH' },
      { ...openingReceipt, id: 24, actualReceived: 50 },
      { ...openingReceipt, id: 25, actualReceived: 200, receiveDate: '2026-09-02' },
      { ...openingReceipt, id: 26, actualReceived: 1000, status: 'Draft' },
      { ...openingReceipt, id: 27, actualReceived: 1000, isVoided: true },
    ],
  }
  assert.equal(model.buildingMetrics(openingPopulation).startingPopulation, 150,
    'Sum Actual Received on cycle start date once per posted active receipt detail; exclude later receipts')
  assert.equal(model.buildingMetrics(openingPopulation).population, 350, 'Total placement still includes later receipts')
  assert.equal(model.buildingMetrics({ ...building, placements: [{ ...openingReceipt, actualReceived: 0 }] }).startingPopulation, 0)
  assert.equal(model.buildingMetrics({ ...building, placements: [] }).startingPopulation, null)
  assert.equal(model.buildingMetrics({ ...building, startDate: '' }).startingPopulation, null)
  assert.equal(model.buildingMetrics({ ...building, startDate: '2026-08-31' }).startingPopulation, null,
    'Do not substitute lifetime population when no receipt matches cycle start')
  const laterStartingBuilding = {
    ...building, flockCardId: 21, startDate: '2026-09-03',
    placements: [{ ...openingReceipt, id: 28, receiveDate: '2026-09-03', actualReceived: 75 }],
  }
  assert.equal(model.dashboardMetrics([openingPopulation, laterStartingBuilding]).startingPopulation, 225,
    'All Buildings uses each building cycle start date')
  assert.equal(metrics.remaining, 97, 'Match Flock Card depletion; delivery is separate')
  assert.equal(metrics.mortalityPercent, 2)
  assert.equal(metrics.thinning, 1)
  assert.equal(metrics.feed, 10)
  assert.equal(metrics.water, 15)
  assert.equal(metrics.weight, 120)
  assert.equal(metrics.postedAge, 2)
  assert.equal(metrics.deliveredHeads, 10)
  assert.equal(metrics.deliveredKg, 20, 'Use recorded UoM, not heads as kilograms')
  assert.equal(model.buildingPerformance(building)[1].feed, 10000 / 97)
  assert.equal(model.buildingPerformance(building)[1].water, 15000 / 97)
  const zero = model.buildingMetrics({ ...building, growingLines: [building.growingLines.find(row => row.id === 2)] })
  assert.equal(zero.mortality, 0)
  assert.equal(zero.feed, 0)
  assert.equal(zero.weight, 0, 'Recorded zero is preserved')
  const empty = model.buildingMetrics({ ...building, growingLines: [] })
  assert.equal(empty.mortality, null)
  assert.equal(empty.feed, null)
  assert.equal(empty.weight, null)
  assert.equal(empty.postedAge, null)
  assert.equal(model.buildingMetrics({ ...building, placements: [] }).population, null)
  const second = { ...building, flockCardId: 20, startingPopulation: 900, deliveries: [], growingLines: [{ ...building.growingLines.find(row => row.id === 3), mortalityAm: 9, mortalityTotal: 9, thin_am: 0, thinningAm: 0, thinningPm: 0, thinningTotal: 9, actualWeight: 200 }] }
  const combined = model.dashboardMetrics([building, second])
  assert(Math.abs(combined.mortalityPercent - 1.1) < 1e-12, 'Farm mortality uses total deaths / total placed, not mean percentages')
  assert.equal(combined.weight, (97 * 120 + 891 * 200) / 988)
  assert.equal(metrics.fcr, 10 / (97 * 120 / 1000))
  assert.equal(combined.fcr, 20 / (988 * combined.weight / 1000), 'Aggregate FCR uses total feed / total estimated live weight')
  assert.equal(model.estimatedFcr(0, 10, 100), 0)
  assert.equal(model.estimatedFcr(10, 0, 100), null)
  assert.equal(model.estimatedFcr(10, 10, 0), null)
  assert.equal(model.estimatedFcr(null, 10, 100), null)
  assert.equal(model.dashboardMetrics([building, building]).deliveredHeads, 10, 'Do not count the same delivery line twice')
  assert.equal(model.movementQuantity({ baseQuantity: 10, baseUom: 'HEAD', quantity: 10, uom: 'HEAD' }, 'kg'), null)
  assert.equal(model.calendarAge('2026-09-01', new Date('2026-09-08T16:01:00Z')), 8, 'Use Manila calendar date')
  assert.equal(model.calendarAge('', new Date()), null)
  assert.equal(model.calendarAge('2026-07-01', new Date('2026-09-09T00:00:00Z')), 70, 'Calendar age is not capped at 45')
  assert.equal(model.buildingMetrics({ ...building, status: 'Closed', cycleClosedAt: '2026-09-06T15:00:00Z', cleanups: [{ ...building.cleanups[0], date: '2026-09-04' }] }).calendarAge, 3, 'Recalled building age stops at its cleanup date')
  assert.equal(model.buildingMetrics({ ...building, status: 'Closed', cycleClosedAt: '2026-09-06T15:00:00Z', cleanups: [] }).calendarAge, 5)
  assert.equal(model.buildingMetrics({ ...building, status: 'Closed', cleanups: [] }).calendarAge, null)
  const tabs = [{ key: 'empty', cycles: [] }, { key: 'open', cycles: [building] }]
  assert.equal(model.selectDashboardBuilding(tabs, ''), 'open')
  assert.equal(model.selectDashboardBuilding(tabs, 'empty'), 'empty')
  assert.equal(model.selectDashboardBuilding(tabs, 'all'), 'all')
  assert.equal(model.selectDashboardBuilding([], ''), '')
  const historical = await getBroilerCycleReport(1)
  assert.equal(historical.buildings.length, 3, 'Default Cycle Master report still includes historical buildings')
  assert(historical.buildings[0].placements.some(row => row.status === 'Draft'))
  assert.equal(getBroilerDepletionSummary(100, [{ mortalityTotal: 2, thinningTotal: 1, depletionTotal: 3 }]).currentLiveBirds, 97)
  const standalone = await getBroilerOpenBuildingCycleReport(1, 13)
  assert.equal(standalone.buildings[0].cycleLabel, 'Backlog Cycle 7', 'Preserve excluded-building cycle labels')
  assert.equal(await getBroilerOpenBuildingCycleReport(2, 13), null, 'Standalone cycles must belong to the requested farm')
  assert.equal(await getBroilerOpenBuildingCycleReport(1, 10), null, 'Farm-owned cycles cannot be loaded as standalone')

  const largeTables = structuredClone(tables)
  largeTables.brd_fc_line = Array.from({ length: 1100 }, (_, index) => ({ id: index + 1, fc_id: 50, age: index, mort_am: 0, void: '1' }))
  largeTables.br_delivery = Array.from({ length: 1100 }, (_, index) => ({ id: index + 1, farm_id: 1, status: 'Posted', from_warehouse_id: 100 }))
  largeTables.br_delivery_lines = [{ id: 9000, br_delivery_id: 1100, item_code: 'DOC', batch_number: 'BATCH1', alt_qty: 7, alt_uom: 'HEAD', base_qty: 7, base_uom: 'HEAD', void: '1' }]
  const largeLoader = loader({ '@/lib/Supabase/supabaseClient': { db: database(largeTables) } })
  const largeReport = await largeLoader('lib/data/repositories/broilerCycleReport.ts').getBroilerCycleReport(1, { postedOnly: true, openBuildingsOnly: true })
  assert.equal(largeReport.buildings[0].growingLines.length, 1100, 'Growing must not truncate at the response row limit')
  assert.equal(largeReport.buildings[0].deliveries[0].id, 9000, 'Current deliveries remain visible beyond the first 1000 farm documents')

  let allowed = true, queried = 0, farmCycleRows = [
    { id: 1, cycleNumber: 7, status: 'Saved' }, { id: 2, cycleNumber: 8, status: 'Closed' },
    { id: 3, cycleNumber: 6, status: 'Cancelled' }, { id: 4, cycleNumber: 5, status: 'Saved' },
  ]
  const closedReport = { ...report, id: 2, cycleNumber: 8, status: 'Closed', buildings: [{ ...report.buildings[0], status: 'Closed', cycleLabel: '8' }] }
  const requests = []
  const loadDashboard = loader({
    './farmOptions.client': { listAssignedUserFarmOptions: async () => allowed ? [{ id: 1 }] : [] },
    './broilerFarmCycles': {
      getFarmCycleMasterRows: async () => { queried++; return farmCycleRows },
      getStandaloneBuildingCycleOptions: async () => [{ id: 13, cycleLabel: 'Backlog Cycle 7', buildingName: 'Building 2', status: 'Closed' }],
    },
    './broilerFlockCards': { getFarmBuildingsForFlockCard: async (_farmId, options) => { assert.equal(options.includePlacementInventory, false); return [{ id: 99, code: 'B0', name: 'Empty' }, { id: 100, code: 'B1', name: 'Building 1' }, { id: 103, code: 'B2', name: 'Building 2', flockCard: { id: 13 } }] } },
    './broilerCycleReport': { getBroilerBuildingCycleReport: async () => ({ ...standalone, status: 'Closed', buildings: standalone.buildings.map(building => ({ ...building, status: 'Closed' })) }), getBroilerCycleReport: async (id, options) => {
      requests.push(id)
      assert.equal(options.postedOnly, true); assert.notEqual(options.openBuildingsOnly, true)
      return id === 1 ? report : id === 2 ? closedReport : id === 3 ? { ...report, id: 3, status: 'Cancelled', buildings: [] } : { ...report, farmId: 2 }
    } },
  })
  const { getBroilerCycleDashboard } = loadDashboard('lib/data/repositories/broilerCycleDashboard.ts')
  const dashboard = await getBroilerCycleDashboard(1)
  assert.equal(dashboard.buildings.length, 3)
  assert.equal(dashboard.buildings[0].cycles.length, 0)
  assert.equal(dashboard.selectedCycle.key, 'farm:2', 'Default to the highest farm cycle number even when closed')
  assert.equal(dashboard.buildings[1].cycles[0].status, 'Closed')
  assert.equal(dashboard.buildings[2].cycles.length, 0, 'Do not mix standalone cycles into a selected farm cycle')
  assert.deepEqual(requests, [2], 'Load only the selected report')
  const recalled = await getBroilerCycleDashboard(1, { cycleKey: 'farm:1' })
  assert.equal(recalled.selectedCycle.key, 'farm:1')
  assert.equal(recalled.buildings[1].cycles[0].cycleNumber, '7')
  const standaloneRecall = await getBroilerCycleDashboard(1, { cycleKey: 'building:13' })
  assert.equal(standaloneRecall.buildings[2].cycles[0].cycleNumber, 'Backlog Cycle 7')
  assert.equal(standaloneRecall.buildings[1].cycles.length, 0)
  assert.equal((await getBroilerCycleDashboard(1, { cycleKey: 'farm:3' })).selectedCycle.status, 'Cancelled')
  await assert.rejects(() => getBroilerCycleDashboard(1, { cycleKey: 'farm:4' }), /selected cycle for this farm/)
  const countBeforeInvalid = requests.length
  await assert.rejects(() => getBroilerCycleDashboard(1, { cycleKey: 'farm:999' }), /does not belong/)
  assert.equal(requests.length, countBeforeInvalid, 'Validate recalled cycle ownership before loading it')
  farmCycleRows = []
  assert.equal((await getBroilerCycleDashboard(1)).selectedCycle.key, 'building:13', 'Use latest standalone cycle only when the farm has no numbered cycles')
  const queryCount = queried
  allowed = false
  await assert.rejects(() => getBroilerCycleDashboard(1, { onCatalogLoaded: () => assert.fail('Denied users must not receive cycle metadata') }), /active assignment/)
  assert.equal(queried, queryCount, 'Denied farm access must not query cycle records')

  // User-reported case: one closed Cycle 1, one participating building, zero open.
  const closedTables = structuredClone(tables)
  closedTables.doc_farm_cycles[0] = { ...closedTables.doc_farm_cycles[0], cycle_no: 1, status: 'Closed', closed_at: '2026-09-09T01:24:00Z' }
  closedTables.flock_card = [{ ...closedTables.flock_card[0], cycle_no: 1, status: 'Closed' }]
  const catalogEvents = []
  const closedMocks = {
    '@/lib/Supabase/supabaseClient': { db: database(closedTables) },
    './farmOptions.client': { listAssignedUserFarmOptions: async () => [{ id: 1 }] },
    './broilerFlockCards': { getFarmBuildingsForFlockCard: async () => {
      assert.equal(catalogEvents[0]?.selectedCycle?.label, 'Cycle 1', 'Publish the Cycle Master list before querying additional buildings')
      throw { message: 'Simulated warehouse lookup failure' }
    } },
  }
  const closedLoader = loader(closedMocks)
  const closedCycleRows = await closedLoader('lib/data/repositories/broilerFarmCycles.ts').getFarmCycleMasterRows(1)
  assert.equal(closedCycleRows[0].status, 'Closed')
  assert.equal(closedCycleRows[0].participatingBuildings, 1)
  assert.equal(closedCycleRows[0].openBuildings, 0)
  const closedDashboard = await closedLoader('lib/data/repositories/broilerCycleDashboard.ts').getBroilerCycleDashboard(1, {
    onCatalogLoaded: catalog => catalogEvents.push(catalog),
  })
  assert.equal(closedDashboard.selectedCycle.label, 'Cycle 1')
  assert.equal(closedDashboard.selectedCycle.status, 'Closed')
  assert.equal(closedDashboard.buildings[0].cycles[0].status, 'Closed', 'Recover participating buildings from the recalled report when live building lookup fails')
  assert(closedDashboard.warnings[0].includes('Simulated warehouse lookup failure'))

  const failedDetailCatalogs = []
  const failedDetailLoader = loader({ ...closedMocks,
    './broilerCycleReport': { getBroilerCycleReport: async () => { throw new Error('Simulated Growing detail failure') } },
  })
  await assert.rejects(() => failedDetailLoader('lib/data/repositories/broilerCycleDashboard.ts').getBroilerCycleDashboard(1, {
    onCatalogLoaded: catalog => failedDetailCatalogs.push(catalog),
  }), /Simulated Growing detail failure/)
  assert.equal(failedDetailCatalogs.at(-1).selectedCycle.label, 'Cycle 1', 'A failed transaction query must not remove the closed cycle from the selector')

  const standaloneFailureLoader = loader({ ...closedMocks,
    './broilerFarmCycles': {
      getFarmCycleMasterRows: async () => closedCycleRows,
      getStandaloneBuildingCycleOptions: async () => { throw { message: 'Simulated standalone lookup failure' } },
    },
  })
  const withStandaloneFailure = await standaloneFailureLoader('lib/data/repositories/broilerCycleDashboard.ts').getBroilerCycleDashboard(1)
  assert.equal(withStandaloneFailure.selectedCycle.label, 'Cycle 1')
  assert(withStandaloneFailure.warnings.some(warning => warning.includes('Simulated standalone lookup failure')))
  console.log('Cycle Dashboard tests passed: posting filters, latest/closed cycle recall, cycle isolation, lineage, weighted totals, age at close, access guards, pagination, and report compatibility.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
