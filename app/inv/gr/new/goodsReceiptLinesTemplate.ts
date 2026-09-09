import writeXlsxFile, { type Feature } from 'write-excel-file/browser'
import {
  getOrderOfSiblings,
  insertElementMarkupAccordingToOrderOfSiblings,
  sanitizeTextContent,
} from 'write-excel-file/utility'

type TemplateCell = {
  value: string
  align?: 'left' | 'center'
  alignVertical?: 'center'
  backgroundColor?: string
  borderColor?: string
  borderStyle?: 'thin'
  columnSpan?: number
  fontWeight?: 'bold'
  height?: number
  textColor?: string
  wrap?: boolean
}

const TEMPLATE_HEADERS = [
  'Item Code',
  'Alt Qty',
  'Alt UoM',
  'Warehouse',
  'Supplier Batch Number',
  'Manufacturing Date',
  'Expiry Date',
  'Batch Number',
]

const INSTRUCTIONS = [
  ['Item Code', 'Required', 'Enter an Item Code available for the selected Farm and FMS Type.'],
  ['Alt Qty', 'Required', 'Enter a number greater than zero.'],
  ['Alt UoM', 'Optional', 'Enter a valid alternate UoM for the item. When blank, the item default UoM is used.'],
  ['Warehouse', 'Optional', 'Enter a Warehouse code, name, or exact Code - Name under the selected Farm. When blank, Default WH is used.'],
  ['Supplier Batch Number', 'Conditional', 'Required only when the item batch rule requires a supplier batch number.'],
  ['Manufacturing Date', 'Conditional', 'Use YYYY-MM-DD. Required only when the item batch rule requires a manufacturing date.'],
  ['Expiry Date', 'Optional', 'Use YYYY-MM-DD to override when allowed. When blank, Goods Receipt calculates it from Manufacturing Date and the Item Master expiration-month setup.'],
  ['Batch Number', 'Optional', 'Leave blank to use the configured batch-number rule, or enter a number when manual batch entry is allowed.'],
]

type GoodsReceiptTemplateOptions = {
  itemCodes: string[]
  uomCodes: string[]
  warehouses: string[]
}

const uniqueSorted = (values: string[]) => Array.from(new Set(
  values.map(value => value.trim()).filter(Boolean),
)).sort((left, right) => left.localeCompare(right))

const listFormula = (column: string, values: string[]) =>
  `'Dropdown Lists'!$${column}$2:$${column}$${Math.max(2, values.length + 1)}`

const formulaElement = (name: 'formula1' | 'formula2', value: string) =>
  `<${name}>${sanitizeTextContent(value)}</${name}>`

const dataValidationFeature = (options: GoodsReceiptTemplateOptions): Feature<File | Blob | ArrayBuffer> => ({
  files: {
    transform: {
      'xl/worksheets/sheet{id}.xml': {
        transform: (xml, _sheetOptions, { sheetIndex }) => {
          if (sheetIndex !== 0) return xml

          const validations = [
            options.itemCodes.length > 0
              ? `<dataValidation type="list" allowBlank="0" showInputMessage="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid Item Code" error="Choose an Item Code from the dropdown list." promptTitle="Item Code" prompt="Choose an item available for the selected Farm and FMS Type." sqref="A2:A501">${formulaElement('formula1', listFormula('A', options.itemCodes))}</dataValidation>`
              : '',
            `<dataValidation type="decimal" operator="greaterThan" allowBlank="0" showInputMessage="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid Quantity" error="Alt Qty must be a number greater than zero." promptTitle="Alt Qty" prompt="Enter a number greater than zero." sqref="B2:B501">${formulaElement('formula1', '0')}</dataValidation>`,
            options.uomCodes.length > 0
              ? `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid UoM" error="Choose an Alt UoM from the dropdown list or leave it blank." promptTitle="Alt UoM" prompt="Choose a UoM. Import will verify that it is valid for the selected item." sqref="C2:C501">${formulaElement('formula1', listFormula('B', options.uomCodes))}</dataValidation>`
              : '',
            options.warehouses.length > 0
              ? `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid Warehouse" error="Choose a Warehouse from the dropdown list or leave it blank to use Default WH." promptTitle="Warehouse" prompt="Choose a Warehouse under the selected Farm." sqref="D2:D501">${formulaElement('formula1', listFormula('C', options.warehouses))}</dataValidation>`
              : '',
            `<dataValidation type="date" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid Date" error="Enter a valid date." promptTitle="Manufacturing Date" prompt="Enter a date only when required by the item batch rule." sqref="F2:F501">${formulaElement('formula1', '1')}${formulaElement('formula2', '2958465')}</dataValidation>`,
            `<dataValidation type="date" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid Date" error="Enter a valid date." promptTitle="Expiry Date" prompt="Enter a date only when required by the item batch rule." sqref="G2:G501">${formulaElement('formula1', '1')}${formulaElement('formula2', '2958465')}</dataValidation>`,
          ].filter(Boolean)

          const dataValidationsXml = `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`
          return insertElementMarkupAccordingToOrderOfSiblings(
            xml,
            dataValidationsXml,
            getOrderOfSiblings('xl/worksheets/sheet{id}.xml', 'worksheet') ?? [],
            'worksheet',
          )
        },
      },
    },
  },
})

