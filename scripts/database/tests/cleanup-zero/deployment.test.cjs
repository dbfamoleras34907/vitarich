const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repositoryRoot = path.resolve(__dirname, '../../../..')
const deploymentFiles = [
  'app/sql/updated/save_br_cleanup_transaction.sql',
  'app/sql/updated/deploy_harvest_emptied_cleanup.sql',
]

const zeroCloseoutUpgradeGuard =
  "position('get_cleanup_cycle_inventory_batches(new.farm_id, new.farm_cycle_id)' in v_definition) > 0"

for (const relativePath of [
  'app/sql/updated/allow_harvest_emptied_cleanup.sql',
  'app/sql/updated/deploy_harvest_emptied_cleanup.sql',
]) {
  const sql = fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
  assert.ok(sql.includes(zeroCloseoutUpgradeGuard),
    `${relativePath} must preserve an already-installed cycle-scoped posting trigger`)
}

for (const relativePath of deploymentFiles) {
  const sql = fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')

  assert.match(sql, /v_farm_cycle_id bigint := nullif\(p_document->>'farmCycleId', ''\)::bigint;/,
    `${relativePath} must read the selected Cycle Master ID`)
  assert.match(sql, /cycle\.id = v_farm_cycle_id and cycle\.farm_id = v_farm_id/,
    `${relativePath} must validate that the cycle belongs to the farm`)
  assert.match(sql, /farm_cycle_id = v_farm_cycle_id,/,
    `${relativePath} must persist the cycle when updating a draft`)
  assert.match(sql, /farm_id,\s*\r?\n\s*farm_cycle_id,\s*\r?\n\s*farm_code,/,
    `${relativePath} must persist the cycle when creating a document`)
  assert.match(sql, /v_farm_id,\s*\r?\n\s*v_farm_cycle_id,\s*\r?\n\s*nullif\(trim\(v_farm_code\), ''\),/,
    `${relativePath} must write the selected cycle value in the matching insert position`)
}

console.log('Cleanup deployment cycle persistence regressions passed.')
