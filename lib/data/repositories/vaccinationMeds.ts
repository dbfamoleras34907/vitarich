'use client'

import { db } from '@/lib/Supabase/supabaseClient'
import { getItemGroupDescendants, type ItemGroup } from '@/lib/data/repositories/itemGroups'

export type VnmFmsType = 'Broiler' | 'Breeder'
export type VnmStatus = 'Draft' | 'Posted' | 'Void'

export type VnmSetting = {
  id?: number
  fms_type: VnmFmsType
  medication_group_id: number | null
  auto_batch_selection: boolean
  allow_historical_cycle_selection: boolean
}

export type VnmMasterValue = {
  id: number
  name: string
  void: string
}

export type VnmWarehouse = {
  id: number
  whse_code: string
  whse_name: string
  warehouse_type: string
  farm_id: number | null
  father_id: number | null
}

export type VnmCycle = {
  id: number
  cycle_no: number
  status: 'Saved' | 'Closed' | 'Cancelled'
}

export type VnmCycleBuilding = {
  farmCycleId: number
  buildingWarehouseId: number
}

export type VnmItem = {
  id: number
  item_code: string
  item_name: string
  inventory_uom: string
  uom_group_code: string | null
  item_group: string | null
  sub_item_group_id: number | null
  sub_item_group_level_1_id: number | null
  sub_item_group_level_2_id: number | null
  sub_item_group_level_3_id: number | null
  fms_group: string | null
  manage_batch_numbers: boolean
}

export type VnmUomConversion = {
  groupCode: string
  uomCode: string
  baseUomCode: string
  baseQty: number
}

export type VnmBatch = {
  batchNumber: string
  manufacturingDate: string
  expiryDate: string
  onHandQty: number
}

export type VnmAllocation = {
  batchNumber: string
  baseQty: number
}

export type VnmLine = {
  id?: number | string
  buildingWarehouseId: number | null
  buildingCode: string
  buildingName: string
  penWarehouseId: number | null
  penCode: string
  penName: string
  treatmentDate: string
  treatmentPeriodDays: number
  itemId: number | null
  medicationCode: string
  medicationName: string
  medicationType: string
  quantity: number
  uom: string
  baseQuantity: number
  baseUom: string
  indicationId: number | null
  indication: string
  routeId: number | null
  route: string
  birdQuantityTreated: number | null
  administeredBy: string
  withdrawalPeriodDays: number | null
  remarks: string
  allocations: VnmAllocation[]
}

export type VnmDocument = {
  id: number | null
  documentNo: string
  farmId: number | null
  farmCode: string
  farmName: string
  fmsType: VnmFmsType
  farmCycleId: number | null
  cycleNo: number | null
  storageWarehouseId: number | null
  storageWarehouseCode: string
  storageWarehouseName: string
  createdDate: string
  status: VnmStatus
  remarks: string
  lines: VnmLine[]
  createdAt?: string
}

export type VnmReferences = {
  settings: VnmSetting | null
  itemGroups: ItemGroup[]
  items: VnmItem[]
  warehouses: VnmWarehouse[]
  cycles: VnmCycle[]
  cycleBuildings: VnmCycleBuilding[]
  indications: VnmMasterValue[]
  routes: VnmMasterValue[]
  conversions: VnmUomConversion[]
}

type DbDocument = {
  id: number
  document_no: string
  farm_id: number
  farm_code: string | null
  farm_name: string | null
  fms_type: VnmFmsType
  farm_cycle_id: number | null
  cycle_no: number | null
  storage_warehouse_id: number
  storage_warehouse_code: string | null
  storage_warehouse_name: string | null
  created_date: string
  status: VnmStatus
  remarks: string | null
  created_at: string
}

type DbLine = {
  id: number
  vnm_document_id: number
  line_no: number
  building_warehouse_id: number
  building_code: string | null
  building_name: string | null
  pen_warehouse_id: number | null
  pen_code: string | null
  pen_name: string | null
  treatment_date: string
  treatment_period_days: number
  item_id: number
  medication_code: string
  medication_name: string
  medication_type: string | null
  quantity: number
  uom: string
  base_quantity: number
  base_uom: string
  indication_id: number
  indication: string
  route_id: number
  route: string
  bird_quantity_treated: number | null
  administered_by: string | null
  withdrawal_period_days: number | null
  remarks: string | null
}

type DbAllocation = {
  vnm_line_id: number
  batch_number: string | null
  base_quantity: number
}

