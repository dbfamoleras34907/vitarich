import writeXlsxFile, { type Feature } from 'write-excel-file/browser'
import {
  getOrderOfSiblings,
  insertElementMarkupAccordingToOrderOfSiblings,
  sanitizeTextContent,
} from 'write-excel-file/utility'

import { FARM_PROFILE_FIELDS } from '@/lib/farmProfileOptions'
import type { FarmRecord, FarmDirectoryImportRow } from '@/lib/data/repositories/farmManagement.client'

const HEADERS = [
  'Farm ID',
  'Farm Code',
  'Farm Name',
  'Farm Type',
  'Production Model',
  'Island Group',
  'Administrative Region',
  'Contact Person',
  'Contact Number',
  'Remarks',
] as const

const FARM_TYPES = [
  { value: 'BE', label: 'BE - Breeder Farm' },
  { value: 'HA', label: 'HA - Hatcher' },
  { value: 'BR', label: 'BR - Broiler' },
] as const

const farmTypeByEntry = new Map<string, FarmDirectoryImportRow['farm_type']>(
  FARM_TYPES.flatMap(option => [
    [option.value.toLowerCase(), option.value],
    [option.label.toLowerCase(), option.value],
  ]),
)

const dropdownLists = [
  FARM_TYPES.map(option => option.label),
  [...FARM_PROFILE_FIELDS[0].options],
  [...FARM_PROFILE_FIELDS[1].options],
  [...FARM_PROFILE_FIELDS[2].options],
]

const formulaElement = (name: 'formula1', value: string) =>
  `<${name}>${sanitizeTextContent(value)}</${name}>`

const listFormula = (column: string, values: string[]) =>
  `'Dropdown Lists'!$${column}$2:$${column}$${Math.max(2, values.length + 1)}`

