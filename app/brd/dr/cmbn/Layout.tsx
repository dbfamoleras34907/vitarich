'use client'

import CombinedTransactionPage from '@/components/transactions/CombinedTransactionPage'
import HarvestHistory from '../Layout'
import HarvestForm from '../new/Layout'

export default function Layout() {
  return (
    <CombinedTransactionPage
      title="Harvest & Delivery"
      parentLabel="Broiler"
      permissionPath="/brd/dr"
      renderForm={({ onSaved, onTransactionDateChange }) => (
        <HarvestForm
          embedded
          onSaved={onSaved}
          onTransactionDateChange={onTransactionDateChange}
        />
      )}
      renderHistory={historyProps => (
        <HarvestHistory embedded autoLoad={false} {...historyProps} />
      )}
    />
  )
}
