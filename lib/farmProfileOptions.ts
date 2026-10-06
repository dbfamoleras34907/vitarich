export const FARM_PRODUCTION_MODELS = ['Internal', 'Contract Grower'] as const

export const FARM_ISLANDS = ['Luzon', 'Visayas', 'Mindanao'] as const

// PSA Philippine Standard Geographic Code: https://psa.gov.ph/classification/psgc/regions
// Keep separate from farms.region, which historically stores the province.
export const PHILIPPINE_REGIONS = [
  'National Capital Region (NCR)',
  'Cordillera Administrative Region (CAR)',
  'Region I (Ilocos Region)',
  'Region II (Cagayan Valley)',
  'Region III (Central Luzon)',
  'Region IV-A (CALABARZON)',
  'MIMAROPA Region',
  'Region V (Bicol Region)',
  'Region VI (Western Visayas)',
  'Negros Island Region (NIR)',
  'Region VII (Central Visayas)',
  'Region VIII (Eastern Visayas)',
  'Region IX (Zamboanga Peninsula)',
  'Region X (Northern Mindanao)',
  'Region XI (Davao Region)',
  'Region XII (SOCCSKSARGEN)',
  'Region XIII (Caraga)',
  'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)',
] as const

export type FarmIslandGroup = typeof FARM_ISLANDS[number]
export type PhilippineRegion = typeof PHILIPPINE_REGIONS[number]

// PSA major island group classification. NIR was restored in 2024 and is
// grouped with the Visayas. Keep this as the single region cascade source.
export const PHILIPPINE_REGIONS_BY_ISLAND: Record<FarmIslandGroup, readonly PhilippineRegion[]> = {
  Luzon: PHILIPPINE_REGIONS.slice(0, 8),
  Visayas: PHILIPPINE_REGIONS.slice(8, 12),
  Mindanao: PHILIPPINE_REGIONS.slice(12),
}

export const FARM_PROFILE_FIELDS = [
  { code: 'production_model', label: 'Production Model', options: FARM_PRODUCTION_MODELS, required: true },
  { code: 'island', label: 'Island Group', options: FARM_ISLANDS, required: true },
  { code: 'administrative_region', label: 'Region', options: PHILIPPINE_REGIONS, required: true },
] as const

/** User master stores region codes; Farm master stores full administrative names. */
export function normalizeAdministrativeRegion(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const codes = ['NCR', 'CAR', '01', '02', '03', '04A', '04B', '05', '06', 'NIR', '07', '08', '09', '10', '11', '12', '13', 'BARMM']
  const codeIndex = codes.indexOf(text.toUpperCase())
  if (codeIndex >= 0) return PHILIPPINE_REGIONS[codeIndex]
  const normalized = text.toLowerCase()
  return PHILIPPINE_REGIONS.find(region => region.toLowerCase() === normalized
    || region.toLowerCase().includes(`(${normalized})`)
    || region.toLowerCase().replace(/\s*\([^)]*\)$/, '') === normalized) || text
}

export function normalizeFarmIsland(value: string | null | undefined): FarmIslandGroup | '' {
  const normalized = String(value ?? '').trim().toLowerCase()
  return FARM_ISLANDS.find(island => island.toLowerCase() === normalized) ?? ''
}

export function islandGroupForRegion(value: string | null | undefined): FarmIslandGroup | '' {
  const region = normalizeAdministrativeRegion(value)
  return FARM_ISLANDS.find(island => PHILIPPINE_REGIONS_BY_ISLAND[island].some(item => item === region)) ?? ''
}
