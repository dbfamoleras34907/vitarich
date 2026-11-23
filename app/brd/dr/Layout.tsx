import GoodsIssueHistory from '@/app/inv/gi/Layout'
import type { CombinedTransactionHistoryProps } from '@/lib/types/combinedTransaction'

export default function Layout(props: CombinedTransactionHistoryProps = {}) {
  return (
    <GoodsIssueHistory
      config={{
        triggeredBy: 'BR-DR',
        documentPrefix: 'BR-DR',
        basePath: '/brd/dr',
        permissionPath: '/brd/dr',
        parentLabel: 'Broiler',
        title: 'Harvest & Delivery',
        listDescription: 'delivery transaction(s)',
        searchPlaceholder: 'Search delivery transactions...',
        emptyMessage: 'No delivery transactions found',
        noResultsMessage: 'No matching delivery transactions found',
        useDefaultFarm: true,
        showFarmFilter: true,
        showDateFilter: true,
        showDeliveryReceipt: true,
        showDuplicateAction: true,
        showWarehouseName: true,
        showProcessListAttribution: true,
      }}
      {...props}
    />
  )
}
