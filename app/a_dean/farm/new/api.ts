import { db } from '@/lib/Supabase/supabaseClient'

export type FarmFormData = Record<string, string>

export type FarmChildRow = {
  data: FarmFormData
}

export type FarmBuildingPayload = FarmChildRow & {
  pens: FarmChildRow[]
}

export type AssociatedWarehousePayload = {
  id: number | null
  whse_code: string
  whse_name: string | null
}

export type FarmFullPayload = {
  farm: FarmFormData
  address: FarmFormData
  buildings: FarmBuildingPayload[]
  machines: FarmChildRow[]
  associated_warehouses: AssociatedWarehousePayload[]
}

export async function addFarmFull(payload: FarmFullPayload): Promise<number> {
  const { data, error } = await db.rpc(
    "insert_farm_full",
    { payload }
  )

  if (error) {
    console.error("insert_farm_full error:", error)
    throw new Error(error.message)
  }

  return Number(data)
}


export function formatCode(
  prefix: string,
  number: number,
  pad: number = 6
) {
  return `${prefix}${number.toString().padStart(pad, "0")}`
}

export async function getLastCode(viewName: string): Promise<number> {
  const { data, error } = await db
    .from(viewName)
    .select("last_number")
    .single()
  console.log({ data, error })
  if (error) throw error

  return data?.last_number ?? 0
}

export async function generateNextCode(
  viewName: string,
  prefix: string,
  pad: number = 6
) {
  const last = await getLastCode(viewName)
  console.log({ last })
  return formatCode(prefix, last + 1, pad)
}
