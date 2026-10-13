import { db } from '@/lib/Supabase/supabaseClient'
import { getFarmBuildingsForFlockCard } from '@/lib/data/repositories/broilerFlockCards'
import { getFarmCycleMasterRows } from '@/lib/data/repositories/broilerFarmCycles'
import { farmFmsType, listApprovedFarmAccessOptions } from '@/lib/data/repositories/farms'
import { createUuid } from '@/lib/utils/createUuid'
import type {
  BroilerDtwImportProgress,
  BroilerDtwImportJob,
  BroilerDtwImportResult,
  BroilerDtwImportedRowPage,
  BroilerDtwImportStage,
  BroilerDtwReferences,
  BroilerDtwWorkbookPayload,
} from '@/app/brd/dtw/types'
import { BROILER_DTW_SOURCE_ROW } from '@/app/brd/dtw/types'

export async function getBroilerDtwReferences(): Promise<BroilerDtwReferences> {
  const farmRows = (await listApprovedFarmAccessOptions(db))
    .filter(farm => farmFmsType(farm.farm_type) === 'Broiler')
  const farmResults = await Promise.all(farmRows.map(async farm => {
    const [buildings, cycles] = await Promise.all([
      getFarmBuildingsForFlockCard(farm.id, { includePlacementInventory: false }),
      getFarmCycleMasterRows(farm.id, { validateOwnership: false }),
    ])
    return { farm, buildings, cycles }
  }))

  return {
    farms: farmRows.map(farm => ({ id: farm.id, code: farm.code, name: farm.name })),
    buildings: farmResults.flatMap(({ farm, buildings }) => buildings
      .filter(building => building.id != null)
      .map(building => ({
        id: Number(building.id),
        farmId: farm.id,
        farmCode: farm.code,
        code: building.code,
        name: building.name,
      }))),
    cycles: farmResults.flatMap(({ farm, cycles }) => cycles.map(cycle => ({
      id: cycle.id,
      farmId: farm.id,
      farmCode: farm.code,
      cycleKey: cycle.cycleKey,
      status: cycle.status,
    }))),
  }
}

const IMPORT_CHUNK_SIZES: Record<ImportStage, number> = {
  placement: 25,
  growing: 20,
  harvest: 25,
  cleanup: 10,
}
type ImportIdentity = { requestId: string; importHash: string }
const importRequestIds = new WeakMap<BroilerDtwWorkbookPayload, ImportIdentity>()
const importIdentityPromises = new WeakMap<BroilerDtwWorkbookPayload, Promise<ImportIdentity>>()
const cancelledImportIds = new Set<string>()

export class BroilerDtwFinalizationTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BroilerDtwFinalizationTimeoutError'
  }
}

type ImportStage = 'placement' | 'growing' | 'harvest' | 'cleanup'
type SourcedDtwRow = BroilerDtwWorkbookPayload['growing'][number] & { [BROILER_DTW_SOURCE_ROW]?: number }

const IMPORT_STAGES: ReadonlyArray<{ key: ImportStage; label: string }> = [
  { key: 'placement', label: 'DOC Placement' },
  { key: 'growing', label: 'Growing' },
  { key: 'harvest', label: 'Harvest Delivery' },
  { key: 'cleanup', label: 'Clean Up' },
]

function fallbackPayloadHash(value: string) {
  const seeds = [2166136261, 2246822519, 3266489917, 668265263, 374761393, 1274126177, 42595009, 1597334677]
  return seeds.map(seed => {
    let hash = seed
    for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
    return (hash >>> 0).toString(16).padStart(8, '0')
  }).join('')
}

async function payloadHash(payload: BroilerDtwWorkbookPayload) {
  const serialized = JSON.stringify(payload)
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized))
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  }
  return fallbackPayloadHash(serialized)
}

type ImportJobIdentityRow = {
  id: string
  payload_hash: string
}

async function resolveImportIdentityOnce(payload: BroilerDtwWorkbookPayload): Promise<ImportIdentity> {
  const remembered = importRequestIds.get(payload)
  if (remembered) return remembered
  const importHash = await payloadHash(payload)
  const { data, error } = await db
    .from('broiler_dtw_import_jobs')
    .select('id, payload_hash')
    .in('status', ['Staging', 'Ready', 'Processing', 'Failed', 'Completed'])
    .eq('payload_hash', importHash)
    .eq('mode', payload.mode)
    .eq('file_name', payload.fileName)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  const candidates = (data ?? []) as ImportJobIdentityRow[]
  const exact = candidates.find(job => job.payload_hash === importHash)
  const identity = exact
    ? { requestId: exact.id, importHash }
    : { requestId: createUuid(), importHash }
  importRequestIds.set(payload, identity)
  return identity
}

async function resolveImportIdentity(payload: BroilerDtwWorkbookPayload): Promise<ImportIdentity> {
  const remembered = importRequestIds.get(payload)
  if (remembered) return remembered
  const pending = importIdentityPromises.get(payload)
  if (pending) return pending
  const resolution = resolveImportIdentityOnce(payload)
  importIdentityPromises.set(payload, resolution)
  try {
    return await resolution
  } finally {
    importIdentityPromises.delete(payload)
  }
}

