import fs from 'node:fs/promises'
import path from 'node:path'
import writeXlsxFile from 'write-excel-file/node'
import {
  getOrderOfSiblings,
  insertElementMarkupAccordingToOrderOfSiblings,
  sanitizeTextContent,
} from 'write-excel-file/utility'

const sourcePath = process.argv[2]
const outputPath = process.argv[3]

if (!sourcePath || !outputPath) {
  throw new Error('Usage: node build-item-import-workbook.mjs <source.txt> <output.xlsx>')
}

const raw = await fs.readFile(sourcePath, 'utf8')
const token = '$items$'
const start = raw.indexOf(token)
const end = raw.indexOf(token, start + token.length)
if (start < 0 || end < 0) throw new Error('Dollar-quoted JSON payload was not found.')

const sourceRows = JSON.parse(raw.slice(start + token.length, end))
if (!Array.isArray(sourceRows)) throw new Error('The migration payload is not a JSON array.')

const IMPORT_HEADERS = [
  'Item Name', 'Description', 'Barcode', 'UoM Group', 'Item Group',
  'Sub Group Level 1', 'Sub Group Level 2', 'Sub Group Level 3',
  'FMS Group', 'Inventory Item', 'Sales Item', 'Purchase Item', 'Delivery Item',
  'Manage Batch Numbers', 'Manage Serial Numbers', 'Batch Management Method',
  'Shelf Life Days', 'Expiration Months', 'Expiry Required',
  'Allow Negative Batch Stock', 'Batch Number Series', 'Min On Hand', 'Max On Hand',
]

const SOURCE_HEADERS = sourceRows.length > 0 ? Object.keys(sourceRows[0]) : []
const missingFields = row => [
  !String(row.inventory_uom ?? '').trim() && 'UoM Group',
  !String(row.item_group ?? '').trim() && 'Item Group',
  !String(row.fms_group ?? '').trim() && 'FMS Group',
].filter(Boolean)

const titleCaseFms = value => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : ''
}
const yesNo = value => value === true || value === 1 ? 'Yes' : 'No'
const cellValue = value => value === null || value === undefined ? '' : value

const thinBorder = { borderColor: '#D6D3D1', borderStyle: 'thin' }
const headerCell = value => ({
  value,
  align: 'center',
  alignVertical: 'center',
  backgroundColor: '#1C1917',
  fontWeight: 'bold',
  textColor: '#FFFFFF',
  wrap: true,
  height: 34,
  ...thinBorder,
})
const sectionHeaderCell = value => ({
  value,
  backgroundColor: '#E7E5E4',
  fontWeight: 'bold',
  wrap: true,
  ...thinBorder,
})
const dataCell = (value, rowIndex, options = {}) => ({
  value: cellValue(value),
  alignVertical: 'center',
  backgroundColor: options.warning ? '#FEF2F2' : rowIndex % 2 === 0 ? '#FAFAF9' : '#FFFFFF',
  textColor: options.warning ? '#991B1B' : '#292524',
  wrap: Boolean(options.wrap),
  ...(options.format && value !== null && value !== undefined && value !== '' ? { format: options.format } : {}),
  ...thinBorder,
})

const itemsRows = sourceRows.map((row, index) => {
  const values = [
    row.item_name,
    row.description,
    row.barcode,
    row.inventory_uom,
    row.item_group,
    row.sub_item_group_level_1_code,
    row.sub_item_group_level_2_code,
    row.sub_item_group_level_3_code,
    titleCaseFms(row.fms_group),
    yesNo(row.is_inventory_item),
    yesNo(row.is_sales_item),
    yesNo(row.is_purchase_item),
    yesNo(row.is_delivery_item),
    yesNo(row.manage_batch_numbers),
    yesNo(row.manage_serial_numbers),
    String(row.batch_management_method ?? 'NONE').toUpperCase(),
    row.default_shelf_life_days,
    row.default_expiration_months,
    yesNo(row.default_expiry_required),
    yesNo(row.allow_negative_batch_stock),
    row.batch_number_series,
    row.min_on_hand,
    row.max_on_hand,
  ]
  const missing = new Set(missingFields(row))
  return values.map((value, columnIndex) => {
    const header = IMPORT_HEADERS[columnIndex]
    const numeric = ['Shelf Life Days', 'Expiration Months', 'Min On Hand', 'Max On Hand'].includes(header)
    return dataCell(value, index, {
      warning: missing.has(header),
      wrap: header === 'Item Name' || header === 'Description',
      format: numeric ? '#,##0.######' : undefined,
    })
  })
})

