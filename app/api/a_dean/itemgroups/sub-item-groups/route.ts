import { NextResponse } from 'next/server'

import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import { addSubItemGroupForAuthorizedUser } from '@/lib/data/repositories/itemGroups.server'

export const runtime = 'nodejs'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error != null && 'message' in error) {
    const message = error.message
    if (typeof message === 'string' && message) return message
  }
  return 'Unable to add sub item group.'
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
    const rootItemGroupId = Number(body.rootItemGroupId)
    const subgroupLevel = Number(body.subgroupLevel)
    const actionId = typeof body.actionId === 'string' ? body.actionId.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : ''

    if (!Number.isInteger(rootItemGroupId) || rootItemGroupId <= 0) throw new Error('Invalid item group ID.')
    if (!Number.isInteger(subgroupLevel) || subgroupLevel < 1 || subgroupLevel > 3) {
      throw new Error('Sub Group Level must be 1, 2, or 3.')
    }
    if (!actionId) throw new Error('Invalid action ID.')
    if (!name) throw new Error('Name is required.')

    const data = await addSubItemGroupForAuthorizedUser(authData.user.id, rootItemGroupId, subgroupLevel, actionId, {
      name,
      remarks: remarks || null,
    })

    return NextResponse.json({ data })
  } catch (error) {
    const message = getErrorMessage(error)
    return NextResponse.json(
      { error: message === 'FORBIDDEN' ? 'You do not have permission to add sub item groups.' : message },
      { status: message === 'FORBIDDEN' ? 403 : 400 },
    )
  }
}
