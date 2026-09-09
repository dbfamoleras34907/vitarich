import { NextResponse } from 'next/server'

import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import { voidFarmForAuthorizedUser } from '@/lib/data/repositories/farms.server'

export const runtime = 'nodejs'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error != null && 'message' in error) {
    const message = error.message
    if (typeof message === 'string' && message) return message
  }
  return 'Unable to void farm.'
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

    const body = await request.json() as { id?: unknown }
    const farmId = Number(body.id)
    if (!Number.isInteger(farmId) || farmId <= 0) throw new Error('Invalid farm ID.')

    const data = await voidFarmForAuthorizedUser(authData.user.id, farmId)
    return NextResponse.json({ data })
  } catch (error) {
    const message = getErrorMessage(error)
    const forbidden = message.includes('permission to void farms') || message === 'FORBIDDEN'
    return NextResponse.json(
      { error: forbidden ? 'You do not have permission to void farms.' : message },
      { status: forbidden ? 403 : 400 },
    )
  }
}
