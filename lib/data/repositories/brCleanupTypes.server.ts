import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import { enqueueNotificationEventAfterCommit } from '@/lib/data/mutations/notifications.server'

const CLEANUP_TYPE_COLUMNS = 'id, code, name, is_void, created_at, updated_at, voided_at'

export type CleanupTypeMutationAction = 'create' | 'rename' | 'void' | 'unvoid'

function cleanName(value: unknown) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('CLEANUP_TYPE_NAME_REQUIRED')
  if (name.length > 80) throw new Error('CLEANUP_TYPE_NAME_TOO_LONG')
  return name
}

function mutationError(error: { code?: string } | null) {
  if (error?.code === '23505') return new Error('CLEANUP_TYPE_NAME_EXISTS')
  return error
}

export async function listCleanupTypesForSettings() {
  const { data, error } = await admin_db
    .from('br_cleanup_types')
    .select(CLEANUP_TYPE_COLUMNS)
    .order('id', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createCleanupTypeForAuthorizedUser(
  actorAuthId: string,
  nameValue: unknown,
  actionId: string,
) {
  const name = cleanName(nameValue)
  const { data, error } = await admin_db
    .from('br_cleanup_types')
    .insert({ name, created_by: actorAuthId })
    .select(CLEANUP_TYPE_COLUMNS)
    .single()

  if (error) throw mutationError(error)

  await enqueueCleanupTypeEvent(actorAuthId, data, 'create', actionId)
  return data
}

export async function renameCleanupTypeForAuthorizedUser(
  actorAuthId: string,
  id: number,
  nameValue: unknown,
  actionId: string,
) {
  const name = cleanName(nameValue)
  const { data, error } = await admin_db
    .from('br_cleanup_types')
    .update({ name, updated_by: actorAuthId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(CLEANUP_TYPE_COLUMNS)
    .maybeSingle()

  if (error) throw mutationError(error)
  if (!data) throw new Error('CLEANUP_TYPE_NOT_FOUND')

  await enqueueCleanupTypeEvent(actorAuthId, data, 'rename', actionId)
  return data
}

export async function setCleanupTypeVoidForAuthorizedUser(
  actorAuthId: string,
  id: number,
  isVoid: boolean,
  actionId: string,
) {
  const changedAt = new Date().toISOString()
  const { data, error } = await admin_db
    .from('br_cleanup_types')
    .update({
      is_void: isVoid,
      updated_by: actorAuthId,
      updated_at: changedAt,
      voided_by: isVoid ? actorAuthId : null,
      voided_at: isVoid ? changedAt : null,
    })
    .eq('id', id)
    .select(CLEANUP_TYPE_COLUMNS)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('CLEANUP_TYPE_NOT_FOUND')

  await enqueueCleanupTypeEvent(actorAuthId, data, isVoid ? 'void' : 'unvoid', actionId)
  return data
}

async function enqueueCleanupTypeEvent(
  actorAuthId: string,
  cleanupType: { id: number; code: string; name: string; is_void: boolean },
  action: CleanupTypeMutationAction,
  actionId: string,
) {
  const eventKey = action === 'create'
    ? 'BROILER_CLEANUP_TYPE_POSTED'
    : action === 'void'
      ? 'BROILER_CLEANUP_TYPE_VOIDED'
      : 'BROILER_CLEANUP_TYPE_EDITED'
  const actionLabel = action === 'create'
    ? 'created'
    : action === 'unvoid'
      ? 'restored'
      : action === 'rename'
        ? 'renamed'
        : 'voided'

  await enqueueNotificationEventAfterCommit({
    moduleKey: 'BROILER_CLEANUP_TYPE',
    eventKey,
    entityType: 'br_cleanup_types',
    entityId: cleanupType.id,
    documentNo: cleanupType.code,
    actorAuthId,
    targetUrl: '/brd/settings/general',
    permissionGroup: 'Settings',
    permissionTitle: 'General Settings/view',
    title: `Cleanup Type ${actionLabel}`,
    message: `Cleanup Type {document_no} was ${actionLabel} by {initiator_name}.`,
    dedupeKey: `${eventKey}:${cleanupType.id}:${actionId}`,
    metadata: { code: cleanupType.code, name: cleanupType.name, isVoid: cleanupType.is_void, action },
  })
}
