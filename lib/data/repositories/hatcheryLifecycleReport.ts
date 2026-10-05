import { db } from '@/lib/Supabase/supabaseClient'
import { islandGroupForRegion, normalizeAdministrativeRegion, normalizeFarmIsland } from '@/lib/farmProfileOptions'

export const HATCHERY_LIFECYCLE_STAGES = [
  'Receiving',
  'Classification',
  'Storage',
  'Pre-Warming',
  'Setter',
  'Transfer',
  'Hatcher',
  'Pullout',
  'Chick Grading',
  'Dispatch',
  'Disposal',
] as const

export type HatcheryLifecycleStage = typeof HATCHERY_LIFECYCLE_STAGES[number]
export type HatcheryLifecycleDateBasis = 'created' | 'receiving'
export type HatcheryLifecycleStatus = 'pending' | 'approved' | 'rejected' | 'voided'

export type HatcheryLifecycleFarm = {
  id: number
  code: string
  name: string
  island: string
  region: string
}

export type HatcheryLifecycleTa = {
  id: number
  name: string
  farmId: number
}

export type HatcheryLifecycleStageMetric = {
  documentCount: number
  quantity: number
}

export type HatcheryLifecycleSummaryRow = {
  farmId: number
  farmCode: string
  farmName: string
  island: string
  region: string
  taId: number
  taName: string
  stages: Partial<Record<HatcheryLifecycleStage, HatcheryLifecycleStageMetric>>
}

export type HatcheryLifecycleNode = {
  nodeKey: string
  stage: HatcheryLifecycleStage
  stageOrder: number
  documentId: number
  lineId: number | null
  documentNo: string
  reference: string | null
  occurredAt: string | null
  status: string
  voided: boolean
  quantity: number | null
  uom: string | null
  originFarmId: number
  destinationFarmId: number | null
  destinationFarmName: string | null
  metadata: Record<string, unknown>
}

export type HatcheryLifecycle = {
  receivingId: number
  farmId: number
  taId: number | null
  reportDate: string
  reportStatus: string
  documentNo: string
  reference: string | null
  needsReview: string[]
  nodes: HatcheryLifecycleNode[]
}

export type HatcheryLifecycleReport = {
  apiVersion: number
  filters: {
    dateFrom: string
    dateTo: string
    dateBasis: HatcheryLifecycleDateBasis
    farmIds: number[]
    taIds: number[]
    statuses: HatcheryLifecycleStatus[]
  }
  catalog: {
    farms: HatcheryLifecycleFarm[]
    tas: HatcheryLifecycleTa[]
  }
  rows: HatcheryLifecycleSummaryRow[]
  lifecycles: HatcheryLifecycle[]
  pagination: { page: number; pageSize: number; total: number }
  generatedAt: string
}

export type HatcheryLifecycleReportParams = {
  farmIds?: number[]
  taIds?: number[]
  dateFrom: string
  dateTo: string
  dateBasis: HatcheryLifecycleDateBasis
  statuses?: HatcheryLifecycleStatus[]
  page?: number
  pageSize?: number
}

