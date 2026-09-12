export type GoodsReceiptLineImportRow = {
  rowNumber: number
  itemCode: string
  altQty: string
  altUom: string
  warehouse: string
  supplierBatchNumber: string
  manufacturingDate: string
  expiryDate: string
  batchNumber: string
}

export const GOODS_RECEIPT_LINE_HEADERS = [
  'Item Code',
  'Alt Qty',
  'Alt UoM',
  'Warehouse',
  'Supplier Batch Number',
  'Manufacturing Date',
  'Expiry Date',
  'Batch Number',
] as const

const HEADERS = GOODS_RECEIPT_LINE_HEADERS

// Excel quotes cells containing tabs, newlines, or double quotes.
export function parseGoodsReceiptLinesText(text: string) {
  const data: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (char === '"' && quoted && input[index + 1] === '"') {
      value += '"'
      index += 1
    } else if (char === '"' && (quoted || value === '')) {
      quoted = !quoted
    } else if (!quoted && (char === '\t' || char === '\n')) {
      row.push(value)
      value = ''
      if (char === '\n') {
        data.push(row)
        row = []
      }
    } else {
      value += char
    }
  }
  if (quoted) return { rows: [], issues: ['Pasted text contains an unclosed quoted cell.'] }
  row.push(value)
  data.push(row)
  while (data.length && data[0].every(cell => !cell.trim())) data.shift()
  while (data.length && data[data.length - 1].every(cell => !cell.trim())) data.pop()
  if (!data.length) return { rows: [], issues: ['Paste at least one item line.'] }

  const hasHeaders = data[0].some(cell => normalizeHeader(cell) === 'item code')
  if (!hasHeaders && data.some(cells => cells.length > HEADERS.length)) {
    return { rows: [], issues: [`Pasted rows must follow the ${HEADERS.length} template columns. Include template headers when copying additional columns.`] }
  }
  return parseGoodsReceiptLinesImport(hasHeaders ? data : [[...HEADERS], ...data], hasHeaders ? 2 : 1)
}

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

const isValidDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
}

export function parseGoodsReceiptLinesImport(data: unknown[][], firstDataRow = 2) {
  const issues: string[] = []
  const headerRow = data[0] ?? []
  const headerIndexes = new Map(
    headerRow.map((header, index) => [normalizeHeader(header), index]),
  )

  const missingHeaders = HEADERS.filter(header => !headerIndexes.has(normalizeHeader(header)))
  if (missingHeaders.length > 0) {
    return {
      rows: [] as GoodsReceiptLineImportRow[],
      issues: [`Missing column${missingHeaders.length === 1 ? '' : 's'}: ${missingHeaders.join(', ')}.`],
    }
  }

  const cell = (row: unknown[], header: typeof HEADERS[number]) =>
    row[headerIndexes.get(normalizeHeader(header)) ?? -1]

  const rows = data.slice(1).flatMap((row, index) => {
    if (row.every(value => textValue(value) === '')) return []

    const rowNumber = index + firstDataRow
    const quantityText = textValue(cell(row, 'Alt Qty')).replace(/,/g, '')
    const parsed: GoodsReceiptLineImportRow = {
      rowNumber,
      itemCode: textValue(cell(row, 'Item Code')),
      altQty: quantityText,
      altUom: textValue(cell(row, 'Alt UoM')),
      warehouse: textValue(cell(row, 'Warehouse')),
      supplierBatchNumber: textValue(cell(row, 'Supplier Batch Number')),
      manufacturingDate: dateValue(cell(row, 'Manufacturing Date')),
      expiryDate: dateValue(cell(row, 'Expiry Date')),
      batchNumber: textValue(cell(row, 'Batch Number')),
    }

    if (!parsed.itemCode) issues.push(`Row ${rowNumber}: Item Code is required.`)
    const quantity = Number(parsed.altQty)
    if (!parsed.altQty || !Number.isFinite(quantity) || quantity <= 0) {
      issues.push(`Row ${rowNumber}: Alt Qty must be a number greater than zero.`)
    }
    if (parsed.manufacturingDate && !isValidDate(parsed.manufacturingDate)) {
      issues.push(`Row ${rowNumber}: Manufacturing Date must use YYYY-MM-DD or M/D/YYYY.`)
    }
    if (parsed.expiryDate && !isValidDate(parsed.expiryDate)) {
      issues.push(`Row ${rowNumber}: Expiry Date must use YYYY-MM-DD or M/D/YYYY.`)
    }

    return [parsed]
  })

  if (rows.length === 0 && issues.length === 0) {
    issues.push('The Item Lines worksheet has no data rows.')
  }

  return { rows, issues }
}
