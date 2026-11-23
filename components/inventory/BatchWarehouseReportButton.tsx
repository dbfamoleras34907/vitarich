'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { BatchTransactionTrail } from '@/lib/data/repositories/batchTransactionTrail'
import { buildBatchWarehouseReportHref } from '@/lib/reports/warehouseReportLink'

type BatchWarehouseReportButtonProps = {
  batchNumber: string
  rows: BatchTransactionTrail[]
}

export default function BatchWarehouseReportButton({
  batchNumber,
  rows,
}: BatchWarehouseReportButtonProps) {
  const href = buildBatchWarehouseReportHref(batchNumber, rows)

  if (!href) {
    return (
      <Button type="button" variant="outline" disabled>
        <ExternalLink className="size-4" />
        Open in Warehouse Report
      </Button>
    )
  }

  return (
    <Button asChild type="button" variant="outline">
      <Link href={href} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="size-4" />
        Open in Warehouse Report
      </Link>
    </Button>
  )
}
