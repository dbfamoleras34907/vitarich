'use client'

import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Activity, Bird, CalendarDays, ChevronRight, Droplets, HeartPulse, RefreshCw, ShieldAlert, Truck, Weight, Wheat } from 'lucide-react'
import { toast } from 'sonner'
import SearchableCombobox from '@/components/SearchableCombobox'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PageHeader, PageHeaderActions, PageShell } from '@/components/ui/page-layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CycleReportLayout from '@/app/brd/cycle-master/[cycleId]/Layout'
import Breadcrumb from '@/lib/Breadcrumb'
import { usePermission } from '@/hooks/usePermission'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { listAssignedUserFarmOptions, type AssignedFarmOption } from '@/lib/data/repositories/farmOptions.client'
import { getBroilerCycleDashboard, type CycleDashboardCatalog, type CycleDashboardData, type DashboardCycleBuilding } from '@/lib/data/repositories/broilerCycleDashboard'
import { activeGrowingLines, ageRange, dashboardMetrics, selectDashboardBuilding } from '@/lib/broiler/cycleDashboard'
import { cn } from '@/lib/utils'
import { BuildingComparison, PerformanceCharts } from './PerformanceCharts'
import CycleDashboardSkeleton from './CycleDashboardSkeleton'
import TransactionDetails, { detailTabs, formatDate, formatNumber, type DetailTab } from './TransactionDetails'

const errorMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error
  ? String(error.message) : 'Unable to load Cycle Dashboard.'

const cycleViewTabClassName = 'h-8 flex-none rounded-md px-4 text-xs font-semibold text-foreground hover:bg-card data-[state=active]:border-[#006241] data-[state=active]:bg-[#006241] data-[state=active]:text-white dark:text-foreground dark:data-[state=active]:border-[#006241] dark:data-[state=active]:bg-[#006241] dark:data-[state=active]:text-white after:hidden'
const buildingTabClassName = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
const processTabClassName = 'inline-flex h-9 shrink-0 items-center justify-center rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  const index = buttons.indexOf(event.target as HTMLButtonElement)
  if (index < 0) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
  buttons[next]?.focus()
  buttons[next]?.click()
}

function MetricCard({ title, icon: Icon, onClick, children, note }: {
  title: string; icon: typeof Bird; onClick: () => void; children: ReactNode; note?: string
}) {
  return <button type="button" onClick={onClick} title={note} className="group flex min-h-20 min-w-0 flex-col rounded-md border bg-card p-2.5 text-left shadow-[var(--starbucks-card-shadow)] transition-[border-color,background-color] hover:border-primary/40 hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-primary">
    <span className="flex w-full min-w-0 items-center gap-2 text-xs font-semibold">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 leading-4">{title}</span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
    </span>
    <span className="mt-2 flex w-full min-w-0 flex-wrap gap-x-4 gap-y-1 border-t pt-2">{children}</span>
    {note && <span className="sr-only">{note}</span>}
  </button>
}

