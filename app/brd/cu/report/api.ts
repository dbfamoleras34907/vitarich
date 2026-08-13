'use client'

import { db } from '@/lib/Supabase/supabaseClient'

export type CleanupReportBuilding = {
  id: number
  code: string
  name: string
}

export type CleanupReportRow = {
  flockCardId: number
  buildingCode: string
  buildingName: string
  flockCard: string
  growingNumber: string
  age: number
  totalPlacement: number
  totalMortality: number
  totalDelivered: number
  totalCleaned: number
  totalVariance: number
}

type CardRow = {
  id: number
  card_no: string | null
  building_code: string | null
  building_name: string | null
  cycle_no: string | null
  start_date: string | null
  extra: Record<string, unknown> | null
}

type OriginRow = {
  id: number
  fc_id: number
  item_code: string | null
  batch_no: string | null
  animal_qty: number | null
}

type PostingRow = {
  source_doc_type: string | null
  source_docentry: number | null
  item_code: string | null
  warehouse_code: string | null
  batch_number: string | null
  ref: string | null
  qty: number | null
  transfer_type: string | null
}

const normalize = (value: unknown) => String(value ?? '').trim().toUpperCase()

function calculateAge(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return 0
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(Math.floor((end.getTime() - start.getTime()) / 86_400_000), 0)
}

export async function getCleanupReportBuildings(farmId: number): Promise<CleanupReportBuilding[]> {
  if (!Number.isFinite(farmId) || farmId <= 0) return []

  const result = await db
    .from('i_warehouse')
    .select('id, whse_code, whse_name')
    .eq('farm_id', farmId)
    .eq('warehouse_type', 'Building')
    .eq('is_active', true)
    .order('whse_name')

  if (result.error) throw result.error
  return (result.data ?? []).map(row => ({
    id: Number(row.id),
    code: String(row.whse_code ?? '').trim(),
    name: String(row.whse_name ?? '').trim(),
  }))
}

