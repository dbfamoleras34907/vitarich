// Population Record treats placement day as age 0.1 (day one).
export function breederAgeDays(placementDate: string | undefined, recordDate: string): number | null {
  const calendarDay = (value: string | undefined) => {
    const date = value?.slice(0, 10) ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Number.NaN;
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
      ? timestamp : Number.NaN;
  };
  const days = (calendarDay(recordDate) - calendarDay(placementDate)) / 86_400_000 + 1;
  return Number.isInteger(days) && days >= 1 ? days : null;
}
