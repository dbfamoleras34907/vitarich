'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpRight, BarChart3, Building2, CircleAlert, CircleHelp, Clock3, Download, FileSpreadsheet, FileText, RefreshCw, Users, X } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import SearchableCombobox from '@/components/SearchableCombobox'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import BroilerGrowingReportTable from '@/components/reports/BroilerGrowingReportTable'
import ComplianceBarChart from '@/components/reports/ComplianceBarChart'
import MaximizableCard from '@/components/reports/MaximizableCard'
import TransactionDetails from '@/app/brd/dashboard/TransactionDetails'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { usePermission } from '@/hooks/usePermission'
import { getBroilerDataCompliance, listBroilerDataComplianceFarmOptions, type ComplianceDataset, type ComplianceFarmOption } from '@/lib/data/repositories/broilerDataCompliance'
import { buildComplianceRow, dataAccuracyBy, farmDataScorecards, filterComplianceRows, complianceFilterOptions, complianceSummary, groupCompliance, manilaToday, taMonthlyCompliance, COMPLIANCE_STAGES, COMPLIANCE_LABELS, COMPLIANCE_RULE, COMPLIANCE_HISTORY_NOTE, type ComplianceRow, type ComplianceStage, type ComplianceStatus, type DataAccuracyRow, type StageCompliance } from '@/lib/broiler/dataCompliance'
import { complianceReportSheets } from '@/lib/reports/broilerDataCompliance'
import { exportReportWorkbook } from '@/lib/reports/exportWorkbook'
import { FARM_ISLANDS, PHILIPPINE_REGIONS, PHILIPPINE_REGIONS_BY_ISLAND, type FarmIslandGroup } from '@/lib/farmProfileOptions'
import { cn } from '@/lib/utils'

const stageLabels = { placement: 'Placement', growing: 'Growing', harvest: 'Harvest', cleanup: 'Cleanup' }
const stageDocumentTabs = { placement: 'placement', growing: 'growing', harvest: 'delivery', cleanup: 'cleanup' } as const
const ALL_FARMS = '__all_farms__'
const ALL_ISLANDS = '__all_islands__'
const ALL_REGIONS = '__all_regions__'
const FILTER_STATUSES = ['updated', 'overdue', 'review', 'not-due'] as const
const isFilterStatus = (value: string): value is typeof FILTER_STATUSES[number] => FILTER_STATUSES.some(status => status === value)
const statusClass: Record<ComplianceStatus, string> = {
  updated: 'bg-accent text-accent-foreground', overdue: 'bg-destructive/10 text-destructive',
  'not-due': 'bg-muted text-muted-foreground', review: 'bg-chart-4/15 text-foreground',
  'not-assessed': 'bg-muted text-muted-foreground',
}
const errorText = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unable to load Data Compliance.'
const timestamp = (value: string | null) => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Unavailable'
const displayDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '')
const percent = (value: number | null) => value === null ? '—' : `${value.toLocaleString('en-PH', { maximumFractionDigits: 1 })}%`

function Filter({ label, value, onChange, children, disabled = false }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; disabled?: boolean }) {
  return <label className="min-w-0 space-y-1.5 text-sm text-foreground"><span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><select aria-label={label} disabled={disabled} className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50" value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>
}
function StageBadge({ value, onClick }: { value: StageCompliance; onClick?: () => void }) {
  const label = value.status === 'overdue'
    ? value.missingDates.length ? `${value.missingDates.length}d missing` : `${value.daysLate}d late`
    : COMPLIANCE_LABELS[value.status]
  const className = cn('inline-flex h-7 min-w-24 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-semibold', statusClass[value.status], onClick && 'cursor-pointer ring-offset-background hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')
  return onClick
    ? <button type="button" title={`${value.note} Open details and documents.`} className={className} onClick={onClick}>{label}<ArrowUpRight className="size-3.5 text-amber-500" aria-label="Open details" /></button>
    : <span title={value.note} className={className}>{label}</span>
}

type FormulaHelpContent = {
  formula: string
  description: string
  breakdown: { label: string; value: string | number }[]
  result: string
  note?: string
}

