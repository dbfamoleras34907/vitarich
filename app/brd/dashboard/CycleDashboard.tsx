'use client'

import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Activity, Bird, CalendarDays, ChevronRight, Droplets, HeartPulse, RefreshCw, Scale, ShieldAlert, Truck, Weight, Wheat } from 'lucide-react'
import { toast } from 'sonner'
import SearchableCombobox from '@/components/SearchableCombobox'
import { Button } from '@/components/ui/button'
import Breadcrumb from '@/lib/Breadcrumb'
import { getInventoryStatusBadgeClass } from '@/app/inv/statusStyles'
import { usePermission } from '@/hooks/usePermission'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { listAssignedUserFarmOptions, type AssignedFarmOption } from '@/lib/data/repositories/farmOptions.client'
import { getBroilerCycleDashboard, type CycleDashboardCatalog, type CycleDashboardData, type DashboardCycleBuilding } from '@/lib/data/repositories/broilerCycleDashboard'
import { activeGrowingLines, ageRange, dashboardMetrics, selectDashboardBuilding } from '@/lib/broiler/cycleDashboard'
import { cn } from '@/lib/utils'
import { BuildingComparison, PerformanceCharts } from './PerformanceCharts'
import TransactionDetails, { detailTabs, formatDate, formatNumber, type DetailTab } from './TransactionDetails'

const errorMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error
  ? String(error.message) : 'Unable to load Cycle Dashboard.'

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
  return <button type="button" onClick={onClick} className="group flex min-h-32 min-w-0 flex-col rounded-lg border border-stone-200 bg-card p-3 text-left transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-primary dark:border-border dark:hover:bg-muted">
    <span className="mb-4 flex w-full items-center gap-2 text-xs font-medium">
      <span className="rounded-md bg-sidebar-accent p-1.5 text-primary"><Icon className="size-3.5" /></span>
      {title}<ChevronRight className="ml-auto size-3.5 text-muted-foreground group-hover:text-primary" />
    </span>
    <span className="grid w-full grid-cols-2 gap-3">{children}</span>
    {note && <span className="mt-3 text-[10px] leading-relaxed text-muted-foreground">{note}</span>}
  </button>
}

