'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownUp,
  Eye,
  FileX2,
  ListFilter,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import Breadcrumb from '@/lib/Breadcrumb'
import {
  GoodsReceipt,
  getGoodsReceipts,
  getReceiptItemSummary,
} from './api'

export default function GoodsReceiveHistory() {
  const router = useRouter()
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([])
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState('10')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setReceipts(await getGoodsReceipts(Math.max(50, Number(pageSize))))
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  useEffect(() => {
    router.prefetch('/inv/gr/new')
    const timer = window.setTimeout(() => {
      refresh()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh, router])

  const filteredReceipts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return receipts

    return receipts.filter(receipt =>
      [
        receipt.grNo,
        receipt.vendor,
        receipt.farmName,
        receipt.status,
        getReceiptItemSummary(receipt),
      ].some(value => value.toLowerCase().includes(term)),
    )
  }, [receipts, search])

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-stone-50/40 pb-8 text-stone-950">
      <div className="mx-4 mt-8 flex items-center justify-between gap-3">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          CurrentPageName="Goods Receive"
        />
        <Button type="button" onClick={() => router.push('/inv/gr/new')}>
          <Plus className="size-4" />
          New GR
        </Button>
      </div>

      <section className="m-3 mt-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Goods Receive History</h2>

        <div className="mt-4 overflow-hidden rounded-xl border shadow-sm">
          <div className="flex flex-col gap-3 border-b bg-white p-4 md:flex-row md:items-center">
            <label className="flex h-9 w-full items-center gap-2 rounded-lg border px-3 md:w-56">
              <Search className="size-4 text-stone-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>

            <Button variant="outline" className="gap-2">
              <ListFilter className="size-4" />
              Filter
            </Button>

            <select
              value={pageSize}
              onChange={event => setPageSize(event.target.value)}
              className="h-9 rounded-lg border bg-white px-3 text-sm outline-none"
              aria-label="Rows per page"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>

            <Button variant="outline" className="gap-2 md:ml-auto" onClick={refresh} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="border-b bg-stone-50 text-left text-xs font-semibold text-stone-700">
                <tr>
                  {[
                    'GR No.',
                    'Item Description',
                    'Vendor',
                    'Farm',
                    'Date Received',
                    'Returned Qty',
                    'Balance Qty',
                    'Status',
                    'Action',
                  ].map(label => (
                    <th key={label} className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {label !== 'Action' && <ArrowDownUp className="size-3 text-stone-300" />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredReceipts.slice(0, Number(pageSize)).map(receipt => {
                  const receivedQty = receipt.lines.reduce((sum, line) => sum + Number(line.baseQty || 0), 0)
                  const returnedQty = receipt.lines.reduce((sum, line) => sum + Number(line.returnedQty || 0), 0)

                  return (
                    <tr key={receipt.id} className="hover:bg-stone-50">
                      <td className="whitespace-nowrap px-4 py-3 font-medium">{receipt.grNo}</td>
                      <td className="max-w-64 truncate px-4 py-3">{getReceiptItemSummary(receipt)}</td>
                      <td className="px-4 py-3">{receipt.vendor || '-'}</td>
                      <td className="px-4 py-3">{receipt.farmName || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3">{receipt.receiveDate}</td>
                      <td className="px-4 py-3 text-right">{returnedQty}</td>
                      <td className="px-4 py-3 text-right">{receivedQty - returnedQty}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white">
                          {receipt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/inv/gr/post?id=${receipt.id}`)}
                        >
                          <Eye className="size-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!loading && filteredReceipts.length === 0 && (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-stone-400">
              <FileX2 className="size-10 text-stone-300" />
              <p className="text-sm">No records found.</p>
            </div>
          )}

          {loading && (
            <div className="flex min-h-40 items-center justify-center text-sm text-stone-500">
              Loading goods receipts...
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
