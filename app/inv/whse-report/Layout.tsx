'use client'

import Breadcrumb from '@/lib/Breadcrumb'
import InventoryReportParameters from '@/components/reports/InventoryReportParameters'
import DynamicTable from '@/components/ui/DataTableV2'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { useSyncDefaultFarm } from '@/lib/farms/useDefaultFarmSelection'
import { FileSpreadsheet, Printer } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  getWarehouseReport,
  getWarehouseReportFarms,
  getWarehouseReportWarehouses,
  type WarehouseReportFarm,
  type WarehouseReportRow,
  type WarehouseReportWarehouse,
} from './api'
import { exportWarehouseReportExcel } from './excelExport'
import { printWarehouseReport } from './pdfExport'
import { isDateInput, toLocalDateInput } from '@/lib/reports/warehouseReportLink'

const formatQuantity = (value: number) =>
  Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 6 })

export default function Layout() {
  const searchParams = useSearchParams()
  const { getValue } = useGlobalContext()
  const today = useMemo(() => new Date(), [])
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today])
  const requestedFarmId = searchParams.get('farmId')?.trim() ?? ''
  const requestedWarehouseCode = searchParams.get('warehouse')?.trim() ?? ''
  const requestedFrom = searchParams.get('from')?.trim() ?? ''
  const requestedTo = searchParams.get('to')?.trim() ?? ''
  const autoGenerateFromBatchTrail = searchParams.get('source') === 'batchTrail'
  const autoGenerateHandledRef = useRef(false)
  const [farms, setFarms] = useState<WarehouseReportFarm[]>([])
  const [selectedFarmCode, setSelectedFarmCode] = useState('')
  const [warehouses, setWarehouses] = useState<WarehouseReportWarehouse[]>([])
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [from, setFrom] = useState(() => isDateInput(requestedFrom) ? requestedFrom : toLocalDateInput(monthStart))
  const [to, setTo] = useState(() => isDateInput(requestedTo) ? requestedTo : toLocalDateInput(today))
  const [separateByBatch, setSeparateByBatch] = useState(true)
  const [rows, setRows] = useState<WarehouseReportRow[]>([])
  const [loadingFarms, setLoadingFarms] = useState(true)
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getWarehouseReportFarms()
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
  }, [getValue, requestedFarmId])

  const selectedFarm = useMemo(
    () => farms.find(farm => farm.code === selectedFarmCode),
    [farms, selectedFarmCode],
  )
  useSyncDefaultFarm(selectedFarm?.id)

  useEffect(() => {
    let active = true

    setWarehouses([])
    setSelectedCodes([])
    setRows([])

    if (!selectedFarm) return () => { active = false }

    setLoadingWarehouses(true)
    getWarehouseReportWarehouses(selectedFarm.id)
      .then(data => {
        if (!active) return

        setWarehouses(data)
        if (String(selectedFarm.id) === requestedFarmId && requestedWarehouseCode) {
          const requestedWarehouse = data.find(warehouse =>
            warehouse.code.toUpperCase() === requestedWarehouseCode.toUpperCase())
          setSelectedCodes(requestedWarehouse ? [requestedWarehouse.code] : [])
        }
      })
      .catch(error => {
        console.error(error)
        if (active) toast.error('Unable to load warehouses')
      })
      .finally(() => {
        if (active) setLoadingWarehouses(false)
      })

    return () => { active = false }
  }, [requestedFarmId, requestedWarehouseCode, selectedFarm])

  const generate = useCallback(async () => {
    if (!selectedFarm) {
      toast.warning('Select a farm')
      return
    }
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
      setRows(await getWarehouseReport({
        farmId: selectedFarm.id,
        warehouseCodes: selectedCodes,
        from,
        to,
        separateByBatch,
      }))
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Unable to generate warehouse report')
    } finally {
      setLoading(false)
    }
  }, [from, selectedCodes, selectedFarm, separateByBatch, to])

  useEffect(() => {
    if (!autoGenerateFromBatchTrail || autoGenerateHandledRef.current) return
    if (loadingFarms || loadingWarehouses || !selectedFarm || selectedCodes.length === 0) return
    if (String(selectedFarm.id) !== requestedFarmId) return
    if (!selectedCodes.some(code => code.toUpperCase() === requestedWarehouseCode.toUpperCase())) return

    autoGenerateHandledRef.current = true
    void generate()
  }, [
    autoGenerateFromBatchTrail,
    generate,
    loadingFarms,
    loadingWarehouses,
    requestedFarmId,
    requestedWarehouseCode,
    selectedCodes,
    selectedFarm,
  ])

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

      <InventoryReportParameters
        farms={farms}
        selectedFarmCode={selectedFarmCode}
        onFarmChange={setSelectedFarmCode}
        loadingFarms={loadingFarms}
        selectedFarm={selectedFarm}
        warehouses={warehouses}
        selectedCodes={selectedCodes}
        onSelectedCodesChange={value => {
          setRows([])
          setSelectedCodes(value)
        }}
        loadingWarehouses={loadingWarehouses}
        from={from}
        onFromChange={value => {
          setRows([])
          setFrom(value)
        }}
        to={to}
        onToChange={value => {
          setRows([])
          setTo(value)
        }}
        loading={loading}
        onGenerate={() => void generate()}
      >
        <label className="flex h-9 items-center gap-2 whitespace-nowrap rounded-md border px-3">
          <Checkbox checked={separateByBatch} onCheckedChange={checked => {
            setRows([])
            setSeparateByBatch(checked === true)
          }} />
          <span className="text-sm font-medium">Separate by batch</span>
        </label>
      </InventoryReportParameters>

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
        pageSizeOptions={[25, 50, 100, 'Full']}
        rowKey="id"
        emptyMessage="Select warehouses and generate the report."
        searchPlaceholder="Search warehouse movements..."
      />
    </div>
  )
}
