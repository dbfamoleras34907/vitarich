import assert from 'node:assert/strict'
import test from 'node:test'

import {
  planBatchQuantityReallocation,
  type BatchReallocationCandidate,
  type BatchReallocationLine,
} from '../../lib/functions/reallocateBatchQuantities'

const candidate = (
  key: string,
  onHandBaseQty: number,
  oldestDate: string,
  itemCode = 'DOC00002',
): BatchReallocationCandidate => ({
  key,
  itemCode,
  warehouseCode: key.split('|')[1],
  batchNumber: key.split('|')[2],
  onHandBaseQty,
  oldestDate,
})

const line = (
  id: string,
  groupKey: string,
  batchKey: string,
  allocatedBaseQty: number,
  requestedBaseQty = allocatedBaseQty,
  itemCode = 'DOC00002',
): BatchReallocationLine => ({
  id,
  groupKey,
  itemCode,
  batchKey,
  allocatedBaseQty,
  requestedBaseQty,
})

test('preserves valid allocations and moves an out-of-stock line to available stock', () => {
  const oldBatch = 'DOC00002|BD-1|BATCH-A'
  const emptyBatch = 'DOC00002|BD-1|BATCH-B'
  const plan = planBatchQuantityReallocation([
    line('1', 'group-1', oldBatch, 36_532),
    line('2', 'group-2', emptyBatch, 2_000),
  ], [
    candidate(oldBatch, 38_668, '2026-01-01'),
    candidate(emptyBatch, 0, '2026-02-01'),
  ])

  assert.deepEqual(plan.allocations.map(allocation => ({
    group: allocation.groupKey,
    batch: allocation.candidateKey,
    qty: allocation.baseQty,
    status: allocation.status,
  })), [
    { group: 'group-1', batch: oldBatch, qty: 36_532, status: 'preserved' },
    { group: 'group-2', batch: oldBatch, qty: 2_000, status: 'reallocated' },
  ])
  assert.equal(plan.shortageBaseQty, 0)
})

test('splits a shortage across oldest same-item batches and ignores another item', () => {
  const emptyBatch = 'DOC00002|BD-1|EMPTY'
  const oldest = 'DOC00002|BD-2|BATCH-A'
  const next = 'DOC00002|BD-3|BATCH-B'
  const otherItem = 'DOC00003|BD-1|OLDER'
  const plan = planBatchQuantityReallocation([
    line('1', 'group-1', emptyBatch, 1_000),
  ], [
    candidate(otherItem, 1_000, '2025-01-01', 'DOC00003'),
    candidate(next, 500, '2026-02-01'),
    candidate(oldest, 750, '2026-01-01'),
    candidate(emptyBatch, 0, '2026-03-01'),
  ])

  assert.deepEqual(plan.allocations.map(allocation => [allocation.candidateKey, allocation.baseQty]), [
    [oldest, 750],
    [next, 250],
  ])
})

test('accounts for quantities already reserved by valid lines without double allocation', () => {
  const oldest = 'DOC00002|BD-1|BATCH-A'
  const next = 'DOC00002|BD-2|BATCH-B'
  const empty = 'DOC00002|BD-3|EMPTY'
  const plan = planBatchQuantityReallocation([
    line('1', 'group-1', oldest, 700),
    line('2', 'group-2', empty, 500),
  ], [
    candidate(oldest, 1_000, '2026-01-01'),
    candidate(next, 500, '2026-02-01'),
    candidate(empty, 0, '2026-03-01'),
  ])

  assert.deepEqual(plan.allocations.map(allocation => [allocation.candidateKey, allocation.baseQty]), [
    [oldest, 700],
    [oldest, 300],
    [next, 200],
  ])
})

test('allocates all available stock and leaves the remainder visible on the original batch', () => {
  const original = 'DOC00002|BD-1|EMPTY'
  const first = 'DOC00002|BD-1|BATCH-A'
  const second = 'DOC00002|BD-2|BATCH-B'
  const plan = planBatchQuantityReallocation([
    line('1', 'group-1', original, 1_000),
  ], [
    candidate(first, 400, '2026-01-01'),
    candidate(second, 350, '2026-02-01'),
    candidate(original, 0, '2026-03-01'),
  ])

  assert.deepEqual(plan.allocations.map(allocation => [allocation.status, allocation.candidateKey, allocation.baseQty]), [
    ['reallocated', first, 400],
    ['reallocated', second, 350],
    ['shortage', original, 250],
  ])
  assert.equal(plan.shortageBaseQty, 250)
})
