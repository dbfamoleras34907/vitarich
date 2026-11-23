import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveFarmWarehouseAssociations } from '../../lib/data/repositories/farmWarehouseAssociations'
import type { WarehouseData } from '../../lib/types'

const warehouse = (values: Partial<WarehouseData>): WarehouseData => ({
  id: 1,
  whse_code: 'WH-0000001',
  whse_name: 'Warehouse 1',
  warehouse_type: 'Warehouse',
  is_active: true,
  farm_id: null,
  ...values,
})

test('keeps active warehouses assigned to the farm', () => {
  const row = warehouse({ id: 10, farm_id: 205 })

  const result = resolveFarmWarehouseAssociations(205, [row], [])

  assert.deepEqual(result.assigned.map(item => item.id), [10])
  assert.deepEqual(result.assignable, [])
})

test('excludes an inactive warehouse from the farm edit draft', () => {
  const row = warehouse({
    id: 306,
    whse_code: 'WH-0000306',
    farm_id: 205,
    is_active: false,
  })

  const result = resolveFarmWarehouseAssociations(205, [row], [{
    id: 306,
    whse_code: 'WH-0000306',
    is_default_feed: true,
  }])

  assert.deepEqual(result.assigned, [])
  assert.deepEqual(result.assignable, [])
})

test('ignores a stale saved association when the voided warehouse is hidden', () => {
  const active = warehouse({ id: 20, whse_code: 'WH-0000020', farm_id: 205 })

  const result = resolveFarmWarehouseAssociations(205, [active], [{
    id: 306,
    whse_code: 'WH-0000306',
  }])

  assert.deepEqual(result.assigned.map(item => item.id), [20])
})

test('still rejects an active warehouse assigned to a different farm', () => {
  const row = warehouse({ id: 306, whse_code: 'WH-0000306', farm_id: 999 })

  assert.throws(
    () => resolveFarmWarehouseAssociations(205, [row], [{ id: 306, whse_code: 'WH-0000306' }]),
    /belongs to farm 999/,
  )
})
