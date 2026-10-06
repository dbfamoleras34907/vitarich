'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { addDays, format } from 'date-fns'
import {
  Copy,
  Eye,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Undo2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import DynamicTable, { Column } from '@/components/ui/DataTableV2'
import { PageHeader, PageHeaderActions, PageShell } from '@/components/ui/page-layout'
import DefaultFarmComboBox from '@/app/components/DefaultFarmComboBox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Breadcrumb from '@/lib/Breadcrumb'
import { usePermission } from '@/hooks/usePermission'
import { useSidebar } from '@/lib/sidebar/SidebarProvider'
import { getInventoryStatusBadgeClass } from '@/app/inv/statusStyles'
import { formatNumber } from '@/lib/utils/numberFormat'
import {
  GoodsReceipt,
  getGoodsReceipts,
  reverseGoodsReceipt,
} from './api'
import type { GoodsReceiptDateField } from './api'

type GoodsReceiptTableRow = Record<string, unknown> & {
  id: number | null
  grNo: string
  vendor: string
  farmName: string
  receiveDate: string
  createdDate: string
  totalReceived: number
  goodReceived: number
  doaReceived: number
  rejectReceived: number
  shortCount: number
  status: string
  receipt: GoodsReceipt
}

export default function GoodsReceiveHistory() {
  const router = useRouter()
  const { setCollapsed } = useSidebar()
  const canView = usePermission('/inv/doc-receiving/view')
  const canInsert = usePermission('/inv/doc-receiving/insert')
  const canVoid = !usePermission('/inv/doc-receiving/void')
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [farmId, setFarmId] = useState<string | number>('')
  const [dateFrom, setDateFrom] = useState(() => format(addDays(new Date(), -30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [dateField, setDateField] = useState<GoodsReceiptDateField>('createdDate')
  const [reverseTarget, setReverseTarget] = useState<GoodsReceipt | null>(null)
  const [reversing, setReversing] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setReceipts(await getGoodsReceipts({
        limit: 100,
        farmId: farmId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        dateField,
      }))
    } catch (error) {
      toast.error(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message : 'Unable to load DOC Placement records. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [dateField, dateFrom, dateTo, farmId])

  const handleReverse = async () => {
    if (!reverseTarget?.id || reverseTarget.status !== 'Posted' || !canVoid) return

    setReversing(true)
    try {
      await reverseGoodsReceipt(reverseTarget.id)
      toast('DOC Placement reversed successfully.')
      setReverseTarget(null)
      await refresh()
    } catch (error) {
      toast.error(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message : 'Unable to reverse DOC Placement.')
    } finally {
      setReversing(false)
    }
  }

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
        const summary = receipt.receivingSummary ?? { total: 0, good: 0, doa: 0, reject: 0, shortCount: 0 }

        return {
          id: receipt.id,
          grNo: receipt.grNo,
          vendor: receipt.vendor || '-',
          farmName: receipt.farmName || '-',
          receiveDate: receipt.receiveDate,
          createdDate: receipt.createdAt ? format(new Date(receipt.createdAt), 'yyyy-MM-dd') : '-',
          totalReceived: summary.total,
          goodReceived: summary.good,
          doaReceived: summary.doa,
          rejectReceived: summary.reject,
          shortCount: summary.shortCount,
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
      { key: 'createdDate', label: 'Created Date' },
      { key: 'receiveDate', label: 'Date Received' },
      { key: 'vendor', label: 'Vendor' },
      { key: 'farmName', label: 'Farm' },
      { key: 'totalReceived', label: 'Total', align: 'right', render: row => formatNumber(row.totalReceived) },
      { key: 'goodReceived', label: 'Good', align: 'right', render: row => formatNumber(row.goodReceived) },
      { key: 'doaReceived', label: 'DAO', align: 'right', render: row => formatNumber(row.doaReceived) },
      { key: 'rejectReceived', label: 'Reject', align: 'right', render: row => formatNumber(row.rejectReceived) },
      { key: 'shortCount', label: 'Short Count', align: 'right', render: row => formatNumber(row.shortCount) },
      {
        key: 'status',
        label: 'Status',
        render: row => (
          <span className={getInventoryStatusBadgeClass(row.status) + 'h-3' }>
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
                size="xs"
                className="h-5"
                type="button"
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
                disabled={!canVoid || row.receipt.status !== 'Posted' || reversing}
                onClick={event => {
                  event.stopPropagation()
                  if (!canVoid || row.receipt.status !== 'Posted' || reversing) return
                  setReverseTarget(row.receipt)
                }}
              >
                <Undo2 className="size-4" />
                Reverse
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
    [canInsert, canView, canVoid, reversing, router],
  )

  const openNewGoodsReceipt = () => {
    setCollapsed(true)
    router.push('/inv/doc-receiving/new')
  }

  return (
    <PageShell>
      <PageHeader>
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          CurrentPageName="DOC Placement"
        />

        <PageHeaderActions>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          <Button type="button" size="sm" onClick={openNewGoodsReceipt} disabled={canInsert}>
            <Plus className="size-4" />
            New DOC Placement
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <div className="space-y-3">
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 md:grid-cols-[minmax(220px,320px)_180px_180px_180px]">
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

          <div className="space-y-2">
            <Label htmlFor="doc-receiving-date-field">Search Date By</Label>
            <Select value={dateField} onValueChange={value => setDateField(value as GoodsReceiptDateField)}>
              <SelectTrigger id="doc-receiving-date-field" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receiveDate">Received Date</SelectItem>
                <SelectItem value="createdDate">Created Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DynamicTable
          actionsFirst
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

      <Dialog open={reverseTarget !== null} onOpenChange={open => !reversing && !open && setReverseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse this DOC Placement?</DialogTitle>
            <DialogDescription>
              This will create reversal inventory postings and mark {reverseTarget?.grNo ?? 'this document'} as Reversed. The action is blocked if its consolidated batch is already used in Growing inventory.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={reversing}>Cancel</Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={handleReverse} disabled={reversing || !canVoid}>
              <Undo2 className="size-4" />
              {reversing ? 'Reversing...' : 'Confirm Reverse'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
