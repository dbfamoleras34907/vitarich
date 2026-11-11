export type CombinedTransactionSaveResult = {
  id: number | null
  date: string
  status: string
}

export type CombinedTransactionFormProps = {
  embedded?: boolean
  onSaved?: (result: CombinedTransactionSaveResult) => void
  onTransactionDateChange?: (date: string) => void
}

export type CombinedTransactionHistoryProps = {
  embedded?: boolean
  autoLoad?: boolean
  dateFrom?: string
  dateTo?: string
  onDateFromChange?: (date: string) => void
  onDateToChange?: (date: string) => void
  refreshToken?: number
}
