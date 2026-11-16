/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const repository = fs.readFileSync('lib/data/repositories/broilerFlockCards.ts', 'utf8')
const layout = fs.readFileSync('app/brd/fc/Layout.tsx', 'utf8')

test('Growing list uses live building bird inventory', () => {
  assert.match(layout, /includePlacementInventory: true/)
  assert.match(repository, /getPlacementInventoryAnimalQtyByWarehouse/)
  assert.match(repository, /getGoodDocItemId\(farmId\)/)
  assert.match(repository, /\.eq\("item_code", itemCode\)/)
  assert.match(repository, /signedPostingQty\(posting\)/)
})

test('Good DOC inventory is scoped to the selected farm', () => {
  const goodDocLookup = repository.slice(
    repository.indexOf('async function getGoodDocItemId'),
    repository.indexOf('async function getPlacementInventoryAnimalQtyByWarehouse'),
  )

  assert.match(goodDocLookup, /\.from\("doc_rec_settings"\)/)
  assert.match(goodDocLookup, /\.eq\("farm_id", farmId\)/)
  assert.match(goodDocLookup, /\.eq\("void", "1"\)/)
})

test('building inventory is loaded once in paged batches', () => {
  assert.match(repository, /INVENTORY_POSTING_PAGE_SIZE = 1000/)
  assert.match(repository, /async function getPagedInventoryPostings/)
  assert.match(repository, /\.range\(from, from \+ INVENTORY_POSTING_PAGE_SIZE - 1\)/)

  const listLoader = repository.slice(
    repository.indexOf('export async function getFarmBuildingsForFlockCard'),
    repository.indexOf('async function getAssociatedWarehouseRows'),
  )
  assert.match(listLoader, /await getPlacementInventoryAnimalQtyByWarehouse/)
  assert.doesNotMatch(listLoader, /await getFarmOriginBatchesForFlockCard/)
})

test('Growing list preserves an authoritative zero bird balance', () => {
  assert.match(repository, /placementInventoryByWarehouse\.has\(code\.toUpperCase\(\)\)/)
  assert.doesNotMatch(repository, /placementAnimalQty > 0/)
})

test('Growing list totals positive balances by batch so closed legacy batches cannot offset the current flock', () => {
  const inventoryLoader = repository.slice(
    repository.indexOf('async function getPlacementInventoryAnimalQtyByWarehouse'),
    repository.indexOf('type GoodsReceiptOriginRow'),
  )

  assert.match(inventoryLoader, /posting\.batch_number \|\| posting\.ref/)
  assert.match(inventoryLoader, /quantityByWarehouseBatch/)
  assert.match(inventoryLoader, /\.filter\(quantity => quantity > 0\)/)
})

test('Edit/View uses the same paged inventory ledger loader as the Growing list', () => {
  const placementInventoryLoader = repository.slice(
    repository.indexOf('export async function getFarmOriginBatchesForFlockCard'),
    repository.indexOf('export async function getBuildingPlacementInventory'),
  )

  assert.match(placementInventoryLoader, /await getPagedInventoryPostings\(originWarehouseCodes/)
  assert.match(placementInventoryLoader, /itemCode: goodDocItemCode/)
  assert.doesNotMatch(placementInventoryLoader, /\.from\("inventory_postings"\)/)
})
