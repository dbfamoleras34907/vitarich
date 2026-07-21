'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Copy,
  Eye,
  MoreHorizontal,
  Plus,
  RefreshCw,
} from 'lucide-react'

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
import { usePermission } from '@/hooks/usePermission'
import { useSidebar } from '@/lib/sidebar/SidebarProvider'
import { getInventoryStatusBadgeClass } from '@/app/inv/statusStyles'
import {
  GoodsReceipt,
  getGoodsReceipts,
  getReceiptItemSummary,
} from './api'

type GoodsReceiptTableRow = Record<string, unknown> & {
  id: number | null
  grNo: string
  itemDescription: string
  vendor: string
  farmName: string
  receiveDate: string
  status: string
  receipt: GoodsReceipt
}

export default function GoodsReceiveHistory() {
  const router = useRouter()
  const { setCollapsed } = useSidebar()
  const canView = usePermission('/inv/doc-receiving/view')
  const canInsert = usePermission('/inv/doc-receiving/insert')
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setReceipts(await getGoodsReceipts(100))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    router.prefetch('/inv/doc-receiving/new')
    const timer = window.setTimeout(() => {
      refresh()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh, router])

  const rows = useMemo<GoodsReceiptTableRow[]>(
    () =>
      receipts.map(receipt => {
        return {
          id: receipt.id,
          grNo: receipt.grNo,
          itemDescription: getReceiptItemSummary(receipt),
          vendor: receipt.vendor || '-',
          farmName: receipt.farmName || '-',
          receiveDate: receipt.receiveDate,
          status: receipt.status,
          receipt,
        }
      }),
    [receipts],
  )

  const columns = useMemo<Column<GoodsReceiptTableRow>[]>(
    () => [
      {
        key: 'grNo', label: 'DOC Receiving No.', render: row => (
          <>
            <span className='bg-sidebar-accent p-1 px-2 font-semibold rounded-md'>{row.grNo}</span>
          </>
        )

      },
      { key: 'itemDescription', label: 'Item Description' },
      { key: 'vendor', label: 'Vendor' },
      { key: 'farmName', label: 'Farm' },
      { key: 'receiveDate', label: 'Date Received' },
      {
        key: 'status',
        label: 'Status',
        render: row => (
          <span className={getInventoryStatusBadgeClass(row.status)}>
            {row.status}
          </span>
        ),
        align: "center"
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
                disabled={row.id === null || (canView && canInsert)}
                aria-label={`Open actions for ${row.grNo}`}
                onClick={event => event.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40" onClick={event => event.stopPropagation()}>
              <DropdownMenuItem
                disabled={canView}
                onClick={event => {
                  event.stopPropagation()
                  if (row.id === null || canView) return
                  router.push(`/inv/doc-receiving/post?id=${row.id}`)
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
                  router.push(`/inv/doc-receiving/new?duplicateId=${row.id}`)
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
    [canInsert, canView, router],
  )

  const openNewGoodsReceipt = () => {
    setCollapsed(true)
    router.push('/inv/doc-receiving/new')
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] text-stone-950">
      <div className="mt-2 flex items-center justify-between gap-3">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          CurrentPageName="DOC Receiving"
        />

        <div className='flex gap-2'>
          <div className="flex justify-end">
            <Button variant="outline" className="gap-2" onClick={refresh} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          <Button type="button" onClick={openNewGoodsReceipt} disabled={canInsert}>
            <Plus className="size-4" />
            New DOC Receiving
          </Button>
        </div>
      </div>

      <div className=" mt-4 space-y-3">

        <DynamicTable
          loading={loading}
          initialFilters={[]}
          title="DOC Receiving"
          description={`${rows.length} DOC receiving document(s)`}
          columns={columns}
          data={rows}
          rowKey={row => row.id ?? row.grNo}
          searchPlaceholder="Search DOC receiving documents..."
          emptyMessage="No DOC receiving documents found"
          noResultsMessage="No matching DOC receiving documents found"
          onRowClick={row => {
            if (row.id !== null && !canView) router.push(`/inv/doc-receiving/post?id=${row.id}`)
          }}
        />
      </div>
    </main>
  )
}