function FormulaHelp({ title, content }: { title: string; content: FormulaHelpContent }) {
  return <Dialog>
    <DialogTrigger asChild>
      <Button type="button" variant="ghost" size="icon" className="absolute right-11 top-2 z-10 size-8 rounded-full text-muted-foreground hover:text-foreground print:hidden" aria-label={`Explain ${title} formula`} title={`How ${title} is calculated`}>
        <CircleHelp className="size-4" />
      </Button>
    </DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>How {title} is calculated</DialogTitle>
        <DialogDescription>{content.description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Formula</p>
          <div className="rounded-lg border bg-muted/50 px-3 py-2.5 font-mono font-medium text-foreground">{content.formula}</div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current report breakdown</p>
          <dl className="divide-y rounded-lg border">{content.breakdown.map(item => <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-4 px-3 py-2.5"><dt className="text-muted-foreground">{item.label}</dt><dd className="break-words text-right font-medium tabular-nums">{item.value}</dd></div>)}</dl>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg bg-primary/10 px-4 py-3"><span className="font-medium text-primary">Result</span><strong className="text-lg tabular-nums text-primary">{content.result}</strong></div>
        {content.note && <p className="text-xs leading-relaxed text-muted-foreground">{content.note}</p>}
      </div>
    </DialogContent>
  </Dialog>
}

function Metric({ title, value, note, icon: Icon, formula, danger = false }: { title: string; value: string | number; note: string; icon: typeof Users; formula: FormulaHelpContent; danger?: boolean }) {
  return <MaximizableCard title={title} className="shadow-sm">{maximized => <div className={cn('flex min-w-0 items-start gap-3 p-4 pr-11', maximized && 'min-h-[70dvh] flex-col items-center justify-center gap-6 pr-4 text-center')}>
    {!maximized && <FormulaHelp title={title} content={formula} />}
    <span className={cn('mt-0.5 rounded-lg p-2.5', danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}><Icon className={maximized ? 'size-10' : 'size-5'} /></span>
    <div className="min-w-0"><h2 className={maximized ? 'text-xl font-medium' : 'text-sm font-medium text-muted-foreground'}>{title}</h2><p className={cn('mt-1 font-semibold leading-none tabular-nums', maximized ? 'text-6xl sm:text-8xl' : 'text-3xl', danger && 'text-destructive')}>{value}</p><p className={cn('mt-2 leading-snug text-muted-foreground', maximized ? 'mt-4 text-base' : 'text-xs')}>{note}</p></div>
  </div>}</MaximizableCard>
}

function BuildingTable({ rows, onSelect }: { rows: ComplianceRow[]; onSelect: (row: ComplianceRow) => void }) {
  return <div className="mt-3 overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[1080px] text-left text-sm">
    <caption className="sr-only">Building and cycle data compliance details</caption>
    <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide text-muted-foreground"><tr>{['Island / Region / Farm', 'Building / Cycle', 'Assigned TA', ...Object.values(stageLabels), 'Delay', 'Status'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
    <tbody className="divide-y">{rows.map((row, index) => <tr key={row.key} className={cn('align-top transition-colors hover:bg-muted/50', index % 2 === 1 && 'bg-muted/20')}>
      <td className="px-4 py-3.5"><span className="block text-xs text-muted-foreground">{row.island}</span><span className="mb-1 block text-xs text-muted-foreground">{row.region}</span><span className="font-medium">{row.farmName}</span></td>
      <td className="px-4 py-3.5"><button className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onSelect(row)}>{row.buildingName}</button><span className="mt-1 block text-xs text-muted-foreground">Cycle {row.cycleLabel}</span></td>
      <td className="px-4 py-3.5">{row.ta || <span className="italic text-muted-foreground">Unassigned</span>}</td>
      {COMPLIANCE_STAGES.map(stage => <td key={stage} className="px-4 py-3.5"><span className="mb-2 block whitespace-nowrap text-xs tabular-nums text-muted-foreground">Latest: {row.stages[stage].latestDate || 'None'}</span><StageBadge value={row.stages[stage]} /></td>)}
      <td className="whitespace-nowrap px-4 py-3.5 font-medium tabular-nums">{row.daysLate ? `${row.daysLate} days` : '—'}</td><td className="px-4 py-3.5"><span className={cn('inline-block whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold', statusClass[row.status])}>{COMPLIANCE_LABELS[row.status]}</span></td>
    </tr>)}</tbody>
  </table></div>
}

const scoreTone = (value: number | null) => value === null ? 'bg-muted text-muted-foreground' : value >= 90 ? 'bg-primary/10 text-primary' : value >= 80 ? 'bg-chart-4/15 text-foreground' : 'bg-destructive/10 text-destructive'

function Score({ value }: { value: number | null }) {
  return <span className={cn('inline-flex min-w-14 justify-center rounded-md px-2 py-1 font-semibold tabular-nums', scoreTone(value))}>{percent(value)}</span>
}

function DataAccuracyTable({ rows, summary, summaryLabel }: { rows: DataAccuracyRow[]; summary: DataAccuracyRow | null; summaryLabel: string }) {
  return <MaximizableCard title="Data Accuracy by Island">{() => <div className="min-w-0 p-4">
    <div className="pr-10"><h2 className="text-sm font-semibold">FMS Broiler — Data Accuracy by Island</h2><p className="mt-1 text-xs text-muted-foreground">Updated stage records ÷ included building-cycles. This is a coverage proxy, not validation of entered field values.</p></div>
    <div className="mt-3 overflow-x-auto rounded-lg border"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-muted text-muted-foreground"><tr>{['Island', 'Placement', 'Growing', 'Harvest', 'Cleanup', 'Overall updated'].map(label => <th key={label} className="whitespace-nowrap px-3 py-2.5 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.key}><td className="px-3 py-2.5 font-medium">{row.label}</td>{(['placement', 'growing', 'harvest', 'cleanup', 'overallUpdated'] as const).map(key => <td key={key} className="px-3 py-2.5"><Score value={row[key]} /></td>)}</tr>)}{summary && <tr className="bg-muted/40 font-semibold"><td className="px-3 py-2.5">{summaryLabel}</td>{(['placement', 'growing', 'harvest', 'cleanup', 'overallUpdated'] as const).map(key => <td key={key} className="px-3 py-2.5"><Score value={summary[key]} /></td>)}</tr>}</tbody></table></div>
  </div>}</MaximizableCard>
}

