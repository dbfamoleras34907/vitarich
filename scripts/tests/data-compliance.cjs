// Run: node scripts/tests/data-compliance.cjs
const assert = require('node:assert/strict')
const { loader, database } = require('./cycle-dashboard.cjs')
const load = loader()
const { buildComplianceRow, complianceSummary, groupCompliance, filterComplianceRows, complianceFilterOptions, manilaToday, complianceDate } = load('lib/broiler/dataCompliance.ts')
const { complianceReportSheets } = load('lib/reports/broilerDataCompliance.ts')

const line = age => ({ age, isVoided: false, hasMortality: true, hasFeed: false, hasWater: false, hasWeight: false,
  mortalityTotal: 0, mortalityAm: 0, mortalityPm: 0, thinningAm: 0, thinningPm: 0, waterPerBird: 0 })
const source = { farmId: 1, farmName: 'Farm A', region: 'Region A', ta: 'TA A', assignedTas: [{ id: 3, name: 'TA A', region: '03' }], cycleKey: '1:farm:1', cycleLabel: '0926001', cycleStatus: 'Saved', closedAt: '',
  building: { flockCardId: 1, buildingWarehouseId: 1, buildingName: 'B1', cardNo: 'FC1', startDate: '2026-09-25', status: 'Saved', isVoided: false, startingPopulation: 100,
    placements: [{ receiveDate: '2026-09-25', status: 'Posted', isVoided: false, createdAt: '2026-09-25T08:00:00Z' }], growingLines: [line(1), line(2)], deliveries: [], cleanups: [] } }
const evaluate = (value = source, date = '2026-09-28', cutoff = 'yesterday') => buildComplianceRow(value, date, cutoff)
const withBuilding = fields => ({ ...source, building: { ...source.building, ...fields } })
const good = evaluate()
assert.equal(good.status, 'updated')
assert.equal(good.stages.growing.latestDate, '2026-09-27')
assert.equal(good.stages.harvest.status, 'not-assessed', 'No harvest deadline must not be invented')
assert.equal(evaluate(source, '2026-09-28', 'today').daysLate, 1)
const gap = evaluate(withBuilding({ growingLines: [line(2)] }))
assert.equal(gap.status, 'overdue')
assert.deepEqual(gap.stages.growing.missingDates, ['2026-09-26'])
assert.equal(gap.daysLate, 2, 'Latest date must not hide an older gap')
assert.equal(evaluate(withBuilding({ growingLines: [line(1), { ...line(2), isVoided: true }] })).status, 'overdue')
assert.equal(evaluate(withBuilding({ growingLines: [line(1), { ...line(2), hasMortality: false }] })).status, 'overdue', 'Blank skeleton days are not entries')
assert.equal(evaluate(withBuilding({ growingLines: [line(1), line(1), line(2), line(10)] })).status, 'updated', 'Duplicates and future rows do not alter due coverage')
assert.equal(evaluate(withBuilding({ placements: [] })).stages.placement.status, 'overdue')
assert.equal(evaluate(withBuilding({ startDate: '' })).status, 'review')
assert.equal(evaluate(withBuilding({ startDate: '2026-09-29' })), null)
assert.equal(evaluate(withBuilding({ isVoided: true })), null)
assert.equal(evaluate(withBuilding({ status: 'Closed' })).status, 'review', 'Closed without an end date cannot be confidently assessed')
assert.equal(evaluate(source, '2026-12-01').status, 'review', 'Do not invent Growing obligations beyond supported ages')
const movement = heads => ({ date: '2026-09-26', status: 'Posted', isVoided: false, baseQuantity: heads, baseUom: 'HEAD', quantity: heads, uom: 'HEAD' })
assert.equal(evaluate(withBuilding({ deliveries: [movement(50)], growingLines: [line(1)] })).status, 'overdue', 'Partial harvest must not end daily reporting')
assert.equal(evaluate(withBuilding({ deliveries: [movement(100)], growingLines: [line(1)] })).status, 'updated', 'Full harvest stops subsequent Growing obligations')
assert.equal(evaluate(withBuilding({ cleanups: [movement(0)], growingLines: [line(1)] })).status, 'updated')
assert.equal(manilaToday(new Date('2026-09-27T16:01:00Z')), '2026-09-28')
assert.equal(complianceDate('2026-02-30'), null)
assert.throws(() => evaluate(source, 'bad-date'), /valid reporting date/)
const totals = complianceSummary([good, gap, { ...good, status: 'review' }, { ...good, status: 'not-due' }])
assert.equal(totals.compliance, 50)
assert.equal(totals.due, 2)
assert.equal(complianceSummary([]).compliance, null, 'Empty data must not imply 100% compliance')
assert.equal(complianceSummary([{ ...gap, ta: null, assignedTas: [] }]).tasWithDelays, 0, 'Unassigned is not a person')
const weighted = groupCompliance([good, gap, { ...gap, farmId: 2, farmName: 'Farm B' }], 'region')
assert(Math.abs(weighted[0].compliance - 100 / 3) < 1e-10, 'Use counts, not an average of farm percentages')
const sheets = complianceReportSheets([gap], 'Region A only', '2026-09-28T00:00:00Z')
assert.equal(sheets.length, 5)
assert.equal(sheets.at(-1).rows.length, 2, 'Export the filtered records only')
assert(sheets.at(-1).rows[1].includes('2026-09-26'))
assert(sheets[0].rows.some(row => row.includes('Region A only')))

