const MS_PER_DAY = 24 * 60 * 60 * 1000;

function localDateFromInput(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calculateFlockAgeFromStartDate(startDate: string, today = new Date()) {
  const flockStartDate = localDateFromInput(startDate);
  if (!flockStartDate) return 0;

  const days = Math.floor(
    (startOfLocalDay(today).getTime() - flockStartDate.getTime()) / MS_PER_DAY,
  );

  return Math.min(Math.max(days, 0), 45);
}
