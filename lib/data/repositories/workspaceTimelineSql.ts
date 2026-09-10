import { fetchWithInternetErrorNotice, readJsonResponse } from '@/lib/network/http'
import { db } from '@/lib/Supabase/supabaseClient'

export type WorkspaceTimelineSql = { filename: string; sql: string }

export async function requestWorkspaceTimelineSql(password: string, signal?: AbortSignal): Promise<WorkspaceTimelineSql> {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Your session has expired. Please sign in again.')

  const response = await fetchWithInternetErrorNotice('/api/wks/timelines/sql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    cache: 'no-store',
    signal,
  })
  const result = await readJsonResponse<Partial<WorkspaceTimelineSql> & { error?: string }>(response)
  if (!response.ok || typeof result.sql !== 'string' || typeof result.filename !== 'string') {
    throw new Error(result.error || 'Unable to load the timeline SQL.')
  }
  return { sql: result.sql, filename: result.filename }
}
