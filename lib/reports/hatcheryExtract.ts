import type { HatcheryExtractData, HatcheryExtractRow } from '@/lib/data/repositories/hatcheryExtract'
import type { ReportSheet } from './exportWorkbook'

function columnsFor(rows: HatcheryExtractRow[]) {
  const columns: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    }
  }
  return columns
}

function display(value: unknown): string | number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return JSON.stringify(value)
}

function tableRows(rows: HatcheryExtractRow[]) {
  const columns = columnsFor(rows)
  if (!columns.length) return { columns: ['No records in selected creation-date range'], rows: [] as (string | number | null)[][] }
  return {
    columns,
    rows: rows.map(row => columns.map(column => display(row[column]))),
  }
}

export function hatcheryExtractSheets(data: HatcheryExtractData): ReportSheet[] {
  return data.modules.map(moduleData => {
    const header = tableRows(moduleData.headerRows)
    const rows: (string | number | null)[][] = [
      [`Header (${moduleData.headerTable})`],
      header.columns,
      ...header.rows,
    ]
    const headerRows = [0, 1]
    const sectionRows = [0]

    if (moduleData.lineTable) {
      const lines = tableRows(moduleData.lineRows)
      const sectionRow = rows.length + 1
      rows.push([], [`Line Items (${moduleData.lineTable})`], lines.columns, ...lines.rows)
      sectionRows.push(sectionRow)
      headerRows.push(sectionRow, sectionRow + 1)
    }

    return { name: moduleData.label, rows, headerRows, sectionRows }
  })
}
