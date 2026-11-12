import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const sql = readFileSync(path.resolve('app/sql/new/feed_farm_transfer.sql'), 'utf8')

test('approval owns both inventory movements and the final status change', () => {
  assert.match(sql, /create or replace function public\.approve_feed_farm_transfer/)
  assert.match(sql, /where id = p_transfer_id for update/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /'OUT'::text, v_transfer\.source_warehouse_code/)
  assert.match(sql, /'IN'::text, v_transfer\.destination_warehouse_code/)
  assert.match(sql, /set status = 'Approved'/)
})

test('approval preserves source traceability and creates the FR transfer batch', () => {
  assert.match(sql, /v_destination_batch := 'FR-' \|\| v_transfer\.id::text/)
  assert.match(sql, /line\.source_batch_number, v_destination_batch/)
  assert.match(sql, /v_destination_batch, line\.source_batch_number/)
})

test('submission does not create inventory postings', () => {
  const saveFunction = sql.slice(
    sql.indexOf('create or replace function public.save_feed_farm_transfer'),
    sql.indexOf('create or replace function public.approve_feed_farm_transfer'),
  )
  assert.doesNotMatch(saveFunction, /insert into public\.inventory_postings/)
  assert.match(saveFunction, /'Pending Approval'/)
})

test('farm authorization is evaluated before the IF condition', () => {
  assert.match(sql, /\) into v_has_both_farms;/)
  assert.match(sql, /\) into v_is_super_user;/)
  assert.match(sql, /if not v_has_both_farms and not v_is_super_user then/)
  assert.doesNotMatch(sql, /\) and not exists \(select 1 from public\.users/)
})
