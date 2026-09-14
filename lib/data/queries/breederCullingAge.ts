/** Elapsed calendar days; placement day is day zero. Never invent a missing age. */
export function cullingAge(placementDate?: string | null, cullingDate?: string | null): number | null {
  if (!placementDate || !cullingDate) return null;
  const dates = [placementDate, cullingDate].map(value => {
    const date = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Number.NaN;
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date ? timestamp : Number.NaN;
  });
  const days = (dates[1] - dates[0]) / 86_400_000;
  return Number.isInteger(days) && days >= 0 ? days : null;
}
