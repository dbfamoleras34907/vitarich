import { db } from '@/lib/Supabase/supabaseClient'

const ACTIVE_DOC_PLACEMENT_STATUSES = ['Draft', 'Posted', 'Received'] as const

export async function getFirstDocPlacementDates(flockCardIds: number[]) {
  const ids = Array.from(new Set(flockCardIds.filter(id => Number.isFinite(id) && id > 0)))
  if (ids.length === 0) return {} as Record<number, string>

  const result = await db
    .from('goods_receipt_doc')
    .select('flock_card_id, receive_date, goods_receipt!inner(status)')
    .in('flock_card_id', ids)
    .in('goods_receipt.status', ACTIVE_DOC_PLACEMENT_STATUSES)
    .eq('void', '1')
    .not('receive_date', 'is', null)
    .order('receive_date', { ascending: true })

  if (result.error) throw new Error(`Unable to load first DOC placement dates: ${result.error.message}`)

  return (result.data ?? []).reduce<Record<number, string>>((dates, row) => {
    const flockCardId = Number(row.flock_card_id ?? 0)
    const receiveDate = String(row.receive_date ?? '').slice(0, 10)
    if (flockCardId > 0 && receiveDate && !dates[flockCardId]) dates[flockCardId] = receiveDate
    return dates
  }, {})
}

export async function getPostedDocPlacementAnimalQuantities(flockCardIds: number[]) {
  const ids = Array.from(new Set(flockCardIds.filter(id => Number.isFinite(id) && id > 0)))
  if (ids.length === 0) return {} as Record<number, number>

  const result = await db
    .from('goods_receipt_doc')
    .select('flock_card_id, actual_received, goods_receipt!inner(status)')
    .in('flock_card_id', ids)
    .eq('goods_receipt.status', 'Posted')
    .eq('void', '1')

  if (result.error) throw new Error(`Unable to load posted DOC placement quantities: ${result.error.message}`)

  return (result.data ?? []).reduce<Record<number, number>>((quantities, row) => {
    const flockCardId = Number(row.flock_card_id ?? 0)
    const quantity = Number(row.actual_received ?? 0)
    if (flockCardId > 0 && Number.isFinite(quantity)) {
      quantities[flockCardId] = (quantities[flockCardId] ?? 0) + quantity
    }
    return quantities
  }, {})
}
