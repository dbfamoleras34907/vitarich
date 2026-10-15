// Exercise the actual form handler without a browser or database writes.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const file = path.resolve(__dirname, '../../../../app/inv/gi/new/Layout.tsx')
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let handler
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'selectBatch') handler = node.initializer
  ts.forEachChild(node, visit)
}
visit(source)
assert.ok(handler, 'Batch-selection handler exists')
const compiled = ts.transpileModule(`const selectBatch = ${handler.getText(source)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

async function select({ cleanup = true, zeroBalance = true, stock = 0, requested = 1 } = {}) {
  const line = { id: '1', itemCode: 'DOC00002', batchNumber: '', fromWarehouseCode: 'BD-0000021',
    requestedAltQty: requested, altQty: requested, baseQty: requested, altUom: 'HEAD', baseUom: 'HEAD' }
  const batch = { itemCode: line.itemCode, batchNumber: 'DOC:F65:B134:1', onHandQty: stock, cleanupZeroBalance: zeroBalance }
  const item = { id: 1, item_code: line.itemCode, inventory_uom: 'HEAD' }
  let updated
  const messages = []
  const bindings = {
    issue: { status: 'Draft', lines: [line] },
    getBatchOptionsForLine: () => [batch], items: [item], getSelectedItem: () => item,
    getGroupUoms: () => [{ uomCode: 'HEAD' }], getDefaultAltUom: () => 'HEAD',
    isSameAllocationGroup: () => true, calculateBaseQty: qty => qty,
    isCleanup: cleanup, toast: message => messages.push(message), lineQuantityLabel: 'Clean up Quantity',
    getBatchRuleForLine: () => null, usesLineWarehouse: true, triggeredBy: cleanup ? 'BR-CU' : 'BR-DR',
    warehouseLabel: 'Building', updateLine: (_id, patch) => { updated = { ...line, ...patch } },
  }
  const selectBatch = new Function(...Object.keys(bindings), `${compiled}\nreturn selectBatch;`)(...Object.values(bindings))
  await selectBatch(line, batch.batchNumber)
  return { updated, messages }
}

async function run() {
  const zero = await select()
  assert.deepEqual(zero.messages, [])
  assert.equal(zero.updated.requestedAltQty, 0)
  assert.equal(zero.updated.altQty, 0)
  assert.equal(zero.updated.baseQty, 0)
  assert.equal(zero.updated.batchNumber, 'DOC:F65:B134:1')
  const positive = await select({ zeroBalance: false, stock: 50, requested: 100 })
  assert.equal(positive.updated.requestedAltQty, 100, 'Partial positive allocation keeps the full request')
  assert.equal(positive.updated.altQty, 50)
  const unqualified = await select({ zeroBalance: false })
  assert.equal(unqualified.updated, undefined, 'A zero quantity without a selected-cycle zero balance is rejected')
  const harvest = await select({ cleanup: false })
  assert.equal(harvest.updated, undefined, 'Harvest does not accept a zero allocation')
  console.log('Cleanup batch-allocation regressions passed.')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
