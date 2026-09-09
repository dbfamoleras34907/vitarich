import { admin_db } from '@/lib/Supabase/supabaseAdmin'

export async function voidFarmForAuthorizedUser(authId: string, farmId: number) {
  const { data, error } = await admin_db.rpc('void_farm', {
    p_farm_id: farmId,
    p_actor_auth_id: authId,
  })

  if (error) throw error
  if (!data) throw new Error('The farm was not found.')
  return data
}
