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

export async function createFarmSetup(payload: FarmSetupPayload): Promise<number> {
  const { data, error } = await db.rpc('insert_farm_setup_wizard', { payload })

  if (error) {
    console.error('insert_farm_setup_wizard error:', error)
    throw new Error(error.message)
  }

  return Number(data)
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
