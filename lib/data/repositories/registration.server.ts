import { admin_db } from "@/lib/Supabase/supabaseAdmin"
import { isServiceUnavailableError } from "@/lib/networkError"
import { PERSONAL_INFORMATION_FIELDS, validatePersonalInformation, type PersonalInformation } from "@/lib/auth/personalInformation"

export class RegistrationError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export async function createRegistrationAccount(input: { email?: unknown; password?: unknown }, creator?: { authId: string; fmsType: string | null }) {
  const email = typeof input.email === "string" ? input.email.trim() : ""
  const password = typeof input.password === "string" ? input.password : ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RegistrationError("Please enter a valid email.")
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new RegistrationError("Password must be at least 8 characters and include uppercase, lowercase, and a number.")
  }
  // Fail before creating Auth accounts if the transactional registration trigger is missing.
  const { error: readinessError } = await admin_db.rpc("registration_approval_ready")
  if (readinessError) throw new RegistrationError("Account registration is temporarily unavailable. Please contact your administrator.", 503)
  // The Auth trigger creates the pending profile and registration event in this transaction.
  const { data, error } = await admin_db.auth.admin.createUser({
    email, password, email_confirm: true, ban_duration: "876000h",
    app_metadata: { registration_flow: "approval_first", ...(creator ? { registration_created_by: creator.authId, registration_fms_type: creator.fmsType } : {}) },
  })
  if (error) throw new RegistrationError(error.message)
  if (!data.user) throw new RegistrationError("Unable to register your account.")
  return data.user
}

export async function requireRegistrationUser(token: string) {
  if (!token) throw new RegistrationError("Authentication required.", 401)
  const { data, error } = await admin_db.auth.getUser(token)
  if (error && (isServiceUnavailableError(error) || !error.status)) {
    throw new RegistrationError("The authentication service is temporarily unavailable. Please try again.", 503)
  }
  if (error || !data.user) throw new RegistrationError("Your session has expired. Please log in again.", 401)
  return data.user
}

export async function getAccountAccessByAuthId(authId: string) {
  let { data, error } = await admin_db.from("users")
    .select("approval_status, isactive, firstname, middlename, lastname, birthdate, gender, mobile, phone, location, region, archipelago")
    .eq("auth_id", authId).maybeSingle()
  let registrationReady = true
  // Staged deployment: only the missing new column permits the legacy read.
  // Auth/network/RLS errors must never turn into an access bypass.
  if (error?.code === "42703" && error.message.includes("approval_status")) {
    const legacy = await admin_db.from("users")
      .select("isactive, firstname, middlename, lastname, birthdate, gender, mobile, phone, location, region, archipelago")
      .eq("auth_id", authId).maybeSingle()
    data = legacy.data ? { ...legacy.data, approval_status: null } : null
    error = legacy.error
    registrationReady = false
  }
  if (error) throw new RegistrationError("Unable to check your account. Please try again.", 503)
  const profile: PersonalInformation = {}
  for (const field of PERSONAL_INFORMATION_FIELDS) profile[field.key] = data?.[field.key] ?? null
  // PostgreSQL stores birthdate as a timestamp; the form and validator use a date.
  if (profile.birthdate) profile.birthdate = profile.birthdate.slice(0, 10)
  const approvalStatus: "pending" | "activated" | "rejected" = data?.approval_status === "rejected"
    ? "rejected" : String(data?.isactive) === "1" && data?.approval_status !== "pending" ? "activated" : "pending"
  return { approvalStatus, profileComplete: !validatePersonalInformation(profile), profile, registrationReady }
}

export async function saveRegistrationProfile(token: string, input: PersonalInformation) {
  const user = await requireRegistrationUser(token)
  const validationError = validatePersonalInformation(input)
  if (validationError) throw new RegistrationError(validationError)

  // Access, farm assignments and approval remain administrator-owned.
  const personal: PersonalInformation = {}
  for (const field of PERSONAL_INFORMATION_FIELDS) personal[field.key] = input[field.key]?.trim() || null
  const { error } = await admin_db.rpc("complete_registration_profile", {
    p_auth_id: user.id,
    p_profile: personal,
  })
  if (error?.code === "PGRST202") {
    throw new RegistrationError("Registration database update is required. Please ask your administrator to apply registration_profile.sql.", 503)
  }
  if (error) throw new RegistrationError(error.message)
}
