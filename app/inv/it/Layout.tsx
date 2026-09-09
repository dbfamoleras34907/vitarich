'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Eye, MoreHorizontal, Plus, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import DynamicTable, { Column } from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { useSidebar } from '@/lib/sidebar/SidebarProvider'
import { usePermission } from '@/hooks/usePermission'
import { getInventoryStatusBadgeClass } from '@/app/inv/statusStyles'
import {
  getInventoryTransfers,
  getTransferItemSummary,
  InventoryTransfer,
} from './api'

type InventoryTransferTableRow = Record<string, unknown> & {
  id: number | null
  itNo: string
  itemDescription: string
  farmName: string
  transferDate: string
  sourceWarehouse: string
  destinationWarehouse: string
  transferQty: number
  status: string
  transfer: InventoryTransfer
}

export default function InventoryTransferHistory() {
  const router = useRouter()
  const { setCollapsed } = useSidebar()
  const cannotView = usePermission('/inv/it/view')
  const canInsert = usePermission('/inv/it/insert')
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setTransfers(await getInventoryTransfers(100))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    router.prefetch('/inv/it/new')
    const timer = window.setTimeout(() => {
      refresh()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh, router])

  const rows = useMemo<InventoryTransferTableRow[]>(
    () =>
      transfers.map(transfer => ({
        id: transfer.id,
        itNo: transfer.itNo,
        itemDescription: getTransferItemSummary(transfer),
        farmName: transfer.farmName || '-',
        transferDate: transfer.transferDate,
        sourceWarehouse: transfer.fromWarehouseCode || '-',
        destinationWarehouse: transfer.toWarehouseCode || '-',
        transferQty: transfer.lines.reduce((sum, line) => sum + Number(line.baseQty || 0), 0),
        status: transfer.status,
        transfer,
      })),
    [transfers],
  )

  const columns = useMemo<Column<InventoryTransferTableRow>[]>(
    () => [
      {
        key: 'itNo',
        label: 'IT No.',
        render: row => (
          <span className="rounded-md bg-sidebar-accent px-2 py-1 font-semibold">
            {row.itNo}
          </span>
        ),
      },
      { key: 'itemDescription', label: 'Item Description' },
      { key: 'farmName', label: 'Farm' },
      { key: 'transferDate', label: 'Transfer Date' },
      { key: 'sourceWarehouse', label: 'Source' },
      { key: 'destinationWarehouse', label: 'Destination' },
      { key: 'transferQty', label: 'Transfer Qty', align: 'center' },
      {
        key: 'status',
        label: 'Status',
        render: row => (
          <span className={getInventoryStatusBadgeClass(row.status)}>
            {row.status}
          </span>
        ),
        align: 'center',
      },
      {
        key: 'action',
        label: 'Action',
        type: 'button',
        sortable: false,
        searchable: false,
        render: row => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={row.id === null || (cannotView && canInsert)}
                aria-label={`Open actions for ${row.itNo}`}
                onClick={event => event.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40" onClick={event => event.stopPropagation()}>
              <DropdownMenuItem
                disabled={cannotView}
                onClick={event => {
                  event.stopPropagation()
                  if (row.id === null || cannotView) return
                  router.push(`/inv/it/post?id=${row.id}`)
                }}
              >
                <Eye className="size-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={canInsert}
                onClick={event => {
                  event.stopPropagation()
                  if (row.id === null || canInsert) return
                  router.push(`/inv/it/new?duplicateId=${row.id}`)
                }}
              >
                <Copy className="size-4" />
                Duplicate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [canInsert, cannotView, router],
  )

  const openNewInventoryTransfer = () => {
    setCollapsed(true)
    router.push('/inv/it/new')
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] text-stone-950">
      <div className="mt-2 flex items-center justify-between gap-3">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          CurrentPageName="Inventory Transfer"
        />

        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={refresh} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>

          <Button type="button" onClick={openNewInventoryTransfer} disabled={canInsert}>
            <Plus className="size-4" />
            New IT
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <DynamicTable
          loading={loading}
          initialFilters={[]}
          title="Inventory Transfer"
          description={`${rows.length} inventory transfer(s)`}
          columns={columns}
          data={rows}
          rowKey={row => row.id ?? row.itNo}
          searchPlaceholder="Search inventory transfers..."
          emptyMessage="No inventory transfers found"
          noResultsMessage="No matching inventory transfers found"
          onRowClick={row => {
            if (row.id !== null && !cannotView) router.push(`/inv/it/post?id=${row.id}`)
          }}
        />
      </div>
    </main>
  )
}
