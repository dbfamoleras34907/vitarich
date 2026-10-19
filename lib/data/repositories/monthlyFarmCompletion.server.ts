import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import type { MonthlyFarmCompletionParams, MonthlyFarmCompletionReport } from './monthlyFarmCompletion.shared'

const REPORT_PERMISSION = '/report/monthly-farm-completion/view'

async function requireMonthlyFarmCompletionAccess(authId: string) {
  const { data: profile, error: profileError } = await admin_db
    .from('users')
    .select('user_type, fms_type, isactive')
    .eq('auth_id', authId)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile || String(profile.isactive ?? '').trim() !== '1') throw new Error('FORBIDDEN')
  if (Number(profile.user_type ?? 3) === 1) return
  if (String(profile.fms_type ?? '').trim().toLowerCase() !== 'hatchery') throw new Error('FORBIDDEN')

  const { data: permission, error: permissionError } = await admin_db
    .from('user_permissions')
    .select('is_visible')
    .eq('user_id', authId)
    .eq('ilink', REPORT_PERMISSION)
    .eq('is_visible', true)
    .maybeSingle()

  if (permissionError) throw permissionError
  if (!permission?.is_visible) throw new Error('FORBIDDEN')
}

export async function getMonthlyFarmCompletionReportForAuthorizedUser(
  authId: string,
  params: MonthlyFarmCompletionParams,
): Promise<MonthlyFarmCompletionReport> {
  await requireMonthlyFarmCompletionAccess(authId)

  const { data, error } = await admin_db.rpc('get_monthly_farm_completion_report', {
    p_fms_type: params.fmsType,
    p_year: params.year,
    p_completion_module: params.completionModule,
    p_completion_rule: params.completionRule,
    p_island: params.island?.trim() || null,
    p_region: params.region?.trim() || null,
  })

  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('Monthly Farm Completion Report requires its Supabase SQL deployment.')
    }
    throw new Error([error.message, error.details, error.hint, error.code ? `Code: ${error.code}` : null].filter(Boolean).join(' '))
  }

  return data as MonthlyFarmCompletionReport
}
