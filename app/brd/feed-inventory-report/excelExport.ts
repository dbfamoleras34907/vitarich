import { exportReportWorkbook } from '@/lib/reports/exportWorkbook'
import {
  convertFeedInventoryQuantity,
  type FeedInventorySummary,
  type FeedInventoryUnit,
} from '@/lib/reports/feedInventoryReport'

export async function exportFeedInventoryReportExcel(
  summaries: FeedInventorySummary[],
  unit: FeedInventoryUnit,
) {
  const quantity = (value: number) => convertFeedInventoryQuantity(value, unit)
  const unitLabel = unit === 'BAGS' ? 'Bags' : 'kg'
  const summaryRows: (string | number)[][] = [[
    'Warehouse / Building', 'Warehouse Name', 'Feed Code', 'Feed Name',
    `Beginning (${unitLabel})`, `Receipts (${unitLabel})`, `Transfer In (${unitLabel})`,
    `Adjustment In (${unitLabel})`, `Consumption (${unitLabel})`, `Other Issues (${unitLabel})`,
    `Transfer Out (${unitLabel})`, `Adjustment Out (${unitLabel})`, `On Hand (${unitLabel})`,
  ]]
  const movementRows: (string | number)[][] = [[
    'Warehouse / Building', 'Feed Code', 'Feed Name', 'Date/Time', 'Document Type',
    'Document No.', 'Reference', 'Movement', `IN (${unitLabel})`, `OUT (${unitLabel})`,
    `Running On Hand (${unitLabel})`,
  ]]

  for (const row of summaries) {
    summaryRows.push([
      row.warehouseCode, row.warehouseName, row.itemCode, row.itemName,
      quantity(row.beginningBalance), quantity(row.receipts), quantity(row.transferIn),
      quantity(row.adjustmentsIn), quantity(row.consumption), quantity(row.otherIssues),
      quantity(row.transferOut), quantity(row.adjustmentsOut), quantity(row.onHand),
    ])
    row.movements.forEach(movement => movementRows.push([
      row.warehouseCode, row.itemCode, row.itemName, movement.createdAt, movement.sourceDocType,
      movement.documentNo, movement.reference, movement.category,
      quantity(movement.inQty), quantity(movement.outQty), quantity(movement.runningOnHand),
    ]))
  }

  await exportReportWorkbook([
    { name: 'Summary', rows: summaryRows },
    { name: 'Movements', rows: movementRows },
  ], `broiler-feed-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
