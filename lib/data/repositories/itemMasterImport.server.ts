import { admin_db } from '@/lib/Supabase/supabaseAdmin'

type ItemMasterImportRow = {
  rowNumber: number
  payload: Record<string, unknown>
}

async function requireItemMasterInsertAccess(authId: string) {
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
      .eq('ilink', '/a_dean/items/insert')
      .eq('is_visible', true)
      .maybeSingle()

    if (permissionError) throw permissionError
    if (!permission?.is_visible) throw new Error('FORBIDDEN')
  }
}

export async function importItemMasterRowsForAuthorizedUser(
  authId: string,
  rows: ItemMasterImportRow[],
  skipExisting: boolean,
) {
  await requireItemMasterInsertAccess(authId)

  const { data, error } = await admin_db.rpc('import_item_master_items', {
    p_rows: rows,
    p_actor_auth_id: authId,
    p_skip_existing: skipExisting,
  })

  if (error) throw error
  const result = data as { importedCount?: unknown; skippedCount?: unknown } | null
  const importedCount = Number(result?.importedCount)
  const skippedCount = Number(result?.skippedCount)
  if (
    !Number.isInteger(importedCount) ||
    !Number.isInteger(skippedCount) ||
    importedCount + skippedCount !== rows.length
  ) {
    throw new Error('The Item Master import did not save the complete batch.')
  }

  return { importedCount, skippedCount }
}
