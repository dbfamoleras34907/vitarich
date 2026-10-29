'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, format } from 'date-fns'
import { Copy, Eye, MoreHorizontal, Plus, Printer, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import UserFarmSearchCombobox from '@/components/ui/UserFarmSearchCombobox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import DynamicTable, { Column } from '@/components/ui/DataTableV2'
import { PageHeader, PageHeaderActions, PageShell } from '@/components/ui/page-layout'
import Breadcrumb from '@/lib/Breadcrumb'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { useSidebar } from '@/lib/sidebar/SidebarProvider'
import { usePermission } from '@/hooks/usePermission'
import { getInventoryStatusBadgeClass } from '@/app/inv/statusStyles'
import {
  getGoodsIssues,
  getIssueItemSummary,
  GoodsIssue,
} from './api'
import DeliveryReceipt from '@/app/brd/dr/DeliveryReceipt'
import BroilerIssueReversalButton from '@/app/brd/BroilerIssueReversalButton'
import { formatBroilerCycleNumbers } from '@/lib/data/repositories/broilerIssueCycles'
import {
  attachProcessListAttributions,
  type ProcessListAttribution,
} from '@/lib/data/repositories/processListAttribution'

type GoodsIssueHistoryConfig = {
  triggeredBy: string
  documentPrefix: string
  basePath: string
  permissionPath: string
  parentLabel: string
  title: string
  listDescription: string
  searchPlaceholder: string
  emptyMessage: string
  noResultsMessage: string
  useDefaultFarm: boolean
  showFarmFilter: boolean
  showDateFilter: boolean
  showDeliveryReceipt: boolean
  showDuplicateAction: boolean
  receiptLabel: string
  showWarehouseName: boolean
  showProcessListAttribution: boolean
}

const defaultConfig: GoodsIssueHistoryConfig = {
  triggeredBy: 'GI',
  documentPrefix: 'GI',
  basePath: '/inv/gi',
  permissionPath: '/inv/gi',
  parentLabel: 'Inventory',
  title: 'Item Stock Out',
  listDescription: 'item stock out transaction(s)',
  searchPlaceholder: 'Search item stock out transactions...',
  emptyMessage: 'No item stock out transactions found',
  noResultsMessage: 'No matching item stock out transactions found',
  useDefaultFarm: false,
  showFarmFilter: false,
  showDateFilter: false,
  showDeliveryReceipt: false,
  showDuplicateAction: false,
  receiptLabel: 'Delivery Receipt',
  showWarehouseName: false,
  showProcessListAttribution: false,
}

type AttributedGoodsIssue = GoodsIssue & Partial<ProcessListAttribution>

type GoodsIssueTableRow = Record<string, unknown> & {
  id: number | null
  giNo: string
  itemDescription: string
  farmName: string
  issueDate: string
  warehouse: string
  issueQty: number
  status: string
  createdByName: string
  assignedTaLabel: string
  issue: AttributedGoodsIssue
}

type GoodsIssueHistoryProps = {
  config?: Partial<GoodsIssueHistoryConfig>
}

export function normalizeFarmId(value: unknown): number | string | null {
  const candidate = typeof value === 'object' && value !== null
    ? ('id' in value ? (value as { id?: unknown }).id : null)
    : value

  if (typeof candidate === 'number') {
    return Number.isFinite(candidate) ? candidate : null
  }

  if (typeof candidate === 'string' && candidate.trim() !== '') {
    return candidate.trim()
  }

  return null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const details = error as {
      code?: unknown
      message?: unknown
      details?: unknown
      hint?: unknown
    }
    const messages = [details.message, details.details, details.hint]
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    if (messages.length > 0) {
      const code = typeof details.code === 'string' && details.code.trim() !== ''
        ? ` (${details.code})`
        : ''
      return `${messages.join(' ')}${code}`
    }
  }
  return 'Delivery transactions could not be loaded.'
}

