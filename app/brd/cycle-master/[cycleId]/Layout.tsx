'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Printer,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'

import { decryptData } from '@/app/utils/supabase/url-encryption'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermission } from '@/hooks/usePermission'
import Breadcrumb from '@/lib/Breadcrumb'
import {
  getBroilerCycleReport,
  type BroilerCycleBuilding,
  type BroilerCycleReport,
  type BroilerCycleStage,
  type CycleMovementRecord,
} from '@/lib/data/repositories/broilerCycleReport'
import { cn } from '@/lib/utils'

const STAGES: BroilerCycleStage[] = ['placement', 'growing', 'delivery', 'cleanup']
const STAGE_META: Record<BroilerCycleStage, { label: string; shortLabel: string }> = {
  placement: { label: 'DOC Placement', shortLabel: 'DOC Placement' },
  growing: { label: 'Growing & Farm Condition', shortLabel: 'Growing' },
  delivery: { label: 'Harvest & Delivery', shortLabel: 'Delivery' },
  cleanup: { label: 'Clean Up', shortLabel: 'Clean Up' },
}

function parseCycleId(value: string | string[] | undefined) {
  const token = Array.isArray(value) ? value[0] : value
  const payload = decryptData(token ? decodeURIComponent(token) : '')
  const rawId = Array.isArray(payload)
    ? payload[0]?.cycleId ?? payload[0]?.id ?? payload[0]
    : payload?.cycleId ?? payload?.id ?? payload
  const cycleId = Number(rawId ?? 0)
  return Number.isFinite(cycleId) && cycleId > 0 ? cycleId : null
}

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }).format(date)
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 3 })
}

function getStageRecords(building: BroilerCycleBuilding, stage: BroilerCycleStage) {
  if (stage === 'placement') return building.placements
  if (stage === 'growing') return building.growingLines
  if (stage === 'delivery') return building.deliveries
  return building.cleanups
}

function stageStatus(building: BroilerCycleBuilding, stage: BroilerCycleStage) {
  const rows = getStageRecords(building, stage)
  const activeRows = rows.filter(row => !row.isVoided)
  if (activeRows.length > 0) {
    if (stage === 'growing' && building.status === 'Saved') return { label: 'In Progress', tone: 'progress' as const }
    return { label: 'Completed', tone: 'completed' as const }
  }
  if (rows.length > 0) return { label: 'Voided', tone: 'voided' as const }
  return { label: 'Not Started', tone: 'pending' as const }
}

function StatusBadge({ label, tone }: ReturnType<typeof stageStatus>) {
  return <Badge variant="outline" className={cn(
    'h-5 whitespace-nowrap px-1.5 text-[11px] font-medium',
    tone === 'completed' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
    tone === 'progress' && 'border-amber-200 bg-amber-50 text-amber-700',
    tone === 'voided' && 'border-red-200 bg-red-50 text-red-700',
    tone === 'pending' && 'text-muted-foreground',
  )}>{label}</Badge>
}

function HeaderMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-md border bg-background px-2.5 py-1.5">
    <div className="text-[11px] leading-4 text-muted-foreground">{label}</div>
    <div className="font-medium tabular-nums text-foreground">{value}</div>
  </div>
}

function EmptyStage({ label }: { label: string }) {
  return <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
    No {label} records for this Building.
  </div>
}

