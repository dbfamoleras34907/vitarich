'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, format } from 'date-fns'
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
import DefaultFarmComboBox from '@/app/components/DefaultFarmComboBox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [farmId, setFarmId] = useState<string | number>('')
  const [dateFrom, setDateFrom] = useState(() => format(addDays(new Date(), -30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setReceipts(await getGoodsReceipts({
        limit: 100,
        farmId: farmId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }))
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, farmId])

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
        key: 'grNo', label: 'DOC Placement No.', render: row => (
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
          CurrentPageName="DOC Placement"
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
            New DOC Placement
          </Button>
        </div>
      </div>

      <div className=" mt-4 space-y-3">
        <div className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 md:grid-cols-[minmax(220px,320px)_180px_180px]">
          <DefaultFarmComboBox
            label="Farm"
            value={farmId}
            valueKey="id"
            setValue={setFarmId}
          />

          <div className="space-y-2">
            <Label htmlFor="doc-receiving-date-from">From Date</Label>
            <Input
              id="doc-receiving-date-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={event => setDateFrom(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-receiving-date-to">To Date</Label>
            <Input
              id="doc-receiving-date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={event => setDateTo(event.target.value)}
            />
          </div>
        </div>

        <DynamicTable
          loading={loading}
          initialFilters={[]}
          title="DOC Placement"
          description={`${rows.length} DOC placement document(s)`}
          columns={columns}
          data={rows}
          rowKey={row => row.id ?? row.grNo}
          searchPlaceholder="Search DOC placement documents..."
          emptyMessage="No DOC placement documents found"
          noResultsMessage="No matching DOC placement documents found"
          onRowClick={row => {
            if (row.id !== null && !canView) router.push(`/inv/doc-receiving/post?id=${row.id}`)
          }}
        />
      </div>
    </main>
  )
}
