import GoodsIssueHistory from '@/app/inv/gi/Layout'

export default function Layout() {
  return (
    <GoodsIssueHistory
      config={{
        triggeredBy: 'BR-CU',
        documentPrefix: 'BR-CU',
        basePath: '/brd/cu',
        permissionPath: '/brd/cu',
        parentLabel: 'Broiler',
        title: 'Clean up',
        listDescription: 'clean-up transaction(s)',
        searchPlaceholder: 'Search clean-up transactions...',
        emptyMessage: 'No clean-up transactions found',
        noResultsMessage: 'No matching clean-up transactions found',
        useDefaultFarm: true,
        showDeliveryReceipt: true,
        receiptLabel: 'Clean-up Receipt',
      }}
    />
  )
}
