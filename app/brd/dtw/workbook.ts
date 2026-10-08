import writeXlsxFile, { type Feature } from 'write-excel-file/browser'
import {
  getOrderOfSiblings,
  insertElementMarkupAccordingToOrderOfSiblings,
  sanitizeTextContent,
} from 'write-excel-file/utility'

import type {
  BroilerDtwMode,
  BroilerDtwReferences,
  BroilerDtwRow,
  BroilerDtwValidation,
} from './types'

export const DTW_SHEETS = {
  placement: 'DOC Placement',
  growing: 'Growing',
  harvest: 'Harvest Delivery',
  cleanup: 'Clean Up',
} as const

type SheetKey = keyof typeof DTW_SHEETS
type CellValue = unknown
export type DtwFieldBehavior = 'required' | 'optional' | 'automatic'

const COMMON_HEADERS = ['Import Cycle Key', 'Farm', 'Building', 'Existing Legacy Cycle', 'Placement Date'] as const
const HEADERS: Record<SheetKey, readonly string[]> = {
  placement: [...COMMON_HEADERS, 'Document No.', 'Item Code', 'Item Name', 'Quantity Received', 'Actual Received', 'Batch No.', 'Average DOC Weight', 'DOA Count', 'Reject Count', 'Remarks'],
  growing: [...COMMON_HEADERS, 'Entry Date', 'Age', 'Mortality AM', 'Mortality PM', 'Mortality Total', 'Thinning AM', 'Thinning PM', 'Row Total', 'Cumulative Total', 'Feed kg', 'Feed / Bird', 'Feed Item Code', 'Feed Batch No.', 'Body Weight g', 'Water L', 'Water / Bird', 'Temperature Min', 'Temperature Max', 'Humidity Min', 'Humidity Max', 'NH3 Max', 'Remarks'],
  harvest: [...COMMON_HEADERS, 'Document No.', 'Delivery Date', 'Harvest Age', 'Item Code', 'Item Name', 'Batch No.', 'Harvest Quantity', 'Net Live Weight', 'ALW g', 'Destination', 'Hauler Name', 'Plate Number', 'Truck Seal', 'Customer', 'Remarks'],
  cleanup: [...COMMON_HEADERS, 'Document No.', 'Clean Up Date', 'Item Code', 'Item Name', 'Batch No.', 'Quantity', 'Remarks'],
}
export const DTW_HEADERS = HEADERS

export const DTW_FIELD_BEHAVIORS: Record<SheetKey, readonly DtwFieldBehavior[]> = {
  placement: ['optional', 'required', 'required', 'optional', 'required', 'automatic', 'automatic', 'automatic', 'required', 'required', 'automatic', 'optional', 'optional', 'optional', 'optional'],
  growing: ['optional', 'required', 'required', 'optional', 'required', 'required', 'required', 'required', 'optional', 'automatic', 'optional', 'optional', 'automatic', 'automatic', 'optional', 'automatic', 'automatic', 'automatic', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional'],
  harvest: ['optional', 'required', 'required', 'optional', 'required', 'automatic', 'required', 'required', 'automatic', 'automatic', 'automatic', 'required', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional'],
  cleanup: ['optional', 'required', 'required', 'optional', 'required', 'automatic', 'required', 'automatic', 'automatic', 'automatic', 'automatic', 'optional'],
}

const FIELD_KEYS: Record<SheetKey, readonly string[]> = {
  placement: ['importCycleKey', 'farmCode', 'buildingCode', 'existingCycleKey', 'placementDate', 'documentNo', 'itemCode', 'itemName', 'quantityReceived', 'actualReceived', 'batchNumber', 'averageDocWeight', 'doaCount', 'rejectCount', 'remarks'],
  growing: ['importCycleKey', 'farmCode', 'buildingCode', 'existingCycleKey', 'placementDate', 'entryDate', 'age', 'mortalityAm', 'mortalityPm', 'mortalityTotal', 'thinningAm', 'thinningPm', 'rowTotal', 'cumulativeTotal', 'feedKg', 'feedPerBird', 'feedItemCode', 'feedBatchNumber', 'bodyWeight', 'waterLiters', 'waterPerBird', 'tempMin', 'tempMax', 'humidityMin', 'humidityMax', 'nh3Max', 'remarks'],
  harvest: ['importCycleKey', 'farmCode', 'buildingCode', 'existingCycleKey', 'placementDate', 'documentNo', 'deliveryDate', 'harvestAge', 'itemCode', 'itemName', 'batchNumber', 'quantity', 'netLiveWeight', 'averageLiveWeight', 'destination', 'haulerName', 'plateNumber', 'truckSeal', 'customer', 'remarks'],
  cleanup: ['importCycleKey', 'farmCode', 'buildingCode', 'existingCycleKey', 'placementDate', 'documentNo', 'cleanupDate', 'itemCode', 'itemName', 'batchNumber', 'quantity', 'remarks'],
}

const NUMERIC_FIELDS = new Set([
  'quantityReceived', 'actualReceived', 'averageDocWeight', 'doaCount', 'rejectCount',
  'age', 'mortalityAm', 'mortalityPm', 'mortalityTotal', 'thinningAm', 'thinningPm', 'rowTotal',
  'cumulativeTotal', 'feedKg', 'feedPerBird', 'bodyWeight', 'waterLiters', 'waterPerBird',
  'tempMin', 'tempMax', 'humidityMin', 'humidityMax', 'nh3Max', 'harvestAge',
  'quantity', 'netLiveWeight', 'averageLiveWeight', 'truckSeal',
])
const DATE_FIELDS = new Set(['placementDate', 'entryDate', 'deliveryDate', 'cleanupDate'])

const normalizeText = (value: CellValue) => String(value ?? '').trim()
const extractCode = (value: CellValue) => normalizeText(value).split(' - ')[0].trim()
const excelDate = (value: CellValue) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10)
  const text = normalizeText(value)
  if (!text) return null
  const parsed = new Date(text)
  return Number.isNaN(parsed.valueOf()) ? text : parsed.toISOString().slice(0, 10)
}

