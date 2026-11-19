/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const listLayout = fs.readFileSync('app/brd/fc/Layout.tsx', 'utf8')
const growingLayout = fs.readFileSync('app/brd/fc/new/Layout.tsx', 'utf8')
const navigationTypes = fs.readFileSync('app/brd/fc/new/flockCardTypes.ts', 'utf8')
const placementQueries = fs.readFileSync('lib/data/queries/broilerDocPlacementDates.ts', 'utf8')

test('Growing navigation carries the exact placement and farm cycle', () => {
  assert.match(listLayout, /flockCardId: building\.flockCard\?\.id \?\? null/)
  assert.match(listLayout, /farmCycleId: building\.flockCard\?\.farmCycleId \?\? null/)
  assert.match(navigationTypes, /flockCardId\?: number \| string \| null/)
  assert.match(navigationTypes, /farmCycleId\?: number \| string \| null/)
})

test('Growing Total birds uses posted DOC placements for the exact flock card', () => {
  assert.match(growingLayout, /getPostedDocPlacementAnimalQuantities\(\[requestedPlacementId\]\)/)
  assert.match(placementQueries, /\.eq\('goods_receipt\.status', 'Posted'\)/)
  assert.match(placementQueries, /quantities\[flockCardId\].*\+ quantity/)
})

test('Growing mortality inventory is restricted to the exact cycle and flock card', () => {
  assert.match(growingLayout, /getBroilerCycleInventoryBatches\(farmId, requestedFarmCycleId\)/)
  assert.match(growingLayout, /Number\(batch\.flock_card_id\) === requestedPlacementId/)
  assert.match(growingLayout, /requestedFarmCycleId, requestedPlacementId, selectedBuilding, selectedFarmId/)
})
