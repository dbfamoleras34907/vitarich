'use client'
import { Button } from '@/components/ui/button'
import { ColumnConfig, DataTable } from '@/components/ui/DataTable'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import Breadcrumb from '@/lib/Breadcrumb'
import { Plus, RefreshCw, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { WarehouseData } from '@/lib/types'
import { getWarehouses } from './api'

export default function WarehouseLayout() {
  const [data, setData] = useState<WarehouseData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const result = await getWarehouses()
    console.log({ result })
    if (result.success && Array.isArray(result.data)) {
      setData(result.data)
    } else {
      console.error(result.error)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    router.prefetch("/a_dean/warehouse/new")
  }, [fetchData, router])

  // 3. Column Configuration (Matched to WarehouseData)
  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'id', label: 'ID', type: 'text', disabled: true },
      { key: 'status', label: 'Status', type: 'text', disabled: true },
      { key: 'whse_code', label: 'Code', type: 'text', disabled: true },
      { key: 'whse_name', label: 'Name', type: 'text', disabled: true },
      { key: 'remarks', label: 'Remarks', type: 'text', disabled: true },
    ],
    []
  )

  return (
    <div className='mt-2'>
      <div className='flex justify-between mx-4 mt-8 items-center'>
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          FirstPreviewsPageLink="/a_dean/inventory"
          CurrentPageName="Warehouse Master"
        />
        <div className='flex gap-2'>
          <Button
            variant={"secondary"}
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} />
          </Button>
          <Button
            onClick={() => router.push("/a_dean/warehouse/new")}
          >
            <Plus /> New Warehouse
          </Button>
        </div>
      </div>

      <Separator className='my-2' />
      <div className='rounded-2xl bg-white pt-4 px-2'>
        <div className='mx-4 flex gap-2'>
          <Input className='w-4xs' placeholder='Search location...' />
          <Input className='w-4xs' placeholder='Search status...' />
        </div>

        <div className='mx-4 mt-2 '>
          {isLoading && data.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
            </div>
          ) : (
            <DataTable
              widthFull
              columns={tableColumnsx}
              rows={data}
              DisableAddLine
              rowOnClick={(row) => {
                // Navigate to detail page using the row ID
                // router.push(`/a_dean/warehouse/${row.id}`)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}