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
import { useSidebar } from '@/lib/sidebar/SidebarProvider'
import { getInventoryStatusBadgeClass } from '@/app/inv/statusStyles'
import type { GoodsReceipt } from './api'
import { getGoodsReceipts, getReceiptItemSummary } from './listApi'

type GoodsReceiptTableRow = Record<string, unknown> & {
  id: number | null
  grNo: string
  itemDescription: string
  vendor: string
  farmName: string
  receiveDate: string
  returnedQty: number
  balanceQty: number
  status: string
  receipt: GoodsReceipt
}

export default function GoodsReceiveHistory() {
  const router = useRouter()
  const { setCollapsed } = useSidebar()
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
    router.prefetch('/inv/gr/new')
    const timer = window.setTimeout(() => {
      refresh()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh, router])

  const rows = useMemo<GoodsReceiptTableRow[]>(
    () =>
      receipts.map(receipt => {
        const receivedQty = receipt.lines.reduce((sum, line) => sum + Number(line.baseQty || 0), 0)
        const returnedQty = receipt.lines.reduce((sum, line) => sum + Number(line.returnedQty || 0), 0)

        return {
          id: receipt.id,
          grNo: receipt.grNo,
          itemDescription: getReceiptItemSummary(receipt),
          vendor: receipt.vendor || '-',
          farmName: receipt.farmName || '-',
          receiveDate: receipt.receiveDate,
          returnedQty,
          balanceQty: receivedQty - returnedQty,
          status: receipt.status,
          receipt,
        }
      }),
    [receipts],
  )

  const columns = useMemo<Column<GoodsReceiptTableRow>[]>(
    () => [
      {
        key: 'grNo', label: 'GR No.', render: row => (
          <>
            <span className='bg-sidebar-accent p-1 px-2 font-semibold rounded-md'>{row.grNo}</span>
          </>
        )

      },
      { key: 'itemDescription', label: 'Item Description' },
      { key: 'vendor', label: 'Vendor' },
      { key: 'farmName', label: 'Farm' },
      { key: 'receiveDate', label: 'Date Received' },
      // { key: 'returnedQty', label: 'Returned Qty', align: 'right' },
      { key: 'balanceQty', label: 'Balance Qty', align: 'center' },
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
                disabled={row.id === null}
                aria-label={`Open actions for ${row.grNo}`}
                onClick={event => event.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40" onClick={event => event.stopPropagation()}>
              <DropdownMenuItem
                onClick={event => {
                  event.stopPropagation()
                  if (row.id === null) return
                  router.push(`/inv/gr/post?id=${row.id}`)
                }}
              >
                <Eye className="size-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={event => {
                  event.stopPropagation()
                  if (row.id === null) return
                  router.push(`/inv/gr/new?duplicateId=${row.id}`)
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
    [router],
  )

  const openNewGoodsReceipt = () => {
    setCollapsed(true)
    router.push('/inv/gr/new')
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] text-stone-950">
      <div className="mt-2 flex items-center justify-between gap-3">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          CurrentPageName="Item Stock In"
        />

        <div className='flex gap-2'>
          <div className="flex justify-end">
            <Button variant="outline" className="gap-2" onClick={refresh} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          <Button type="button" onClick={openNewGoodsReceipt}>
            <Plus className="size-4" />
            New GR
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
            <Label htmlFor="gr-date-from">From Date</Label>
            <Input
              id="gr-date-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={event => setDateFrom(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gr-date-to">To Date</Label>
            <Input
              id="gr-date-to"
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
          title="Item Stock In"
          description={`${rows.length} goods receipt(s)`}
          columns={columns}
          data={rows}
          rowKey={row => row.id ?? row.grNo}
          searchPlaceholder="Search goods receipts..."
          emptyMessage="No goods receipts found"
          noResultsMessage="No matching goods receipts found"
          onRowClick={row => {
            if (row.id !== null) router.push(`/inv/gr/post?id=${row.id}`)
          }}
        />
      </div>
    </main>
  )
}
