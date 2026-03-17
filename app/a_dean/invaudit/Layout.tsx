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

export default function Layout() {

  const [data, setData] = useState<InventoryPostingData[]>([])
  const [initialRows, setInitialRows] = useState<RowDataKey[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [filters, setFilters] = useState({
    from: '',
    to: '',
    warehouse_code: '',
    item_code: ''
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

  const fetchWarehouses = useCallback(async () => {
    const result = await getWarehouses()
    if (result.success && Array.isArray(result.data)) {
      setWarehouses(result.data)
    }
  }, [])

  useEffect(() => {
    fetchWarehouses()
  }, [fetchWarehouses])

  const totalQty = useMemo(() => {
    return data.reduce((sum, row) => sum + Number(row.qty), 0)
  }, [data])

  const tableColumns: ColumnConfig[] = useMemo(
    () => [
      { key: 'created_at', label: 'Date', type: 'text', disabled: true },
      { key: 'source_doc_type', label: 'Doc Type', type: 'text', disabled: true },
      { key: 'source_docentry', label: 'Doc Entry', type: 'text', disabled: true },
      { key: 'item_code', label: 'Item', type: 'text', disabled: true },
      { key: 'transfer_type', label: 'Type', type: 'text', disabled: true },
      { key: 'warehouse_code', label: 'Warehouse', type: 'text', disabled: true },
      { key: 'qty', label: 'Qty', type: 'text', disabled: true },
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
      <div className='grid grid-cols-1 md:grid-cols-5 gap-3'>

        <Input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />

        <Input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />

        <select
          className="border rounded-md px-3"
          value={filters.warehouse_code}
          onChange={(e) =>
            setFilters({ ...filters, warehouse_code: e.target.value })
          }
        >
          <option value="">All Warehouses</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.warehouse_code}>
              {wh.warehouse_code}
            </option>
          ))}
        </select>

        <Input
          placeholder='Search Item Code'
          value={filters.item_code}
          onChange={(e) =>
            setFilters({ ...filters, item_code: e.target.value })
          }
        />

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
        data={initialRows}
      />

    </div>
  )
}