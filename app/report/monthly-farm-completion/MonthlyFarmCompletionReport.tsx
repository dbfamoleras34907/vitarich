'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, RefreshCw, Search } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import SearchableCombobox from '@/components/SearchableCombobox'
import {
  CompactMetric,
  PageHeader,
  PageHeaderActions,
  PageSection,
  PageSectionDescription,
  PageSectionHeader,
  PageSectionTitle,
  PageShell,
} from '@/components/ui/page-layout'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermission } from '@/hooks/usePermission'
import { getMonthlyFarmCompletionReport } from '@/lib/data/repositories/monthlyFarmCompletion'
import {
  MONTH_NAMES,
  MONTHLY_FARM_COMPLETION_FMS_TYPES,
  MONTHLY_FARM_COMPLETION_MODULES,
  monthlyFarmCompletionModuleLabel,
  type MonthlyFarmCompletionFmsType,
  type MonthlyFarmCompletionModule,
  type MonthlyFarmCompletionReport as ReportData,
  type MonthlyFarmCompletionRule,
} from '@/lib/data/repositories/monthlyFarmCompletion.shared'
import { exportReportWorkbook } from '@/lib/reports/exportWorkbook'
import { monthlyFarmCompletionReportSheets } from '@/lib/reports/monthlyFarmCompletion'
import { FARM_ISLANDS, PHILIPPINE_REGIONS, PHILIPPINE_REGIONS_BY_ISLAND, type FarmIslandGroup } from '@/lib/farmProfileOptions'
import { cn } from '@/lib/utils'

const ALL = '__all__'

type Filters = {
  fmsType: MonthlyFarmCompletionFmsType
  year: number
  completionModule: MonthlyFarmCompletionModule
  completionRule: MonthlyFarmCompletionRule
  island: string
  region: string
  farmIds: string[]
  userIds: string[]
}

function manilaYear() {
  return Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila', year: 'numeric' }))
}

function ruleLabel(rule: MonthlyFarmCompletionRule) {
  return rule === 'any_dispatch' ? 'Any dispatch recorded' : 'Every grading batch dispatched'
}

function formatGeneratedAt(value: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
}

function cellText(percentage: number | null, future: boolean) {
  if (future) return ''
  return percentage == null ? 'N/A' : `${percentage}%`
}

