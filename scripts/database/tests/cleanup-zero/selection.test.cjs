// Run: node scripts/database/tests/cleanup-zero/selection.test.cjs
// Execute the actual eligibility loader with controlled database responses.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const cards = [1, 2, 3, 4].map(id => ({
  id, card_no: `FC${id}`, farm_id: 1, farm_cycle_id: 10, building_whse_id: id,
  building_code: `B${id}`, building_name: `Building ${id}`,
  cycle_no: '1', status: 'Saved', start_date: '2026-08-01',
}))
const mocks = {
  '@/lib/broiler/cycleMask': { getBroilerCycleDisplay: row => row.cycle_mask ?? '' },
  '@/lib/Supabase/supabaseClient': { db: { from(table) {
    const result = { data: table === 'flock_card' ? cards : [], error: null }
    const query = { then(resolve) { return Promise.resolve(result).then(resolve) } }
    for (const method of ['select', 'eq', 'order', 'in']) query[method] = () => query
    return query
  } } },
  '@/lib/data/repositories/brCleanup': {
    getCleanupCycleInventoryBatches: async (farmId, farmCycleId) => {
      assert.equal(farmId, 1)
      assert.equal(farmCycleId, 10)
      return [1, 2, 3].map(id => ({
        flock_card_id: id, building_warehouse_id: id, building_code: `B${id}`,
        item_code: 'DOC', item_name: 'DOC', batch_number: `DOC:F1:B${id}:1`,
        warehouse_code: `B${id}`, on_hand_qty: id === 1 ? 0 : 10,
      }))
    },
  },
  '@/lib/data/repositories/broilerGrowing': {
    getLastMortalityAge: async id => id === 3 ? 45 : null,
    getLatestBroilerGrowingHeaders: async () => [],
    getBroilerGrowingHeader: () => null,
  },
  '@/app/brd/fc/api': { getFarmOriginBatchesForFlockCard: async (_farmId, buildingCode) =>
    ['B2', 'B3'].includes(buildingCode) ? [{
      id: buildingCode, itemCode: 'DOC', itemName: 'DOC',
      batchNumber: `DOC:F1:${buildingCode}:1`, warehouseCode: buildingCode,
      onHandQty: 10, manufacturingDate: '', expiryDate: '',
    }] : [],
  },
  '@/lib/data/repositories/farms': {},
  '@/app/inv/gr/new/api': {},
}
const file = path.resolve(__dirname, '../../../../app/inv/gi/new/api.ts')
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const mod = { exports: {} }
new Function('require', 'module', 'exports', code)(name => {
  assert.ok(name in mocks, `Unexpected dependency: ${name}`)
  return mocks[name]
}, mod, mod.exports)

async function run() {
  const cleanup = await mod.exports.getAvailableDeliveryFlockCards({ farmId: 1, farmCycleId: 10, targetAge: 40, cleanupCycleInventory: true })
  assert.deepEqual(cleanup.map(card => card.id), [1, 3], 'A zero-balance cycle can close without age; positive inventory still requires age')
  const harvest = await mod.exports.getAvailableDeliveryFlockCards({ farmId: 1, targetAge: 40 })
  assert.deepEqual(harvest.map(card => card.id), [3], 'Harvest eligibility is unchanged')
  const batches = await mod.exports.getDeliveryFlockCardPlacementBatches({
    flockCardId: 1, farmId: 1, farmCycleId: 10, buildingCode: 'B1', cleanupCycleInventory: true,
  })
  assert.equal(batches[0].onHandQty, 0)
  assert.equal(batches[0].cleanupZeroBalance, true)
  assert.equal(batches[0].batchNumber, 'DOC:F1:B1:1')
  const historical = await mod.exports.getDeliveryFlockCardInfo({ farmId: 1, buildingWarehouseId: 2, buildingCode: 'B2', flockCardId: 2 })
  assert.equal(historical.id, 2, 'historical lookup uses resolved cycle identity')
  const missing = await mod.exports.getDeliveryFlockCardInfo({ farmId: 1, buildingWarehouseId: 2, buildingCode: 'B2', flockCardId: 999 })
  assert.equal(missing, null, 'missing historical cycle does not fall back to an active cycle')
  const unresolved = await mod.exports.getDeliveryFlockCardInfo({ farmId: 1, buildingWarehouseId: 2, buildingCode: 'B2', flockCardId: null })
  assert.equal(unresolved, null, 'unresolved posted cycle stays unknown')
  console.log('Cleanup building selection regressions passed.')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
