'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { DashboardCycleBuilding } from '@/lib/data/repositories/broilerCycleDashboard'
import { activeGrowingLines, goodBirdPlacements, growingWaterLiters, movementQuantity } from '@/lib/broiler/cycleDashboard'
import { usePermission } from '@/hooks/usePermission'

export type DetailTab = 'overview' | 'placement' | 'growing' | 'feed' | 'delivery' | 'cleanup'
export const detailTabs: { key: DetailTab; label: string }[] = [
  { key: 'overview', label: 'Dashboard' }, { key: 'placement', label: 'Placement' },
  { key: 'growing', label: 'Growing' }, { key: 'feed', label: 'Feed' },
  { key: 'delivery', label: 'Delivery' }, { key: 'cleanup', label: 'Clean-up' },
]

export const formatNumber = (value: number | null | undefined, digits = 2) => value == null ? '—'
  : value.toLocaleString('en-PH', { maximumFractionDigits: digits })
export const formatDate = (value: string) => value ? value.slice(0, 10) : '—'

function DocumentLink({ href, children, blocked }: { href: string; children: ReactNode; blocked: boolean }) {
  return blocked ? <>{children}</> : <Link href={href} className="text-primary underline underline-offset-2">{children}</Link>
}

export default function TransactionDetails({ tab, cycles }: { tab: Exclude<DetailTab, 'overview'>; cycles: DashboardCycleBuilding[] }) {
  const placementBlocked = usePermission('/inv/doc-receiving/view')
  const growingBlocked = usePermission('/brd/fc/view')
  const reportBlocked = usePermission('/brd/fc/report/view')
  const deliveryBlocked = usePermission('/brd/dr/view')
  const cleanupBlocked = usePermission('/brd/cu/view')
  const headers: Record<typeof tab, string[]> = {
    placement: ['Building', 'Cycle', 'Document', 'Placement date', 'Hatch date', 'Source', 'Item', 'Batch', 'Received', 'Actual', 'DOA', 'Reject', 'Short'],
    growing: ['Building', 'Cycle', 'Growing', 'Age', 'Mortality', 'Thinning', 'Water (L)', 'Body weight (g)', 'Standard (g)'],
    feed: ['Building', 'Cycle', 'Growing', 'Age', 'Feed type', 'Batch', 'Consumed (kg)', 'Standard (g/bird/day)'],
    delivery: ['Building', 'Cycle', 'Document', 'Date', 'Item', 'Batch', 'Quantity', 'UoM', 'Heads', 'Recorded kg'],
    cleanup: ['Building', 'Cycle', 'Document', 'Date', 'Item', 'Batch', 'Quantity', 'UoM', 'Variance', 'Remarks'],
  }
  const rawRows: { key: string; cells: ReactNode[] }[] = cycles.flatMap(building => {
    const prefix = [building.buildingName || building.buildingCode, building.cycleNumber]
    const growingLink = <DocumentLink href={`/brd/fc/report?cardNo=${encodeURIComponent(building.cardNo)}`} blocked={growingBlocked && reportBlocked}>{building.growingNumber || building.cardNo}</DocumentLink>
    if (tab === 'placement') return goodBirdPlacements(building.placements).map((row, index) => ({
      key: `${building.flockCardId}-${row.id}-${index}`, cells: [...prefix,
        <DocumentLink key="doc" href={`/inv/doc-receiving/post?id=${row.documentId}`} blocked={placementBlocked}>{row.documentNo}</DocumentLink>,
        formatDate(row.receiveDate), formatDate(row.productionDate), row.vendor || '—',
        [row.itemCode, row.itemName].filter(Boolean).join(' · '), row.batchNumber || '—',
        formatNumber(row.quantityReceived), formatNumber(row.actualReceived), formatNumber(row.doaQuantity), formatNumber(row.rejectCount), formatNumber(row.shortCount),
      ],
    }))
    if (tab === 'growing' || tab === 'feed') return activeGrowingLines(building)
      .filter(row => tab !== 'feed' || row.hasFeed)
      .map(row => ({ key: `${building.flockCardId}-${row.id}`, cells: tab === 'growing' ? [...prefix, growingLink, row.age,
        formatNumber(row.hasMortality ? row.mortalityTotal || row.mortalityAm + row.mortalityPm : null),
        formatNumber(row.hasMortality ? row.thinningAm + row.thinningPm : null),
        formatNumber(growingWaterLiters(row, building.startingPopulation)), formatNumber(row.hasWeight ? row.actualWeight : null),
        formatNumber(row.standardWeight || null),
      ] : [...prefix, growingLink, row.age, row.feedType || '—', row.feedBatch || '—', formatNumber(row.feedActual), formatNumber(row.feedStandard || null)] }))
    return (tab === 'delivery' ? building.deliveries : building.cleanups).map(row => ({
      key: `${tab}-${row.id}`, cells: [...prefix,
        <DocumentLink key="doc" href={`/brd/${tab === 'delivery' ? 'dr' : 'cu'}/post?id=${row.documentId}`} blocked={tab === 'delivery' ? deliveryBlocked : cleanupBlocked}>{row.documentNo}</DocumentLink>,
        formatDate(row.date), [row.itemCode, row.itemName].filter(Boolean).join(' · '), row.batchNumber || '—', formatNumber(row.quantity), row.uom,
        ...(tab === 'delivery' ? [formatNumber(movementQuantity(row, 'heads')), formatNumber(movementQuantity(row, 'kg'))]
          : [formatNumber(row.varianceQuantity), row.lineRemarks || row.remarks || '—']),
      ],
    }))
  })
  const rows = [...new Map(rawRows.map(row => [row.key, row])).values()]
  return <section className="min-w-0 rounded-lg border border-stone-200 bg-card dark:border-border">
    <div className="border-b p-3"><h2 className="text-sm font-semibold">{detailTabs.find(item => item.key === tab)?.label} Details</h2>
      <p className="mt-1 text-[11px] text-muted-foreground">{rows.length} record{rows.length === 1 ? '' : 's'} · Selected cycle · Posted, non-void entries</p></div>
    {!rows.length ? <p className="p-10 text-center text-sm text-muted-foreground">No posted {tab === 'cleanup' ? 'clean-up' : tab} records for this cycle.</p> :
      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full border-collapse whitespace-nowrap text-xs">
          <thead className="sticky top-0 bg-muted"><tr>{headers[tab].map(header => <th key={header} className="border-b px-3 py-2 text-left font-medium">{header}</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.key} className="border-b last:border-0 hover:bg-muted/40">{row.cells.map((cell, index) => <td key={index} className="px-3 py-2 tabular-nums group-data-[compact=true]/dashboard:px-2 group-data-[compact=true]/dashboard:py-1">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>}
  </section>
}
