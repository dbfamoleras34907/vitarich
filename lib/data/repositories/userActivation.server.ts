import "server-only"
import { admin_db } from "@/lib/Supabase/supabaseAdmin"
import { USER_TYPE, canManageUser, type ManagedUserProfile } from "@/lib/auth/adminAccess"
import { RegistrationError } from "./registration.server"

export async function listPendingActivations(actor: ManagedUserProfile) {
  const { data, error } = await admin_db.from("users")
    .select("id, auth_id, email, firstname, middlename, lastname, created_at, isactive, docStatus, approval_status, fms_type, user_type, issuper")
    .eq("approval_status", "pending").order("created_at", { ascending: false })
  if (error) {
    if ((error.code === "42703" || error.code === "PGRST204") && error.message.includes("approval_status")) {
      throw new RegistrationError("User Activation requires the registration database update. Apply app/signup_update/registration_profile.sql before reviewing registrations.", 503)
    }
    throw error
  }
  return (data ?? []).filter(user => canManageUser(actor, { ...user, user_type: Number(user.user_type ?? USER_TYPE.USER) }))
}

export async function decideRegistration(actor: ManagedUserProfile, input: { userId?: unknown; decision?: unknown; reason?: unknown }) {
  const userId = Number(input.userId)
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new RegistrationError("Invalid user id.")
  if (input.decision !== "activate" && input.decision !== "reject") throw new RegistrationError("Choose Activate or Reject.")
  const reason = typeof input.reason === "string" ? input.reason.trim() : ""
  if (input.decision === "reject" && (!reason || reason.length > 1000)) throw new RegistrationError("Enter a rejection reason (up to 1,000 characters).")
  const { data, error } = await admin_db.rpc("decide_registration", {
    p_actor_auth_id: actor.auth_id, p_user_id: userId, p_decision: input.decision, p_reason: reason,
  })
  if (error) throw new RegistrationError(error.message, error.code === "42501" ? 403 : 400)
  return data as { auth_id: string; approval_status: "activated" | "rejected" }
}
