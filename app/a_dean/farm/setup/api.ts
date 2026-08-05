import { db } from '@/lib/Supabase/supabaseClient'
import type { WarehouseData } from '@/lib/types'

export type FarmSetupFormData = Record<string, string>

export type FarmSetupWarehouseDraft = Pick<
  WarehouseData,
  | 'whse_name'
  | 'fms_type'
  | 'warehouse_type'
  | 'full_location_code'
  | 'addr1'
  | 'addr2'
  | 'city'
  | 'province'
  | 'address'
  | 'phone'
  | 'mobile'
  | 'remarks'
  | 'is_active'
> & {
  id?: number | null
  whse_code?: string | null
  client_key: string
  father_client_key?: string | null
  capacity?: number | null
  is_default_feed?: boolean
  is_default_receiving?: boolean
  is_default_disposal?: boolean
}

export type FarmSetupRecord = {
  farm: FarmSetupFormData
  address: FarmSetupFormData
  warehouses: FarmSetupWarehouseDraft[]
}

export type FarmSetupPayload = {
  farm: FarmSetupFormData
  address: FarmSetupFormData
  warehouses: FarmSetupWarehouseDraft[]
  machines: {
    data: FarmSetupFormData
  }[]
}

export type FarmSetupApprovalResult = {
  success?: boolean
  required?: boolean
  request_id?: number
  template_id?: number
  trigger_id?: number
  approver_id?: number
  message?: string
}

export type FarmSetupResult = {
  farmId: number | null
  approval: FarmSetupApprovalResult
}

async function insertFarmSetup(payload: FarmSetupPayload): Promise<number> {
  const { data, error } = await db.rpc('insert_farm_setup_wizard', { payload })

  if (error) {
    console.error('insert_farm_setup_wizard error:', error)
    throw new Error(error.message)
  }

  return Number(data)
}

export async function createFarmSetup(payload: FarmSetupPayload): Promise<FarmSetupResult> {
  const { data: approvalCheckData, error: approvalCheckError } = await db.rpc('check_approval_required', {
    p_document_type: 'farm_setup_wizard',
    p_payload: payload,
  })

  if (approvalCheckError) {
    console.error('check_approval_required error:', approvalCheckError)
    throw new Error(approvalCheckError.message)
  }

  const approvalCheck = (approvalCheckData ?? { required: false }) as FarmSetupApprovalResult
  const approvalRequired = Boolean(approvalCheck.required)
  const payloadWithApprovalStatus: FarmSetupPayload = {
    ...payload,
    farm: {
      ...payload.farm,
      approval_status: approvalRequired ? 'pending' : 'approved',
    },
  }
  const farmId = await insertFarmSetup(payloadWithApprovalStatus)

  if (!approvalRequired) {
    return {
      farmId,
      approval: approvalCheck,
    }
  }

  const { data: approvalData, error: approvalError } = await db.rpc('submit_for_approval', {
    p_document_type: 'farm_setup_wizard',
    p_document_id: farmId,
    p_document_no: payload.farm.code || payload.farm.name || null,
    p_payload: payloadWithApprovalStatus,
    p_remarks: 'Farm setup submitted for approval.',
  })

  if (approvalError) {
    console.error('submit_for_approval error:', approvalError)
    throw new Error(approvalError.message)
  }

  const approval = (approvalData ?? { required: false }) as FarmSetupApprovalResult

  if (approval.required) {
    if (approval.request_id) {
      const { error: updateError } = await db
        .from('farms')
        .update({ approval_request_id: approval.request_id })
        .eq('id', farmId)

      if (updateError) throw new Error(updateError.message)
    }

    return {
      farmId,
      approval,
    }
  }

  const { error: approveFallbackError } = await db
    .from('farms')
    .update({ approval_status: 'approved' })
    .eq('id', farmId)

  if (approveFallbackError) throw new Error(approveFallbackError.message)

  return {
    farmId,
    approval,
  }
}

export async function getFarmSetup(farmId: number): Promise<FarmSetupRecord> {
  const [{ data: farmData, error: farmError }, { data: warehouses, error: warehouseError }] =
    await Promise.all([
      db.rpc('get_farm_full', { p_farm_id: farmId }),
      db.from('i_warehouse').select('*').eq('farm_id', farmId).order('id'),
    ])

  if (farmError) throw new Error(farmError.message)
  if (warehouseError) throw new Error(warehouseError.message)
  if (!farmData?.farm) throw new Error('Farm not found.')

  const warehouseRows = warehouses ?? []

  return {
    farm: farmData.farm,
    address: {
      address: farmData.farm.address ?? '',
      barangay: farmData.farm.barangay ?? farmData.address?.barangay ?? '',
      city: farmData.farm.city ?? farmData.address?.city ?? '',
      province: farmData.farm.region ?? farmData.address?.province ?? '',
    },
    warehouses: warehouseRows.map((warehouse) => ({
      id: warehouse.id,
      client_key: `warehouse-${warehouse.id}`,
      father_client_key: warehouse.father_id ? `warehouse-${warehouse.father_id}` : null,
      whse_name: warehouse.whse_name,
      whse_code: warehouse.whse_code,
      fms_type: warehouse.fms_type,
      warehouse_type: warehouse.warehouse_type,
      capacity: warehouse.capacity,
      full_location_code: warehouse.full_location_code,
      addr1: warehouse.addr1,
      addr2: warehouse.addr2,
      city: warehouse.city,
      province: warehouse.province,
      address: warehouse.address,
      phone: warehouse.phone,
      mobile: warehouse.mobile,
      remarks: warehouse.remarks,
      is_active: warehouse.is_active,
      is_default_feed: warehouse.is_default_feed_warehouse,
      is_default_receiving: warehouse.is_default_receiving_warehouse,
      is_default_disposal: warehouse.is_default_disposal_warehouse,
    })),
  }
}

export async function updateFarmSetup(farmId: number, payload: FarmSetupPayload): Promise<void> {
  const { error } = await db.rpc('update_farm_setup_wizard', {
    p_farm_id: farmId,
    payload,
  })

  if (error) {
    console.error('update_farm_setup_wizard error:', error)
    throw new Error(error.message)
  }
}

export function formatCode(prefix: string, number: number, pad: number = 6) {
  return `${prefix}${number.toString().padStart(pad, '0')}`
}

export async function getLastCode(viewName: string): Promise<number> {
  const { data, error } = await db.from(viewName).select('last_number').single()

  if (error) throw error

  return data?.last_number ?? 0
}

export async function generateNextCode(viewName: string, prefix: string, pad: number = 6) {
  const last = await getLastCode(viewName)
  return formatCode(prefix, last + 1, pad)
}
