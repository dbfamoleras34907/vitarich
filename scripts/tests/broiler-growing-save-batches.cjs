/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const repository = fs.readFileSync('lib/data/repositories/broilerGrowingSave.ts', 'utf8')
const api = fs.readFileSync('app/brd/fc/new/api.ts', 'utf8')
const layout = fs.readFileSync('app/brd/fc/new/Layout.tsx', 'utf8')
const sql = fs.readFileSync('app/sql/updated/save_brd_fc_transaction.sql', 'utf8')

test('Growing rows save in sequential batches of five with three attempts', () => {
  assert.match(repository, /GROWING_SAVE_BATCH_SIZE = 5/)
  assert.match(repository, /GROWING_SAVE_MAX_ATTEMPTS = 3/)
  assert.match(repository, /offset \+= GROWING_SAVE_BATCH_SIZE/)
  assert.match(repository, /attempt <= GROWING_SAVE_MAX_ATTEMPTS/)
  assert.match(repository, /batchResult = await saveBroilerGrowingTransaction/)

  const queue = repository.slice(repository.indexOf('export async function saveBroilerGrowingTransactionInBatches'))
  assert.doesNotMatch(queue, /Promise\.all/)
})

test('Committed batches update page state before the queue continues', () => {
  assert.match(api, /onBatchSaved\?:/)
  assert.match(api, /saveBroilerGrowingTransactionInBatches/)
  assert.match(layout, /onBatchSaved: applySavedBatch/)
  assert.match(layout, /Saving batch \$\{progress\.batchNumber\} of \$\{progress\.totalBatches\}/)
})

test('Only the final batch publishes the Growing save notification', () => {
  assert.match(sql, /action_request_id uuid not null/)
  assert.match(sql, /when \(new\.batch_number = new\.total_batches\)/)
  assert.match(sql, /v_event \|\| ':' \|\| new\.action_request_id::text/)
})