const asNumber = (value: CellValue) => {
  if (value == null || normalizeText(value) === '') return null
  const parsed = typeof value === 'number' ? value : Number(normalizeText(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const rowHasData = (row: CellValue[]) => row.some(value => normalizeText(value) !== '')
const closeEnough = (left: number, right: number) => Math.abs(left - right) <= 0.0005

function normalizeRow(sheet: SheetKey, row: CellValue[]): BroilerDtwRow {
  return Object.fromEntries(FIELD_KEYS[sheet].map((key, index) => {
    if (DTW_FIELD_BEHAVIORS[sheet][index] === 'automatic') return [key, null]
    const value = row[index]
    if (key === 'farmCode' || key === 'buildingCode') return [key, extractCode(value)]
    if (DATE_FIELDS.has(key)) return [key, excelDate(value)]
    if (NUMERIC_FIELDS.has(key)) return [key, asNumber(value)]
    return [key, normalizeText(value) || null]
  }))
}

function validateHeaders(sheet: SheetKey, rows: CellValue[][], errors: string[]) {
  const expected = HEADERS[sheet]
  const actual = rows[0] ?? []
  expected.forEach((header, index) => {
    if (normalizeText(actual[index]).toLowerCase() !== header.toLowerCase()) {
      errors.push(`${DTW_SHEETS[sheet]} column ${index + 1} must be “${header}”.`)
    }
  })
}

function validateRows(
  sheet: SheetKey,
  rows: BroilerDtwRow[],
  mode: BroilerDtwMode,
  references: BroilerDtwReferences,
  workbookPlacementKeys: Set<string>,
  errors: string[],
  warnings: string[],
) {
  const farms = new Set(references.farms.map(farm => farm.code.toUpperCase()))
  const buildings = new Set(references.buildings.map(building => `${building.farmCode}|${building.code}`.toUpperCase()))
  const cycles = new Set(references.cycles.map(cycle => `${cycle.farmCode}|${cycle.cycleKey}`.toUpperCase()))
  const rowKeys = new Set<string>()

  rows.forEach((row, index) => {
    const label = `${DTW_SHEETS[sheet]} row ${index + 2}`
    const farmCode = String(row.farmCode ?? '').trim()
    const buildingCode = String(row.buildingCode ?? '').trim()
    const importKey = String(row.importCycleKey ?? '').trim()
    const existingCycle = String(row.existingCycleKey ?? '').trim()
    if (!farmCode || !farms.has(farmCode.toUpperCase())) errors.push(`${label}: select a valid Farm.`)
    if (!buildingCode || !buildings.has(`${farmCode}|${buildingCode}`.toUpperCase())) errors.push(`${label}: select a Building belonging to ${farmCode || 'the farm'}.`)
    if (sheet === 'placement' && existingCycle) errors.push(`${label}: DOC Placement creates a new Legacy cycle and cannot use an Existing Legacy Cycle.`)
    if (existingCycle && !cycles.has(`${farmCode}|${existingCycle}`.toUpperCase())) errors.push(`${label}: Existing Legacy Cycle does not belong to the selected Farm.`)
    if (sheet !== 'placement' && importKey && !existingCycle && !workbookPlacementKeys.has(importKey.toUpperCase())) {
      errors.push(`${label}: Import Cycle Key “${importKey}” has no DOC Placement row in this workbook.`)
    }

    Object.entries(row).forEach(([key, value]) => {
      if (NUMERIC_FIELDS.has(key) && typeof value === 'number' && Number.isNaN(value)) errors.push(`${label}: ${key} must be numeric.`)
      if (NUMERIC_FIELDS.has(key) && typeof value === 'number' && value < 0) errors.push(`${label}: ${key} cannot be negative.`)
      if (DATE_FIELDS.has(key) && value && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) errors.push(`${label}: ${key} must be a valid date.`)
    })

    const signature = [farmCode, buildingCode, row.placementDate ?? '', importKey || existingCycle, row.age ?? '', row.documentNo ?? '', row.deliveryDate ?? '', row.cleanupDate ?? ''].join('|').toUpperCase()
    if (rowKeys.has(signature)) errors.push(`${label}: duplicate row identity in ${DTW_SHEETS[sheet]}.`)
    rowKeys.add(signature)

    FIELD_KEYS[sheet].forEach((key, fieldIndex) => {
      if (DTW_FIELD_BEHAVIORS[sheet][fieldIndex] !== 'required') return
      if (row[key] == null || row[key] === '') {
        errors.push(`${label}: ${HEADERS[sheet][fieldIndex]} is required.`)
      }
    })

    const calculationIssues: string[] = []
    if (sheet === 'growing' && typeof row.mortalityTotal === 'number') {
      const expected = Number(row.mortalityAm ?? 0) + Number(row.mortalityPm ?? 0)
      if (!closeEnough(row.mortalityTotal, expected)) calculationIssues.push(`Mortality Total ${row.mortalityTotal} does not equal Mortality AM + PM (${expected}).`)
    }
    if (sheet === 'growing' && typeof row.rowTotal === 'number') {
      const expected = Number(row.mortalityAm ?? 0) + Number(row.mortalityPm ?? 0) + Number(row.thinningAm ?? 0) + Number(row.thinningPm ?? 0)
      if (!closeEnough(row.rowTotal, expected)) calculationIssues.push(`Row Total ${row.rowTotal} does not equal mortality plus thinning (${expected}).`)
    }
    if (sheet === 'harvest' && Number(row.quantity ?? 0) > 0 && typeof row.netLiveWeight === 'number' && typeof row.averageLiveWeight === 'number') {
      const expected = row.netLiveWeight / Number(row.quantity)
      if (!closeEnough(row.averageLiveWeight, expected)) calculationIssues.push(`ALW g ${row.averageLiveWeight} does not equal Net Live Weight / Harvest Quantity (${expected.toFixed(3)}).`)
    }
    calculationIssues.forEach(issue => {
      const message = `${label}: ${issue}`
      if (mode === 'standard') errors.push(message)
      else warnings.push(message)
    })
  })
}

export function parseBroilerDtwWorkbook(
  sheets: Array<{ sheet: string; data: CellValue[][] }>,
  fileName: string,
  mode: BroilerDtwMode,
  references: BroilerDtwReferences,
): BroilerDtwValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const parsed = {} as Record<SheetKey, BroilerDtwRow[]>

  ;(Object.keys(DTW_SHEETS) as SheetKey[]).forEach(key => {
    const sheet = sheets.find(candidate => candidate.sheet.trim().toLowerCase() === DTW_SHEETS[key].toLowerCase())
    if (!sheet) {
      errors.push(`The workbook must contain a worksheet named “${DTW_SHEETS[key]}”.`)
      parsed[key] = []
      return
    }
    validateHeaders(key, sheet.data, errors)
    parsed[key] = sheet.data.slice(1).filter(rowHasData).map(row => normalizeRow(key, row))
  })

  const placementKeys = new Set(parsed.placement.map(row => String(row.importCycleKey ?? '').trim().toUpperCase()).filter(Boolean))
  const placementKeyList = parsed.placement.map(row => String(row.importCycleKey ?? '').trim().toUpperCase()).filter(Boolean)
  placementKeyList.forEach((key, index) => {
    if (placementKeyList.indexOf(key) !== index) errors.push(`DOC Placement Import Cycle Key “${key}” must be unique in the workbook.`)
  })
  ;(Object.keys(DTW_SHEETS) as SheetKey[]).forEach(key => {
    validateRows(key, parsed[key], mode, references, placementKeys, errors, warnings)
  })

  if (Object.values(parsed).every(rows => rows.length === 0)) errors.push('The workbook contains no import rows.')

  const uniqueWarnings = Array.from(new Set(warnings))
  return {
    payload: { mode, fileName, ...parsed, warnings: uniqueWarnings },
    errors: Array.from(new Set(errors)),
    warnings: uniqueWarnings,
  }
}

type TemplateCell = {
  value: string
  backgroundColor?: string
  borderColor?: string
  borderStyle?: 'thin'
  fontWeight?: 'bold'
  textColor?: string
  wrap?: boolean
  columnSpan?: number
  height?: number
}

const border = { borderColor: '#D6D3D1', borderStyle: 'thin' as const }
const headerCell = (value: string): TemplateCell => ({ value, backgroundColor: '#166534', fontWeight: 'bold', textColor: '#FFFFFF', wrap: true, height: 30, ...border })
const fieldHeaderCell = (value: string, behavior: DtwFieldBehavior): TemplateCell => ({
  value,
  backgroundColor: behavior === 'required' ? '#FDE047' : behavior === 'automatic' ? '#2563EB' : '#16A34A',
  fontWeight: 'bold',
  textColor: behavior === 'required' ? '#422006' : '#FFFFFF',
  wrap: true,
  height: 30,
  ...border,
})
const infoCell = (value: string): TemplateCell => ({ value, wrap: true, ...border })
const formula = (value: string) => `<formula1>${sanitizeTextContent(value)}</formula1>`
const listFormula = (column: string, count: number) =>
  `'Dropdown Lists'!$${column}$2:$${column}$${Math.max(2, count + 1)}`
const buildingListFormula = (buildingCount: number) => {
  const farmRange = listFormula('B', buildingCount)
  return `OFFSET('Dropdown Lists'!$C$2,MATCH($B2,${farmRange},0)-1,0,COUNTIF(${farmRange},$B2),1)`
}

export const createBroilerDtwDropdownFeature = (
  farmCount: number,
  buildingCount: number,
  cycleCount: number,
): Feature<File | Blob | ArrayBuffer> => ({
  files: {
    transform: {
      'xl/worksheets/sheet{id}.xml': {
        transform: (xml, _options, { sheetIndex }) => {
          if (sheetIndex > 3) return xml
          const validations = [
            `<dataValidation type="list" allowBlank="0" showErrorMessage="0" sqref="B2:B2001">${formula(listFormula('A', farmCount))}</dataValidation>`,
            `<dataValidation type="list" allowBlank="0" showErrorMessage="0" sqref="C2:C2001">${formula(buildingListFormula(buildingCount))}</dataValidation>`,
            `<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="D2:D2001">${formula(listFormula('D', cycleCount))}</dataValidation>`,
          ]
          const markup = `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`
          return insertElementMarkupAccordingToOrderOfSiblings(xml, markup, getOrderOfSiblings('xl/worksheets/sheet{id}.xml', 'worksheet') ?? [], 'worksheet')
        },
      },
    },
  },
})

export async function exportBroilerDtwTemplate(references: BroilerDtwReferences) {
  const farmLabel = new Map(references.farms.map(farm => [farm.code, `${farm.code} - ${farm.name}`]))
  const farms = references.farms.map(farm => `${farm.code} - ${farm.name}`)
  const buildings = references.buildings
    .map(building => [farmLabel.get(building.farmCode) ?? building.farmCode, `${building.code} - ${building.name}`] as const)
    .sort((left, right) => left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]))
  const cycles = references.cycles.filter(cycle => cycle.cycleKey.toUpperCase().startsWith('LEGACY-')).map(cycle => cycle.cycleKey).sort()
  const sheets = (Object.keys(DTW_SHEETS) as SheetKey[]).map(key => ({
    data: [HEADERS[key].map((header, index) => fieldHeaderCell(header, DTW_FIELD_BEHAVIORS[key][index]))],
    sheet: DTW_SHEETS[key],
    columns: HEADERS[key].map(header => ({ width: Math.max(14, Math.min(28, header.length + 4)) })),
    stickyRowsCount: 1,
    showGridLines: true,
    orientation: 'landscape' as const,
    zoomScale: 0.78,
  }))
  await writeXlsxFile([
    ...sheets,
    {
      data: [
        [{ value: 'Broiler Data Transfer Workbench', backgroundColor: '#166534', columnSpan: 3, fontWeight: 'bold' as const, textColor: '#FFFFFF', height: 30 }],
        [{ value: 'Process sheets in order: DOC Placement, Growing, Harvest Delivery, then Clean Up. Every row requires a valid Farm, Building, and Placement Date. DOC Placement automatically creates a Legacy cycle; later sheets can link by an optional Import Cycle Key, an Existing Legacy Cycle, or Farm + Building + Placement Date.', columnSpan: 3, wrap: true, height: 68 }],
        [{ value: 'Yellow = required', backgroundColor: '#FDE047', fontWeight: 'bold' as const, textColor: '#422006', ...border }, { value: 'Green = optional', backgroundColor: '#16A34A', fontWeight: 'bold' as const, textColor: '#FFFFFF', ...border }, { value: 'Blue = automatic on import', backgroundColor: '#2563EB', fontWeight: 'bold' as const, textColor: '#FFFFFF', ...border }],
        ['Rule', 'Standard', 'Legacy / Non-Regulated'].map(headerCell),
        ['Inventory', 'Good DOC and feed item/batches are selected automatically and require available building stock.', 'Automatic inventory fields use the same configured items and available building stock.'].map(infoCell),
        ['Calculations', 'Blue columns are ignored from the upload and recalculated during import.', 'Blue columns are ignored from the upload and recalculated during import.'].map(infoCell),
        ['Notifications', 'Normal DTW posting events are emitted.', 'Historical imports suppress user notifications.'].map(infoCell),
        ['Continuation', 'Select an existing cycle.', 'Select an existing LEGACY cycle; Growing may continue after Harvest.'].map(infoCell),
        ['Generated Cycle #', 'DOC Placement creates LEGACY-MMDDYYYY-000 automatically from Placement Date. The three-digit sequence counts that farm’s Legacy cycles in the same month and year.', 'The same generated format applies. Cycle # is not entered in the workbook.'].map(infoCell),
        ['Import Cycle Key', 'Optional. Use it only when explicit links are preferred.', 'Rows can leave both cycle fields blank and use Farm + Building + Placement Date.'].map(infoCell),
        ['Blank cycle fields', 'DOC Placement creates a new Legacy cycle automatically. Later sheets first match the same workbook Placement.', 'If no workbook Placement matches, Farm + Building + Placement Date falls back to an existing Legacy cycle.'].map(infoCell),
      ],
      sheet: 'Instructions',
      columns: [{ width: 24 }, { width: 54 }, { width: 64 }],
      stickyRowsCount: 4,
      showGridLines: false,
    },
    {
      data: [
        ['Farms', 'Building Farm', 'Buildings', 'Existing Legacy Cycles'].map(headerCell),
        ...Array.from({ length: Math.max(farms.length, buildings.length, cycles.length, 1) }, (_, index) => [
          farms[index] ?? '', buildings[index]?.[0] ?? '', buildings[index]?.[1] ?? '', cycles[index] ?? '',
        ].map(value => ({ value, ...border }))),
      ],
      sheet: 'Dropdown Lists',
      columns: [{ width: 38 }, { width: 38 }, { width: 42 }, { width: 56 }],
      stickyRowsCount: 1,
      showGridLines: false,
    },
  ], {
    fontFamily: 'Arial',
    fontSize: 10,
    features: [createBroilerDtwDropdownFeature(farms.length, buildings.length, cycles.length)],
  }).toFile('broiler-data-transfer-workbench.xlsx')
}
