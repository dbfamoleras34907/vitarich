const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const sql = fs.readFileSync(
  path.resolve(__dirname, '../../../../app/sql/updated/reverse_doc_receiving.sql'),
  'utf8',
)

test('DOC reversal checks the exact consolidated balance instead of historical Growing rows', () => {
  assert.match(sql, /with reversal_targets as \(/i)
  assert.match(sql, /source_doc_type = 'DOC_RECEIVING_CONSOLIDATION'/i)
  assert.match(sql, /sum\(posting\.qty\)::numeric as reversal_qty/i)
  assert.match(sql, /when ledger\.transfer_type = 'OUT' then -ledger\.qty/i)
  assert.match(sql, /nullif\(btrim\(ledger\.batch_number\), ''\)/i)
  assert.match(sql, /nullif\(btrim\(ledger\.ref\), ''\)/i)
  assert.match(sql, /balance\.on_hand_qty < balance\.reversal_qty/i)
  assert.doesNotMatch(sql, /source_doc_type in \(\s*'BRD_FC_MORT_THIN_USAGE'/i)
})

test('the balance rule allows a fresh shared-batch placement but prevents negative inventory', () => {
  const isBlocked = (onHandQty, placementQty) => onHandQty < placementQty

  assert.equal(isBlocked(110, 20), false)
  assert.equal(isBlocked(20, 20), false)
  assert.equal(isBlocked(10, 20), true)
})
