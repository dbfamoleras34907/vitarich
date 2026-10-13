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

export const BROILER_DTW_SOURCE_ROW: unique symbol = Symbol('broilerDtwSourceRow')

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
  modifications: string[]
}

export type BroilerDtwProgress = {
  phase: 'reading' | 'processing' | 'finalizing' | 'reporting' | 'staging' | 'importing'
  message: string
  module?: string
  worksheetRow?: number
  processedRows?: number
  totalRows?: number
  percent?: number
}

export type BroilerDtwImportProgress = (progress: BroilerDtwProgress) => void

export type BroilerDtwImportResult = {
  jobId: string
  status: string
  cycleCount: number
  placementCount: number
  growingCount: number
  harvestCount: number
  cleanupCount: number
  voidedCount?: number
  warnings: string[]
  error?: {
    code?: string
    message?: string
  }
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

export type BroilerDtwImportStage = 'DOC Placement' | 'Growing' | 'Harvest Delivery' | 'Clean Up'

export type BroilerDtwImportedRow = {
  id: number
  stage: BroilerDtwImportStage
  rowNo: number
  farmId: number
  buildingId: number
  farmCycleId: number
  entityId: number | null
  rawData: Record<string, unknown>
  warnings: string[]
  createdAt: string
}

export type BroilerDtwImportedRowPage = {
  rows: BroilerDtwImportedRow[]
  total: number
}
