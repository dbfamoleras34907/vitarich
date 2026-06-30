'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Plus, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import DynamicTable, { Column } from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { useSidebar } from '@/lib/sidebar/SidebarProvider'
import { usePermission } from '@/hooks/usePermission'
import { getInventoryStatusBadgeClass } from '@/app/inv/statusStyles'
import {
  getGoodsIssues,
  getIssueItemSummary,
  GoodsIssue,
} from './api'

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

export default function GoodsIssueHistory() {
  const router = useRouter()
  const { setCollapsed } = useSidebar()
  const cannotView = usePermission('/inv/gi/view')
  const cannotInsert = usePermission('/inv/gi/insert')
  const [issues, setIssues] = useState<GoodsIssue[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setIssues(await getGoodsIssues(100))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    router.prefetch('/inv/gi/new')
    const timer = window.setTimeout(() => {
      refresh()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh, router])

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
        label: 'GI No.',
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
              router.push(`/inv/gi/post?id=${row.id}`)
            }}
          >
            <Eye className="size-4" />
            View
          </Button>
        ),
      },
    ],
    [cannotView, router],
  )

  const openNewGoodsIssue = () => {
    setCollapsed(true)
    router.push('/inv/gi/new')
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] text-stone-950">
      <div className="mt-2 flex items-center justify-between gap-3">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          CurrentPageName="Goods Issue"
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
            New GI
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <DynamicTable
          loading={loading}
          initialFilters={[]}
          title="Goods Issue"
          description={`${rows.length} goods issue(s)`}
          columns={columns}
          data={rows}
          rowKey={row => row.id ?? row.giNo}
          searchPlaceholder="Search goods issues..."
          emptyMessage="No goods issues found"
          noResultsMessage="No matching goods issues found"
          onRowClick={row => {
            if (row.id !== null && !cannotView) router.push(`/inv/gi/post?id=${row.id}`)
          }}
        />
      </div>
    </main>
  )
}
