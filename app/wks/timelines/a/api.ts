import { getUserInfoAuthSession } from "@/app/admin/user/api";
import { getSessionUser } from "@/lib/Defaults/GlobalDefaults";
import { db } from "@/lib/Supabase/supabaseClient"
import { toast } from "sonner";

export const getTimesheets = async () => {
  try {

    const user = await getUserInfoAuthSession();
    const { data, error } = await db
      .from("vw_timesheets_report")
      .select("*")
      .eq("assigned_to", user[0].id)
      // .order("doc_date")

    console.log({ data, error }, user[0].id)
    if (error) throw error
    return data ?? []
  } catch (error) {
    toast("An error has occurred while fetching the data")
  }

  return []


}