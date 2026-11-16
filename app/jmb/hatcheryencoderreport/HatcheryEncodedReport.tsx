'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, Search, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CompactMetric, PageHeader, PageHeaderActions, PageSection, PageSectionDescription, PageSectionHeader, PageSectionTitle, PageShell } from '@/components/ui/page-layout'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermission } from '@/hooks/usePermission'
import { getHatcheryLifecycleReport, uniqueHatcheryLifecycleTas, type HatcheryLifecycleDateBasis, type HatcheryLifecycleReport, type HatcheryLifecycleStatus } from '@/lib/data/repositories/hatcheryLifecycleReport'
import { hatcheryDrCompletion, hatcheryDrTraces, HATCHERY_TRACE_STAGES, hatcheryTraceStageLabel, type HatcheryClassificationTrace } from '@/lib/reports/hatcheryLifecycleTrace'
import { cn } from '@/lib/utils'

const ALL = '__all__'
// Paginate by complete Receiving/DR lineages so an Egg Classification breakdown is never split.
const PAGE_SIZE = 20
const LIFECYCLE_REPORT_PERMISSION = '/report/hatchery-lifecycle/view'

type Filters = { dateBasis: HatcheryLifecycleDateBasis; dateFrom: string; dateTo: string; farmId: string; encoderId: string; status: 'all' | HatcheryLifecycleStatus }

function currentMonth() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const [year, month] = today.split('-').map(Number)
  return { from: `${today.slice(0, 7)}-01`, to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) }
}

const formatNumber = (value: number) => value.toLocaleString('en-PH', { maximumFractionDigits: 2 })
const displayDate = (value: string | null) => value ? new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: value.length === 10 ? undefined : 'short' }) : '—'
const displayElapsed = (value: number | null) => value == null ? '—' : `${value.toLocaleString('en-PH', { maximumFractionDigits: 1 })} days`
const latestStageDocument = (child: HatcheryClassificationTrace, stage: typeof HATCHERY_TRACE_STAGES[number]) => child.stages[stage]?.at(-1) ?? null
const statusLabel = (status: HatcheryClassificationTrace['status']) => status === 'complete' ? 'Complete' : status === 'disposed' ? 'Disposed' : 'In progress'
const statusClass = (status: HatcheryClassificationTrace['status']) => status === 'complete' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : status === 'disposed' ? 'bg-muted text-muted-foreground' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'

