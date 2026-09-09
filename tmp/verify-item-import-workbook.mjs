import readXlsxFile, { readSheet } from 'read-excel-file/node'

const workbookPath = process.argv[2]
if (!workbookPath) throw new Error('Workbook path is required.')

const workbook = await readXlsxFile(workbookPath)
const sheetNames = workbook.map(sheet => sheet.sheet)
const items = await readSheet(workbookPath, 'Items')
const review = await readSheet(workbookPath, 'Review Required')
const source = await readSheet(workbookPath, 'Source Data')

const expectedHeaders = [
  'Item Name', 'Description', 'Barcode', 'UoM Group', 'Item Group',
  'Sub Group Level 1', 'Sub Group Level 2', 'Sub Group Level 3',
  'FMS Group', 'Inventory Item', 'Sales Item', 'Purchase Item', 'Delivery Item',
  'Manage Batch Numbers', 'Manage Serial Numbers', 'Batch Management Method',
  'Shelf Life Days', 'Expiration Months', 'Expiry Required',
  'Allow Negative Batch Stock', 'Batch Number Series', 'Min On Hand', 'Max On Hand',
]

const headersMatch = JSON.stringify(items[0]) === JSON.stringify(expectedHeaders)
const missingCounts = {
  uomGroup: items.slice(1).filter(row => !String(row[3] ?? '').trim()).length,
  itemGroup: items.slice(1).filter(row => !String(row[4] ?? '').trim()).length,
  fmsGroup: items.slice(1).filter(row => !String(row[8] ?? '').trim()).length,
}

if (!headersMatch) throw new Error('Items worksheet headers do not match the Item Master importer contract.')
if (items.length !== 1070 || source.length !== 1070 || review.length !== 32) {
  throw new Error(`Unexpected row counts: Items=${items.length}, Review=${review.length}, Source=${source.length}`)
}

console.log(JSON.stringify({
  sheetNames,
  headersMatch,
  itemDataRows: items.length - 1,
  reviewDataRows: review.length - 1,
  sourceDataRows: source.length - 1,
  firstItemName: items[1][0],
  lastItemName: items.at(-1)[0],
  missingCounts,
}))