const reviewRows = sourceRows.flatMap((row, index) => {
  const missing = missingFields(row)
  if (missing.length === 0) return []
  return [[
    dataCell(index + 2, index),
    dataCell(row.item_code, index),
    dataCell(row.item_name, index, { wrap: true }),
    dataCell(missing.join(', '), index, { warning: true, wrap: true }),
    dataCell('Complete the highlighted cells in Items before importing.', index, { wrap: true }),
  ]]
})

const sourceDataRows = sourceRows.map((row, rowIndex) => SOURCE_HEADERS.map(header => {
  const value = row[header]
  const isDate = (header === 'created_at' || header === 'updated_at') && value
  return dataCell(isDate ? new Date(value) : value, rowIndex, {
    wrap: ['item_name', 'description'].includes(header),
    format: isDate ? 'yyyy-mm-dd hh:mm:ss' : typeof value === 'number' ? '#,##0.######' : undefined,
  })
}))

const formulaElement = (name, value) => `<${name}>${sanitizeTextContent(value)}</${name}>`
const validationFeature = {
  files: {
    transform: {
      'xl/worksheets/sheet{id}.xml': {
        transform: (xml, _sheetOptions, { sheetIndex }) => {
          if (sheetIndex !== 0 || sourceRows.length === 0) return xml
          const lastRow = sourceRows.length + 1
          const validations = [
            `<dataValidation type="list" allowBlank="0" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid FMS Group" error="Choose Broiler, Breeder, or Hatchery." sqref="I2:I${lastRow}">${formulaElement('formula1', "'Dropdown Lists'!$A$2:$A$4")}</dataValidation>`,
            `<dataValidation type="list" allowBlank="0" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid value" error="Choose Yes or No." sqref="J2:O${lastRow}">${formulaElement('formula1', "'Dropdown Lists'!$B$2:$B$3")}</dataValidation>`,
            `<dataValidation type="list" allowBlank="0" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid method" error="Choose NONE, MANUAL, or AUTO." sqref="P2:P${lastRow}">${formulaElement('formula1', "'Dropdown Lists'!$C$2:$C$4")}</dataValidation>`,
            `<dataValidation type="list" allowBlank="0" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid value" error="Choose Yes or No." sqref="S2:T${lastRow}">${formulaElement('formula1', "'Dropdown Lists'!$B$2:$B$3")}</dataValidation>`,
            `<dataValidation type="whole" operator="greaterThanOrEqual" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid number" error="Enter a whole number greater than or equal to 0." sqref="Q2:R${lastRow}">${formulaElement('formula1', '0')}</dataValidation>`,
            `<dataValidation type="decimal" operator="greaterThanOrEqual" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid quantity" error="Enter a number greater than or equal to 0." sqref="V2:W${lastRow}">${formulaElement('formula1', '0')}</dataValidation>`,
          ]
          const markup = `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`
          return insertElementMarkupAccordingToOrderOfSiblings(
            xml,
            markup,
            getOrderOfSiblings('xl/worksheets/sheet{id}.xml', 'worksheet') ?? [],
            'worksheet',
          )
        },
      },
    },
  },
}

