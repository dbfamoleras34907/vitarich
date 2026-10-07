import { db } from '@/lib/Supabase/supabaseClient'
import { getFarmBuildingsForFlockCard } from '@/lib/data/repositories/broilerFlockCards'
import { getFarmCycleMasterRows } from '@/lib/data/repositories/broilerFarmCycles'
import { farmFmsType, listApprovedFarmAccessOptions } from '@/lib/data/repositories/farms'
import { createUuid } from '@/lib/utils/createUuid'
import type {
  BroilerDtwImportJob,
  BroilerDtwImportResult,
  BroilerDtwReferences,
  BroilerDtwWorkbookPayload,
} from '@/app/brd/dtw/types'

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

export async function importBroilerDtwWorkbook(payload: BroilerDtwWorkbookPayload): Promise<BroilerDtwImportResult> {
  const { data, error } = await db.rpc('import_broiler_dtw_workbook', {
    p_request_id: createUuid(),
    p_payload: payload,
  })
  if (error) throw error
  if (!data || typeof data !== 'object') throw new Error('The DTW import did not return a result.')
  return data as BroilerDtwImportResult
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
