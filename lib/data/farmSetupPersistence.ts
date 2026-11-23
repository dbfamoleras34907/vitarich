export type FarmSetupAddressFields = {
  address: string
  barangay: string
  city: string
  province: string
}

type FarmSetupAddressSource = {
  farm?: Record<string, unknown> | null
  address?: Record<string, unknown> | null
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

export function normalizeFarmSetupAddress(source: FarmSetupAddressSource): FarmSetupAddressFields {
  const farm = source.farm ?? {}
  const structuredAddress = source.address ?? {}

  return {
    address: text(structuredAddress.address) || text(farm.address),
    barangay: text(structuredAddress.barangay) || text(farm.barangay),
    city: text(structuredAddress.city) || text(farm.city),
    province: text(structuredAddress.province) || text(farm.region),
  }
}
