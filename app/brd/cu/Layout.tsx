import GoodsIssueHistory from '@/app/inv/gi/Layout'
import type { CombinedTransactionHistoryProps } from '@/lib/types/combinedTransaction'

export default function Layout(props: CombinedTransactionHistoryProps = {}) {
  return (
    <GoodsIssueHistory
      config={{
        triggeredBy: 'BR-CU',
        documentPrefix: 'BR-CU',
        newActionLabel: 'New Clean up',
        basePath: '/brd/cu',
        permissionPath: '/brd/cu',
        parentLabel: 'Broiler',
        title: 'Clean up',
        listDescription: 'clean-up transaction(s)',
        searchPlaceholder: 'Search clean-up transactions...',
        emptyMessage: 'No clean-up transactions found',
        noResultsMessage: 'No matching clean-up transactions found',
        useDefaultFarm: true,
        showFarmFilter: true,
        showDateFilter: true,
        showDeliveryReceipt: true,
        receiptLabel: 'Clean-up Receipt',
        showWarehouseName: true,
        showProcessListAttribution: true,
      }}
      {...props}
    />
  )
}