const text = (value: unknown) => String(value ?? '').trim()

const canonicalFmsType = (value: unknown): VnmFmsType | null => {
  const normalized = text(value).toUpperCase()
  if (normalized === 'BR' || normalized === 'BROILER') return 'Broiler'
  if (normalized === 'BE' || normalized === 'BREEDER') return 'Breeder'
  return null
}

export function getFarmFmsType(value: unknown) {
  return canonicalFmsType(value)
}

export function getMedicationType(item: VnmItem, groups: ItemGroup[]) {
  const groupId = item.sub_item_group_level_3_id
    ?? item.sub_item_group_level_2_id
    ?? item.sub_item_group_level_1_id
    ?? item.sub_item_group_id
  if (groupId != null) {
    const group = groups.find(candidate => Number(candidate.id) === Number(groupId))
    if (group) return group.name
  }
  return groups.find(group => group.code === item.item_group)?.name ?? item.item_group ?? ''
}

export function filterMedicationItems(items: VnmItem[], groups: ItemGroup[], setting: VnmSetting | null) {
  if (!setting?.medication_group_id) return []
  const root = groups.find(group => Number(group.id) === Number(setting.medication_group_id))
  if (!root?.id) return []
  const allowedIds = new Set([
    Number(root.id),
    ...getItemGroupDescendants(groups, Number(root.id)).flatMap(group => group.id == null ? [] : [Number(group.id)]),
  ])
  return items.filter(item => {
    const assignedIds = [
      item.sub_item_group_id,
      item.sub_item_group_level_1_id,
      item.sub_item_group_level_2_id,
      item.sub_item_group_level_3_id,
    ].filter((id): id is number => id != null)
    const rootId = groups.find(group => group.code === item.item_group)?.id
    if (rootId != null) assignedIds.push(Number(rootId))
    return assignedIds.some(id => allowedIds.has(Number(id)))
  })
}

