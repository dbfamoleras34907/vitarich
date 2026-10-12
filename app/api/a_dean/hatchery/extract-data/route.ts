import { NextResponse } from 'next/server'

import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import { getHatcheryExtractDataForAuthorizedUser } from '@/lib/data/repositories/hatcheryExtract.server'
import { isHatcheryExtractModuleKey } from '@/lib/data/repositories/hatcheryExtract.shared'

export const runtime = 'nodejs'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'Unable to extract Hatchery data.'
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') ?? ''
    const [scheme, accessToken] = authorization.split(' ')
    if (scheme.toLowerCase() !== 'bearer' || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { data: authData, error: authError } = await admin_db.auth.getUser(accessToken)
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await request.json() as { dateFrom?: unknown; dateTo?: unknown; moduleKeys?: unknown }
    const dateFrom = typeof body.dateFrom === 'string' ? body.dateFrom : ''
    const dateTo = typeof body.dateTo === 'string' ? body.dateTo : ''
    if (!ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo) || dateFrom > dateTo) {
      throw new Error('Enter a valid From Date and To Date range.')
    }
    if (!Array.isArray(body.moduleKeys) || !body.moduleKeys.length || !body.moduleKeys.every(isHatcheryExtractModuleKey)) {
      throw new Error('Select at least one valid Hatchery module.')
    }

    const data = await getHatcheryExtractDataForAuthorizedUser({
      authId: authData.user.id,
      dateFrom,
      dateTo,
      moduleKeys: [...new Set(body.moduleKeys)],
    })
    return NextResponse.json(data)
  } catch (error) {
    const message = errorMessage(error)
    return NextResponse.json(
      { error: message === 'FORBIDDEN' ? 'You do not have permission to extract Hatchery data.' : message },
      { status: message === 'FORBIDDEN' ? 403 : 400 },
    )
  }
}