function Metric({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return <span className="min-w-0"><span className="mb-1 block text-[10px] text-muted-foreground">{label}</span>
    <span className="block break-words text-lg font-medium tabular-nums leading-tight">{value}{unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}</span></span>
}

const distinct = (values: string[]) => [...new Set(values.filter(Boolean))].join(', ') || '—'

function CycleDetails({ cycles, farmName, buildingName }: { cycles: DashboardCycleBuilding[]; farmName: string; buildingName: string }) {
  const metrics = dashboardMetrics(cycles)
  const placements = cycles.flatMap(cycle => cycle.placements)
  const activityDates = cycles.flatMap(cycle => {
    const age = activeGrowingLines(cycle).at(-1)?.age
    const lastGrowing = age !== undefined && cycle.startDate
      ? new Date(Date.parse(`${cycle.startDate.slice(0, 10)}T00:00:00Z`) + age * 86400000) : null
    return [...cycle.placements.map(row => row.receiveDate), ...cycle.deliveries.map(row => row.date),
      ...cycle.cleanups.map(row => row.date), lastGrowing && Number.isFinite(lastGrowing.getTime()) ? lastGrowing.toISOString().slice(0, 10) : '']
  }).filter(Boolean).sort()
  const details = [
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
    ['DOC batch', distinct(placements.map(row => row.batchNumber))],
    ['Latest activity date', formatDate(activityDates.at(-1) ?? '')],
    ['Status', distinct(cycles.map(cycle => cycle.status === 'Saved' ? 'Active' : cycle.status))],
    ['Remarks', distinct(cycles.map(cycle => cycle.remarks))],
  ]
  return <aside className="min-w-0 self-start rounded-lg border border-stone-200 bg-card p-3 dark:border-border lg:sticky lg:top-3">
    <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold"><Activity className="size-4 text-primary" />Cycle Details</h2>
    <dl className="space-y-2.5 text-[11px]">{details.map(([label, value]) => <div key={label} className="flex items-baseline gap-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <span className="min-w-2 flex-1 border-b border-dotted border-border" aria-hidden="true" />
      <dd className="max-w-[60%] break-words text-right font-medium tabular-nums">{value}</dd>
    </div>)}</dl>
  </aside>
}

export default function CycleDashboard() {
  const { getValue } = useGlobalContext()
  const blocked = usePermission('/brd/dashboard/view')
  const profile = getValue('UserInfoAuthSession')?.[0]
  const profileKey = String(profile?.auth_id ?? profile?.id ?? '')
  const defaultFarm = String(getValue('DefaultFarmId') ?? profile?.default_farm ?? '')
  const [farmState, setFarmState] = useState<{ owner: string; options: AssignedFarmOption[]; error: string } | null>(null)
  const farmsReady = farmState?.owner === profileKey
  const farms = farmsReady ? farmState.options : []
  const farmError = farmsReady ? farmState.error : ''
  const [selectedFarm, setSelectedFarm] = useState('')
  const [selectedBuilding, setSelectedBuilding] = useState('')
  const [cycleSelection, setCycleSelection] = useState<{ farmId: number; key: string } | null>(null)
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

  const farm = farms.find(farm => String(farm.id) === selectedFarm)
    ?? farms.find(farm => String(farm.id) === defaultFarm)
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

  return <main className="min-h-[calc(100vh-4rem)] text-stone-950 dark:text-foreground">
    <header className="mt-2 flex flex-wrap items-center justify-between gap-3">
      <Breadcrumb FirstPreviewsPageName="Broiler" CurrentPageName="Cycle Dashboard" />
      <Button type="button" variant="outline" className="gap-2" onClick={() => setReload(value => value + 1)} disabled={loading} aria-label="Refresh Cycle Dashboard">
        <RefreshCw className={cn('size-4', loading && 'animate-spin')} />{loading ? 'Loading...' : 'Refresh'}
      </Button>
    </header>
    <div className="mt-4 space-y-3 pb-4">
      <div className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 dark:border-border dark:bg-muted/30 md:grid-cols-[minmax(220px,320px)_minmax(220px,320px)]">
        <SearchableCombobox label="Farm" value={farmId ? String(farmId) : ''}
          items={farms.map(farm => ({ code: String(farm.id), name: `${farm.code} - ${farm.name}` }))}
          onValueChange={value => { setSelectedFarm(value); setCycleSelection(null); setSelectedBuilding(''); setTab('overview') }} disabled={!farmsReady} />
        <SearchableCombobox label="Cycle" value={requestedCycleKey || visibleCatalog?.selectedCycle?.key || ''}
          items={cycleOptions.map(cycle => ({ code: cycle.key, name: `${cycle.label} - ${cycle.status === 'Saved' ? 'Active' : cycle.status}` }))}
          placeholder={loading && !cycleOptions.length ? 'Loading cycles...' : 'Select a cycle'}
          disabled={!cycleOptions.length}
          onValueChange={key => { setCycleSelection({ farmId, key }); setSelectedBuilding(''); setTab('overview') }} />
      </div>
    {data?.warnings.map(warning => <div key={warning} role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{warning}</div>)}
    {error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-card p-5 text-sm text-destructive">{error}</div>
      : loading ? <div role="status" aria-label="Loading Cycle Dashboard" className="space-y-3">
        <div className="h-10 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]"><div className="h-[520px] animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-lg bg-muted" />)}</div></div>
      </div>
        : !farm ? <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">No assigned Broiler farms.</div>
          : !data?.selectedCycle ? <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">No cycles found for this farm.</div>
          : !buildings?.length ? <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">No buildings found for this cycle.</div>
            : <>
              <div className="flex overflow-x-auto border-b" role="tablist" aria-label="Buildings" onKeyDown={navigateTabs}>
                {buildings.map(item => <button key={item.key} type="button" role="tab" aria-selected={activeBuilding === item.key}
                  id={`building-tab-${item.key}`} aria-controls="building-panel" tabIndex={activeBuilding === item.key ? 0 : -1}
                  onClick={() => selectBuilding(item.key)} className={cn('flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs', activeBuilding === item.key ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                  <span className={cn('size-1.5 rounded-full', item.cycles.some(cycle => cycle.status === 'Saved') ? 'bg-emerald-500' : 'bg-muted-foreground/40')} aria-hidden="true" />
                  {item.name || item.code}
                </button>)}
                <button type="button" role="tab" aria-selected={activeBuilding === 'all'} onClick={() => selectBuilding('all')}
                  id="building-tab-all" aria-controls="building-panel" tabIndex={activeBuilding === 'all' ? 0 : -1}
                  className={cn('shrink-0 border-b-2 px-3 py-2.5 text-xs', activeBuilding === 'all' ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground')}>All Buildings</button>
              </div>

              <section id="building-panel" role="tabpanel" aria-labelledby={`building-tab-${activeBuilding}`} className="space-y-3">
              {!cycles.length ? <div className="rounded-lg border bg-card p-12 text-center"><h2 className="text-sm font-medium">No records in this cycle</h2><p className="mt-2 text-xs text-muted-foreground">{title} has no non-void placement in {data.selectedCycle.label}.</p></div> : <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-medium">{title}</span><span className="rounded-md bg-sidebar-accent px-2 py-1 font-semibold">{data.selectedCycle.label}</span><span className={getInventoryStatusBadgeClass(statusLabel)}>{statusLabel}</span></div>
                  <span className="text-[10px] text-muted-foreground">Updated {result?.loadedAt} · — means not recorded or incomplete</span>
                </div>
                <div className="flex overflow-x-auto border-b" role="tablist" aria-label="Cycle details" onKeyDown={navigateTabs}>
                  {detailTabs.map(item => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)}
                    id={`detail-tab-${item.key}`} aria-controls="cycle-details-panel" tabIndex={tab === item.key ? 0 : -1}
                    className={cn('shrink-0 border-b-2 px-3 py-2 text-xs', tab === item.key ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{item.label}</button>)}
                </div>
                <div id="cycle-details-panel" role="tabpanel" aria-labelledby={`detail-tab-${tab}`} className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <CycleDetails cycles={cycles} farmName={farm.name} buildingName={title} />
                  <div className="min-w-0 space-y-4">
                    {tab !== 'overview' ? <TransactionDetails tab={tab} cycles={cycles} /> : <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <MetricCard title="Placement" icon={Bird} onClick={() => drillDown('placement')}><Metric label="DOC placed" value={formatNumber(metrics.population, 0)} unit="birds" /></MetricCard>
                        <MetricCard title="Population" icon={Activity} onClick={() => drillDown('growing')} note="Flock Card basis: placed less mortality and thinning. Delivery is shown separately."><Metric label="Remaining birds" value={formatNumber(metrics.remaining, 0)} /></MetricCard>
                        <MetricCard title="Age" icon={CalendarDays} onClick={() => drillDown('growing')}><Metric label="Calendar" value={ageRange(metrics.calendarAges)} unit="days" /><Metric label="Posted Growing" value={ageRange(metrics.postedAges)} unit="days" /></MetricCard>
                        <MetricCard title="Mortality" icon={HeartPulse} onClick={() => drillDown('growing')}><Metric label="Cumulative" value={formatNumber(metrics.mortality, 0)} unit="birds" /><Metric label="Mortality" value={formatNumber(metrics.mortalityPercent)} unit="%" /></MetricCard>
                        <MetricCard title="Feed Consumption" icon={Wheat} onClick={() => drillDown('feed')}><Metric label="Cumulative feed" value={formatNumber(metrics.feed)} unit="kg" /></MetricCard>
                        <MetricCard title="Feed Conversion" icon={Scale} onClick={() => drillDown('feed')} note="Feed kg ÷ (remaining birds × latest weight kg). Uses the Flock Card population basis."><Metric label="Estimated FCR" value={formatNumber(metrics.fcr, 3)} /></MetricCard>
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
    </div>
  </main>
}
