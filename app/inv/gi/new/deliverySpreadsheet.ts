import type { GoodsIssueLine, GoodsIssueOnHandBatch } from '../api'
import type { Items, WarehouseData } from '@/lib/types'
import { parseExcelClipboard } from '@/lib/utils/parseExcelClipboard'

export const DELIVERY_COLUMNS = [
  ['#', null],
  ['Delivered Date', 'deliveredDate'],
  ['Building', 'fromWarehouseCode'],
  ['Flock Card', null],
  ['Cycle Count', null],
  ['Age', null],
  ['ALW g', null],
  ['Item', 'itemCode'],
  ['Harvest Quantity', 'requestedAltQty'],
  ['Net Live Weight', 'netLiveWeight'],
  ['ALW', null],
  ['Batch', 'batchNumber'],
  ['UOM', 'altUom'],
  ['TS/DR #', 'tsDrNo'],
  ['Remaining On Hand', null],
  ['Hauler Name', 'haulerName'],
  ['Plate Number', 'plateNumber'],
  ['Destination', 'destination'],
  ['Destination Details', 'liveSalesCustomerName'],
  ['Truck Seal', 'truckSeal'],
] as const

export function calculateHarvestAlw(netLiveWeight: number | null | undefined, harvestQuantity: number): number | null {
  if (netLiveWeight == null || !Number.isFinite(netLiveWeight) || netLiveWeight < 0 || !Number.isFinite(harvestQuantity) || harvestQuantity <= 0) return null
  return netLiveWeight / harvestQuantity
}

export type DeliveryPasteKey = Exclude<typeof DELIVERY_COLUMNS[number][1], null>
export type DeliveryPasteRow = Partial<Record<DeliveryPasteKey, string>>

export function parseDeliveryPaste(text: string, startColumn: number): DeliveryPasteRow[] {
  const data = parseExcelClipboard(text)
  if (!data.length) throw new Error('Paste at least one delivery row.')
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s*\*$/, '')
  const headerIndexes = data[0].map(value => DELIVERY_COLUMNS.findIndex(([label]) => normalize(label) === normalize(value)))
  // One-column ranges may also include their column header.
  const hasHeaders = headerIndexes.every(index => index >= 0)
  const indexes = hasHeaders ? headerIndexes : data[0].map((_, index) => startColumn + index)
  if (indexes.some(index => index >= DELIVERY_COLUMNS.length) || data.some(row => row.length > indexes.length)) {
    throw new Error('The pasted range extends past the last table column. Include the exported headers to map columns by name.')
  }
  if (hasHeaders && new Set(indexes).size !== indexes.length) throw new Error('The pasted headers contain duplicate columns.')
  const rows = (hasHeaders ? data.slice(1) : data).map(cells => {
    const row: DeliveryPasteRow = {}
    cells.forEach((value, index) => {
      const key = DELIVERY_COLUMNS[indexes[index]]?.[1]
      if (key) row[key] = value.trim()
    })
    return row
  })
  if (!rows.length || rows.every(row => !Object.keys(row).length)) throw new Error('The pasted range has no editable delivery cells.')
  return rows
}

