import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import { enqueueNotificationEventAfterCommit } from '@/lib/data/mutations/notifications.server'

type ItemGroupUpdatePayload = {
  code: string
  name: string
  remarks: string | null
}

type ItemGroupInsertPayload = Pick<ItemGroupUpdatePayload, 'name' | 'remarks'>

type SavedItemGroupChild = {
  id: number
  code: string
  name: string
  remarks: string | null
  void: string
  father: number
  root_item_group_id: number
  subgroup_level: number
  created_at: string
  updated_at: string | null
  was_created: boolean
}

async function requireItemGroupAccess(
  authId: string,
  action: 'edit' | 'insert' | 'void',
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
  actionId: string,
  payload: ItemGroupUpdatePayload,
) {
  await requireItemGroupAccess(authId, 'edit')

  const { data: previous, error: previousError } = await admin_db
    .from('item_groups')
    .select('id, code, name, remarks, void, father')
    .eq('id', id)
    .maybeSingle()

  if (previousError) throw previousError
  if (!previous) throw new Error('The sub item group was not found.')

  const { data, error } = await admin_db
    .from('item_groups')
    .update(payload)
    .eq('id', id)
    .select('id, code, name, remarks, void, father, created_at, updated_at')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('The sub item group was not found.')

  const changedFields = (['code', 'name', 'remarks'] as const).filter(field =>
    (previous[field] ?? null) !== (data[field] ?? null),
  )
  if (changedFields.length > 0) {
    await enqueueNotificationEventAfterCommit({
      moduleKey: 'ITEM_GROUP',
      eventKey: 'ITEM_GROUP_EDITED',
      entityType: 'item_groups',
      entityId: data.id,
      documentNo: data.code,
      actorAuthId: authId,
      targetUrl: `/a_dean/itemgroups/edit/${data.id}`,
      permissionGroup: 'Menus',
      permissionTitle: 'Item Group/view',
      title: 'Item Group edited',
      message: 'Item Group {document_no} was edited by {initiator_name}.',
      dedupeKey: `ITEM_GROUP_EDITED:${data.id}:${actionId}`,
      metadata: { code: data.code, name: data.name, father: data.father, changedFields },
    }).catch(error => console.error('Unable to enqueue Item Group edit event:', error))
  }

  return data
}

export async function addSubItemGroupForAuthorizedUser(
  authId: string,
  rootItemGroupId: number,
  subgroupLevel: number,
  actionId: string,
  payload: ItemGroupInsertPayload,
) {
  await requireItemGroupAccess(authId, 'insert')

  const { data: savedRows, error } = await admin_db.rpc('save_item_group_catalog_entry', {
    p_root_item_group_id: rootItemGroupId,
    p_subgroup_level: subgroupLevel,
    p_name: payload.name,
    p_remarks: payload.remarks,
  })

  if (error) throw error
  const data = (Array.isArray(savedRows) ? savedRows[0] : savedRows) as SavedItemGroupChild | null
  if (!data?.id) throw new Error('Unable to save the sub item group relationship.')

  if (data.was_created) await enqueueNotificationEventAfterCommit({
    moduleKey: 'ITEM_GROUP',
    eventKey: 'ITEM_GROUP_POSTED',
    entityType: 'item_groups',
    entityId: data.id,
    documentNo: data.code,
    actorAuthId: authId,
    targetUrl: `/a_dean/itemgroups/edit/${data.id}`,
    permissionGroup: 'Menus',
    permissionTitle: 'Item Group/view',
    title: 'Item Group posted',
    message: 'Item Group {document_no} was posted by {initiator_name}.',
    dedupeKey: `ITEM_GROUP_POSTED:${data.id}`,
    metadata: {
      code: data.code,
      name: data.name,
      father: data.father,
      rootItemGroupId: data.root_item_group_id,
      subgroupLevel: data.subgroup_level,
      actionId,
    },
  }).catch(error => console.error('Unable to enqueue Item Group save event:', error))

  return data
}

export async function voidItemGroupForAuthorizedUser(authId: string, id: number, actionId: string) {
  await requireItemGroupAccess(authId, 'void')

  const { data: target, error: targetError } = await admin_db
    .from('item_groups')
    .select('id, code, name, remarks, void, father, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (targetError) throw targetError
  if (!target) throw new Error('The item group was not found.')
  if (String(target.void).trim() !== '1') return target

  const { count: itemCount, error: itemError } = await admin_db
    .from('items')
    .select('id', { count: 'exact', head: true })
    .or(`sub_item_group_level_1_id.eq.${id},sub_item_group_level_2_id.eq.${id},sub_item_group_level_3_id.eq.${id}`)
    .eq('void', '1')

  if (itemError) throw itemError
  if ((itemCount ?? 0) > 0) throw new Error('Move or void the active items assigned to this group first.')

  const { data, error } = await admin_db
    .from('item_groups')
    .update({ void: '0' })
    .eq('id', id)
    .select('id, code, name, remarks, void, father, created_at, updated_at')
    .single()

  if (error) throw error
  if (String(data.void).trim() === '1') throw new Error('The item group was not voided.')
  const result = data

  await enqueueNotificationEventAfterCommit({
    moduleKey: 'ITEM_GROUP',
    eventKey: 'ITEM_GROUP_VOIDED',
    entityType: 'item_groups',
    entityId: result.id,
    documentNo: result.code,
    actorAuthId: authId,
    targetUrl: '/a_dean/itemgroups',
    permissionGroup: 'Menus',
    permissionTitle: 'Item Group/view',
    title: 'Item Group voided',
    message: 'Item Group {document_no} was voided by {initiator_name}.',
    dedupeKey: `ITEM_GROUP_VOIDED:${result.id}`,
    metadata: { code: result.code, name: result.name, father: result.father, actionId },
  }).catch(error => console.error('Unable to enqueue Item Group void event:', error))

  return result
}
