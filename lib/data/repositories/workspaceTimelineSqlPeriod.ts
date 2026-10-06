import { addDays, format, startOfWeek } from 'date-fns'

export type TimelineSqlWeek = { start: string; end: string; label: string }

/** Full Monday-Friday workweeks with at least one workday in the month. */
export function getTimelineSqlWeeks(month: string): TimelineSqlWeek[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return []
  const year = Number(month.slice(0, 4))
  if (year < 1900 || year > 9999) return []
  const first = new Date(year, Number(month.slice(5)) - 1, 1)
  const nextMonth = new Date(year, Number(month.slice(5)), 1)
  const weeks: TimelineSqlWeek[] = []
  for (let monday = startOfWeek(first, { weekStartsOn: 1 }); monday < nextMonth; monday = addDays(monday, 7)) {
    const friday = addDays(monday, 4)
    if (friday < first) continue
    weeks.push({
      start: format(monday, 'yyyy-MM-dd'),
      end: format(friday, 'yyyy-MM-dd'),
      label: `Week ${weeks.length + 1}: ${format(monday, 'MMM d')} – ${format(friday, 'MMM d, yyyy')}`,
    })
  }
  return weeks
}

export function getDefaultTimelineSqlPeriod() {
  const monday = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), -7)
  return { month: format(addDays(monday, 4), 'yyyy-MM'), weekStart: format(monday, 'yyyy-MM-dd') }
}

export function resolveTimelineSqlWeek(month: unknown, weekStart: unknown): TimelineSqlWeek {
  const week = typeof month === 'string' && typeof weekStart === 'string'
    ? getTimelineSqlWeeks(month).find(candidate => candidate.start === weekStart)
    : undefined
  if (!week) throw new Error('INVALID_PERIOD')
  return week
}
