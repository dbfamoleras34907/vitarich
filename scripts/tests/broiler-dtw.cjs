const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { strFromU8, unzipSync } = require('fflate')

const sourcePath = path.resolve(__dirname, '../../app/brd/dtw/workbook.ts')
const sqlPath = path.resolve(__dirname, '../../app/sql/new/broiler_data_transfer_workbench.sql')
const repositoryPath = path.resolve(__dirname, '../../lib/data/repositories/broilerDtw.ts')
const uuidPath = path.resolve(__dirname, '../../lib/utils/createUuid.ts')
const cycleRepositoryPath = path.resolve(__dirname, '../../lib/data/repositories/broilerFarmCycles.ts')
const layoutPath = path.resolve(__dirname, '../../app/brd/dtw/Layout.tsx')
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText
const loaded = { exports: {} }
let exportedWorkbook
const mockRequire = id => {
  if (id === 'write-excel-file/browser') return { __esModule: true, default: workbook => {
    exportedWorkbook = workbook
    return { toFile: async () => {} }
  } }
  if (id === 'write-excel-file/utility') return {
    getOrderOfSiblings: () => [], insertElementMarkupAccordingToOrderOfSiblings: (xml, markup) => `${xml}${markup}`, sanitizeTextContent: value => value,
  }
  return require(id)
}
new Function('require', 'module', 'exports', compiled)(mockRequire, loaded, loaded.exports)

const { createBroilerDtwDropdownFeature, DTW_FIELD_BEHAVIORS, DTW_HEADERS, DTW_SHEETS, exportBroilerDtwTemplate, parseBroilerDtwWorkbook } = loaded.exports
const references = {
  farms: [{ id: 1, code: 'F01', name: 'Farm One' }],
  buildings: [{ id: 10, farmId: 1, farmCode: 'F01', code: 'B01', name: 'Building One' }],
  cycles: [{ id: 100, farmId: 1, farmCode: 'F01', cycleKey: 'LEGACY-F01-B01-2025-001', status: 'Past Open' }],
}
const rows = overrides => Object.keys(DTW_SHEETS).map(key => ({ sheet: DTW_SHEETS[key], data: [DTW_HEADERS[key], ...(overrides[key] ?? [])] }))
assert.ok(!DTW_HEADERS.placement.includes('Cycle #'))
assert.equal(DTW_FIELD_BEHAVIORS.placement[DTW_HEADERS.placement.indexOf('Placement Date')], 'required')
assert.equal(DTW_FIELD_BEHAVIORS.placement[DTW_HEADERS.placement.indexOf('Item Code')], 'automatic')
assert.equal(DTW_FIELD_BEHAVIORS.growing[DTW_HEADERS.growing.indexOf('Feed Item Code')], 'automatic')
assert.equal(DTW_FIELD_BEHAVIORS.harvest[DTW_HEADERS.harvest.indexOf('Item Code')], 'automatic')
assert.equal(DTW_FIELD_BEHAVIORS.cleanup[DTW_HEADERS.cleanup.indexOf('Quantity')], 'automatic')

const placement = ['CYCLE-A', 'F01 - Farm One', 'B01 - Building One', '', '2025-01-02', '', '', '', 100, 95, '', '', 1, 2, 'old data']
const growing = ['CYCLE-A', 'F01 - Farm One', 'B01 - Building One', '', '2025-01-02', '2025-01-03', 1, 1, 0, 7, 0, 0, 8, 8, 5, 0.05, '', '', 42, 10, 0.1, 25, 30, 60, 70, 4, 'preserve totals']
const harvest = ['CYCLE-A', 'F01 - Farm One', 'B01 - Building One', '', '2025-01-02', '', '2025-02-10', 39, '', '', '', 80, 120, 1.5, '', '', '', '', '', '', '']
const cleanup = ['CYCLE-A', 'F01 - Farm One', 'B01 - Building One', '', '2025-01-02', '', '2025-02-11', '', '', '', '', 'closed']

const valid = parseBroilerDtwWorkbook(rows({ placement: [placement], growing: [growing], harvest: [harvest], cleanup: [cleanup] }), 'legacy.xlsx', 'legacy', references)
assert.deepEqual(valid.errors, [])
assert.equal(valid.payload.growing[0].mortalityTotal, null)
assert.equal(valid.payload.growing[0].feedItemCode, null)
assert.equal(valid.payload.harvest[0].itemCode, null)

