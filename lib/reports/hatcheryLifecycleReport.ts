import { HATCHERY_LIFECYCLE_STAGES, type HatcheryLifecycleReport } from '@/lib/data/repositories/hatcheryLifecycleReport'
import type { ReportSheet } from './exportWorkbook'

const display = (value: unknown) => value == null || value === '' ? '' : String(value)

export function hatcheryLifecycleReportSheets(report: HatcheryLifecycleReport, context: string): ReportSheet[] {
  const summaryHeader = ['Island Group', 'Region', 'Farm Code', 'Farm', 'TA', ...HATCHERY_LIFECYCLE_STAGES.flatMap(stage => [`${stage} Documents`, `${stage} Quantity`])]
  const summaryRows = report.rows.map(row => [
    row.island, row.region, row.farmCode, row.farmName, row.taName,
    ...HATCHERY_LIFECYCLE_STAGES.flatMap(stage => [row.stages[stage]?.documentCount ?? 0, row.stages[stage]?.quantity ?? 0]),
  ])

  const detailRows = report.lifecycles.flatMap(lifecycle => lifecycle.nodes.map(node => [
    lifecycle.reportDate, lifecycle.documentNo, lifecycle.reference, lifecycle.reportStatus,
    report.catalog.farms.find(farm => farm.id === lifecycle.farmId)?.name ?? lifecycle.farmId,
    report.catalog.tas.find(ta => ta.id === lifecycle.taId)?.name ?? 'Unassigned / former TA',
    node.stage, node.documentNo, node.reference, node.occurredAt, node.status,
    node.quantity, node.uom, node.destinationFarmName,
  ]))

  const reviewRows = report.lifecycles.flatMap(lifecycle => lifecycle.needsReview.map(message => [
    lifecycle.reportDate, lifecycle.documentNo, lifecycle.reference,
    report.catalog.farms.find(farm => farm.id === lifecycle.farmId)?.name ?? lifecycle.farmId,
    report.catalog.tas.find(ta => ta.id === lifecycle.taId)?.name ?? 'Unassigned / former TA',
    message,
  ]))

  return [
    {
      name: 'Summary',
      rows: [
        ['Hatchery Lifecycle Report'],
        ['Filters', context],
        ['Generated at', display(report.generatedAt)],
        [],
        summaryHeader,
        ...summaryRows,
      ],
    },
    {
      name: 'Lifecycle Details',
      rows: [
        ['Receiving Date', 'Receiving Document', 'Receiving Reference', 'Receiving Status', 'Hatchery Farm', 'TA', 'Stage', 'Stage Document', 'Stage Reference', 'Stage Date', 'Stage Status', 'Quantity', 'UoM', 'Destination Farm'],
        ...detailRows,
      ],
    },
    {
      name: 'Needs Review',
      rows: [
        ['Receiving Date', 'Receiving Document', 'Receiving Reference', 'Hatchery Farm', 'TA', 'Issue'],
        ...reviewRows,
      ],
    },
  ]
}
