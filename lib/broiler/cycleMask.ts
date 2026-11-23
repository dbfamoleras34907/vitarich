/** Display only: never use this value as a cycle or inventory batch identity. */
export function formatCycleMask(cycleNumber: string | number, startDate: string | null | undefined): string {
  const cycle = String(cycleNumber).trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate ?? '')
  if (!/^\d+$/.test(cycle) || !match) return ''
  const [, year, month] = match
  const parsed = new Date(`${startDate}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== startDate) return ''
  return `${month}${year.slice(-2)}${cycle.replace(/^0+(?=\d)/, '').padStart(4, '0')}`
}

export function resolveCycleDisplayNumber(
  cycleNumber: string | number,
  startDate: string | null | undefined,
  doNotFormat = false,
): string {
  const cycle = String(cycleNumber).trim()
  return doNotFormat ? cycle : formatCycleMask(cycle, startDate) || cycle
}

export type BroilerCycleDisplayRow = {
  cycle_no?: string | number | null
  cycle_mask?: string | null
  doc_farm_cycles?: { cycle_mask: string | null } | { cycle_mask: string | null }[] | null
  extra?: Record<string, unknown> | null
}

/** Excluded buildings retain their snapshotted building display; regular buildings use Cycle Master. */
export function getBroilerCycleDisplay(row: BroilerCycleDisplayRow): string {
  if (row.extra?.cycleDisplaySource === 'building') {
    return row.extra.doNotFormatCycleNumber === true
      ? String(row.cycle_no ?? '').trim()
      : row.cycle_mask || String(row.cycle_no ?? '').trim()
  }
  const farmCycle = Array.isArray(row.doc_farm_cycles) ? row.doc_farm_cycles[0] : row.doc_farm_cycles
  return farmCycle?.cycle_mask || row.cycle_mask || ''
}
