
'use client'

export const dynamic = 'force-dynamic'

import Breadcrumb from '@/lib/Breadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getInventoryPostings, InventoryPostingData } from './api'
import { getWarehouses } from '../warehouse/api'

export default function Page() {

  const [data, setData] = useState<InventoryPostingData[]>([])
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
        <div>Total Qty: {totalQty}</div>
      </div>

      {/* Table */}
      <div className='overflow-x-auto border rounded-lg'>
        <table className='w-full text-sm'>
          <thead className='bg-muted'>
            <tr className='whitespace-nowrap'>
              <th className='p-2 text-left'>Date</th>
              <th className='p-2 text-left'>Doc Type</th>
              <th className='p-2 text-left'>Doc Entry</th>
              <th className='p-2 text-left'>Item</th>
              <th className='p-2 text-left'>Type</th>
              <th className='p-2 text-left'>Warehouse</th>
              <th className='p-2 text-left'>Bin</th>
              <th className='p-2 text-left'>Qty</th>
              <th className='p-2 text-left'>Reference</th>
              <th className='p-2 text-left'>Reference Type</th>
              <th className='p-2 text-left'>Reference 2</th>
              <th className='p-2 text-left'>Reference Type 2</th>
            </tr>
          </thead>

          <tbody>
            {data.map((row) => (
              <tr key={row.id} className='border-t'>
                <td className='p-2'>
                  {new Date(row.created_at).toLocaleDateString()}
                </td>
                <td className='p-2'>{row.source_doc_type}</td>
                <td className='p-2'>{row.source_docentry}</td>
                <td className='p-2'>{row.item_code}</td>
                <td className='p-2'>{row.transfer_type}</td>
                <td className='p-2'>{row.warehouse_code}</td>
                <td className='p-2'>{row.bin_code}</td>
                <td className='p-2 '>{row.qty}</td>
                <td className='p-2 '>{row.ref}</td>
                <td className='p-2 '>{row.ref_type}</td>
                <td className='p-2 '>{row.ref}</td>
                <td className='p-2 '>{row.ref_type2}</td>
              </tr>
            ))}

            {data.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className='p-4 text-center text-gray-500'>
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}