export async function getVnmReferences(farmId: number | null, fmsType: VnmFmsType): Promise<VnmReferences> {
  const normalizedFms = fmsType.toLowerCase()
  const [settingsResult, groupsResult, itemsResult, warehousesResult, cyclesResult, cycleBuildingsResult, indicationsResult, routesResult, conversionsResult] = await Promise.all([
    db.from('vnm_settings').select('id, fms_type, medication_group_id, auto_batch_selection, allow_historical_cycle_selection').eq('fms_type', fmsType).maybeSingle(),
    db.from('item_groups').select('id, code, name, father, root_item_group_id, subgroup_level, void').eq('void', '1').order('code'),
    db.from('items').select('id, item_code, item_name, inventory_uom, uom_group_code, item_group, sub_item_group_id, sub_item_group_level_1_id, sub_item_group_level_2_id, sub_item_group_level_3_id, fms_group, manage_batch_numbers').eq('void', 1).eq('is_inventory_item', true).eq('fms_group', normalizedFms).order('item_code'),
    farmId ? db.from('i_warehouse').select('id, whse_code, whse_name, warehouse_type, farm_id, father_id').eq('farm_id', farmId).eq('is_active', true).order('whse_code') : Promise.resolve({ data: [], error: null }),
    farmId && fmsType === 'Broiler' ? db.from('doc_farm_cycles').select('id, cycle_no, status').eq('farm_id', farmId).neq('status', 'Cancelled').order('cycle_no', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    farmId && fmsType === 'Broiler' ? db.from('flock_card').select('farm_cycle_id, building_whse_id').eq('farm_id', farmId).eq('void', '1').not('farm_cycle_id', 'is', null) : Promise.resolve({ data: [], error: null }),
    db.from('vnm_indications').select('id, name, void').eq('void', '1').order('name'),
    db.from('vnm_routes').select('id, name, void').eq('void', '1').order('name'),
    db.from('uom_groups').select('code, base_uom:uom_master_data!uom_groups_base_uom_id_fkey(code), conversions:uom_group_conversions!uom_group_conversions_uom_group_id_fkey(base_qty, void, uom:uom_master_data!uom_group_conversions_uom_id_fkey(code))').eq('void', '1').eq('conversions.void', '1'),
  ])

  const results = [settingsResult, groupsResult, itemsResult, warehousesResult, cyclesResult, cycleBuildingsResult, indicationsResult, routesResult, conversionsResult]
  const failed = results.find(result => result.error)
  if (failed?.error) throw failed.error

  const conversions = (conversionsResult.data ?? []).flatMap(group => {
    const base = Array.isArray(group.base_uom) ? group.base_uom[0] : group.base_uom
    return (group.conversions ?? []).flatMap(conversion => {
      const uom = Array.isArray(conversion.uom) ? conversion.uom[0] : conversion.uom
      if (!base?.code || !uom?.code) return []
      return [{ groupCode: group.code, uomCode: uom.code, baseUomCode: base.code, baseQty: Number(conversion.base_qty) }]
    })
  })

  return {
    settings: settingsResult.data as VnmSetting | null,
    itemGroups: (groupsResult.data ?? []) as ItemGroup[],
    items: (itemsResult.data ?? []) as VnmItem[],
    warehouses: (warehousesResult.data ?? []) as VnmWarehouse[],
    cycles: (cyclesResult.data ?? []) as VnmCycle[],
    cycleBuildings: (cycleBuildingsResult.data ?? []).flatMap(row => row.farm_cycle_id == null || row.building_whse_id == null ? [] : [{ farmCycleId: Number(row.farm_cycle_id), buildingWarehouseId: Number(row.building_whse_id) }]),
    indications: (indicationsResult.data ?? []) as VnmMasterValue[],
    routes: (routesResult.data ?? []) as VnmMasterValue[],
    conversions,
  }
}

export function getItemUomOptions(item: VnmItem, conversions: VnmUomConversion[]) {
  const options = conversions.filter(conversion => conversion.groupCode === item.uom_group_code)
  const base = text(item.inventory_uom)
  if (base && !options.some(option => option.uomCode === base)) {
    return [{ groupCode: item.uom_group_code ?? '', uomCode: base, baseUomCode: base, baseQty: 1 }, ...options]
  }
  return options
}

export async function getVnmOnHandBatches(itemCode: string, warehouseCode: string): Promise<VnmBatch[]> {
  const { data: postings, error: postingError } = await db
    .from('inventory_postings')
    .select('item_code, warehouse_code, batch_number, ref, qty, transfer_type')
    .eq('item_code', itemCode)
    .eq('warehouse_code', warehouseCode)
  if (postingError) throw postingError

  const byBatch = new Map<string, number>()
  for (const posting of postings ?? []) {
    const batch = text(posting.batch_number ?? posting.ref)
    const key = batch || '__NO_BATCH__'
    const signed = String(posting.transfer_type).toUpperCase() === 'OUT' ? -Number(posting.qty ?? 0) : Number(posting.qty ?? 0)
    byBatch.set(key, (byBatch.get(key) ?? 0) + signed)
  }
  const positive = Array.from(byBatch).filter(([, quantity]) => quantity > 0)
  const batchNumbers = positive.map(([batch]) => batch).filter(batch => batch !== '__NO_BATCH__')
  const batchResult = batchNumbers.length
    ? await db.from('item_batches').select('batch_number, manufacturing_date, expiry_date').eq('item_code', itemCode).eq('void', '1').in('batch_number', batchNumbers)
    : { data: [], error: null }
  if (batchResult.error) throw batchResult.error
  const dates = new Map((batchResult.data ?? []).map(batch => [text(batch.batch_number), batch]))

  return positive.map(([key, quantity]) => {
    const batchNumber = key === '__NO_BATCH__' ? '' : key
    const datesRow = dates.get(batchNumber)
    return {
      batchNumber,
      manufacturingDate: text(datesRow?.manufacturing_date),
      expiryDate: text(datesRow?.expiry_date),
      onHandQty: quantity,
    }
  }).sort((left, right) => left.manufacturingDate.localeCompare(right.manufacturingDate) || left.batchNumber.localeCompare(right.batchNumber))
}

function mapDocument(row: DbDocument, lines: DbLine[], allocations: DbAllocation[]): VnmDocument {
  return {
    id: row.id,
    documentNo: row.document_no,
    farmId: row.farm_id,
    farmCode: text(row.farm_code),
    farmName: text(row.farm_name),
    fmsType: row.fms_type,
    farmCycleId: row.farm_cycle_id,
    cycleNo: row.cycle_no,
    storageWarehouseId: row.storage_warehouse_id,
    storageWarehouseCode: text(row.storage_warehouse_code),
    storageWarehouseName: text(row.storage_warehouse_name),
    createdDate: row.created_date,
    status: row.status,
    remarks: text(row.remarks),
    createdAt: row.created_at,
    lines: lines.filter(line => line.vnm_document_id === row.id).map(line => ({
      id: line.id,
      buildingWarehouseId: line.building_warehouse_id,
      buildingCode: text(line.building_code),
      buildingName: text(line.building_name),
      penWarehouseId: line.pen_warehouse_id,
      penCode: text(line.pen_code),
      penName: text(line.pen_name),
      treatmentDate: line.treatment_date,
      treatmentPeriodDays: Number(line.treatment_period_days),
      itemId: line.item_id,
      medicationCode: line.medication_code,
      medicationName: line.medication_name,
      medicationType: text(line.medication_type),
      quantity: Number(line.quantity),
      uom: line.uom,
      baseQuantity: Number(line.base_quantity),
      baseUom: line.base_uom,
      indicationId: line.indication_id,
      indication: line.indication,
      routeId: line.route_id,
      route: line.route,
      birdQuantityTreated: line.bird_quantity_treated == null ? null : Number(line.bird_quantity_treated),
      administeredBy: text(line.administered_by),
      withdrawalPeriodDays: line.withdrawal_period_days == null ? null : Number(line.withdrawal_period_days),
      remarks: text(line.remarks),
      allocations: allocations.filter(allocation => allocation.vnm_line_id === line.id).map(allocation => ({
        batchNumber: text(allocation.batch_number),
        baseQty: Number(allocation.base_quantity),
      })),
    })),
  }
}

export async function getVnmDocuments(limit = 100) {
  const { data: headers, error } = await db.from('vnm_documents').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  const ids = (headers ?? []).map(header => Number(header.id))
  if (!ids.length) return []
  const { data: lines, error: lineError } = await db.from('vnm_lines').select('*').in('vnm_document_id', ids).eq('void', '1').order('line_no')
  if (lineError) throw lineError
  return (headers as DbDocument[]).map(header => mapDocument(header, (lines ?? []) as DbLine[], []))
}

export async function getVnmDocument(id: number) {
  const { data: header, error } = await db.from('vnm_documents').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!header) return null
  const { data: lines, error: lineError } = await db.from('vnm_lines').select('*').eq('vnm_document_id', id).eq('void', '1').order('line_no')
  if (lineError) throw lineError
  const lineIds = (lines ?? []).map(line => Number(line.id))
  const allocationResult = lineIds.length
    ? await db.from('vnm_line_batches').select('vnm_line_id, batch_number, base_quantity').in('vnm_line_id', lineIds).eq('void', '1')
    : { data: [], error: null }
  if (allocationResult.error) throw allocationResult.error
  return mapDocument(header as DbDocument, (lines ?? []) as DbLine[], (allocationResult.data ?? []) as DbAllocation[])
}

