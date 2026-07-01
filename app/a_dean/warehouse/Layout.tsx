'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import DynamicTable, { Column } from '@/components/ui/DataTableV2'
import { Separator } from '@/components/ui/separator'
import Breadcrumb from '@/lib/Breadcrumb'
import { WarehouseData } from '@/lib/types'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getWarehousePage } from './api'

const PAGE_SIZE = 10

type WarehouseRow = WarehouseData & Record<string, unknown>

const toWarehouseRows = (rows: WarehouseData[]): WarehouseRow[] =>
  rows.map(row => ({ ...row }))

export default function WarehouseLayout() {
  const [data, setData] = useState<WarehouseRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const router = useRouter()

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const firstRow = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastRow = Math.min(page * PAGE_SIZE, totalCount)

  const fetchData = useCallback(async (nextPage: number) => {
    setIsLoading(true)
    const result = await getWarehousePage(nextPage, PAGE_SIZE)

    if (result.success && result.data) {
      setData(toWarehouseRows(result.data.rows))
      setTotalCount(result.data.totalCount)
      setPage(nextPage)
    } else {
      toast.error(result.error ?? 'Unable to load warehouse list.')
      setData([])
      setTotalCount(0)
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    const load = window.setTimeout(() => {
      void fetchData(1)
    }, 0)
    router.prefetch('/a_dean/warehouse/new')
    return () => window.clearTimeout(load)
  }, [fetchData, router])

  const columns: Column<WarehouseRow>[] = useMemo(
    () => [
      {
        key: 'whse_code',
        label: 'Code',
        render: row => row.whse_code || '-',
      },
      {
        key: 'whse_name',
        label: 'Name',
        render: row => row.whse_name || '-',
      },
      {
        key: 'fms_type',
        label: 'FMS Type',
        render: row => row.fms_type || '-',
      },
      {
        key: 'farm_name',
        label: 'Farm',
        render: row => row.farm_name || row.farm_code || '-',
      },
      {
        key: 'warehouse_type',
        label: 'Warehouse Type',
        render: row => row.warehouse_type || '-',
      },
      {
        key: 'full_location_code',
        label: 'Location Code',
        render: row => row.full_location_code || '-',
      },
      {
        key: 'city',
        label: 'City',
        render: row => row.city || '-',
      },
      {
        key: 'province',
        label: 'Province',
        render: row => row.province || '-',
      },
      {
        key: 'is_active',
        label: 'Status',
        sortable: false,
        render: row => (
          <Badge variant={row.is_active === false ? 'secondary' : 'default'}>
            {row.is_active === false ? 'Inactive' : 'Active'}
          </Badge>
        ),
      },
      {
        key: 'created_at',
        label: 'Created At',
        type: 'date',
      },
    ],
    []
  )

  const goToPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(1, nextPage), totalPages)
    if (safePage === page || isLoading) return
    fetchData(safePage)
  }

  return (
    <div className="mt-2">
      <div className="mx-4 mt-8 flex items-center justify-between">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          FirstPreviewsPageLink="/a_dean/inventory"
          CurrentPageName="Warehouse Master"
        />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => fetchData(page)}
            disabled={isLoading}
          >
            <RefreshCw className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button onClick={() => router.push('/a_dean/warehouse/new')}>
            <Plus />
            New Warehouse
          </Button>
        </div>
      </div>

      <Separator className="my-2" />

      <div className="mx-4 space-y-3">
        <DynamicTable
          loading={isLoading}
          columns={columns}
          data={data}
          title="Warehouse Master"
          description={`Server page size: ${PAGE_SIZE} records`}
          emptyMessage="No warehouses found"
          searchPlaceholder="Search current page..."
          pageSizeOptions={[10]}
          enablePagination={false}
          rowKey="id"
          onRowClick={(row) => row.id && router.push(`/a_dean/warehouse/${row.id}/edit`)}
        />

        <div className="flex flex-col gap-3 rounded-md border bg-white px-3 py-3 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2" aria-live="polite">
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
            <span>
              Showing <span className="font-medium text-stone-950">{firstRow}</span> to{' '}
              <span className="font-medium text-stone-950">{lastRow}</span> of{' '}
              <span className="font-medium text-stone-950">{totalCount}</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isLoading || page === 1}
              onClick={() => goToPage(1)}
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading || page === 1}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <span className="px-3 text-sm text-stone-500">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading || page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isLoading || page >= totalPages}
              onClick={() => goToPage(totalPages)}
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
