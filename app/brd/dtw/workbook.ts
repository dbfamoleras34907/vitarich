import writeXlsxFile, { type Feature } from 'write-excel-file/browser'
import {
  getOrderOfSiblings,
  insertElementMarkupAccordingToOrderOfSiblings,
  sanitizeTextContent,
} from 'write-excel-file/utility'

import type {
  BroilerDtwMode,
  BroilerDtwProgress,
  BroilerDtwReferences,
  BroilerDtwRow,
  BroilerDtwValidation,
} from './types'
import { BROILER_DTW_SOURCE_ROW } from './types'

export const DTW_SHEETS = {
  placement: 'DOC Placement',
  growing: 'Growing',
  harvest: 'Harvest Delivery',
  cleanup: 'Clean Up',
} as const

type SheetKey = keyof typeof DTW_SHEETS
type CellValue = unknown
export type DtwFieldBehavior = 'required' | 'optional' | 'automatic'
type ParsedDtwRow = BroilerDtwRow & { [BROILER_DTW_SOURCE_ROW]?: number }

const COMMON_HEADERS = ['Import Cycle Key', 'Farm', 'Building', 'Placement Batch', 'Placement Date'] as const
const HEADERS: Record<SheetKey, readonly string[]> = {
  placement: [...COMMON_HEADERS, 'Document No.', 'Item Code', 'Item Name', 'Quantity Received', 'DOA', 'Reject', 'Short Count', 'Total Building Placement', 'Batch No.', 'Average DOC Weight', 'Remarks'],
  growing: [...COMMON_HEADERS, 'Entry Date', 'Age', 'Mortality AM', 'Mortality PM', 'Mortality Total', 'Thinning AM', 'Thinning PM', 'Row Total', 'Cumulative Total', 'Feed kg', 'Feed / Bird', 'Feed Item Code', 'Feed Batch No.', 'Body Weight g', 'Water L', 'Water / Bird', 'Temperature Min', 'Temperature Max', 'Humidity Min', 'Humidity Max', 'NH3 Max', 'Remarks'],
  harvest: [...COMMON_HEADERS, 'Document No.', 'Delivery Date', 'Harvest Age', 'Item Code', 'Item Name', 'Batch No.', 'Harvest Quantity', 'Net Live Weight', 'ALW g', 'Destination', 'Hauler Name', 'Plate Number', 'Truck Seal', 'Customer', 'Remarks'],
  cleanup: [...COMMON_HEADERS, 'Document No.', 'Clean Up Date', 'Item Code', 'Item Name', 'Batch No.', 'Quantity', 'Remarks'],
}
export const DTW_HEADERS = HEADERS

export const DTW_FIELD_BEHAVIORS: Record<SheetKey, readonly DtwFieldBehavior[]> = {
  placement: ['optional', 'required', 'required', 'required', 'optional', 'automatic', 'automatic', 'automatic', 'required', 'optional', 'optional', 'optional', 'automatic', 'automatic', 'optional', 'optional'],
  growing: ['optional', 'required', 'required', 'required', 'optional', 'required', 'automatic', 'required', 'optional', 'automatic', 'optional', 'optional', 'automatic', 'automatic', 'optional', 'automatic', 'automatic', 'automatic', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional'],
  harvest: ['optional', 'required', 'required', 'required', 'optional', 'automatic', 'required', 'required', 'automatic', 'automatic', 'automatic', 'required', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional'],
  cleanup: ['optional', 'required', 'required', 'required', 'optional', 'automatic', 'required', 'automatic', 'automatic', 'automatic', 'automatic', 'optional'],
}

const FIELD_KEYS: Record<SheetKey, readonly string[]> = {
  placement: ['importCycleKey', 'farmCode', 'buildingCode', 'placementBatch', 'placementDate', 'documentNo', 'itemCode', 'itemName', 'quantityReceived', 'doaCount', 'rejectCount', 'shortCount', 'actualReceived', 'batchNumber', 'averageDocWeight', 'remarks'],
  growing: ['importCycleKey', 'farmCode', 'buildingCode', 'placementBatch', 'placementDate', 'entryDate', 'age', 'mortalityAm', 'mortalityPm', 'mortalityTotal', 'thinningAm', 'thinningPm', 'rowTotal', 'cumulativeTotal', 'feedKg', 'feedPerBird', 'feedItemCode', 'feedBatchNumber', 'bodyWeight', 'waterLiters', 'waterPerBird', 'tempMin', 'tempMax', 'humidityMin', 'humidityMax', 'nh3Max', 'remarks'],
  harvest: ['importCycleKey', 'farmCode', 'buildingCode', 'placementBatch', 'placementDate', 'documentNo', 'deliveryDate', 'harvestAge', 'itemCode', 'itemName', 'batchNumber', 'quantity', 'netLiveWeight', 'averageLiveWeight', 'destination', 'haulerName', 'plateNumber', 'truckSeal', 'customer', 'remarks'],
  cleanup: ['importCycleKey', 'farmCode', 'buildingCode', 'placementBatch', 'placementDate', 'documentNo', 'cleanupDate', 'itemCode', 'itemName', 'batchNumber', 'quantity', 'remarks'],
}

const NUMERIC_FIELDS = new Set([
  'quantityReceived', 'actualReceived', 'averageDocWeight', 'doaCount', 'rejectCount', 'shortCount',
  'age', 'mortalityAm', 'mortalityPm', 'mortalityTotal', 'thinningAm', 'thinningPm', 'rowTotal',
  'cumulativeTotal', 'feedKg', 'feedPerBird', 'bodyWeight', 'waterLiters', 'waterPerBird',
  'tempMin', 'tempMax', 'humidityMin', 'humidityMax', 'nh3Max', 'harvestAge',
  'quantity', 'netLiveWeight', 'averageLiveWeight', 'truckSeal',
])
const DATE_FIELDS = new Set(['placementDate', 'entryDate', 'deliveryDate', 'cleanupDate'])

const normalizeText = (value: CellValue) => String(value ?? '').trim()
const extractCode = (value: CellValue) => normalizeText(value).split(' - ')[0].trim()
const canonicalDate = (year: number, month: number, day: number) => {
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
const excelDate = (value: CellValue) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return canonicalDate(value.getFullYear(), value.getMonth() + 1, value.getDate())
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000)
    return canonicalDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }
  const text = normalizeText(value)
  if (!text) return null
  const slashDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (slashDate) {
    const first = Number(slashDate[1])
    const second = Number(slashDate[2])
    const year = Number(slashDate[3])
    return canonicalDate(year, first, second) ?? canonicalDate(year, second, first) ?? text
  }
  const isoDate = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (isoDate) return canonicalDate(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3])) ?? text
  return text
}

