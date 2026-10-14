const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { strFromU8, unzipSync } = require('fflate')

const sourcePath = path.resolve(__dirname, '../../app/brd/dtw/workbook.ts')
const sqlPath = path.resolve(__dirname, '../../app/sql/updated/broiler_data_transfer_workbench.sql')
const receivingSourcesPath = path.resolve(__dirname, '../../app/inv/doc-receiving/receiving_sources.sql')
const batchSeriesRepairPath = path.resolve(__dirname, '../../app/sql/updated/batch_number_series_audit_fk_repair.sql')
const cycleOwnershipPath = path.resolve(__dirname, '../../app/sql/old 10/20261005090927_broiler_cycle_master_ownership.sql')
const mortalityOnlyInventoryPath = path.resolve(__dirname, '../../app/sql/updated/brd_fc_mortality_only_inventory.sql')
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
  if (id === './types') return { BROILER_DTW_SOURCE_ROW: Symbol('broilerDtwSourceRow') }
  return require(id)
}
new Function('require', 'module', 'exports', compiled)(mockRequire, loaded, loaded.exports)

const { createBroilerDtwDropdownFeature, DTW_FIELD_BEHAVIORS, DTW_HEADERS, DTW_SHEETS, exportBroilerDtwTemplate, exportBroilerDtwValidationReport, parseBroilerDtwWorkbook, parseBroilerDtwWorkbookWithProgress } = loaded.exports
const references = {
  farms: [{ id: 1, code: 'F01', name: 'Farm One' }],
  buildings: [{ id: 10, farmId: 1, farmCode: 'F01', code: 'B01', name: 'Building One' }],
  cycles: [
    { id: 100, farmId: 1, farmCode: 'F01', cycleKey: 'LEGACY-F01-B01-2025-001', status: 'Past Open' },
    { id: 101, farmId: 1, farmCode: 'F01', cycleKey: 'CYCLE-MASTER-02', status: 'Saved' },
  ],
}
const rows = overrides => Object.keys(DTW_SHEETS).map(key => ({ sheet: DTW_SHEETS[key], data: [DTW_HEADERS[key], ...(overrides[key] ?? [])] }))
assert.ok(!DTW_HEADERS.placement.includes('Cycle #'))
assert.equal(DTW_FIELD_BEHAVIORS.placement[DTW_HEADERS.placement.indexOf('Placement Batch')], 'required')
assert.equal(DTW_FIELD_BEHAVIORS.placement[DTW_HEADERS.placement.indexOf('Placement Date')], 'optional')
assert.equal(DTW_FIELD_BEHAVIORS.placement[DTW_HEADERS.placement.indexOf('Total Building Placement')], 'automatic')
assert.equal(DTW_FIELD_BEHAVIORS.placement[DTW_HEADERS.placement.indexOf('Item Code')], 'automatic')
assert.equal(DTW_FIELD_BEHAVIORS.growing[DTW_HEADERS.growing.indexOf('Age')], 'automatic')
assert.equal(DTW_FIELD_BEHAVIORS.growing[DTW_HEADERS.growing.indexOf('Feed Item Code')], 'automatic')
assert.equal(DTW_FIELD_BEHAVIORS.harvest[DTW_HEADERS.harvest.indexOf('Item Code')], 'automatic')
assert.equal(DTW_FIELD_BEHAVIORS.cleanup[DTW_HEADERS.cleanup.indexOf('Quantity')], 'automatic')

const placement = ['CYCLE-A', 'F01 - Farm One', 'B01 - Building One', 'PLACEMENT-BATCH-01', '', '', '', '', 100, 1, 2, 2, '', '', '', 'old data']
const growing = ['CYCLE-A', 'F01 - Farm One', 'B01 - Building One', 'PLACEMENT-BATCH-01', '', '2025-01-03', 1, 1, 0, 7, 0, 0, 8, 8, 5, 0.05, '', '', 42, 10, 0.1, 25, 30, 60, 70, 4, 'preserve totals']
const harvest = ['CYCLE-A', 'F01 - Farm One', 'B01 - Building One', 'PLACEMENT-BATCH-01', '', '', '2025-02-10', 39, '', '', '', 80, 120, 1.5, '', '', '', '', '', '', '']
const cleanup = ['CYCLE-A', 'F01 - Farm One', 'B01 - Building One', 'PLACEMENT-BATCH-01', '', '', '2025-02-11', '', '', '', '', 'closed']

