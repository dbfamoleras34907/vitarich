'use client'

import { db } from '@/lib/Supabase/supabaseClient'

export type BatchResetType = 'Never' | 'Daily' | 'Monthly' | 'Yearly'
export type BatchDateFormat = 'NONE' | 'YYYYMMDD' | 'YYMMDD' | 'YYYYMM' | 'YYMM' | 'YYYY' | 'YY'
export type BatchIssueMethod = 'FIFO' | 'FEFO' | 'LIFO' | 'MANUAL'
export type BatchDefaultStatus = 'Released' | 'Hold' | 'Blocked'

export type BatchNumberSeries = {
  id: number
  created_by: string | null
  created_at: string
  updated_by: number | null
  updated_at: string | null
  code: string
  name: string
  prefix: string | null
  suffix: string | null
  separator: string
  next_number: number
  number_length: number
  reset_type: BatchResetType
  date_format: BatchDateFormat
  active: boolean
  remarks: string | null
  void: string
}

export type BatchNumberSeriesPayload = {
  code: string
  name: string
  prefix: string | null
  suffix: string | null
  separator: string
  next_number: number
  number_length: number
  reset_type: BatchResetType
  date_format: BatchDateFormat
  active: boolean
  remarks: string | null
}

export type BatchRule = {
  id: number
  created_by: string | null
  created_at: string
  updated_by: number | null
  updated_at: string | null
  code: string
  name: string
  series_id: number
  item_group_id: number | null
  item_id: number | null
  warehouse_id: number | null
  branch_id: number | null
  auto_generate: boolean
  manual_entry: boolean
  allow_duplicate: boolean
  require_manufacturing_date: boolean
  require_expiry_date: boolean
  expiry_days: number | null
  shelf_life_days: number | null
  issue_method: BatchIssueMethod
  require_supplier_batch: boolean
  require_qc: boolean
  default_status: BatchDefaultStatus
  active: boolean
  remarks: string | null
  void: string
}

export type BatchRulePayload = {
  code: string
  name: string
  series_id: number
  item_group_id: number | null
  item_id: number | null
  warehouse_id: number | null
  branch_id: number | null
  auto_generate: boolean
  manual_entry: boolean
  allow_duplicate: boolean
  require_manufacturing_date: boolean
  require_expiry_date: boolean
  expiry_days: number | null
  shelf_life_days: number | null
  issue_method: BatchIssueMethod
  require_supplier_batch: boolean
  require_qc: boolean
  default_status: BatchDefaultStatus
  active: boolean
  remarks: string | null
}

export type BatchLookupOption = {
  id: number
  code: string
  name: string
}

export type BatchReferences = {
  itemGroups: BatchLookupOption[]
  items: BatchLookupOption[]
  warehouses: BatchLookupOption[]
  farms: BatchLookupOption[]
}

async function getSessionUserId() {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  return data.session?.user.id ?? null
}

export async function getBatchNumberSeries(): Promise<BatchNumberSeries[]> {
  const { data, error } = await db
    .from('batch_number_series')
    .select('*')
    .eq('void', '1')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as BatchNumberSeries[]
}

export async function saveBatchNumberSeries(
  payload: BatchNumberSeriesPayload,
  id?: number | null,
): Promise<BatchNumberSeries> {
  const authId = await getSessionUserId()
  const cleanPayload = {
    ...payload,
    code: payload.code.trim().toUpperCase(),
    name: payload.name.trim(),
    prefix: payload.prefix?.trim() || null,
    suffix: payload.suffix?.trim() || null,
    separator: payload.separator || '-',
    remarks: payload.remarks?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const query = id
    ? db
        .from('batch_number_series')
        .update(cleanPayload)
        .eq('id', id)
        .select('*')
        .single()
    : db
        .from('batch_number_series')
        .insert({
          ...cleanPayload,
          created_by: authId,
        })
        .select('*')
        .single()

  const { data, error } = await query
  if (error) throw error
  return data as BatchNumberSeries
}

export async function deleteBatchNumberSeries(id: number) {
  const { error } = await db
    .from('batch_number_series')
    .update({
      void: '0',
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw error
}

export async function getBatchRules(): Promise<BatchRule[]> {
  const { data, error } = await db
    .from('batch_rules')
    .select('*')
    .eq('void', '1')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as BatchRule[]
}

export async function saveBatchRule(
  payload: BatchRulePayload,
  id?: number | null,
): Promise<BatchRule> {
  const authId = await getSessionUserId()
  const cleanPayload = {
    ...payload,
    code: payload.code.trim().toUpperCase(),
    name: payload.name.trim(),
    remarks: payload.remarks?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const query = id
    ? db
        .from('batch_rules')
        .update(cleanPayload)
        .eq('id', id)
        .select('*')
        .single()
    : db
        .from('batch_rules')
        .insert({
          ...cleanPayload,
          created_by: authId,
        })
        .select('*')
        .single()

  const { data, error } = await query
  if (error) throw error
  return data as BatchRule
}

export async function deleteBatchRule(id: number) {
  const { error } = await db
    .from('batch_rules')
    .update({
      void: '0',
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw error
}

export async function getBatchReferences(): Promise<BatchReferences> {
  const [itemGroupsResult, itemsResult, warehousesResult, farmsResult] = await Promise.all([
    db.from('item_groups').select('id, code, name').eq('void', '1').order('code'),
    db.from('items').select('id, item_code, item_name, description').eq('void', 1).order('item_code'),
    db.from('i_warehouse').select('id, whse_code, whse_name').eq('is_active', true).order('whse_code'),
    db.from('farms').select('id, code, name').eq('void', 1).order('code'),
  ])

  if (itemGroupsResult.error) throw itemGroupsResult.error
  if (itemsResult.error) throw itemsResult.error
  if (warehousesResult.error) throw warehousesResult.error
  if (farmsResult.error) throw farmsResult.error

  type ItemGroupRow = { id: number; code: string | null; name: string | null }
  type ItemRow = { id: number; item_code: string | null; item_name: string | null; description: string | null }
  type WarehouseRow = { id: number; whse_code: string | null; whse_name: string | null }
  type FarmRow = { id: number; code: string | null; name: string | null }

  return {
    itemGroups: ((itemGroupsResult.data ?? []) as ItemGroupRow[]).map(row => ({
      id: row.id,
      code: row.code ?? '',
      name: row.name ?? '',
    })),
    items: ((itemsResult.data ?? []) as ItemRow[]).map(row => ({
      id: row.id,
      code: row.item_code ?? '',
      name: row.item_name || row.description || '',
    })),
    warehouses: ((warehousesResult.data ?? []) as WarehouseRow[]).map(row => ({
      id: row.id,
      code: row.whse_code ?? '',
      name: row.whse_name ?? '',
    })),
    farms: ((farmsResult.data ?? []) as FarmRow[]).map(row => ({
      id: row.id,
      code: row.code ?? '',
      name: row.name ?? '',
    })),
  }
}