function PlacementTable({ building }: { building: BroilerCycleBuilding }) {
  if (!building.placements.length) return <EmptyStage label="DOC Placement" />
  return <div className="overflow-x-auto rounded-md border">
    <Table className="min-w-[1320px] text-xs">
      <TableHeader><TableRow>
        <TableHead>Document No.</TableHead><TableHead>Status</TableHead><TableHead>Date Receive</TableHead>
        <TableHead>Time Receive</TableHead><TableHead>Production Date</TableHead><TableHead>Hatchery Ref</TableHead>
        <TableHead>Source</TableHead><TableHead>Item</TableHead><TableHead>Batch</TableHead>
        <TableHead className="text-right">Qty Received</TableHead><TableHead className="text-right">Actual</TableHead>
        <TableHead className="text-right">Short</TableHead><TableHead className="text-right">DOA</TableHead>
        <TableHead className="text-right">Reject</TableHead>
      </TableRow></TableHeader>
      <TableBody>{building.placements.map((row, index) => <TableRow key={`${row.id}-${row.itemCode}-${index}`} className={row.isVoided ? 'bg-muted/40 text-muted-foreground' : ''}>
        <TableCell className="font-medium">{row.documentNo || '-'}</TableCell>
        <TableCell>{row.isVoided ? <Badge variant="destructive">Voided</Badge> : <Badge variant="secondary">{row.status || 'Active'}</Badge>}</TableCell>
        <TableCell>{formatDate(row.receiveDate)}</TableCell><TableCell>{row.receiveTime || '-'}</TableCell>
        <TableCell>{formatDate(row.productionDate)}</TableCell><TableCell>{row.hatcheryReference || '-'}</TableCell>
        <TableCell>{row.vendor || '-'}</TableCell><TableCell>{[row.itemCode, row.itemName].filter(Boolean).join(' - ') || '-'}</TableCell>
        <TableCell>{row.batchNumber || '-'}</TableCell><TableCell className="text-right">{formatNumber(row.quantityReceived)}</TableCell>
        <TableCell className="text-right">{formatNumber(row.actualReceived)}</TableCell><TableCell className="text-right">{formatNumber(row.shortCount)}</TableCell>
        <TableCell className="text-right">{formatNumber(row.doaQuantity)}</TableCell><TableCell className="text-right">{formatNumber(row.rejectCount)}</TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </div>
}

function GrowingTable({ building }: { building: BroilerCycleBuilding }) {
  if (!building.growingLines.length) return <EmptyStage label="Growing & Farm Condition" />
  return <div className="overflow-auto rounded-md border">
    <table className="min-w-[1720px] border-collapse text-xs">
      <thead className="sticky top-0 z-10 bg-muted">
        <tr className="border-b">
          <th rowSpan={2} className="border-r px-2 py-2 text-center">Age</th>
          <th colSpan={3} className="border-r px-2 py-1 text-center">Mortality</th>
          <th colSpan={3} className="border-r px-2 py-1 text-center">Thinning</th>
          <th colSpan={2} className="border-r px-2 py-1 text-center">Batch</th>
          <th colSpan={4} className="border-r px-2 py-1 text-center">Feeds Consumption</th>
          <th colSpan={3} className="border-r px-2 py-1 text-center">Water Intake</th>
          <th colSpan={2} className="border-r px-2 py-1 text-center">Average Live Weight</th>
          <th colSpan={2} className="px-2 py-1 text-center">Average Daily Gain</th>
        </tr>
        <tr className="border-b [&>th]:whitespace-nowrap [&>th]:border-r [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium">
          <th>AM</th><th>PM</th><th>Total</th><th>AM</th><th>PM</th><th>Total</th>
          <th>DOC Batch</th><th>Cumulative</th><th>Actual FC</th><th>Feed Type</th><th>Standard FC</th><th>Feeds Batch</th>
          <th>Daily L/Flock</th><th>Daily per Bird</th><th>Guideline</th><th>Actual ALW</th><th>Standard ALW</th>
          <th>Actual ADG</th><th>Standard ADG</th>
        </tr>
      </thead>
      <tbody>{building.growingLines.map(row => <tr key={row.id} className={cn('border-b last:border-0 [&>td]:border-r [&>td]:px-2 [&>td]:py-1.5 [&>td]:text-right', row.age % 5 === 4 && 'bg-muted/35', row.isVoided && 'text-muted-foreground line-through')}>
        <td className="sticky left-0 bg-card text-center font-semibold">{row.age}</td>
        <td>{formatNumber(row.mortalityAm)}</td><td>{formatNumber(row.mortalityPm)}</td><td className="font-medium">{formatNumber(row.mortalityTotal)}</td>
        <td>{formatNumber(row.thinningAm)}</td><td>{formatNumber(row.thinningPm)}</td><td className="font-medium">{formatNumber(row.thinningTotal)}</td>
        <td className="max-w-40 text-left">{row.docBatch || '-'}</td><td>{formatNumber(row.cumulative)}</td>
        <td>{formatNumber(row.feedActual)}</td><td className="text-left">{row.feedType || '-'}</td><td>{formatNumber(row.feedStandard)}</td><td className="text-left">{row.feedBatch || '-'}</td>
        <td>{formatNumber(row.waterLiters)}</td><td>{formatNumber(row.waterPerBird)}</td><td>{formatNumber(row.waterGuideline)}</td>
        <td>{formatNumber(row.actualWeight)}</td><td>{formatNumber(row.standardWeight)}</td><td>{formatNumber(row.actualAdg)}</td><td>{formatNumber(row.standardAdg)}</td>
      </tr>)}</tbody>
    </table>
  </div>
}

function MovementTable({ label, rows, cleanup = false }: { label: string; rows: CycleMovementRecord[]; cleanup?: boolean }) {
  if (!rows.length) return <EmptyStage label={label} />
  return <div className="overflow-x-auto rounded-md border"><Table className="min-w-[1050px] text-xs">
    <TableHeader><TableRow>
      <TableHead>Document No.</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Item</TableHead>
      <TableHead>Batch</TableHead><TableHead className="text-right">Quantity</TableHead>
      {cleanup ? <TableHead className="text-right">Variance</TableHead> : null}<TableHead>UoM</TableHead><TableHead>Remarks</TableHead>
    </TableRow></TableHeader>
    <TableBody>{rows.map(row => <TableRow key={row.id} className={row.isVoided ? 'bg-muted/40 text-muted-foreground' : ''}>
      <TableCell className="font-medium">{row.documentNo || '-'}</TableCell>
      <TableCell>{row.isVoided ? <Badge variant="destructive">Voided</Badge> : <Badge variant="secondary">{row.status}</Badge>}</TableCell>
      <TableCell>{formatDate(row.date)}</TableCell><TableCell>{[row.itemCode, row.itemName].filter(Boolean).join(' - ') || '-'}</TableCell>
      <TableCell>{row.batchNumber || '-'}</TableCell><TableCell className="text-right">{formatNumber(row.quantity)}</TableCell>
      {cleanup ? <TableCell className="text-right">{formatNumber(row.varianceQuantity)}</TableCell> : null}
      <TableCell>{row.uom || '-'}</TableCell><TableCell>{row.lineRemarks || row.remarks || '-'}</TableCell>
    </TableRow>)}</TableBody>
  </Table></div>
}

function rowsForExport(report: BroilerCycleReport, stage: BroilerCycleStage) {
  const rows: Array<Array<string | number>> = []
  for (const building of report.buildings) {
    const buildingLabel = building.buildingName || building.buildingCode
    if (stage === 'placement') building.placements.forEach(row => rows.push([
      buildingLabel, building.cardNo, row.documentNo, row.status, row.receiveDate, row.receiveTime, row.productionDate,
      row.hatcheryReference, row.vendor, row.itemCode, row.itemName, row.batchNumber, row.quantityReceived,
      row.actualReceived, row.shortCount, row.doaQuantity, row.rejectCount, row.isVoided ? 'Voided' : 'Active',
    ]))
    if (stage === 'growing') building.growingLines.forEach(row => rows.push([
      buildingLabel, building.cardNo, building.growingNumber, row.age, row.mortalityAm, row.mortalityPm,
      row.mortalityTotal, row.thinningAm, row.thinningPm, row.thinningTotal, row.docBatch, row.cumulative,
      row.feedActual, row.feedType, row.feedStandard, row.feedBatch, row.waterLiters, row.waterPerBird,
      row.waterGuideline, row.actualWeight, row.standardWeight, row.actualAdg, row.standardAdg,
    ]))
    const movementRows = stage === 'delivery' ? building.deliveries : stage === 'cleanup' ? building.cleanups : []
    movementRows.forEach(row => rows.push([
      buildingLabel, building.cardNo, row.documentNo, row.status, row.date, row.itemCode, row.itemName,
      row.batchNumber, row.quantity, row.varianceQuantity, row.uom, row.lineRemarks || row.remarks,
      row.isVoided ? 'Voided' : 'Active',
    ]))
  }
  return rows
}

const EXPORT_HEADERS: Record<BroilerCycleStage, string[]> = {
  placement: ['Building', 'Flock Card', 'Document No.', 'Status', 'Receive Date', 'Receive Time', 'Production Date', 'Hatchery Ref', 'Source', 'Item Code', 'Item Name', 'Batch', 'Qty Received', 'Actual Received', 'Short', 'DOA', 'Reject', 'Record State'],
  growing: ['Building', 'Flock Card', 'Growing No.', 'Age', 'Mort AM', 'Mort PM', 'Mort Total', 'Thin AM', 'Thin PM', 'Thin Total', 'DOC Batch', 'Cumulative', 'Actual FC', 'Feed Type', 'Standard FC', 'Feeds Batch', 'Water L/Flock', 'Water per Bird', 'Water Guideline', 'Actual ALW', 'Standard ALW', 'Actual ADG', 'Standard ADG'],
  delivery: ['Building', 'Flock Card', 'Document No.', 'Status', 'Date', 'Item Code', 'Item Name', 'Batch', 'Quantity', 'Variance', 'UoM', 'Remarks', 'Record State'],
  cleanup: ['Building', 'Flock Card', 'Document No.', 'Status', 'Date', 'Item Code', 'Item Name', 'Batch', 'Quantity', 'Variance', 'UoM', 'Remarks', 'Record State'],
}

export default function CycleReportLayout() {
  const params = useParams<{ cycleId: string }>()
  const cycleId = useMemo(() => parseCycleId(params.cycleId), [params.cycleId])
  const viewBlocked = usePermission('/brd/cycle-master/report/view')
  const [report, setReport] = useState<BroilerCycleReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [selectedStage, setSelectedStage] = useState<BroilerCycleStage>('placement')
  const [workspaceMaximized, setWorkspaceMaximized] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!cycleId || viewBlocked) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await getBroilerCycleReport(cycleId)
      setReport(result)
      setSelectedBuildingId(current => result?.buildings.some(row => row.flockCardId === current)
        ? current
        : result?.buildings[0]?.flockCardId ?? null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load Cycle report.')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [cycleId, viewBlocked])

  useEffect(() => { void load() }, [load])

  const building = report?.buildings.find(row => row.flockCardId === selectedBuildingId) ?? report?.buildings[0] ?? null

  async function exportExcel() {
    if (!report) return
    setExporting(true)
    try {
      const rows: Array<Array<string | number>> = [
        ['Cycle Master Report'],
        ['Farm', report.farmName || report.farmCode],
        ['Cycle Count', report.cycleNumber],
        ['Status', report.status],
        ['Created', formatDate(report.createdAt)],
        ['Closed', formatDate(report.closedAt)],
        [],
        ['Building', 'Flock Card', 'Breed', 'Placement Date', 'Status'],
        ...report.buildings.map(row => [row.buildingName || row.buildingCode, row.cardNo, row.breed, row.startDate, row.status]),
      ]

      for (const stage of STAGES) {
        rows.push([], [STAGE_META[stage].label], EXPORT_HEADERS[stage], ...rowsForExport(report, stage))
      }

      const content = rows
        .map(row => row.map(cell => String(cell ?? '').replace(/\r?\n|\t/g, ' ')).join('\t'))
        .join('\n')
      const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cycle-${report.cycleNumber}-report.xls`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('Cycle report exported to Excel.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export Cycle report.')
    } finally {
      setExporting(false)
    }
  }

  if (viewBlocked) return <main className="p-4"><div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
    <div className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" />You do not have permission to view the Cycle Report.</div>
  </div></main>

  if (!cycleId) return <main className="p-4"><div className="rounded-md border p-6 text-center text-sm text-muted-foreground">The encrypted Cycle reference is invalid.</div></main>

  return <main className="min-h-[calc(100vh-4rem)] space-y-4 p-3 sm:p-4 print:p-0">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Breadcrumb FirstPreviewsPageName="Cycle Master" FirstPreviewsPageLink="/brd/cycle-master" CurrentPageName="Cycle Report" />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => history.back()}><ArrowLeft className="size-4" />Back</Button>
        <Button type="button" size="sm" variant="outline" disabled={!report} onClick={() => window.print()}><Printer className="size-4" />Print</Button>
        <Button type="button" size="sm" variant="outline" disabled={!report || exporting} onClick={() => void exportExcel()}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Excel
        </Button>
      </div>
    </div>

    {loading ? <Card><CardContent className="flex h-72 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></CardContent></Card>
      : !report ? <Card><CardContent className="flex h-56 items-center justify-center text-sm text-muted-foreground">Cycle not found or unavailable.</CardContent></Card>
        : <>
          <section className="rounded-lg border bg-card p-3 shadow-sm print:shadow-none">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
              <div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cycle Master Report</div>
                <h1 className="text-xl font-semibold">Cycle {report.cycleNumber}</h1>
                <p className="text-sm text-muted-foreground">DOC Placement through Clean Up</p></div>
              <Badge variant={report.status === 'Saved' ? 'default' : 'secondary'}>{report.status === 'Saved' ? 'Active' : report.status}</Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <HeaderMetric label="Farm" value={report.farmName || report.farmCode || '-'} />
              <HeaderMetric label="Cycle Count" value={report.cycleNumber} />
              <HeaderMetric label="Participating Buildings" value={report.buildings.length} />
              <HeaderMetric label="Created" value={formatDate(report.createdAt)} />
              <HeaderMetric label="Closed" value={formatDate(report.closedAt)} />
            </div>
            {report.buildings.length > 0 ? <div className="mt-3 flex gap-2 overflow-x-auto pb-1 print:hidden">
              {report.buildings.map(row => <Button key={row.flockCardId} type="button" size="sm" variant={row.flockCardId === building?.flockCardId ? 'default' : 'outline'} className="shrink-0" onClick={() => setSelectedBuildingId(row.flockCardId)}>
                {row.buildingName || row.buildingCode || row.cardNo}
              </Button>)}
            </div> : null}
          </section>

          {!building ? <Card><CardContent className="flex h-48 items-center justify-center text-sm text-muted-foreground">No participating Buildings were found for this cycle.</CardContent></Card>
            : <Card className="gap-0 overflow-hidden py-0 print:border-0 print:shadow-none">
              <div className={cn('grid min-w-0 print:block', workspaceMaximized ? 'grid-cols-[64px_minmax(0,1fr)]' : 'md:grid-cols-[190px_minmax(0,1fr)]')}>
                <aside className="border-b bg-muted/30 p-2 md:min-h-[430px] md:border-r md:border-b-0 print:hidden">
                  <div className={cn('flex items-center pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground', workspaceMaximized ? 'justify-end' : 'justify-between px-2')}>
                    {!workspaceMaximized ? <span>Process Steps</span> : null}
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => setWorkspaceMaximized(current => !current)} aria-label={workspaceMaximized ? 'Restore wizard layout' : 'Maximize process workspace'}>
                      {workspaceMaximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                    </Button>
                  </div>
                  <nav className={cn('grid gap-1', !workspaceMaximized && 'sm:grid-cols-2 md:grid-cols-1')}>
                    {STAGES.map((stage, index) => {
                      const status = stageStatus(building, stage)
                      const active = selectedStage === stage
                      return <Button key={stage} type="button" variant={active ? 'default' : 'ghost'} onClick={() => setSelectedStage(stage)} title={`${STAGE_META[stage].label} - ${status.label}`} className={cn('h-10 w-full gap-2 px-2', workspaceMaximized ? 'justify-center' : 'justify-start')}>
                        {workspaceMaximized ? <span className="font-semibold">{index + 1}</span> : <><span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]', active && 'border-primary-foreground/50')}>{status.tone === 'completed' ? <Check className="size-4" /> : index + 1}</span>
                          <span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium leading-4">{STAGE_META[stage].shortLabel}</span><span className="block text-[10px] leading-3 opacity-70">{status.label}</span></span></>}
                      </Button>
                    })}
                  </nav>
                </aside>

                <div className="min-w-0">
                  <div className="border-b bg-card p-3">
                    <div className="flex flex-col justify-between gap-2 lg:flex-row lg:items-start">
                      <div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Building</div><div className="text-lg font-semibold">{building.buildingName || building.buildingCode || '-'}</div></div>
                      <StatusBadge {...stageStatus(building, selectedStage)} />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <HeaderMetric label="Flock Card" value={building.cardNo || '-'} />
                      <HeaderMetric label="Flock Code" value={building.flockCode || '-'} />
                      <HeaderMetric label="Placement Date" value={formatDate(building.startDate)} />
                      <HeaderMetric label="Breed" value={building.breed || '-'} />
                    </div>
                  </div>
                  <CardContent className="min-w-0 space-y-3 p-3">
                    <div><h2 className="font-semibold">{STAGE_META[selectedStage].label}</h2><p className="text-xs text-muted-foreground">Read-only historical records for the selected Building and cycle.</p></div>
                    {selectedStage === 'placement' ? <PlacementTable building={building} /> : null}
                    {selectedStage === 'growing' ? <GrowingTable building={building} /> : null}
                    {selectedStage === 'delivery' ? <MovementTable label="Harvest & Delivery" rows={building.deliveries} /> : null}
                    {selectedStage === 'cleanup' ? <MovementTable label="Clean Up" rows={building.cleanups} cleanup /> : null}
                  </CardContent>
                </div>
              </div>
            </Card>}
        </>}
  </main>
}