function growingBaselineRows(rows: BroilerDtwWorkbookPayload['growing']) {
  const groups = new Map<string, { placementDate?: string; entryDate?: string }>()
  rows.forEach(row => {
    const key = `${String(row.farmCode ?? '').trim().toUpperCase()}|${String(row.placementBatch ?? '').trim().toUpperCase()}`
    const current = groups.get(key) ?? {}
    const placementDate = String(row.placementDate ?? '').trim()
    const entryDate = String(row.entryDate ?? '').trim()
    if (placementDate && (!current.placementDate || placementDate < current.placementDate)) current.placementDate = placementDate
    if (entryDate && (!current.entryDate || entryDate < current.entryDate)) current.entryDate = entryDate
    groups.set(key, current)
  })
  return rows.map(row => {
    const key = `${String(row.farmCode ?? '').trim().toUpperCase()}|${String(row.placementBatch ?? '').trim().toUpperCase()}`
    const baseline = groups.get(key)
    const normalized = { ...row, placementDate: baseline?.placementDate ?? baseline?.entryDate ?? row.placementDate } as SourcedDtwRow
    Object.defineProperty(normalized, BROILER_DTW_SOURCE_ROW, { value: (row as SourcedDtwRow)[BROILER_DTW_SOURCE_ROW] })
    return normalized
  })
}

function isUpstreamTimeout(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown }
  const text = `${String(candidate.code ?? '')} ${String(candidate.message ?? '')} ${String(candidate.details ?? '')}`.toLowerCase()
  return text.includes('upstream request timeout') || text.includes('gateway timeout') || text.includes('504')
}

async function readFinalizedImportResult(requestId: string): Promise<BroilerDtwImportResult | null> {
  const { data, error } = await db
    .from('broiler_dtw_import_jobs')
    .select('status, result')
    .eq('id', requestId)
    .maybeSingle()
  if (error || !data || !data.result || typeof data.result !== 'object') return null
  if (data.status !== 'Completed' && data.status !== 'Failed') return null
  return data.result as BroilerDtwImportResult
}

async function waitForFinalizedImportResult(requestId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 1_500))
    const result = await readFinalizedImportResult(requestId)
    if (result) return result
  }
  return null
}

export async function importBroilerDtwWorkbook(
  payload: BroilerDtwWorkbookPayload,
  onProgress?: BroilerDtwImportProgress,
): Promise<BroilerDtwImportResult> {
  const identity = await resolveImportIdentity(payload)
  const { requestId, importHash } = identity
  const stageRows = {
    placement: payload.placement,
    growing: growingBaselineRows(payload.growing),
    harvest: payload.harvest,
    cleanup: payload.cleanup,
  }
  const totalRows = Object.values(stageRows).reduce((sum, rows) => sum + rows.length, 0)
  const expectedCounts = {
    placement: payload.placement.length,
    growing: payload.growing.length,
    harvest: payload.harvest.length,
    cleanup: payload.cleanup.length,
  }
  let processedRows = 0
  let chunkNumber = 0
  const totalChunks = IMPORT_STAGES.reduce((sum, stage) => sum + Math.ceil(stageRows[stage.key].length / IMPORT_CHUNK_SIZES[stage.key]), 0)

  for (const stage of IMPORT_STAGES) {
    const rows = stageRows[stage.key]
    const chunkSize = IMPORT_CHUNK_SIZES[stage.key]
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      if (cancelledImportIds.has(requestId)) throw new Error('DTW import cancelled. No business rows were posted.')
      const chunk = rows.slice(offset, offset + chunkSize).map((row, chunkIndex) => ({
        ...row,
        _dtwRowNo: (row as SourcedDtwRow)[BROILER_DTW_SOURCE_ROW] ?? offset + chunkIndex + 2,
      }))
      chunkNumber += 1
      const firstRow = Number(chunk[0]._dtwRowNo)
      const lastRow = Number(chunk[chunk.length - 1]._dtwRowNo)
      onProgress?.({
        phase: 'staging',
        message: `Staging ${stage.label} rows ${firstRow.toLocaleString()}-${lastRow.toLocaleString()} (batch ${chunkNumber.toLocaleString()} of ${totalChunks.toLocaleString()}).`,
        module: stage.label,
        worksheetRow: firstRow,
        processedRows,
        totalRows,
        percent: totalRows === 0 ? 100 : Math.round(processedRows / totalRows * 100),
      })
      const chunkPayload = {
        mode: payload.mode,
        fileName: payload.fileName,
        stage: stage.key,
        rows: chunk,
        warnings: payload.warnings,
        importHash,
        expectedCounts,
      }
      const { data, error } = await db.rpc('stage_broiler_dtw_workbook', {
        p_request_id: requestId,
        p_payload: chunkPayload,
      })
      if (error) throw error
      if (!data || typeof data !== 'object') throw new Error('The DTW staging request did not return a result.')
      const stageResult = data as BroilerDtwImportResult
      if (stageResult.status === 'Completed') return stageResult
      processedRows += chunk.length
      onProgress?.({
        phase: 'staging',
        message: `Staged ${stage.label} through Excel row ${lastRow.toLocaleString()}.`,
        module: stage.label,
        worksheetRow: lastRow,
        processedRows,
        totalRows,
        percent: totalRows === 0 ? 100 : Math.round(processedRows / totalRows * 100),
      })
    }
  }

  if (totalRows === 0) throw new Error('The workbook contains no import rows.')
  if (cancelledImportIds.has(requestId)) throw new Error('DTW import cancelled. No business rows were posted.')
  onProgress?.({ phase: 'finalizing', message: 'Posting the complete workbook in one atomic database transaction.', processedRows, totalRows, percent: 100 })
  let finalResult: BroilerDtwImportResult | null = null
  for (let attempt = 0; attempt < 2 && !finalResult; attempt += 1) {
    const { data, error } = await db.rpc('finalize_broiler_dtw_import', {
      p_request_id: requestId,
      p_import_hash: importHash,
    })
    if (!error) {
      if (!data || typeof data !== 'object') throw new Error('The DTW finalization did not return a result.')
      finalResult = data as BroilerDtwImportResult
      break
    }
    if (!isUpstreamTimeout(error)) throw error
    onProgress?.({
      phase: 'finalizing',
      message: attempt === 0
        ? 'The API timed out while PostgreSQL may still be committing. Confirming Import history before one safe retry.'
        : 'The API timed out again. Confirming the final database status.',
      processedRows,
      totalRows,
      percent: 100,
    })
    finalResult = await waitForFinalizedImportResult(requestId)
  }
  if (!finalResult) {
    throw new BroilerDtwFinalizationTimeoutError(
      'Finalization exceeded the Supabase API time limit and its committed status could not be confirmed. Check Import history before retrying.',
    )
  }
  if (finalResult.status === 'Failed') {
    throw new Error(finalResult.error?.message ?? 'The DTW import failed. Every business change was rolled back.')
  }
  cancelledImportIds.delete(requestId)
  return finalResult
}

