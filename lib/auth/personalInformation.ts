export const PERSONAL_INFORMATION_FIELDS = [
  { key: "firstname", label: "First Name", required: true, type: "text", section: "Identity" },
  { key: "middlename", label: "Middle Name", required: false, type: "text", section: "Identity" },
  { key: "lastname", label: "Last Name", required: true, type: "text", section: "Identity" },
  { key: "birthdate", label: "Birthdate", required: true, type: "date", section: "Identity" },
  { key: "gender", label: "Gender", required: false, type: "list", section: "Identity" },
  { key: "mobile", label: "Mobile", required: false, type: "text", section: "Contact" },
  { key: "phone", label: "Phone", required: false, type: "text", section: "Contact" },
  { key: "location", label: "Address", required: true, type: "text", section: "Contact" },
  { key: "region", label: "Region", required: true, type: "list", section: "Contact" },
  { key: "archipelago", label: "Island Group", required: true, type: "list", section: "Contact" },
] as const

export type PersonalInformation = Partial<Record<typeof PERSONAL_INFORMATION_FIELDS[number]["key"], string | null>>

export const REGISTRATION_FMS_TYPES = [
  { code: "Broiler", name: "Broiler" },
  { code: "Breeder", name: "Breeder" },
  { code: "Hatchery", name: "Hatchery" },
]

export type RegistrationProfile = PersonalInformation & { fms_type?: string | null; farm_id?: number | null }

export type RegistrationFarmOption = { id: number; code: string; name: string }

export function validateRegistrationProfile(input: RegistrationProfile) {
  if (!REGISTRATION_FMS_TYPES.some((option) => option.code === input.fms_type)) {
    return "FMS Type is required. Choose Broiler, Breeder, or Hatchery."
  }
  if (typeof input.farm_id !== "number" || !Number.isSafeInteger(input.farm_id) || input.farm_id <= 0) {
    return "Farm is required. Choose a farm."
  }
  return validatePersonalInformation(input)
}

export function validatePersonalInformation(input: PersonalInformation) {
  for (const field of PERSONAL_INFORMATION_FIELDS) {
    const value = input[field.key]
    if (value != null && typeof value !== "string") return `${field.label} must be text.`
    if (field.required && !value?.trim()) return `${field.label} is required.`
    if (value && value.length > 1000) return `${field.label} is too long.`
  }
  const birthdate = input.birthdate?.trim() ?? ""
  const date = new Date(`${birthdate}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== birthdate) {
    return "Birthdate must be a valid date."
  }
  return null
}
