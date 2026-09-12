import { fetchWithInternetErrorNotice, readJsonResponse } from '@/lib/network/http'
import { db } from "@/lib/Supabase/supabaseClient"
import type { PersonalInformation } from "@/lib/auth/personalInformation"

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

}

export type RegistrationStatus = {
  approvalStatus: "pending" | "activated" | "rejected"
  profileComplete: boolean
  registrationReady: boolean
  profile: import("@/lib/auth/personalInformation").PersonalInformation
}

export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  const { data, error } = await db.auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error("Please log in again.")
  const response = await fetchWithInternetErrorNotice("/api/auth/registration-profile", {
    headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store",
  })
  const result = await readJsonResponse<RegistrationStatus & { error?: string }>(response)
  if (!response.ok) throw new Error(result.error || "Unable to check your account.")
  return result
}

export async function savePersonalInformation(personal: PersonalInformation) {
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
