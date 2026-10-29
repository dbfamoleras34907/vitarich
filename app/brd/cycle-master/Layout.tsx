'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, subMonths } from 'date-fns'
import { CalendarPlus, ChevronDown, ChevronRight, Loader2, LockKeyhole, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import { encryptData } from '@/app/utils/supabase/url-encryption'
import SearchableCombobox from '@/components/SearchableCombobox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import UserFarmSearchCombobox from '@/components/ui/UserFarmSearchCombobox'
import { usePermission } from '@/hooks/usePermission'
import Breadcrumb from '@/lib/Breadcrumb'
import { isWithinDateRange } from '@/lib/filters/dateRange'
import {
  getBroilerPastCycleBuildingOptions,
  getCycleMasterListRows,
  openBroilerPastCycle,
  setBroilerFarmCycleState,
  type BroilerPastCycleBuildingOption,
  type CycleMasterListRow,
} from './api'

const previousMonthValue = () => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() - 1)
  const year = date.getFullYear()
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const todayValue = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const oneMonthAgoValue = () => format(subMonths(new Date(), 1), 'yyyy-MM-dd')

const formatDate = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Unable to load Cycle Master.')
  }
  return 'Unable to load Cycle Master.'
}

export default function CycleMasterLayout() {
  const router = useRouter()
  const viewBlocked = usePermission('/brd/cycle-master/view')
  const editBlocked = usePermission('/brd/cycle-master/edit')
  const [selectedFarmId, setSelectedFarmId] = useState('')
  const [rows, setRows] = useState<CycleMasterListRow[]>([])
  const [cycleTab, setCycleTab] = useState<'open' | 'closed'>('open')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionTarget, setActionTarget] = useState<{ row: CycleMasterListRow; action: 'close' | 'reopen' } | null>(null)
  const [savingAction, setSavingAction] = useState(false)
  const [closeDate, setCloseDate] = useState(todayValue)
  const [closeReason, setCloseReason] = useState('')
  const [pastCycleOpen, setPastCycleOpen] = useState(false)
  const [pastCycleMonth, setPastCycleMonth] = useState(previousMonthValue)
  const [pastCycleBuildingId, setPastCycleBuildingId] = useState('')
  const [pastCycleBuildings, setPastCycleBuildings] = useState<BroilerPastCycleBuildingOption[]>([])
  const [loadingPastCycleBuildings, setLoadingPastCycleBuildings] = useState(false)
  const [savingPastCycle, setSavingPastCycle] = useState(false)
  const [openCyclesExpanded, setOpenCyclesExpanded] = useState(true)
  const [pastCyclesExpanded, setPastCyclesExpanded] = useState(false)
  const [dateFrom, setDateFrom] = useState(oneMonthAgoValue)
  const [dateTo, setDateTo] = useState('')

  const activeFarmId = selectedFarmId
  const filteredRows = rows.filter(row => isWithinDateRange(row.createdAt, dateFrom, dateTo))
  const openCycleRows = filteredRows.filter(row => row.status === 'Saved' || row.status === 'Past Open')
  const pastCycleRows = filteredRows.filter(row => row.status !== 'Saved' && row.status !== 'Past Open')
  const cycleGroups = [
    {
      key: 'open',
      label: 'Open Cycles',
      rows: openCycleRows,
      expanded: openCyclesExpanded,
      onExpandedChange: setOpenCyclesExpanded,
    },
    {
      key: 'past',
      label: 'Past Cycles',
      rows: pastCycleRows,
      expanded: pastCyclesExpanded,
      onExpandedChange: setPastCyclesExpanded,
    },
  ]

  const loadRows = useCallback(async () => {
    const farmId = Number(activeFarmId)
    setLoadError('')
    if (!farmId) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      setRows(await getCycleMasterListRows(farmId))
    } catch (error) {
      setRows([])
      setLoadError(errorMessage(error))
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [activeFarmId])

  useEffect(() => { void loadRows() }, [loadRows])

  useEffect(() => {
    if (!pastCycleOpen || !activeFarmId || !pastCycleMonth) {
      setPastCycleBuildings([])
      return
    }
    let cancelled = false
    setPastCycleBuildingId('')
    setLoadingPastCycleBuildings(true)
    getBroilerPastCycleBuildingOptions(Number(activeFarmId), pastCycleMonth)
      .then(buildings => { if (!cancelled) setPastCycleBuildings(buildings) })
      .catch(error => {
        if (!cancelled) {
          setPastCycleBuildings([])
          toast.error(errorMessage(error))
        }
      })
      .finally(() => { if (!cancelled) setLoadingPastCycleBuildings(false) })
    return () => { cancelled = true }
  }, [activeFarmId, pastCycleMonth, pastCycleOpen])

  const applyCycleAction = async () => {
    if (!actionTarget || actionTarget.row.kind !== 'farm') return
    setSavingAction(true)
    try {
      await setBroilerFarmCycleState(actionTarget.action === 'close'
        ? { cycleId: actionTarget.row.id, action: 'close', closedOn: closeDate, reason: closeReason }
        : { cycleId: actionTarget.row.id, action: 'reopen' })
      toast.success(actionTarget.action === 'close' ? 'Cycle force closed.' : 'Cycle reopened as Past Open Cycle.')
      setActionTarget(null)
      setCloseReason('')
      await loadRows()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSavingAction(false)
    }
  }

  const applyOpenPastCycle = async () => {
    const farmId = Number(activeFarmId)
    const buildingWarehouseId = Number(pastCycleBuildingId)
    if (!farmId || !buildingWarehouseId || !pastCycleMonth) {
      toast.error('Select a past month and building.')
      return
    }
    setSavingPastCycle(true)
    try {
      await openBroilerPastCycle({ farmId, buildingWarehouseId, cycleMonth: pastCycleMonth })
      toast.success('Past Open Cycle created.')
      setPastCycleOpen(false)
      setPastCycleBuildingId('')
      setPastCycleMonth(previousMonthValue())
      await loadRows()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSavingPastCycle(false)
    }
  }

  if (viewBlocked) {
    return (
      <main className="p-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-4" />
            You do not have permission to view Cycle Master.
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-3 sm:p-4">
      <Breadcrumb FirstPreviewsPageName="Broiler" CurrentPageName="Cycle Master" />

      <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Cycle Master</h1>
            <p className="mt-1 text-sm text-muted-foreground">DOC Placement creates the Current Cycle. Cycle Master can create a missing historical cycle, force close an open cycle, or reopen a Closed Cycle.</p>
          </div>
          <div className="flex  gap-2">
            {!editBlocked && (
              <Button type="button" disabled={!activeFarmId} onClick={() => setPastCycleOpen(true)}>
                <CalendarPlus className="size-4" /> Open Past Cycle
              </Button>
            )}
            <Button type="button" variant="outline" disabled={loading || !activeFarmId} onClick={() => void loadRows()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh
            </Button>
          </div>
        </div>

        <div className="border-b border-stone-200 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,24rem)_11rem_11rem] lg:items-end">
            <div className="sm:col-span-2 lg:col-span-1">
              <UserFarmSearchCombobox label="Farm" required value={activeFarmId} onValueChange={farmId => setSelectedFarmId(farmId)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cycle-date-from">From Date</Label>
              <Input
                id="cycle-date-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={event => setDateFrom(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cycle-date-to">To Date</Label>
              <Input
                id="cycle-date-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={event => setDateTo(event.target.value)}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">The date range filters cycles by Created date.</p>
        </div>

        <div className="divide-y divide-border">
          {loading ? (
            <div className="flex h-28 items-center justify-center text-stone-500"><Loader2 className="size-5 animate-spin" /></div>
          ) : !activeFarmId ? (
            <div className="flex h-28 items-center justify-center text-stone-500">Select a farm to view its cycles.</div>
          ) : loadError ? (
            <p role="alert" className="p-4 text-destructive">{loadError}</p>
          ) : rows.length === 0 ? (
            <div className="flex h-28 items-center justify-center text-stone-500">No farm cycles found.</div>
          ) : filteredRows.length === 0 ? (
            <div className="flex h-28 items-center justify-center text-stone-500">No cycles found for the selected date range.</div>
          ) : cycleGroups.map(group => (
            <section key={group.key}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left font-semibold hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                aria-expanded={group.expanded}
                onClick={() => group.onExpandedChange(!group.expanded)}
              >
                {group.expanded
                  ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                <span>{group.label}</span>
                <Badge variant="secondary" className="ml-1 tabular-nums">{group.rows.length}</Badge>
              </button>

              {group.expanded && (
                <div className="overflow-x-auto border-t border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cycle Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Participating Buildings</TableHead>
                        <TableHead className="text-right">Open Buildings</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Closed</TableHead>
                        <TableHead>Reopened</TableHead>
                        <TableHead className="w-40">Action</TableHead>
                        <TableHead className="w-10"><span className="sr-only">Open cycle dashboard</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="h-16 text-center text-muted-foreground">
                            No {group.label.toLowerCase()} found.
                          </TableCell>
                        </TableRow>
                      ) : group.rows.map(row => (
                        <TableRow
                          key={`${row.kind}:${row.id}`}
                          role="link"
                          tabIndex={0}
                          className="cursor-pointer"
                          onClick={() => router.push(`/brd/dashboard?cycle=${encryptData({ farmId: row.farmId, cycleId: row.id, cycleKind: row.kind })}`)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              router.push(`/brd/dashboard?cycle=${encryptData({ farmId: row.farmId, cycleId: row.id, cycleKind: row.kind })}`)
                            }
                          }}
                        >
                          <TableCell>
                            <div className="font-medium">{row.cycleMask || '-'}</div>
                            {row.kind === 'building' && <div className="text-xs text-muted-foreground">{row.buildingName}</div>}
                          </TableCell>
                          <TableCell><Badge variant={row.status === 'Saved' ? 'default' : 'secondary'}>{row.displayStatus}</Badge></TableCell>
                          <TableCell className="text-right">{row.participatingBuildings}</TableCell>
                          <TableCell className="text-right">{row.openBuildings}</TableCell>
                          <TableCell>{formatDate(row.createdAt)}</TableCell>
                          <TableCell>
                            <div>{formatDate(row.closedAt)}</div>
                            {row.closedByName && <div className="text-xs text-muted-foreground">{row.closedByName}</div>}
                            {row.forceClosedOn && <div className="text-xs text-muted-foreground">Closing date: {row.forceClosedOn}</div>}
                            {row.forceCloseReason && <div className="max-w-56 truncate text-xs text-muted-foreground" title={row.forceCloseReason}>{row.forceCloseReason}</div>}
                          </TableCell>
                          <TableCell>
                            <div>{formatDate(row.reopenedAt)}</div>
                            {row.reopenedByName && <div className="text-xs text-muted-foreground">{row.reopenedByName}</div>}
                          </TableCell>
                          <TableCell onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
                            {row.kind === 'farm' && !editBlocked && (row.status === 'Saved' || row.status === 'Past Open') && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCloseDate(todayValue())
                                  setCloseReason('')
                                  setActionTarget({ row, action: 'close' })
                                }}
                              >
                                <LockKeyhole className="size-3.5" /> Force Close
                              </Button>
                            )}
                            {row.kind === 'farm' && !editBlocked && (row.status === 'Closed' || row.status === 'Force Closed') && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setActionTarget({ row, action: 'reopen' })}
                              >
                                <RotateCcw className="size-3.5" /> Reopen
                              </Button>
                            )}
                          </TableCell>
                          <TableCell><ChevronRight className="size-4 text-muted-foreground" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          ))}
        </div>
        </Tabs>
      </section>

      <Dialog open={pastCycleOpen} onOpenChange={open => !savingPastCycle && setPastCycleOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Past Cycle</DialogTitle>
            <DialogDescription>
              Create an empty Past Open Cycle for a historical month.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="past-cycle-month">Past month</Label>
              <Input
                id="past-cycle-month"
                type="month"
                max={previousMonthValue()}
                value={pastCycleMonth}
                disabled={savingPastCycle}
                onChange={event => setPastCycleMonth(event.target.value)}
              />
            </div>
            <SearchableCombobox
              label="Building"
              required
              items={pastCycleBuildings.map(building => ({
                code: String(building.id),
                name: `${building.code}${building.name ? ` - ${building.name}` : ''}`,
              }))}
              value={pastCycleBuildingId}
              onValueChange={setPastCycleBuildingId}
              placeholder={loadingPastCycleBuildings ? 'Loading buildings...' : 'Select a building'}
              showCode={false}
              disabled={loadingPastCycleBuildings || savingPastCycle || !pastCycleMonth}
              contentPositionerZIndex={310}
              className="w-full max-w-none"
            />
            {!loadingPastCycleBuildings && pastCycleMonth && pastCycleBuildings.length === 0 && (
              <p className="text-sm text-muted-foreground">No active building is available for the selected month.</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={savingPastCycle}>Cancel</Button></DialogClose>
            <Button
              type="button"
              disabled={savingPastCycle || loadingPastCycleBuildings || !pastCycleBuildingId || !pastCycleMonth}
              onClick={() => void applyOpenPastCycle()}
            >
              {savingPastCycle && <Loader2 className="size-4 animate-spin" />}
              Open Past Cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(actionTarget)} onOpenChange={open => !savingAction && !open && setActionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionTarget?.action === 'close' ? 'Force Close this cycle?' : 'Reopen this cycle?'}</DialogTitle>
            <DialogDescription>
              {actionTarget?.action === 'close'
                ? 'This closes the cycle and its linked open building cycles even when transactions are unfinished. A new Current Cycle can then be created through DOC Placement.'
                : 'The cycle will become a Past Open Cycle. Existing module validations still apply.'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            Cycle {actionTarget?.row.cycleMask || actionTarget?.row.cycleNumber || '-'}
          </div>
          {actionTarget?.action === 'close' && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="force-close-date">Closing date <span className="text-destructive">*</span></Label>
                <Input id="force-close-date" type="date" value={closeDate} disabled={savingAction} onChange={event => setCloseDate(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="force-close-reason">Reason / remarks <span className="text-destructive">*</span></Label>
                <Textarea id="force-close-reason" value={closeReason} maxLength={1000} disabled={savingAction} placeholder="Why is this cycle being force closed?" onChange={event => setCloseReason(event.target.value)} />
                <p className="text-right text-xs text-muted-foreground">{closeReason.length}/1000</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={savingAction}>Cancel</Button></DialogClose>
            <Button type="button" disabled={savingAction || (actionTarget?.action === 'close' && (!closeDate || !closeReason.trim()))} onClick={() => void applyCycleAction()}>
              {savingAction && <Loader2 className="size-4 animate-spin" />}
              {actionTarget?.action === 'close' ? 'Force Close Cycle' : 'Reopen as Past Open Cycle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