const valid = parseBroilerDtwWorkbook(rows({ placement: [placement], growing: [growing], harvest: [harvest], cleanup: [cleanup] }), 'legacy.xlsx', 'legacy', references)
assert.deepEqual(valid.errors, [])
assert.equal(valid.payload.growing[0].mortalityTotal, null)
assert.equal(valid.payload.growing[0].feedItemCode, null)
assert.equal(valid.payload.harvest[0].itemCode, null)
assert.equal(valid.payload.placement[0].actualReceived, 95)
assert.equal(valid.payload.growing[0].age, 1)
assert.ok(valid.modifications.some(value => value.includes('Total Building Placement was calculated as 95')))
assert.ok(valid.modifications.some(value => value.includes('Age was calculated as 1')))

const growingWithoutAgeHeader = DTW_HEADERS.growing.filter(header => header !== 'Age')
const firstGrowingWithoutAge = growingWithoutAgeHeader.map(header => growing[DTW_HEADERS.growing.indexOf(header)])
firstGrowingWithoutAge[growingWithoutAgeHeader.indexOf('Placement Date')] = '2025-01-02'
const secondGrowingWithoutAge = [...firstGrowingWithoutAge]
secondGrowingWithoutAge[growingWithoutAgeHeader.indexOf('Entry Date')] = '2025-01-05'
const legacyGrowingHeaders = rows({ placement: [placement] })
legacyGrowingHeaders.find(sheet => sheet.sheet === DTW_SHEETS.growing).data = [
  ['Legacy Growing Export'],
  growingWithoutAgeHeader.map(header => header === 'Placement Batch' ? 'placement_batch' : header),
  firstGrowingWithoutAge,
  secondGrowingWithoutAge,
]
const calculatedAges = parseBroilerDtwWorkbook(legacyGrowingHeaders, 'legacy-growing.xlsx', 'legacy', references)
assert.deepEqual(calculatedAges.errors, [])
assert.deepEqual(calculatedAges.payload.growing.map(row => row.age), [2, 4])

const oldDocPlacementDate = [...placement]
oldDocPlacementDate[4] = '01/01/2024'
const restartedGrowing = [...growing]
restartedGrowing[4] = '07/30/2025'
restartedGrowing[5] = '07/30/2025'
const restartedAge = parseBroilerDtwWorkbook(rows({ placement: [oldDocPlacementDate], growing: [restartedGrowing] }), 'restarted-growing-age.xlsx', 'legacy', references)
assert.deepEqual(restartedAge.errors, [])
assert.equal(restartedAge.payload.growing[0].age, 1)

const slashDateGrowing = [...growing]
slashDateGrowing[4] = '01/02/2025'
slashDateGrowing[5] = '01/03/2025'
const slashDates = parseBroilerDtwWorkbook(rows({ placement: [placement], growing: [slashDateGrowing] }), 'slash-dates.xlsx', 'legacy', references)
assert.deepEqual(slashDates.errors, [])
assert.equal(slashDates.payload.growing[0].placementDate, '2025-01-02')
assert.equal(slashDates.payload.growing[0].entryDate, '2025-01-03')
assert.equal(slashDates.payload.growing[0].age, 2)

const mixedSlashDateGrowing = [...growing]
mixedSlashDateGrowing[4] = '13/02/2025'
mixedSlashDateGrowing[5] = '5/21/2025'
const mixedSlashDates = parseBroilerDtwWorkbook(rows({ placement: [placement], growing: [mixedSlashDateGrowing] }), 'mixed-slash-dates.xlsx', 'legacy', references)
assert.equal(mixedSlashDates.payload.growing[0].placementDate, '2025-02-13')
assert.equal(mixedSlashDates.payload.growing[0].entryDate, '2025-05-21')
assert.equal(mixedSlashDates.payload.growing[0].age, 50)
assert.deepEqual(mixedSlashDates.errors, [])
assert.ok(mixedSlashDates.modifications.some(value => value.includes('calculated Age 98 was capped at 50')))

const nextCappedGrowing = [...mixedSlashDateGrowing]
nextCappedGrowing[5] = '5/22/2025'
const combinedCappedAges = parseBroilerDtwWorkbook(rows({ placement: [placement], growing: [mixedSlashDateGrowing, nextCappedGrowing] }), 'combined-capped-ages.xlsx', 'legacy', references)
assert.deepEqual(combinedCappedAges.errors, [])
assert.equal(combinedCappedAges.payload.growing.length, 1)
assert.equal(combinedCappedAges.payload.growing[0].age, 50)
assert.equal(combinedCappedAges.payload.growing[0].entryDate, '2025-05-22')
assert.equal(combinedCappedAges.payload.growing[0].mortalityAm, 2)
assert.ok(combinedCappedAges.warnings.some(value => value.includes('calculated Age 50')))

