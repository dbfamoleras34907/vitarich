'use client'

import Breadcrumb from '@/lib/Breadcrumb'
import InventoryReportParameters from '@/components/reports/InventoryReportParameters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { useSyncDefaultFarm } from '@/lib/farms/useDefaultFarmSelection'
import {
  convertFeedInventoryQuantity,
  type FeedInventorySummary,
  type FeedInventoryUnit,
} from '@/lib/reports/feedInventoryReport'
import { AlertTriangle, ChevronDown, ChevronRight, FileSpreadsheet, Search } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  getFeedInventoryReport,
  getFeedInventoryReportFarms,
  getFeedInventoryReportWarehouses,
  type FeedInventoryReportFarm,
  type FeedInventoryReportWarehouse,
} from './api'
import { exportFeedInventoryReportExcel } from './excelExport'

const localDateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

const emptyTotal = () => ({
  beginningBalance: 0,
  receipts: 0,
  transferIn: 0,
  adjustmentsIn: 0,
  consumption: 0,
  otherIssues: 0,
  transferOut: 0,
  adjustmentsOut: 0,
  onHand: 0,
})

export default function Layout() {
  const { getValue } = useGlobalContext()
  const today = useMemo(() => new Date(), [])
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today])
  const [farms, setFarms] = useState<FeedInventoryReportFarm[]>([])
  const [selectedFarmCode, setSelectedFarmCode] = useState('')
  const [warehouses, setWarehouses] = useState<FeedInventoryReportWarehouse[]>([])
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [from, setFrom] = useState(() => localDateInput(monthStart))
  const [to, setTo] = useState(() => localDateInput(today))
  const [unit, setUnit] = useState<FeedInventoryUnit>('BAGS')
  const [summaries, setSummaries] = useState<FeedInventorySummary[]>([])
  const [warning, setWarning] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loadingFarms, setLoadingFarms] = useState(true)
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getFeedInventoryReportFarms()
      .then(data => {
        setFarms(data)
        const defaultFarmId = getValue('DefaultFarmId')
        const defaultFarm = data.find(farm => String(farm.id) === String(defaultFarmId))
        setSelectedFarmCode(current => current || defaultFarm?.code || '')
      })
      .catch(error => {
        console.error(error)
        toast.error('Unable to load farms')
      })
      .finally(() => setLoadingFarms(false))
  }, [getValue])

  const selectedFarm = useMemo(
    () => farms.find(farm => farm.code === selectedFarmCode),
    [farms, selectedFarmCode],
  )
  useSyncDefaultFarm(selectedFarm?.id)

  useEffect(() => {
    let active = true
    setWarehouses([])
    setSelectedCodes([])
    setSummaries([])
    setWarning('')
    if (!selectedFarm) return () => { active = false }

    setLoadingWarehouses(true)
    getFeedInventoryReportWarehouses(selectedFarm.id)
      .then(data => {
        if (active) setWarehouses(data)
      })
      .catch(error => {
        console.error(error)
        if (active) toast.error('Unable to load warehouses')
      })
      .finally(() => {
        if (active) setLoadingWarehouses(false)
      })

    return () => { active = false }
  }, [selectedFarm])

  const clearResults = () => {
    setSummaries([])
    setWarning('')
    setExpanded(new Set())
  }

  const generate = async () => {
    if (!selectedFarm) return void toast.warning('Select a farm')
    if (selectedCodes.length === 0) return void toast.warning('Select at least one warehouse or building')
    if (!from || !to) return void toast.warning('From Date and To Date are required')
    if (from > to) return void toast.warning('From Date cannot be after To Date')

    setLoading(true)
    try {
      const result = await getFeedInventoryReport({
        farmId: selectedFarm.id,
        warehouseCodes: selectedCodes,
        from,
        to,
      })
      setSummaries(result.summaries)
      setWarning(result.warning)
      setExpanded(new Set())
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Unable to generate feed inventory report')
    } finally {
      setLoading(false)
    }
  }

  const visibleSummaries = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return summaries
    return summaries.filter(row => [row.warehouseCode, row.warehouseName, row.itemCode, row.itemName]
      .some(value => value.toLowerCase().includes(term)))
  }, [search, summaries])
  const totals = useMemo(() => visibleSummaries.reduce((result, row) => {
    result.beginningBalance += row.beginningBalance
    result.receipts += row.receipts
    result.transferIn += row.transferIn
    result.adjustmentsIn += row.adjustmentsIn
    result.consumption += row.consumption
    result.otherIssues += row.otherIssues
    result.transferOut += row.transferOut
    result.adjustmentsOut += row.adjustmentsOut
    result.onHand += row.onHand
    return result
  }, emptyTotal()), [visibleSummaries])
  const quantity = (value: number) => convertFeedInventoryQuantity(value, unit)
    .toLocaleString('en-PH', { maximumFractionDigits: unit === 'BAGS' ? 3 : 2 })
  const unitLabel = unit === 'BAGS' ? 'bags' : 'kg'
  const allVisibleExpanded = visibleSummaries.length > 0 && visibleSummaries.every(row => expanded.has(row.id))

  return (
    <div className="space-y-4 p-3 md:p-4">
      <Breadcrumb CurrentPageName="Feed Inventory Report" />
      <Separator />

      <InventoryReportParameters
        farms={farms}
        selectedFarmCode={selectedFarmCode}
        onFarmChange={value => {
          clearResults()
          setSelectedFarmCode(value)
        }}
        loadingFarms={loadingFarms}
        selectedFarm={selectedFarm}
        warehouses={warehouses}
        selectedCodes={selectedCodes}
        onSelectedCodesChange={value => {
          clearResults()
          setSelectedCodes(value)
        }}
        loadingWarehouses={loadingWarehouses}
        from={from}
        onFromChange={value => {
          clearResults()
          setFrom(value)
        }}
        to={to}
        onToChange={value => {
          clearResults()
          setTo(value)
        }}
        loading={loading}
        onGenerate={() => void generate()}
      >
        <label className="space-y-1">
          <span className="text-sm font-medium">Display Unit</span>
          <Select value={unit} onValueChange={value => setUnit(value as FeedInventoryUnit)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BAGS">Bags (50 kg)</SelectItem>
              <SelectItem value="KG">Kilograms</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </InventoryReportParameters>

      <Separator />

      {warning && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold">Feed inventory</div>
          <div className="text-sm text-muted-foreground">
            {summaries.length.toLocaleString()} feed balance{summaries.length === 1 ? '' : 's'} · quantities in {unitLabel}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-56">
            {/* <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /> */}
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search feed or warehouse..." className="pl-8" />
          </div>
          <Button
            variant="outline"
            disabled={visibleSummaries.length === 0}
            onClick={() => setExpanded(allVisibleExpanded ? new Set() : new Set(visibleSummaries.map(row => row.id)))}
          >
            {allVisibleExpanded ? 'Collapse all' : 'Expand all'}
          </Button>
          <Button
            variant="outline"
            disabled={summaries.length === 0}
            onClick={() => void exportFeedInventoryReportExcel(summaries, unit).catch(error =>
              toast.error(error instanceof Error ? error.message : 'Unable to export Excel workbook'))}
          >
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table containerClassName="max-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Warehouse / Building</TableHead>
              <TableHead>Feed</TableHead>
              {['Beginning', 'Receipts', 'Transfer In', 'Adjustment In', 'Consumption', 'Other Issues', 'Transfer Out', 'Adjustment Out', 'On Hand'].map(label => (
                <TableHead key={label} className="text-right">{label}<div className="normal-case font-normal">({unitLabel})</div></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && visibleSummaries.map(row => {
              const isExpanded = expanded.has(row.id)
              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    className="cursor-pointer font-medium"
                    onClick={() => setExpanded(current => {
                      const next = new Set(current)
                      if (next.has(row.id)) next.delete(row.id)
                      else next.add(row.id)
                      return next
                    })}
                  >
                    <TableCell>{isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</TableCell>
                    <TableCell><div>{row.warehouseCode}</div><div className="text-xs font-normal text-muted-foreground">{row.warehouseName || '-'}</div></TableCell>
                    <TableCell><div>{row.itemCode}</div><div className="text-xs font-normal text-muted-foreground">{row.itemName || '-'}</div></TableCell>
                    <TableCell className="text-right">{quantity(row.beginningBalance)}</TableCell>
                    <TableCell className="text-right">{quantity(row.receipts)}</TableCell>
                    <TableCell className="text-right">{quantity(row.transferIn)}</TableCell>
                    <TableCell className="text-right">{quantity(row.adjustmentsIn)}</TableCell>
                    <TableCell className="text-right">{quantity(row.consumption)}</TableCell>
                    <TableCell className="text-right">{quantity(row.otherIssues)}</TableCell>
                    <TableCell className="text-right">{quantity(row.transferOut)}</TableCell>
                    <TableCell className="text-right">{quantity(row.adjustmentsOut)}</TableCell>
                    <TableCell className="text-right font-semibold">{quantity(row.onHand)}</TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={12} className="p-2 md:p-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date/Time</TableHead><TableHead>Document Type</TableHead><TableHead>Document No.</TableHead>
                              <TableHead>Reference</TableHead><TableHead>Movement</TableHead><TableHead className="text-right">IN ({unitLabel})</TableHead>
                              <TableHead className="text-right">OUT ({unitLabel})</TableHead><TableHead className="text-right">Running On Hand ({unitLabel})</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {row.movements.map(movement => (
                              <TableRow key={movement.id}>
                                <TableCell>{new Date(movement.createdAt).toLocaleString('en-PH')}</TableCell>
                                <TableCell>{movement.sourceDocType}</TableCell>
                                <TableCell>{movement.documentUrl ? <Link href={movement.documentUrl} className="text-primary underline-offset-2 hover:underline">{movement.documentNo}</Link> : movement.documentNo}</TableCell>
                                <TableCell>{movement.reference || '-'}</TableCell>
                                <TableCell>{movement.category}</TableCell>
                                <TableCell className="text-right">{movement.inQty ? quantity(movement.inQty) : '-'}</TableCell>
                                <TableCell className="text-right">{movement.outQty ? quantity(movement.outQty) : '-'}</TableCell>
                                <TableCell className="text-right font-medium">{quantity(movement.runningOnHand)}</TableCell>
                              </TableRow>
                            ))}
                            {row.movements.length === 0 && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No movements in the selected period.</TableCell></TableRow>}
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })}
            {!loading && visibleSummaries.length === 0 && (
              <TableRow><TableCell colSpan={12} className="py-10 text-center text-muted-foreground">Select warehouses and generate the report.</TableCell></TableRow>
            )}
            {loading && <TableRow><TableCell colSpan={12} className="py-10 text-center text-muted-foreground">Generating feed inventory report...</TableCell></TableRow>}
          </TableBody>
          {visibleSummaries.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell /><TableCell colSpan={2}>Grand Total</TableCell>
                <TableCell className="text-right">{quantity(totals.beginningBalance)}</TableCell>
                <TableCell className="text-right">{quantity(totals.receipts)}</TableCell>
                <TableCell className="text-right">{quantity(totals.transferIn)}</TableCell>
                <TableCell className="text-right">{quantity(totals.adjustmentsIn)}</TableCell>
                <TableCell className="text-right">{quantity(totals.consumption)}</TableCell>
                <TableCell className="text-right">{quantity(totals.otherIssues)}</TableCell>
                <TableCell className="text-right">{quantity(totals.transferOut)}</TableCell>
                <TableCell className="text-right">{quantity(totals.adjustmentsOut)}</TableCell>
                <TableCell className="text-right font-semibold">{quantity(totals.onHand)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}
