import { admin_db } from "@/lib/Supabase/supabaseAdmin"
import type { DispatchDocUpsertPayload } from "@/app/jmb/docdispatchv2/newv2/api"

type DispatchAction = "insert" | "edit"

export async function requireHatcheryDocDispatchAccess(authId: string, action: DispatchAction) {
  const { data: profile, error: profileError } = await admin_db
    .from("users")
    .select("user_type, fms_type, isactive")
    .eq("auth_id", authId)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile || String(profile.isactive ?? "").trim() !== "1") throw new Error("FORBIDDEN")
  if (Number(profile.user_type ?? 3) === 1) return
  if (String(profile.fms_type ?? "").trim().toLowerCase() !== "hatchery") throw new Error("FORBIDDEN")

  const { data: permission, error: permissionError } = await admin_db
    .from("user_permissions")
    .select("is_visible")
    .eq("user_id", authId)
    .eq("group_name", "Hatchery Masters")
    .eq("title", `DOC Dispatch/${action}`)
    .eq("is_visible", true)
    .maybeSingle()

  if (permissionError) throw permissionError
  if (!permission?.is_visible) throw new Error("FORBIDDEN")
}

export async function createHatcheryDocDispatchDraft(payload: DispatchDocUpsertPayload, userId: string) {
  const { data, error } = await admin_db.rpc("save_hatchery_dispatch_transaction", { p_id: null, p_payload: payload, p_actor: userId })
  if (error) throw error
  return Number(data)
}

export async function updateHatcheryDocDispatchDraft(id: number, payload: DispatchDocUpsertPayload, userId: string) {
  const { error } = await admin_db.rpc("save_hatchery_dispatch_transaction", { p_id: id, p_payload: payload, p_actor: userId })
  if (error) throw error
}

export async function postHatcheryDocDispatch(id: number, userId: string) {
  const { data, error } = await admin_db
    .from("dispatch_doc")
    .update({ status: "Posted", posted_by: userId, updated_by: userId })
    .eq("id", id)
    .eq("status", "Draft")
    .eq("is_active", true)
    .select("id, status, posting_version")
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("Only an active draft DOC Dispatch can be posted.")
  return data
}

export async function deleteHatcheryDocDispatchDraft(id: number, userId: string) {
  const { data, error } = await admin_db
    .from("dispatch_doc")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", id)
    .eq("status", "Draft")
    .select("id")
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("Only a draft DOC Dispatch can be removed.")
}
