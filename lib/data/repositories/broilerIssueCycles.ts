import { getBroilerCycleDisplay } from '@/lib/broiler/cycleMask'
import { db } from '@/lib/Supabase/supabaseClient'
import type { GoodsIssue } from '@/app/inv/gi/api'

export type BroilerIssueCycleCard = {
  id: number
  farm_id: number
  building_whse_id: number | null
  building_code: string | null
  card_no: string | null
  cycle_no: string | null
  cycle_mask?: string | null
  doc_farm_cycles?: { cycle_mask: string | null } | { cycle_mask: string | null }[] | null
  flock_card_origin: { item_code: string; batch_no: string; void: string }[]
  extra: { closed_by_doc_type?: string; closed_by_docentry?: number } | null
}

const normalized = (value: unknown) => String(value ?? '').trim().toUpperCase()

export function formatBroilerCycleNumbers(cycle: { cycleMask?: string | null }): string {
  return cycle.cycleMask || '—'
}

export function attachBroilerIssueCycles(issues: GoodsIssue[], cards: BroilerIssueCycleCard[]): GoodsIssue[] {
  return issues.map(issue => ({ ...issue, lines: issue.lines.map(line => {
    const candidates = cards.filter(card => Number(card.farm_id) === Number(issue.farmId) &&
      (line.fromWarehouseId ? Number(card.building_whse_id) === Number(line.fromWarehouseId)
        : normalized(card.building_code) === normalized(line.fromWarehouseCode)))
    const batch = normalized(line.batchNumber)
    const canonicalBatch = /^DOC:F\d+:B\d+:.+$/.test(batch)
    const matches = candidates.filter(card => canonicalBatch
      ? batch === normalized(`DOC:F${card.farm_id}:B${card.building_whse_id}:${card.cycle_no}`)
      : (
      (batch && card.flock_card_origin.some(origin => origin.void === '1' &&
        normalized(origin.item_code) === normalized(line.itemCode) && normalized(origin.batch_no) === batch)) ||
      (issue.triggeredBy === 'BR-CU' && issue.id && card.extra?.closed_by_doc_type === 'BR_CLEANUP' &&
        Number(card.extra.closed_by_docentry) === issue.id)),
    )
    // Historical documents must never silently adopt the newest building cycle.
    const card = matches.length === 1 ? matches[0] : null
    return { ...line, flockCardId: card?.id ?? null, flockCardNo: card?.card_no ?? null,
      cycleNumber: card?.cycle_no ?? null, cycleMask: card ? getBroilerCycleDisplay(card) : null }
  }) }))
}

export async function loadBroilerIssueCycles(issues: GoodsIssue[]): Promise<GoodsIssue[]> {
  const broiler = issues.filter(issue => ['BR-DR', 'BR-CU'].includes(issue.triggeredBy))
  const farmIds = [...new Set(broiler.map(issue => issue.farmId).filter((id): id is number => id !== null))]
  if (!farmIds.length) return issues
  const cards: BroilerIssueCycleCard[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('flock_card')
      .select('id,farm_id,building_whse_id,building_code,card_no,cycle_no,cycle_mask,doc_farm_cycles(cycle_mask),extra,flock_card_origin(item_code,batch_no,void)')
      .in('farm_id', farmIds).order('id').range(offset, offset + 499)
    if (error) throw new Error(`Unable to load document cycle references: ${error.message}`)
    cards.push(...(data ?? []) as BroilerIssueCycleCard[])
    if ((data?.length ?? 0) < 500) break
  }
  return attachBroilerIssueCycles(issues, cards)
}