export async function getCleanupReport(params: {
  farmId: number
  buildingCode?: string
  from: string
  to: string
}): Promise<CleanupReportRow[]> {
  const farmId = Number(params.farmId)
  if (!Number.isFinite(farmId) || farmId <= 0 || !params.from || !params.to) return []

  let cardQuery = db
    .from('flock_card')
    .select('id, card_no, building_code, building_name, cycle_no, start_date, extra')
    .eq('farm_id', farmId)
    .eq('void', '1')
    .eq('status', 'Closed')
    .gte('start_date', params.from)
    .lte('start_date', params.to)
    .order('start_date', { ascending: false })

  if (params.buildingCode) cardQuery = cardQuery.eq('building_code', params.buildingCode)
  const cardResult = await cardQuery
  if (cardResult.error) throw cardResult.error

  const candidateCards = (cardResult.data ?? []) as CardRow[]
  const cleanupIds = Array.from(new Set(candidateCards
    .filter(card => normalize(card.extra?.closed_by_doc_type) === 'BR_CLEANUP')
    .map(card => Number(card.extra?.closed_by_docentry ?? 0))
    .filter(id => id > 0)))
  if (cleanupIds.length === 0) return []

  const cleanupResult = await db
    .from('br_cleanup')
    .select('id, issue_date')
    .in('id', cleanupIds)
    .eq('farm_id', farmId)
    .eq('status', 'Posted')
  if (cleanupResult.error) throw cleanupResult.error

  const cleanupDates = new Map((cleanupResult.data ?? []).map(row => [Number(row.id), String(row.issue_date ?? '')]))
  const cards = candidateCards.filter(card => cleanupDates.has(Number(card.extra?.closed_by_docentry ?? 0)))
  if (cards.length === 0) return []

  const originResult = await db
    .from('flock_card_origin')
    .select('id, fc_id, item_code, batch_no, animal_qty')
    .in('fc_id', cards.map(card => card.id))
    .eq('void', '1')
  if (originResult.error) throw originResult.error
  const origins = (originResult.data ?? []) as OriginRow[]

  const warehouseCodes = Array.from(new Set(cards.map(card => String(card.building_code ?? '').trim()).filter(Boolean)))
  const itemCodes = Array.from(new Set(origins.map(origin => String(origin.item_code ?? '').trim()).filter(Boolean)))
  let postings: PostingRow[] = []

  if (warehouseCodes.length && itemCodes.length) {
    const postingResult = await db
      .from('inventory_postings')
      .select('source_doc_type, source_docentry, item_code, warehouse_code, batch_number, ref, qty, transfer_type')
      .in('warehouse_code', warehouseCodes)
      .in('item_code', itemCodes)
      .in('source_doc_type', [
        'FLOCK_CARD_ORIGIN',
        'FLOCK_CARD_ORIGIN_VOID',
        'BRD_FC_MORT_THIN_USAGE',
        'BRD_FC_MORT_THIN_TRANSFER_OUT',
        'BRD_FC_MORT_THIN_REVERSAL',
        'BR_DELIVERY',
        'BR_CLEANUP',
        'BR_CLEANUP_VARIANCE',
      ])
    if (postingResult.error) throw postingResult.error
    postings = (postingResult.data ?? []) as PostingRow[]
  }

  const signedQty = (posting: PostingRow) => normalize(posting.transfer_type) === 'OUT'
    ? -Number(posting.qty ?? 0)
    : Number(posting.qty ?? 0)

  return cards.map(card => {
    const cardOrigins = origins.filter(origin => Number(origin.fc_id) === Number(card.id))
    const originIds = new Set(cardOrigins.map(origin => Number(origin.id)))
    const originKeys = new Set(cardOrigins.map(origin => `${normalize(origin.item_code)}|${normalize(origin.batch_no)}`))
    const buildingCode = String(card.building_code ?? '').trim()
    const cleanupId = Number(card.extra?.closed_by_docentry ?? 0)
    const cardPostings = postings.filter(posting => {
      const type = normalize(posting.source_doc_type)
      if ((type === 'FLOCK_CARD_ORIGIN' || type === 'FLOCK_CARD_ORIGIN_VOID') && !originIds.has(Number(posting.source_docentry))) return false
      if ((type === 'BR_CLEANUP' || type === 'BR_CLEANUP_VARIANCE') && Number(posting.source_docentry) !== cleanupId) return false
      return normalize(posting.warehouse_code) === normalize(buildingCode)
        && originKeys.has(`${normalize(posting.item_code)}|${normalize(posting.batch_number ?? posting.ref)}`)
    })
    const movementTotal = (types: string[]) => cardPostings
      .filter(posting => types.includes(normalize(posting.source_doc_type)))
      .reduce((total, posting) => total + signedQty(posting), 0)
    const postedPlacement = Math.max(movementTotal(['FLOCK_CARD_ORIGIN', 'FLOCK_CARD_ORIGIN_VOID']), 0)
    const savedPlacement = cardOrigins.reduce((total, origin) => total + Number(origin.animal_qty ?? 0), 0)
    return {
      flockCardId: Number(card.id),
      buildingCode,
      buildingName: String(card.building_name ?? '').trim(),
      flockCard: String(card.card_no ?? '').trim(),
      growingNumber: String(card.cycle_no ?? '').trim(),
      age: calculateAge(card.start_date, cleanupDates.get(cleanupId) ?? null),
      totalPlacement: postedPlacement > 0 ? postedPlacement : Math.max(savedPlacement, 0),
      totalMortality: Math.max(-movementTotal(['BRD_FC_MORT_THIN_USAGE', 'BRD_FC_MORT_THIN_TRANSFER_OUT', 'BRD_FC_MORT_THIN_REVERSAL']), 0),
      totalDelivered: Math.max(-movementTotal(['BR_DELIVERY']), 0),
      totalCleaned: Math.max(-movementTotal(['BR_CLEANUP']), 0),
      totalVariance: Math.max(-movementTotal(['BR_CLEANUP_VARIANCE']), 0),
    }
  }).sort((left, right) =>
    (left.buildingName || left.buildingCode).localeCompare(right.buildingName || right.buildingCode, undefined, { numeric: true }),
  )
}