function FarmScorecard({ rows }: { rows: ReturnType<typeof farmDataScorecards> }) {
  return <MaximizableCard title="Farm FMS Data Scorecard">{() => <div className="min-w-0 p-4"><div className="pr-10"><h2 className="text-sm font-semibold">Farm FMS Data Scorecard</h2><p className="mt-1 text-xs text-muted-foreground">Stage coverage and latest activity for each farm in the selected scope.</p></div><div className="mt-3 overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-muted text-muted-foreground"><tr>{['Farm', 'Island', 'Accuracy', 'Current stage', 'Latest data', 'Update status'].map(label => <th key={label} className="px-3 py-2.5 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.key}><td className="px-3 py-2.5 font-medium">{row.label}</td><td className="px-3 py-2.5">{row.island}</td><td className="px-3 py-2.5"><Score value={row.overallUpdated} /></td><td className="px-3 py-2.5">{row.currentStage}</td><td className="px-3 py-2.5 tabular-nums">{row.latestData ? displayDate(row.latestData) : 'No data'}</td><td className="px-3 py-2.5"><span className={cn('inline-flex rounded-md px-2 py-1 font-semibold', row.updateStatus === 'Updated' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive')}>{row.updateStatus}</span></td></tr>)}</tbody></table></div></div>}</MaximizableCard>
}

function TaScorecard({ rows }: { rows: ReturnType<typeof taMonthlyCompliance> }) {
  return <MaximizableCard title="TA FMS Encoding Compliance">{() => <div className="min-w-0 p-4"><div className="pr-10"><h2 className="text-sm font-semibold">TA FMS Encoding Compliance</h2><p className="mt-1 text-xs text-muted-foreground">Target ≥95% monthly · On-time uses the initial save date against each required activity date.</p></div><div className="mt-3 overflow-x-auto rounded-lg border"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-muted text-muted-foreground"><tr>{['TA', 'Required updates', 'On-time updates', 'Compliance', 'KPI status'].map(label => <th key={label} className="px-3 py-2.5 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.key}><td className="px-3 py-2.5 font-medium">{row.label}</td><td className="px-3 py-2.5 tabular-nums">{row.requiredUpdates}</td><td className="px-3 py-2.5 tabular-nums">{row.onTimeUpdates}</td><td className="px-3 py-2.5"><Score value={row.compliance} /></td><td className="px-3 py-2.5"><span className={cn('inline-flex rounded-md px-2 py-1 font-semibold', scoreTone(row.compliance))}>{row.kpiStatus}</span></td></tr>)}</tbody></table></div></div>}</MaximizableCard>
}

