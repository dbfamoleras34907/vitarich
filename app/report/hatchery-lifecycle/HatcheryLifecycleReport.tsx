'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, RefreshCw, Search, TriangleAlert, Users } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import SearchableCombobox, { type ComboboxItemType } from '@/components/SearchableCombobox'
import { Button } from '@/components/ui/button'
import DynamicTable, { type Column } from '@/components/ui/DataTableV2'
import { CompactMetric, PageHeader, PageHeaderActions, PageSection, PageSectionDescription, PageSectionHeader, PageSectionTitle, PageShell } from '@/components/ui/page-layout'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermission } from '@/hooks/usePermission'
import {
  getHatcheryLifecycleReport,
  HATCHERY_LIFECYCLE_STAGES,
  type HatcheryLifecycle,
  type HatcheryLifecycleDateBasis,
  type HatcheryLifecycleReport as ReportData,
  type HatcheryLifecycleStatus,
  type HatcheryLifecycleSummaryRow,
} from '@/lib/data/repositories/hatcheryLifecycleReport'
import { hatcheryLifecycleReportSheets } from '@/lib/reports/hatcheryLifecycleReport'
import { exportReportWorkbook } from '@/lib/reports/exportWorkbook'
import { cn } from '@/lib/utils'

const ALL = '__all__'
const PAGE_SIZE = 25
const STATUS_ITEMS: ComboboxItemType[] = [
  { code: 'approved', name: 'Approved' },
  { code: 'pending', name: 'Pending' },
  { code: 'rejected', name: 'Rejected' },
  { code: 'voided', name: 'Voided' },
]

type Filters = {
  islands: string[]
  regions: string[]
  farms: string[]
  tas: string[]
  statuses: string[]
  dateBasis: HatcheryLifecycleDateBasis
  dateFrom: string
  dateTo: string
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))]
const selectedValues = (values: string[]) => values.includes(ALL) ? [] : values
const metric = (row: HatcheryLifecycleSummaryRow, stage: typeof HATCHERY_LIFECYCLE_STAGES[number]) => row.stages[stage] ?? { documentCount: 0, quantity: 0 }
const formatNumber = (value: number) => value.toLocaleString('en-PH', { maximumFractionDigits: 2 })
const displayDate = (value: string | null) => value ? new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: value.length === 10 ? undefined : 'short' }) : '—'
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Unable to load the Hatchery Lifecycle Report.'

function currentMonth() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const [year, month] = today.split('-').map(Number)
  return { from: `${today.slice(0, 7)}-01`, to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) }
}

function normalizeMultiple(current: string[], next: string[]) {
  if (!next.length) return [ALL]
  if (next.includes(ALL) && !current.includes(ALL)) return [ALL]
  const specific = next.filter(value => value !== ALL)
  return specific.length ? unique(specific) : [ALL]
}

function MultiFilter({ label, items, value, onChange, disabled = false }: { label: string; items: ComboboxItemType[]; value: string[]; onChange: (value: string[]) => void; disabled?: boolean }) {
  return <SearchableCombobox multiple label={label} items={[{ code: ALL, name: `All ${label}` }, ...items]} value={value}
    onValueChange={next => onChange(normalizeMultiple(value, next))} allowSelectAll={false} disabled={disabled}
    className="w-full" placeholder={`All ${label}`} wrapItemLabels />
}

type LifecycleDetailTableRow = Record<string, unknown> & {
  rowKey: string
  receivingDocument: string
  receivingReference: string
  receivingDate: string | null
  receivingStatus: string
  review: string
  stage: string
  document: string
  reference: string
  occurredAt: string | null
  status: string
  quantity: number | null
  uom: string
  destinationFarm: string
  voided: boolean
}