export function deliveryDateValue(value: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  const normalized = match ? `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` : value
  const date = new Date(`${normalized}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error('Delivered Date must be a valid YYYY-MM-DD or M/D/YYYY date.')
  }
  return normalized
}

export function deliveryNumberValue(value: string, label: string, positive = false): number {
  const normalized = value.replace(/,/g, '')
  const number = Number(normalized)
  if (!normalized || !Number.isFinite(number) || (positive && number <= 0)) {
    throw new Error(`${label} must be ${positive ? 'a positive' : 'a valid'} number.`)
  }
  return number
}

// Prepare the entire range before React state changes. Existing allocation groups
// are the visible rows; a paste can grow them without dropping untouched groups.
export async function prepareDeliveryPaste({ lines, rows, startRow, newLine, getAllocationGroupKey, warehouses, items, getPlacementBatches, getDefaultAltUom, getGroupUoms, calculateBaseQty, getBatchRuleId }: {
  lines: GoodsIssueLine[]
  rows: DeliveryPasteRow[]
  startRow: number
  newLine: () => GoodsIssueLine
  getAllocationGroupKey: (line: GoodsIssueLine) => string
  warehouses: WarehouseData[]
  items: Items[]
  getPlacementBatches: (warehouse: WarehouseData) => Promise<GoodsIssueOnHandBatch[]>
  getDefaultAltUom: (group: string) => string
  getGroupUoms: (group: string) => { uomCode: string }[]
  calculateBaseQty: (qty: number, uom: string, group: string) => number
  getBatchRuleId: (line: GoodsIssueLine) => number | null
}): Promise<GoodsIssueLine[]> {
  const groups = new Map<string, GoodsIssueLine[]>()
  lines.forEach(line => groups.set(getAllocationGroupKey(line), [...(groups.get(getAllocationGroupKey(line)) ?? []), line]))
  const visibleRows = Array.from(groups.values())
  const normalize = (value: string) => value.trim().toUpperCase()
  for (const [offset, values] of rows.entries()) {
    const rowIndex = startRow + offset
    try {
      while (visibleRows.length <= rowIndex) visibleRows.push([newLine()])
      const originals = visibleRows[rowIndex]
      const original = originals[0]
      const line = { ...original }
      if (values.requestedAltQty !== undefined) {
        line.requestedAltQty = deliveryNumberValue(values.requestedAltQty, 'Harvest Quantity', true)
        line.altQty = line.requestedAltQty
        line.baseQty = calculateBaseQty(line.altQty, line.altUom, line.baseUom)
      }
      if (values.netLiveWeight !== undefined) {
        line.netLiveWeight = values.netLiveWeight ? deliveryNumberValue(values.netLiveWeight, 'Net Live Weight') : null
        if (line.netLiveWeight != null && line.netLiveWeight < 0) throw new Error('Net Live Weight cannot be negative.')
      }
      if (values.deliveredDate !== undefined) line.deliveredDate = deliveryDateValue(values.deliveredDate)
      for (const key of ['tsDrNo', 'haulerName', 'plateNumber', 'liveSalesCustomerName'] as const) {
        if (values[key] !== undefined) line[key] = values[key]
      }
      if (values.destination !== undefined) {
        const destination = ['Dressing Plant', 'Live Sales'].find(value => normalize(value) === normalize(values.destination!))
        if (values.destination && !destination) throw new Error('Destination must be Dressing Plant or Live Sales.')
        line.destination = destination ?? ''
      }
      if (values.truckSeal !== undefined) line.truckSeal = values.truckSeal ? deliveryNumberValue(values.truckSeal, 'Truck Seal') : null
      const inventoryKeys = ['fromWarehouseCode', 'itemCode', 'requestedAltQty', 'altUom', 'batchNumber'] as const
      if (!inventoryKeys.some(key => values[key] !== undefined)) {
        visibleRows[rowIndex] = originals.map(entry => ({ ...entry, netLiveWeight: line.netLiveWeight, deliveredDate: line.deliveredDate, tsDrNo: line.tsDrNo, haulerName: line.haulerName, plateNumber: line.plateNumber, destination: line.destination, liveSalesCustomerName: line.liveSalesCustomerName, truckSeal: line.truckSeal }))
        continue
      }
      const buildingValue = normalize(values.fromWarehouseCode ?? line.fromWarehouseCode)
      if (!buildingValue && !values.itemCode && !line.itemCode) {
        visibleRows[rowIndex] = [line]
        continue
      }
      const matches = warehouses.filter(warehouse => [warehouse.whse_code, warehouse.whse_name, `${warehouse.whse_code} - ${warehouse.whse_name}`].some(value => normalize(value ?? '') === buildingValue))
      if (matches.length !== 1) throw new Error('Building must match one eligible building in the selected farm.')
      const warehouse = matches[0]
      Object.assign(line, { fromWarehouseId: warehouse.id, fromWarehouseCode: warehouse.whse_code ?? '', fromWarehouseName: warehouse.whse_name ?? '' })
      const placement = await getPlacementBatches(warehouse)
      const allowedItems = items.filter(item => placement.some(batch => normalize(batch.itemCode) === normalize(item.item_code ?? '')))
      const buildingChanged = line.fromWarehouseCode !== original.fromWarehouseCode
      const itemValue = normalize(values.itemCode ?? (buildingChanged && !allowedItems.some(item => item.id === original.itemId) ? '' : line.itemCode))
      const matchingItems = itemValue ? allowedItems.filter(item => [item.item_code, item.item_name, `${item.item_code} - ${item.item_name}`].some(value => normalize(value ?? '') === itemValue)) : allowedItems
      if (!itemValue && matchingItems.length !== 1 && !values.batchNumber && !values.altUom) {
        visibleRows[rowIndex] = [{ ...line, itemId: null, itemCode: '', description: '', baseUom: '', altUom: '', baseQty: 0, batchRuleId: null, batchNumber: '', manufacturingDate: '', expiryDate: '', onHandQty: 0 }]
        continue
      }
      if (matchingItems.length !== 1) throw new Error('Item must match one placement item for this building.')
      const item = matchingItems[0]
      line.itemId = item.id
      line.itemCode = item.item_code ?? ''
      line.description = item.item_name || item.description || ''
      line.baseUom = item.inventory_uom || item.unit_measure || ''
      const uom = values.altUom ?? (item.id === original.itemId ? line.altUom : getDefaultAltUom(line.baseUom))
      line.altUom = getGroupUoms(line.baseUom).find(option => normalize(option.uomCode) === normalize(uom))?.uomCode ?? ''
      if (!line.altUom) throw new Error('UOM must match a unit available for this item.')
      line.requestedAltQty = values.requestedAltQty !== undefined
        ? deliveryNumberValue(values.requestedAltQty, 'Harvest Quantity', true)
        : original.requestedAltQty ?? originals.reduce((sum, entry) => sum + entry.altQty, 0)
      line.altQty = line.requestedAltQty
      line.baseQty = calculateBaseQty(line.altQty, line.altUom, line.baseUom)
      line.batchRuleId = getBatchRuleId(line)
      line.batchNumber = ''
      line.manufacturingDate = ''
      line.expiryDate = ''
      line.onHandQty = 0
      const batchText = values.batchNumber
      if (batchText) {
        const options = placement.filter(batch => normalize(batch.itemCode) === normalize(line.itemCode))
        const exactBatch = options.find(batch => batch.batchNumber === batchText)
        const selections = exactBatch ? [{ batch: exactBatch, qty: line.altQty }] : batchText.split(/;\s*|\),\s*/).map(part => {
          const match = /^(.*?)\s*\(([\d,.]+)\)?$/.exec(part.trim())
          const batch = options.find(candidate => candidate.batchNumber === (match?.[1].trim() ?? part.trim()))
          if (!batch) throw new Error(`Batch "${part}" is not an available placement batch.`)
          return { batch, qty: match ? deliveryNumberValue(match[2], 'Batch quantity', true) : line.altQty }
        })
        if (new Set(selections.map(selection => selection.batch.batchNumber)).size !== selections.length) throw new Error('A batch is repeated in this row.')
        if (Math.abs(selections.reduce((sum, selection) => sum + selection.qty, 0) - line.altQty) > 0.000001) throw new Error('Batch quantities must equal Harvest Quantity.')
        visibleRows[rowIndex] = selections.map(({ batch, qty }, index) => {
          const baseQty = calculateBaseQty(qty, line.altUom, line.baseUom)
          if (baseQty > batch.onHandQty) throw new Error(`Batch ${batch.batchNumber} has insufficient on-hand quantity.`)
          return { ...line, id: index === 0 ? line.id : crypto.randomUUID(), batchNumber: batch.batchNumber, manufacturingDate: batch.manufacturingDate, expiryDate: batch.expiryDate, altQty: qty, baseQty, onHandQty: batch.onHandQty }
        })
      } else {
        const unchangedInventory = line.fromWarehouseCode === original.fromWarehouseCode && line.itemCode === original.itemCode && line.altUom === original.altUom && line.requestedAltQty === (original.requestedAltQty ?? originals.reduce((sum, entry) => sum + entry.altQty, 0))
        visibleRows[rowIndex] = batchText === undefined && unchangedInventory
          ? originals.map(entry => ({ ...line, id: entry.id, batchNumber: entry.batchNumber, manufacturingDate: entry.manufacturingDate, expiryDate: entry.expiryDate, altQty: entry.altQty, baseQty: entry.baseQty, onHandQty: entry.onHandQty }))
          : [line]
      }
    } catch (error) {
      throw new Error(`Row ${rowIndex + 1}: ${error instanceof Error ? error.message : 'Unable to validate pasted data.'}`)
    }
  }
  return visibleRows.flat()
}
