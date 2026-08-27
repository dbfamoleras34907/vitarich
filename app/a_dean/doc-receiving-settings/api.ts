import { db } from '@/lib/Supabase/supabaseClient'

export type DocItemOption = {
  id: number
  item_code: string
  item_name: string | null
  description?: string | null
  item_group?: string | null
  fms_group?: string | null
  group?: string | null
}

export type DocReceivingSettings = {
  id?: number
  farm_id: number
  good_doc: number | null
  bad_doc: number | null
  reject_doc: number | null
  void?: string
  created_at?: string
  updated_at?: string | null
}

export type DocCycleExcludedBuilding = {
  building_whse_id: number
}

export async function getDocItemOptions() {
  const { data, error } = await db
    .from('items')
    .select('*')
    .eq('void', 1)
    .order('item_code', { ascending: true })

  if (error) throw error
  return ((data || []) as DocItemOption[]).filter(isDocItem)
}

function isDocItem(item: DocItemOption) {
  const tokens = [
    item.item_code,
    item.item_name,
    item.description,
    item.item_group,
    item.fms_group,
    item.group,
  ].map(value => String(value ?? '').trim().toUpperCase())

  return tokens.some(token => token === 'DOC' || token.startsWith('DOC'))
}

export async function getDocReceivingSettings(
  farmId: number,
  options: { usePreviousFarmDefaults?: boolean } = {},
) {
  if (!Number.isFinite(farmId) || farmId <= 0) return null

  const { data, error } = await db
    .from('doc_rec_settings')
    .select('*')
    .eq('void', '1')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (data || !options.usePreviousFarmDefaults) {
    return data as DocReceivingSettings | null
  }

  const { data: previous, error: previousError } = await db
    .from('doc_rec_settings')
    .select('*')
    .eq('void', '1')
    .lt('farm_id', farmId)
    .order('farm_id', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (previousError) throw previousError
  if (!previous) return null

  return {
    ...(previous as DocReceivingSettings),
    id: undefined,
    farm_id: farmId,
    created_at: undefined,
    updated_at: undefined,
  }
}

export async function addDocReceivingSettings(payload: DocReceivingSettings) {
  const farmId = Number(payload.farm_id)
  if (!Number.isFinite(farmId) || farmId <= 0) throw new Error('Please select a farm.')

  const { data: authData } = await db.auth.getUser()
  const { data, error } = await db
    .from('doc_rec_settings')
    .insert({
      farm_id: farmId,
      good_doc: payload.good_doc,
      bad_doc: payload.bad_doc,
      reject_doc: payload.reject_doc,
      created_by: authData.user?.id || null,
      void: '1',
    })
    .select()
    .single()

  if (error) throw error
  return data as DocReceivingSettings
}

export async function updateDocReceivingSettings(id: number, payload: DocReceivingSettings) {
  const farmId = Number(payload.farm_id)
  if (!Number.isFinite(farmId) || farmId <= 0) throw new Error('Please select a farm.')

  const { data: authData } = await db.auth.getUser()
  const { data, error } = await db
    .from('doc_rec_settings')
    .update({
      farm_id: farmId,
      good_doc: payload.good_doc,
      bad_doc: payload.bad_doc,
      reject_doc: payload.reject_doc,
      updated_by: authData.user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('farm_id', farmId)
    .select()
    .single()

  if (error) throw error
  return data as DocReceivingSettings
}

export async function getDocCycleExcludedBuildingIds(farmId: number) {
  if (!Number.isFinite(farmId) || farmId <= 0) return []
  const { data, error } = await db
    .from('doc_cycle_excluded_buildings')
    .select('building_whse_id')
    .eq('farm_id', farmId)
  if (error) throw error
  return (data as DocCycleExcludedBuilding[]).map(row => Number(row.building_whse_id))
}

export async function saveDocCycleExcludedBuildingIds(farmId: number, buildingIds: number[]) {
  const { error } = await db.rpc('save_doc_cycle_excluded_buildings', {
    p_farm_id: farmId,
    p_building_whse_ids: buildingIds,
  })
  if (error) throw error
  return getDocCycleExcludedBuildingIds(farmId)
}