const shared = { ...gap, ta: 'TA A, TA B', assignedTas: [...gap.assignedTas, { id: 4, name: 'TA B', region: '03' }] }
assert.equal(complianceSummary([shared]).overdue, 1, 'Shared farms do not duplicate overall overdue totals')
assert.equal(complianceSummary([shared]).tasWithDelays, 2)
assert.equal(groupCompliance([shared], 'ta').length, 2, 'Each associated user gets an individual TA row')
const filters = { region: '', farm: '', ta: '4', cycle: '', status: '' }
const selectedTA = filterComplianceRows([shared, good], filters)
assert.equal(selectedTA.length, 1)
assert.equal(selectedTA[0].ta, 'TA B')
assert.equal(complianceSummary(selectedTA).tasWithDelays, 1)
assert.equal(filterComplianceRows([shared], { ...filters, region: 'Other region' }).length, 0)
const catalog = [
  { id: 1, name: 'Farm A', region: 'Region A', assignedTas: shared.assignedTas },
  { id: 2, name: 'Farm B', region: 'Region B', assignedTas: [{ id: 5, name: 'TA C' }] },
  { id: 3, name: 'Farm without cycles', region: 'Region A', assignedTas: [] },
]
assert.deepEqual(complianceFilterOptions(catalog, 'Region A', '').farms.map(row => row.id), [1, 3])
assert.deepEqual(complianceFilterOptions(catalog, 'Region A', '1').tas.map(row => row.id), [3, 4])
assert.equal(complianceFilterOptions(catalog, 'Region A', '1').hasUnassigned, false)
assert.equal(complianceFilterOptions(catalog, 'Region A', '3').hasUnassigned, true)
assert.deepEqual(complianceFilterOptions(catalog, '', ['1', '2']).tas.map(user => user.id), [3, 4, 5])
assert.equal(filterComplianceRows([shared, { ...good, farmId: 2, cycleKey: 'second' }], { ...filters, ta: '', farm: ['1', '2'], cycle: [] }).length, 2)
assert.equal(filterComplianceRows([shared, { ...good, farmId: 2, cycleKey: 'second' }], { ...filters, ta: '', farm: ['1', '2'], cycle: ['second'] }).length, 1)
const { normalizeAdministrativeRegion } = load('lib/farmProfileOptions.ts')
assert.equal(normalizeAdministrativeRegion('03'), 'Region III (Central Luzon)')
assert.equal(normalizeAdministrativeRegion('Central Luzon'), 'Region III (Central Luzon)')