async function persistVnmDraft(document: VnmDocument, actionId: string, emitEdit: boolean) {
  const { data, error } = await db.rpc('save_vnm_draft', { p_document: document, p_action_id: actionId, p_emit_edit: emitEdit })
  if (error) throw error
  return getVnmDocument(Number(data))
}

export async function saveVnmDraft(document: VnmDocument, actionId: string) {
  return persistVnmDraft(document, actionId, true)
}

export async function postVnmDocument(document: VnmDocument, actionId: string) {
  const { data, error } = await db.rpc('save_and_post_vnm_document', { p_document: document, p_action_id: actionId })
  if (error) throw error
  return getVnmDocument(Number(data))
}

export async function voidVnmDocument(documentId: number, actionId: string) {
  const { error } = await db.rpc('void_vnm_document', { p_document_id: documentId, p_action_id: actionId })
  if (error) throw error
  return getVnmDocument(documentId)
}

export async function saveVnmSettings(settings: VnmSetting) {
  const { error } = await db.rpc('save_vnm_settings', {
    p_fms_type: settings.fms_type,
    p_medication_group_id: settings.medication_group_id,
    p_auto_batch_selection: settings.auto_batch_selection,
    p_allow_historical_cycle_selection: settings.allow_historical_cycle_selection,
  })
  if (error) throw error
}

export async function saveVnmMasterValue(master: 'route' | 'indication', name: string) {
  const { error } = await db.rpc('save_vnm_master_value', { p_master: master, p_name: name })
  if (error) throw error
}

export async function voidVnmMasterValue(master: 'route' | 'indication', id: number) {
  const { error } = await db.rpc('void_vnm_master_value', { p_master: master, p_id: id })
  if (error) throw error
}
