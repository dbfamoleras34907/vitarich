'use client'

import CombinedTransactionPage from '@/components/transactions/CombinedTransactionPage'
import CleanupHistory from '../Layout'
import CleanupForm from '../new/Layout'

export default function Layout() {
  return (
    <CombinedTransactionPage
      title="Clean up"
      parentLabel="Broiler"
      permissionPath="/brd/cu"
      renderForm={({ onSaved, onTransactionDateChange }) => (
        <CleanupForm
          embedded
          onSaved={onSaved}
          onTransactionDateChange={onTransactionDateChange}
        />
      )}
      renderHistory={historyProps => (
        <CleanupHistory embedded autoLoad={false} {...historyProps} />
      )}
    />
  )
}
