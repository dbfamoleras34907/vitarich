import { admin_db } from "@/lib/Supabase/supabaseAdmin"
import { activeApprovedFarmsQuery } from "@/lib/data/repositories/farms"
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

async function resolveDestinationFarm(destinationFarmCode: string) {
  const farmCode = String(destinationFarmCode ?? "").trim()
  if (!farmCode) {
    throw new Error("A valid destination farm code is required.")
  }

  const { data, error } = await activeApprovedFarmsQuery(
    admin_db.from("farms").select("id, code, name, address, farm_type"),
  )
    .eq("code", farmCode)
    .eq("farm_type", "BR")
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("The destination must be an active, approved Broiler farm.")
  return data
}

function headerPayload(payload: DispatchDocUpsertPayload, farm: { id: number; code: string; name: string; address: string | null }) {
  const { items: _items, farm_name: _farmName, address: _address, ...header } = payload
  void _items
  void _farmName
  void _address

  return {
    ...header,
    destination_farm_id: farm.id,
    destination_farm_code: farm.code,
    farm_name: farm.name,
    address: farm.address,
  }
}

async function insertLines(dispatchId: number, items: DispatchDocUpsertPayload["items"], userId: string) {
  if (!items.length) throw new Error("At least one DOC Dispatch item is required.")

  const { error } = await admin_db
    .from("dispatch_doc_item")
    .insert(items.map(item => ({
      dispatch_doc_id: dispatchId,
      created_by: userId,
      ...item,
    })))

  if (error) throw error
}

export async function createHatcheryDocDispatchDraft(payload: DispatchDocUpsertPayload, userId: string) {
  const farm = await resolveDestinationFarm(payload.destination_farm_code)
  const { data, error } = await admin_db
    .from("dispatch_doc")
    .insert({
      ...headerPayload(payload, farm),
      status: "Draft",
      is_active: true,
      created_by: userId,
    })
    .select("id")
    .single()

  if (error) throw error

  try {
    await insertLines(Number(data.id), payload.items, userId)
  } catch (error) {
    await admin_db.from("dispatch_doc").delete().eq("id", data.id).eq("status", "Draft")
    throw error
  }

  return Number(data.id)
}

export async function updateHatcheryDocDispatchDraft(id: number, payload: DispatchDocUpsertPayload, userId: string) {
  const farm = await resolveDestinationFarm(payload.destination_farm_code)
  const { data, error } = await admin_db
    .from("dispatch_doc")
    .update({
      ...headerPayload(payload, farm),
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", id)
    .eq("status", "Draft")
    .eq("is_active", true)
    .select("id")
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("Only an active draft DOC Dispatch can be updated.")

  const { error: deleteError } = await admin_db
    .from("dispatch_doc_item")
    .delete()
    .eq("dispatch_doc_id", id)

  if (deleteError) throw deleteError
  await insertLines(id, payload.items, userId)
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