const lifecycleDetailColumns: Column<LifecycleDetailTableRow>[] = [
  {
    key: 'receivingDocument',
    label: 'Receiving',
    minWidth: 180,
    render: row => <span><span className="font-medium">{row.receivingDocument}</span><span className="ml-1 text-muted-foreground">· {row.receivingReference}</span></span>,
  },
  { key: 'receivingDate', label: 'Receiving Date', minWidth: 125, render: row => displayDate(row.receivingDate) },
  { key: 'stage', label: 'Stage', minWidth: 110 },
  { key: 'document', label: 'Document', minWidth: 130 },
  { key: 'reference', label: 'Reference', minWidth: 150 },
  { key: 'occurredAt', label: 'Stage Date', minWidth: 145, render: row => displayDate(row.occurredAt) },
  { key: 'status', label: 'Status', minWidth: 90 },
  {
    key: 'quantity',
    label: 'Quantity',
    align: 'right',
    minWidth: 100,
    render: row => row.quantity == null ? '—' : `${formatNumber(row.quantity)} ${row.uom}`.trim(),
  },
  { key: 'destinationFarm', label: 'Destination Farm', minWidth: 150 },
  {
    key: 'review',
    label: 'Review',
    minWidth: 120,
    render: row => row.review
      ? <span className="inline-flex items-center gap-1 font-medium text-destructive" title={row.review}><TriangleAlert className="size-3" />Needs Review</span>
      : '—',
  },
]

function lifecycleDetailRows(lifecycles: HatcheryLifecycle[]): LifecycleDetailTableRow[] {
  return lifecycles.flatMap(lifecycle => lifecycle.nodes.map(node => ({
    rowKey: `${lifecycle.receivingId}:${node.nodeKey}`,
    receivingDocument: lifecycle.documentNo,
    receivingReference: lifecycle.reference || 'No reference',
    receivingDate: lifecycle.reportDate,
    receivingStatus: lifecycle.reportStatus,
    review: lifecycle.needsReview.join(' · '),
    stage: node.stage,
    document: node.documentNo,
    reference: node.reference || '—',
    occurredAt: node.occurredAt,
    status: node.status || '—',
    quantity: node.quantity,
    uom: node.uom || '',
    destinationFarm: node.destinationFarmName || '—',
    voided: node.voided,
  })))
}

