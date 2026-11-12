/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const repository = fs.readFileSync('lib/data/repositories/broilerFlockCards.ts', 'utf8')
const layout = fs.readFileSync('app/brd/fc/Layout.tsx', 'utf8')

test('Growing list uses live building bird inventory', () => {
  assert.match(layout, /includePlacementInventory: true/)
  assert.match(repository, /getPlacementInventoryAnimalQtyByWarehouse/)
  assert.match(repository, /\.eq\("item_code", itemCode\)/)
  assert.match(repository, /signedPostingQty\(posting\)/)
})

test('building inventory is loaded once in paged batches', () => {
  assert.match(repository, /INVENTORY_POSTING_PAGE_SIZE = 1000/)
  assert.match(repository, /\.range\(from, from \+ INVENTORY_POSTING_PAGE_SIZE - 1\)/)

  const listLoader = repository.slice(
    repository.indexOf('export async function getFarmBuildingsForFlockCard'),
    repository.indexOf('async function getAssociatedWarehouseRows'),
  )
  assert.match(listLoader, /await getPlacementInventoryAnimalQtyByWarehouse/)
  assert.doesNotMatch(listLoader, /await getFarmOriginBatchesForFlockCard/)
})