export default function MonthlyFarmCompletionReport() {
  const blocked = usePermission('/report/monthly-farm-completion/view')
  const defaultFilters = useMemo<Filters>(() => ({
    fmsType: 'Hatchery',
    year: manilaYear(),
    completionModule: 'doc_dispatch',
    completionRule: 'any_dispatch',
    island: ALL,
    region: ALL,
    farmIds: [],
    userIds: [],
  }), [])
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const initialLoadStarted = useRef(false)

  const loadReport = useCallback(async () => {
    if (blocked) return
    setLoading(true)
    setLoadError(null)
    try {
      setReport(await getMonthlyFarmCompletionReport({
        fmsType: filters.fmsType,
        year: filters.year,
        completionModule: filters.completionModule,
        completionRule: filters.completionRule,
        island: filters.island === ALL ? undefined : filters.island,
        region: filters.region === ALL ? undefined : filters.region,
        farmIds: filters.farmIds.map(Number),
        userIds: filters.userIds.map(Number),
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load the Monthly Farm Completion Report.'
      setLoadError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [blocked, filters])

  useEffect(() => {
    if (blocked || initialLoadStarted.current) return
    initialLoadStarted.current = true
    void loadReport()
  }, [blocked, loadReport])

  const catalogFarms = useMemo(() => report?.catalog.farms ?? [], [report])
  const islands = useMemo(() => [...new Set([...FARM_ISLANDS, ...catalogFarms.map(farm => farm.island).filter(Boolean)])], [catalogFarms])
  const regions = useMemo(() => {
    const farmRegions = catalogFarms
      .filter(farm => filters.island === ALL || farm.island === filters.island)
      .map(farm => farm.region).filter(Boolean)
    const standardRegions = filters.island === ALL
      ? PHILIPPINE_REGIONS
      : FARM_ISLANDS.some(island => island === filters.island)
        ? PHILIPPINE_REGIONS_BY_ISLAND[filters.island as FarmIslandGroup]
        : []
    return [...new Set([...standardRegions, ...farmRegions])]
  }, [catalogFarms, filters.island])
  const availableFarms = useMemo(() => catalogFarms.filter(farm =>
    (filters.island === ALL || farm.island === filters.island)
    && (filters.region === ALL || farm.region === filters.region)
  ), [catalogFarms, filters.island, filters.region])
  const farmOptions = useMemo(() => availableFarms.map(farm => ({ code: String(farm.id), name: `${farm.name} - ${farm.code}` })), [availableFarms])
  const userFarmIds = useMemo(() => new Set((filters.farmIds.length
    ? availableFarms.filter(farm => filters.farmIds.includes(String(farm.id)))
    : availableFarms).map(farm => farm.id)), [availableFarms, filters.farmIds])
  const userOptions = useMemo(() => (report?.catalog.users ?? [])
    .filter(user => user.farmIds.some(farmId => userFarmIds.has(farmId)))
    .map(user => ({ code: String(user.id), name: `${user.name} - ${user.userTypeLabel}` })), [report, userFarmIds])
  const years = useMemo(() => [...new Set([filters.year, ...(report?.catalog.availableYears ?? [])])].sort((a, b) => b - a), [filters.year, report])

  const totals = useMemo(() => {
    const cells = (report?.rows ?? []).flatMap(row => row.months).filter(cell => !cell.future)
    const receiving = cells.reduce((sum, cell) => sum + cell.totalCount, 0)
    const completed = cells.reduce((sum, cell) => sum + cell.completedCount, 0)
    return { receiving, completed, percentage: receiving > 0 ? Math.round((completed / receiving) * 100) : null }
  }, [report])

  const appliedFilters = report ? {
    fmsType: report.filters.fmsType,
    year: report.filters.year,
    completionModule: report.filters.completionModule,
    completionRule: report.filters.completionRule,
    island: report.filters.island ?? ALL,
    region: report.filters.region ?? ALL,
    farmIds: report.filters.farmIds.map(String),
    userIds: report.filters.userIds.map(String),
  } : filters
  const moduleLabel = monthlyFarmCompletionModuleLabel(appliedFilters.completionModule)
  const completionContext = appliedFilters.completionModule === 'doc_dispatch' ? `; ${ruleLabel(appliedFilters.completionRule)}` : ''
  const appliedFarmNames = appliedFilters.farmIds.map(id => report?.catalog.farms.find(farm => String(farm.id) === id)?.name).filter(Boolean)
  const appliedUserNames = appliedFilters.userIds.map(id => report?.catalog.users.find(user => String(user.id) === id)?.name).filter(Boolean)
  const context = `${appliedFilters.fmsType}; ${appliedFilters.year}; Through ${moduleLabel}${completionContext}; ${appliedFilters.island === ALL ? 'All Island Groups' : appliedFilters.island}; ${appliedFilters.region === ALL ? 'All Regions' : appliedFilters.region}; ${appliedFarmNames.length ? appliedFarmNames.join(', ') : 'All Farms'}; ${appliedUserNames.length ? appliedUserNames.join(', ') : 'All Users'}`
  const printReport = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `Monthly Farm Completion Report ${appliedFilters.year}`,
    pageStyle: '@page { size: A3 landscape; margin: 8mm; } @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } tr { break-inside: avoid; } }',
  })

  async function exportExcel() {
    if (!report) return
    setExporting(true)
    try {
      await exportReportWorkbook(monthlyFarmCompletionReportSheets(report, context), `monthly-farm-completion-${appliedFilters.fmsType.toLowerCase()}-${appliedFilters.year}.xlsx`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export the report.')
    } finally {
      setExporting(false)
    }
  }

  if (blocked) return <main className="p-4 text-sm" role="alert">You do not have permission to view the Monthly Farm Completion Report.</main>

  return <PageShell className="print:p-0" ref={reportRef}>
    <PageHeader className="print:hidden">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Monthly Farm Completion Report</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Monthly completion of active Receiving records by farm and FMS workflow.</p>
      </div>
      <PageHeaderActions>
        <Button variant="outline" size="sm" disabled={!report || exporting} onClick={() => void exportExcel()}><Download />{exporting ? 'Exporting…' : 'Excel'}</Button>
        <Button variant="outline" size="sm" disabled={!report} onClick={() => printReport()}><FileText />Print / PDF</Button>
        <Button size="sm" disabled={loading} onClick={() => void loadReport()}><RefreshCw className={cn(loading && 'animate-spin')} />Refresh</Button>
      </PageHeaderActions>
    </PageHeader>

    <PageSection className="print:hidden">
      <PageSectionHeader>
        <div><PageSectionTitle>Report filters</PageSectionTitle><PageSectionDescription>Farm filters narrow the available users. A selected user remains associated with every later module after creating or posting a record in its lineage.</PageSectionDescription></div>
      </PageSectionHeader>
      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">FMS Type</span><select className="h-10 w-full rounded-md border bg-background px-3" value={filters.fmsType} onChange={event => setFilters(current => ({ ...current, fmsType: event.target.value as MonthlyFarmCompletionFmsType }))}>{MONTHLY_FARM_COMPLETION_FMS_TYPES.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Year</span><select className="h-10 w-full rounded-md border bg-background px-3" value={filters.year} onChange={event => setFilters(current => ({ ...current, year: Number(event.target.value) }))}>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Completion Module</span><select className="h-10 w-full rounded-md border bg-background px-3" value={filters.completionModule} onChange={event => setFilters(current => ({ ...current, completionModule: event.target.value as MonthlyFarmCompletionModule }))}>{MONTHLY_FARM_COMPLETION_MODULES.map(module => <option key={module.value} value={module.value}>{module.label}</option>)}</select></label>
        {filters.completionModule === 'doc_dispatch' && <label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Completion Rule</span><select className="h-10 w-full rounded-md border bg-background px-3" value={filters.completionRule} onChange={event => setFilters(current => ({ ...current, completionRule: event.target.value as MonthlyFarmCompletionRule }))}><option value="any_dispatch">Any dispatch recorded</option><option value="all_grading_batches">Every grading batch dispatched</option></select></label>}
        <label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Island Group</span><select className="h-10 w-full rounded-md border bg-background px-3" value={filters.island} onChange={event => setFilters(current => ({ ...current, island: event.target.value, region: ALL, farmIds: [], userIds: [] }))}><option value={ALL}>All Island Groups</option>{islands.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="space-y-1.5 text-sm"><span className="block text-xs font-semibold text-muted-foreground">Region</span><select className="h-10 w-full rounded-md border bg-background px-3" value={filters.region} onChange={event => setFilters(current => ({ ...current, region: event.target.value, farmIds: [], userIds: [] }))}><option value={ALL}>All Regions</option>{regions.map(value => <option key={value}>{value}</option>)}</select></label>
        <div className="min-w-0 [&_label]:text-xs [&_label]:font-semibold [&_label]:text-muted-foreground"><SearchableCombobox multiple label="Farm" items={farmOptions} value={filters.farmIds} onValueChange={farmIds => setFilters(current => ({ ...current, farmIds, userIds: [] }))} placeholder="All Farms" className="w-full" /></div>
        <div className="min-w-0 [&_label]:text-xs [&_label]:font-semibold [&_label]:text-muted-foreground"><SearchableCombobox multiple label="User" items={userOptions} value={filters.userIds} onValueChange={userIds => setFilters(current => ({ ...current, userIds }))} placeholder="All Users" className="w-full" disabled={userOptions.length === 0} /></div>
      </div>
      <div className="flex flex-col gap-2 border-t bg-muted/20 p-3 sm:flex-row sm:justify-end">
        <Button variant="outline" size="sm" onClick={() => setFilters(defaultFilters)}>Clear filters</Button>
        <Button size="sm" disabled={loading} onClick={() => void loadReport()}><Search />Apply filters</Button>
      </div>
    </PageSection>

    <div className="hidden print:block">
      <h1 className="text-lg font-semibold">Monthly Farm Completion Report</h1>
      <p className="text-xs">{context}</p>
      <p className="text-xs">Generated {formatGeneratedAt(report?.generatedAt ?? '')} · Asia/Manila</p>
    </div>

    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <CompactMetric label="Farms" value={report?.rows.length ?? 0} />
      <CompactMetric label="Receiving Records" value={totals.receiving.toLocaleString('en-PH')} />
      <CompactMetric label={`Reached ${moduleLabel}`} value={totals.completed.toLocaleString('en-PH')} />
      <CompactMetric label="Overall Completion" value={totals.percentage == null ? 'N/A' : `${totals.percentage}%`} />
    </div>

    {loadError && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive print:hidden">{loadError}</div>}

    <PageSection>
      <PageSectionHeader>
        <div><PageSectionTitle>{appliedFilters.year} monthly completion through {moduleLabel}</PageSectionTitle><PageSectionDescription>{appliedFilters.completionModule === 'doc_dispatch' ? `${ruleLabel(appliedFilters.completionRule)}. ` : ''}A month with no active Receiving records displays N/A; future months remain blank.</PageSectionDescription></div>
      </PageSectionHeader>
      {loading && !report ? <div className="space-y-2 p-3">{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div> : <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-muted-foreground"><tr><th className="sticky left-0 z-20 min-w-52 border-r bg-muted px-3 py-2 text-left font-semibold">Farm</th>{MONTH_NAMES.map(month => <th key={month} className="min-w-16 px-2 py-2 text-center font-semibold">{month}</th>)}</tr></thead>
          <tbody className="divide-y">{report?.rows.map(row => <tr key={row.id} className="hover:bg-muted/30"><td className="sticky left-0 z-10 border-r bg-card px-3 py-2"><span className="block font-medium">{row.name}</span><span className="text-xs text-muted-foreground">{row.code}</span></td>{MONTH_NAMES.map((month, index) => { const cell = row.months.find(item => item.month === index + 1); const text = cellText(cell?.percentage ?? null, cell?.future ?? true); return <td key={month} title={cell && !cell.future ? `${cell.completedCount} of ${cell.totalCount} completed` : undefined} className={cn('px-2 py-2 text-center font-medium tabular-nums', text === 'N/A' && 'text-muted-foreground', cell?.percentage === 100 && 'text-emerald-700', cell?.percentage != null && cell.percentage < 100 && 'text-amber-700')}>{text}</td> })}</tr>)}{report && report.rows.length === 0 && <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">No active approved Hatchery farms are available for the selected geography.</td></tr>}</tbody>
        </table>
      </div>}
    </PageSection>
  </PageShell>
}