const standard = parseBroilerDtwWorkbook(rows({ placement: [placement] }), 'standard.xlsx', 'standard', references)
assert.deepEqual(standard.errors, [])
const automaticCyclePlacement = [...placement]
automaticCyclePlacement[0] = ''
const automaticCycleGrowing = [...growing]
automaticCycleGrowing[0] = ''
const automaticCycle = parseBroilerDtwWorkbook(rows({ placement: [automaticCyclePlacement], growing: [automaticCycleGrowing] }), 'automatic-cycle.xlsx', 'legacy', references)
assert.deepEqual(automaticCycle.errors, [])
const missingActualPlacement = [...placement]
missingActualPlacement[9] = ''
const missingActual = parseBroilerDtwWorkbook(rows({ placement: [missingActualPlacement] }), 'standard.xlsx', 'standard', references)
assert.ok(missingActual.errors.some(value => value.includes('Actual Received is required')))

const continuationGrowing = [...growing]
continuationGrowing[0] = ''
continuationGrowing[3] = 'LEGACY-F01-B01-2025-001'
const continuation = parseBroilerDtwWorkbook(rows({ growing: [continuationGrowing] }), 'continue.xlsx', 'legacy', references)
assert.deepEqual(continuation.errors, [])

const missingCycleLink = [...growing]
missingCycleLink[0] = ''
const missingCycle = parseBroilerDtwWorkbook(rows({ growing: [missingCycleLink] }), 'missing-cycle.xlsx', 'legacy', references)
assert.deepEqual(missingCycle.errors, [])

const feature = createBroilerDtwDropdownFeature(1, 1, 1)
const sheetXml = feature.files.transform['xl/worksheets/sheet{id}.xml'].transform('<worksheet/>', {}, { sheetIndex: 0 })
assert.match(sheetXml, /<formula1>'Dropdown Lists'!\$A\$2:\$A\$2<\/formula1>/)
assert.match(sheetXml, /OFFSET\('Dropdown Lists'!\$C\$2,MATCH\(\$B2,'Dropdown Lists'!\$B\$2:\$B\$2,0\)-1,0,COUNTIF\('Dropdown Lists'!\$B\$2:\$B\$2,\$B2\),1\)/)
assert.match(sheetXml, /<formula1>'Dropdown Lists'!\$D\$2:\$D\$2<\/formula1>/)
assert.equal((sheetXml.match(/showErrorMessage="0"/g) ?? []).length, 3)

