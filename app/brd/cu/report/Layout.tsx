'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import Breadcrumb from '@/lib/Breadcrumb'
import SearchableDropdown from '@/lib/SearchableDropdown'
import UserFarmSearchCombobox from '@/components/ui/UserFarmSearchCombobox'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getCleanupReport, getCleanupReportBuildings, type CleanupReportBuilding, type CleanupReportRow } from './api'

type PeriodMode = 'yearly' | 'monthly'

const formatQuantity = (value: number) => Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 6 })

export default function Layout() {
  const today = useMemo(() => new Date(), [])
  const currentYear = today.getFullYear()
  const [farmId, setFarmId] = useState('')
  const [buildingCode, setBuildingCode] = useState('')
  const [buildings, setBuildings] = useState<CleanupReportBuilding[]>([])
  const [periodMode, setPeriodMode] = useState<PeriodMode>('yearly')
  const [year, setYear] = useState(String(currentYear))
  const [month, setMonth] = useState(String(today.getMonth() + 1))
  const [rows, setRows] = useState<CleanupReportRow[]>([])
  const [loadingBuildings, setLoadingBuildings] = useState(false)
  const [loading, setLoading] = useState(false)

  const years = useMemo(() => Array.from({ length: 11 }, (_, index) => currentYear + 1 - index), [currentYear])
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: new Date(2000, index, 1).toLocaleString('en-PH', { month: 'long' }),
  })), [])
  const buildingOptions = useMemo(() => [
    { id: 0, code: '__ALL__', name: 'All Buildings' },
    ...buildings,
  ], [buildings])
  const period = useMemo(() => {
    const selectedYear = Number(year)
    const selectedMonth = periodMode === 'monthly' ? Number(month) : 1
    const lastMonth = periodMode === 'monthly' ? selectedMonth : 12
    const lastDay = new Date(selectedYear, lastMonth, 0).getDate()
    return {
      from: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
      to: `${selectedYear}-${String(lastMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    }
  }, [month, periodMode, year])

  useEffect(() => {
    setBuildingCode('')
    setRows([])
    const id = Number(farmId)
    if (!id) { setBuildings([]); return }
    setLoadingBuildings(true)
    getCleanupReportBuildings(id)
      .then(setBuildings)
      .catch(error => toast.error(error instanceof Error ? error.message : 'Unable to load buildings'))
      .finally(() => setLoadingBuildings(false))
  }, [farmId])

  const totals = useMemo(() => rows.reduce((sum, row) => ({
    placement: sum.placement + row.totalPlacement,
    mortality: sum.mortality + row.totalMortality,
    delivered: sum.delivered + row.totalDelivered,
    cleaned: sum.cleaned + row.totalCleaned,
  }), { placement: 0, mortality: 0, delivered: 0, cleaned: 0 }), [rows])

  const generate = async () => {
    const selectedFarmId = Number(farmId)
    if (!selectedFarmId) { toast.warning('Select a farm'); return }
    setLoading(true)
    try {
      setRows(await getCleanupReport({ farmId: selectedFarmId, buildingCode, ...period }))
    } catch (error) {
      setRows([])
      toast.error(error instanceof Error ? error.message : 'Unable to generate Clean Up Report')
    } finally { setLoading(false) }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-3 sm:p-4">
      <Breadcrumb FirstPreviewsPageName="Broiler" CurrentPageName="Clean Up Report" />
      <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 p-4">
          <h1 className="text-xl font-semibold">Clean Up Report</h1>
          <p className="mt-1 text-sm text-stone-500">Posted Clean Up cycles filtered by flock placement date.</p>
        </div>
        <div className="grid gap-3 border-b border-stone-200 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <div className="lg:col-span-2"><UserFarmSearchCombobox label="Farm" required value={farmId} onValueChange={setFarmId} /></div>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium">Building <span className="font-normal text-stone-500">(Optional)</span></span>
            <SearchableDropdown list={buildingOptions} codeLabel="code" nameLabel="name" showNameOnly value={buildingCode || '__ALL__'} disabled={!farmId || loadingBuildings} placeholder={farmId ? 'All Buildings' : 'Select farm first'} width={360} onChange={value => { setRows([]); setBuildingCode(value === '__ALL__' ? '' : value) }} />
          </label>
          <label className="space-y-1"><span className="text-sm font-medium">Period</span><Select value={periodMode} onValueChange={value => { setRows([]); setPeriodMode(value as PeriodMode) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yearly">Yearly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></label>
          <label className="space-y-1"><span className="text-sm font-medium">Year</span><Select value={year} onValueChange={value => { setRows([]); setYear(value) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{years.map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></label>
          {periodMode === 'monthly' && <label className="space-y-1"><span className="text-sm font-medium">Month</span><Select value={month} onValueChange={value => { setRows([]); setMonth(value) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{months.map(value => <SelectItem key={value.value} value={value.value}>{value.label}</SelectItem>)}</SelectContent></Select></label>}
          <div className="text-xs text-stone-500 lg:col-span-2">Placement Date: {period.from} to {period.to}</div>
          <Button type="button" onClick={() => void generate()} disabled={loading || !farmId}>{loading && <Loader2 className="size-4 animate-spin" />}Generate</Button>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1050px]">
            <TableHeader><TableRow><TableHead>Building</TableHead><TableHead>Flock Card</TableHead><TableHead className="text-right">Growing #</TableHead><TableHead className="text-right">Age</TableHead><TableHead className="text-right">Total Placement</TableHead><TableHead className="text-right">Total Mortality</TableHead><TableHead className="text-right">Total Delivered</TableHead><TableHead className="text-right">Total (TO) Cleaned</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={8} className="h-32 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow>
                : rows.length === 0 ? <TableRow><TableCell colSpan={8} className="h-32 text-center text-stone-500">Select filters and generate the report.</TableCell></TableRow>
                  : rows.map(row => <TableRow key={row.flockCardId}><TableCell className="font-medium">{row.buildingName || row.buildingCode}</TableCell><TableCell>{row.flockCard || '-'}</TableCell><TableCell className="text-right tabular-nums">{row.growingNumber || '-'}</TableCell><TableCell className="text-right tabular-nums">{row.age}</TableCell><TableCell className="text-right tabular-nums">{formatQuantity(row.totalPlacement)}</TableCell><TableCell className="text-right tabular-nums">{formatQuantity(row.totalMortality)}</TableCell><TableCell className="text-right tabular-nums">{formatQuantity(row.totalDelivered)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{formatQuantity(row.totalCleaned)}</TableCell></TableRow>)}
            </TableBody>
            {rows.length > 0 && <TableFooter><TableRow><TableCell colSpan={4} className="text-right uppercase">Total</TableCell><TableCell className="text-right">{formatQuantity(totals.placement)}</TableCell><TableCell className="text-right">{formatQuantity(totals.mortality)}</TableCell><TableCell className="text-right">{formatQuantity(totals.delivered)}</TableCell><TableCell className="text-right">{formatQuantity(totals.cleaned)}</TableCell></TableRow></TableFooter>}
          </Table>
        </div>
      </section>
    </main>
  )
}
