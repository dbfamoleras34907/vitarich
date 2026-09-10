import { admin_db } from "@/lib/Supabase/supabaseAdmin"
import { isServiceUnavailableError } from "@/lib/networkError"
import { PERSONAL_INFORMATION_FIELDS, validateRegistrationProfile, type PersonalInformation, type RegistrationProfile, type RegistrationFarmOption } from "@/lib/auth/personalInformation"
import { activeApprovedFarmsQuery } from "@/lib/data/repositories/farms"

export class RegistrationError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export async function createRegistrationAccount(input: { email?: unknown; password?: unknown }) {
  const email = typeof input.email === "string" ? input.email.trim() : ""
  const password = typeof input.password === "string" ? input.password : ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RegistrationError("Please enter a valid email.")
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new RegistrationError("Password must be at least 8 characters and include uppercase, lowercase, and a number.")
  }
  // Create only a new Auth account; personal information and access are separate.
  // Immediate password login is the registration flow's explicit requirement.
  const { data, error } = await admin_db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new RegistrationError(error.message)
  if (!data.user) throw new RegistrationError("Unable to register your account.")
}

async function requireRegistrationUser(token: string) {
  if (!token) throw new RegistrationError("Authentication required.", 401)
  const { data, error } = await admin_db.auth.getUser(token)
  if (error && (isServiceUnavailableError(error) || !error.status)) {
    throw new RegistrationError("The authentication service is temporarily unavailable. Please try again.", 503)
  }
  if (error || !data.user) throw new RegistrationError("Your session has expired. Please log in again.", 401)
  return data.user
}

export async function listRegistrationFarms(token: string): Promise<RegistrationFarmOption[]> {
  await requireRegistrationUser(token)
  const { data, error } = await activeApprovedFarmsQuery(
    admin_db.from("farms").select("id, code, name"),
  ).order("name", { ascending: true })
  if (error) throw new RegistrationError(error.message)
  return (data ?? []).map((farm) => ({ id: Number(farm.id), code: String(farm.code ?? ""), name: String(farm.name ?? farm.code ?? "") }))
    .filter((farm) => Number.isSafeInteger(farm.id) && farm.id > 0 && farm.code.trim())
}

export async function saveRegistrationProfile(token: string, input: RegistrationProfile) {
  const user = await requireRegistrationUser(token)
  const validationError = validateRegistrationProfile(input)
  if (validationError) throw new RegistrationError(validationError)

  // Only the initial FMS selection is allowed; identity and other access fields are server-owned.
  const personal: PersonalInformation = {}
  for (const field of PERSONAL_INFORMATION_FIELDS) personal[field.key] = input[field.key]?.trim() || null
  const { error } = await admin_db.rpc("complete_registration_profile", {
    p_auth_id: user.id,
    p_profile: { ...personal, fms_type: input.fms_type, farm_id: input.farm_id },
  })
  if (error?.code === "PGRST202") {
    throw new RegistrationError("Registration database update is required. Please ask your administrator to apply registration_profile.sql.", 503)
  }
  if (error) throw new RegistrationError(error.message)
}
