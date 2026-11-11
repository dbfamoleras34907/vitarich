import assert from 'node:assert/strict'
import test from 'node:test'

import type { WarehouseReportRow } from '../../lib/data/repositories/warehouseReport'
import {
  buildFeedInventorySummaries,
  convertFeedInventoryQuantity,
  getFeedInventoryMovementCategory,
} from '../../lib/reports/feedInventoryReport'

function movement(
  id: number,
  createdAt: string,
  sourceDocType: string,
  transferType: 'IN' | 'OUT',
  quantity: number,
): WarehouseReportRow {
  return {
    id,
    createdAt,
    sourceDocType,
    sourceDocEntry: id,
    documentNo: `${sourceDocType}-${id}`,
    documentUrl: '',
    reference: '',
    itemCode: 'FEED-001',
    itemName: 'Starter Feed',
    warehouseCode: 'WH-001',
    warehouseName: 'Feed Warehouse',
    batchNumber: '',
    transferType,
    inQty: transferType === 'IN' ? quantity : 0,
    outQty: transferType === 'OUT' ? quantity : 0,
    beginningBalance: 0,
    runningBalance: 0,
  }
}

test('summarizes opening, receipts, transfers, consumption, issues, and on hand', () => {
  const summaries = buildFeedInventorySummaries([
    movement(1, '2026-10-31T08:00:00+08:00', 'GOODS_RECEIPT', 'IN', 1_000),
    movement(2, '2026-11-01T08:00:00+08:00', 'GOODS_RECEIPT', 'IN', 500),
    movement(3, '2026-11-02T08:00:00+08:00', 'INVENTORY_TRANSFER', 'IN', 100),
    movement(4, '2026-11-03T08:00:00+08:00', 'BRD_FC_FEED_USAGE', 'OUT', 250),
    movement(5, '2026-11-04T08:00:00+08:00', 'BRD_FC_FEED_REVERSAL', 'IN', 50),
    movement(6, '2026-11-05T08:00:00+08:00', 'GOODS_ISSUE', 'OUT', 20),
    movement(7, '2026-11-06T08:00:00+08:00', 'INVENTORY_TRANSFER', 'OUT', 30),
  ], '2026-11-01')

  assert.equal(summaries.length, 1)
  assert.deepEqual({
    beginning: summaries[0].beginningBalance,
    receipts: summaries[0].receipts,
    transferIn: summaries[0].transferIn,
    consumption: summaries[0].consumption,
    otherIssues: summaries[0].otherIssues,
    transferOut: summaries[0].transferOut,
    onHand: summaries[0].onHand,
  }, {
    beginning: 1_000,
    receipts: 500,
    transferIn: 100,
    consumption: 200,
    otherIssues: 20,
    transferOut: 30,
    onHand: 1_350,
  })
  assert.equal(summaries[0].movements.at(-1)?.runningOnHand, 1_350)
})

test('classifies feed reversal as consumption and converts kilograms to bags', () => {
  const reversal = movement(1, '2026-11-01T08:00:00+08:00', 'BRD_FC_FEED_REVERSAL', 'IN', 50)
  assert.equal(getFeedInventoryMovementCategory(reversal), 'Consumption')
  assert.equal(convertFeedInventoryQuantity(125, 'BAGS'), 2.5)
  assert.equal(convertFeedInventoryQuantity(125, 'KG'), 125)
})
