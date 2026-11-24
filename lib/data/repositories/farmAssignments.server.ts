import { admin_db } from '@/lib/Supabase/supabaseAdmin'

const isActiveUser = (value: unknown) => ['1', 'true', 'active'].includes(String(value ?? '').trim().toLowerCase())

async function requireFarmAssignmentEdit(authId: string) {
  const { data: profile, error: profileError } = await admin_db
    .from('users')
    .select('user_type, isactive')
    .eq('auth_id', authId)
    .maybeSingle()
  if (profileError) throw profileError
  if (!profile || !isActiveUser(profile.isactive)) throw new Error('FORBIDDEN')
  if (Number(profile.user_type) === 1) return

  const { data: permission, error: permissionError } = await admin_db
    .from('user_permissions')
    .select('is_visible')
    .eq('user_id', authId)
    .eq('ilink', '/farm-asmgt/edit')
    .eq('is_visible', true)
    .maybeSingle()
  if (permissionError) throw permissionError
  if (!permission?.is_visible) throw new Error('FORBIDDEN')
}

export async function saveFarmAssignmentsForAuthorizedUser(
  authId: string,
  farmId: number,
  requestedUserIds: number[],
) {
  await requireFarmAssignmentEdit(authId)

  const userIds = [...new Set(requestedUserIds)]
    .filter(id => Number.isSafeInteger(id) && id > 0)
    .sort((a, b) => a - b)
  if (userIds.length !== requestedUserIds.length) throw new Error('One or more assigned users are invalid.')

  const { data: farm, error: farmError } = await admin_db
    .from('farms')
    .select('id, code, void, approval_status')
    .eq('id', farmId)
    .maybeSingle()
  if (farmError) throw farmError
  if (!farm || Number(farm.void) !== 1 || String(farm.approval_status ?? 'approved') !== 'approved') {
    throw new Error('The farm was not found or is no longer active.')
  }

  const { error } = await admin_db.rpc('sync_farm_user_assignments', {
    p_farm_id: farmId,
    p_farm_code: String(farm.code),
    p_user_ids: userIds,
  })
  if (error) throw error
  return userIds
}
