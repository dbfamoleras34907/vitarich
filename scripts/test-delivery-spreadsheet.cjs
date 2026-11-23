const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// Load only the pure TypeScript helpers; no React, browser, or database access.
function load(relative) {
  const filename = path.resolve(relative)
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', source)(name => {
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`)
    return require(name)
  }, module, module.exports)
  return module.exports
}
const { parseDeliveryPaste, deliveryDateValue, prepareDeliveryPaste, calculateHarvestAlw, DELIVERY_COLUMNS } = load('app/inv/gi/new/deliverySpreadsheet.ts')
const { calculateBirdAgeFromPlacementDate } = load('app/brd/fc/age.ts')
const { parseExcelClipboard } = load('lib/utils/parseExcelClipboard.ts')
const { quantityExceeds } = load('lib/utils/quantityComparison.ts')
const { formatNumberRanges } = load('lib/utils/formatNumberRanges.ts')
let serial = 0
const newLine = () => ({ id: `new-${++serial}`, allocationGroupKey: `group-${serial}`, harvestAge: 40, deliveredDate: '2026-09-11', itemId: null, itemCode: '', description: '', altQty: 1, requestedAltQty: 1, altUom: '', baseQty: 0, baseUom: '', fromWarehouseId: null, fromWarehouseCode: '', fromWarehouseName: '', batchNumber: '', batchRuleId: null, manufacturingDate: '', expiryDate: '', onHandQty: 0 })
const base = {
  startRow: 0, newLine, getAllocationGroupKey: line => line.allocationGroupKey,
  warehouses: [{ id: 1, whse_code: 'B1', whse_name: 'Building One' }],
  items: [{ id: 2, item_code: 'DOC', item_name: 'Bird', inventory_uom: 'PCS' }],
  getPlacementBatches: async () => ['BATCH-A', 'BATCH-B'].map(batchNumber => ({ batchNumber, itemCode: 'DOC', onHandQty: 100, manufacturingDate: '2026-08-01', expiryDate: '' })),
  getHarvestAge: async (_line, deliveredDate) => Math.floor((Date.parse(`${deliveredDate}T00:00:00Z`) - Date.parse('2026-08-01T00:00:00Z')) / 86_400_000) + 1,
  getAverageLiveWeight: async (_line, age) => age * 100,
  getDefaultAltUom: () => 'PCS', getGroupUoms: () => [{ uomCode: 'PCS' }],
  calculateBaseQty: (qty, uom) => uom === 'PCS' ? qty : 0, getBatchRuleId: () => null,
}

async function run() {
  assert.equal(quantityExceeds(0.1 + 0.2, 0.3), false)
  assert.equal(quantityExceeds(0.300002, 0.3), true)
  assert.equal(formatNumberRanges([22, 1, 2, 3, 5, 6, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]), '1–3, 5–6, 8–22')
  assert.equal(calculateBirdAgeFromPlacementDate('2026-08-01', '2026-08-01'), 1)
  assert.equal(calculateBirdAgeFromPlacementDate('2026-08-01', '2026-08-02'), 2)
  assert.equal(calculateBirdAgeFromPlacementDate('2026-08-31', '2026-09-01'), 2)
  assert.equal(calculateBirdAgeFromPlacementDate('2026-02-30', '2026-03-01'), null)
  const saveSql = fs.readFileSync(path.resolve('app/sql/updated/save_br_delivery_transaction.sql'), 'utf8')
  assert.match(saveSql, /select min\(doc\.receive_date\)/i)
  assert.match(saveSql, /v_harvest_age := \(v_delivery_date - v_placement_date\) \+ 1/i)
  assert.match(saveSql, /harvest_age = v_harvest_age/i)
  assert.equal(calculateHarvestAlw(1250, 500), 2.5)
  assert.equal(calculateHarvestAlw(null, 500), null)
  assert.equal(calculateHarvestAlw(1250, 0), null)
  assert.equal(calculateHarvestAlw(0, 500), 0)
  assert.deepEqual(parseDeliveryPaste('Age\tHarvest Quantity\tNet Live Weight\tALW\n41\t500\t1250\t999', 0), [{ requestedAltQty: '500', netLiveWeight: '1250' }])
  assert.deepEqual(parseExcelClipboard('"A\tB"\t"C\nD"\t"E""F"\r\n'), [['A\tB', 'C\nD', 'E"F']])
  assert.throws(() => parseExcelClipboard('"unfinished'), /unclosed/)
  assert.equal(deliveryDateValue('9/1/2026'), '2026-09-01')
  assert.throws(() => deliveryDateValue('2026-02-30'), /valid/)
  assert.throws(() => parseDeliveryPaste('A\tB', DELIVERY_COLUMNS.length - 1), /last table column/)
  assert.deepEqual(parseDeliveryPaste('Plate Number\r\n000123\r\n000456\r\n', 1), [{ plateNumber: '000123' }, { plateNumber: '000456' }])
  const initial = [newLine()]
  const before = JSON.stringify(initial)
  const added = await prepareDeliveryPaste({ ...base, lines: initial, rows: parseDeliveryPaste('Delivered Date\tBuilding\tItem\tHarvest Quantity\tUOM\tPlate Number\n9/1/2026\tB1\tDOC\t2\tPCS\t0001\n9/2/2026\tBuilding One\tBird\t3\tPCS\t0002\n9/3/2026\tB1 - Building One\tDOC - Bird\t4\tPCS\t0003', 0) })
  assert.equal(added.length, 3)
  assert.equal(added[2].plateNumber, '0003')
  assert.equal(added[2].deliveredDate, '2026-09-03')
  assert.equal(added[2].harvestAge, 34)
  assert.equal(added[2].averageLiveWeight, 3400)
  assert.equal(added[2].baseQty, 4)
  assert.equal(new Set(added.map(line => line.allocationGroupKey)).size, 3)
  assert.equal(JSON.stringify(initial), before)
  const allocations = await prepareDeliveryPaste({ ...base, lines: [newLine()], rows: [{ fromWarehouseCode: 'B1', itemCode: 'DOC', requestedAltQty: '5', batchNumber: 'BATCH-A (2); BATCH-B (3)', deliveredDate: '9/4/2026' }] })
  assert.equal(allocations.length, 2)
  assert.equal(allocations[0].allocationGroupKey, allocations[1].allocationGroupKey)
  assert.deepEqual(allocations.map(line => line.altQty), [2, 3])
  const weighted = await prepareDeliveryPaste({ ...base, lines: allocations, rows: [{ netLiveWeight: '12.5' }] })
  assert.deepEqual(weighted.map(line => line.netLiveWeight), [12.5, 12.5])
  assert.deepEqual(weighted.map(line => line.altQty), [2, 3])
  assert.equal(calculateHarvestAlw(weighted[0].netLiveWeight, weighted.reduce((sum, line) => sum + line.altQty, 0)), 2.5)
  const aged = await prepareDeliveryPaste({ ...base, lines: weighted, rows: [{ deliveredDate: '2026-09-10' }] })
  assert.ok(aged.every(line => line.harvestAge === 41))
  assert.ok(aged.every(line => line.averageLiveWeight === 4100))
  const overridden = await prepareDeliveryPaste({ ...base, lines: aged, rows: [{ averageLiveWeight: '2250.5' }] })
  assert.ok(overridden.every(line => line.averageLiveWeight === 2250.5))
  await assert.rejects(prepareDeliveryPaste({ ...base, lines: allocations, rows: [{ netLiveWeight: '-1' }] }), /negative/)
  await assert.rejects(prepareDeliveryPaste({ ...base, lines: allocations, rows: [{ averageLiveWeight: '-1' }] }), /negative/)
  const cleared = await prepareDeliveryPaste({ ...base, lines: weighted, rows: [{ netLiveWeight: '' }] })
  assert.ok(cleared.every(line => line.netLiveWeight === null))
  const untouched = newLine()
  const changed = await prepareDeliveryPaste({ ...base, lines: [...allocations, untouched], rows: [{ tsDrNo: '001', deliveredDate: '9/5/2026' }, { tsDrNo: '002' }, { tsDrNo: '003' }] })
  assert.equal(changed.length, 4)
  assert.deepEqual(changed.slice(0, 2).map(line => line.deliveredDate), ['2026-09-05', '2026-09-05'])
  assert.deepEqual(changed.slice(0, 2).map(line => line.altQty), [2, 3])
  assert.equal(changed[2].tsDrNo, '002')
  assert.equal(changed[3].tsDrNo, '003')
  const quantityOnly = await prepareDeliveryPaste({ ...base, lines: [newLine()], rows: [{ requestedAltQty: '25' }, { requestedAltQty: '30' }] })
  assert.deepEqual(quantityOnly.map(line => line.requestedAltQty), [25, 30])
  await assert.rejects(prepareDeliveryPaste({ ...base, lines: initial, rows: [{ plateNumber: 'changed' }, { fromWarehouseCode: 'OUTSIDE-FARM', itemCode: 'DOC' }] }), /Row 2: Building/)
  assert.equal(JSON.stringify(initial), before)
  await assert.rejects(prepareDeliveryPaste({ ...base, lines: allocations, rows: [{ requestedAltQty: '10', batchNumber: 'BATCH-A (2); BATCH-B (3)' }] }), /must equal/)
  await assert.rejects(prepareDeliveryPaste({ ...base, lines: allocations, rows: [{ requestedAltQty: '101', batchNumber: 'BATCH-A' }] }), /insufficient/)
  const decimalBase = { ...base, calculateBaseQty: qty => qty * 0.1 }
  await prepareDeliveryPaste({ ...decimalBase, lines: [newLine()], rows: [{ fromWarehouseCode: 'B1', itemCode: 'DOC', requestedAltQty: '3', batchNumber: 'BATCH-A' }], getPlacementBatches: async () => [{ batchNumber: 'BATCH-A', itemCode: 'DOC', onHandQty: 0.3, manufacturingDate: '2026-08-01', expiryDate: '' }] })
  await assert.rejects(prepareDeliveryPaste({ ...base, lines: allocations, rows: [{ itemCode: 'OTHER' }] }), /placement item/)
  console.log('Delivery spreadsheet checks passed: parsing, dates, overflow, grouped allocations, leading zeros, partial columns, and atomic rejection.')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
