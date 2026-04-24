import { db } from "@/lib/Supabase/supabaseClient"

export const getTimesheets = async () => {
  const { data, error } = await db
    .from("vw_timesheets")
    .select("*")
    .order("doc_date", { ascending: false })

  if (error) throw error

  return data ?? []
}