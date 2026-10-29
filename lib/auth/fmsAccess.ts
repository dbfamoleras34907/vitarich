export const USER_FMS_TYPES = ["Broiler", "Breeder", "Hatchery"] as const

export type UserFmsType = typeof USER_FMS_TYPES[number]

const USER_FMS_TYPE_SET = new Set<string>(USER_FMS_TYPES)

export function normalizeUserFmsTypes(value: unknown, legacyValue?: unknown): UserFmsType[] {
  const values = Array.isArray(value) ? value : []
  const fallback = values.length > 0 ? values : [legacyValue]

  return Array.from(new Set(
    fallback
      .map(item => String(item ?? "").trim())
      .filter((item): item is UserFmsType => USER_FMS_TYPE_SET.has(item)),
  ))
}

export function hasUserFmsType(value: unknown, type: UserFmsType, legacyValue?: unknown) {
  return normalizeUserFmsTypes(value, legacyValue).includes(type)
}

export function userFmsTypesOverlap(left: unknown, right: readonly string[], legacyValue?: unknown) {
  const types = normalizeUserFmsTypes(left, legacyValue)
  return types.some(type => right.includes(type))
}

export function userFmsTypesAreSubset(target: unknown, actor: unknown, targetLegacy?: unknown, actorLegacy?: unknown) {
  const actorTypes = new Set(normalizeUserFmsTypes(actor, actorLegacy))
  return normalizeUserFmsTypes(target, targetLegacy).every(type => actorTypes.has(type))
}