export async function cancelBroilerDtwImportJob(requestId: string): Promise<BroilerDtwImportResult> {
  cancelledImportIds.add(requestId)
  const { data, error } = await db.rpc('cancel_broiler_dtw_import', { p_request_id: requestId })
  if (error) {
    cancelledImportIds.delete(requestId)
    throw error
  }
  if (!data || typeof data !== 'object') {
    cancelledImportIds.delete(requestId)
    throw new Error('The DTW cancellation did not return a result.')
  }
  return data as BroilerDtwImportResult
}

export async function cancelBroilerDtwWorkbook(payload: BroilerDtwWorkbookPayload) {
  const { requestId } = await resolveImportIdentity(payload)
  return cancelBroilerDtwImportJob(requestId)
}

type ImportJobRow = {
  id: string
  mode: 'standard' | 'legacy'
  file_name: string
  status: string
  cycle_count: number
  placement_count: number
  growing_count: number
  harvest_count: number
  cleanup_count: number
  created_at: string
}

export async function getBroilerDtwImportJobs(limit = 25): Promise<BroilerDtwImportJob[]> {
  const { data, error } = await db
    .from('broiler_dtw_import_jobs')
    .select('id, mode, file_name, status, cycle_count, placement_count, growing_count, harvest_count, cleanup_count, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as ImportJobRow[]).map(row => ({
    id: row.id,
    mode: row.mode,
    fileName: row.file_name,
    status: row.status,
    cycleCount: Number(row.cycle_count),
    placementCount: Number(row.placement_count),
    growingCount: Number(row.growing_count),
    harvestCount: Number(row.harvest_count),
    cleanupCount: Number(row.cleanup_count),
    createdAt: row.created_at,
  }))
}

type ImportedRowRecord = {
  id: number
  stage: BroilerDtwImportStage
  row_no: number
  farm_id: number
  building_whse_id: number
  farm_cycle_id: number
  entity_id: number | null
  raw_data: Record<string, unknown>
  warnings: string[] | null
  created_at: string
}

export async function getBroilerDtwImportedRows(
  jobId: string,
  stage: BroilerDtwImportStage,
  page = 0,
  pageSize = 50,
): Promise<BroilerDtwImportedRowPage> {
  const from = page * pageSize
  const { data, error, count } = await db
    .from('broiler_dtw_import_rows')
    .select('id, stage, row_no, farm_id, building_whse_id, farm_cycle_id, entity_id, raw_data, warnings, created_at', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('stage', stage)
    .order('row_no', { ascending: true })
    .range(from, from + pageSize - 1)
  if (error) throw error
  return {
    rows: ((data ?? []) as ImportedRowRecord[]).map(row => ({
      id: Number(row.id),
      stage: row.stage,
      rowNo: Number(row.row_no),
      farmId: Number(row.farm_id),
      buildingId: Number(row.building_whse_id),
      farmCycleId: Number(row.farm_cycle_id),
      entityId: row.entity_id == null ? null : Number(row.entity_id),
      rawData: row.raw_data ?? {},
      warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
      createdAt: row.created_at,
    })),
    total: Number(count ?? 0),
  }
}
