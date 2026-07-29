'use client'

export const dynamic = 'force-dynamic'

import Breadcrumb from '@/lib/Breadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import DynamicTable from '@/components/ui/DataTableV2'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getInventoryPostings, InventoryPostingData } from './api'
import { getWarehouses } from '../warehouse/api'
import { getWarehouseFarmOptions, type WarehouseFarmOption } from '../warehouse/new/api'
import type { WarehouseData } from '@/lib/types'

export default function Layout() {

  const [data, setData] = useState<InventoryPostingData[]>([])
  const [initialRows, setInitialRows] = useState<RowDataKey[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [farms, setFarms] = useState<WarehouseFarmOption[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [filters, setFilters] = useState({
    farm_id: '',
    from: '',
    to: '',
  })

  const fetchData = useCallback(async () => {
    setIsLoading(true)

    const result = await getInventoryPostings(filters)

    if (result.success && Array.isArray(result.data)) {
      setData(result.data)

      const rows: RowDataKey[] = result.data.map((row) => ({
        id: row.id,
        created_at: new Date(row.created_at).toLocaleDateString(),
        source_doc_type: row.source_doc_type,
        source_docentry: row.source_docentry,
        item_code: row.item_code,
        transfer_type: row.transfer_type,
        warehouse_code: row.warehouse_code,
        qty: row.qty,
        batch_number: row.batch_number,
        ref: row.ref,
        ref_type: row.ref_type,
        ref2: row.ref2,
        ref_type2: row.ref_type2,
      }))

      setInitialRows(rows)

    } else {
      console.error(result.error)
    }

    setIsLoading(false)
  }, [filters])

  useEffect(() => {
    let active = true

    Promise.all([getWarehouses(), getWarehouseFarmOptions()]).then(
      ([warehouseResult, farmResult]) => {
        if (!active) return

        if (warehouseResult.success && Array.isArray(warehouseResult.data)) {
          setWarehouses(warehouseResult.data)
        }
        if (farmResult.success && Array.isArray(farmResult.data)) {
          setFarms(farmResult.data)
        }
      }
    )

    return () => {
      active = false
    }
  }, [])

  const warehouseNamesByCode = useMemo(
    () => new Map(
      warehouses.map((warehouse) => [
        String(warehouse.whse_code ?? '').trim().toUpperCase(),
        warehouse.whse_name ?? '',
      ])
    ),
    [warehouses]
  )

  const tableRows = useMemo(
    () => initialRows.map((row) => ({
      ...row,
      warehouse_name: warehouseNamesByCode.get(
        String(row.warehouse_code ?? '').trim().toUpperCase()
      ) || '-',
    })),
    [initialRows, warehouseNamesByCode]
  )

  const tableColumns: ColumnConfig[] = useMemo(
    () => [
      { key: 'id', label: 'ID', type: 'text', disabled: true },
      { key: 'created_at', label: 'Date', type: 'text', disabled: true },
      { key: 'source_doc_type', label: 'Doc Type', type: 'text', disabled: true },
      { key: 'source_docentry', label: 'Doc Entry', type: 'text', disabled: true },
      { key: 'item_code', label: 'Item', type: 'text', disabled: true },
      { key: 'transfer_type', label: 'Type', type: 'text', disabled: true },
      { key: 'warehouse_code', label: 'Warehouse Code', type: 'text', disabled: true },
      { key: 'warehouse_name', label: 'Warehouse Name', type: 'text', disabled: true },
      { key: 'qty', label: 'Qty', type: 'text', disabled: true },
      { key: 'batch_number', label: 'Batch', type: 'text', disabled: true },
      { key: 'ref', label: 'Reference', type: 'text', disabled: true },
      { key: 'ref_type', label: 'Reference Type', type: 'text', disabled: true },
      { key: 'ref2', label: 'Reference 2', type: 'text', disabled: true },
      { key: 'ref_type2', label: 'Reference Type 2', type: 'text', disabled: true },
    ],
    []
  )

  return (
    <div className='p-6 space-y-4'>

      <Breadcrumb CurrentPageName='Inventory Audit Report' />

      <Separator />

      {/* Filters */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-3 items-end'>
        <label className="space-y-1">
          <span className="text-sm font-medium">Farm</span>
          <select
            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={filters.farm_id}
            onChange={(e) => setFilters({ ...filters, farm_id: e.target.value })}
          >
            <option value="">All Farms</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.code} - {farm.name || 'Unnamed farm'}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">From Date</span>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">To Date</span>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </label>

        <Button onClick={fetchData} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Generate'}
        </Button>
      </div>

      <Separator />

      {/* Summary */}
      <div className='flex justify-between font-semibold'>
        <div>Total Records: {data.length}</div>
        {/* <div>Total Qty: {totalQty}</div> */}
      </div>

      {/* Dynamic Table */}
      <DynamicTable
      loading={isLoading}
        initialFilters={[]}
        columns={tableColumns.map((col) => ({
          key: col.key,
          label: col.label,
          align: 'left',
          render: (row: RowDataKey) => {
            const value = row[col.key]
            if (!value) return "-"
            return String(value)
          },
        }))}
        data={tableRows}
        pageSizeOptions={[25, 50, 100]}
      />

    </div>
  )
}
