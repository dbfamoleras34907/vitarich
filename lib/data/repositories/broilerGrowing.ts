import { db } from '@/lib/Supabase/supabaseClient'

export type BroilerGrowingHeaderSnapshot = {
  id: number
  cardNo: string
  actualAge: number | null
}

const normalizeCardNo = (value: string) => value.trim().toUpperCase()

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
