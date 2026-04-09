import { db } from "@/lib/Supabase/supabaseClient"



export async function getFarmFull(id: number) {

  const { data, error } = await db.rpc(
    "get_farm_full",
    { p_farm_id: id }
  )

  if (error) throw error

  return data
}



export async function updateFarmFull(id: number, payload: any) {
  
  const { data, error } = await db.rpc(
    "update_farm_full",
    {
      p_farm_id: id,
      payload
    }
  )

  if (error) throw error

  return data
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