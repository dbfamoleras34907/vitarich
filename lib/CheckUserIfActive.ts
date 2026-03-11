import { getProfileByAuthId } from "@/app/admin/user/api";
import { redirect } from "next/navigation";
import { toast } from "sonner";

export async function checkUserActive(authId: string) {
  console.log("checkUserActive active check");

  const user = await getProfileByAuthId(authId);

  if (!user) {
    redirect("/logout");
  }

  if (user.isactive === "0") {
    toast("Your account has not been activated yet. Please contact your manager for assistance")
    redirect("/logout");
  }

  if (user.isactive === "1") {
    redirect("/home");
  }
}