import { db } from '@/lib/Supabase/supabaseClient'

export type AtomicItemMasterImportRow<TPayload extends object> = {
  rowNumber: number
  payload: TPayload
}

export type AtomicItemMasterImportResult = {
  importedCount: number
  skippedCount: number
}

export async function importItemMasterRows<TPayload extends object>(
  rows: AtomicItemMasterImportRow<TPayload>[],
  options: { skipExisting: boolean },
) {
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError

  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Your session has expired. Please sign in again.')

  const response = await fetch('/api/a_dean/items/import', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rows, skipExisting: options.skipExisting }),
  })

  const result = await response.json() as Partial<AtomicItemMasterImportResult> & { error?: string }
  if (
    !response.ok ||
    !Number.isInteger(result.importedCount) ||
    !Number.isInteger(result.skippedCount)
  ) {
    throw new Error(result.error || 'The Item Master import could not be completed.')
  }

  return {
    importedCount: Number(result.importedCount),
    skippedCount: Number(result.skippedCount),
  }
}