export default function HatcheryEncodedReport() {
  const blocked = usePermission(LIFECYCLE_REPORT_PERMISSION)
  const month = useMemo(currentMonth, [])
  const [filters, setFilters] = useState<Filters>({ dateBasis: 'created', dateFrom: month.from, dateTo: month.to, farmId: ALL, encoderId: ALL, status: 'all' })
  const [report, setReport] = useState<HatcheryLifecycleReport | null>(null)
  const [encoderCatalog, setEncoderCatalog] = useState<HatcheryLifecycleReport['catalog']['tas']>([])
  const [loading, setLoading] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)

  const loadReport = useCallback(async (page = 1) => {
    if (blocked) return
    if (!filters.dateFrom || !filters.dateTo || filters.dateFrom > filters.dateTo) { toast.error('Enter a valid Date From and Date To range.'); return }
    setLoading(true)
    try {
      const nextReport = await getHatcheryLifecycleReport({ dateBasis: filters.dateBasis, dateFrom: filters.dateFrom, dateTo: filters.dateTo, farmIds: filters.farmId === ALL ? undefined : [Number(filters.farmId)], taIds: filters.encoderId === ALL ? undefined : [Number(filters.encoderId)], statuses: filters.status === 'all' ? undefined : [filters.status], page, pageSize: PAGE_SIZE })
      setReport(nextReport)
      if (filters.encoderId === ALL) {
        setEncoderCatalog((current) => {
          const byFarmAndEncoder = new Map(current.map((encoder) => [String(encoder.farmId) + ':' + String(encoder.id), encoder]))
          nextReport.catalog.tas.forEach((encoder) => byFarmAndEncoder.set(String(encoder.farmId) + ':' + String(encoder.id), encoder))
          return Array.from(byFarmAndEncoder.values())
        })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load the Hatchery Encoding Efficiency Report.')
    } finally { setLoading(false) }
  }, [blocked, filters])

  useEffect(() => { if (!blocked && !report && !loading) void loadReport() }, [blocked, loadReport, loading, report])

  const farms = report?.catalog.farms ?? []
  const encoders = useMemo(() => uniqueHatcheryLifecycleTas(
    encoderCatalog.length ? encoderCatalog : (report?.catalog.tas ?? []),
    filters.farmId === ALL ? undefined : new Set([Number(filters.farmId)]),
  ), [encoderCatalog, filters.farmId, report])
  const traces = useMemo(() => hatcheryDrTraces(report?.lifecycles ?? []), [report])
  const eggReferences = traces.reduce((sum, trace) => sum + trace.children.length, 0)
  const completedDrs = traces.filter(trace => hatcheryDrCompletion(trace).isComplete).length
  const needsAction = traces.reduce((sum, trace) => sum + trace.children.filter(child => child.status === 'in_progress').length, 0)
  const firstDrOnPage = report ? ((report.pagination.page - 1) * PAGE_SIZE) + 1 : 0
  const lastDrOnPage = report ? Math.min(report.pagination.page * PAGE_SIZE, report.pagination.total) : 0
  const totalPages = report ? Math.max(1, Math.ceil(report.pagination.total / PAGE_SIZE)) : 1

  if (blocked) return <main className="p-4 text-sm" role="alert">You do not have permission to view the Hatchery Encoding Efficiency Report.</main>

  return <PageShell className={cn(!filtersOpen && '[&>section:first-of-type>div]:hidden')}>
    <PageHeader><div><h1 className="text-xl font-semibold tracking-tight">Hatchery Encoding Efficiency Report</h1><p className="mt-0.5 text-xs text-muted-foreground">Trace every DR Ref. No. into its Egg Classification references and the later Hatchery modules.</p></div><PageHeaderActions><Button size="sm" disabled={loading} onClick={() => void loadReport()}><RefreshCw className={cn(loading && 'animate-spin')} />Refresh</Button></PageHeaderActions></PageHeader>
    <PageSection><PageSectionHeader><div><PageSectionTitle>Report filters</PageSectionTitle><PageSectionDescription>Farm filters the Encoder list. Farm and Encoder remain visible on every child lineage row.</PageSectionDescription></div></PageSectionHeader><div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-4"><label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Date basis</span><select className="h-10 w-full rounded-md border bg-background px-3" value={filters.dateBasis} onChange={event => setFilters(current => ({ ...current, dateBasis: event.target.value as HatcheryLifecycleDateBasis }))}><option value="created">Created Date</option><option value="receiving">Receiving Date</option></select></label><label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Date From</span><input className="h-10 w-full rounded-md border bg-background px-3" type="date" value={filters.dateFrom} max={filters.dateTo} onChange={event => setFilters(current => ({ ...current, dateFrom: event.target.value }))} /></label><label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Date To</span><input className="h-10 w-full rounded-md border bg-background px-3" type="date" value={filters.dateTo} min={filters.dateFrom} onChange={event => setFilters(current => ({ ...current, dateTo: event.target.value }))} /></label><label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Status</span><select className="h-10 w-full rounded-md border bg-background px-3" value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value as Filters['status'] }))}><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option><option value="voided">Voided</option><option value="all">All Statuses</option></select></label><label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Farm</span><select className="h-10 w-full rounded-md border bg-background px-3" value={filters.farmId} onChange={event => setFilters(current => ({ ...current, farmId: event.target.value, encoderId: ALL }))}><option value={ALL}>All Farms</option>{farms.map(farm => <option key={farm.id} value={farm.id}>{farm.code} · {farm.name}</option>)}</select></label><label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Encoder</span><select className="h-10 w-full rounded-md border bg-background px-3" value={filters.encoderId} onChange={event => setFilters(current => ({ ...current, encoderId: event.target.value }))}><option value={ALL}>All Encoders</option>{encoders.map(encoder => <option key={encoder.id} value={encoder.id}>{encoder.name}</option>)}</select></label></div><div className="flex justify-end border-t bg-muted/20 p-3"><Button size="sm" disabled={loading} onClick={() => void loadReport()}><Search />Apply filters</Button></div></PageSection>
    <div className="relative z-10 -mt-3 h-0"><Button type="button" variant="outline" size="icon-sm" title={filtersOpen ? 'Hide report filters' : 'Show report filters'} aria-label={filtersOpen ? 'Hide report filters' : 'Show report filters'} onClick={() => setFiltersOpen(current => !current)} className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full border bg-card shadow-md hover:bg-accent">{filtersOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</Button></div>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4"><CompactMetric label="DR Ref. Nos." value={formatNumber(traces.length)} /><CompactMetric label="Egg Classification refs." value={formatNumber(eggReferences)} /><CompactMetric label="Fully completed DRs" value={formatNumber(completedDrs)} /><CompactMetric label="Egg refs. needing action" value={formatNumber(needsAction)} icon={<TriangleAlert />} /></div>
    <PageSection><PageSectionHeader><div><PageSectionTitle>DR-to-Egg Classification trace</PageSectionTitle><PageSectionDescription>Each DR is a parent row. Every active Egg Classification reference is traced separately.</PageSectionDescription></div></PageSectionHeader>{loading && !report ? <div className="space-y-2 p-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[2140px] text-left text-xs"><thead className="sticky top-0 z-10 bg-muted text-muted-foreground"><tr><th className="px-3 py-2 font-semibold">Farm</th><th className="px-3 py-2 font-semibold">Encoder</th><th className="px-3 py-2 font-semibold">DR Ref. No.</th><th className="px-3 py-2 font-semibold">Receiving date</th><th className="px-3 py-2 font-semibold">Egg Classification Ref. No.</th>{HATCHERY_TRACE_STAGES.map(stage => <th key={stage} className="px-3 py-2 text-center font-semibold">{hatcheryTraceStageLabel[stage]}</th>)}<th className="px-3 py-2 font-semibold">Current stage</th><th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2 text-right font-semibold">Encoding time</th></tr></thead><tbody className="divide-y">{traces.flatMap(trace => { const completion = hatcheryDrCompletion(trace); const farm = report?.catalog.farms.find(item => item.id === trace.farmId); const encoder = report?.catalog.tas.find(item => item.id === trace.taId)?.name ?? 'Unassigned / former encoder'; return <Fragment key={trace.key}><tr className="bg-muted/35"><td className="px-3 py-2"><span className="block font-semibold">{farm?.name ?? `Farm #${trace.farmId}`}</span><span className="text-muted-foreground">{farm?.code ?? '—'}</span></td><td className="px-3 py-2 font-medium">{encoder}</td><td className="px-3 py-2 font-semibold">{trace.drRefNo}</td><td className="px-3 py-2">{displayDate(trace.receivingDate)}</td><td className="px-3 py-2 font-medium">{completion.total} Egg Classification {completion.total === 1 ? 'reference' : 'references'}</td><td colSpan={HATCHERY_TRACE_STAGES.length} className="px-3 py-2 text-muted-foreground">{completion.completed} complete or disposed · {completion.total - completion.completed} in progress</td><td className="px-3 py-2">—</td><td className="px-3 py-2">{completion.isComplete ? 'Complete' : 'In progress'}</td><td className="px-3 py-2 text-right">—</td></tr>{trace.children.map(child => <tr key={child.key} className="hover:bg-muted/30"><td className="px-3 py-2"><span className="block">{farm?.name ?? `Farm #${trace.farmId}`}</span><span className="text-muted-foreground">{farm?.code ?? '—'}</span></td><td className="px-3 py-2">{encoder}</td><td className="px-3 py-2 pl-8 text-muted-foreground">↳ {trace.drRefNo}</td><td className="px-3 py-2">{displayDate(trace.receivingDate)}</td><td className="px-3 py-2"><span className="block font-medium">{child.eggClassificationRef}</span><span className="text-muted-foreground">{child.quantity == null ? 'Quantity unavailable' : `${formatNumber(child.quantity)} ${child.uom ?? ''}`.trim()}</span></td>{HATCHERY_TRACE_STAGES.map(stage => { const node = latestStageDocument(child, stage); return <td key={stage} className="px-3 py-2 text-center">{node ? <><span className="block font-medium">{node.documentNo}</span><span className="block text-[10px] text-muted-foreground">{displayDate(node.occurredAt)}</span></> : <span className="text-muted-foreground">—</span>}</td> })}<td className="px-3 py-2">{child.currentStage === 'Chick Grading' ? 'DOC Classification' : child.currentStage}</td><td className="px-3 py-2"><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusClass(child.status))}>{statusLabel(child.status)}</span></td><td className="px-3 py-2 text-right tabular-nums">{displayElapsed(child.elapsedDays)}</td></tr>)}</Fragment> })}{report && traces.length === 0 && <tr><td colSpan={16} className="px-3 py-8 text-center text-muted-foreground">No Receiving lineages were found for the selected scope.</td></tr>}</tbody></table></div>}</PageSection>
    {report && report.pagination.total > 0 && <div className="flex flex-col gap-2 border-x border-b bg-secondary/40 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Showing DR Ref. Nos. {firstDrOnPage.toLocaleString('en-PH')}–{lastDrOnPage.toLocaleString('en-PH')} of {report.pagination.total.toLocaleString('en-PH')} · Page {report.pagination.page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || report.pagination.page <= 1} onClick={() => void loadReport(report.pagination.page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={loading || report.pagination.page >= totalPages} onClick={() => void loadReport(report.pagination.page + 1)}>Next</Button></div></div>}
  </PageShell>
}