const thinBorder = {
  borderColor: '#D6D3D1',
  borderStyle: 'thin' as const,
}

const headerCell = (value: string): TemplateCell => ({
  value,
  align: 'center',
  alignVertical: 'center',
  backgroundColor: '#1C1917',
  fontWeight: 'bold',
  textColor: '#FFFFFF',
  wrap: true,
  height: 32,
  ...thinBorder,
})

const instructionHeaderCell = (value: string): TemplateCell => ({
  value,
  backgroundColor: '#E7E5E4',
  fontWeight: 'bold',
  wrap: true,
  ...thinBorder,
})

export function getGoodsReceiptLinesTemplateSheets(rawOptions: GoodsReceiptTemplateOptions) {
  const options = {
    itemCodes: uniqueSorted(rawOptions.itemCodes),
    uomCodes: uniqueSorted(rawOptions.uomCodes),
    warehouses: uniqueSorted(rawOptions.warehouses),
  }
  const itemLinesData: TemplateCell[][] = [TEMPLATE_HEADERS.map(headerCell)]
  const instructionsData: TemplateCell[][] = [
    [
      {
        value: 'Goods Receipt Item Lines Import Template Instructions',
        backgroundColor: '#1C1917',
        columnSpan: 3,
        fontWeight: 'bold',
        textColor: '#FFFFFF',
        height: 30,
      },
    ],
    [
      {
        value: 'Select the Farm and Default WH in Goods Receipt before importing. Complete the Item Lines worksheet without changing its column names. Import validates the entire worksheet and appends valid rows to the current table only; it does not save or post the document. Group, Sub Group, Base UOM Group, Conversion UoM, and item description are resolved automatically from Item Master and UoM setup.',
        columnSpan: 3,
        wrap: true,
        height: 68,
      },
    ],
    ['Field', 'Requirement', 'Entry rules'].map(instructionHeaderCell),
    ...INSTRUCTIONS.map(row => row.map(value => ({
      value,
      alignVertical: 'center' as const,
      wrap: true,
      ...thinBorder,
    }))),
  ]

  const dropdownRows = Math.max(options.itemCodes.length, options.uomCodes.length, options.warehouses.length)
  const dropdownListsData: TemplateCell[][] = [
    ['Item Codes', 'Alt UoMs', 'Warehouses'].map(instructionHeaderCell),
    ...Array.from({ length: dropdownRows }, (_, index) => [
      options.itemCodes[index] ?? '',
      options.uomCodes[index] ?? '',
      options.warehouses[index] ?? '',
    ].map(value => ({ value, ...thinBorder }))),
  ]

  return {
    options,
    sheets: [
    {
      data: itemLinesData,
      sheet: 'Item Lines',
      columns: TEMPLATE_HEADERS.map((header, index) => ({
        width: index === 0 ? 20 : Math.max(14, Math.min(header.length + 4, 26)),
      })),
      stickyRowsCount: 1,
      showGridLines: false,
      orientation: 'landscape' as const,
      zoomScale: 0.9,
    },
    {
      data: instructionsData,
      sheet: 'Instructions',
      columns: [{ width: 26 }, { width: 14 }, { width: 88 }],
      stickyRowsCount: 3,
      showGridLines: false,
      zoomScale: 0.95,
    },
    {
      data: dropdownListsData,
      sheet: 'Dropdown Lists',
      columns: [{ width: 24 }, { width: 18 }, { width: 38 }],
      stickyRowsCount: 1,
      showGridLines: false,
      zoomScale: 0.9,
    },
  ],
  }
}

export async function exportGoodsReceiptLinesTemplate(rawOptions: GoodsReceiptTemplateOptions) {
  const { options, sheets } = getGoodsReceiptLinesTemplateSheets(rawOptions)
  await writeXlsxFile(sheets, {
    fontFamily: 'Arial',
    fontSize: 10,
    features: [dataValidationFeature(options)],
  }).toFile('goods-receipt-item-lines-import-template.xlsx')
}
