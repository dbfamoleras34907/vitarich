import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getNotificationActorByToken } from '@/lib/data/repositories/notifications.server'
import { resolveTimelineSqlWeek } from './workspaceTimelineSqlPeriod'
import { renderTimelineSqlTemplate } from './workspaceTimelineSqlTemplate'

const passwordDigest = Buffer.from(
  '3bc2ef31e69281a46cff57f32040b0166b916c1c803ab0d3df1c6169bfdb7ecd',
  'hex',
)

export async function getWorkspaceTimelineSql(accessToken: string, password: unknown, month: unknown, weekStart: unknown) {
  // Reuse the existing token validation and active-user lookup.
  const actor = await getNotificationActorByToken(accessToken)
  if (!actor) throw new Error('UNAUTHENTICATED')

  if (typeof password !== 'string' || password.length > 256 || !timingSafeEqual(
    createHash('sha256').update(password).digest(),
    passwordDigest,
  )) {
    throw new Error('INVALID_PASSWORD')
  }

  const week = resolveTimelineSqlWeek(month, weekStart)
  const template = await readFile(path.join(process.cwd(), 'app', 'wks', 'task_timeline_2026-08-31_to_2026-09-04.sql'), 'utf8')
  return {
    filename: `task_timeline_${week.start}_to_${week.end}.sql`,
    sql: renderTimelineSqlTemplate(template, week),
  }
}
