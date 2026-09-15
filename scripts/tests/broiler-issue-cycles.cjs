const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const source = fs.readFileSync(path.resolve(__dirname, '../../lib/data/repositories/broilerIssueCycles.ts'), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const mod = { exports: {} }
const maskMod = { exports: {} }
const maskCode = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../lib/broiler/cycleMask.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
new Function('module', 'exports', maskCode)(maskMod, maskMod.exports)
new Function('require', 'module', 'exports', code)(name => name.endsWith('/cycleMask') ? maskMod.exports : { db: {} }, mod, mod.exports)
const { attachBroilerIssueCycles, formatBroilerCycleNumbers } = mod.exports
const card = { id: 5, farm_id: 65, building_whse_id: 134, building_code: 'BD-0000021', card_no: 'FLOCK-1',
  cycle_no: '1', cycle_mask: '09260001', farm_cycle_id: 9, doc_farm_cycles: { cycle_no: 7 }, flock_card_origin: [], extra: null }
const newer = { ...card, id: 6, cycle_no: '2', card_no: 'FLOCK-2', doc_farm_cycles: { cycle_no: 8 } }
const line = { id: 1, itemCode: 'DOC00002', fromWarehouseId: 134, fromWarehouseCode: 'BD-0000021', batchNumber: 'DOC:F65:B134:1' }
const issue = { id: 7, triggeredBy: 'BR-DR', farmId: 65, status: 'Posted', lines: [line] }
function resolved(document = issue, cards = [newer, card]) { return attachBroilerIssueCycles([document], cards)[0].lines[0] }
assert.equal(resolved().flockCardId, 5, 'older harvest resolves saved batch, not newest cycle')
const carriedOrigin = { ...newer, flock_card_origin: [{ item_code: 'DOC00002', batch_no: 'DOC:F65:B134:1', void: '1' }] }
assert.equal(resolved(issue, [card, carriedOrigin]).flockCardId, 5, 'canonical cycle wins over a newer cycle origin referencing its batch')
assert.equal(resolved({ ...issue, triggeredBy: 'BR-CU' }, [card, carriedOrigin]).flockCardId, 5, 'old posted cleanup remains assigned to its own canonical cycle')
assert.equal(formatBroilerCycleNumbers(resolved()), '09260001', 'same cycle number used by Growing')
assert.equal(resolved({ ...issue, status: 'Cancelled' }).flockCardId, 5, 'reversed harvest retains original cycle')
assert.equal(resolved({ ...issue, triggeredBy: 'BR-CU', status: 'Cancelled' }).flockCardId, 5, 'reversed cleanup retains original cycle after closeout metadata is removed')
assert.equal(resolved({ ...issue, lines: [{ ...line, batchNumber: 'DOC:F999:B134:1' }] }).cycleNumber, null, 'wrong farm batch cannot match')
assert.equal(resolved({ ...issue, lines: [{ ...line, fromWarehouseId: 999 }] }).cycleNumber, null, 'wrong building cannot match')
assert.equal(resolved(issue, []).cycleNumber, null, 'no current-cycle fallback for missing history')
const legacy = { ...card, flock_card_origin: [{ item_code: 'DOC00002', batch_no: 'OLD-BATCH', void: '1' }] }
const legacyIssue = { ...issue, lines: [{ ...line, batchNumber: 'OLD-BATCH' }] }
assert.equal(resolved(legacyIssue, [newer, legacy]).cycleNumber, '1', 'legacy origin batch traced')
assert.equal(resolved(legacyIssue, [legacy, { ...legacy, id: 8 }]).cycleNumber, null, 'ambiguous legacy match is not guessed')
assert.equal(resolved({ ...issue, triggeredBy: 'BR-CU', lines: [{ ...line, batchNumber: '' }] }, [
  { ...card, extra: { closed_by_doc_type: 'BR_CLEANUP', closed_by_docentry: 7 } }, newer,
]).flockCardId, 5, 'cleanup closeout identity supports legacy history')
assert.equal(formatBroilerCycleNumbers({ cycleNumber: '1', cycleMask: '09260001' }), '09260001')
assert.equal(formatBroilerCycleNumbers({}), '—')
const second = { ...card, id: 9, building_whse_id: 135, building_code: 'B2', cycle_no: '3' }
const multi = attachBroilerIssueCycles([{ ...issue, lines: [line, { ...line, id: 2, fromWarehouseId: 135, fromWarehouseCode: 'B2', batchNumber: 'DOC:F65:B135:3' }] }], [card, second])[0]
assert.deepEqual(multi.lines.map(entry => entry.cycleNumber), ['1', '3'], 'each building retains its own cycle')
console.log('Broiler issue cycle tracing regressions passed.')

assert.equal(resolved().cycleNumber, '1', 'internal cycle remains numeric for inventory matching')
assert.equal(formatBroilerCycleNumbers(resolved(issue, [{ ...card, doc_farm_cycles: { cycle_mask: '08260001' } }])), '08260001', 'linked buildings use the farm display')