export default function GoodsIssueHistory({ config: configOverrides }: GoodsIssueHistoryProps) {
  const config = { ...defaultConfig, ...configOverrides }
  const router = useRouter()
  const { getValue } = useGlobalContext()
  const { setCollapsed } = useSidebar()
  const cannotView = usePermission(`${config.permissionPath}/view`)
  const cannotInsert = usePermission(`${config.permissionPath}/insert`)
  const conVoid = usePermission(`${config.permissionPath}/void`)
  const defaultFarmId = config.useDefaultFarm
    ? normalizeFarmId(
        getValue('DefaultFarmId')
        ?? getValue('UserInfoAuthSession')?.[0]?.default_farm,
      )
    : null
  const activeFarmId = defaultFarmId
  const [dateFrom, setDateFrom] = useState(() => format(addDays(new Date(), -30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [issues, setIssues] = useState<AttributedGoodsIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [receiptDeliveryId, setReceiptDeliveryId] = useState<number | null>(null)
  const [reversalIssue, setReversalIssue] = useState<GoodsIssue | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const loadedIssues = await getGoodsIssues({
        limit: 100,
        triggeredBy: config.triggeredBy,
        farmIdentifier: activeFarmId,
        dateFrom: config.showDateFilter ? dateFrom : undefined,
        dateTo: config.showDateFilter ? dateTo : undefined,
      })
      setIssues(config.showProcessListAttribution
        ? await attachProcessListAttributions(loadedIssues)
        : loadedIssues)
    } catch (error) {
      const message = getErrorMessage(error)
      // This is handled by the toast. Using console.error here makes Next.js show
      // its development error overlay and Supabase errors are rendered as `{}`.
      console.warn(`Goods issue history load failed: ${message}`)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [activeFarmId, config.showDateFilter, config.showProcessListAttribution, config.triggeredBy, dateFrom, dateTo])

  useEffect(() => {
    router.prefetch(`${config.basePath}/new`)
    const timer = window.setTimeout(() => {
      refresh()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [config.basePath, refresh, router])

  const rows = useMemo<GoodsIssueTableRow[]>(
    () =>
      issues.map(issue => ({
        id: issue.id,
        giNo: issue.giNo,
        itemDescription: getIssueItemSummary(issue),
        cycleReference: [...new Set(issue.lines.map(line =>
          `${line.fromWarehouseName || line.fromWarehouseCode || 'Building'}: ${formatBroilerCycleNumbers(line)}`,
        ))].join('\n') || '—',
        farmName: issue.farmName || '-',
        issueDate: issue.issueDate,
        warehouse: config.showWarehouseName
          ? issue.fromWarehouseName || issue.fromWarehouseCode || '-'
          : issue.fromWarehouseCode || '-',
        issueQty: issue.lines.reduce((sum, line) => sum + Number(line.baseQty || 0), 0),
        status: issue.status,
        createdByName: issue.createdByName ?? '—',
        assignedTaLabel: issue.assignedTaLabel ?? 'Farm unavailable',
        issue,
      })),
    [config.showWarehouseName, issues],
  )

  const columns = useMemo<Column<GoodsIssueTableRow>[]>(
    () => [
      {
        key: 'giNo',
        label: `${config.documentPrefix} No.`,
        render: row => (
          <span className="rounded-md bg-sidebar-accent px-2 py-1 font-semibold">
            {row.giNo}
          </span>
        ),
      },
      { key: 'itemDescription', label: 'Item Description' },
      { key: 'farmName', label: 'Farm' },
      { key: 'issueDate', label: config.triggeredBy === 'BR-DR' ? 'Posting Date' : 'Issue Date' },
      { key: 'warehouse', label: 'Warehouse' },
      ...(['BR-CU', 'BR-DR'].includes(config.triggeredBy) ? [{
        key: 'cycleReference', label: 'Cycle #',
        render: (row: GoodsIssueTableRow) => <span className="whitespace-pre-line text-xs">{String(row.cycleReference)}</span>,
      }] : []),
      { key: 'issueQty', label: 'Issue Qty', align: 'center' },
      {
        key: 'status',
        label: 'Status',
        render: row => (
          <span className={getInventoryStatusBadgeClass(row.status)}>
            {['BR-CU', 'BR-DR'].includes(config.triggeredBy) && row.status === 'Cancelled' ? 'Void' : row.status}
          </span>
        ),
        align: 'center',
      },
      ...(config.showProcessListAttribution ? [
        { key: 'createdByName', label: 'Created by' },
        {
          key: 'assignedTaLabel',
          label: 'Assigned TA',
          render: (row: GoodsIssueTableRow) => (
            <span className="block max-w-40 truncate" title={row.assignedTaLabel}>
              {row.assignedTaLabel}
            </span>
          ),
        },
      ] : []),
      {
        key: 'action',
        label: 'Action',
        type: 'button',
        sortable: false,
        searchable: false,
        render: row => (
          <div className="flex justify-center" onClick={event => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={`Actions for ${row.giNo}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                {['BR-CU', 'BR-DR'].includes(config.triggeredBy) && row.status === 'Posted' && (
                  <DropdownMenuItem disabled={row.id === null || conVoid} onSelect={() => setReversalIssue(row.issue)}>
                    <RefreshCw className="size-4" />
                    Reverse
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  disabled={row.id === null || cannotView}
                  onSelect={() => {
                    if (row.id === null || cannotView) return
                    router.push(`${config.basePath}/post?id=${row.id}`)
                  }}
                >
                  <Eye className="size-4" />
                  View
                </DropdownMenuItem>
                {config.showDeliveryReceipt && (
                  <DropdownMenuItem
                    disabled={row.id === null || cannotView}
                    onSelect={() => {
                      if (row.id === null || cannotView) return
                      setReceiptDeliveryId(row.id)
                    }}
                  >
                    <Printer className="size-4" />
                    {config.receiptLabel}
                  </DropdownMenuItem>
                )}
                {config.showDuplicateAction && (
                  <DropdownMenuItem
                    disabled={row.id === null || cannotInsert}
                    onSelect={() => {
                      if (row.id === null || cannotInsert) return
                      setCollapsed(true)
                      router.push(`${config.basePath}/new?duplicateId=${row.id}`)
                    }}
                  >
                    <Copy className="size-4" />
                    Duplicate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [
      cannotInsert,
      cannotView,
      conVoid,
      config.basePath,
      config.documentPrefix,
      config.triggeredBy,
      config.receiptLabel,
      config.showDeliveryReceipt,
      config.showDuplicateAction,
      config.showProcessListAttribution,
      router,
      setCollapsed,
    ],
  )

  const openNewGoodsIssue = () => {
    setCollapsed(true)
    router.push(`${config.basePath}/new`)
  }

  return (
    <PageShell>
      <PageHeader>
        <Breadcrumb
          FirstPreviewsPageName={config.parentLabel}
          CurrentPageName={config.title}
        />

        <PageHeaderActions>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          <Button type="button" size="sm" onClick={openNewGoodsIssue} disabled={cannotInsert}>
            <Plus className="size-4" />
            New {config.documentPrefix}
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <div className="space-y-3">
        {(config.showFarmFilter || config.showDateFilter) && (
          <div className="grid gap-2 rounded-md border bg-muted/30 p-3 md:grid-cols-[minmax(220px,320px)_180px_180px]">
            {config.showFarmFilter && (
              <UserFarmSearchCombobox
                label="Farm"
                farmType="BR"
                value={activeFarmId}
              />
            )}

            {config.showDateFilter && (
              <div className="space-y-2">
                <Label htmlFor={`${config.triggeredBy}-date-from`}>From Date</Label>
                <Input
                  id={`${config.triggeredBy}-date-from`}
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={event => setDateFrom(event.target.value)}
                />
              </div>
            )}

            {config.showDateFilter && (
              <div className="space-y-2">
                <Label htmlFor={`${config.triggeredBy}-date-to`}>To Date</Label>
                <Input
                  id={`${config.triggeredBy}-date-to`}
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={event => setDateTo(event.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <DynamicTable
          actionsFirst
          loading={loading}
          initialFilters={[]}
          title={config.title}
          description={`${rows.length} ${config.listDescription}`}
          columns={columns}
          data={rows}
          rowKey={row => row.id ?? row.giNo}
          searchPlaceholder={config.searchPlaceholder}
          emptyMessage={config.emptyMessage}
          noResultsMessage={config.noResultsMessage}
          onRowClick={row => {
            if (row.id !== null && !cannotView) router.push(`${config.basePath}/post?id=${row.id}`)
          }}
        />
      </div>

      {reversalIssue && <BroilerIssueReversalButton
        kind={config.triggeredBy === 'BR-DR' ? 'harvest' : 'cleanup'}
        documentId={reversalIssue.id}
        documentNo={reversalIssue.giNo}
        status={reversalIssue.status}
        open
        onOpenChange={open => { if (!open) setReversalIssue(null) }}
        onReversed={() => { void refresh() }}
      />}
      <DeliveryReceipt
        deliveryId={receiptDeliveryId}
        triggeredBy={config.triggeredBy}
        receiptTitle={config.receiptLabel}
        open={receiptDeliveryId !== null}
        onOpenChange={open => {
          if (!open) setReceiptDeliveryId(null)
        }}
      />
    </PageShell>
  )
}
