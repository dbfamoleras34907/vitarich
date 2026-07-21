'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import DynamicTable, { Column } from '@/components/ui/DataTableV2'
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
}

type GoodsIssueTableRow = Record<string, unknown> & {
  id: number | null
  giNo: string
  itemDescription: string
  farmName: string
  issueDate: string
  warehouse: string
  issueQty: number
  status: string
  issue: GoodsIssue
}

type GoodsIssueHistoryProps = {
  config?: Partial<GoodsIssueHistoryConfig>
}

function normalizeFarmId(value: unknown): number | string | null {
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
    const details = error as { message?: unknown; details?: unknown; hint?: unknown }
    const messages = [details.message, details.details, details.hint]
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    if (messages.length > 0) return messages.join(' ')
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
  const defaultFarmId = config.useDefaultFarm
    ? normalizeFarmId(getValue('DefaultFarmId'))
    : null
  const [issues, setIssues] = useState<GoodsIssue[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setIssues(await getGoodsIssues(
        100,
        config.triggeredBy,
        defaultFarmId,
      ))
    } catch (error) {
      console.error('Goods issue history load failed:', error)
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [config.triggeredBy, defaultFarmId])

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
        farmName: issue.farmName || '-',
        issueDate: issue.issueDate,
        warehouse: issue.fromWarehouseCode || '-',
        issueQty: issue.lines.reduce((sum, line) => sum + Number(line.baseQty || 0), 0),
        status: issue.status,
        issue,
      })),
    [issues],
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
      { key: 'issueDate', label: 'Issue Date' },
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'issueQty', label: 'Issue Qty', align: 'center' },
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={row.id === null || cannotView}
            onClick={event => {
              event.stopPropagation()
              if (row.id === null || cannotView) return
              router.push(`${config.basePath}/post?id=${row.id}`)
            }}
          >
            <Eye className="size-4" />
            View
          </Button>
        ),
      },
    ],
    [cannotView, config.basePath, config.documentPrefix, router],
  )

  const openNewGoodsIssue = () => {
    setCollapsed(true)
    router.push(`${config.basePath}/new`)
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] text-stone-950">
      <div className="mt-2 flex items-center justify-between gap-3">
        <Breadcrumb
          FirstPreviewsPageName={config.parentLabel}
          CurrentPageName={config.title}
        />

        <div className="flex gap-2">
          <div className="flex justify-end">
            <Button variant="outline" className="gap-2" onClick={refresh} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          <Button type="button" onClick={openNewGoodsIssue} disabled={cannotInsert}>
            <Plus className="size-4" />
            New {config.documentPrefix}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <DynamicTable
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
    </main>
  )
}
