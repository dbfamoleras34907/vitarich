export function isWithinDateRange(
  value: string | null | undefined,
  dateFrom: string,
  dateTo: string,
) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const from = dateFrom
    ? new Date(`${dateFrom}T00:00:00`).getTime()
    : Number.NEGATIVE_INFINITY;
  const to = dateTo
    ? new Date(`${dateTo}T23:59:59.999`).getTime()
    : Number.POSITIVE_INFINITY;
  return timestamp >= from && timestamp <= to;
}
