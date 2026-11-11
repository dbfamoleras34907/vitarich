'use client'

import GoodsIssueForm from '@/app/inv/gi/new/Layout'
import type { CombinedTransactionFormProps } from '@/lib/types/combinedTransaction'

type LayoutProps = CombinedTransactionFormProps & {
  mode?: 'draft' | 'post'
}

export default function Layout({ mode = 'draft', ...combinedProps }: LayoutProps) {
  return (
    <GoodsIssueForm
      mode={mode}
      triggeredBy="BR-DR"
      documentPrefix="BR-DR"
      documentNumberLabel="TS No."
      issueDateLabel="Posting Date"
      basePath="/brd/dr"
      permissionPath="/brd/dr"
      parentLabel="Broiler"
      parentLink="/brd"
      listLabel="Harvest & Delivery"
      formLabel={mode === 'post' ? 'Post Harvest & Delivery' : 'New Harvest & Delivery'}
      useDefaultFarm
      warehouseLabel="Building"
      warehouseTypeFilter="Building"
      showFlockCardInformation
      warehouseScope="line"
      allowImmediatePost
      lineQuantityLabel="Harvest Quantity"
      bodyWeightLabel="ALW g"
      showLineTsDrNumber
      excelIssueLines
      showLineQuantityAllocationWarnings={false}
      showRemarksInActionRow
      {...combinedProps}
    />
  )
}
