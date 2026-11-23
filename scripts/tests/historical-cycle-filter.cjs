const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const source = fs.readFileSync(
  path.resolve(__dirname, '../../lib/data/repositories/broilerCycleReferences.ts'),
  'utf8',
)
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

const calls = []

function responseFor(call) {
  if (call.table === 'flock_card' && call.equals.cycle_no === '11260001') {
    return { data: [{ id: 10, farm_cycle_id: 5 }], error: null }
  }
  if (call.table === 'doc_farm_cycles' && call.equals.cycle_mask === '11260001') {
    return { data: [{ id: 5 }], error: null }
  }
  if (call.table === 'flock_card' && call.inValues.farm_cycle_id) {
    return { data: [{ id: 10, farm_cycle_id: 5 }, { id: 11, farm_cycle_id: 5 }], error: null }
  }
  if (call.table === 'flock_card' && call.inValues.id) {
    return { data: [
      { id: 10, cycle_no: '1', cycle_mask: '11260001', doc_farm_cycles: null },
      { id: 11, cycle_no: '2', cycle_mask: null, doc_farm_cycles: { cycle_mask: '11260002' } },
    ], error: null }
  }
  if (call.table === 'flock_card' && call.range) {
    return { data: [
      { id: 10, cycle_no: '1', cycle_mask: '11260001', doc_farm_cycles: null },
      { id: 11, cycle_no: '2', cycle_mask: null, doc_farm_cycles: { cycle_mask: '11260002' } },
      { id: 12, cycle_no: '2', cycle_mask: '11260002', doc_farm_cycles: null },
    ], error: null }
  }
  return { data: [], error: null }
}

function builder(table) {
  const call = { table, equals: {}, inValues: {} }
  calls.push(call)
  const query = {
    select() { return query },
    eq(column, value) { call.equals[column] = String(value); return query },
    in(column, values) { call.inValues[column] = values; return query },
    order() { return query },
    range(from, to) { call.range = [from, to]; return query },
    then(resolve) { return Promise.resolve(responseFor(call)).then(resolve) },
  }
  return query
}

const mod = { exports: {} }
new Function('require', 'module', 'exports', code)(
  () => ({ db: { from: table => builder(table) } }),
  mod,
  mod.exports,
)

void (async () => {
  const result = await mod.exports.getBroilerCycleReferenceIds(' 11260001 ', { farmIdentifier: 65 })
  assert.deepEqual(result.farmCycleIds, [5])
  assert.deepEqual(result.flockCardIds.sort((left, right) => left - right), [10, 11])
  assert.ok(calls.every(call => call.equals.farm_id === '65'), 'farm scope is applied to every lookup')

  const options = await mod.exports.listBroilerCycleReferenceOptions({ farmIdentifier: 65 })
  assert.deepEqual(options, [
    { value: '11260002', label: '11260002' },
    { value: '11260001', label: '11260001' },
  ], 'dropdown includes unique raw and linked historical cycle masks')

  const labels = await mod.exports.getBroilerCycleLabelsByFlockCardIds([10, 11, 10])
  assert.deepEqual([...labels.entries()], [[10, '11260001'], [11, '11260002']])

  const empty = await mod.exports.getBroilerCycleReferenceIds('   ')
  assert.deepEqual(empty, { farmCycleIds: [], flockCardIds: [] })

  console.log('Historical cycle filter regressions passed.')
})()
