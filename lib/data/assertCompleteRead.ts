/** Prevent a capped PostgREST response from silently becoming a complete report. */
export function assertCompleteRead(result: { data: unknown[] | null; count?: number | null }, label: string) {
  if (result.count != null && result.count > (result.data?.length ?? 0)) {
    throw new Error(`${label} exceeded the database response limit. The report is incomplete; no KPI totals will be shown.`)
  }
}
