'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getCleanupVariancePostings,
  getGoodsIssueById,
  type CleanupVariancePosting,
  type GoodsIssue,
} from '@/app/inv/gi/api'

type DeliveryReceiptProps = {
  deliveryId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  triggeredBy?: string
  receiptTitle?: string
}

const formatQuantity = (value: number) =>
  Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 6 })

const formatDate = (value: string) => {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: '2-digit' })
}

export default function DeliveryReceipt({
  deliveryId,
  open,
  onOpenChange,
  triggeredBy = 'BR-DR',
  receiptTitle = 'Delivery Receipt',
}: DeliveryReceiptProps) {
  const [delivery, setDelivery] = useState<GoodsIssue | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [variancePostings, setVariancePostings] = useState<CleanupVariancePosting[]>([])
  const printRef = useRef<HTMLDivElement>(null)
  const isCleanup = triggeredBy.trim().toUpperCase() === 'BR-CU'

  const printReceipt = useReactToPrint({
    contentRef: printRef,
    documentTitle: delivery ? `${receiptTitle} - ${delivery.giNo}` : receiptTitle,
  })

  useEffect(() => {
    if (!open || !deliveryId) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      setDelivery(null)
      setVariancePostings([])
      setLoading(true)
      setError('')

      Promise.all([
        getGoodsIssueById(deliveryId, triggeredBy),
        isCleanup ? getCleanupVariancePostings(deliveryId) : Promise.resolve([]),
      ])
        .then(([result, varianceRows]) => {
          if (cancelled) return
          setDelivery(result)
          setVariancePostings(varianceRows)
          if (!result) setError('Delivery could not be found.')
        })
        .catch(loadError => {
          console.error(loadError)
          if (!cancelled) setError('Delivery receipt could not be loaded.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [deliveryId, isCleanup, open, triggeredBy])

  const totalQuantity = useMemo(
    () => delivery?.lines.reduce((total, line) => total + Number(line.baseQty || 0), 0) ?? 0,
    [delivery],
  )
  const totalVariance = useMemo(
    () => variancePostings.reduce((total, posting) => total + Number(posting.qty || 0), 0),
    [variancePostings],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{receiptTitle}</DialogTitle>
          <DialogDescription>
            {delivery ? `Printable receipt for ${delivery.giNo}.` : 'Loading printable delivery details.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading delivery receipt...
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700">
            {error}
          </div>
        ) : delivery ? (
          <div className="overflow-x-auto rounded-md bg-stone-100 p-4">
            <div
              ref={printRef}
              className="mx-auto min-h-[277mm] w-[210mm] bg-white p-[14mm] text-[12px] leading-normal text-black shadow-sm print:min-h-0 print:w-auto print:p-0 print:shadow-none"
            >
              <header className="grid grid-cols-[1fr_auto] gap-8 border-b-2 border-black pb-4">
                <div>
                  <div className="text-2xl font-black tracking-[0.2em]">VITARICH</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide">Farm Management System</div>
                </div>
                <div className="text-right">
                  <h1 className="text-xl font-bold uppercase">{receiptTitle}</h1>
                  <div className="mt-2 grid grid-cols-[auto_150px] gap-x-3 text-left">
                    <span className="font-semibold">DR No.</span>
                    <span className="border-b border-black font-bold">{delivery.giNo}</span>
                    <span className="font-semibold">Date</span>
                    <span className="border-b border-black">{formatDate(delivery.issueDate)}</span>
                    <span className="font-semibold">Status</span>
                    <span className="border-b border-black">{delivery.status}</span>
                  </div>
                </div>
              </header>

              <section className="mt-6 grid grid-cols-[120px_1fr] gap-x-3 gap-y-2">
                <span className="font-bold uppercase">{isCleanup ? 'Farm' : 'Delivered To'}</span>
                <span className="border-b border-black px-2">{delivery.farmName || delivery.farmCode || '-'}</span>
                <span className="font-bold uppercase">Farm Code</span>
                <span className="border-b border-black px-2">{delivery.farmCode || '-'}</span>
                <span className="font-bold uppercase">Building</span>
                <span className="border-b border-black px-2">
                  {delivery.lines[0]?.fromWarehouseName || delivery.lines[0]?.fromWarehouseCode || delivery.fromWarehouseName || delivery.fromWarehouseCode || '-'}
                </span>
              </section>

              <section className="mt-7">
                <p className="mb-2">
                  {isCleanup
                    ? 'The following items were issued for farm clean-up:'
                    : 'Received the following delivery in good order and condition:'}
                </p>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-stone-200">
                      <th className="w-10 border border-black px-2 py-2 text-center">#</th>
                      {isCleanup && <th className="border border-black px-2 py-2 text-left">Type</th>}
                      <th className="border border-black px-2 py-2 text-left">Item</th>
                      <th className="border border-black px-2 py-2 text-left">Description</th>
                      <th className="border border-black px-2 py-2 text-left">Batch</th>
                      <th className="border border-black px-2 py-2 text-left">Building</th>
                      <th className="border border-black px-2 py-2 text-right">Quantity</th>
                      <th className="border border-black px-2 py-2 text-center">UOM</th>
                      {isCleanup && <th className="border border-black px-2 py-2 text-left">Remarks</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {delivery.lines.map((line, index) => (
                      <tr key={line.id}>
                        <td className="border border-black px-2 py-2 text-center">{index + 1}</td>
                        {isCleanup && <td className="border border-black px-2 py-2 font-medium">Clean up</td>}
                        <td className="border border-black px-2 py-2 font-medium">{line.itemCode}</td>
                        <td className="border border-black px-2 py-2">{line.description || '-'}</td>
                        <td className="border border-black px-2 py-2">{line.batchNumber || '-'}</td>
                        <td className="border border-black px-2 py-2">{line.fromWarehouseCode || '-'}</td>
                        <td className="border border-black px-2 py-2 text-right tabular-nums">{formatQuantity(line.baseQty)}</td>
                        <td className="border border-black px-2 py-2 text-center">{line.baseUom || '-'}</td>
                        {isCleanup && <td className="border border-black px-2 py-2">{line.lineRemarks || '-'}</td>}
                      </tr>
                    ))}
                    {isCleanup && variancePostings.map((posting, index) => {
                      const matchingLine = delivery.lines.find(line =>
                        line.itemCode === posting.itemCode && line.batchNumber === posting.batchNumber,
                      ) ?? delivery.lines.find(line => line.itemCode === posting.itemCode)
                      return (
                        <tr key={`variance-${posting.id}`}>
                          <td className="border border-black px-2 py-2 text-center">{delivery.lines.length + index + 1}</td>
                          <td className="border border-black px-2 py-2 font-medium">Variance</td>
                          <td className="border border-black px-2 py-2 font-medium">{posting.itemCode}</td>
                          <td className="border border-black px-2 py-2">{matchingLine?.description || '-'}</td>
                          <td className="border border-black px-2 py-2">{posting.batchNumber || '-'}</td>
                          <td className="border border-black px-2 py-2">{posting.warehouseCode || '-'}</td>
                          <td className="border border-black px-2 py-2 text-right tabular-nums">{formatQuantity(posting.qty)}</td>
                          <td className="border border-black px-2 py-2 text-center">{matchingLine?.baseUom || '-'}</td>
                          <td className="border border-black px-2 py-2">{matchingLine?.lineRemarks || '-'}</td>
                        </tr>
                      )
                    })}
                    <tr>
                      <td colSpan={isCleanup ? 6 : 5} className="border border-black px-2 py-2 text-right font-bold uppercase">{isCleanup ? 'Total Clean up' : 'Total'}</td>
                      <td className="border border-black px-2 py-2 text-right font-bold tabular-nums">{formatQuantity(totalQuantity)}</td>
                      <td className="border border-black px-2 py-2" />
                      {isCleanup && <td className="border border-black px-2 py-2" />}
                    </tr>
                    {isCleanup && (
                      <tr>
                        <td colSpan={6} className="border border-black px-2 py-2 text-right font-bold uppercase">Total Variance</td>
                        <td className="border border-black px-2 py-2 text-right font-bold tabular-nums">{formatQuantity(totalVariance)}</td>
                        <td className="border border-black px-2 py-2" />
                        <td className="border border-black px-2 py-2" />
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              <section className="mt-5">
                <div className="font-semibold">Remarks</div>
                <div className="mt-1 min-h-12 border-b border-black px-2 py-1">{delivery.remarks || ''}</div>
              </section>

              <section className="mt-16 grid grid-cols-3 gap-10 text-center">
                {(isCleanup
                  ? ['Prepared By', 'Issued By', 'Confirmed By']
                  : ['Prepared / Released By', 'Delivered By', 'Received By']
                ).map(label => (
                  <div key={label}>
                    <div className="h-8 border-b border-black" />
                    <div className="mt-1 font-semibold">{label}</div>
                    <div className="text-[10px]">Signature over printed name / date</div>
                  </div>
                ))}
              </section>

              <footer className="mt-12 border-t border-black pt-2 text-center text-[10px]">
                This is a system-generated {isCleanup ? 'clean-up' : 'delivery'} receipt.
              </footer>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button type="button" disabled={!delivery || loading} onClick={() => printReceipt()}>
            <Printer className="size-4" />
            Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
