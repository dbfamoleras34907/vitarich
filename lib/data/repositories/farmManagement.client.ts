import { fetchWithInternetErrorNotice, readJsonResponse } from '@/lib/network/http'
import { db } from '@/lib/Supabase/supabaseClient'
import {
  ACTIVE_FARM_VOID,
  APPROVED_FARM_STATUS,
  activeApprovedFarmsQuery,
} from '@/lib/data/repositories/farms'

export type FarmRecord = {
  id: number
  code: string | null
  name: string | null
  farm_type: string | null
  production_model: string | null
  island: string | null
  administrative_region: string | null
  region: string | null
  approval_status: string | null
  contact_person: string | null
  contact_number: string | null
  remarks: string | null
  void: string | number | null
  [key: string]: unknown
}

export type FarmDirectoryImportRow = {
  id: number
  rowNumber: number
  code: string
  name: string
  farm_type: 'BE' | 'HA' | 'BR'
  production_model: string
  island: string
  administrative_region: string
  contact_person: string
  contact_number: string
  remarks: string
}

export type FarmDirectoryImportFailure = {
  id: number
  rowNumber: number
  message: string
}

export async function updateFarmDirectoryRows(rows: FarmDirectoryImportRow[]) {
  if (rows.length === 0) return { updatedCount: 0, failures: [] as FarmDirectoryImportFailure[] }

  const ids = rows.map(row => row.id)
  const { data: farms, error: fetchError } = await db
    .from('farms')
    .select('id, approval_status, void')
    .in('id', ids)

  if (fetchError) throw fetchError

  const farmsById = new Map((farms ?? []).map(farm => [Number(farm.id), farm]))
  const validationFailures = rows.flatMap(row => {
    const farm = farmsById.get(row.id)
    if (!farm || farm.void !== ACTIVE_FARM_VOID) {
      return [{ id: row.id, rowNumber: row.rowNumber, message: 'Farm was not found or is no longer active.' }]
    }
    if (String(farm.approval_status || APPROVED_FARM_STATUS) !== APPROVED_FARM_STATUS) {
      return [{ id: row.id, rowNumber: row.rowNumber, message: 'Only approved farms can be updated.' }]
    }
    return []
  })

  if (validationFailures.length > 0) {
    return { updatedCount: 0, failures: validationFailures }
  }

  const updateResults = await Promise.all(rows.map(async row => {
    const farm = farmsById.get(row.id)
    if (!farm) {
      return { id: row.id, rowNumber: row.rowNumber, error: 'Farm was not found.' }
    }

    try {
      let query = db
        .from('farms')
        .update({
          code: row.code,
          name: row.name,
          farm_type: row.farm_type,
          production_model: row.production_model,
          island: row.island,
          administrative_region: row.administrative_region,
          contact_person: row.contact_person,
          contact_number: row.contact_number,
          remarks: row.remarks,
        })
        .eq('id', row.id)
        .eq('void', ACTIVE_FARM_VOID)

      query = farm.approval_status == null
        ? query.is('approval_status', null)
        : query.eq('approval_status', farm.approval_status)

      const { data, error } = await query.select('id').maybeSingle()
      if (error) return { id: row.id, rowNumber: row.rowNumber, error: error.message }
      if (!data) return { id: row.id, rowNumber: row.rowNumber, error: 'Farm status changed before the update completed.' }
      return { id: row.id, rowNumber: row.rowNumber, error: null }
    } catch (error) {
      return {
        id: row.id,
        rowNumber: row.rowNumber,
        error: error instanceof Error ? error.message : 'Unable to update this farm.',
      }
    }
  }))

  const failures = updateResults.flatMap(result =>
    result.error
      ? [{ id: result.id, rowNumber: result.rowNumber, message: result.error }]
      : [],
  )

  return {
    updatedCount: updateResults.length - failures.length,
    failures,
  }
}

export async function getActiveFarms({ approvedOnly = false, farmType }: {
  approvedOnly?: boolean
  farmType?: 'BR' | 'BE' | 'HA'
} = {}) {
  let query = db
    .from('farms')
    .select('*')
    .eq('void', ACTIVE_FARM_VOID)
  if (approvedOnly) query = activeApprovedFarmsQuery(query)
  if (farmType) query = query.eq('farm_type', farmType)
  const { data, error } = await query
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