export default function HatcheryLifecycleReport() {
  const blocked = usePermission('/report/hatchery-lifecycle/view')
  const month = useMemo(currentMonth, [])
  const [filters, setFilters] = useState<Filters>({ islands: [ALL], regions: [ALL], farms: [ALL], tas: [ALL], statuses: ['approved'], dateBasis: 'created', dateFrom: month.from, dateTo: month.to })
  const [report, setReport] = useState<ReportData | null>(null)
  const [detailReport, setDetailReport] = useState<ReportData | null>(null)
  const [selectedRow, setSelectedRow] = useState<HatcheryLifecycleSummaryRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const printReport = useReactToPrint({ contentRef: reportRef, documentTitle: `Hatchery Lifecycle Report ${filters.dateFrom} to ${filters.dateTo}`, pageStyle: '@page { size: A3 landscape; margin: 8mm; } @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } tr { break-inside: avoid; } }' })

  const farms = useMemo(() => report?.catalog.farms ?? [], [report])
  const tas = useMemo(() => report?.catalog.tas ?? [], [report])
  const islandItems = useMemo(() => unique(farms.map(farm => farm.island)).sort().map(value => ({ code: value, name: value })), [farms])
  const visibleFarmsByIsland = useMemo(() => {
    const islands = selectedValues(filters.islands)
    return islands.length ? farms.filter(farm => islands.includes(farm.island)) : farms
  }, [farms, filters.islands])
  const regionItems = useMemo(() => unique(visibleFarmsByIsland.map(farm => farm.region)).sort().map(value => ({ code: value, name: value })), [visibleFarmsByIsland])
  const visibleFarmsByRegion = useMemo(() => {
    const regions = selectedValues(filters.regions)
    return regions.length ? visibleFarmsByIsland.filter(farm => regions.includes(farm.region)) : visibleFarmsByIsland
  }, [filters.regions, visibleFarmsByIsland])
  const farmItems = useMemo(() => visibleFarmsByRegion.map(farm => ({ code: String(farm.id), name: `${farm.code} - ${farm.name}` })), [visibleFarmsByRegion])
  const selectedFarmIds = useMemo(() => {
    const values = selectedValues(filters.farms)
    return values.length ? values.map(Number).filter(Boolean) : visibleFarmsByRegion.map(farm => farm.id)
  }, [filters.farms, visibleFarmsByRegion])
  const taItems = useMemo(() => {
    const allowed = new Set(selectedFarmIds)
    return [...new Map(tas.filter(ta => allowed.has(ta.farmId)).map(ta => [ta.id, { code: String(ta.id), name: ta.name }])).values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedFarmIds, tas])

  const buildParams = useCallback((page = 1, row?: HatcheryLifecycleSummaryRow | null) => ({
    farmIds: row ? [row.farmId] : selectedFarmIds,
    taIds: row ? [row.taId] : selectedValues(filters.tas).map(Number).filter(Boolean),
    dateFrom: filters.dateFrom, dateTo: filters.dateTo, dateBasis: filters.dateBasis,
    statuses: selectedValues(filters.statuses) as HatcheryLifecycleStatus[], page, pageSize: PAGE_SIZE,
  }), [filters.dateBasis, filters.dateFrom, filters.dateTo, filters.statuses, filters.tas, selectedFarmIds])

  const loadReport = useCallback(async (page = 1) => {
    if (blocked) return
    if (!filters.dateFrom || !filters.dateTo || filters.dateFrom > filters.dateTo) { toast.error('Enter a valid Date From and Date To range.'); return }
    if (!selectedFarmIds.length && report) { toast.error('The selected geographic scope has no accessible Hatchery farms.'); return }
    setLoading(true)
    try {
      const next = await getHatcheryLifecycleReport({ ...buildParams(page), farmIds: report ? selectedFarmIds : undefined })
      setReport(next); setSelectedRow(null); setDetailReport(null)
    } catch (error) { toast.error(errorText(error)) } finally { setLoading(false) }
  }, [blocked, buildParams, filters.dateFrom, filters.dateTo, report, selectedFarmIds])

  useEffect(() => { if (!blocked && !report && !loading) void loadReport(1) }, [blocked, loadReport, loading, report])

  const loadDetails = useCallback(async (row: HatcheryLifecycleSummaryRow, page = 1) => {
    setSelectedRow(row); setDetailLoading(true)
    try { setDetailReport(await getHatcheryLifecycleReport(buildParams(page, row))) }
    catch (error) { toast.error(errorText(error)) } finally { setDetailLoading(false) }
  }, [buildParams])

  const context = useMemo(() => `${filters.dateBasis === 'created' ? 'Created Date' : 'Receiving Date'} ${filters.dateFrom} to ${filters.dateTo}; ${selectedValues(filters.islands).join(', ') || 'All Island Groups'}; ${selectedValues(filters.regions).join(', ') || 'All Regions'}; ${selectedValues(filters.farms).length ? `${selectedValues(filters.farms).length} selected farm(s)` : 'All Farms'}; ${selectedValues(filters.tas).length ? `${selectedValues(filters.tas).length} selected TA(s)` : 'All TAs'}; ${selectedValues(filters.statuses).join(', ') || 'All Statuses'}`, [filters])
  const totalReceiving = report?.rows.reduce((sum, row) => sum + metric(row, 'Receiving').documentCount, 0) ?? 0
  const totalDispatch = report?.rows.reduce((sum, row) => sum + metric(row, 'Dispatch').documentCount, 0) ?? 0
  const totalReview = (detailReport ?? report)?.lifecycles.filter(item => item.needsReview.length > 0).length ?? 0
  const detailData = detailReport ?? report
  const detailRows = useMemo(() => lifecycleDetailRows(detailData?.lifecycles ?? []), [detailData])

  async function exportExcel() {
    if (!report) return
    setExporting(true)
    try {
      const pages = Math.max(1, Math.ceil(report.pagination.total / 100))
      const batches: ReportData[] = []
      for (let page = 1; page <= pages; page += 1) batches.push(await getHatcheryLifecycleReport({ ...buildParams(page), pageSize: 100 }))
      const full = { ...report, lifecycles: batches.flatMap(item => item.lifecycles) }
      await exportReportWorkbook(hatcheryLifecycleReportSheets(full, context), `hatchery-lifecycle-${filters.dateFrom}-to-${filters.dateTo}.xlsx`)
    } catch (error) { toast.error(errorText(error)) } finally { setExporting(false) }
  }

  if (blocked) return <main className="p-4 text-sm" role="alert">You do not have permission to view the Hatchery Lifecycle Report.</main>

  return <PageShell className="print:p-0" ref={reportRef}>
    <PageHeader className="print:hidden">
      <div><h1 className="text-xl font-semibold tracking-tight">Hatchery Lifecycle Report</h1><p className="mt-0.5 text-xs text-muted-foreground">Trace assigned TA activity from Receiving through Dispatch and Disposal by Hatchery origin farm.</p></div>
      <PageHeaderActions><Button variant="outline" size="sm" disabled={!report || exporting} onClick={() => void exportExcel()}><Download />{exporting ? 'Exporting…' : 'Excel'}</Button><Button variant="outline" size="sm" disabled={!report} onClick={() => printReport()}><FileText />Print / PDF</Button><Button size="sm" disabled={loading} onClick={() => void loadReport(1)}><RefreshCw className={cn(loading && 'animate-spin')} />Refresh</Button></PageHeaderActions>
    </PageHeader>

    <PageSection className="print:hidden">
      <PageSectionHeader><div><PageSectionTitle>Report filters</PageSectionTitle><PageSectionDescription>All filters support multiple selections. Changing geography clears its downstream selections.</PageSectionDescription></div></PageSectionHeader>
      <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Date basis</span><select className="h-10 w-full rounded-md border bg-background px-3" value={filters.dateBasis} onChange={event => setFilters(current => ({ ...current, dateBasis: event.target.value as HatcheryLifecycleDateBasis }))}><option value="created">Created Date</option><option value="receiving">Receiving Date</option></select></label>
        <label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Date From</span><input className="h-10 w-full rounded-md border bg-background px-3" type="date" value={filters.dateFrom} max={filters.dateTo} onChange={event => setFilters(current => ({ ...current, dateFrom: event.target.value }))} /></label>
        <label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Date To</span><input className="h-10 w-full rounded-md border bg-background px-3" type="date" value={filters.dateTo} min={filters.dateFrom} onChange={event => setFilters(current => ({ ...current, dateTo: event.target.value }))} /></label>
        <MultiFilter label="Statuses" items={STATUS_ITEMS} value={filters.statuses} onChange={statuses => setFilters(current => ({ ...current, statuses }))} />
        <MultiFilter label="Island Groups" items={islandItems} value={filters.islands} onChange={islands => setFilters(current => ({ ...current, islands, regions: [ALL], farms: [ALL], tas: [ALL] }))} disabled={!report} />
        <MultiFilter label="Regions" items={regionItems} value={filters.regions} onChange={regions => setFilters(current => ({ ...current, regions, farms: [ALL], tas: [ALL] }))} disabled={!report} />
        <MultiFilter label="Farms" items={farmItems} value={filters.farms} onChange={farmsValue => setFilters(current => ({ ...current, farms: farmsValue, tas: [ALL] }))} disabled={!report} />
        <MultiFilter label="TAs" items={taItems} value={filters.tas} onChange={tasValue => setFilters(current => ({ ...current, tas: tasValue }))} disabled={!report} />
      </div>
      <div className="flex flex-col gap-2 border-t bg-muted/20 p-3 sm:flex-row sm:justify-end"><Button variant="outline" size="sm" onClick={() => setFilters({ islands: [ALL], regions: [ALL], farms: [ALL], tas: [ALL], statuses: ['approved'], dateBasis: 'created', dateFrom: month.from, dateTo: month.to })}>Clear filters</Button><Button size="sm" disabled={loading} onClick={() => void loadReport(1)}><Search />Apply filters</Button></div>
    </PageSection>

    <div className="hidden print:block"><h1 className="text-lg font-semibold">Hatchery Lifecycle Report</h1><p className="text-xs">{context}</p><p className="text-xs">Generated {displayDate(report?.generatedAt ?? null)} · Asia/Manila</p></div>

    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4"><CompactMetric label="Farm–TA rows" value={report?.rows.length ?? 0} icon={<Users />} /><CompactMetric label="Receiving documents" value={formatNumber(totalReceiving)} /><CompactMetric label="Dispatch documents" value={formatNumber(totalDispatch)} /><CompactMetric label="Needs Review on loaded page" value={formatNumber(totalReview)} icon={<TriangleAlert />} /></div>

    <PageSection>
      <PageSectionHeader><div><PageSectionTitle>Farm and TA stage summary</PageSectionTitle><PageSectionDescription>Every active assigned TA remains visible, including zero-activity rows.</PageSectionDescription></div></PageSectionHeader>
      {loading && !report ? <div className="space-y-2 p-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div> : <div className="overflow-x-auto">
        <table className="w-full min-w-[1900px] text-left text-xs"><thead className="sticky top-0 z-10 bg-muted text-muted-foreground"><tr><th className="px-3 py-2 font-semibold">Island / Region</th><th className="px-3 py-2 font-semibold">Farm</th><th className="px-3 py-2 font-semibold">TA</th>{HATCHERY_LIFECYCLE_STAGES.map(stage => <th key={stage} className="px-3 py-2 text-right font-semibold">{stage}<span className="block text-[10px] font-normal">Docs / Qty</span></th>)}</tr></thead>
          <tbody className="divide-y">{report?.rows.map(row => <tr key={`${row.farmId}:${row.taId}`} className={cn('cursor-pointer hover:bg-muted/40', selectedRow?.farmId === row.farmId && selectedRow.taId === row.taId && 'bg-primary/5')} onClick={() => void loadDetails(row, 1)}><td className="px-3 py-2"><span className="block font-medium">{row.island}</span><span className="text-muted-foreground">{row.region}</span></td><td className="px-3 py-2"><span className="block font-medium">{row.farmName}</span><span className="text-muted-foreground">{row.farmCode}</span></td><td className="px-3 py-2 font-medium">{row.taName}</td>{HATCHERY_LIFECYCLE_STAGES.map(stage => { const value = metric(row, stage); return <td key={stage} className="px-3 py-2 text-right tabular-nums"><span className={cn('font-semibold', value.documentCount === 0 && 'text-muted-foreground')}>{value.documentCount}</span><span className="ml-1 text-muted-foreground">/ {formatNumber(value.quantity)}</span></td> })}</tr>)}{report && report.rows.length === 0 && <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">No assigned TAs are available for the selected scope.</td></tr>}</tbody>
        </table>
      </div>}
    </PageSection>

    <div className="min-w-0">
      <DynamicTable
        columns={lifecycleDetailColumns}
        data={detailRows}
        loading={detailLoading}
        title={selectedRow ? `${selectedRow.farmName} · ${selectedRow.taName}` : 'Receiving lifecycle details'}
        description={selectedRow ? 'Filtered to the selected Farm–TA row.' : 'Select a summary row to focus its complete lifecycle.'}
        searchPlaceholder="Search loaded lifecycle rows..."
        emptyMessage={selectedRow ? 'No Receiving records were created by this TA in the selected period.' : 'No Receiving lifecycle records found.'}
        rowKey="rowKey"
        variant="card"
        enableExport={false}
        enablePagination={false}
        getRowClassName={row => row.voided ? 'text-muted-foreground line-through' : ''}
        headerActions={selectedRow ? <Button className="print:hidden" variant="ghost" size="sm" onClick={() => { setSelectedRow(null); setDetailReport(null) }}>Show all</Button> : undefined}
      />
      {detailData && detailData.pagination.total > PAGE_SIZE && <div className="flex items-center justify-between gap-3 border-x border-b bg-secondary/40 px-2 py-2 text-xs text-muted-foreground print:hidden"><span>Page {detailData.pagination.page} · {detailData.pagination.total.toLocaleString('en-PH')} Receiving records</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={detailLoading || detailData.pagination.page <= 1} onClick={() => selectedRow ? void loadDetails(selectedRow, detailData.pagination.page - 1) : void loadReport(detailData.pagination.page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={detailLoading || detailData.pagination.page * PAGE_SIZE >= detailData.pagination.total} onClick={() => selectedRow ? void loadDetails(selectedRow, detailData.pagination.page + 1) : void loadReport(detailData.pagination.page + 1)}>Next</Button></div></div>}
    </div>
  </PageShell>
}
