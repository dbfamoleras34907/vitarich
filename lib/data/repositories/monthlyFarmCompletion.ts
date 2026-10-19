import { db } from '@/lib/Supabase/supabaseClient'
import type { MonthlyFarmCompletionParams, MonthlyFarmCompletionReport } from './monthlyFarmCompletion.shared'

export async function getMonthlyFarmCompletionReport(params: MonthlyFarmCompletionParams) {
  const { data: { session }, error: sessionError } = await db.auth.getSession()
  if (sessionError || !session?.access_token) throw sessionError ?? new Error('Authentication is required.')

  const response = await fetch('/api/reports/monthly-farm-completion', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  const result = await response.json() as MonthlyFarmCompletionReport & { error?: string }
  if (!response.ok) throw new Error(result.error || 'Unable to load the Monthly Farm Completion Report.')
  return result
}
