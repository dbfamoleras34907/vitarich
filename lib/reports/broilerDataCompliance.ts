import { COMPLIANCE_STAGES, COMPLIANCE_LABELS, COMPLIANCE_RULE, COMPLIANCE_HISTORY_NOTE, complianceSummary, groupCompliance, type ComplianceRow } from '@/lib/broiler/dataCompliance'
import type { ReportSheet } from './exportWorkbook'

export function complianceReportSheets(rows: ComplianceRow[], context: string, generatedAt: string): ReportSheet[] {
  const summary = complianceSummary(rows)
  return [
    { name: 'Summary', rows: [
      ['Broiler Data Compliance'], ['Filters', context], ['Generated at', generatedAt],
      ['Rules', COMPLIANCE_RULE], ['History', COMPLIANCE_HISTORY_NOTE],
      ['Counting unit', 'Building-cycle records; a building can appear in multiple cycles.'],
      ['Assignment source', 'Active farm associations to User accounts (type 3); Admin and Super Admin excluded. Shared farms count once in overall KPIs and once for each associated TA in TA summaries.'],
      ['Update Compliance (%)', summary.compliance], ['Building-cycles assessed', summary.due],
      ['Updated', summary.updated], ['Overdue', summary.overdue], ['Needs review', summary.review],
      ['Not yet due', summary.notDue], ['Farms with delays', summary.farmsWithDelays],
      ['TAs with overdue updates', summary.tasWithDelays], ['Unassigned building-cycles', summary.unassigned], ['Longest delay (days)', summary.longestDelay],
    ] },
    ...(['region', 'farm', 'ta'] as const).map(by => ({ name: `${by === 'ta' ? 'TA' : by === 'farm' ? 'Farm' : 'Region'} Summary`, rows: [
      [by, 'Total building-cycles', 'Assessed', 'Updated', 'Overdue', 'Needs review', 'Not yet due', 'Compliance (%)', 'Longest delay (days)'],
      ...groupCompliance(rows, by).map(row => [row.label, row.total, row.due, row.updated, row.overdue, row.review, row.notDue, row.compliance, row.longestDelay]),
    ] })),
    { name: 'Building Details', rows: [
      ['Region', 'Farm', 'Building', 'Cycle', 'Assigned TA', 'Status', 'Days late', ...COMPLIANCE_STAGES.flatMap(stage => [`${stage}: latest activity date`, `${stage}: latest saved timestamp`, `${stage}: status`, `${stage}: missing dates`, `${stage}: notes`])],
      ...rows.map(row => [row.region, row.farmName, row.buildingName, row.cycleLabel, row.ta || 'Unassigned', COMPLIANCE_LABELS[row.status], row.daysLate,
        ...COMPLIANCE_STAGES.flatMap(stage => [row.stages[stage].latestDate, row.stages[stage].latestSavedAt, COMPLIANCE_LABELS[row.stages[stage].status], row.stages[stage].missingDates.join(', '), row.stages[stage].note])]),
    ] },
  ]
}
