'use client'

import GoodsIssueForm from '@/app/inv/gi/new/Layout'

type LayoutProps = {
  mode?: 'draft' | 'post'
}

export default function Layout({ mode = 'draft' }: LayoutProps) {
  return (
    <GoodsIssueForm
      mode={mode}
      triggeredBy="BR-CU"
      documentPrefix="BR-CU"
      basePath="/brd/cu"
      permissionPath="/brd/cu"
      parentLabel="Broiler"
      parentLink="/brd"
      listLabel="Clean up"
      formLabel={mode === 'post' ? 'Post Clean up' : 'New Clean up'}
      useDefaultFarm
      warehouseLabel="Building"
      warehouseTypeFilter="Building"
      showFlockCardInformation
      warehouseScope="line"
    />
  )
}
