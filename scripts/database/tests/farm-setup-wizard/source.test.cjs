const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../../../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('farm setup SQL persists and retrieves structured addresses', () => {
  const insertSql = read('app/sql/updated/insert_farm_setup_wizard.sql')
  const updateSql = read('app/sql/updated/update_farm_setup_wizard.sql')
  const getSql = read('app/sql/updated/get_farm_full.sql')

  for (const sql of [insertSql, updateSql]) {
    assert.match(sql, /public\.farm_addresses/)
    assert.match(sql, /barangay/)
    assert.match(sql, /city/)
    assert.match(sql, /province/)
  }

  assert.match(getSql, /from public\.farm_addresses a/)
  assert.match(getSql, /'barangay', a\.barangay/)
  assert.match(getSql, /'city', a\.city/)
})

test('farm setup SQL verifies every structure and all three defaults', () => {
  const insertSql = read('app/sql/updated/insert_farm_setup_wizard.sql')
  const updateSql = read('app/sql/updated/update_farm_setup_wizard.sql')

  assert.match(insertSql, /assigned_warehouse_count <> cardinality\(warehouse_ids\)/)
  assert.match(updateSql, /persisted_warehouse_count <> expected_warehouse_count/)

  for (const sql of [insertSql, updateSql]) {
    assert.match(sql, /default_feed_count <> 1/)
    assert.match(sql, /default_receiving_count <> 1/)
    assert.match(sql, /default_disposal_count <> 1/)
  }
})

test('farm profile deployment script references only deployable SQL files', () => {
  const applyScript = read('app/a_dean/farm/apply_farm_profile.psql')
  const includes = [...applyScript.matchAll(/\\ir\s+([^\r\n]+)/g)].map((match) => match[1].trim())

  assert.ok(includes.includes('../../sql/updated/get_farm_full.sql'))
  for (const include of includes) {
    assert.equal(fs.existsSync(path.resolve(root, 'app/a_dean/farm', include)), true, include)
  }
})

test('warehouse loading paginates beyond the Data API row cap', () => {
  const warehouseRepository = read('lib/data/repositories/warehouses.ts')
  const warehouseApi = read('app/a_dean/warehouse/api.ts')
  const goodsReceiptReferences = read('lib/data/repositories/goodsReceiptReferences.ts')

  assert.match(warehouseRepository, /\.order\('id'\)/)
  assert.match(warehouseRepository, /\.range\(from, from \+ WAREHOUSE_FETCH_PAGE_SIZE - 1\)/)
  assert.match(warehouseRepository, /warehouses\.push\(\.\.\.page\)/)
  assert.match(warehouseApi, /getWarehouseRows\(\)/)
  assert.equal((goodsReceiptReferences.match(/getWarehouseRows\(\{ activeOnly: true \}\)/g) ?? []).length, 2)
})
