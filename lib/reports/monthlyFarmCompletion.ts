import { MONTH_NAMES, type MonthlyFarmCompletionReport } from '@/lib/data/repositories/monthlyFarmCompletion.shared'
import type { ReportSheet } from './exportWorkbook'

function cellValue(report: MonthlyFarmCompletionReport, rowIndex: number, monthIndex: number) {
  const cell = report.rows[rowIndex]?.months.find(item => item.month === monthIndex + 1)
  if (!cell || cell.future) return ''
  return cell.percentage == null ? 'N/A' : `${cell.percentage}%`
}

export function monthlyFarmCompletionReportSheets(report: MonthlyFarmCompletionReport, context: string): ReportSheet[] {
  return [{
    name: 'Monthly Completion',
    headerRows: [0, 4],
    rows: [
      ['Monthly Farm Completion Report'],
      ['Filters', context],
      ['Generated at', report.generatedAt],
      [],
      ['Farm', ...MONTH_NAMES],
      ...report.rows.map((row, rowIndex) => [
        row.name || row.code,
        ...MONTH_NAMES.map((_, monthIndex) => cellValue(report, rowIndex, monthIndex)),
      ]),
    ],
  }]
}
