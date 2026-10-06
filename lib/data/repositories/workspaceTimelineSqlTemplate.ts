import { addDays, format, parseISO } from 'date-fns'
import type { TimelineSqlWeek } from './workspaceTimelineSqlPeriod'

export function renderTimelineSqlTemplate(template: string, week: TimelineSqlWeek): string {
  if (week.start === '2026-08-31') return template

  // Replace dates in a single pass so overlapping source/target weeks cannot cascade.
  const sourceDates = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']
  const dates = new Map(sourceDates.map((date, index) => [date, format(addDays(parseISO(week.start), index), 'yyyy-MM-dd')]))
  const sql = template.replace(/2026-08-31|2026-09-0[1-4]/g, date => dates.get(date)!)
  const bodyStart = sql.indexOf('create temporary table task_timeline_config')
  if (bodyStart < 0) throw new Error('INVALID_TEMPLATE')
  return `begin;

-- Task and Timeline template for ${week.start} through ${week.end}.
-- Reuses six ticket descriptions from the August 31-September 4, 2026 template.
-- These descriptions are not verified Git activity for the selected week.
-- Review task descriptions and work dates before executing this script.
-- Work schedule: 08:00-12:00 (4 hours), 13:00-18:00 (5 hours).
-- Total: 9 hours per day, 45 hours for five workdays; estimated allocations.

${sql.slice(bodyStart)}`
}
