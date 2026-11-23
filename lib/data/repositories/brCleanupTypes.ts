import { db } from '@/lib/Supabase/supabaseClient'
import { fetchWithInternetErrorNotice, readJsonResponse } from '@/lib/network/http'
import { createUuid } from '@/lib/utils/createUuid'

export type BrCleanupType = {
  id: number
  code: string
  name: string
  is_void: boolean
  created_at: string
  updated_at: string | null
  voided_at: string | null
}

export async function listActiveBrCleanupTypes() {
  const { data, error } = await db
    .from('br_cleanup_types')
    .select('id, code, name, is_void, created_at, updated_at, voided_at')
    .eq('is_void', false)
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as BrCleanupType[]
}

type CleanupTypeResponse = {
  data?: BrCleanupType
  rows?: BrCleanupType[]
  error?: string
}

async function authorizedHeaders() {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  if (!data.session?.access_token) throw new Error('Your session has expired. Please sign in again.')

  return {
    Authorization: `Bearer ${data.session.access_token}`,
    'Content-Type': 'application/json',
  }
}

async function requestCleanupTypes(init: RequestInit = {}) {
  const response = await fetchWithInternetErrorNotice('/api/brd/settings/cleanup-types', {
    ...init,
    headers: { ...(await authorizedHeaders()), ...init.headers },
    cache: 'no-store',
  })
  return readJsonResponse<CleanupTypeResponse>(response, 'Unable to save Cleanup Types.')
}

export async function listBrCleanupTypes() {
  const result = await requestCleanupTypes()
  return result.rows ?? []
}

export async function createBrCleanupType(name: string) {
  const result = await requestCleanupTypes({
    method: 'POST',
    body: JSON.stringify({ name, actionId: createUuid() }),
  })
  if (!result.data) throw new Error('The Cleanup Type was not returned by the server.')
  return result.data
}

export async function renameBrCleanupType(id: number, name: string) {
  const result = await requestCleanupTypes({
    method: 'PATCH',
    body: JSON.stringify({ action: 'rename', id, name, actionId: createUuid() }),
  })
  if (!result.data) throw new Error('The Cleanup Type was not returned by the server.')
  return result.data
}

export async function setBrCleanupTypeVoid(id: number, isVoid: boolean) {
  const result = await requestCleanupTypes({
    method: 'PATCH',
    body: JSON.stringify({ action: 'set_void', id, isVoid, actionId: createUuid() }),
  })
  if (!result.data) throw new Error('The Cleanup Type was not returned by the server.')
  return result.data
}
