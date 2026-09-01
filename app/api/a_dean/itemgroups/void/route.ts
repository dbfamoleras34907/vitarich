import { NextResponse } from 'next/server'

import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import { voidItemGroupForAuthorizedUser } from '@/lib/data/repositories/itemGroups.server'

export const runtime = 'nodejs'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error != null && 'message' in error) {
    const message = error.message
    if (typeof message === 'string' && message) return message
  }
  return 'Unable to void item group.'
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') ?? ''
    const [scheme, accessToken] = authorization.split(' ')
    if (scheme.toLowerCase() !== 'bearer' || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { data: authData, error: authError } = await admin_db.auth.getUser(accessToken)
    if (authError) throw authError
    if (!authData.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const body = await request.json()
    const id = Number(body.id)
    const actionId = typeof body.actionId === 'string' ? body.actionId.trim() : ''
    if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid item group ID.')
    if (!actionId) throw new Error('Invalid action ID.')

    const data = await voidItemGroupForAuthorizedUser(authData.user.id, id, actionId)
    return NextResponse.json({ data })
  } catch (error) {
    const message = getErrorMessage(error)
    return NextResponse.json(
      { error: message === 'FORBIDDEN' ? 'You do not have permission to void item groups.' : message },
      { status: message === 'FORBIDDEN' ? 403 : 400 },
    )
  }
}
