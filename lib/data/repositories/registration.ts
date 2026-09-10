import { fetchWithInternetErrorNotice, readJsonResponse } from '@/lib/network/http'
import { db } from "@/lib/Supabase/supabaseClient"
import type { RegistrationProfile, RegistrationFarmOption } from "@/lib/auth/personalInformation"

type RegistrationCredentials = {
  email: string
  password: string
}

export async function registerAccount({ email, password }: RegistrationCredentials) {
  const response = await fetchWithInternetErrorNotice("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  })
  const result = await readJsonResponse<{ error?: string }>(response)
  if (!response.ok) throw new Error(result.error || "Unable to register your account.")

  const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(`Account created, but login failed: ${error.message} Please log in to finish registration.`)
  if (!data.session) throw new Error("Account created. Please log in to finish registration.")
}

export async function savePersonalInformation(personal: RegistrationProfile) {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error("Your session has expired. Please log in again.")
  const response = await fetchWithInternetErrorNotice("/api/auth/registration-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(personal),
  })
  const result = await readJsonResponse<{ error?: string }>(response)
  if (!response.ok) throw new Error(result.error || "Unable to save personal information.")
}

export async function getRegistrationFarms(): Promise<RegistrationFarmOption[]> {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error("Your session has expired. Please log in again.")
  const response = await fetchWithInternetErrorNotice("/api/auth/registration-profile", {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  })
  const result = await readJsonResponse<{ farms?: RegistrationFarmOption[]; error?: string }>(response)
  if (!response.ok) throw new Error(result.error || "Unable to load farms.")
  return result.farms ?? []
}