const firstPlacementDateGroup = [...growing]
firstPlacementDateGroup[4] = '01/01/2025'
firstPlacementDateGroup[5] = '01/01/2025'
const firstPlacementDateContinuation = [...growing]
firstPlacementDateContinuation[4] = '01/01/2025'
firstPlacementDateContinuation[5] = '01/03/2025'
const secondPlacementDateGroup = [...growing]
secondPlacementDateGroup[4] = '03/01/2025'
secondPlacementDateGroup[5] = '03/01/2025'
const secondPlacementDateContinuation = [...growing]
secondPlacementDateContinuation[4] = '03/01/2025'
secondPlacementDateContinuation[5] = '03/03/2025'
const groupedAges = parseBroilerDtwWorkbook(rows({
  placement: [placement],
  growing: [firstPlacementDateGroup, firstPlacementDateContinuation, secondPlacementDateGroup, secondPlacementDateContinuation],
}), 'placement-date-groups.xlsx', 'legacy', references)
assert.deepEqual(groupedAges.errors, [])
assert.deepEqual(groupedAges.payload.growing.map(row => row.age), [1, 3, 1, 3])

const excelSerial = date => (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000
const numericDateGrowing = [...growing]
numericDateGrowing[4] = excelSerial('2025-01-02')
numericDateGrowing[5] = excelSerial('2025-01-03')
const numericDates = parseBroilerDtwWorkbook(rows({ placement: [placement], growing: [numericDateGrowing] }), 'excel-dates.xlsx', 'legacy', references)
assert.deepEqual(numericDates.errors, [])
assert.equal(numericDates.payload.growing[0].placementDate, '2025-01-02')
assert.equal(numericDates.payload.growing[0].entryDate, '2025-01-03')
assert.equal(numericDates.payload.growing[0].age, 2)

const duplicateGrowingRows = rows({ placement: [placement] })
duplicateGrowingRows.find(sheet => sheet.sheet === DTW_SHEETS.growing).data = [
  ['Legacy Growing Export'],
  DTW_HEADERS.growing,
  growing,
  [],
  [...growing],
]
const duplicateGrowing = parseBroilerDtwWorkbook(duplicateGrowingRows, 'duplicate-growing.xlsx', 'legacy', references)
assert.deepEqual(duplicateGrowing.errors, [])
assert.equal(duplicateGrowing.payload.growing.length, 1)
assert.equal(duplicateGrowing.payload.growing[0].mortalityAm, 2)
assert.equal(duplicateGrowing.payload.growing[0].feedKg, 10)
assert.equal(duplicateGrowing.payload.growing[0].waterLiters, 20)
assert.ok(duplicateGrowing.warnings.includes('Growing rows 3, 5 were combined for Placement Batch PLACEMENT-BATCH-01, Building B01, calculated Age 1, and Entry Date 2025-01-03.'))

const firstDuplicateHarvest = [...harvest]
firstDuplicateHarvest[11] = 40
firstDuplicateHarvest[12] = 60
firstDuplicateHarvest[13] = 1.5
const secondDuplicateHarvest = [...firstDuplicateHarvest]
secondDuplicateHarvest[11] = 20
secondDuplicateHarvest[12] = 30
const duplicateHarvest = parseBroilerDtwWorkbook(rows({ placement: [placement], harvest: [firstDuplicateHarvest, secondDuplicateHarvest] }), 'duplicate-harvest.xlsx', 'legacy', references)
assert.deepEqual(duplicateHarvest.errors, [])
assert.equal(duplicateHarvest.payload.harvest.length, 1)
assert.equal(duplicateHarvest.payload.harvest[0].quantity, 60)
assert.equal(duplicateHarvest.payload.harvest[0].netLiveWeight, 90)
assert.equal(duplicateHarvest.payload.harvest[0].averageLiveWeight, 1.5)
assert.ok(duplicateHarvest.warnings.includes('Harvest Delivery rows 2, 3 were combined for Placement Batch PLACEMENT-BATCH-01, Building B01, Delivery Date 2025-02-10, and Harvest Age 39.'))

const distinctDestinationHarvest = [...firstDuplicateHarvest]
distinctDestinationHarvest[14] = 'Different destination'
const distinctHarvests = parseBroilerDtwWorkbook(rows({ placement: [placement], harvest: [firstDuplicateHarvest, distinctDestinationHarvest] }), 'distinct-harvest.xlsx', 'legacy', references)
assert.deepEqual(distinctHarvests.errors, [])
assert.equal(distinctHarvests.payload.harvest.length, 2)

const unlistedHarvestBatch = [...harvest]
unlistedHarvestBatch[0] = ''
unlistedHarvestBatch[3] = 'UNLISTED-HARVEST-BATCH'
const unlistedHarvest = parseBroilerDtwWorkbook(rows({ harvest: [unlistedHarvestBatch] }), 'unlisted-harvest.xlsx', 'legacy', references)
assert.ok(!unlistedHarvest.errors.some(value => value.includes('Placement Batch does not belong')))

const unlistedCleanupBatch = [...cleanup]
unlistedCleanupBatch[0] = ''
unlistedCleanupBatch[3] = 'UNLISTED-CLEANUP-BATCH'
const unlistedCleanup = parseBroilerDtwWorkbook(rows({ cleanup: [unlistedCleanupBatch] }), 'unlisted-cleanup.xlsx', 'legacy', references)
assert.ok(!unlistedCleanup.errors.some(value => value.includes('Placement Batch does not belong')))

const standard = parseBroilerDtwWorkbook(rows({ placement: [placement] }), 'standard.xlsx', 'standard', references)
assert.deepEqual(standard.errors, [])
const automaticCyclePlacement = [...placement]
automaticCyclePlacement[0] = ''
const automaticCycleGrowing = [...growing]
automaticCycleGrowing[0] = ''
const automaticCycle = parseBroilerDtwWorkbook(rows({ placement: [automaticCyclePlacement], growing: [automaticCycleGrowing] }), 'automatic-cycle.xlsx', 'legacy', references)
assert.deepEqual(automaticCycle.errors, [])
const excessiveLossPlacement = [...placement]
excessiveLossPlacement[11] = 100
const excessiveLoss = parseBroilerDtwWorkbook(rows({ placement: [excessiveLossPlacement] }), 'standard.xlsx', 'standard', references)
assert.ok(excessiveLoss.errors.some(value => value.includes('cannot exceed Quantity Received')))

const continuationGrowing = [...growing]
continuationGrowing[0] = ''
continuationGrowing[3] = 'LEGACY-F01-B01-2025-001'
const continuation = parseBroilerDtwWorkbook(rows({ growing: [continuationGrowing] }), 'continue.xlsx', 'legacy', references)
assert.deepEqual(continuation.errors, [])

const missingPlacementBatch = [...growing]
missingPlacementBatch[0] = ''
missingPlacementBatch[3] = ''
const missingCycle = parseBroilerDtwWorkbook(rows({ growing: [missingPlacementBatch] }), 'missing-cycle.xlsx', 'legacy', references)
assert.ok(missingCycle.errors.some(value => value.includes('Placement Batch is required')))

const feature = createBroilerDtwDropdownFeature(1, 1, 1)
const sheetXml = feature.files.transform['xl/worksheets/sheet{id}.xml'].transform('<worksheet/>', {}, { sheetIndex: 0 })
assert.match(sheetXml, /<formula1>'Dropdown Lists'!\$A\$2:\$A\$2<\/formula1>/)
assert.match(sheetXml, /OFFSET\('Dropdown Lists'!\$E\$2,MATCH\(\$B2,'Dropdown Lists'!\$C\$2:\$C\$2,0\)-1,0,COUNTIF\('Dropdown Lists'!\$C\$2:\$C\$2,\$B2\),1\)/)
assert.match(sheetXml, /<formula1>'Dropdown Lists'!\$G\$2:\$G\$2<\/formula1>/)
assert.equal((sheetXml.match(/showErrorMessage="0"/g) ?? []).length, 3)
assert.match(sheetXml, /allowBlank="0" showErrorMessage="0" sqref="D2:D2001"/)

const sql = fs.readFileSync(sqlPath, 'utf8')
const receivingSourcesSql = fs.readFileSync(receivingSourcesPath, 'utf8')
const batchSeriesRepairSql = fs.readFileSync(batchSeriesRepairPath, 'utf8')
const cycleOwnershipSql = fs.readFileSync(cycleOwnershipPath, 'utf8')
const mortalityOnlyInventorySql = fs.readFileSync(mortalityOnlyInventoryPath, 'utf8')
assert.match(sql, /alter table public\.doc_farm_cycles[\s\S]*add column if not exists cycle_key text/)
assert.match(sql, /set cycle_key = cycle_no::text/)
assert.match(sql, /create trigger set_doc_farm_cycle_key/)
assert.match(sql, /v_cycle_key:=btrim\(v_row->>'placementBatch'\)/)
assert.match(sql, /format\('__AUTO__:%s:%s:%s:%s',v_farm\.id,v_building\.id,upper\(v_cycle_key\),v_index\)/)
assert.match(sql, /broiler_dtw_cycle_links_placement_lookup_idx/)
assert.match(sql, /Placement Batch is required to resolve the Broiler cycle/)
assert.doesNotMatch(sql, /Placement Date is required to resolve the Broiler cycle/)
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
assert.match(sql, /v_calculated_age:=\(v_date-v_age_start_date\)\+1/)
assert.match(sql, /v_age:=least\(v_calculated_age,50\)/)
assert.match(sql, /jsonb_object_agg\(age_group\.group_key,age_group\.start_date\)/)
assert.match(sql, /upper\(btrim\(source\.row->>'farmCode'\)\)\|\|chr\(31\)[\s\S]*upper\(btrim\(source\.row->>'buildingCode'\)\)\|\|chr\(31\)[\s\S]*upper\(btrim\(source\.row->>'placementBatch'\)\)\|\|chr\(31\)[\s\S]*coalesce\(source\.row->>'placementDate',''\)/)
assert.doesNotMatch(sql, /from \(\s*select value row from jsonb_array_elements\(p_payload->'placement'\)\s*union all/)
assert.doesNotMatch(sql, /requires Entry Date, Age, and Mortality AM/)
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
assert.match(repository, /growing: 20/)
assert.match(repository, /cleanup: 10/)
assert.match(repository, /_dtwRowNo:/)
assert.match(repository, /importRequestIds = new WeakMap/)
assert.match(repository, /subtle\.digest\('SHA-256'/)
assert.match(repository, /\.in\('status', \['Staging', 'Ready', 'Processing', 'Failed', 'Completed'\]\)/)
assert.match(repository, /job\.payload_hash === importHash/)
assert.match(repository, /rpc\('stage_broiler_dtw_workbook'/)
assert.match(repository, /rpc\('finalize_broiler_dtw_import'/)
assert.match(repository, /Posting the complete workbook in one atomic database transaction/)
assert.match(repository, /cancelBroilerDtwImportJob/)
assert.match(repository, /cancelBroilerDtwWorkbook/)
assert.match(repository, /cancelledImportIds\.has\(requestId\)/)
assert.match(repository, /importIdentityPromises/)
assert.match(repository, /getBroilerDtwImportedRows/)
assert.match(repository, /\.from\('broiler_dtw_import_rows'\)/)
assert.match(repository, /\.range\(from, from \+ pageSize - 1\)/)
assert.match(sql, /private\.broiler_dtw_staged_rows/)
assert.match(sql, /broiler_dtw_import_jobs_actor_payload_idx/)
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
assert.match(layout, /exportBroilerDtwValidationReport\(validation\)/)
assert.match(layout, /Validation Report/)
assert.match(layout, /parseBroilerDtwWorkbookWithProgress/)
assert.match(layout, /Excel row/)
assert.match(layout, /Cancel Import/)
assert.match(layout, /atomic database transaction/)
assert.match(layout, /Import status unconfirmed' : 'Import failed/)
assert.match(layout, /setValidationTab\('errors'\)/)
assert.match(layout, /TabsTrigger value="errors">Errors \(\{validation\.errors\.length\}\)/)
assert.match(layout, /TabsTrigger value="warnings">Legacy warnings \(\{validation\.warnings\.length\}\)/)
assert.match(layout, /Collapsible open=\{legacyWarningsOpen\}/)
assert.match(layout, /bg-amber-500\/10 text-foreground/)
assert.doesNotMatch(layout, /bg-amber-50 text-amber-950/)
assert.match(layout, /handleCancelJob/)
assert.match(layout, /Ensure Voided/)
assert.match(layout, /View Data/)
assert.match(layout, /These are the rows committed to the DTW import ledger/)
assert.match(layout, /IMPORTED_ROW_PAGE_SIZE = 50/)
assert.match(sql, /v_growing_age_starts/)
assert.match(sql, /v_calculated_age<1/)
assert.match(sql, /calculated Age % below the allowed minimum of 1/)
assert.doesNotMatch(sql, /v_age not between 1 and 50/)
assert.match(sql, /set statement_timeout = '60s'/)
assert.match(sql, /status text not null default 'Staging'/)
assert.match(sql, /create or replace function private\.stage_broiler_dtw_workbook/)
assert.match(sql, /create or replace function private\.finalize_broiler_dtw_import/)
assert.match(sql, /revoke all on private\.broiler_dtw_staged_rows from public, anon, authenticated/)
assert.match(sql, /primary key \(job_id, stage, row_no\)/)
assert.match(sql, /Every business write is inside this exception subtransaction/)
assert.match(sql, /get stacked diagnostics v_error_code=returned_sqlstate,v_error_message=message_text/)
assert.match(sql, /set status='Failed',cycle_count=0,placement_count=0,growing_count=0,harvest_count=0,cleanup_count=0/)
assert.match(sql, /Direct DTW business imports are disabled/)
assert.match(sql, /revoke all on function public\.import_broiler_dtw_workbook\(uuid,jsonb\) from public, anon, authenticated/)
assert.match(sql, /delete from private\.broiler_dtw_staged_rows where job_id=p_request_id/)
assert.match(sql, /'Cancelled'/)
assert.match(sql, /private\.cancel_broiler_dtw_import/)
assert.match(sql, /You can only cancel your own DTW import/)
assert.match(sql, /order by case imported\.stage when 'Clean Up' then 1 when 'Harvest Delivery' then 2 when 'Growing' then 3 else 4 end/)
assert.match(sql, /perform public\.reverse_brd_fc_feed_intake\(v_imported\.entity_id,'DTW import cancelled'\)/)
assert.match(sql, /perform public\.reverse_brd_fc_mortality_thinning\(v_imported\.entity_id,'DTW import cancelled'\)/)
assert.match(sql, /cleanup_reverses_posting_id/)
assert.match(sql, /delivery_reverses_posting_id/)
assert.match(sql, /doc_receiving_reverses_posting_id/)
assert.match(sql, /warning\.value like 'Skipped:%'/)
assert.match(sql, /'voidedCount',v_voided_count/)
assert.match(sql, /cycle_created boolean not null default false/)
assert.match(sql, /set statement_timeout = '10min'/)
assert.match(sql, /broiler_dtw_suppress_notifications/)
assert.match(sql, /private\.broiler_dtw_cycle_doc_inventory\(bigint\)/)
assert.ok((sql.match(/from private\.broiler_dtw_cycle_doc_inventory\(v_context\.flock_card_id\) inventory/g) ?? []).length >= 5)
assert.match(sql, /Clean Up row % did not fully clear the DOC inventory for Placement Batch %\./)
assert.doesNotMatch(sql, /Harvest row % needs[\s\S]{0,500}from public\.inventory_postings where upper\(item_code\)=upper\(v_item\) and upper\(warehouse_code\)=upper\(v_context\.building_code\)/)
assert.doesNotMatch(layout, /Completed batches (?:were retained|remain saved)/)
assert.doesNotMatch(sql, /if v_card\.status<>'Saved' then raise exception 'The selected building cycle is already closed by Clean Up\.'; end if;/)
assert.doesNotMatch(sql, /raise exception 'The selected building cycle is already closed by Clean Up\.'/)
assert.match(sql, /DTW allowed Growing rows for already-closed Placement Batch/)
assert.match(sql, /DTW allowed Harvest Delivery rows for already-closed Placement Batch/)
assert.match(sql, /DTW allowed Clean Up rows for already-closed Placement Batch/)
assert.match(sql, /Skipped: a matching DOC Placement Goods Receipt is already Posted\./)
assert.match(sql, /goods_receipt_doc_flock_card_active_idx/)
assert.match(sql, /Skipped: a matching Growing age is already Posted\./)
assert.match(sql, /Skipped: a matching Harvest Delivery document is already Posted\./)
assert.match(sql, /Skipped: a matching Clean Up document is already Posted\./)
assert.match(sql, /header\.status='Posted'.*line\.age=v_age/s)
assert.match(sql, /delivery\.status='Posted'.*having sum\(line\.base_qty\)=/s)
assert.match(sql, /cleanup\.status='Posted'.*cleanup\.issue_date=v_date/s)
assert.match(sql, /jsonb_array_elements_text\(imported\.warnings\).*warning\.value like 'Skipped:%'/s)
assert.match(sql, /join public\.flock_card_origin origin on origin\.fc_id=card\.id and origin\.void='1'/)
assert.match(sql, /'dtwMortalityOnlyInventory',true,'mortalityBatchAllocations',v_mortality_allocations/)
assert.match(sql, /v_mortality_total<>trunc\(v_mortality_total\)/)
assert.doesNotMatch(sql, /Growing row % needs % mortality birds from the cycle DOC Placement/)
assert.match(sql, /set_config\('app\.broiler_dtw_allow_negative_inventory','on',true\)/)
assert.match(sql, /'source','DTW_NEGATIVE'/)
assert.match(sql, /'DTW_NEGATIVE','1'/)
assert.match(sql, /where inventory\.on_hand>0\.000001/)
assert.doesNotMatch(sql, /where abs\(inventory\.on_hand\)>0\.000001/)
assert.match(sql, /public\.post_brd_fc_mortality_thinning_inventory\(\)/)
assert.match(sql, /current_setting\(''app\.broiler_dtw_allow_negative_inventory'', true\) is distinct from ''on''/)
assert.match(sql, /inventory_postings_dtw_stock_lookup_idx/)
assert.match(sql, /inventory_postings_dtw_feed_history_idx/)
assert.match(sql, /item_batches_dtw_lookup_idx/)
assert.match(sql, /left join lateral \([\s\S]*from public\.inventory_postings posting/)
assert.match(sql, /v_feed_item_cache jsonb:='\{\}'::jsonb/)
assert.match(repository, /class BroilerDtwFinalizationTimeoutError extends Error/)
assert.match(repository, /isUpstreamTimeout/)
assert.match(repository, /waitForFinalizedImportResult/)
assert.match(repository, /attempt < 2/)
assert.match(layout, /error instanceof BroilerDtwFinalizationTimeoutError/)
assert.match(sql, /'mortalityInventoryDeducted',v_mortality_total,'mortalityInventoryAllocations',v_mortality_allocations/)
assert.match(mortalityOnlyInventorySql, /line\.extra->>'dtwMortalityOnlyInventory'/)
assert.match(mortalityOnlyInventorySql, /v_line\.extra->>'dtwMortalityOnlyInventory'/)
assert.doesNotMatch(sql, /select min\(nullif\(source\.row->>'placementDate',''\)::date\) into v_age_start_date/)
assert.match(receivingSourcesSql, /exists\(select 1 from auth\.users actor where actor\.id=series\.created_by\)/)
assert.match(batchSeriesRepairSql, /not exists\(select 1 from auth\.users actor where actor\.id=series\.created_by\)/)
assert.doesNotMatch(sql, /already has an open cycle\. Finish its Clean Up/)
assert.match(sql, /imported Placement Batch %s while Building %s also has another open cycle/)
assert.match(sql, /set_config\('app\.broiler_dtw_force_cycle_insert','on',true\)/)
assert.match(sql, /current_setting\(''app\.broiler_dtw_force_cycle_insert'', true\) = ''on''/)
assert.match(sql, /auth\.uid\(\) is not null/)
assert.match(sql, /current_user not in \(''anon'', ''authenticated''\)/)
assert.match(sql, /coalesce\(new\.extra->>''createdFrom'', ''''\) = ''BROILER_DTW'' then return new/)
assert.match(sql, /drop index if exists public\.flock_card_one_open_cycle_per_building_uidx/)
assert.doesNotMatch(sql, /Building % already has an active cycle\. Use its existing flock card/)
assert.doesNotMatch(sql, /raise exception 'Placement Batch % was not found in Cycle Master for farm %\.'/)
assert.equal((sql.match(/because Placement Batch %s was not found in Cycle Master for farm %s\./g) ?? []).length, 3)
assert.match(sql, /Skipped: Growing row %s because Placement Batch/)
assert.match(sql, /Skipped: Harvest Delivery row %s because Placement Batch/)
assert.match(sql, /Skipped: Clean Up row %s because Placement Batch/)
assert.match(cycleOwnershipSql, /drop index if exists public\.flock_card_one_open_cycle_per_building_uidx/)
assert.doesNotMatch(cycleOwnershipSql, /create unique index if not exists flock_card_one_open_cycle_per_building_uidx/)
assert.doesNotMatch(cycleOwnershipSql, /This building already has an active cycle/)

const badBuilding = [...placement]
badBuilding[2] = 'B99 - Unknown'
const invalid = parseBroilerDtwWorkbook(rows({ placement: [badBuilding] }), 'bad.xlsx', 'legacy', references)
assert.ok(invalid.errors.some(value => value.includes('select a Building')))

exportBroilerDtwTemplate(references).then(async () => {
  const progressUpdates = []
  const asyncValidation = await parseBroilerDtwWorkbookWithProgress(
    rows({ placement: [placement], growing: [growing], harvest: [harvest], cleanup: [cleanup] }),
    'progress.xlsx',
    'legacy',
    references,
    progress => progressUpdates.push(progress),
  )
  assert.deepEqual(asyncValidation.errors, [])
  assert.ok(progressUpdates.some(progress => progress.module === 'Growing' && progress.worksheetRow === 2))
  assert.ok(progressUpdates.some(progress => progress.phase === 'finalizing'))
  const dropdownSheet = exportedWorkbook.find(sheet => sheet.sheet === 'Dropdown Lists')
  assert.equal(dropdownSheet.data[1][0].value, 'F01 - Farm One')
  assert.equal(dropdownSheet.data[1][1].value, 1)
  assert.equal(dropdownSheet.data[1][2].value, 'F01 - Farm One')
  assert.equal(dropdownSheet.data[1][3].value, 1)
  assert.equal(dropdownSheet.data[1][4].value, 'B01 - Building One')
  assert.equal(dropdownSheet.data[1][5].value, 10)
  assert.equal(dropdownSheet.data[1][6].value, 'CYCLE-MASTER-02')
  assert.equal(dropdownSheet.data[1][7].value, 101)
  assert.equal(dropdownSheet.data[1][8].value, 1)
  assert.equal(dropdownSheet.data[2][6].value, 'LEGACY-F01-B01-2025-001')
  const placementSheet = exportedWorkbook.find(sheet => sheet.sheet === 'DOC Placement')
  assert.equal(placementSheet.showGridLines, true)
  assert.equal(placementSheet.data[0][DTW_HEADERS.placement.indexOf('Placement Batch')].backgroundColor, '#FDE047')
  assert.equal(placementSheet.data[0][DTW_HEADERS.placement.indexOf('Placement Date')].backgroundColor, '#16A34A')
  assert.equal(placementSheet.data[0][DTW_HEADERS.placement.indexOf('Total Building Placement')].backgroundColor, '#2563EB')
  assert.equal(placementSheet.data[0][DTW_HEADERS.placement.indexOf('Remarks')].backgroundColor, '#16A34A')
  assert.equal(placementSheet.data[0][DTW_HEADERS.placement.indexOf('Item Code')].backgroundColor, '#2563EB')
  const growingSheet = exportedWorkbook.find(sheet => sheet.sheet === 'Growing')
  assert.equal(growingSheet.data[0][DTW_HEADERS.growing.indexOf('Age')].backgroundColor, '#2563EB')
  const writeXlsx = require('write-excel-file/node').default
  const readXlsx = require('read-excel-file/node').default
  let actualBuffer
  const actualLoaded = { exports: {} }
  const actualRequire = id => {
    if (id === 'write-excel-file/browser') return { __esModule: true, default: (data, options) => ({
      toFile: async () => { actualBuffer = await writeXlsx(data, options).toBuffer() },
    }) }
    if (id === './types') return { BROILER_DTW_SOURCE_ROW: Symbol('broilerDtwSourceRow') }
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
  await actualLoaded.exports.exportBroilerDtwValidationReport(duplicateHarvest)
  const savedReport = await readXlsx(actualBuffer)
  assert.deepEqual(savedReport.map(sheet => sheet.sheet), [
    'Validation Report', 'DOC Placement', 'Growing', 'Harvest Delivery', 'Clean Up',
  ])
  assert.equal(savedReport[0].data[3][1], 'Ready to import')
  await exportBroilerDtwValidationReport(duplicateHarvest)
  assert.deepEqual(exportedWorkbook.map(sheet => sheet.sheet), [
    'Validation Report', 'DOC Placement', 'Growing', 'Harvest Delivery', 'Clean Up',
  ])
  assert.equal(exportedWorkbook[0].data[3][1].value, 'Ready to import')
  assert.ok(exportedWorkbook[0].data.some(row => row[1]?.value?.includes?.('Harvest Delivery rows 2, 3 were combined')))
  console.log('PASS: Broiler DTW placement totals, calculated Growing age, tolerant headers, optional placement dates, and Cycle Master placement batches')
}).catch(error => {
  console.error(error)
  process.exitCode = 1
})
