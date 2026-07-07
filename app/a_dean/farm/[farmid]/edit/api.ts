import { db } from "@/lib/Supabase/supabaseClient"

export type FarmFormData = Record<string, string>

export type FarmChildRow = {
  id?: number | string
  data: FarmFormData
}

export type FarmBuildingPayload = FarmChildRow & {
  pens: FarmChildRow[]
}

export type AssociatedWarehousePayload = {
  id: number | null
  whse_code: string
  whse_name: string | null
  is_default_feed?: boolean
}

export type FarmFullPayload = {
  farm: FarmFormData & {
    associated_warehouses?: AssociatedWarehousePayload[] | string[] | null
  }
  address: FarmFormData
  buildings: FarmBuildingPayload[]
  machines: FarmChildRow[]
  associated_warehouses?: AssociatedWarehousePayload[]
}

export async function getFarmFull(id: number) {

  const { data, error } = await db.rpc(
    "get_farm_full",
    { p_farm_id: id }
  )

  if (error) throw error

  return data
}



export async function updateFarmFull(id: number, payload: FarmFullPayload) {
  const rpcPayload = {
    ...payload,
    associated_warehouses: payload.associated_warehouses ?? [],
  }

  const { data, error } = await db.rpc(
    "update_farm_full",
    {
      p_farm_id: id,
      payload: rpcPayload
    }
  )

  if (error) {
    console.error("update_farm_full error:", error)
    throw new Error(error.message)
  }

  return data
}



export async function getLastCode(viewName: string): Promise<number> {
  try {
    const { data, error } = await db
      .from(viewName)
      .select("last_number")
      .single()

    console.log({ data, error })

    if (error) throw error

    return data?.last_number ?? 0
  } catch (error) {
    console.log(`Error fetching last code from ${viewName}:`, error)
    throw error
  }
}



export function formatCode(
  prefix: string,
  num: number,
  pad: number = 6
) {
  return `${prefix}${num.toString().padStart(pad, "0")}`
}



export async function generateNextCode(
  viewName: string,
  prefix: string,
  pad: number = 6
) {

  const last = await getLastCode(viewName)

  return formatCode(prefix, last + 1, pad)

}
