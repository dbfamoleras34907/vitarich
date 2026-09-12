import { db } from "@/lib/Supabase/supabaseClient"
import { fetchWithInternetErrorNotice, readJsonResponse } from "@/lib/network/http"

export type UserActivationRow = Record<string, unknown> & {
  id: number; auth_id: string | null; email: string | null
  firstname: string | null; middlename: string | null; lastname: string | null
  created_at: string | null
}

async function activationHeaders() {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error("Please log in again.")
  return { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }
}

export async function getPendingActivations() {
  const response = await fetchWithInternetErrorNotice("/api/admin/userActivation", { headers: await activationHeaders(), cache: "no-store" })
  const result = await readJsonResponse<{ users?: UserActivationRow[]; error?: string }>(response)
  if (!response.ok) throw new Error(result.error || "Unable to load pending registrations.")
  return result.users ?? []
}

export async function submitRegistrationDecision(userId: number, decision: "activate" | "reject", reason = "") {
  const response = await fetchWithInternetErrorNotice("/api/admin/userActivation", {
    method: "POST", headers: await activationHeaders(), body: JSON.stringify({ userId, decision, reason }),
  })
  const result = await readJsonResponse<{ user?: { auth_id: string }; error?: string }>(response)
  if (!response.ok) throw new Error(result.error || "Unable to save the registration decision.")
  return result.user
}
