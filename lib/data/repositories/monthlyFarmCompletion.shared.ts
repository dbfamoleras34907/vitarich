export const MONTHLY_FARM_COMPLETION_FMS_TYPES = ['Hatchery'] as const
export type MonthlyFarmCompletionFmsType = typeof MONTHLY_FARM_COMPLETION_FMS_TYPES[number]

export const MONTHLY_FARM_COMPLETION_RULES = ['any_dispatch', 'all_grading_batches'] as const
export type MonthlyFarmCompletionRule = typeof MONTHLY_FARM_COMPLETION_RULES[number]

export const MONTHLY_FARM_COMPLETION_MODULES = [
  { value: 'receiving', label: 'Receiving' },
  { value: 'egg_classification', label: 'Egg Classification' },
  { value: 'egg_storage', label: 'Egg Storage' },
  { value: 'egg_pre_warming', label: 'Egg Pre-Warming' },
  { value: 'egg_setter', label: 'Egg Setter' },
  { value: 'egg_transfer', label: 'Egg Transfer' },
  { value: 'egg_hatcher', label: 'Egg Hatcher' },
  { value: 'chick_pullout', label: 'Chick Pullout' },
  { value: 'doc_classification', label: 'DOC Classification' },
  { value: 'doc_dispatch', label: 'DOC Dispatch' },
] as const
export type MonthlyFarmCompletionModule = typeof MONTHLY_FARM_COMPLETION_MODULES[number]['value']

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export type MonthlyFarmCompletionCatalogFarm = {
  id: number
  code: string
  name: string
  island: string
  region: string
}

export type MonthlyFarmCompletionCatalogUser = {
  id: number
  name: string
  userType: number
  userTypeLabel: string
  farmIds: number[]
}

export type MonthlyFarmCompletionCell = {
  month: number
  completedCount: number
  totalCount: number
  percentage: number | null
  future: boolean
}

export type MonthlyFarmCompletionRow = MonthlyFarmCompletionCatalogFarm & {
  months: MonthlyFarmCompletionCell[]
}

export type MonthlyFarmCompletionReport = {
  apiVersion: number
  filters: {
    fmsType: MonthlyFarmCompletionFmsType
    year: number
    completionModule: MonthlyFarmCompletionModule
    completionRule: MonthlyFarmCompletionRule
    island: string | null
    region: string | null
    farmIds: number[]
    userIds: number[]
  }
  catalog: {
    availableYears: number[]
    fmsTypes: MonthlyFarmCompletionFmsType[]
    farms: MonthlyFarmCompletionCatalogFarm[]
    users: MonthlyFarmCompletionCatalogUser[]
  }
  rows: MonthlyFarmCompletionRow[]
  generatedAt: string
}

export type MonthlyFarmCompletionParams = {
  fmsType: MonthlyFarmCompletionFmsType
  year: number
  completionModule: MonthlyFarmCompletionModule
  completionRule: MonthlyFarmCompletionRule
  island?: string
  region?: string
  farmIds?: number[]
  userIds?: number[]
}

export function isMonthlyFarmCompletionFmsType(value: unknown): value is MonthlyFarmCompletionFmsType {
  return typeof value === 'string' && MONTHLY_FARM_COMPLETION_FMS_TYPES.includes(value as MonthlyFarmCompletionFmsType)
}

export function isMonthlyFarmCompletionRule(value: unknown): value is MonthlyFarmCompletionRule {
  return typeof value === 'string' && MONTHLY_FARM_COMPLETION_RULES.includes(value as MonthlyFarmCompletionRule)
}

export function isMonthlyFarmCompletionModule(value: unknown): value is MonthlyFarmCompletionModule {
  return typeof value === 'string' && MONTHLY_FARM_COMPLETION_MODULES.some(module => module.value === value)
}

export function monthlyFarmCompletionModuleLabel(value: MonthlyFarmCompletionModule) {
  return MONTHLY_FARM_COMPLETION_MODULES.find(module => module.value === value)?.label ?? value
}