function Metric({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return <span className="min-w-0 flex-1 basis-[7rem]"><span className="block truncate text-[10px] leading-3 text-muted-foreground">{label}</span>
    <span className="mt-0.5 block break-words text-xs font-semibold leading-4 tabular-nums">{value}{unit && <span className="ml-1 font-normal text-muted-foreground">{unit}</span>}</span></span>
}

const distinct = (values: string[]) => [...new Set(values.filter(Boolean))].join(', ') || '—'

function CycleDetails({ cycles, farmName, buildingName }: { cycles: DashboardCycleBuilding[]; farmName: string; buildingName: string }) {
  const metrics = dashboardMetrics(cycles)
  const placements = cycles.flatMap(cycle => cycle.placements)
  const docBatches = [...new Set(placements.map(row => row.batchNumber).filter(Boolean))]
  const activityDates = cycles.flatMap(cycle => {
    const age = activeGrowingLines(cycle).at(-1)?.age
    const lastGrowing = age !== undefined && cycle.startDate
      ? new Date(Date.parse(`${cycle.startDate.slice(0, 10)}T00:00:00Z`) + age * 86400000) : null
    return [...cycle.placements.map(row => row.receiveDate), ...cycle.deliveries.map(row => row.date),
      ...cycle.cleanups.map(row => row.date), lastGrowing && Number.isFinite(lastGrowing.getTime()) ? lastGrowing.toISOString().slice(0, 10) : '']
  }).filter(Boolean).sort()
  const details: [string, ReactNode][] = [
    ['Farm', farmName], ['Building', buildingName],
    ['Cycle number', distinct(cycles.map(cycle => String(cycle.cycleNumber)))],
    ['Flock number', distinct(cycles.map(cycle => cycle.flockCode))],
    ['Placement card', distinct(cycles.map(cycle => cycle.cardNo))],
    ['Growing document', distinct(cycles.map(cycle => cycle.growingNumber))],
    ['Breed', distinct(cycles.map(cycle => cycle.breed))],
    ['Hatch date', distinct(placements.map(row => formatDate(row.productionDate)))],
    ['Placement date', distinct(cycles.map(cycle => formatDate(cycle.startDate)))],
    [cycles.every(cycle => cycle.status === 'Closed') ? 'Calendar age at close' : 'Calendar age', `${ageRange(metrics.calendarAges)} days`],
    ['Posted Growing age', `${ageRange(metrics.postedAges)} days`],
    ['Starting population', formatNumber(metrics.startingPopulation, 0)],
    ['Remaining birds', formatNumber(metrics.remaining, 0)],
    ['Mortality', formatNumber(metrics.mortality, 0)],
    ['DOC source', distinct(placements.map(row => row.vendor))],
    ['Hatchery reference', distinct(placements.map(row => row.hatcheryReference))],
    ['DOC batch', <Dialog key="doc-batches">
      <DialogTrigger asChild>
        <Button type="button" variant="link" className="h-auto p-0 text-[11px]">Show Batch</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>DOC Batch</DialogTitle>
          <DialogDescription>{farmName} · {buildingName}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {docBatches.length ? <ul className="divide-y rounded-md border text-sm">
            {docBatches.map(batch => <li key={batch} className="break-all px-3 py-2">{batch}</li>)}
          </ul> : <p className="text-sm text-muted-foreground">No DOC batches found for this selection.</p>}
        </div>
      </DialogContent>
    </Dialog>],
    ['Latest activity date', formatDate(activityDates.at(-1) ?? '')],
    ['Status', distinct(cycles.map(cycle => cycle.status === 'Saved' ? 'Active' : cycle.status))],
    ['Remarks', distinct(cycles.map(cycle => cycle.remarks))],
  ]
  return <aside className="min-w-0 self-start rounded-lg border border-stone-200 bg-card p-3 dark:border-border lg:sticky lg:top-3">
    <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold"><Activity className="size-4 text-primary" />Cycle Details</h2>
    <dl className="space-y-1 text-[11px]">{details.map(([label, value]) => <div key={label} className="flex items-baseline gap-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <span className="min-w-2 flex-1 border-b border-dotted border-border" aria-hidden="true" />
      <dd className="max-w-[60%] break-words text-right font-medium tabular-nums">{value}</dd>
    </div>)}</dl>
  </aside>
}

export default function CycleDashboard({ initialFarmId, initialCycleId, initialCycleKind = 'farm' }: { initialFarmId?: number; initialCycleId?: number; initialCycleKind?: 'farm' | 'building' } = {}) {
  const { getValue } = useGlobalContext()
  const blocked = usePermission('/brd/dashboard/view')
  const profile = getValue('UserInfoAuthSession')?.[0]
  const profileKey = String(profile?.auth_id ?? profile?.id ?? '')
  const defaultFarm = String(getValue('DefaultFarmId') ?? profile?.default_farm ?? '')
  const [farmState, setFarmState] = useState<{ owner: string; options: AssignedFarmOption[]; error: string } | null>(null)
  const farmsReady = farmState?.owner === profileKey
  const farms = farmsReady ? farmState.options : []
  const farmError = farmsReady ? farmState.error : ''
  const [selectedFarm, setSelectedFarm] = useState(initialFarmId ? String(initialFarmId) : '')
  const [selectedBuilding, setSelectedBuilding] = useState('')
  const [cycleSelection, setCycleSelection] = useState<{ farmId: number; key: string } | null>(initialFarmId && initialCycleId ? { farmId: initialFarmId, key: `${initialCycleKind}:${initialCycleId}` } : null)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [reload, setReload] = useState(0)
  const [catalog, setCatalog] = useState<{ data: CycleDashboardCatalog; owner: string } | null>(null)
  const [result, setResult] = useState<{ data: CycleDashboardData | null; error: string; farmId: number; loadedAt: string; revision: number; owner: string; cycleKey: string } | null>(null)

  useEffect(() => {
    if (blocked) return
    let cancelled = false
    async function loadFarms() {
      try {
        const options = await listAssignedUserFarmOptions(['BR'])
        if (!cancelled) setFarmState({ owner: profileKey, options, error: '' })
      } catch (error) {
        if (!cancelled) { setFarmState({ owner: profileKey, options: [], error: errorMessage(error) }); toast.error(errorMessage(error)) }
      }
    }
    void loadFarms()
    return () => { cancelled = true }
  }, [blocked, profileKey, reload])

  const farm = selectedFarm ? farms.find(farm => String(farm.id) === selectedFarm)
    : farms.find(farm => String(farm.id) === defaultFarm)
    ?? farms.find(farm => farm.code === defaultFarm)
    ?? farms[0]
  const farmId = farm?.id ?? 0
  const requestedCycleKey = cycleSelection?.farmId === farmId ? cycleSelection.key : ''

  useEffect(() => {
    if (blocked || !farmId) return
    let cancelled = false
    async function loadDashboard() {
      try {
        const data = await getBroilerCycleDashboard(farmId, {
          cycleKey: requestedCycleKey || undefined,
          onCatalogLoaded: nextCatalog => {
            if (!cancelled) setCatalog({ data: nextCatalog, owner: profileKey })
          },
        })
        if (!cancelled) setResult({ data, error: '', farmId, loadedAt: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }), revision: reload, owner: profileKey, cycleKey: requestedCycleKey })
      } catch (error) {
        if (!cancelled) {
          const message = errorMessage(error)
          setResult(previous => ({ data: previous?.farmId === farmId && previous.owner === profileKey ? previous.data : null,
            error: message, farmId, loadedAt: '', revision: reload, owner: profileKey, cycleKey: requestedCycleKey }))
          toast.error(message)
        }
      }
    }
    void loadDashboard()
    return () => { cancelled = true }
  }, [blocked, farmId, profileKey, reload, requestedCycleKey])

  const loaded = result?.farmId === farmId && result?.revision === reload && result?.owner === profileKey && result?.cycleKey === requestedCycleKey
  const visibleCatalog = catalog?.data.farmId === farmId && catalog.owner === profileKey ? catalog.data : null
  const cycleOptions = visibleCatalog?.cycleOptions ?? []
  const data = loaded ? result?.data : null
  const buildings = data?.buildings
  const activeBuilding = selectDashboardBuilding(buildings ?? [], selectedBuilding)
  const building = buildings?.find(building => building.key === activeBuilding)
  const cycles = useMemo(() => activeBuilding === 'all'
    ? buildings?.flatMap(building => building.cycles) ?? [] : building?.cycles ?? [], [activeBuilding, buildings, building])
  const metrics = dashboardMetrics(cycles)
  const loading = !farmsReady || Boolean(farmId && !loaded)
  const error = farmError || (loaded ? result?.error : '')
  const title = activeBuilding === 'all' ? 'All Buildings' : building?.name || building?.code || ''
  const displayedStatus = activeBuilding === 'all' ? data?.selectedCycle?.status
    : cycles.some(cycle => cycle.status === 'Saved') ? 'Saved' : cycles[0]?.status ?? data?.selectedCycle?.status
  const statusLabel = displayedStatus === 'Saved' ? 'Active' : displayedStatus || ''

  function selectBuilding(key: string) { setSelectedBuilding(key); setTab('overview') }
  function drillDown(next: DetailTab) { setTab(next); document.getElementById(`detail-tab-${next}`)?.focus() }

  if (blocked) return <div className="m-4 flex items-center gap-2 rounded-md border p-4 text-sm"><ShieldAlert className="size-4" />You do not have permission to view Cycle Dashboard.</div>

  return <PageShell className="print:p-0">
    <PageHeader className="print:hidden">
      <Breadcrumb FirstPreviewsPageName="Cycle Master" FirstPreviewsPageLink="/brd/cycle-master" CurrentPageName="Cycle Dashboard" />
      <PageHeaderActions>
      <Button type="button" variant="outline" size="sm" onClick={() => setReload(value => value + 1)} disabled={loading} aria-label="Refresh Cycle Dashboard">
        <RefreshCw className={cn('size-4', loading && 'animate-spin')} />{loading ? 'Loading...' : 'Refresh'}
      </Button>
      </PageHeaderActions>
    </PageHeader>
    <div className="min-w-0 space-y-2 pb-4">
      <div className="grid gap-2 rounded-md border bg-muted/30 p-2 print:hidden sm:grid-cols-2 lg:grid-cols-[minmax(0,420px)_minmax(0,360px)]">
        <SearchableCombobox className="w-full min-w-0 [&_label]:text-[11px]" inputClassName="h-9 text-xs" label="Farm" value={farmId ? String(farmId) : ''}
          items={farms.map(farm => ({ code: String(farm.id), name: `${farm.code} - ${farm.name}` }))}
          onValueChange={value => { setSelectedFarm(value); setCycleSelection(null); setSelectedBuilding(''); setTab('overview') }} disabled={!farmsReady} />
        <SearchableCombobox className="w-full min-w-0 [&_label]:text-[11px]" inputClassName="h-9 text-xs" label="Cycle" value={requestedCycleKey || visibleCatalog?.selectedCycle?.key || ''}
          items={cycleOptions.map(cycle => ({ code: cycle.key, name: `${cycle.label} - ${cycle.status === 'Saved' ? 'Active' : cycle.status}` }))}
          placeholder={loading && !cycleOptions.length ? 'Loading cycles...' : 'Select a cycle'}
          disabled={!cycleOptions.length}
          onValueChange={key => { setCycleSelection({ farmId, key }); setSelectedBuilding(''); setTab('overview') }} />
      </div>
    <Tabs key={`${farmId}:${requestedCycleKey}`} defaultValue="dashboard" className="min-w-0">
      <TabsList className="max-w-full justify-start gap-1 rounded-lg border bg-muted/60 p-1 group-data-[orientation=horizontal]/tabs:h-10 print:hidden" aria-label="Cycle view">
        <TabsTrigger value="dashboard" className={cycleViewTabClassName}>Farm View</TabsTrigger>
        <TabsTrigger value="data" className={cycleViewTabClassName}>Records</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard" className="min-w-0">
    {data?.warnings.map(warning => <div key={warning} role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{warning}</div>)}
    {error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-card p-5 text-sm text-destructive">{error}</div>
      : loading ? <CycleDashboardSkeleton />
        : !farm ? <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">No assigned Broiler farms.</div>
          : !data?.selectedCycle ? <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">This farm does not have a Cycle yet.</div>
          : !buildings?.length ? <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">No buildings found for this cycle.</div>
            : <>
              <div className="min-w-0 space-y-2 rounded-md border bg-card p-2 print:hidden">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-0 max-w-full items-center gap-2">
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Building</span>
                    <div className="flex min-w-0 gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1" role="tablist" aria-label="Buildings" onKeyDown={navigateTabs}>
                      {buildings.map(item => <button key={item.key} type="button" role="tab" aria-selected={activeBuilding === item.key}
                        id={`building-tab-${item.key}`} aria-controls="building-panel" tabIndex={activeBuilding === item.key ? 0 : -1}
                        title={item.name || item.code} onClick={() => selectBuilding(item.key)}
                        className={cn(buildingTabClassName, activeBuilding === item.key ? 'bg-[#006241] text-white shadow-sm hover:bg-[#004d33]' : 'text-foreground hover:bg-card')}>
                        {item.name || item.code}
                      </button>)}
                      <button type="button" role="tab" aria-selected={activeBuilding === 'all'} onClick={() => selectBuilding('all')}
                        id="building-tab-all" aria-controls="building-panel" tabIndex={activeBuilding === 'all' ? 0 : -1}
                        className={cn(buildingTabClassName, activeBuilding === 'all' ? 'bg-[#006241] text-white shadow-sm hover:bg-[#004d33]' : 'text-foreground hover:bg-card')}>All Buildings</button>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="font-medium">{title}</span>
                    <span aria-hidden="true" className="text-muted-foreground">&middot;</span>
                    <span className="text-muted-foreground">{data.selectedCycle.label}</span>
                    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[10px] font-medium',
                      statusLabel === 'Active' ? 'bg-[#d4e9e2] text-[#004d33]'
                        : statusLabel === 'Cancelled' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                          : 'bg-muted text-muted-foreground')}>
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{statusLabel}
                    </span>
                  </div>
                </div>
                {cycles.length > 0 && <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-2">
                  <div className="flex max-w-full gap-1 overflow-x-auto p-0.5" role="tablist" aria-label="Cycle processes" onKeyDown={navigateTabs}>
                    {detailTabs.map(item => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)}
                      id={`detail-tab-${item.key}`} aria-controls="cycle-details-panel" tabIndex={tab === item.key ? 0 : -1}
                      className={cn(processTabClassName, tab === item.key ? 'border-[#83b8a4] bg-[#d4e9e2] font-semibold text-[#004d33]' : 'border-transparent text-foreground hover:bg-muted')}>{item.label}</button>)}
                  </div>
                  <span className="text-[10px] leading-4 text-muted-foreground" title="A dash means not recorded or incomplete">Updated {result?.loadedAt}</span>
                </div>}
              </div>

              <section id="building-panel" role="tabpanel" aria-labelledby={`building-tab-${activeBuilding}`} className="min-w-0 space-y-2 pt-2">
              {!cycles.length ? <div className="rounded-lg border bg-card p-12 text-center"><h2 className="text-sm font-medium">No records in this cycle</h2><p className="mt-2 text-xs text-muted-foreground">{title} has no non-void placement in {data.selectedCycle.label}.</p></div> : <>
                <div id="cycle-details-panel" role="tabpanel" aria-labelledby={`detail-tab-${tab}`} className="grid items-start gap-2 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <CycleDetails cycles={cycles} farmName={farm.name} buildingName={title} />
                  <div className="min-w-0 space-y-2">
                    {tab !== 'overview' ? <TransactionDetails tab={tab} cycles={cycles} /> : <>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard title="Placement" icon={Bird} onClick={() => drillDown('placement')}><Metric label="Total good birds" value={formatNumber(metrics.placed, 0)} unit="birds" /></MetricCard>
                        <MetricCard title="Population" icon={Activity} onClick={() => drillDown('growing')} note={`Growing population (${formatNumber(metrics.population, 0)}) - mortality (${formatNumber(metrics.mortality, 0)}) - thinning (${formatNumber(metrics.thinning, 0)}) - harvest (${formatNumber(metrics.deliveredHeads, 0)}) - clean-up (${formatNumber(metrics.cleanupHeads, 0)}).`}><Metric label="Remaining birds" value={formatNumber(metrics.remaining, 0)} /></MetricCard>
                        <MetricCard title="Age" note="Maximum displayed age: 45 days." icon={CalendarDays} onClick={() => drillDown('growing')}><Metric label="Calendar" value={ageRange(metrics.calendarAges)} unit="days" /><Metric label="Posted Growing" value={ageRange(metrics.postedAges)} unit="days" /></MetricCard>
                        <MetricCard title="Mortality" icon={HeartPulse} onClick={() => drillDown('growing')} note="Cumulative mortality / total good birds placed × 100."><Metric label="Cumulative" value={formatNumber(metrics.mortality, 0)} unit="birds" /><Metric label="Mortality" value={formatNumber(metrics.mortalityPercent)} unit="%" /></MetricCard>
                        <MetricCard title="Feed Consumption" icon={Wheat} onClick={() => drillDown('feed')}><Metric label="Cumulative feed" value={formatNumber(metrics.feed)} unit="kg" /></MetricCard>
                        <MetricCard title="Body Weight" icon={Weight} onClick={() => drillDown('growing')} note={`Latest weight measurement age: ${ageRange(metrics.weightAges)} days.`}><Metric label="Actual" value={formatNumber(metrics.weight)} unit="g" /><Metric label="Standard" value={formatNumber(metrics.standardWeight)} unit="g" /></MetricCard>
                        <MetricCard title="Water Consumption" icon={Droplets} onClick={() => drillDown('growing')}><Metric label="Cumulative water" value={formatNumber(metrics.water)} unit="L" /></MetricCard>
                        <MetricCard title="Delivery" icon={Truck} onClick={() => drillDown('delivery')}><Metric label="Delivered" value={formatNumber(metrics.deliveredHeads, 0)} unit="heads" /><Metric label="Recorded weight" value={metrics.deliveredKg === null ? 'Not recorded' : formatNumber(metrics.deliveredKg)} unit={metrics.deliveredKg === null ? undefined : 'kg'} /></MetricCard>
                      </div>
                      <PerformanceCharts cycles={cycles} />
                      {activeBuilding === 'all' && <BuildingComparison buildings={buildings} onSelect={selectBuilding} />}
                    </>}
                  </div>
                </div>
              </>}
              </section>
            </>}
      </TabsContent>
      <TabsContent value="data" className="min-w-0">
        {loading ? <CycleDashboardSkeleton records />
          : error ? <div role="alert" className="p-6 text-sm text-destructive">{error}</div>
            : data?.selectedCycle ? <CycleReportLayout key={`${farmId}:${data.selectedCycle.key}:${reload}`} requestedCycleId={data.selectedCycle.id} requestedFarmId={farmId} cycleKind={data.selectedCycle.kind} embedded />
              : <div className="rounded-lg border p-6 text-sm text-muted-foreground">This farm does not have a Cycle yet.</div>}
      </TabsContent>
    </Tabs>
    </div>
  </PageShell>
}
