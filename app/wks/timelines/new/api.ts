import { db } from "@/lib/Supabase/supabaseClient"

export const saveTimesheet = async (payload: any) => {

  const { data, error } = await db.rpc(
    "rpc_upsert_timesheet_full",
    { payload }
  )

  if (error) throw error

  return data
}