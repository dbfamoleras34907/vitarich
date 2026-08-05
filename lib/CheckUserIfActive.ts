import { getProfileByAuthId } from "@/app/admin/user/api";
import { redirect } from "next/navigation";
import { toast } from "sonner";

function isActiveValue(value: unknown) {
  return value === true || value === 1 || String(value).trim() === "1";
}

export async function checkUserActive(authId: string) {
  console.log("checkUserActive active check");

  const user = await getProfileByAuthId(authId);

  if (!user) {
    toast("Your account has not been activated yet. Please contact your manager for assistance--101");

    redirect("/logout");
  }

  if (!isActiveValue(user.isactive)) {
    console.log("Inactive user, logging out");
    toast("Your account has not been activated yet. Please contact your manager for assistance--102");
    redirect("/logout");
  }

  if (!String(user.fms_type ?? "").trim()) {
    toast.warning("Your account does not have an FMS type. Please contact your administrator to update it.");
  }

  redirect("/home");
}
