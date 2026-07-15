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
  client_key: string
  is_default_feed?: boolean
  is_default_receiving?: boolean
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