const dataValidationFeature = (lastImportRow: number): Feature<File | Blob | ArrayBuffer> => ({
  files: {
    transform: {
      'xl/worksheets/sheet{id}.xml': {
        transform: (xml, _sheetOptions, { sheetIndex }) => {
          if (sheetIndex !== 0) return xml

          const validations = [
            `<dataValidation type="list" allowBlank="0" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid farm type" error="Choose a farm type from the dropdown list." sqref="D2:D${lastImportRow}">${formulaElement('formula1', listFormula('A', dropdownLists[0]))}</dataValidation>`,
            `<dataValidation type="list" allowBlank="0" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid production model" error="Choose a production model from the dropdown list." sqref="E2:E${lastImportRow}">${formulaElement('formula1', listFormula('B', dropdownLists[1]))}</dataValidation>`,
            `<dataValidation type="list" allowBlank="0" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid island group" error="Choose an island group from the dropdown list." sqref="F2:F${lastImportRow}">${formulaElement('formula1', listFormula('C', dropdownLists[2]))}</dataValidation>`,
            `<dataValidation type="list" allowBlank="0" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid administrative region" error="Choose a region from the dropdown list." sqref="G2:G${lastImportRow}">${formulaElement('formula1', listFormula('D', dropdownLists[3]))}</dataValidation>`,
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
})

const border = { borderColor: '#D6D3D1', borderStyle: 'thin' as const }
const headerCell = (value: string) => ({
  value,
  align: 'center' as const,
  alignVertical: 'center' as const,
  backgroundColor: '#166534',
  borderColor: border.borderColor,
  borderStyle: border.borderStyle,
  fontWeight: 'bold' as const,
  textColor: '#FFFFFF',
  wrap: true,
  height: 30,
})

const valueCell = (value: string | number) => ({
  value,
  alignVertical: 'center' as const,
  ...border,
})

const cellText = (value: unknown) => String(value ?? '').trim()

export async function exportFarmDirectoryWorkbook(farms: FarmRecord[]) {
  const farmRows = farms.map(farm => [
    valueCell(Number(farm.id)),
    valueCell(cellText(farm.code)),
    valueCell(cellText(farm.name)),
    valueCell(FARM_TYPES.find(option => option.value === farm.farm_type)?.label ?? cellText(farm.farm_type)),
    valueCell(cellText(farm.production_model)),
    valueCell(cellText(farm.island)),
    valueCell(cellText(farm.administrative_region)),
    valueCell(cellText(farm.contact_person)),
    valueCell(cellText(farm.contact_number)),
    valueCell(cellText(farm.remarks)),
  ])

  const listHeaders = ['Farm Types', 'Production Models', 'Island Groups', 'Administrative Regions']
  const listRowCount = Math.max(...dropdownLists.map(list => list.length))
  const lastImportRow = Math.max(501, farms.length + 100)

  await writeXlsxFile([
    {
      data: [
        HEADERS.map(headerCell),
        ...farmRows,
      ],
      sheet: 'Farms',
      columns: [
        { width: 12 }, { width: 18 }, { width: 30 }, { width: 24 },
        { width: 24 }, { width: 18 }, { width: 52 }, { width: 26 },
        { width: 22 }, { width: 38 },
      ],
      stickyRowsCount: 1,
      showGridLines: false,
      orientation: 'landscape',
      zoomScale: 0.85,
    },
    {
      data: [
        [
          { value: 'Farm Directory Import Instructions', columnSpan: 2, fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: '#166534', height: 30 },
        ],
        [
          { value: 'Edit farm rows and import this workbook to update existing farms. Keep the Farm ID column unchanged. New farms cannot be created by import.', columnSpan: 2, wrap: true, height: 48 },
        ],
        [
          { value: 'Scope', fontWeight: 'bold', ...border },
          { value: 'Only Farm Directory fields are updated. Warehouse records, warehouse associations, buildings, pens, and machines are not included.', wrap: true, ...border },
        ],
        [
          { value: 'Dropdown fields', fontWeight: 'bold', ...border },
          { value: 'Use the dropdowns for Farm Type, Production Model, Island Group, and Administrative Region.', wrap: true, ...border },
        ],
        [
          { value: 'Required fields', fontWeight: 'bold', ...border },
          { value: 'Farm Code, Farm Name, Farm Type, Production Model, Island Group, and Administrative Region must have valid values.', wrap: true, ...border },
        ],
        [
          { value: 'Import access', fontWeight: 'bold', ...border },
          { value: 'Only existing active farms with approved status can be updated. Each row is reported if its update fails.', wrap: true, ...border },
        ],
      ],
      sheet: 'Instructions',
      columns: [{ width: 24 }, { width: 110 }],
      stickyRowsCount: 2,
      showGridLines: false,
    },
    {
      data: [
        listHeaders.map(headerCell),
        ...Array.from({ length: listRowCount }, (_, index) =>
          dropdownLists.map(list => valueCell(list[index] ?? '')),
        ),
      ],
      sheet: 'Dropdown Lists',
      columns: [{ width: 26 }, { width: 28 }, { width: 22 }, { width: 58 }],
      stickyRowsCount: 1,
      showGridLines: false,
    },
  ], {
    fontFamily: 'Arial',
    fontSize: 10,
    features: [dataValidationFeature(lastImportRow)],
  }).toFile('farm-directory-import-export.xlsx')
}

const expectedHeaders = HEADERS.map(header => header.toLowerCase())

export function parseFarmDirectoryImport(data: unknown[][]): {
  rows: FarmDirectoryImportRow[]
  issues: string[]
} {
  if (data.length === 0) {
    return { rows: [], issues: ['The Farms worksheet is empty.'] }
  }

  const actualHeaders = (data[0] ?? []).map(cellText).map(header => header.toLowerCase())
  if (
    actualHeaders.length !== expectedHeaders.length ||
    actualHeaders.some((header, index) => header !== expectedHeaders[index])
  ) {
    return {
      rows: [],
      issues: [`The Farms worksheet headers must match the exported template: ${HEADERS.join(', ')}.`],
    }
  }

  const rows: FarmDirectoryImportRow[] = []
  const issues: string[] = []
  const seenIds = new Set<number>()
  const allowedModels = new Set<string>(FARM_PROFILE_FIELDS[0].options)
  const allowedIslands = new Set<string>(FARM_PROFILE_FIELDS[1].options)
  const allowedRegions = new Set<string>(FARM_PROFILE_FIELDS[2].options)

  data.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2
    if (cells.every(cell => cellText(cell) === '')) return

    const idValue = cellText(cells[0])
    const id = Number(idValue)
    if (!idValue || !Number.isInteger(id) || id <= 0) {
      issues.push(`Row ${rowNumber}: Farm ID must be a positive whole number.`)
      return
    }
    if (seenIds.has(id)) {
      issues.push(`Row ${rowNumber}: Farm ID ${id} appears more than once.`)
      return
    }
    seenIds.add(id)

    const code = cellText(cells[1])
    const name = cellText(cells[2])
    const farmTypeInput = cellText(cells[3])
    const farmType = farmTypeByEntry.get(farmTypeInput.toLowerCase())
    const productionModel = cellText(cells[4])
    const island = cellText(cells[5])
    const administrativeRegion = cellText(cells[6])
    const rowIssues: string[] = []

    if (!code) rowIssues.push('Farm Code is required.')
    if (!name) rowIssues.push('Farm Name is required.')
    if (!farmType) rowIssues.push('Farm Type must match a dropdown option.')
    if (!allowedModels.has(productionModel)) rowIssues.push('Production Model must match a dropdown option.')
    if (!allowedIslands.has(island)) rowIssues.push('Island Group must match a dropdown option.')
    if (!allowedRegions.has(administrativeRegion)) rowIssues.push('Administrative Region must match a dropdown option.')

    rowIssues.forEach(issue => issues.push(`Row ${rowNumber}: ${issue}`))
    if (rowIssues.length > 0 || !farmType) return

    rows.push({
      id,
      rowNumber,
      code,
      name,
      farm_type: farmType,
      production_model: productionModel,
      island,
      administrative_region: administrativeRegion,
      contact_person: cellText(cells[7]),
      contact_number: cellText(cells[8]),
      remarks: cellText(cells[9]),
    })
  })

  if (rows.length === 0 && issues.length === 0) {
    issues.push('The Farms worksheet contains no farm rows to import.')
  }

  return { rows: issues.length > 0 ? [] : rows, issues }
}
