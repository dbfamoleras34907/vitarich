import GoodsIssueHistory from '@/app/inv/gi/Layout'

export default function Layout() {
  return (
    <GoodsIssueHistory
      config={{
        triggeredBy: 'BR-DR',
        documentPrefix: 'BR-DR',
        basePath: '/brd/dr',
        permissionPath: '/brd/dr',
        parentLabel: 'Broiler',
        title: 'Delivery',
        listDescription: 'delivery transaction(s)',
        searchPlaceholder: 'Search delivery transactions...',
        emptyMessage: 'No delivery transactions found',
        noResultsMessage: 'No matching delivery transactions found',
        useDefaultFarm: true,
        showDeliveryReceipt: true,
        showDuplicateAction: true,
      }}
    />
  )
}
