import assert from 'node:assert/strict'
import test from 'node:test'

import { distributeWholeQuantityByCapacity } from '../../lib/functions/distributeWholeQuantityByCapacity'

test('redistributes a short batch share to the other available batch', () => {
  assert.deepEqual(
    distributeWholeQuantityByCapacity(22, [4, 39_916]),
    [4, 18],
  )
})

test('uses all available batches when each can cover an even share', () => {
  assert.deepEqual(
    distributeWholeQuantityByCapacity(22, [20, 20]),
    [11, 11],
  )
})

test('allocates the entire quantity to the only batch with stock', () => {
  assert.deepEqual(
    distributeWholeQuantityByCapacity(12, [0, 20]),
    [0, 12],
  )
})

test('honors the supplied remainder order for an uneven split', () => {
  assert.deepEqual(
    distributeWholeQuantityByCapacity(5, [10, 10], [1, 0]),
    [2, 3],
  )
})
