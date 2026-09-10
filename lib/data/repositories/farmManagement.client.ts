import { fetchWithInternetErrorNotice, readJsonResponse } from '@/lib/network/http'
import { db } from '@/lib/Supabase/supabaseClient'
import { ACTIVE_FARM_VOID } from '@/lib/data/repositories/farms'

export type FarmRecord = {
  id: number
  code: string | null
  name: string | null
  farm_type: string | null
  production_model: string | null
  island: string | null
  administrative_region: string | null
  approval_status: string | null
  contact_person: string | null
  contact_number: string | null
  remarks: string | null
  void: string | number | null
  [key: string]: unknown
}

export async function getActiveFarms() {
  const { data, error } = await db
    .from('farms')
    .select('*')
    .eq('void', ACTIVE_FARM_VOID)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as FarmRecord[]
}

export async function getActiveFarmById(id: number) {
  const { data, error } = await db
    .from('farms')
    .select('*')
    .eq('id', id)
    .eq('void', ACTIVE_FARM_VOID)
    .single()

  if (error) throw error
  return data as FarmRecord
}

export async function voidFarm(id: number) {
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError

  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Your session has expired. Please sign in again.')

  const response = await fetchWithInternetErrorNotice('/api/a_dean/farms/void', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })

  const result = await readJsonResponse<{ data?: FarmRecord; error?: string }>(response)
  if (!response.ok || !result.data) {
    throw new Error(result.error || 'Unable to void farm.')
  }

  return result.data
}
