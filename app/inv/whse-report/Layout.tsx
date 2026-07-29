'use client'

import Breadcrumb from '@/lib/Breadcrumb'
import DynamicTable from '@/components/ui/DataTableV2'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, FileSpreadsheet, Loader2, Printer } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  getWarehouseReport,
  getWarehouseReportWarehouses,
  type WarehouseReportRow,
  type WarehouseReportWarehouse,
} from './api'
import { exportWarehouseReportExcel } from './excelExport'
import { printWarehouseReport } from './pdfExport'

const dateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatQuantity = (value: number) =>
  Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 6 })

export default function Layout() {
  const today = useMemo(() => new Date(), [])
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today])
  const [warehouses, setWarehouses] = useState<WarehouseReportWarehouse[]>([])
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [warehouseSearch, setWarehouseSearch] = useState('')
  const [from, setFrom] = useState(dateInput(monthStart))
  const [to, setTo] = useState(dateInput(today))
  const [separateByBatch, setSeparateByBatch] = useState(true)
  const [rows, setRows] = useState<WarehouseReportRow[]>([])
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getWarehouseReportWarehouses()
      .then(setWarehouses)
      .catch(error => {
        console.error(error)
        toast.error('Unable to load warehouses')
      })
      .finally(() => setLoadingReferences(false))
  }, [])

  const selectedLabel = selectedCodes.length === 0
    ? 'Select warehouses'
    : selectedCodes.length === 1
      ? selectedCodes[0]
      : `${selectedCodes.length} warehouses selected`

  const filteredWarehouses = useMemo(() => {
    const search = warehouseSearch.trim().toLowerCase()
    if (!search) return warehouses

    return warehouses.filter(warehouse =>
      [warehouse.code, warehouse.name, warehouse.type, warehouse.farmCode]
        .some(value => value.toLowerCase().includes(search)),
    )
  }, [warehouseSearch, warehouses])

  const allFilteredSelected = filteredWarehouses.length > 0
    && filteredWarehouses.every(warehouse => selectedCodes.includes(warehouse.code))

  const toggleWarehouse = (code: string, checked: boolean) => {
    setRows([])
    setSelectedCodes(current =>
      checked ? Array.from(new Set([...current, code])) : current.filter(value => value !== code),
    )
  }

  const generate = async () => {
    if (selectedCodes.length === 0) {
      toast.warning('Select at least one warehouse or building')
      return
    }
    if (!from || !to) {
      toast.warning('From Date and To Date are required')
      return
    }
    if (from > to) {
      toast.warning('From Date cannot be after To Date')
      return
    }

    setLoading(true)
    try {
      setRows(await getWarehouseReport({ warehouseCodes: selectedCodes, from, to, separateByBatch }))
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Unable to generate warehouse report')
    } finally {
      setLoading(false)
    }
  }

  const columns = useMemo(() => [
    {
      key: 'createdAt',
      label: 'Date/Time',
      sortable: true,
      render: (row: WarehouseReportRow) => new Date(row.createdAt).toLocaleString('en-PH'),
    },
    {
      key: 'warehouseCode',
      label: 'Warehouse',
      sortable: true,
      render: (row: WarehouseReportRow) => (
        <div>
          <div className="font-medium">{row.warehouseCode}</div>
          <div className="text-xs text-stone-500">{row.warehouseName || '-'}</div>
        </div>
      ),
    },
    { key: 'sourceDocType', label: 'Document Type', sortable: true },
    {
      key: 'documentNo',
      label: 'Document No.',
      render: (row: WarehouseReportRow) => row.documentUrl
        ? (
          <Button asChild size="xs" variant="outline">
            <Link
              href={row.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {row.documentNo}
            </Link>
          </Button>
        )
        : row.documentNo,
    },
    { key: 'reference', label: 'Reference' },
    {
      key: 'itemCode',
      label: 'Item',
      sortable: true,
      render: (row: WarehouseReportRow) => (
        <div>
          <div className="font-medium">{row.itemCode}</div>
          <div className="text-xs text-stone-500">{row.itemName || '-'}</div>
        </div>
      ),
    },
    ...(separateByBatch ? [{ key: 'batchNumber', label: 'Batch', sortable: true }] : []),
    { key: 'transferType', label: 'Transfer Type', sortable: true },
    {
      key: 'beginningBalance',
      label: 'Beginning Balance',
      align: 'right' as const,
      render: (row: WarehouseReportRow) => formatQuantity(row.beginningBalance),
    },
    {
      key: 'inQty',
      label: 'IN Qty',
      align: 'right' as const,
      render: (row: WarehouseReportRow) => row.inQty ? formatQuantity(row.inQty) : '-',
    },
    {
      key: 'outQty',
      label: 'OUT Qty',
      align: 'right' as const,
      render: (row: WarehouseReportRow) => row.outQty ? formatQuantity(row.outQty) : '-',
    },
    {
      key: 'runningBalance',
      label: 'Running Total',
      align: 'right' as const,
      render: (row: WarehouseReportRow) => <span className="font-semibold">{formatQuantity(row.runningBalance)}</span>,
    },
  ], [separateByBatch])

  return (
    <div className="space-y-4 p-6">
      <Breadcrumb CurrentPageName="Warehouse Report" />
      <Separator />

      <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-[minmax(260px,1.5fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto_auto]">
        <label className="space-y-1">
          <span className="text-sm font-medium">Warehouses / Buildings</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal" disabled={loadingReferences}>
                {loadingReferences ? 'Loading warehouses...' : selectedLabel}
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-80 w-[360px] overflow-y-auto" align="start">
              <div className="sticky top-0 z-10 bg-white p-2">
                <Input
                  autoFocus
                  placeholder="Search code, name, type, or farm..."
                  value={warehouseSearch}
                  onChange={event => setWarehouseSearch(event.target.value)}
                  onKeyDown={event => event.stopPropagation()}
                />
              </div>
              <DropdownMenuLabel className="flex items-center justify-between">
                Select warehouses
                <button type="button" className="text-xs font-normal text-blue-700" onClick={() =>
                  {
                    setRows([])
                    const filteredCodes = new Set(filteredWarehouses.map(row => row.code))
                    setSelectedCodes(current => allFilteredSelected
                      ? current.filter(code => !filteredCodes.has(code))
                      : Array.from(new Set([...current, ...filteredCodes])))
                  }
                }>
                  {allFilteredSelected ? 'Clear visible' : 'Select visible'}
                </button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {filteredWarehouses.map(warehouse => (
                <DropdownMenuCheckboxItem
                  key={warehouse.id}
                  checked={selectedCodes.includes(warehouse.code)}
                  onCheckedChange={checked => toggleWarehouse(warehouse.code, checked === true)}
                  onSelect={event => event.preventDefault()}
                >
                  <span className="min-w-0">
                    <span className="font-medium">{warehouse.code}</span>
                    <span className="ml-2 text-stone-500">{warehouse.name || 'Unnamed'}</span>
                    {(warehouse.type || warehouse.farmCode) && (
                      <span className="ml-2 text-xs text-stone-400">
                        ({[warehouse.type, warehouse.farmCode].filter(Boolean).join(' • ')})
                      </span>
                    )}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
              {filteredWarehouses.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-stone-500">
                  No matching warehouses
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">From Date</span>
          <Input type="date" value={from} onChange={event => {
            setRows([])
            setFrom(event.target.value)
          }} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">To Date</span>
          <Input type="date" value={to} onChange={event => {
            setRows([])
            setTo(event.target.value)
          }} />
        </label>
        <label className="flex h-9 items-center gap-2 whitespace-nowrap rounded-md border px-3">
          <Checkbox checked={separateByBatch} onCheckedChange={checked => {
            setRows([])
            setSeparateByBatch(checked === true)
          }} />
          <span className="text-sm font-medium">Separate by batch</span>
        </label>
        <Button onClick={generate} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Generate
        </Button>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Warehouse movements</div>
          <div className="text-sm text-stone-500">
            {rows.length.toLocaleString()} posted movement{rows.length === 1 ? '' : 's'}, ordered by posting ID
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={rows.length === 0} onClick={() => exportWarehouseReportExcel(rows, separateByBatch)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            disabled={rows.length === 0}
            onClick={() => {
              try {
                printWarehouseReport(rows, { from, to, includeBatch: separateByBatch })
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Unable to print report')
              }
            }}
          >
            <Printer className="mr-2 h-4 w-4" /> PDF / Print
          </Button>
        </div>
      </div>

      <DynamicTable
        loading={loading}
        columns={columns}
        data={rows}
        pageSizeOptions={[25, 50, 100]}
        rowKey="id"
        emptyMessage="Select warehouses and generate the report."
        searchPlaceholder="Search warehouse movements..."
      />
    </div>
  )
}
