import { getUserInfoAuthSession } from "@/app/admin/user/api";
import { getWorkspaceTimesheetReportForUser } from "@/lib/data/repositories/workspace";
import { toast } from "sonner";

export const getTimesheets = async () => {
  try {

    const user = await getUserInfoAuthSession();
    return await getWorkspaceTimesheetReportForUser(user[0].id)
  } catch {
    toast.error("An error has occurred while fetching the data")
  }

  return []


}
