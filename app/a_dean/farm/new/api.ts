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
  is_default_feed?: boolean
  is_default_receiving?: boolean
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

export async function getAssignedWarehouseCodes(): Promise<string[]> {
  const { data, error } = await db
    .from('farms')
    .select('associated_warehouses')
    .eq('void', 1)

  if (error) throw error

  const assignedCodes = new Set<string>()

  for (const farm of data ?? []) {
    const associatedWarehouses = farm.associated_warehouses

    if (!Array.isArray(associatedWarehouses)) continue

    for (const warehouse of associatedWarehouses) {
      const code =
        typeof warehouse === 'string'
          ? warehouse
          : String(warehouse?.whse_code ?? '')

      if (code.trim()) assignedCodes.add(code.trim())
    }
  }

  return Array.from(assignedCodes)
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
