import { NextResponse } from 'next/server'
import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import { getMonthlyFarmCompletionReportForAuthorizedUser } from '@/lib/data/repositories/monthlyFarmCompletion.server'
import {
  isMonthlyFarmCompletionFmsType,
  isMonthlyFarmCompletionModule,
  isMonthlyFarmCompletionRule,
  type MonthlyFarmCompletionParams,
} from '@/lib/data/repositories/monthlyFarmCompletion.shared'

export const runtime = 'nodejs'

function textFilter(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') ?? ''
    const [scheme, accessToken] = authorization.split(' ')
    if (scheme.toLowerCase() !== 'bearer' || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { data: authData, error: authError } = await admin_db.auth.getUser(accessToken)
    if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const year = Number(body.year)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Choose a valid report year.')
    if (!isMonthlyFarmCompletionFmsType(body.fmsType)) throw new Error('Choose a supported FMS Type.')
    if (!isMonthlyFarmCompletionModule(body.completionModule)) throw new Error('Choose a valid Completion Module.')
    if (!isMonthlyFarmCompletionRule(body.completionRule)) throw new Error('Choose a valid Completion Rule.')

    const params: MonthlyFarmCompletionParams = {
      fmsType: body.fmsType,
      year,
      completionModule: body.completionModule,
      completionRule: body.completionRule,
      island: textFilter(body.island),
      region: textFilter(body.region),
    }
    const data = await getMonthlyFarmCompletionReportForAuthorizedUser(authData.user.id, params)
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load the Monthly Farm Completion Report.'
    const forbidden = message === 'FORBIDDEN'
    return NextResponse.json(
      { error: forbidden ? 'You do not have permission to view the Monthly Farm Completion Report.' : message },
      { status: forbidden ? 403 : 400 },
    )
  }
}
