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

export const FARM_PROFILE_FIELDS = [
  { code: 'production_model', label: 'Production Model', options: FARM_PRODUCTION_MODELS },
  { code: 'island', label: 'Island Group', options: FARM_ISLANDS },
  { code: 'administrative_region', label: 'Region', options: PHILIPPINE_REGIONS },
] as const