const instructions = [
  [{ value: 'Item Master Import Workbook', backgroundColor: '#1C1917', columnSpan: 3, fontWeight: 'bold', textColor: '#FFFFFF', height: 32 }],
  [{ value: `${sourceRows.length.toLocaleString('en-US')} source items were converted. The Items worksheet uses the current /a_dean/items import column names. Item Code is intentionally not present there because the normal Item Master importer generates it; original codes and every source field are preserved in Source Data.`, columnSpan: 3, wrap: true, height: 68, ...thinBorder }],
  ['Section', 'Rows', 'Notes'].map(sectionHeaderCell),
  [
    dataCell('Items', 0),
    dataCell(sourceRows.length, 0),
    dataCell('Upload this worksheet through Item Master Import after resolving all Review Required entries.', 0, { wrap: true }),
  ],
  [
    dataCell('Review Required', 1),
    dataCell(reviewRows.length, 1),
    dataCell('Rows with missing UoM Group, Item Group, or FMS Group. Matching cells are shaded red on Items.', 1, { wrap: true }),
  ],
  [
    dataCell('Source Data', 2),
    dataCell(sourceRows.length, 2),
    dataCell('Complete, unchanged migration payload for audit and item-code reference.', 2, { wrap: true }),
  ],
  [
    dataCell('Important', 3),
    dataCell('', 3),
    dataCell('Do not guess missing classifications. Choose active values from the destination Item Master setup. Sub Group codes must also exist under the chosen Item Group.', 3, { warning: true, wrap: true }),
  ],
]

const sheets = [
  {
    data: [IMPORT_HEADERS.map(headerCell), ...itemsRows],
    sheet: 'Items',
    columns: IMPORT_HEADERS.map((header, index) => ({
      width: index <= 1 ? 30 : Math.max(14, Math.min(header.length + 4, 26)),
    })),
    stickyRowsCount: 1,
    showGridLines: false,
    orientation: 'landscape',
    zoomScale: 0.72,
  },
  {
    data: reviewRows.length > 0
      ? [['Items Row', 'Source Item Code', 'Item Name', 'Missing Required Fields', 'Action'].map(headerCell), ...reviewRows]
      : [['Status'].map(headerCell), [dataCell('No missing required classifications were found.', 0)]],
    sheet: 'Review Required',
    columns: [{ width: 14 }, { width: 20 }, { width: 34 }, { width: 42 }, { width: 58 }],
    stickyRowsCount: 1,
    showGridLines: false,
    zoomScale: 0.9,
  },
  {
    data: instructions,
    sheet: 'Instructions',
    columns: [{ width: 24 }, { width: 14 }, { width: 92 }],
    stickyRowsCount: 3,
    showGridLines: false,
    zoomScale: 0.95,
  },
  {
    data: [SOURCE_HEADERS.map(headerCell), ...sourceDataRows],
    sheet: 'Source Data',
    columns: SOURCE_HEADERS.map(header => ({ width: ['item_name', 'description'].includes(header) ? 34 : Math.max(14, Math.min(header.length + 4, 26)) })),
    stickyRowsCount: 1,
    showGridLines: false,
    orientation: 'landscape',
    zoomScale: 0.68,
  },
  {
    data: [
      ['FMS Groups', 'Yes / No', 'Batch Methods'].map(sectionHeaderCell),
      ['Broiler', 'Yes', 'NONE'].map((value, i) => dataCell(value, i)),
      ['Breeder', 'No', 'MANUAL'].map((value, i) => dataCell(value, i)),
      ['Hatchery', '', 'AUTO'].map((value, i) => dataCell(value, i)),
    ],
    sheet: 'Dropdown Lists',
    columns: [{ width: 18 }, { width: 14 }, { width: 18 }],
    stickyRowsCount: 1,
    showGridLines: false,
  },
]

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await writeXlsxFile(sheets, {
  fontFamily: 'Arial',
  fontSize: 10,
  features: [validationFeature],
}).toFile(outputPath)

console.log(JSON.stringify({
  outputPath,
  sourceRows: sourceRows.length,
  reviewRows: reviewRows.length,
  blankFmsGroup: sourceRows.filter(row => !String(row.fms_group ?? '').trim()).length,
  blankItemGroup: sourceRows.filter(row => !String(row.item_group ?? '').trim()).length,
  blankUomGroup: sourceRows.filter(row => !String(row.inventory_uom ?? '').trim()).length,
}))
