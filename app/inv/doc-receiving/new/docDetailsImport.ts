export type DocDetailsImportRow = {
  receiveDate: string
  receiveTime: string
  productionDate: string
  docSource: string
  building: string
  hatcheryRef: string
  averageDocWeight: string
  totalReceived: string
  doaCount: string
  rejectCount: string
  shortCount: string
  shortCountRemarks: string
  doaCountRemarks: string
  rejectCountRemarks: string
}

const HEADERS = [
  'Date Receive',
  'Time Receive',
  'Production Date',
  'DOC Source',
  'Building',
  'Hatchery Ref',
  'Average DOC Weight',
  'Total Received',
  'DOA Count',
  'Reject Count',
  'Short Count',
  'Short Count Remarks',
  'DOA Count Remarks',
  'Reject Count Remarks',
] as const

const normalizeHeader = (value: unknown) => String(value ?? '').trim().toLowerCase()

const textValue = (value: unknown) => String(value ?? '').trim()

const pad = (value: number) => String(value).padStart(2, '0')

const dateValue = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }

  const text = textValue(value)
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (!match) return text

  return `${match[3]}-${pad(Number(match[1]))}-${pad(Number(match[2]))}`
}

const timeValue = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad(value.getHours())}:${pad(value.getMinutes())}`
  }

  const text = textValue(value)
  if (!text) return ''
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text)
  if (!match) return text

  return `${pad(Number(match[1]))}:${match[2]}`
}

const numericValue = (value: unknown) => {
  const text = textValue(value).replace(/,/g, '')
  if (!text) return '0'
  const number = Number(text)
  return Number.isFinite(number) ? String(number) : text
}

const isValidDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
}

const isValidTime = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59)
}

export function parseDocDetailsImport(data: unknown[][]) {
  const issues: string[] = []
  const headerRow = data[0] ?? []
  const headerIndexes = new Map(
    headerRow.map((header, index) => [normalizeHeader(header), index]),
  )

  const missingHeaders = HEADERS.filter(header => !headerIndexes.has(normalizeHeader(header)))
  if (missingHeaders.length > 0) {
    return {
      rows: [] as DocDetailsImportRow[],
      issues: [`Missing column${missingHeaders.length === 1 ? '' : 's'}: ${missingHeaders.join(', ')}.`],
    }
  }

  const cell = (row: unknown[], header: typeof HEADERS[number]) =>
    row[headerIndexes.get(normalizeHeader(header)) ?? -1]

  const rows = data.slice(1).flatMap((row, index) => {
    if (row.every(value => textValue(value) === '')) return []

    const rowNumber = index + 2
    const parsed: DocDetailsImportRow = {
      receiveDate: dateValue(cell(row, 'Date Receive')),
      receiveTime: timeValue(cell(row, 'Time Receive')),
      productionDate: dateValue(cell(row, 'Production Date')),
      docSource: textValue(cell(row, 'DOC Source')),
      building: textValue(cell(row, 'Building')),
      hatcheryRef: textValue(cell(row, 'Hatchery Ref')),
      averageDocWeight: numericValue(cell(row, 'Average DOC Weight')),
      totalReceived: numericValue(cell(row, 'Total Received')),
      doaCount: numericValue(cell(row, 'DOA Count')),
      rejectCount: numericValue(cell(row, 'Reject Count')),
      shortCount: numericValue(cell(row, 'Short Count')),
      shortCountRemarks: textValue(cell(row, 'Short Count Remarks')),
      doaCountRemarks: textValue(cell(row, 'DOA Count Remarks')),
      rejectCountRemarks: textValue(cell(row, 'Reject Count Remarks')),
    }

    if (!parsed.productionDate) issues.push(`Row ${rowNumber}: Production Date is required.`)
    if (!parsed.docSource) issues.push(`Row ${rowNumber}: DOC Source is required.`)
    if (!parsed.building) issues.push(`Row ${rowNumber}: Building is required.`)
    if (parsed.receiveDate && !isValidDate(parsed.receiveDate)) {
      issues.push(`Row ${rowNumber}: Date Receive must use YYYY-MM-DD or M/D/YYYY.`)
    }
    if (parsed.productionDate && !isValidDate(parsed.productionDate)) {
      issues.push(`Row ${rowNumber}: Production Date must use YYYY-MM-DD or M/D/YYYY.`)
    }
    if (parsed.receiveTime && !isValidTime(parsed.receiveTime)) {
      issues.push(`Row ${rowNumber}: Time Receive must use 24-hour HH:MM format.`)
    }

    const numericFields = [
      ['Average DOC Weight', parsed.averageDocWeight, false],
      ['Total Received', parsed.totalReceived, true],
      ['DOA Count', parsed.doaCount, true],
      ['Reject Count', parsed.rejectCount, true],
      ['Short Count', parsed.shortCount, true],
    ] as const

    numericFields.forEach(([label, value, wholeNumber]) => {
      const number = Number(value)
      if (!Number.isFinite(number) || number < 0 || (wholeNumber && !Number.isInteger(number))) {
        issues.push(`Row ${rowNumber}: ${label} must be a non-negative${wholeNumber ? ' whole' : ''} number.`)
      }
    })

    return [parsed]
  })

  if (rows.length === 0 && issues.length === 0) {
    issues.push('The DOC Details worksheet has no data rows.')
  }

  return { rows, issues }
}
