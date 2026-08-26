import { admin_db } from '@/lib/Supabase/supabaseAdmin'

type ItemGroupUpdatePayload = {
  code: string
  name: string
  remarks: string | null
}

type ItemGroupInsertPayload = Pick<ItemGroupUpdatePayload, 'name' | 'remarks'>

async function requireItemGroupAccess(
  authId: string,
  action: 'edit' | 'insert',
) {
  const { data: profile, error: profileError } = await admin_db
    .from('users')
    .select('user_type, isactive')
    .eq('auth_id', authId)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile || (profile.isactive != null && String(profile.isactive).trim() !== '1')) {
    throw new Error('FORBIDDEN')
  }

  if (Number(profile.user_type ?? 3) !== 1) {
    const { data: permission, error: permissionError } = await admin_db
      .from('user_permissions')
      .select('is_visible')
      .eq('user_id', authId)
      .eq('ilink', `/a_dean/itemgroups/${action}`)
      .eq('is_visible', true)
      .maybeSingle()

    if (permissionError) throw permissionError
    if (!permission?.is_visible) throw new Error('FORBIDDEN')
  }
}

export async function updateItemGroupForAuthorizedUser(
  authId: string,
  id: number,
  payload: ItemGroupUpdatePayload,
) {
  await requireItemGroupAccess(authId, 'edit')

  const { data, error } = await admin_db
    .from('item_groups')
    .update(payload)
    .eq('id', id)
    .select('id, code, name, remarks, void, father, created_at, updated_at')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('The sub item group was not found.')

  return data
}

export async function addSubItemGroupForAuthorizedUser(
  authId: string,
  fatherId: number,
  payload: ItemGroupInsertPayload,
) {
  await requireItemGroupAccess(authId, 'insert')

  const temporaryCode = `PENDING-${crypto.randomUUID()}`
  const { data: inserted, error: insertError } = await admin_db
    .from('item_groups')
    .insert({
      code: temporaryCode,
      name: payload.name,
      remarks: payload.remarks,
      father: fatherId,
      void: '1',
    })
    .select('id')
    .single()

  if (insertError) throw insertError

  const { data, error } = await admin_db
    .from('item_groups')
    .update({ code: String(inserted.id) })
    .eq('id', inserted.id)
    .select('id, code, name, remarks, void, father, created_at, updated_at')
    .single()

  if (error) throw error
  return data
}
