export type ReportSheet = {
  name: string
  rows: (string | number | null)[][]
  headerRows?: number[]
  sectionRows?: number[]
}

/** Write real XLSX cells; user text remains text, including leading '='. */
export async function exportReportWorkbook(sheets: ReportSheet[], fileName: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(sheets.map(sheet => ({
    sheet: sheet.name,
    data: sheet.rows.map((row, index) => {
      const isHeader = sheet.headerRows?.includes(index) ?? index === 0
      const isSection = sheet.sectionRows?.includes(index) ?? false
      return row.map(value => ({
        value: value ?? '',
        fontWeight: isHeader ? 'bold' as const : undefined,
        backgroundColor: isSection ? '#EAF4EE' : undefined,
        wrap: true,
      }))
    }),
    columns: Array.from({ length: Math.max(1, ...sheet.rows.map(row => row.length)) }, () => ({ width: 24 })),
  }))).toFile(fileName)
}