const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeReport(value: unknown): HatcheryLifecycleReport {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const catalog = (source.catalog && typeof source.catalog === 'object' ? source.catalog : {}) as Record<string, unknown>
  const pagination = (source.pagination && typeof source.pagination === 'object' ? source.pagination : {}) as Record<string, unknown>
  const filters = (source.filters && typeof source.filters === 'object' ? source.filters : {}) as Record<string, unknown>
  const farms = Array.isArray(catalog.farms) ? catalog.farms : []
  const tas = Array.isArray(catalog.tas) ? catalog.tas : []
  const rows = Array.isArray(source.rows) ? source.rows : []
  const lifecycles = Array.isArray(source.lifecycles) ? source.lifecycles : []

  return {
    apiVersion: numberValue(source.apiVersion),
    filters: {
      dateFrom: String(filters.dateFrom ?? ''),
      dateTo: String(filters.dateTo ?? ''),
      dateBasis: filters.dateBasis === 'receiving' ? 'receiving' : 'created',
      farmIds: Array.isArray(filters.farmIds) ? filters.farmIds.map(numberValue).filter(Boolean) : [],
      taIds: Array.isArray(filters.taIds) ? filters.taIds.map(numberValue).filter(Boolean) : [],
      statuses: Array.isArray(filters.statuses) ? filters.statuses as HatcheryLifecycleStatus[] : [],
    },
    catalog: {
      farms: farms.map((farm) => {
        const row = farm as Record<string, unknown>
        const region = normalizeAdministrativeRegion(String(row.region ?? '')) || 'Region not set'
        const island = normalizeFarmIsland(String(row.island ?? '')) || islandGroupForRegion(region) || 'Island not set'
        return { id: numberValue(row.id), code: String(row.code ?? ''), name: String(row.name ?? ''), island, region }
      }).filter((farm) => farm.id > 0),
      tas: tas.map((ta) => {
        const row = ta as Record<string, unknown>
        return { id: numberValue(row.id), name: String(row.name ?? ''), farmId: numberValue(row.farmId) }
      }).filter((ta) => ta.id > 0 && ta.farmId > 0),
    },
    rows: rows.map((row) => {
      const record = row as Record<string, unknown>
      const rawStages = (record.stages && typeof record.stages === 'object' ? record.stages : {}) as Record<string, unknown>
      const stages = Object.fromEntries(Object.entries(rawStages).map(([stage, metric]) => {
        const values = (metric && typeof metric === 'object' ? metric : {}) as Record<string, unknown>
        return [stage, { documentCount: numberValue(values.documentCount), quantity: numberValue(values.quantity) }]
      })) as Partial<Record<HatcheryLifecycleStage, HatcheryLifecycleStageMetric>>
      const region = normalizeAdministrativeRegion(String(record.region ?? '')) || 'Region not set'
      const island = normalizeFarmIsland(String(record.island ?? '')) || islandGroupForRegion(region) || 'Island not set'
      return {
        farmId: numberValue(record.farm_id), farmCode: String(record.farm_code ?? ''), farmName: String(record.farm_name ?? ''),
        island, region, taId: numberValue(record.ta_id), taName: String(record.ta_name ?? ''), stages,
      }
    }),
    lifecycles: lifecycles.map((lifecycle) => {
      const record = lifecycle as Record<string, unknown>
      const nodes = Array.isArray(record.nodes) ? record.nodes : []
      return {
        receivingId: numberValue(record.receiving_id), farmId: numberValue(record.farm_id), taId: record.ta_id == null ? null : numberValue(record.ta_id),
        reportDate: String(record.report_date ?? ''), reportStatus: String(record.report_status ?? ''), documentNo: String(record.document_no ?? ''),
        reference: record.reference == null ? null : String(record.reference), needsReview: Array.isArray(record.needs_review) ? record.needs_review.map(String) : [],
        nodes: nodes.map((node) => {
          const item = node as Record<string, unknown>
          return {
            nodeKey: String(item.nodeKey ?? ''), stage: String(item.stage ?? 'Receiving') as HatcheryLifecycleStage,
            stageOrder: numberValue(item.stageOrder), documentId: numberValue(item.documentId), lineId: item.lineId == null ? null : numberValue(item.lineId),
            documentNo: String(item.documentNo ?? ''), reference: item.reference == null ? null : String(item.reference), occurredAt: item.occurredAt == null ? null : String(item.occurredAt),
            status: String(item.status ?? ''), voided: Boolean(item.voided), quantity: item.quantity == null ? null : numberValue(item.quantity), uom: item.uom == null ? null : String(item.uom),
            originFarmId: numberValue(item.originFarmId), destinationFarmId: item.destinationFarmId == null ? null : numberValue(item.destinationFarmId),
            destinationFarmName: item.destinationFarmName == null ? null : String(item.destinationFarmName),
            metadata: (item.metadata && typeof item.metadata === 'object' ? item.metadata : {}) as Record<string, unknown>,
          }
        }),
      }
    }),
    pagination: { page: numberValue(pagination.page) || 1, pageSize: numberValue(pagination.pageSize) || 25, total: numberValue(pagination.total) },
    generatedAt: String(source.generatedAt ?? ''),
  }
}

export async function getHatcheryLifecycleReport(params: HatcheryLifecycleReportParams) {
  const { data, error } = await db.rpc('get_hatchery_lifecycle_report', {
    p_farm_ids: params.farmIds?.length ? params.farmIds : null,
    p_ta_ids: params.taIds?.length ? params.taIds : null,
    p_date_from: params.dateFrom,
    p_date_to: params.dateTo,
    p_date_basis: params.dateBasis,
    p_statuses: params.statuses?.length ? params.statuses : null,
    p_page: params.page ?? 1,
    p_page_size: params.pageSize ?? 25,
  })

  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('Hatchery Lifecycle Report requires its Supabase SQL deployment.')
    }
    const message = [
      error.message,
      error.details,
      error.hint,
      error.code ? `Code: ${error.code}` : null,
    ].filter(Boolean).join(' ')
    throw new Error(message || 'Unable to load the Hatchery Lifecycle Report.')
  }

  return normalizeReport(data)
}