export default function DataComplianceDashboard() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const blocked = usePermission('/brd/data-compliance/view')
  const { getValue } = useGlobalContext()
  const profile = getValue('UserInfoAuthSession')?.[0]
  const owner = String(profile?.auth_id || '')
  const scope = 'all' as const
  const [catalogResult, setCatalogResult] = useState<{ owner: string; data: ComplianceFarmOption[]; error: string } | null>(null)
  const [result, setResult] = useState<{ key: string; data: ComplianceDataset | null; error: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const view = searchParams.get('view') === 'report' ? 'report' : 'chart'
  const asOf = manilaToday()
  const cutoff = 'yesterday' as const
  const islandParam = searchParams.get('island') ?? ''
  const island = islandParam === 'all' ? ALL_ISLANDS : islandParam
  const regionParam = searchParams.get('region') ?? ''
  const region = regionParam === 'all' ? ALL_REGIONS : regionParam
  const farmParam = searchParams.get('farmId') ?? ''
  const farm = farmParam === 'all' ? ALL_FARMS : farmParam
  const ta = searchParams.get('taId') ?? ''
  const cycle = useMemo(() => searchParams.getAll('cycle').filter(Boolean), [searchParams])
  const statusParam = searchParams.get('status') ?? ''
  const status = isFilterStatus(statusParam) ? statusParam : ''
  const [selected, setSelected] = useState<{ row: ComplianceRow; stage: ComplianceStage | null } | null>(null)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const activeRequestKeyRef = useRef<string | null>(null)
  const printReport = useReactToPrint({ contentRef: reportRef, documentTitle: `Broiler Data Compliance ${asOf}`, pageStyle: '@page { size: A3 landscape; margin: 10mm; } @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } tr { break-inside: avoid; } }' })

  const updateQuery = useCallback((updates: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      next.delete(key)
      if (Array.isArray(value)) value.filter(Boolean).forEach(item => next.append(key, item))
      else if (value) next.set(key, value)
    })
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  useEffect(() => {
    if (blocked || !owner) return
    let cancelled = false
    listBroilerDataComplianceFarmOptions().then(data => {
      if (!cancelled) setCatalogResult({ owner, data, error: '' })
    }).catch(error => {
      if (!cancelled) setCatalogResult({ owner, data: [], error: errorText(error) })
    })
    return () => { cancelled = true }
  }, [blocked, owner])

  const selectionKey = `${owner}:${scope}:${island}:${region}:${farm}`
  const current = result?.key === selectionKey ? result : null
  const data = current?.data
  const catalog = useMemo(() => catalogResult?.owner === owner ? catalogResult.data : [], [catalogResult, owner])
  const catalogLoading = Boolean(owner) && catalogResult?.owner !== owner
  const islands = useMemo(() => [...new Set([...FARM_ISLANDS, ...catalog.map(item => item.island).filter(Boolean)])], [catalog])
  const regions = useMemo(() => {
    if (!island || island === ALL_ISLANDS) return [...new Set([...PHILIPPINE_REGIONS, ...catalog.map(item => item.region).filter(Boolean)])]
    if (FARM_ISLANDS.some(value => value === island)) return [...new Set([...PHILIPPINE_REGIONS_BY_ISLAND[island as FarmIslandGroup], ...catalog.filter(item => item.island === island).map(item => item.region).filter(Boolean)])]
    return [...new Set(catalog.filter(item => item.island === island).map(item => item.region))]
  }, [catalog, island])
  const farmOptions = useMemo(() => catalog.filter(item => (island === ALL_ISLANDS || item.island === island) && (region === ALL_REGIONS || item.region === region)), [catalog, island, region])
  const islandFilter = island === ALL_ISLANDS ? '' : island
  const regionFilter = region === ALL_REGIONS ? '' : region
  const farmFilter = farm === ALL_FARMS ? '' : farm
  const refreshReport = useCallback(async (nextIsland = island, nextRegion = region, nextFarm = farm) => {
    if (!owner || !nextIsland || !nextRegion || !nextFarm || activeRequestKeyRef.current) return
    const selectedFarmIds = nextFarm === ALL_FARMS
      ? catalog.filter(item => (nextIsland === ALL_ISLANDS || item.island === nextIsland) && (nextRegion === ALL_REGIONS || item.region === nextRegion)).map(item => item.id)
      : [Number(nextFarm)]
    if (!selectedFarmIds.length || selectedFarmIds.some(id => !Number.isInteger(id) || id <= 0)) return
    const key = `${owner}:${scope}:${nextIsland}:${nextRegion}:${nextFarm}`
    activeRequestKeyRef.current = key
    setLoading(true)
    try {
      const data = await getBroilerDataCompliance(selectedFarmIds, scope)
      setResult({ key, data, error: '' })
    } catch (error) {
      setResult({ key, data: null, error: errorText(error) })
    } finally {
      activeRequestKeyRef.current = null
      setLoading(false)
    }
  }, [catalog, farm, island, owner, region, scope])

  useEffect(() => {
    if (catalogLoading || !island || !region || !farm || result?.key === selectionKey) return
    if (island !== ALL_ISLANDS && !islands.some(value => value === island)) return
    if (region !== ALL_REGIONS && !regions.some(value => value === region)) return
    const validFarm = farm === ALL_FARMS
      ? farmOptions.length > 0
      : farmOptions.some(item => String(item.id) === farm)
    if (validFarm) void refreshReport(island, region, farm)
  }, [catalogLoading, farm, farmOptions, island, islands, refreshReport, region, regions, result?.key, selectionKey])

  const allRows = useMemo(() => !data ? [] : data.sources.map(source => buildComplianceRow(source, asOf, cutoff)).filter((row): row is ComplianceRow => row !== null), [data, asOf, cutoff])
  const rows = useMemo(() => filterComplianceRows(allRows, { island: islandFilter, region: regionFilter, farm: farmFilter, ta, cycle, status })
    .sort((a, b) => b.daysLate - a.daysLate || a.farmName.localeCompare(b.farmName) || a.buildingName.localeCompare(b.buildingName)), [allRows, islandFilter, regionFilter, farmFilter, ta, cycle, status])
  const summary = complianceSummary(rows)
  const overdueRows = rows.filter(row => row.status === 'overdue')
  const delayedFarmNames = [...new Map(overdueRows.map(row => [row.farmId, row.farmName])).values()].sort()
  const delayedTaNames = [...new Map(overdueRows.flatMap(row => row.assignedTas.map(user => [user.id, user.name] as const))).values()].sort()
  const longestDelayRows = overdueRows.filter(row => row.daysLate === summary.longestDelay)
    .map(row => `${row.farmName} / ${row.buildingName} / Cycle ${row.cycleLabel}`)
  const { tas, hasUnassigned } = complianceFilterOptions(data?.farms ?? [], islandFilter, regionFilter, farmFilter)
  const cycles = [...new Map(allRows.filter(row => (!farmFilter || String(row.farmId) === farmFilter) && (!islandFilter || row.island === islandFilter) && (!regionFilter || row.region === regionFilter)).map(row => [row.cycleKey, `${row.farmName} · ${row.cycleLabel}`])).entries()]
  const context = `As of ${asOf} · ${island === ALL_ISLANDS ? 'All Island Groups' : island} · ${region === ALL_REGIONS ? 'All Regions' : region} · ${farm === ALL_FARMS ? 'All Farms' : catalog.find(item => String(item.id) === farm)?.name || 'Selected farm'} · ${ta === 'unassigned' ? 'Unassigned' : tas.find(user => String(user.id) === ta)?.name || 'All TAs'} · ${cycles.filter(([id]) => cycle.includes(id)).map(([, label]) => label).join(', ') || 'All cycles'} · Includes current, past open and closed cycles · ${status ? COMPLIANCE_LABELS[status as ComplianceStatus] : 'All statuses'} · Growing through ${cutoff}`
  const ready = Boolean(data && rows.length)
  const regionGroups = groupCompliance(rows, 'region')
  const farmGroups = groupCompliance(rows, 'farm')
  const taGroups = groupCompliance(rows, 'ta')
  const islandAccuracyData = dataAccuracyBy(rows, 'island')
  const islandAccuracyMap = new Map(islandAccuracyData.map(item => [item.key, item]))
  const islandAccuracy = (island === ALL_ISLANDS ? islands : [island]).filter(Boolean).map(label => islandAccuracyMap.get(label) ?? {
    key: label, label, total: 0, placement: null, growing: null, harvest: null, cleanup: null, overallUpdated: null,
  })
  const summaryAccuracy = dataAccuracyBy(rows.map(row => ({ ...row, island: 'Summary' })), 'island')[0] ?? null
  const farmScorecardRows = farmDataScorecards(rows)
  const taScorecardRows = taMonthlyCompliance(rows, asOf)
  function resetFilters() {
    updateQuery({ island: null, region: null, farmId: null, taId: null, cycle: null, status: null })
  }
  function drillDown(by: 'region' | 'farm' | 'ta', key: string) {
    if (by === 'region') updateQuery({ region: key, taId: null, cycle: null, view: 'report' })
    if (by === 'farm') updateQuery({ farmId: key, taId: null, cycle: null, view: 'report' })
    if (by === 'ta') updateQuery({ taId: key, status: 'overdue', view: 'report' })
  }
  async function exportExcel() {
    if (!ready) return
    setExporting(true)
    try { await exportReportWorkbook(complianceReportSheets(rows, context, new Date().toISOString(), asOf), `broiler-data-compliance-${asOf}.xlsx`) }
    catch (error) { toast.error(errorText(error)) }
    finally { setExporting(false) }
  }
  if (blocked) return <main className="p-4 text-sm" role="alert">You do not have permission to view Broiler Data Compliance.</main>

  return <main className="space-y-4 p-3 sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold tracking-tight">Broiler Data Compliance</h1><p className="mt-1 text-sm text-muted-foreground">Monitor data accuracy and update timeliness by island, region, farm and TA.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void refreshReport()} disabled={!island || !region || !farm || loading || catalogLoading}><RefreshCw className={cn('size-4', loading && 'animate-spin')} />{loading ? 'Refreshing…' : 'Refresh'}</Button><Button variant="outline" disabled={!ready} onClick={() => printReport()} title="Open print dialog and choose Save as PDF"><FileText className="size-4" />Export PDF</Button><Button variant="outline" disabled={!ready || exporting} onClick={() => void exportExcel()}><FileSpreadsheet className="size-4" />{exporting ? 'Exporting…' : 'Export Excel'}</Button></div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{data ? `Loaded ${timestamp(data.loadedAt)} · Asia/Manila` : catalogLoading ? 'Loading available Broiler farms…' : 'Select an island group, region and farm to load the report.'}</p><Tabs value={view} onValueChange={value => updateQuery({ view: value === 'report' ? 'report' : null })}><TabsList><TabsTrigger value="report" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><FileText className="size-4" />Report View</TabsTrigger><TabsTrigger value="chart" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><BarChart3 className="size-4" />Chart View</TabsTrigger></TabsList></Tabs></div>
    <section aria-label="Report filters" className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-6">
      <div className="flex items-center justify-between gap-3 border-b pb-3 sm:col-span-2 xl:col-span-6">
        <div><h2 className="text-sm font-semibold">Report filters</h2><p className="mt-0.5 text-xs text-muted-foreground">Choose the geographic scope and farm; the report loads automatically.</p></div>
        <Button variant="ghost" size="sm" onClick={resetFilters} title="Clear all filters"><X className="size-4" />Clear filters</Button>
      </div>
      <Filter label="Island Group" value={island} onChange={value => updateQuery({ island: value === ALL_ISLANDS ? 'all' : value || null, region: null, farmId: null, taId: null, cycle: null })}><option value="">Select an island group</option><option value={ALL_ISLANDS}>All Island Groups</option>{islands.map(value => <option key={value}>{value}</option>)}</Filter>
      <Filter label="Region" value={region} disabled={!island} onChange={value => updateQuery({ region: value === ALL_REGIONS ? 'all' : value || null, farmId: null, taId: null, cycle: null })}><option value="">Select a region</option><option value={ALL_REGIONS}>All Regions</option>{regions.map(value => <option key={value}>{value}</option>)}</Filter>
      <div className="min-w-0 [&_label]:text-xs [&_label]:font-semibold [&_label]:uppercase [&_label]:tracking-wide [&_label]:text-muted-foreground"><SearchableCombobox label="Farm" required items={farmOptions.length ? [{ code: ALL_FARMS, name: 'All Farms' }, ...farmOptions.map(item => ({ code: String(item.id), name: item.name }))] : []} value={farm} onValueChange={value => updateQuery({ farmId: value === ALL_FARMS ? 'all' : value || null, taId: null, cycle: null })} placeholder={region ? 'Select a farm' : 'Select a region first'} disabled={!island || !region || loading} className="w-full" /></div>
      <Filter label="Assigned TA" value={ta} onChange={value => updateQuery({ taId: value || null })}><option value="">All TAs</option>{tas.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}{hasUnassigned && <option value="unassigned">Unassigned</option>}</Filter>
      <div className="min-w-0 [&_label]:text-xs [&_label]:font-semibold [&_label]:uppercase [&_label]:tracking-wide [&_label]:text-muted-foreground"><SearchableCombobox multiple label="Cycle" items={cycles.map(([code, name]) => ({ code, name }))} value={cycle} onValueChange={value => updateQuery({ cycle: value })} placeholder="All cycles" className="w-full" /></div>
      <Filter label="Status" value={status} onChange={value => updateQuery({ status: value || null })}><option value="">All statuses</option>{FILTER_STATUSES.map(value => <option key={value} value={value}>{COMPLIANCE_LABELS[value]}</option>)}</Filter>
    </section>
    {loading && !current && <div role="status" aria-label="Loading compliance dashboard" className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div><div className="grid gap-4 xl:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-72 rounded-xl" />)}</div></div>}
    {!loading && !current && !catalogResult?.error && <section className="rounded-xl border bg-card p-8 text-center"><RefreshCw className="mx-auto mb-3 size-8 text-muted-foreground" /><h2 className="font-medium">Select an island group, region and farm</h2><p className="mt-1 text-sm text-muted-foreground">Use All Island Groups, All Regions or All Farms when you need a broader scorecard.</p></section>}
    {catalogResult?.owner === owner && catalogResult.error && <section role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"><h2 className="font-semibold">Farm choices could not be loaded</h2><p className="mt-1 text-sm">{catalogResult.error}</p></section>}
    {current?.error && <section role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"><h2 className="font-semibold">The report could not be loaded</h2><p className="mt-1 text-sm">{current.error}</p><p className="mt-2 text-xs text-muted-foreground">No partial KPI totals are displayed. Use Refresh to retry.</p></section>}
    {data && <div ref={reportRef} className="space-y-4 text-foreground">
      <div className="hidden print:block"><h1 className="text-xl font-semibold">Broiler Data Compliance</h1><p className="mt-1 text-xs">{context}</p><p className="text-xs">Data loaded {timestamp(data.loadedAt)} · Asia/Manila</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 print:grid-cols-5">
        <Metric title="Update Compliance" value={percent(summary.compliance)} note={`${summary.updated} of ${summary.due} assessed building-cycles`} icon={BarChart3} formula={{
          formula: '(Updated building-cycles ÷ Assessed building-cycles) × 100',
          description: 'Shows the share of assessed building-cycles whose required Placement and Growing entries are up to date.',
          breakdown: [
            { label: 'Updated', value: summary.updated },
            { label: 'Overdue', value: summary.overdue },
            { label: 'Assessed', value: `${summary.updated} + ${summary.overdue} = ${summary.due}` },
            { label: 'Substitution', value: summary.due ? `(${summary.updated} ÷ ${summary.due}) × 100` : 'No assessed records' },
          ],
          result: percent(summary.compliance),
          note: `${summary.review} record(s) needing review and ${summary.notDue} record(s) not yet due are excluded from the denominator.`,
        }} />
        <Metric title="Overdue Buildings" value={summary.overdue} note="Building-cycle records" icon={CircleAlert} danger={summary.overdue > 0} formula={{
          formula: 'Count of building-cycles with overall status = Overdue',
          description: 'A building-cycle is overdue when either its posted Placement is missing after the due date or at least one required Growing day is missing.',
          breakdown: [
            { label: 'Filtered building-cycles', value: summary.total },
            { label: 'Overdue building-cycles', value: summary.overdue },
            { label: 'Not overdue', value: summary.total - summary.overdue },
          ],
          result: String(summary.overdue),
          note: 'Each building-cycle counts once even when both Placement and Growing are overdue.',
        }} />
        <Metric title="Farms with Delays" value={summary.farmsWithDelays} note="At least one overdue building" icon={Building2} formula={{
          formula: 'Count of unique farm IDs among overdue building-cycles',
          description: 'Counts each farm once when it has one or more overdue building-cycles in the current filtered report.',
          breakdown: [
            { label: 'Overdue building-cycles', value: summary.overdue },
            { label: 'Farms included', value: delayedFarmNames.join(', ') || 'None' },
            { label: 'Unique farms', value: summary.farmsWithDelays },
          ],
          result: String(summary.farmsWithDelays),
          note: 'Farm identity uses the numeric public.farms.id; repeated buildings or cycles from the same farm do not increase the result.',
        }} />
        <Metric title="TAs with Overdue Updates" value={summary.unassigned === summary.total && summary.total > 0 ? '—' : summary.tasWithDelays} note={`${summary.unassigned} building-cycles unassigned`} icon={Users} formula={{
          formula: 'Count of unique assigned TA user IDs among overdue building-cycles',
          description: 'Counts each associated TA once when at least one of their assigned building-cycles is overdue.',
          breakdown: [
            { label: 'Overdue building-cycles', value: summary.overdue },
            { label: 'TAs included', value: delayedTaNames.join(', ') || 'None' },
            { label: 'Unique assigned TAs', value: summary.tasWithDelays },
            { label: 'Unassigned records', value: summary.unassigned },
          ],
          result: summary.unassigned === summary.total && summary.total > 0 ? '—' : String(summary.tasWithDelays),
          note: 'Unassigned building-cycles are shown separately and do not count as a TA. Admin and Super Admin accounts are excluded from TA assignment.',
        }} />
        <Metric title="Longest Delay" value={summary.overdue ? `${summary.longestDelay} days` : '—'} note="Since oldest missing required date" icon={Clock3} danger={summary.longestDelay > 0} formula={{
          formula: 'Maximum delay days across overdue building-cycles',
          description: 'Finds the largest inclusive day count from the oldest missing required date through yesterday in Asia/Manila.',
          breakdown: [
            { label: 'Overdue building-cycles', value: summary.overdue },
            { label: 'Maximum delay', value: summary.overdue ? `${summary.longestDelay} days` : 'No overdue records' },
            { label: 'Building-cycle(s)', value: longestDelayRows.join('; ') || 'None' },
          ],
          result: summary.overdue ? `${summary.longestDelay} days` : '—',
          note: 'Placement delay starts at the cycle start date. Growing delay starts at the oldest missing required Growing date. Both counts are inclusive through yesterday.',
        }} />
      </div>
      <section className="rounded-lg border bg-card p-3 text-xs text-muted-foreground"><p><strong>Daily reporting deadline:</strong> Growing entries are expected through yesterday; today is not counted as overdue.</p><p className="mt-1">{COMPLIANCE_RULE}</p><p className="mt-1">{summary.review} need review · {summary.notDue} not yet due (excluded from the KPI). Assigned TAs are associated User accounts; Admin and Super Admin accounts are excluded. Shared farms count once in overall KPIs and once for each TA in TA summaries.</p><details className="mt-2"><summary className="cursor-pointer">Report definitions and coverage</summary><p className="mt-2">{COMPLIANCE_HISTORY_NOTE} All totals count building-cycle records. When several cycles are selected, the same building can appear more than once. Farms are limited to active, approved Broiler farms visible to your account.</p><p className="mt-1">Delay is the number of reporting days from the oldest missing required date through the selected cutoff, inclusive. Zero saved measurements count as entries; empty or voided rows do not.</p></details></section>
      {data.warnings.length > 0 && <ul role="alert" className="rounded-lg border p-3 text-xs">{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      {!rows.length ? <section className="rounded-xl border bg-card p-12 text-center"><BarChart3 className="mx-auto mb-3 size-8 text-muted-foreground" /><h2 className="font-medium">No matching building cycles</h2><p className="mt-1 text-sm text-muted-foreground">Adjust the filters or cycle scope. Only records available to your account are included.</p></section> : <>
        <DataAccuracyTable rows={islandAccuracy} summary={summaryAccuracy} summaryLabel={island === ALL_ISLANDS ? 'National' : 'Selected scope'} />
        <div className="grid gap-4 xl:grid-cols-2 print:grid-cols-2"><FarmScorecard rows={farmScorecardRows} /><TaScorecard rows={taScorecardRows} /></div>
        {view === 'chart' ? <div className="grid gap-4 xl:grid-cols-2 print:grid-cols-2">
          <ComplianceBarChart title="Compliance by Region" description="Updated ÷ assessed building-cycles" data={regionGroups} series={[{ key: 'compliance', label: 'Compliance %', color: 'var(--primary)' }]} percent onSelect={key => drillDown('region', key)} exportContext={context} />
          <ComplianceBarChart title="Overdue Buildings by TA" description="Unassigned records are shown separately from named TAs" data={taGroups.filter(row => row.overdue > 0)} series={[{ key: 'short', label: '1–2 days', color: 'var(--chart-4)' }, { key: 'medium', label: '3–5 days', color: 'var(--chart-1)' }, { key: 'long', label: '6+ days', color: 'var(--destructive)' }]} onSelect={key => drillDown('ta', key)} exportContext={context} />
          <ComplianceBarChart title="Farm Update Status" description="Building-cycle records by update status" data={farmGroups} series={[{ key: 'updated', label: 'Updated', color: 'var(--primary)' }, { key: 'overdue', label: 'Overdue', color: 'var(--destructive)' }, { key: 'review', label: 'Needs review', color: 'var(--chart-4)' }, { key: 'notDue', label: 'Not yet due', color: 'var(--muted-foreground)' }]} onSelect={key => drillDown('farm', key)} exportContext={context} />
          <MaximizableCard title="Building Activity Status">{(maximized, close) => <div className="p-4"><h2 className="pr-10 text-sm font-semibold">Building Activity Status</h2><p className="mt-1 text-xs text-muted-foreground">{rows.length} building-cycles · Select a status box for its explanation and documents</p><div className={cn("mt-4 overflow-auto print:max-h-none print:overflow-visible", !maximized && "max-h-[480px]")}><table className="w-full text-left text-xs"><thead><tr><th className="p-2 font-medium">Farm / Building / Cycle</th>{COMPLIANCE_STAGES.map(stage => <th key={stage} className="p-2 font-medium">{stageLabels[stage]}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.key}><td className="p-2"><button className="text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => { close(); setSelected({ row, stage: null }) }}><span className="block font-medium">{row.farmName} / {row.buildingName}</span><span className="text-[10px] text-muted-foreground">{row.cycleLabel}</span></button></td>{COMPLIANCE_STAGES.map(stage => <td key={stage} className="p-1"><StageBadge value={row.stages[stage]} onClick={() => { close(); setSelected({ row, stage }) }} /></td>)}</tr>)}</tbody></table></div></div>}</MaximizableCard>
        </div> : <div className="space-y-4"><MaximizableCard title="Building / Cycle Details">{(_maximized, close) => <div className="p-4"><div className="flex items-center justify-between gap-3 pr-10"><h2 className="text-sm font-semibold">Building / Cycle Details</h2><span className="text-xs text-muted-foreground">{rows.length} records · Latest activity dates</span></div><BuildingTable rows={rows} onSelect={row => { close(); setSelected({ row, stage: null }) }} /></div>}</MaximizableCard><MaximizableCard title="Assigned TA Summary">{() => <div className="overflow-x-auto p-4"><h2 className="mb-3 pr-10 text-sm font-semibold">Assigned TA Summary</h2><table className="w-full text-left text-xs"><thead><tr>{['TA', 'Building-cycles', 'Assessed', 'Updated', 'Overdue', 'Compliance', 'Longest delay'].map(label => <th key={label} className="p-2 font-medium">{label}</th>)}</tr></thead><tbody>{taGroups.map(row => <tr key={row.key} className="border-t"><td className="p-2">{row.label}</td><td className="p-2">{row.total}</td><td className="p-2">{row.due}</td><td className="p-2">{row.updated}</td><td className="p-2">{row.overdue}</td><td className="p-2">{percent(row.compliance)}</td><td className="p-2">{row.longestDelay} days</td></tr>)}</tbody></table></div>}</MaximizableCard></div>}
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground print:hidden"><Download className="size-3" />Excel includes all filtered details. PDF uses the current view; choose Save as PDF in the print dialog. Bar charts include PNG downloads.</p>
        <p className="hidden text-[10px] print:block">{COMPLIANCE_HISTORY_NOTE}</p>
      </>}
    </div>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null) }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-6xl"><DialogHeader><DialogTitle>{selected?.row.farmName} / {selected?.row.buildingName}{selected?.stage ? ` · ${stageLabels[selected.stage]}` : ''}</DialogTitle><DialogDescription>Cycle {selected?.row.cycleLabel} · Assigned TA: {selected?.row.ta || 'Unassigned'}</DialogDescription></DialogHeader>{selected && <div className="space-y-3">{(selected.stage ? [selected.stage] : COMPLIANCE_STAGES).map(stage => <section key={stage} className="rounded-lg border p-3 text-xs"><div className="flex items-center justify-between"><h3 className="font-semibold">{stageLabels[stage]}</h3><StageBadge value={selected.row.stages[stage]} /></div><dl className="mt-2 grid gap-2 sm:grid-cols-2"><div><dt className="text-muted-foreground">Latest activity date</dt><dd>{selected.row.stages[stage].latestDate || 'None'}</dd></div><div><dt className="text-muted-foreground">Latest saved timestamp (Manila)</dt><dd>{timestamp(selected.row.stages[stage].latestSavedAt)}</dd></div></dl><p className="mt-2"><strong>Why this status:</strong> <span className="text-muted-foreground">{selected.row.stages[stage].note}</span></p>{selected.row.stages[stage].missingDates.length > 0 && <div className="mt-3"><p className="font-medium">Missing dates</p><ul className="mt-2 flex flex-wrap gap-1.5">{selected.row.stages[stage].missingDates.map(date => <li key={date} className="inline-flex h-7 items-center rounded-md bg-destructive/10 px-2.5 font-medium tabular-nums text-destructive">{displayDate(date)}</li>)}</ul></div>}</section>)}{selected.stage === 'growing' ? <section className="min-w-0 rounded-lg border bg-card"><div className="border-b p-3"><h2 className="text-sm font-semibold">Growing &amp; Farm Condition Report</h2><p className="mt-1 text-[11px] text-muted-foreground">Read-only historical records for the selected Building and cycle.</p></div><div className="min-w-0 p-3"><BroilerGrowingReportTable building={selected.row.building} /></div></section> : selected.stage ? <TransactionDetails tab={stageDocumentTabs[selected.stage]} cycles={[{ ...selected.row.building, cycleId: null, cycleNumber: selected.row.cycleLabel, cycleClosedAt: selected.row.closedAt }]} includeAllPlacementRecords /> : null}<p className="text-[11px] text-muted-foreground">Saved timestamps describe row saves (Placement/Growing) or document saves (Harvest/Cleanup); they are not an immutable history of when each field was first entered.</p></div>}</DialogContent></Dialog>
  </main>
}
