import { COMPLIANCE_STAGES, COMPLIANCE_LABELS, COMPLIANCE_RULE, COMPLIANCE_HISTORY_NOTE, complianceSummary, dataAccuracyBy, farmDataScorecards, groupCompliance, manilaToday, taMonthlyCompliance, type ComplianceRow } from '@/lib/broiler/dataCompliance'
import type { ReportSheet } from './exportWorkbook'

export function complianceReportSheets(rows: ComplianceRow[], context: string, generatedAt: string, asOf = manilaToday(new Date(generatedAt))): ReportSheet[] {
  const summary = complianceSummary(rows)
  const accuracy = dataAccuracyBy(rows, 'island')
  const farmScores = farmDataScorecards(rows)
  const taScores = taMonthlyCompliance(rows, asOf)
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
    { name: 'Island Accuracy', rows: [
      ['Island', 'Building-cycles', 'Placement (%)', 'Growing (%)', 'Harvest (%)', 'Cleanup (%)', 'Overall updated (%)'],
      ...accuracy.map(row => [row.label, row.total, row.placement, row.growing, row.harvest, row.cleanup, row.overallUpdated]),
    ] },
    { name: 'Farm Scorecard', rows: [
      ['Farm', 'Island', 'Accuracy (%)', 'Current stage', 'Latest data', 'Update status'],
      ...farmScores.map(row => [row.label, row.island, row.overallUpdated, row.currentStage, row.latestData, row.updateStatus]),
    ] },
    { name: 'TA Monthly KPI', rows: [
      ['TA', 'Required updates', 'On-time updates', 'Compliance (%)', 'KPI status', 'Target'],
      ...taScores.map(row => [row.label, row.requiredUpdates, row.onTimeUpdates, row.compliance, row.kpiStatus, '>=95% monthly']),
    ] },
    ...(['region', 'farm', 'ta'] as const).map(by => ({ name: `${by === 'ta' ? 'TA' : by === 'farm' ? 'Farm' : 'Region'} Summary`, rows: [
      [by, 'Total building-cycles', 'Assessed', 'Updated', 'Overdue', 'Needs review', 'Not yet due', 'Compliance (%)', 'Longest delay (days)'],
      ...groupCompliance(rows, by).map(row => [row.label, row.total, row.due, row.updated, row.overdue, row.review, row.notDue, row.compliance, row.longestDelay]),
    ] })),
    { name: 'Building Details', rows: [
      ['Island', 'Region', 'Farm', 'Building', 'Cycle', 'Assigned TA', 'Status', 'Days late', ...COMPLIANCE_STAGES.flatMap(stage => [`${stage}: latest activity date`, `${stage}: latest saved timestamp`, `${stage}: status`, `${stage}: missing dates`, `${stage}: notes`])],
      ...rows.map(row => [row.island, row.region, row.farmName, row.buildingName, row.cycleLabel, row.ta || 'Unassigned', COMPLIANCE_LABELS[row.status], row.daysLate,
        ...COMPLIANCE_STAGES.flatMap(stage => [row.stages[stage].latestDate, row.stages[stage].latestSavedAt, COMPLIANCE_LABELS[row.stages[stage].status], row.stages[stage].missingDates.join(', '), row.stages[stage].note])]),
    ] },
  ]
}
