import { NextResponse } from 'next/server'

import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import { importItemMasterRowsForAuthorizedUser } from '@/lib/data/repositories/itemMasterImport.server'

export const runtime = 'nodejs'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error != null && 'message' in error) {
    const message = error.message
    if (typeof message === 'string' && message) return message
  }
  return 'The Item Master import could not be completed.'
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
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      throw new Error('The import does not contain any item rows.')
    }
    if (body.rows.length > 5000) {
      throw new Error('A single Item Master import is limited to 5,000 rows.')
    }

    const rows = body.rows.map((row: unknown) => {
      if (typeof row !== 'object' || row == null) throw new Error('The import contains an invalid row.')
      const candidate = row as { rowNumber?: unknown; payload?: unknown }
      const rowNumber = Number(candidate.rowNumber)
      if (!Number.isInteger(rowNumber) || rowNumber < 2 || typeof candidate.payload !== 'object' || candidate.payload == null) {
        throw new Error('The import contains an invalid row.')
      }
      return { rowNumber, payload: candidate.payload as Record<string, unknown> }
    })

    const skipExisting = body.skipExisting === true
    const result = await importItemMasterRowsForAuthorizedUser(authData.user.id, rows, skipExisting)
    return NextResponse.json(result)
  } catch (error) {
    const message = getErrorMessage(error)
    return NextResponse.json(
      { error: message === 'FORBIDDEN' ? 'You do not have permission to import Item Master records.' : message },
      { status: message === 'FORBIDDEN' ? 403 : 400 },
    )
  }
}
