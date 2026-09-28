'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BarChart3, Building2, CircleAlert, Clock3, Download, FileSpreadsheet, FileText, RefreshCw, Users, X } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import SearchableCombobox from '@/components/SearchableCombobox'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ComplianceBarChart from '@/components/reports/ComplianceBarChart'
import MaximizableCard from '@/components/reports/MaximizableCard'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { usePermission } from '@/hooks/usePermission'
import { getBroilerDataCompliance, type ComplianceDataset } from '@/lib/data/repositories/broilerDataCompliance'
import { buildComplianceRow, filterComplianceRows, complianceFilterOptions, complianceSummary, groupCompliance, manilaToday, COMPLIANCE_STAGES, COMPLIANCE_LABELS, COMPLIANCE_RULE, COMPLIANCE_HISTORY_NOTE, type ComplianceRow, type ComplianceStatus, type StageCompliance } from '@/lib/broiler/dataCompliance'
import { complianceReportSheets } from '@/lib/reports/broilerDataCompliance'
import { exportReportWorkbook } from '@/lib/reports/exportWorkbook'
import { cn } from '@/lib/utils'

const stageLabels = { placement: 'Placement', growing: 'Growing', harvest: 'Harvest', cleanup: 'Cleanup' }
const statusClass: Record<ComplianceStatus, string> = {
  updated: 'bg-accent text-accent-foreground', overdue: 'bg-destructive/10 text-destructive',
  'not-due': 'bg-muted text-muted-foreground', review: 'bg-chart-4/15 text-foreground',
  'not-assessed': 'bg-muted text-muted-foreground',
}
const errorText = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unable to load Data Compliance.'
const timestamp = (value: string | null) => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Unavailable'
const percent = (value: number | null) => value === null ? '—' : `${value.toLocaleString('en-PH', { maximumFractionDigits: 1 })}%`

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="min-w-0 space-y-1 text-sm text-foreground"><span className="font-bold">{label}</span><select aria-label={label} className="h-10 w-full rounded-md border bg-card px-2 text-sm text-foreground" value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>
}
function StageBadge({ value }: { value: StageCompliance }) {
  return <span title={value.note} className={cn('inline-flex min-w-20 justify-center rounded-md px-2 py-1.5 text-[11px] font-medium', statusClass[value.status])}>{value.status === 'overdue' ? `${value.daysLate}d late` : COMPLIANCE_LABELS[value.status]}</span>
}
function Metric({ title, value, note, icon: Icon, danger = false }: { title: string; value: string | number; note: string; icon: typeof Users; danger?: boolean }) {
  return <MaximizableCard title={title}>{maximized => <div className={cn('flex min-w-0 items-center gap-3 p-4 pr-10', maximized && 'min-h-[70dvh] flex-col justify-center gap-6 pr-4 text-center')}>
    <span className={cn('rounded-full p-2.5', danger ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground')}><Icon className={maximized ? 'size-10' : 'size-5'} /></span>
    <div className="min-w-0"><h2 className={maximized ? 'text-xl font-medium' : 'text-xs font-medium'}>{title}</h2><p className={cn('mt-1 font-semibold tabular-nums', maximized ? 'text-6xl sm:text-8xl' : 'text-3xl', danger && 'text-destructive')}>{value}</p><p className={cn('mt-1 text-muted-foreground', maximized ? 'mt-4 text-base' : 'text-[10px]')}>{note}</p></div>
  </div>}</MaximizableCard>
}

function BuildingTable({ rows, onSelect }: { rows: ComplianceRow[]; onSelect: (row: ComplianceRow) => void }) {
  return <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-left text-xs">
    <caption className="sr-only">Building and cycle data compliance details</caption>
    <thead className="bg-muted/60 text-muted-foreground"><tr>{['Region / Farm', 'Building / Cycle', 'Assigned TA', ...Object.values(stageLabels), 'Delay', 'Status'].map(label => <th key={label} className="whitespace-nowrap px-3 py-3 font-medium">{label}</th>)}</tr></thead>
    <tbody className="divide-y">{rows.map(row => <tr key={row.key} className="align-top hover:bg-muted/30">
      <td className="px-3 py-3"><span className="block text-[10px] text-muted-foreground">{row.region}</span>{row.farmName}</td>
      <td className="px-3 py-3"><button className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onSelect(row)}>{row.buildingName}</button><span className="mt-1 block text-[10px] text-muted-foreground">Cycle {row.cycleLabel}</span></td>
      <td className="px-3 py-3">{row.ta || <span className="text-muted-foreground">Unassigned</span>}</td>
      {COMPLIANCE_STAGES.map(stage => <td key={stage} className="px-3 py-3"><span className="mb-1 block whitespace-nowrap tabular-nums">{row.stages[stage].latestDate || 'None'}</span><StageBadge value={row.stages[stage]} /></td>)}
      <td className="whitespace-nowrap px-3 py-3 tabular-nums">{row.daysLate ? `${row.daysLate} days` : '—'}</td><td className="px-3 py-3"><span className={cn('inline-block whitespace-nowrap rounded px-2 py-1', statusClass[row.status])}>{COMPLIANCE_LABELS[row.status]}</span></td>
    </tr>)}</tbody>
  </table></div>
}

export default function DataComplianceDashboard() {
  const blocked = usePermission('/brd/data-compliance/view')
  const { getValue } = useGlobalContext()
  const profile = getValue('UserInfoAuthSession')?.[0]
  const owner = String(profile?.auth_id || '')
  const scope = 'all' as const
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; data: ComplianceDataset | null; error: string } | null>(null)
  const requestKey = `${owner}:${scope}:${revision}`
  const [view, setView] = useState('chart')
  const asOf = manilaToday()
  const cutoff = 'yesterday' as const
  const [region, setRegion] = useState('')
  const [farm, setFarm] = useState<string[]>([])
  const [ta, setTa] = useState('')
  const [cycle, setCycle] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<ComplianceRow | null>(null)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const printReport = useReactToPrint({ contentRef: reportRef, documentTitle: `Broiler Data Compliance ${asOf}`, pageStyle: '@page { size: A3 landscape; margin: 10mm; } @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } tr { break-inside: avoid; } }' })

  useEffect(() => {
    if (blocked || !owner) return
    let cancelled = false
    getBroilerDataCompliance(scope).then(data => {
      if (!cancelled) setResult({ key: requestKey, data, error: '' })
    }).catch(error => {
      if (!cancelled) setResult({ key: requestKey, data: null, error: errorText(error) })
    })
    return () => { cancelled = true }
  }, [blocked, owner, scope, requestKey])

  const current = result?.key === requestKey ? result : null
  const data = current?.data
  const allRows = useMemo(() => !data ? [] : data.sources.map(source => buildComplianceRow(source, asOf, cutoff)).filter((row): row is ComplianceRow => row !== null), [data, asOf, cutoff])
  const rows = useMemo(() => filterComplianceRows(allRows, { region, farm, ta, cycle, status })
    .sort((a, b) => b.daysLate - a.daysLate || a.farmName.localeCompare(b.farmName) || a.buildingName.localeCompare(b.buildingName)), [allRows, region, farm, ta, cycle, status])
  const summary = complianceSummary(rows)
  const { regions, farms, tas, hasUnassigned } = complianceFilterOptions(data?.farms ?? [], region, farm)
  const cycles = [...new Map(allRows.filter(row => (!farm.length || farm.includes(String(row.farmId))) && (!region || row.region === region)).map(row => [row.cycleKey, `${row.farmName} · ${row.cycleLabel}`])).entries()]
  const context = `As of ${asOf} · ${region || 'All regions'} · ${farms.filter(item => farm.includes(String(item.id))).map(item => item.name).join(', ') || 'All farms'} · ${ta === 'unassigned' ? 'Unassigned' : tas.find(user => String(user.id) === ta)?.name || 'All TAs'} · ${cycles.filter(([id]) => cycle.includes(id)).map(([, label]) => label).join(', ') || 'All cycles'} · Includes current, past open and closed cycles · ${status ? COMPLIANCE_LABELS[status as ComplianceStatus] : 'All statuses'} · Growing through ${cutoff}`
  const ready = Boolean(data && rows.length)
  const regionGroups = groupCompliance(rows, 'region')
  const farmGroups = groupCompliance(rows, 'farm')
  const taGroups = groupCompliance(rows, 'ta')
  function resetFilters() { setRegion(''); setFarm([]); setTa(''); setCycle([]); setStatus('') }
  function drillDown(by: 'region' | 'farm' | 'ta', key: string) {
    if (by === 'region') { setRegion(key); setFarm([]); setTa(''); setCycle([]) }
    if (by === 'farm') { setFarm([key]); setTa(''); setCycle([]) }
    if (by === 'ta') { setTa(key); setStatus('overdue') }
    setView('report')
  }
  async function exportExcel() {
    if (!ready) return
    setExporting(true)
    try { await exportReportWorkbook(complianceReportSheets(rows, context, new Date().toISOString()), `broiler-data-compliance-${asOf}.xlsx`) }
    catch (error) { toast.error(errorText(error)) }
    finally { setExporting(false) }
  }
  if (blocked) return <main className="p-4 text-sm" role="alert">You do not have permission to view Broiler Data Compliance.</main>

  return <main className="space-y-4 p-3 sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold tracking-tight">Broiler Data Compliance</h1><p className="mt-1 text-sm text-muted-foreground">Monitor data updates across regions, farms and buildings.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setRevision(value => value + 1)} disabled={!current}><RefreshCw className={cn('size-4', !current && 'animate-spin')} />Refresh</Button><Button variant="outline" disabled={!ready} onClick={() => printReport()} title="Open print dialog and choose Save as PDF"><FileText className="size-4" />Export PDF</Button><Button variant="outline" disabled={!ready || exporting} onClick={() => void exportExcel()}><FileSpreadsheet className="size-4" />{exporting ? 'Exporting…' : 'Export Excel'}</Button></div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{data ? `Loaded ${timestamp(data.loadedAt)} · Asia/Manila` : 'Loading your assigned Broiler farms…'}</p><Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="report" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><FileText className="size-4" />Report View</TabsTrigger><TabsTrigger value="chart" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><BarChart3 className="size-4" />Chart View</TabsTrigger></TabsList></Tabs></div>
    <section aria-label="Report filters" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-5">
      <Filter label="Region" value={region} onChange={value => { setRegion(value); setFarm([]); setTa(''); setCycle([]) }}><option value="">All regions</option>{regions.map(value => <option key={value}>{value}</option>)}</Filter>
      <div className="min-w-0 [&_label]:text-sm [&_label]:font-bold [&_label]:text-foreground"><SearchableCombobox multiple label="Farm" items={farms.map(item => ({ code: String(item.id), name: item.name }))} value={farm} onValueChange={value => { setFarm(value); setTa(''); setCycle([]) }} placeholder="All farms" className="w-full" /></div>
      <Filter label="Assigned TA" value={ta} onChange={setTa}><option value="">All TAs</option>{tas.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}{hasUnassigned && <option value="unassigned">Unassigned</option>}</Filter>
      <div className="min-w-0 [&_label]:text-sm [&_label]:font-bold [&_label]:text-foreground"><SearchableCombobox multiple label="Cycle" items={cycles.map(([code, name]) => ({ code, name }))} value={cycle} onValueChange={setCycle} placeholder="All cycles" className="w-full" /></div>
      <Filter label="Status" value={status} onChange={setStatus}><option value="">All statuses</option>{(['updated', 'overdue', 'review', 'not-due'] as const).map(value => <option key={value} value={value}>{COMPLIANCE_LABELS[value]}</option>)}</Filter>
      <div className="flex items-end xl:col-span-5 xl:justify-end"><Button variant="outline" onClick={resetFilters} title="Clear all filters"><X className="size-4" />Clear</Button></div>
    </section>
    {!current && <div role="status" aria-label="Loading compliance dashboard" className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div><div className="grid gap-4 xl:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-72 rounded-xl" />)}</div></div>}
    {current?.error && <section role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"><h2 className="font-semibold">The report could not be loaded</h2><p className="mt-1 text-sm">{current.error}</p><p className="mt-2 text-xs text-muted-foreground">No partial KPI totals are displayed. Use Refresh to retry.</p></section>}
    {data && <div ref={reportRef} className="space-y-4 text-foreground">
      <div className="hidden print:block"><h1 className="text-xl font-semibold">Broiler Data Compliance</h1><p className="mt-1 text-xs">{context}</p><p className="text-xs">Data loaded {timestamp(data.loadedAt)} · Asia/Manila</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 print:grid-cols-5">
        <Metric title="Update Compliance" value={percent(summary.compliance)} note={`${summary.updated} of ${summary.due} assessed building-cycles`} icon={BarChart3} />
        <Metric title="Overdue Buildings" value={summary.overdue} note="Building-cycle records" icon={CircleAlert} danger={summary.overdue > 0} />
        <Metric title="Farms with Delays" value={summary.farmsWithDelays} note="At least one overdue building" icon={Building2} />
        <Metric title="TAs with Overdue Updates" value={summary.unassigned === summary.total && summary.total > 0 ? '—' : summary.tasWithDelays} note={`${summary.unassigned} building-cycles unassigned`} icon={Users} />
        <Metric title="Longest Delay" value={summary.overdue ? `${summary.longestDelay} days` : '—'} note="Since oldest missing required date" icon={Clock3} danger={summary.longestDelay > 0} />
      </div>
      <section className="rounded-lg border bg-card p-3 text-xs text-muted-foreground"><p><strong>Daily reporting deadline:</strong> Growing entries are expected through yesterday; today is not counted as overdue.</p><p className="mt-1">{COMPLIANCE_RULE}</p><p className="mt-1">{summary.review} need review · {summary.notDue} not yet due (excluded from the KPI). Assigned TAs are associated User accounts; Admin and Super Admin accounts are excluded. Shared farms count once in overall KPIs and once for each TA in TA summaries.</p><details className="mt-2"><summary className="cursor-pointer">Report definitions and coverage</summary><p className="mt-2">{COMPLIANCE_HISTORY_NOTE} All totals count building-cycle records. When several cycles are selected, the same building can appear more than once. Farms are limited to your active assignments and visible records.</p><p className="mt-1">Delay is the number of reporting days from the oldest missing required date through the selected cutoff, inclusive. Zero saved measurements count as entries; empty or voided rows do not.</p></details></section>
      {data.warnings.length > 0 && <ul role="alert" className="rounded-lg border p-3 text-xs">{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      {!rows.length ? <section className="rounded-xl border bg-card p-12 text-center"><BarChart3 className="mx-auto mb-3 size-8 text-muted-foreground" /><h2 className="font-medium">No matching building cycles</h2><p className="mt-1 text-sm text-muted-foreground">Adjust the filters or cycle scope. Only records available to your account are included.</p></section> : <>
        {view === 'chart' ? <div className="grid gap-4 xl:grid-cols-2 print:grid-cols-2">
          <ComplianceBarChart title="Compliance by Region" description="Updated ÷ assessed building-cycles" data={regionGroups} series={[{ key: 'compliance', label: 'Compliance %', color: 'var(--primary)' }]} percent onSelect={key => drillDown('region', key)} exportContext={context} />
          <ComplianceBarChart title="Overdue Buildings by TA" description="Unassigned records are shown separately from named TAs" data={taGroups.filter(row => row.overdue > 0)} series={[{ key: 'short', label: '1–2 days', color: 'var(--chart-4)' }, { key: 'medium', label: '3–5 days', color: 'var(--chart-1)' }, { key: 'long', label: '6+ days', color: 'var(--destructive)' }]} onSelect={key => drillDown('ta', key)} exportContext={context} />
          <ComplianceBarChart title="Farm Update Status" description="Building-cycle records by update status" data={farmGroups} series={[{ key: 'updated', label: 'Updated', color: 'var(--primary)' }, { key: 'overdue', label: 'Overdue', color: 'var(--destructive)' }, { key: 'review', label: 'Needs review', color: 'var(--chart-4)' }, { key: 'notDue', label: 'Not yet due', color: 'var(--muted-foreground)' }]} onSelect={key => drillDown('farm', key)} exportContext={context} />
          <MaximizableCard title="Building Activity Status">{(maximized, close) => <div className="p-4"><h2 className="pr-10 text-sm font-semibold">Building Activity Status</h2><p className="mt-1 text-xs text-muted-foreground">{rows.length} building-cycles · Select a building for dates and gaps</p><div className={cn("mt-4 overflow-auto print:max-h-none print:overflow-visible", !maximized && "max-h-[480px]")}><table className="w-full text-left text-xs"><thead><tr><th className="p-2 font-medium">Farm / Building / Cycle</th>{COMPLIANCE_STAGES.map(stage => <th key={stage} className="p-2 font-medium">{stageLabels[stage]}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.key}><td className="p-2"><button className="text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => { close(); setSelected(row) }}><span className="block font-medium">{row.farmName} / {row.buildingName}</span><span className="text-[10px] text-muted-foreground">{row.cycleLabel}</span></button></td>{COMPLIANCE_STAGES.map(stage => <td key={stage} className="p-1"><StageBadge value={row.stages[stage]} /></td>)}</tr>)}</tbody></table></div></div>}</MaximizableCard>
        </div> : <div className="space-y-4"><MaximizableCard title="Building / Cycle Details">{(_maximized, close) => <div className="p-4"><div className="flex items-center justify-between gap-3 pr-10"><h2 className="text-sm font-semibold">Building / Cycle Details</h2><span className="text-xs text-muted-foreground">{rows.length} records · Latest activity dates</span></div><BuildingTable rows={rows} onSelect={row => { close(); setSelected(row) }} /></div>}</MaximizableCard><MaximizableCard title="Assigned TA Summary">{() => <div className="overflow-x-auto p-4"><h2 className="mb-3 pr-10 text-sm font-semibold">Assigned TA Summary</h2><table className="w-full text-left text-xs"><thead><tr>{['TA', 'Building-cycles', 'Assessed', 'Updated', 'Overdue', 'Compliance', 'Longest delay'].map(label => <th key={label} className="p-2 font-medium">{label}</th>)}</tr></thead><tbody>{taGroups.map(row => <tr key={row.key} className="border-t"><td className="p-2">{row.label}</td><td className="p-2">{row.total}</td><td className="p-2">{row.due}</td><td className="p-2">{row.updated}</td><td className="p-2">{row.overdue}</td><td className="p-2">{percent(row.compliance)}</td><td className="p-2">{row.longestDelay} days</td></tr>)}</tbody></table></div>}</MaximizableCard></div>}
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground print:hidden"><Download className="size-3" />Excel includes all filtered details. PDF uses the current view; choose Save as PDF in the print dialog. Bar charts include PNG downloads.</p>
        <p className="hidden text-[10px] print:block">{COMPLIANCE_HISTORY_NOTE}</p>
      </>}
    </div>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null) }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{selected?.farmName} / {selected?.buildingName}</DialogTitle><DialogDescription>Cycle {selected?.cycleLabel} · Assigned TA: {selected?.ta || 'Unassigned'}</DialogDescription></DialogHeader>{selected && <div className="space-y-3">{COMPLIANCE_STAGES.map(stage => <section key={stage} className="rounded-lg border p-3 text-xs"><div className="flex items-center justify-between"><h3 className="font-semibold">{stageLabels[stage]}</h3><StageBadge value={selected.stages[stage]} /></div><dl className="mt-2 grid gap-2 sm:grid-cols-2"><div><dt className="text-muted-foreground">Latest activity date</dt><dd>{selected.stages[stage].latestDate || 'None'}</dd></div><div><dt className="text-muted-foreground">Latest saved timestamp (Manila)</dt><dd>{timestamp(selected.stages[stage].latestSavedAt)}</dd></div></dl><p className="mt-2 text-muted-foreground">{selected.stages[stage].note}</p>{selected.stages[stage].missingDates.length > 0 && <p className="mt-2 leading-relaxed">Missing dates: {selected.stages[stage].missingDates.join(', ')}</p>}</section>)}<p className="text-[11px] text-muted-foreground">Saved timestamps describe row saves (Placement/Growing) or document saves (Harvest/Cleanup); they are not an immutable history of when each field was first entered.</p></div>}</DialogContent></Dialog>
  </main>
}