const asNumber = (value: CellValue) => {
  if (value == null || normalizeText(value) === '') return null
  const parsed = typeof value === 'number' ? value : Number(normalizeText(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const rowHasData = (row: CellValue[]) => row.some(value => normalizeText(value) !== '')
const closeEnough = (left: number, right: number) => Math.abs(left - right) <= 0.0005
const normalizeHeader = (value: CellValue) => normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '')
const HEADER_ALIASES: Record<string, string[]> = {
  doa: ['doacount'],
  reject: ['rejectcount'],
  totalbuildingplacement: ['actualreceived'],
}
const headerMatches = (actual: CellValue, expected: string) => {
  const actualKey = normalizeHeader(actual)
  const expectedKey = normalizeHeader(expected)
  return actualKey === expectedKey || (HEADER_ALIASES[expectedKey] ?? []).includes(actualKey)
}

function normalizeRow(sheet: SheetKey, row: CellValue[], headerRow: CellValue[]): BroilerDtwRow {
  const normalized = Object.fromEntries(FIELD_KEYS[sheet].map((key, index) => {
    if (DTW_FIELD_BEHAVIORS[sheet][index] === 'automatic') return [key, null]
    const columnIndex = headerRow.findIndex(header => headerMatches(header, HEADERS[sheet][index]))
    const value = columnIndex >= 0 ? row[columnIndex] : null
    if (key === 'farmCode' || key === 'buildingCode') return [key, extractCode(value)]
    if (DATE_FIELDS.has(key)) return [key, excelDate(value)]
    if (NUMERIC_FIELDS.has(key)) return [key, asNumber(value)]
    return [key, normalizeText(value) || null]
  }))
  if (sheet === 'placement') {
    normalized.actualReceived = Math.max(
      Number(normalized.quantityReceived ?? 0)
      - Number(normalized.doaCount ?? 0)
      - Number(normalized.rejectCount ?? 0)
      - Number(normalized.shortCount ?? 0),
      0,
    )
  }
  return normalized
}

function findHeaderRow(sheet: SheetKey, rows: CellValue[][]) {
  const expected = HEADERS[sheet]
  return rows.slice(0, 25)
    .map((row, index) => ({
      index,
      row,
      score: expected.filter(header => row.some(cell => headerMatches(cell, header))).length,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]
}

function normalizeParsedRow(
  sheet: SheetKey,
  row: CellValue[],
  headerRow: CellValue[],
  sourceRow: number,
  modifications: string[],
) {
  const normalized = normalizeRow(sheet, row, headerRow) as ParsedDtwRow
  Object.defineProperty(normalized, BROILER_DTW_SOURCE_ROW, { value: sourceRow, enumerable: false })
  FIELD_KEYS[sheet].forEach((key, fieldIndex) => {
    const columnIndex = headerRow.findIndex(cell => headerMatches(cell, HEADERS[sheet][fieldIndex]))
    const original = columnIndex >= 0 ? row[columnIndex] : null
    if (DTW_FIELD_BEHAVIORS[sheet][fieldIndex] === 'automatic' && normalizeText(original)) {
      modifications.push(`${DTW_SHEETS[sheet]} row ${sourceRow}: uploaded ${HEADERS[sheet][fieldIndex]} was ignored and will be recalculated automatically.`)
    }
    if (DATE_FIELDS.has(key) && normalizeText(original) && normalized[key] !== normalizeText(original)) {
      modifications.push(`${DTW_SHEETS[sheet]} row ${sourceRow}: ${HEADERS[sheet][fieldIndex]} was normalized from ${normalizeText(original)} to ${normalized[key]}.`)
    }
  })
  return normalized
}

function parseSheetRows(sheet: SheetKey, rows: CellValue[][], errors: string[], modifications: string[]) {
  const header = findHeaderRow(sheet, rows)
  if (!header || header.score < 3) {
    errors.push(`${DTW_SHEETS[sheet]} header row was not found.`)
    return []
  }
  HEADERS[sheet].forEach((expected, index) => {
    if (DTW_FIELD_BEHAVIORS[sheet][index] === 'required' && !header.row.some(cell => headerMatches(cell, expected))) {
      errors.push(`${DTW_SHEETS[sheet]} requires a “${expected}” column.`)
    }
  })
  return rows.slice(header.index + 1)
    .map((row, index) => ({ row, sourceRow: header.index + index + 2 }))
    .filter(({ row }) => rowHasData(row))
    .map(({ row, sourceRow }) => normalizeParsedRow(sheet, row, header.row, sourceRow, modifications))
}

const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0))

async function parseSheetRowsWithProgress(
  sheet: SheetKey,
  rows: CellValue[][],
  errors: string[],
  modifications: string[],
  onProgress: (progress: BroilerDtwProgress) => void,
) {
  const header = findHeaderRow(sheet, rows)
  if (!header || header.score < 3) {
    errors.push(`${DTW_SHEETS[sheet]} header row was not found.`)
    return []
  }
  HEADERS[sheet].forEach((expected, index) => {
    if (DTW_FIELD_BEHAVIORS[sheet][index] === 'required' && !header.row.some(cell => headerMatches(cell, expected))) {
      errors.push(`${DTW_SHEETS[sheet]} requires a â€œ${expected}â€ column.`)
    }
  })
  const candidates = rows.slice(header.index + 1)
  const parsed: BroilerDtwRow[] = []
  for (let index = 0; index < candidates.length; index += 1) {
    const row = candidates[index]
    const sourceRow = header.index + index + 2
    if (rowHasData(row)) parsed.push(normalizeParsedRow(sheet, row, header.row, sourceRow, modifications))
    if (index % 50 === 0 || index === candidates.length - 1) {
      const processedRows = index + 1
      onProgress({
        phase: 'processing',
        message: `Processing ${DTW_SHEETS[sheet]} row ${sourceRow}`,
        module: DTW_SHEETS[sheet],
        worksheetRow: sourceRow,
        processedRows,
        totalRows: candidates.length,
        percent: candidates.length > 0 ? Math.round(processedRows / candidates.length * 100) : 100,
      })
      await yieldToBrowser()
    }
  }
  return parsed
}

const batchGroupKey = (row: BroilerDtwRow) => [row.farmCode, row.buildingCode, row.placementBatch, row.placementDate]
  .map(value => String(value ?? '').trim().toUpperCase())
  .join('|')

const growingIdentity = (row: BroilerDtwRow) => [
  row.farmCode,
  row.buildingCode,
  row.placementBatch,
  row.placementDate,
  row.age === MAX_GROWING_AGE ? '__MAX_AGE__' : row.entryDate,
  row.age ?? '',
].map(value => String(value ?? '').trim().toUpperCase()).join('|')

const harvestIdentity = (row: BroilerDtwRow) => [
  row.farmCode,
  row.buildingCode,
  row.placementBatch,
  row.deliveryDate,
  row.harvestAge ?? '',
  row.destination,
  row.haulerName,
  row.plateNumber,
  row.truckSeal ?? '',
  row.customer,
].map(value => String(value ?? '').trim().toUpperCase()).join('|')

const GROWING_SUM_FIELDS = [
  'mortalityAm',
  'mortalityPm',
  'thinningAm',
  'thinningPm',
  'feedKg',
  'waterLiters',
] as const

const GROWING_LATEST_FIELDS = [
  'placementDate',
  'entryDate',
  'bodyWeight',
  'waterPerBird',
  'tempMin',
  'tempMax',
  'humidityMin',
  'humidityMax',
  'nh3Max',
] as const

const MAX_GROWING_AGE = 50

function assignGrowingAges(parsed: Record<SheetKey, BroilerDtwRow[]>, errors: string[], modifications: string[]) {
  const firstEntryDateByBatch = new Map<string, string>()
  const considerEntryDate = (key: string, value: unknown) => {
    const date = String(value ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    const current = firstEntryDateByBatch.get(key)
    if (!current || date < current) firstEntryDateByBatch.set(key, date)
  }
  parsed.growing.forEach(row => considerEntryDate(batchGroupKey(row), row.entryDate))
  parsed.growing.forEach((row, index) => {
    const key = batchGroupKey(row)
    const explicitPlacementDate = String(row.placementDate ?? '')
    const firstDate = /^\d{4}-\d{2}-\d{2}$/.test(explicitPlacementDate)
      ? explicitPlacementDate
      : firstEntryDateByBatch.get(key)
    const entryDate = String(row.entryDate ?? '')
    if (!firstDate || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
      row.age = null
      return
    }
    // Persist the inferred segment start in the normalized payload so the
    // database independently performs the same calculation.
    if (!row.placementDate) row.placementDate = firstDate
    const firstDay = Date.parse(`${firstDate}T00:00:00Z`)
    const entryDay = Date.parse(`${entryDate}T00:00:00Z`)
    const calculatedAge = Math.floor((entryDay - firstDay) / 86_400_000) + 1
    const sourceRow = (row as ParsedDtwRow)[BROILER_DTW_SOURCE_ROW] ?? index + 2
    if (calculatedAge < 1) {
      row.age = calculatedAge
      errors.push(`Growing row ${sourceRow}: calculated Age ${calculatedAge} is below the allowed minimum of 1. Check the Placement Date for Placement Batch ${row.placementBatch ?? ''}.`)
    } else if (calculatedAge > MAX_GROWING_AGE) {
      row.age = MAX_GROWING_AGE
      modifications.push(`Growing row ${sourceRow}: calculated Age ${calculatedAge} was capped at ${MAX_GROWING_AGE} for Placement Batch ${row.placementBatch ?? ''}.`)
    } else {
      row.age = calculatedAge
    }
  })
}

function mergeGrowingDuplicates(rows: BroilerDtwRow[], warnings: string[], modifications: string[]) {
  const groups = new Map<string, { row: ParsedDtwRow; sourceRows: number[] }>()
  rows.forEach((candidate, index) => {
    const row = candidate as ParsedDtwRow
    const sourceRow = row[BROILER_DTW_SOURCE_ROW] ?? index + 2
    const identity = growingIdentity(row)
    const existing = groups.get(identity)
    if (!existing) {
      groups.set(identity, { row, sourceRows: [sourceRow] })
      return
    }

    GROWING_SUM_FIELDS.forEach(field => {
      const current = existing.row[field]
      const incoming = row[field]
      if (typeof incoming !== 'number') return
      existing.row[field] = typeof current === 'number' ? current + incoming : incoming
    })
    GROWING_LATEST_FIELDS.forEach(field => {
      if (row[field] != null && row[field] !== '') existing.row[field] = row[field]
    })
    const remarks = [existing.row.remarks, row.remarks]
      .map(value => String(value ?? '').trim())
      .filter((value, position, values) => value && values.indexOf(value) === position)
    existing.row.remarks = remarks.length > 0 ? remarks.join(' | ') : null
    existing.sourceRows.push(sourceRow)
  })

  groups.forEach(({ row, sourceRows }) => {
    if (sourceRows.length < 2) return
    const message = `Growing rows ${sourceRows.join(', ')} were combined for Placement Batch ${row.placementBatch ?? ''}, Building ${row.buildingCode ?? ''}, calculated Age ${row.age ?? 'blank'}, and Entry Date ${row.entryDate ?? 'blank'}.`
    warnings.push(message)
    modifications.push(message)
  })
  return Array.from(groups.values(), group => group.row)
}

function mergeHarvestDuplicates(rows: BroilerDtwRow[], warnings: string[], modifications: string[]) {
  const groups = new Map<string, { row: ParsedDtwRow; sourceRows: number[] }>()
  rows.forEach((candidate, index) => {
    const row = candidate as ParsedDtwRow
    const sourceRow = row[BROILER_DTW_SOURCE_ROW] ?? index + 2
    const identity = harvestIdentity(row)
    const existing = groups.get(identity)
    if (!existing) {
      groups.set(identity, { row, sourceRows: [sourceRow] })
      return
    }

    ;(['quantity', 'netLiveWeight'] as const).forEach(field => {
      const current = existing.row[field]
      const incoming = row[field]
      if (typeof incoming !== 'number') return
      existing.row[field] = typeof current === 'number' ? current + incoming : incoming
    })
    if (typeof existing.row.quantity === 'number' && existing.row.quantity > 0 && typeof existing.row.netLiveWeight === 'number') {
      existing.row.averageLiveWeight = existing.row.netLiveWeight / existing.row.quantity
    } else if (row.averageLiveWeight != null && row.averageLiveWeight !== '') {
      existing.row.averageLiveWeight = row.averageLiveWeight
    }
    const remarks = [existing.row.remarks, row.remarks]
      .map(value => String(value ?? '').trim())
      .filter((value, position, values) => value && values.indexOf(value) === position)
    existing.row.remarks = remarks.length > 0 ? remarks.join(' | ') : null
    existing.sourceRows.push(sourceRow)
  })

  groups.forEach(({ row, sourceRows }) => {
    if (sourceRows.length < 2) return
    const message = `Harvest Delivery rows ${sourceRows.join(', ')} were combined for Placement Batch ${row.placementBatch ?? ''}, Building ${row.buildingCode ?? ''}, Delivery Date ${row.deliveryDate ?? 'blank'}, and Harvest Age ${row.harvestAge ?? 'blank'}.`
    warnings.push(message)
    modifications.push(message)
  })
  return Array.from(groups.values(), group => group.row)
}

function validateRows(
  sheet: SheetKey,
  rows: BroilerDtwRow[],
  mode: BroilerDtwMode,
  references: BroilerDtwReferences,
  workbookPlacementKeys: Set<string>,
  workbookPlacementBatches: Set<string>,
  errors: string[],
  warnings: string[],
) {
  const farms = new Set(references.farms.map(farm => farm.code.toUpperCase()))
  const buildings = new Set(references.buildings.map(building => `${building.farmCode}|${building.code}`.toUpperCase()))
  const cycles = new Set(references.cycles.map(cycle => `${cycle.farmCode}|${cycle.cycleKey}`.toUpperCase()))
  const rowKeys = new Map<string, number>()

  rows.forEach((row, index) => {
    const sourceRow = (row as ParsedDtwRow)[BROILER_DTW_SOURCE_ROW] ?? index + 2
    const label = `${DTW_SHEETS[sheet]} row ${sourceRow}`
    const farmCode = String(row.farmCode ?? '').trim()
    const buildingCode = String(row.buildingCode ?? '').trim()
    const importKey = String(row.importCycleKey ?? '').trim()
    const placementBatch = String(row.placementBatch ?? '').trim()
    if (!farmCode || !farms.has(farmCode.toUpperCase())) errors.push(`${label}: select a valid Farm.`)
    if (!buildingCode || !buildings.has(`${farmCode}|${buildingCode}`.toUpperCase())) errors.push(`${label}: select a Building belonging to ${farmCode || 'the farm'}.`)
    if (placementBatch && sheet === 'growing' && !cycles.has(`${farmCode}|${placementBatch}`.toUpperCase()) && !workbookPlacementBatches.has(`${farmCode}|${placementBatch}`.toUpperCase())) {
      errors.push(`${label}: Placement Batch does not belong to the selected Farm or a DOC Placement row in this workbook.`)
    }
    if (sheet !== 'placement' && importKey && !workbookPlacementKeys.has(importKey.toUpperCase())) {
      errors.push(`${label}: Import Cycle Key “${importKey}” has no DOC Placement row in this workbook.`)
    }

    Object.entries(row).forEach(([key, value]) => {
      if (NUMERIC_FIELDS.has(key) && typeof value === 'number' && Number.isNaN(value)) errors.push(`${label}: ${key} must be numeric.`)
      if (NUMERIC_FIELDS.has(key) && typeof value === 'number' && value < 0) errors.push(`${label}: ${key} cannot be negative.`)
      if (DATE_FIELDS.has(key) && value && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) errors.push(`${label}: ${key} must be a valid date.`)
    })

    const signature = sheet === 'harvest'
      ? harvestIdentity(row)
      : sheet === 'growing'
        ? growingIdentity(row)
        : [farmCode, buildingCode, placementBatch, importKey, row.age ?? '', row.documentNo ?? '', row.deliveryDate ?? '', row.cleanupDate ?? ''].join('|').toUpperCase()
    const firstSourceRow = rowKeys.get(signature)
    if (firstSourceRow != null) {
      const detail = sheet === 'growing'
        ? `same Farm, Building, Placement Batch, calculated Age ${row.age ?? 'blank'}, and Entry Date ${row.entryDate ?? 'blank'}`
        : 'same imported row identity'
      errors.push(`${label} is a duplicate of ${DTW_SHEETS[sheet]} row ${firstSourceRow} (${detail}).`)
    } else {
      rowKeys.set(signature, sourceRow)
    }

    FIELD_KEYS[sheet].forEach((key, fieldIndex) => {
      if (DTW_FIELD_BEHAVIORS[sheet][fieldIndex] !== 'required') return
      if (row[key] == null || row[key] === '') {
        errors.push(`${label}: ${HEADERS[sheet][fieldIndex]} is required.`)
      }
    })

    if (sheet === 'placement') {
      const totalLosses = Number(row.doaCount ?? 0) + Number(row.rejectCount ?? 0) + Number(row.shortCount ?? 0)
      if (totalLosses > Number(row.quantityReceived ?? 0)) {
        errors.push(`${label}: DOA + Reject + Short Count cannot exceed Quantity Received.`)
      }
    }

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

function completeBroilerDtwValidation(
  parsed: Record<SheetKey, BroilerDtwRow[]>,
  fileName: string,
  mode: BroilerDtwMode,
  references: BroilerDtwReferences,
  errors: string[],
  warnings: string[],
  modifications: string[],
): BroilerDtwValidation {
  assignGrowingAges(parsed, errors, modifications)
  parsed.placement.forEach((row, index) => {
    const sourceRow = (row as ParsedDtwRow)[BROILER_DTW_SOURCE_ROW] ?? index + 2
    modifications.push(`DOC Placement row ${sourceRow}: Total Building Placement was calculated as ${row.actualReceived ?? 0}.`)
  })
  parsed.growing.forEach((row, index) => {
    const sourceRow = (row as ParsedDtwRow)[BROILER_DTW_SOURCE_ROW] ?? index + 2
    modifications.push(`Growing row ${sourceRow}: Age was calculated as ${row.age ?? 'blank'} for Placement Batch ${row.placementBatch ?? ''}.`)
  })
  parsed.growing = mergeGrowingDuplicates(parsed.growing, warnings, modifications)
  parsed.harvest = mergeHarvestDuplicates(parsed.harvest, warnings, modifications)

  const placementKeys = new Set(parsed.placement.map(row => String(row.importCycleKey ?? '').trim().toUpperCase()).filter(Boolean))
  const placementBatches = new Set(parsed.placement.map(row => {
    const farmCode = String(row.farmCode ?? '').trim()
    const placementBatch = String(row.placementBatch ?? '').trim()
    return farmCode && placementBatch ? `${farmCode}|${placementBatch}`.toUpperCase() : ''
  }).filter(Boolean))
  const placementKeyList = parsed.placement.map(row => String(row.importCycleKey ?? '').trim().toUpperCase()).filter(Boolean)
  placementKeyList.forEach((key, index) => {
    if (placementKeyList.indexOf(key) !== index) errors.push(`DOC Placement Import Cycle Key “${key}” must be unique in the workbook.`)
  })
  ;(Object.keys(DTW_SHEETS) as SheetKey[]).forEach(key => {
    validateRows(key, parsed[key], mode, references, placementKeys, placementBatches, errors, warnings)
  })

  if (Object.values(parsed).every(rows => rows.length === 0)) errors.push('The workbook contains no import rows.')

  const uniqueWarnings = Array.from(new Set(warnings))
  const uniqueModifications = Array.from(new Set(modifications))
  return {
    payload: { mode, fileName, ...parsed, warnings: uniqueWarnings },
    errors: Array.from(new Set(errors)),
    warnings: uniqueWarnings,
    modifications: uniqueModifications,
  }
}

type WorkbookSheet = { sheet: string; data: CellValue[][] }

export function parseBroilerDtwWorkbook(
  sheets: WorkbookSheet[],
  fileName: string,
  mode: BroilerDtwMode,
  references: BroilerDtwReferences,
): BroilerDtwValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const modifications: string[] = []
  const parsed = {} as Record<SheetKey, BroilerDtwRow[]>

  ;(Object.keys(DTW_SHEETS) as SheetKey[]).forEach(key => {
    const sheet = sheets.find(candidate => candidate.sheet.trim().toLowerCase() === DTW_SHEETS[key].toLowerCase())
    if (!sheet) {
      errors.push(`The workbook must contain a worksheet named “${DTW_SHEETS[key]}”.`)
      parsed[key] = []
      return
    }
    parsed[key] = parseSheetRows(key, sheet.data, errors, modifications)
  })
  return completeBroilerDtwValidation(parsed, fileName, mode, references, errors, warnings, modifications)
}

export async function parseBroilerDtwWorkbookWithProgress(
  sheets: WorkbookSheet[],
  fileName: string,
  mode: BroilerDtwMode,
  references: BroilerDtwReferences,
  onProgress: (progress: BroilerDtwProgress) => void,
): Promise<BroilerDtwValidation> {
  const errors: string[] = []
  const warnings: string[] = []
  const modifications: string[] = []
  const parsed = {} as Record<SheetKey, BroilerDtwRow[]>

  for (const key of Object.keys(DTW_SHEETS) as SheetKey[]) {
    const sheet = sheets.find(candidate => candidate.sheet.trim().toLowerCase() === DTW_SHEETS[key].toLowerCase())
    if (!sheet) {
      errors.push(`The workbook must contain a worksheet named “${DTW_SHEETS[key]}”.`)
      parsed[key] = []
      continue
    }
    parsed[key] = await parseSheetRowsWithProgress(key, sheet.data, errors, modifications, onProgress)
  }
  onProgress({ phase: 'finalizing', message: 'Calculating ages, combining duplicates, and running final validation.' })
  await yieldToBrowser()
  const result = completeBroilerDtwValidation(parsed, fileName, mode, references, errors, warnings, modifications)
  onProgress({ phase: 'finalizing', message: 'Validation complete.', percent: 100 })
  return result
}

type TemplateCell = {
  value: string | number
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
  const farmRange = listFormula('C', buildingCount)
  return `OFFSET('Dropdown Lists'!$E$2,MATCH($B2,${farmRange},0)-1,0,COUNTIF(${farmRange},$B2),1)`
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
            `<dataValidation type="list" allowBlank="0" showErrorMessage="0" sqref="D2:D2001">${formula(listFormula('G', cycleCount))}</dataValidation>`,
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
  const farms = references.farms.map(farm => ({ id: farm.id, label: `${farm.code} - ${farm.name}` }))
  const buildings = references.buildings
    .map(building => ({
      farmId: building.farmId,
      farmLabel: farmLabel.get(building.farmCode) ?? building.farmCode,
      id: building.id,
      label: `${building.code} - ${building.name}`,
    }))
    .sort((left, right) => left.farmLabel.localeCompare(right.farmLabel) || left.label.localeCompare(right.label))
  const cycles = [...references.cycles]
    .sort((left, right) => left.cycleKey.localeCompare(right.cycleKey))
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
        [{ value: 'Process sheets in order: DOC Placement, Growing, Harvest Delivery, then Clean Up. Every row requires a valid Farm, Building, and Placement Batch. Placement Batch is the Cycle Master key on every module. Placement Date is optional.', columnSpan: 3, wrap: true, height: 68 }],
        [{ value: 'Yellow = required', backgroundColor: '#FDE047', fontWeight: 'bold' as const, textColor: '#422006', ...border }, { value: 'Green = optional', backgroundColor: '#16A34A', fontWeight: 'bold' as const, textColor: '#FFFFFF', ...border }, { value: 'Blue = automatic on import', backgroundColor: '#2563EB', fontWeight: 'bold' as const, textColor: '#FFFFFF', ...border }],
        ['Rule', 'Standard', 'Legacy / Non-Regulated'].map(headerCell),
        ['Inventory', 'Good DOC and feed item/batches are selected automatically and require available building stock.', 'Automatic inventory fields use the same configured items and available building stock.'].map(infoCell),
        ['Calculations', 'Blue columns are ignored from the upload and recalculated during import.', 'Blue columns are ignored from the upload and recalculated during import.'].map(infoCell),
        ['Notifications', 'Normal DTW posting events are emitted.', 'Historical imports suppress user notifications.'].map(infoCell),
        ['Placement Batch', 'Required. Select an existing Cycle Master key or enter the key that DOC Placement should create.', 'Use the same Placement Batch across every module row that belongs to that Cycle Master.'].map(infoCell),
        ['DOC Placement totals', 'Enter Quantity Received, DOA, Reject, and Short Count. Total Building Placement is calculated automatically.', 'The same calculation is used: Quantity Received less DOA, Reject, and Short Count.'].map(infoCell),
        ['Growing Age', 'Automatic. Each Placement Batch restarts at Age 1 using its earliest Placement Date in the Growing sheet; each Entry Date is counted from it.', 'DOC Placement dates do not affect Growing age. If the batch has no Growing Placement Date, its earliest Growing Entry Date is Age 1.'].map(infoCell),
        ['Dates', 'Enter dates as MM/dd/yyyy. Native Excel dates and identifiable legacy dd/MM/yyyy values are normalized automatically.', 'The same date handling applies to all date columns.'].map(infoCell),
        ['Import Cycle Key', 'Optional. Use it to explicitly link rows within this workbook.', 'Placement Batch remains required and is persisted as the Cycle Master key.'].map(infoCell),
        ['Placement Date', 'Optional. When blank, the import date is used for DOC Placement persistence.', 'Later modules resolve their Cycle Master from Placement Batch, not Placement Date.'].map(infoCell),
      ],
      sheet: 'Instructions',
      columns: [{ width: 24 }, { width: 54 }, { width: 64 }],
      stickyRowsCount: 4,
      showGridLines: false,
    },
    {
      data: [
        ['Farms', 'Farm ID', 'Building Farm', 'Building Farm ID', 'Buildings', 'Building ID', 'Placement Batches', 'Cycle Master ID', 'Cycle Master Farm ID'].map(headerCell),
        ...Array.from({ length: Math.max(farms.length, buildings.length, cycles.length, 1) }, (_, index) => [
          farms[index]?.label ?? '', farms[index]?.id ?? '',
          buildings[index]?.farmLabel ?? '', buildings[index]?.farmId ?? '', buildings[index]?.label ?? '', buildings[index]?.id ?? '',
          cycles[index]?.cycleKey ?? '', cycles[index]?.id ?? '', cycles[index]?.farmId ?? '',
        ].map(value => ({ value, ...border }))),
      ],
      sheet: 'Dropdown Lists',
      columns: [
        { width: 38 }, { width: 14 }, { width: 38 }, { width: 18 }, { width: 42 },
        { width: 14 }, { width: 56 }, { width: 24 }, { width: 30 },
      ],
      stickyRowsCount: 1,
      showGridLines: false,
    },
  ], {
    fontFamily: 'Arial',
    fontSize: 10,
    features: [createBroilerDtwDropdownFeature(farms.length, buildings.length, cycles.length)],
  }).toFile('broiler-data-transfer-workbench.xlsx')
}

export async function exportBroilerDtwValidationReport(validation: BroilerDtwValidation) {
  const reportTypes = new Map<string, Set<string>>()
  const addReportItems = (type: string, messages: string[]) => messages.forEach(message => {
    const types = reportTypes.get(message) ?? new Set<string>()
    types.add(type)
    reportTypes.set(message, types)
  })
  addReportItems('Error', validation.errors)
  addReportItems('Warning', validation.warnings)
  addReportItems('Modification', validation.modifications)
  const reportRows = Array.from(reportTypes, ([message, types]) => [Array.from(types).join(' / '), message])
  if (reportRows.length === 0) reportRows.push(['Information', 'Validation completed without warnings or automatic modifications.'])

  const normalizedSheets = (Object.keys(DTW_SHEETS) as SheetKey[]).map(key => ({
    data: [
      ['Source Row', ...HEADERS[key]].map(headerCell),
      ...validation.payload[key].map((row, index) => {
        const sourceRow = (row as ParsedDtwRow)[BROILER_DTW_SOURCE_ROW] ?? index + 2
        return [sourceRow, ...FIELD_KEYS[key].map(field => row[field] ?? '')]
          .map(value => ({ value, wrap: false, ...border }))
      }),
    ],
    sheet: DTW_SHEETS[key],
    columns: [
      { width: 14 },
      ...HEADERS[key].map(header => ({ width: Math.max(14, Math.min(28, header.length + 4)) })),
    ],
    stickyRowsCount: 1,
    showGridLines: false,
    orientation: 'landscape' as const,
    zoomScale: 0.78,
  }))

  await writeXlsxFile([
    {
      data: [
        [{ value: 'Broiler DTW Validation Report', backgroundColor: '#166534', columnSpan: 2, fontWeight: 'bold' as const, textColor: '#FFFFFF', height: 30 }],
        [{ value: 'Source file', fontWeight: 'bold' as const, ...border }, { value: validation.payload.fileName, ...border }],
        [{ value: 'Mode', fontWeight: 'bold' as const, ...border }, { value: validation.payload.mode, ...border }],
        [{ value: 'Validation status', fontWeight: 'bold' as const, ...border }, { value: validation.errors.length === 0 ? 'Ready to import' : 'Blocked', ...border }],
        [{ value: 'Errors', fontWeight: 'bold' as const, ...border }, { value: validation.errors.length, ...border }],
        [{ value: 'Warnings', fontWeight: 'bold' as const, ...border }, { value: validation.warnings.length, ...border }],
        [{ value: 'Automatic modifications', fontWeight: 'bold' as const, ...border }, { value: validation.modifications.length, ...border }],
        ['Type', 'Validation detail'].map(headerCell),
        ...reportRows.map(([type, message]) => [
          { value: type, backgroundColor: type.includes('Error') ? '#FEE2E2' : type.includes('Warning') ? '#FEF3C7' : '#DBEAFE', ...border },
          { value: message, wrap: true, ...border },
        ]),
      ],
      sheet: 'Validation Report',
      columns: [{ width: 24 }, { width: 110 }],
      stickyRowsCount: 8,
      showGridLines: false,
    },
    ...normalizedSheets,
  ], {
    fontFamily: 'Arial',
    fontSize: 10,
  }).toFile('broiler-dtw-validation-report.xlsx')
}
