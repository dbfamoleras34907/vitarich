'use client'

import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import DynamicTable, { type Column } from '@/components/ui/DataTableV2'
import type { BatchTransactionTrail } from '@/lib/data/repositories/batchTransactionTrail'

type BatchTransactionTimelineProps = {
  itemCode: string
  itemLabel?: string
  batchNumber: string
  warehouseCode?: string
  warehouseValue?: string
  warehouseLabel?: string
  showAllWarehouses?: boolean
  quantityLabel?: string
  quantityValue?: string
  rows: BatchTransactionTrail[]
  loading?: boolean
  error?: string
  onRetry?: () => void
}

const formatQuantity = (value: number) =>
  value.toLocaleString('en-PH', { maximumFractionDigits: 6 })

const formatDateParts = (value: string) => {
  if (!value) return { date: '-', time: '' }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { date: value, time: '' }
  return {
    date: parsed.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
    time: parsed.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
  }
}

type BatchTrailTableRow = BatchTransactionTrail & {
  referenceLabel: string
  [key: string]: unknown
}

export default function BatchTransactionTimeline({
  itemCode,
  itemLabel,
  batchNumber,
  warehouseCode = '',
  warehouseValue,
  warehouseLabel = 'Warehouse',
  showAllWarehouses = false,
  quantityLabel,
  quantityValue,
  rows,
  loading = false,
  error = '',
  onRetry,
}: BatchTransactionTimelineProps) {
  const hasIdentity = Boolean(itemCode.trim() && batchNumber.trim())
  const tableRows: BatchTrailTableRow[] = rows.map(row => ({
    ...row,
    referenceLabel: row.ref || row.ref2 || '-',
  }))
  const warehouseGroups = Array.from(tableRows.reduce((groups, row) => {
    const key = row.warehouseCode.trim().toUpperCase() || '-'
    groups.set(key, [...(groups.get(key) ?? []), row])
    return groups
  }, new Map<string, BatchTrailTableRow[]>()).entries()).map(([warehouse, warehouseRows]) => ({
    warehouse,
    rows: warehouseRows,
    currentBalance: warehouseRows.at(-1)?.warehouseRunningQty ?? 0,
  }))
  const hasNegativeOpening = warehouseGroups.some(group => group.rows[0]?.signedQty < 0)
  const hasNegativeBalance = rows.some(row => row.warehouseRunningQty < 0)
  const columns: Column<BatchTrailTableRow>[] = [
    { key: 'createdAt', label: 'Date / Time', fitWidth: '16%', render: row => {
      const parts = formatDateParts(row.createdAt)
      return <div className="leading-4"><div>{parts.date}</div><div className="text-[11px] text-muted-foreground">{parts.time}</div></div>
    } },
    { key: 'signedQty', label: 'Move', align: 'center', fitWidth: '8%', render: row => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.signedQty < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
        {row.signedQty < 0 ? 'OUT' : 'IN'}
      </span>
    ) },
    { key: 'binCode', label: 'Bin', fitWidth: '12%', render: row => row.binCode || '-' },
    { key: 'qty', label: 'Quantity', align: 'right', fitWidth: '12%', render: row => (
      <span className={`font-semibold tabular-nums ${row.signedQty < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
        {row.signedQty < 0 ? '-' : '+'}{formatQuantity(Math.abs(row.signedQty))}
      </span>
    ) },
    { key: 'warehouseRunningQty', label: 'Balance', align: 'right', fitWidth: '12%', render: row => (
      <span className={`font-semibold tabular-nums ${row.warehouseRunningQty < 0 ? 'text-red-700' : ''}`}>{formatQuantity(row.warehouseRunningQty)}</span>
    ) },
    { key: 'documentLabel', label: 'Document / Type', fitWidth: '23%', render: row => (
      <div className="leading-4"><div className="truncate font-medium">{row.documentLabel}</div><div className="truncate text-[11px] text-muted-foreground">{row.sourceDocType || '-'}</div></div>
    ) },
    { key: 'referenceLabel', label: 'Reference / Posting', fitWidth: '17%', render: row => (
      <div className="leading-4"><div className="truncate">{row.referenceLabel}</div><div className="text-[11px] text-muted-foreground">#{row.id}</div></div>
    ) },
  ]

  const trailTable = (data: BatchTrailTableRow[], tableLoading = false) => (
    <DynamicTable
      variant="plain"
      loading={tableLoading}
      initialFilters={[]}
      enableSearch={false}
      enableFilters={false}
      enablePagination={false}
      enableExport={false}
      fitToContainer
      rowKey="id"
      emptyMessage="No inventory postings were found for this batch"
      getRowClassName={row => Number(row.warehouseRunningQty) < 0 ? 'text-red-700' : ''}
      columns={columns}
      data={data}
    />
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm sm:grid-cols-4">
        <div>
          <div className="text-xs font-medium text-amber-700">Batch</div>
          <div className="truncate font-semibold text-foreground">{batchNumber || '-'}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-amber-700">Item</div>
          <div className="truncate font-semibold text-foreground">{itemLabel || itemCode || '-'}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-amber-700">{showAllWarehouses ? 'Scope' : warehouseLabel}</div>
          <div className="truncate font-semibold text-foreground">{showAllWarehouses ? 'All warehouses' : warehouseValue || warehouseCode || '-'}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-amber-700">{quantityLabel || 'Quantity'}</div>
          <div className="font-semibold tabular-nums text-foreground">{quantityValue || '-'}</div>
        </div>
      </div>

      {!loading && error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
          <span>{error}</span>
          {onRetry && <Button type="button" size="sm" variant="outline" onClick={onRetry}><RotateCcw className="size-4" /> Retry</Button>}
        </div>
      )}

      {!loading && !error && !hasIdentity && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          Select a batch to view its complete inventory trail.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (hasNegativeOpening || hasNegativeBalance) && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          A warehouse trail begins with an OUT movement or reaches a negative balance. Its incoming posting may be missing or stored under a different batch identity.
        </div>
      )}

      {!error && hasIdentity && (
        loading || warehouseGroups.length === 0
          ? trailTable([], loading)
          : (
            <div className="space-y-3">
              {warehouseGroups.map(group => (
                <section key={group.warehouse} className="overflow-hidden rounded-md border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2 text-sm">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Warehouse</span>
                      <div className="font-semibold">{group.warehouse}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium text-muted-foreground">Current Balance</span>
                      <div className={`font-semibold tabular-nums ${group.currentBalance < 0 ? 'text-red-700' : ''}`}>
                        {formatQuantity(group.currentBalance)}
                      </div>
                    </div>
                  </div>
                  {trailTable(group.rows)}
                </section>
              ))}
            </div>
          )
      )}
    </div>
  )
}
