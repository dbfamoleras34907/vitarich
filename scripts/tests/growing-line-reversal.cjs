/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..', '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('one-line mortality reversal confirms every source posting before returning', () => {
  for (const relativePath of [
    'app/brd/fc/reverse_brd_fc_transaction.sql',
    'app/brd/fc/new/flock_card_tables.sql',
  ]) {
    const sql = read(relativePath)
    const functionStart = sql.indexOf('create or replace function public.reverse_brd_fc_mortality_thinning')
    const functionEnd = sql.indexOf('\n$$;', functionStart)
    const fn = sql.slice(functionStart, functionEnd)

    assert.match(fn, /get diagnostics v_updated_count = row_count;/)
    assert.match(fn, /if v_updated_count <> 1 then/)
    assert.match(fn, /not public\.brd_fc_mort_thin_posting_is_reversed\(posting\.id, p_line_id\)/)
    assert.match(fn, /if v_outstanding_count <> 0 then/)
  }
})

test('new Growing UI only reports success after the requested line is confirmed', () => {
  const api = read('app/brd/fc/new/api.ts')
  const layout = read('app/brd/fc/new/Layout.tsx')
  const rpcAwait = layout.indexOf('await reverseFlockCardMortalityThinning(savedLine.id')
  const successToast = layout.indexOf('mortality/thinning reversed. You can now enter corrected values.')

  assert.match(api, /reversedId !== lineId/)
  assert.match(api, /the database did not confirm the requested line/)
  assert.ok(rpcAwait >= 0 && successToast > rpcAwait)
  assert.match(layout, /disabled=\{rowAgeLocked \|\| reversingMortalityLineId != null\}/)
  assert.match(layout, /finally \{\s*setReversingMortalityLineId\(null\);/)
})
