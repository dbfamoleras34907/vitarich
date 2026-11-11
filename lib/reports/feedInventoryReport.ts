import type { WarehouseReportRow } from '@/lib/data/repositories/warehouseReport'

export const FEED_INVENTORY_KG_PER_BAG = 50

export type FeedInventoryUnit = 'BAGS' | 'KG'

export type FeedInventoryMovementCategory =
  | 'Receipt'
  | 'Transfer In'
  | 'Adjustment In'
  | 'Consumption'
  | 'Other Issue'
  | 'Transfer Out'
  | 'Adjustment Out'

export type FeedInventoryMovement = WarehouseReportRow & {
  category: FeedInventoryMovementCategory
  runningOnHand: number
}

export type FeedInventorySummary = {
  id: string
  warehouseCode: string
  warehouseName: string
  itemCode: string
  itemName: string
  beginningBalance: number
  receipts: number
  transferIn: number
  adjustmentsIn: number
  consumption: number
  otherIssues: number
  transferOut: number
  adjustmentsOut: number
  onHand: number
  movements: FeedInventoryMovement[]
}

type FeedInventoryAccumulator = Omit<FeedInventorySummary, 'movements'> & {
  periodRows: WarehouseReportRow[]
}

const normalizedSourceType = (row: WarehouseReportRow) => row.sourceDocType.trim().toUpperCase()

const signedQuantity = (row: WarehouseReportRow) => Number(row.inQty || 0) - Number(row.outQty || 0)

export function getFeedInventoryMovementCategory(row: WarehouseReportRow): FeedInventoryMovementCategory {
  const sourceType = normalizedSourceType(row)

  if (sourceType === 'BRD_FC_FEED_USAGE' || sourceType === 'BRD_FC_FEED_REVERSAL') {
    return 'Consumption'
  }
  if (sourceType === 'GOODS_RECEIPT') return 'Receipt'
  if (sourceType === 'INVENTORY_TRANSFER') return row.outQty > 0 ? 'Transfer Out' : 'Transfer In'
  if (sourceType.includes('ADJUST')) return row.outQty > 0 ? 'Adjustment Out' : 'Adjustment In'
  return row.outQty > 0 ? 'Other Issue' : 'Adjustment In'
}

function addPeriodMovement(summary: FeedInventoryAccumulator, row: WarehouseReportRow) {
  const incoming = Number(row.inQty || 0)
  const outgoing = Number(row.outQty || 0)

  switch (getFeedInventoryMovementCategory(row)) {
    case 'Receipt':
      summary.receipts += incoming - outgoing
      break
    case 'Transfer In':
      summary.transferIn += incoming
      break
    case 'Transfer Out':
      summary.transferOut += outgoing
      break
    case 'Adjustment In':
      summary.adjustmentsIn += incoming
      break
    case 'Adjustment Out':
      summary.adjustmentsOut += outgoing
      break
    case 'Consumption':
      summary.consumption += outgoing - incoming
      break
    case 'Other Issue':
      summary.otherIssues += outgoing
      break
  }
}

export function buildFeedInventorySummaries(
  rows: WarehouseReportRow[],
  from: string,
): FeedInventorySummary[] {
  const fromTimestamp = new Date(`${from}T00:00:00`).getTime()
  const summaries = new Map<string, FeedInventoryAccumulator>()

  for (const row of rows) {
    const key = [row.warehouseCode.trim().toUpperCase(), row.itemCode.trim().toUpperCase()].join('|')
    const summary = summaries.get(key) ?? {
      id: key,
      warehouseCode: row.warehouseCode,
      warehouseName: row.warehouseName,
      itemCode: row.itemCode,
      itemName: row.itemName,
      beginningBalance: 0,
      receipts: 0,
      transferIn: 0,
      adjustmentsIn: 0,
      consumption: 0,
      otherIssues: 0,
      transferOut: 0,
      adjustmentsOut: 0,
      onHand: 0,
      periodRows: [],
    }

    const timestamp = new Date(row.createdAt).getTime()
    if (timestamp < fromTimestamp) {
      summary.beginningBalance += signedQuantity(row)
    } else {
      addPeriodMovement(summary, row)
      summary.periodRows.push(row)
    }
    summary.onHand += signedQuantity(row)
    summaries.set(key, summary)
  }

  return Array.from(summaries.values())
    .filter(summary => summary.periodRows.length > 0 || summary.beginningBalance !== 0 || summary.onHand !== 0)
    .map(({ periodRows, ...summary }) => {
      let runningOnHand = summary.beginningBalance
      const movements = [...periodRows]
        .sort((left, right) => left.id - right.id)
        .map(row => {
          runningOnHand += signedQuantity(row)
          return {
            ...row,
            category: getFeedInventoryMovementCategory(row),
            runningOnHand,
          }
        })

      return { ...summary, movements }
    })
    .sort((left, right) =>
      left.warehouseCode.localeCompare(right.warehouseCode)
      || left.itemCode.localeCompare(right.itemCode),
    )
}

export function convertFeedInventoryQuantity(quantityKg: number, unit: FeedInventoryUnit) {
  return unit === 'BAGS' ? quantityKg / FEED_INVENTORY_KG_PER_BAG : quantityKg
}
