import { db } from "@/lib/Supabase/supabaseClient"

export const getTimesheetById = async (id: number) => {

  const { data: header, error: hErr } =
    await db
      .from("vw_timesheets")
      .select("*")
      .eq("id", id)
      .single()

  if (hErr) throw hErr

  const { data: lines, error: lErr } =
    await db
      .from("vw_timesheet_lines")
      .select("*")
      .eq("docentry", id)

  if (lErr) throw lErr

  return {
    header,
    lines
  }
}