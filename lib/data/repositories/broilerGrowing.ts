import { db } from '@/lib/Supabase/supabaseClient'

export type BroilerGrowingHeaderSnapshot = {
  id: number
  cardNo: string
  actualAge: number | null
}

const normalizeCardNo = (value: string) => value.trim().toUpperCase()

export async function reverseBroilerGrowing(growingId: number, reason: string): Promise<void> {
  if (!Number.isSafeInteger(growingId) || growingId <= 0 || !reason.trim()) {
    throw new Error('A Growing record and reversal reason are required.')
  }
  const result = await db.rpc('reverse_brd_fc_transaction', {
    p_growing_id: growingId,
    p_reason: reason.trim(),
  })
  if (result.error) throw new Error(result.error.message)
  if (!result.data) throw new Error('The reversal did not return a confirmation. Refresh before trying again.')
}

export async function getLatestBroilerGrowingHeaders(
  cardNumbers: string[],
): Promise<Record<string, BroilerGrowingHeaderSnapshot>> {
  const normalizedCardNumbers = Array.from(new Set(
    cardNumbers.map(value => value.trim()).filter(Boolean),
  ))
  if (normalizedCardNumbers.length === 0) return {}

  const result = await db
    .from('brd_fc')
    .select('id, card_no, actual_age')
    .in('card_no', normalizedCardNumbers)
    .eq('void', '1')
    .order('id', { ascending: false })

  if (result.error) {
    throw new Error(`Unable to load Growing actual ages: ${result.error.message}`)
  }

  const latestByCardNo: Record<string, BroilerGrowingHeaderSnapshot> = {}
  for (const row of result.data ?? []) {
    const cardNo = String(row.card_no ?? '').trim()
    const key = normalizeCardNo(cardNo)
    if (!key || latestByCardNo[key]) continue

    const rawActualAge = row.actual_age
    const actualAge = rawActualAge === null ? null : Number(rawActualAge)
    latestByCardNo[key] = {
      id: Number(row.id),
      cardNo,
      actualAge: Number.isFinite(actualAge) ? actualAge : null,
    }
  }

  return latestByCardNo
}

export function getBroilerGrowingHeader(
  headers: Record<string, BroilerGrowingHeaderSnapshot>,
  cardNo: string,
) {
  return headers[normalizeCardNo(cardNo)] ?? null
}

export async function getLastMortalityAge(flockCardId: number): Promise<number | null> {
  const normalizedFlockCardId = Number(flockCardId)
  if (!Number.isFinite(normalizedFlockCardId) || normalizedFlockCardId <= 0) return null

  const result = await db.rpc('get_brd_fc_last_mortality_age', {
    p_flock_card_id: normalizedFlockCardId,
  })

  if (result.error) {
    throw new Error(`Unable to load the last mortality age: ${result.error.message}`)
  }

  if (result.data === null || result.data === undefined) return null
  const age = Number(result.data)
  return Number.isFinite(age) ? age : null
}
