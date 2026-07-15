import { db } from '@/lib/Supabase/supabaseClient'

export type UsersGroup = {
  id?: number
  code: string
  group_name: string
  void?: string
  created_at?: string
}

export type UsersGroupInput = {
  group_name: string
}

const CODE_PREFIX = 'UG-'
const CODE_PAD_LENGTH = 6
const MAX_INSERT_ATTEMPTS = 3

function formatUserGroupCode(nextNumber: number) {
  return `${CODE_PREFIX}${String(nextNumber).padStart(CODE_PAD_LENGTH, '0')}`
}

function nextCodeFromRows(rows: Pick<UsersGroup, 'code'>[]) {
  const maxNumber = rows.reduce((currentMax, row) => {
    const match = String(row.code || '').match(/^UG-(\d{6})$/)
    if (!match) return currentMax
    return Math.max(currentMax, Number(match[1]))
  }, 0)

  return formatUserGroupCode(maxNumber + 1)
}

function isDuplicateCodeError(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === '23505'
  )
}

export async function getUsersGroups() {
  const { data, error } = await db
    .from('users_group')
    .select('*')
    .eq('void', '1')
    .order('code', { ascending: true })

  if (error) throw error
  return (data || []) as UsersGroup[]
}

async function getNextUsersGroupCode() {
  const { data, error } = await db
    .from('users_group')
    .select('code')
    .like('code', `${CODE_PREFIX}%`)
    .order('code', { ascending: false })
    .limit(1)

  if (error) throw error
  return nextCodeFromRows((data || []) as Pick<UsersGroup, 'code'>[])
}

export async function addUsersGroup(payload: UsersGroupInput) {
  const { data: authData } = await db.auth.getUser()
  let lastError: unknown = null

  for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt += 1) {
    const code = await getNextUsersGroupCode()
    const { data, error } = await db
      .from('users_group')
      .insert({
        code,
        group_name: payload.group_name.trim(),
        created_by: authData.user?.id || null,
        void: '1',
      })
      .select()
      .single()

    if (!error) return data as UsersGroup

    lastError = error
    if (!isDuplicateCodeError(error)) throw error
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unable to create user group after 3 code attempts.')
}

export async function getUsersGroupById(id: number) {
  const { data, error } = await db
    .from('users_group')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as UsersGroup
}

export async function updateUsersGroup(id: number, payload: UsersGroupInput) {
  const { data: authData } = await db.auth.getUser()
  const { data, error } = await db
    .from('users_group')
    .update({
      group_name: payload.group_name.trim(),
      updated_by: authData.user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as UsersGroup
}
