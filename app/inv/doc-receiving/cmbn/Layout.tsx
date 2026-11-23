'use client'

import CombinedTransactionPage from '@/components/transactions/CombinedTransactionPage'
import GoodsReceiveHistory from '../Layout'
import NewGoodsReceive from '../new/Layout'

export default function Layout() {
  return (
    <CombinedTransactionPage
      title="DOC Placement"
      parentLabel="Broiler"
      permissionPath="/inv/doc-receiving"
      renderForm={({ onSaved, onTransactionDateChange }) => (
        <NewGoodsReceive
          embedded
          onSaved={onSaved}
          onTransactionDateChange={onTransactionDateChange}
        />
      )}
      renderHistory={historyProps => (
        <GoodsReceiveHistory embedded autoLoad={false} {...historyProps} />
      )}
    />
  )
}
