'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { format } from 'date-fns'

import Breadcrumb from '@/lib/Breadcrumb'
import { usePermission } from '@/hooks/usePermission'
import {
  PageHeader,
  PageSection,
  PageSectionDescription,
  PageSectionHeader,
  PageSectionTitle,
  PageShell,
} from '@/components/ui/page-layout'
import type { CombinedTransactionSaveResult } from '@/lib/types/combinedTransaction'

type FormRenderProps = {
  onSaved: (result: CombinedTransactionSaveResult) => void
  onTransactionDateChange: (date: string) => void
}

type HistoryRenderProps = {
  dateFrom: string
  dateTo: string
  onDateFromChange: (date: string) => void
  onDateToChange: (date: string) => void
  refreshToken: number
}

type CombinedTransactionPageProps = {
  title: string
  parentLabel: string
  permissionPath: string
  renderForm: (props: FormRenderProps) => ReactNode
  renderHistory: (props: HistoryRenderProps) => ReactNode
}

export default function CombinedTransactionPage({
  title,
  parentLabel,
  permissionPath,
  renderForm,
  renderHistory,
}: CombinedTransactionPageProps) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const cannotView = usePermission(`${permissionPath}/view`)
  const cannotInsert = usePermission(`${permissionPath}/insert`)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [formKey, setFormKey] = useState(0)
  const [refreshToken, setRefreshToken] = useState(0)

  const handleTransactionDateChange = useCallback((date: string) => {
    if (!date) return
    setDateFrom(date)
    setDateTo(date)
  }, [])

  const handleSaved = useCallback((result: CombinedTransactionSaveResult) => {
    const transactionDate = result.date || format(new Date(), 'yyyy-MM-dd')
    setDateFrom(transactionDate)
    setDateTo(transactionDate)
    setFormKey(current => current + 1)
    setRefreshToken(current => current + 1)

    window.setTimeout(() => {
      const target = document.getElementById('historical-data')
      if (!target) return
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#historical-data`)
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }, [])

  return (
    <PageShell>
      <PageHeader>
        <Breadcrumb FirstPreviewsPageName={parentLabel} CurrentPageName={title} />
      </PageHeader>

      <section aria-labelledby="data-input-title" className="min-w-0 space-y-2">
        <PageSectionHeader className="rounded-md border bg-card">
          <div>
            <PageSectionTitle id="data-input-title">Data Input</PageSectionTitle>
            <PageSectionDescription>Create and save a new {title.toLowerCase()} transaction.</PageSectionDescription>
          </div>
        </PageSectionHeader>

        {cannotInsert ? (
          <PageSection className="p-3 text-sm text-muted-foreground">
            You do not have permission to create this transaction.
          </PageSection>
        ) : (
          <div key={formKey} className="min-w-0">
            {renderForm({
              onSaved: handleSaved,
              onTransactionDateChange: handleTransactionDateChange,
            })}
          </div>
        )}
      </section>

      <section id="historical-data" aria-labelledby="historical-data-title" className="min-w-0 scroll-mt-3 space-y-2">
        <PageSectionHeader className="rounded-md border bg-card">
          <div>
            <PageSectionTitle id="historical-data-title">Historical Data</PageSectionTitle>
            <PageSectionDescription>Refresh to load transactions for the selected date range.</PageSectionDescription>
          </div>
        </PageSectionHeader>

        {cannotView ? (
          <PageSection className="p-3 text-sm text-muted-foreground">
            You do not have permission to view transaction history.
          </PageSection>
        ) : renderHistory({
          dateFrom,
          dateTo,
          onDateFromChange: setDateFrom,
          onDateToChange: setDateTo,
          refreshToken,
        })}
      </section>
    </PageShell>
  )
}
