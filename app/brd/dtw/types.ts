export type BroilerDtwMode = 'standard' | 'legacy'

export type BroilerDtwFarm = {
  id: number
  code: string
  name: string
}

export type BroilerDtwBuilding = {
  id: number
  farmId: number
  farmCode: string
  code: string
  name: string
}

export type BroilerDtwCycle = {
  id: number
  farmId: number
  farmCode: string
  cycleKey: string
  status: string
}

export type BroilerDtwReferences = {
  farms: BroilerDtwFarm[]
  buildings: BroilerDtwBuilding[]
  cycles: BroilerDtwCycle[]
}

export type BroilerDtwRow = Record<string, string | number | null>

export type BroilerDtwWorkbookPayload = {
  mode: BroilerDtwMode
  fileName: string
  placement: BroilerDtwRow[]
  growing: BroilerDtwRow[]
  harvest: BroilerDtwRow[]
  cleanup: BroilerDtwRow[]
  warnings: string[]
}

export type BroilerDtwValidation = {
  payload: BroilerDtwWorkbookPayload
  errors: string[]
  warnings: string[]
}

export type BroilerDtwImportResult = {
  jobId: string
  status: string
  cycleCount: number
  placementCount: number
  growingCount: number
  harvestCount: number
  cleanupCount: number
  warnings: string[]
}

export type BroilerDtwImportJob = {
  id: string
  mode: BroilerDtwMode
  fileName: string
  status: string
  cycleCount: number
  placementCount: number
  growingCount: number
  harvestCount: number
  cleanupCount: number
  createdAt: string
}