const sql = fs.readFileSync(sqlPath, 'utf8')
assert.match(sql, /alter table public\.doc_farm_cycles[\s\S]*add column if not exists cycle_key text/)
assert.match(sql, /set cycle_key = cycle_no::text/)
assert.match(sql, /create trigger set_doc_farm_cycle_key/)
assert.match(sql, /format\('LEGACY-%s-%s',to_char\(v_date,'MMDDYYYY'\),lpad\(v_daily_cycle_count::text,3,'0'\)\)/)
assert.match(sql, /format\('__AUTO__:%s:%s:%s',v_farm\.id,v_building\.id,to_char\(v_date,'YYYYMMDD'\)\)/)
assert.match(sql, /broiler_dtw_cycle_links_placement_lookup_idx/)
assert.match(sql, /card\.start_date=nullif\(p_row->>'placementDate',''\)::date/)
assert.match(sql, /values \('harvest_age'\),\('average_live_weight'\),\('net_live_weight'\)/)
assert.match(sql, /Apply alter_growing_harvest_age\.sql/)
assert.match(sql, /app\.broiler_dtw_legacy_allow_mort_thin_imbalance/)
assert.match(sql, /if v_legacy then[\s\S]*set_config\('app\.broiler_dtw_legacy_allow_mort_thin_imbalance','on',true\)/)
assert.doesNotMatch(sql, /v_row->>'cycleNumber'/)
assert.match(sql, /broiler_dtw_good_doc_item/)
assert.match(sql, /settings\.good_doc/)
assert.match(sql, /public\.receiving_new_batch\('broiler'/)
assert.match(sql, /source_doc_type='BRD_FC_FEED_USAGE'/)
assert.match(sql, /order by historical_usage\.used_qty desc/)
assert.match(sql, /v_mortality_total:=/)
assert.match(sql, /v_feed_per_bird:=/)
assert.match(sql, /No inventory movement: no remaining Good DOC inventory/)
assert.match(sql, /v_date,'broiler',v_farm\.id/)
assert.doesNotMatch(sql, /v_date,'Broiler',v_farm\.id/)
assert.match(sql, /regexp_replace\(/)
assert.match(sql, /\(\[\[:space:\]\]begin\[\[:space:\]\]\)/)
assert.doesNotMatch(sql, /replace\(v_definition,E'\\nbegin\\n'/)
const repository = fs.readFileSync(repositoryPath, 'utf8')
assert.match(repository, /listApprovedFarmAccessOptions\(db\)/)
assert.doesNotMatch(repository, /listAssignedUserFarmOptions|users_farms/)
assert.match(repository, /getFarmCycleMasterRows\(farm\.id, \{ validateOwnership: false \}\)/)
assert.match(repository, /createUuid\(\)/)
assert.doesNotMatch(repository, /crypto\.randomUUID\(\)/)
const compiledUuid = ts.transpileModule(fs.readFileSync(uuidPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const loadedUuid = { exports: {} }
new Function('require', 'module', 'exports', compiledUuid)(require, loadedUuid, loadedUuid.exports)
assert.match(loadedUuid.exports.createUuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
const cycleRepository = fs.readFileSync(cycleRepositoryPath, 'utf8')
assert.match(cycleRepository, /options\.validateOwnership !== false/)
const layout = fs.readFileSync(layoutPath, 'utf8')
assert.match(layout, /'message' in error/)
assert.match(layout, /Promise\.allSettled/)
assert.match(layout, /disabled=\{downloading\}/)
assert.match(layout, /await getBroilerDtwReferences\(\)/)

const badBuilding = [...placement]
badBuilding[2] = 'B99 - Unknown'
const invalid = parseBroilerDtwWorkbook(rows({ placement: [badBuilding] }), 'bad.xlsx', 'legacy', references)
assert.ok(invalid.errors.some(value => value.includes('select a Building')))

exportBroilerDtwTemplate(references).then(async () => {
  const dropdownSheet = exportedWorkbook.find(sheet => sheet.sheet === 'Dropdown Lists')
  assert.equal(dropdownSheet.data[1][0].value, 'F01 - Farm One')
  assert.equal(dropdownSheet.data[1][1].value, 'F01 - Farm One')
  assert.equal(dropdownSheet.data[1][2].value, 'B01 - Building One')
  assert.equal(dropdownSheet.data[1][3].value, 'LEGACY-F01-B01-2025-001')
  const placementSheet = exportedWorkbook.find(sheet => sheet.sheet === 'DOC Placement')
  assert.equal(placementSheet.showGridLines, true)
  assert.equal(placementSheet.data[0][DTW_HEADERS.placement.indexOf('Placement Date')].backgroundColor, '#FDE047')
  assert.equal(placementSheet.data[0][DTW_HEADERS.placement.indexOf('Remarks')].backgroundColor, '#16A34A')
  assert.equal(placementSheet.data[0][DTW_HEADERS.placement.indexOf('Item Code')].backgroundColor, '#2563EB')
  const writeXlsx = require('write-excel-file/node').default
  const readXlsx = require('read-excel-file/node').default
  let actualBuffer
  const actualLoaded = { exports: {} }
  const actualRequire = id => {
    if (id === 'write-excel-file/browser') return { __esModule: true, default: (data, options) => ({
      toFile: async () => { actualBuffer = await writeXlsx(data, options).toBuffer() },
    }) }
    return require(id)
  }
  new Function('require', 'module', 'exports', compiled)(actualRequire, actualLoaded, actualLoaded.exports)
  await actualLoaded.exports.exportBroilerDtwTemplate(references)
  const saved = await readXlsx(actualBuffer)
  assert.deepEqual(saved.map(sheet => sheet.sheet), [
    'DOC Placement', 'Growing', 'Harvest Delivery', 'Clean Up', 'Instructions', 'Dropdown Lists',
  ])
  const zip = unzipSync(actualBuffer)
  for (let sheet = 1; sheet <= 4; sheet += 1) {
    const xml = strFromU8(zip[`xl/worksheets/sheet${sheet}.xml`])
    assert.equal((xml.match(/<dataValidations[\s>]/g) ?? []).length, 1)
    assert.equal((xml.match(/<dataValidation /g) ?? []).length, 3)
  }
  console.log('PASS: Broiler DTW workbook validation, field behaviors, generated cycle contract, populated dropdown data, and farm-building identity')
}).catch(error => {
  console.error(error)
  process.exitCode = 1
})
