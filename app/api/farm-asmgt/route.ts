import { NextResponse } from 'next/server'
import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import { saveFarmAssignmentsForAuthorizedUser } from '@/lib/data/repositories/farmAssignments.server'

export const runtime = 'nodejs'

const errorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (typeof error === 'string' && error.trim()) return error
  return 'Unable to save farm assignments.'
}

export async function POST(request: Request) {
  try {
    const [scheme, accessToken] = (request.headers.get('authorization') ?? '').split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    const { data: authData, error: authError } = await admin_db.auth.getUser(accessToken)
    if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const body = await request.json() as { farmId?: unknown; userIds?: unknown }
    const farmId = Number(body.farmId)
    if (!Number.isSafeInteger(farmId) || farmId <= 0) throw new Error('Invalid farm ID.')
    if (!Array.isArray(body.userIds)) throw new Error('Assigned users must be a list.')
    const requestedIds = body.userIds.map(Number)
    const userIds = await saveFarmAssignmentsForAuthorizedUser(authData.user.id, farmId, requestedIds)
    return NextResponse.json({ userIds })
  } catch (error) {
    const message = errorMessage(error)
    const forbidden = message === 'FORBIDDEN'
    return NextResponse.json(
      { error: forbidden ? 'You do not have permission to edit farm assignments.' : message },
      { status: forbidden ? 403 : 400 },
    )
  }
}
