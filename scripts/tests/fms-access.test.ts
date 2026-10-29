import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeUserFmsTypes,
  userFmsTypesAreSubset,
  userFmsTypesOverlap,
} from '../../lib/auth/fmsAccess'

test('normalizes independent FMS selections and removes duplicates', () => {
  assert.deepEqual(
    normalizeUserFmsTypes(['Broiler', 'Hatchery', 'Broiler', 'Invalid']),
    ['Broiler', 'Hatchery'],
  )
})

test('uses the legacy scalar only when the array is empty', () => {
  assert.deepEqual(normalizeUserFmsTypes([], 'Breeder'), ['Breeder'])
  assert.deepEqual(normalizeUserFmsTypes(['Hatchery'], 'Broiler'), ['Hatchery'])
})

test('matches a module when any selected FMS type overlaps', () => {
  assert.equal(userFmsTypesOverlap(['Broiler', 'Hatchery'], ['Hatchery']), true)
  assert.equal(userFmsTypesOverlap(['Broiler'], ['Breeder']), false)
})

test('allows an Admin to manage only target scopes contained in its own scopes', () => {
  assert.equal(userFmsTypesAreSubset(['Broiler'], ['Broiler', 'Hatchery']), true)
  assert.equal(userFmsTypesAreSubset(['Broiler', 'Breeder'], ['Broiler', 'Hatchery']), false)
})