async function repositories() {
  let reads = 0
  const mocks = {
    './farmAssignedUsers': { listFarmAssignedUsers: async () => new Map([[1, [{ id: 3, name: 'TA A', region: '03' }]]]) },
    './farmOptions.client': { listAssignedUserFarmOptions: async () => [{ id: 1, name: 'Farm A' }] },
    './farmManagement.client': { getActiveFarmById: async () => ({ region: 'Region A', administrative_region: 'Should not be used', contact_person: 'Not a TA' }) },
    './broilerFarmCycles': { getCycleMasterListRows: async () => [{ id: 1, kind: 'farm', status: 'Saved' }, { id: 2, kind: 'farm', status: 'Past Open' }, { id: 3, kind: 'building', status: 'Closed' }, { id: 4, kind: 'farm', status: 'Cancelled' }] },
    './broilerCycleReport': { getBroilerCycleReport: async () => { reads++; return { farmId: 1, status: 'Saved', buildings: [source.building] } }, getBroilerBuildingCycleReport: async () => { reads++; return { farmId: 1, status: 'Closed', buildings: [source.building] } } },
  }
  const repo = loader(mocks)('lib/data/repositories/broilerDataCompliance.ts')
  const current = await repo.getBroilerDataCompliance('current')
  assert.equal(reads, 1, 'Past Open must not be automatically treated as Current')
  assert.equal(current.sources[0].ta, 'TA A', 'Use associated User accounts, not the contact person')
  assert.equal(current.sources[0].region, 'Region A')
  assert.equal(current.farms.length, 1)
  const fallback = loader({ ...mocks, './farmManagement.client': { getActiveFarmById: async () => ({ region: null, administrative_region: 'Should not be used' }) } })('lib/data/repositories/broilerDataCompliance.ts')
  assert.equal((await fallback.getBroilerDataCompliance()).sources[0].region, 'Region not set', 'Only farms.region defines the report Region')
  const ambiguous = loader({ ...mocks, './farmManagement.client': { getActiveFarmById: async () => ({ region: null }) },
    './farmAssignedUsers': { listFarmAssignedUsers: async () => new Map([[1, [{ id: 3, name: 'TA A', region: '03' }, { id: 4, name: 'TA B', region: '04A' }]]]) },
  })('lib/data/repositories/broilerDataCompliance.ts')
  const unresolved = await ambiguous.getBroilerDataCompliance()
  assert.equal(unresolved.sources[0].region, 'Region not set')
  assert.equal(unresolved.sources[0].assignedTas.length, 2, 'Keep farm-associated TAs regardless of their personal regions')
  assert.equal(unresolved.warnings.length, 0, 'Different User regions must not generate a warning')
  reads = 0
  await repo.getBroilerDataCompliance('all')
  assert.equal(reads, 3, 'Include standalone, current and past cycles; exclude cancelled')
  const denied = loader({ ...mocks, './farmOptions.client': { listAssignedUserFarmOptions: async () => [] } })('lib/data/repositories/broilerDataCompliance.ts')
  assert.equal((await denied.getBroilerDataCompliance()).sources.length, 0)
  const failed = loader({ ...mocks, './broilerCycleReport': { getBroilerCycleReport: async () => { throw new Error('RLS read failed') } } })('lib/data/repositories/broilerDataCompliance.ts')
  await assert.rejects(() => failed.getBroilerDataCompliance(), /RLS read failed/, 'Do not publish partial KPIs')
  const wrongFarm = loader({ ...mocks, './broilerCycleReport': { getBroilerCycleReport: async () => ({ farmId: 2, buildings: [] }) } })('lib/data/repositories/broilerDataCompliance.ts')
  await assert.rejects(() => wrongFarm.getBroilerDataCompliance(), /Unable to load cycle/)
  const capped = loader({ '@/lib/Supabase/supabaseClient': { db: database({
    doc_farm_cycles: [{ id: 1, farm_id: 1 }], farms: [{ id: 1 }],
    flock_card: Array.from({ length: 1001 }, (_, id) => ({ id, farm_id: 1, farm_cycle_id: 1, void: '1' })),
  }) } })('lib/data/repositories/broilerCycleReport.ts')
  await assert.rejects(() => capped.getBroilerCycleReport(1, { postedOnly: true, requireComplete: true }), /response limit/, 'Reject truncated building results before publishing KPIs')
  const memberRepo = loader({ '@/lib/Supabase/supabaseClient': { db: database({
    users_farms: [
      { farm_id: 1, farm_code: 'A', users_id: 1, void: 1 },
      { farm_id: 1, farm_code: 'A', users_id: 2, void: 1 },
      { farm_id: 1, farm_code: 'A', users_id: 3, void: 1 },
      { farm_id: 1, farm_code: 'A', users_id: 3, void: 1 },
      { farm_id: null, farm_code: 'A', users_id: 4, void: 1 },
      { farm_id: 1, farm_code: 'A', users_id: 5, void: 0 },
      { farm_id: 2, farm_code: 'A', users_id: 6, void: 1 },
    ],
    users: [1, 2, 3, 4, 5, 6].map(id => ({ id, user_type: id < 3 ? id : 3, firstname: `Person ${id}`, region: '03' })),
  }) } })('lib/data/repositories/farmAssignedUsers.ts')
  const members = await memberRepo.listFarmAssignedUsers([{ id: 1, code: 'A' }], 3)
  assert.deepEqual(members.get(1).map(user => user.id), [3, 4], 'Exclude admins, void associations, duplicates, and conflicting legacy farm codes')
  const writeXlsx = require('write-excel-file/node').default
  const readXlsx = require('read-excel-file/node').default
  let buffer
  let filename
  const exporter = loader({ 'write-excel-file/browser': { __esModule: true, default: (data, options) => ({ toFile: async name => {
    filename = name
    buffer = await writeXlsx(data, options).toBuffer()
  } }) } })('lib/reports/exportWorkbook.ts')
  await exporter.exportReportWorkbook([...sheets, { name: 'Literal text', rows: [['Value'], ['=1+1']] }], 'test-report.xlsx')
  assert.equal(filename, 'test-report.xlsx')
  const workbook = await readXlsx(buffer)
  assert.deepEqual(workbook.map(sheet => sheet.sheet), ['Summary', 'Region Summary', 'Farm Summary', 'TA Summary', 'Building Details', 'Literal text'])
  assert.equal(workbook.at(-1).data[1][0], '=1+1', 'User text must not be interpreted as an Excel formula')
  assert.equal(workbook.find(sheet => sheet.sheet === 'Building Details').data.length, 2)
}
repositories().then(() => console.log('Data Compliance tests passed: gaps, cutoffs, voids, harvest completion, review exclusions, weighted KPIs, exports, cycle scope and assigned-farm access.')).catch(error => { console.error(error); process.exitCode = 1 })
