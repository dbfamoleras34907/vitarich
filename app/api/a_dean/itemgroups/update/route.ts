import { NextResponse } from 'next/server'

import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import { updateItemGroupForAuthorizedUser } from '@/lib/data/repositories/itemGroups.server'

export const runtime = 'nodejs'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error != null && 'message' in error) {
    const message = error.message
    if (typeof message === 'string' && message) return message
  }
  return 'Unable to update item group.'
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
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : ''

    if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid item group ID.')
    if (!actionId) throw new Error('Invalid action ID.')
    if (!code || !name) throw new Error('Code and name are required.')

    const data = await updateItemGroupForAuthorizedUser(authData.user.id, id, actionId, {
      code,
      name,
      remarks: remarks || null,
    })

    return NextResponse.json({ data })
  } catch (error) {
    const message = getErrorMessage(error)
    return NextResponse.json(
      { error: message === 'FORBIDDEN' ? 'You do not have permission to edit item groups.' : message },
      { status: message === 'FORBIDDEN' ? 403 : 400 },
    )
  }
}
