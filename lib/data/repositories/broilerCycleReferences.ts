import { db } from '@/lib/Supabase/supabaseClient'

type BroilerCycleReferenceIds = {
  farmCycleIds: number[]
  flockCardIds: number[]
}

type CycleReferenceLookupOptions = {
  farmIdentifier?: number | string | null
}

type FlockCardReferenceRow = {
  id: number
  farm_cycle_id: number | null
}

type FarmCycleReferenceRow = {
  id: number
}

type FlockCardCycleLabelRow = {
  id: number
  cycle_no: string | number | null
  cycle_mask: string | null
  doc_farm_cycles?: { cycle_mask: string | null } | { cycle_mask: string | null }[] | null
}

export type BroilerCycleReferenceOption = {
  value: string
  label: string
}

function linkedCycleMask(row: FlockCardCycleLabelRow): string {
  const linked = Array.isArray(row.doc_farm_cycles)
    ? row.doc_farm_cycles[0]
    : row.doc_farm_cycles
  return String(row.cycle_mask || linked?.cycle_mask || row.cycle_no || '').trim()
}

function applyFarmFilter<T>(
  query: T,
  farmIdentifier: number | string | null | undefined,
): T {
  if (farmIdentifier == null || String(farmIdentifier).trim() === '') return query

  const farmValue = String(farmIdentifier).trim()
  const filter = /^\d+$/.test(farmValue)
    ? ['farm_id', farmValue]
    : ['farm_code', farmValue]

  return (query as T & { eq: (column: string, value: string) => T }).eq(filter[0], filter[1])
}

/** Resolve an exact displayed/raw Cycle # to the shared farm-cycle and flock-card IDs. */
export async function getBroilerCycleReferenceIds(
  cycleReference: string,
  options: CycleReferenceLookupOptions = {},
): Promise<BroilerCycleReferenceIds> {
  const reference = cycleReference.trim()
  if (!reference) return { farmCycleIds: [], flockCardIds: [] }

  const flockCardQuery = (field: 'cycle_no' | 'cycle_mask') => applyFarmFilter(
    db
      .from('flock_card')
      .select('id, farm_cycle_id')
      .eq('void', '1')
      .eq(field, reference),
    options.farmIdentifier,
  )
  const farmCycleQuery = (field: 'cycle_no' | 'cycle_mask') => applyFarmFilter(
    db
      .from('doc_farm_cycles')
      .select('id')
      .eq(field, reference),
    options.farmIdentifier,
  )

  const results = await Promise.all([
    flockCardQuery('cycle_no'),
    flockCardQuery('cycle_mask'),
    farmCycleQuery('cycle_no'),
    farmCycleQuery('cycle_mask'),
  ])

  for (const result of results) {
    if (result.error) throw result.error
  }

  const directCards = [
    ...((results[0].data ?? []) as FlockCardReferenceRow[]),
    ...((results[1].data ?? []) as FlockCardReferenceRow[]),
  ]
  const farmCycleIds = new Set<number>([
    ...directCards.flatMap(card => card.farm_cycle_id == null ? [] : [Number(card.farm_cycle_id)]),
    ...((results[2].data ?? []) as FarmCycleReferenceRow[]).map(cycle => Number(cycle.id)),
    ...((results[3].data ?? []) as FarmCycleReferenceRow[]).map(cycle => Number(cycle.id)),
  ].filter(id => Number.isFinite(id) && id > 0))
  const flockCardIds = new Set<number>(
    directCards.map(card => Number(card.id)).filter(id => Number.isFinite(id) && id > 0),
  )

  if (farmCycleIds.size > 0) {
    const linkedCardsQuery = applyFarmFilter(
      db
        .from('flock_card')
        .select('id, farm_cycle_id')
        .eq('void', '1')
        .in('farm_cycle_id', [...farmCycleIds]),
      options.farmIdentifier,
    )
    const { data, error } = await linkedCardsQuery
    if (error) throw error
    for (const card of (data ?? []) as FlockCardReferenceRow[]) {
      flockCardIds.add(Number(card.id))
    }
  }

  return {
    farmCycleIds: [...farmCycleIds],
    flockCardIds: [...flockCardIds],
  }
}

/** List every historical Cycle # available to the selected farm for filter dropdowns. */
export async function listBroilerCycleReferenceOptions(
  options: CycleReferenceLookupOptions = {},
): Promise<BroilerCycleReferenceOption[]> {
  const labels = new Set<string>()

  for (let offset = 0; ; offset += 500) {
    const query = applyFarmFilter(
      db
        .from('flock_card')
        .select('id, cycle_no, cycle_mask, doc_farm_cycles(cycle_mask)')
        .eq('void', '1')
        .order('id', { ascending: true })
        .range(offset, offset + 499),
      options.farmIdentifier,
    )
    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as FlockCardCycleLabelRow[]
    for (const row of rows) {
      const label = linkedCycleMask(row)
      if (label) labels.add(label)
    }
    if (rows.length < 500) break
  }

  return [...labels]
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .map(label => ({ value: label, label }))
}

/** Resolve Cycle # labels for saved DOC Placement flock-card references. */
export async function getBroilerCycleLabelsByFlockCardIds(
  flockCardIds: number[],
): Promise<Map<number, string>> {
  const ids = [...new Set(flockCardIds.filter(id => Number.isFinite(id) && id > 0))]
  const labels = new Map<number, string>()

  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await db
      .from('flock_card')
      .select('id, cycle_no, cycle_mask, doc_farm_cycles(cycle_mask)')
      .in('id', ids.slice(offset, offset + 200))
    if (error) throw error

    for (const row of (data ?? []) as FlockCardCycleLabelRow[]) {
      const label = linkedCycleMask(row)
      if (label) labels.set(Number(row.id), label)
    }
  }

  return labels
}
