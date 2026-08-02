'use client'

import GoodsIssueForm from '@/app/inv/gi/new/Layout'

type LayoutProps = {
  mode?: 'draft' | 'post'
}

export default function Layout({ mode = 'draft' }: LayoutProps) {
  return (
    <GoodsIssueForm
      mode={mode}
      triggeredBy="BR-DR"
      documentPrefix="BR-DR"
      basePath="/brd/dr"
      permissionPath="/brd/dr"
      parentLabel="Broiler"
      parentLink="/brd"
      listLabel="Delivery"
      formLabel={mode === 'post' ? 'Post Delivery' : 'New Delivery'}
      useDefaultFarm
      warehouseLabel="Building"
      warehouseTypeFilter="Building"
      showFlockCardInformation
      warehouseScope="line"
      allowImmediatePost
    />
  )
}
