import { admin_db } from '@/lib/Supabase/supabaseAdmin'
import { hasUserFmsType } from '@/lib/auth/fmsAccess'
import {
  HATCHERY_EXTRACT_MODULES,
  type HatcheryExtractData,
  type HatcheryExtractModuleData,
  type HatcheryExtractModuleKey,
  type HatcheryExtractRow,
} from './hatcheryExtract.shared'

const PAGE_SIZE = 1000
const IN_FILTER_SIZE = 150
const ACTOR_FIELDS = new Set(['created_by', 'updated_by', 'posted_by', 'approved_by', 'voided_by', 'modified_by'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type UserLabel = {
  id: number
  auth_id: string | null
  email: string | null
  firstname: string | null
  middlename: string | null
  lastname: string | null
}

type FarmLabel = { id: number; code: string | null; name: string | null }

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

async function requireHatcheryExtractAccess(authId: string) {
  const { data: profile, error: profileError } = await admin_db
    .from('users')
    .select('user_type, fms_type, fms_types, isactive')
    .eq('auth_id', authId)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile || String(profile.isactive ?? '').trim() !== '1') throw new Error('FORBIDDEN')
  if (Number(profile.user_type ?? 3) === 1) return
  if (!hasUserFmsType(profile.fms_types, 'Hatchery', profile.fms_type)) throw new Error('FORBIDDEN')

  const { data: permission, error: permissionError } = await admin_db
    .from('user_permissions')
    .select('is_visible')
    .eq('user_id', authId)
    .eq('ilink', '/a_dean/hatchery/extract-data/view')
    .eq('is_visible', true)
    .maybeSingle()

  if (permissionError) throw permissionError
  if (!permission?.is_visible) throw new Error('FORBIDDEN')
}

async function loadDateRangeRows(table: string, dateFrom: string, dateTo: string) {
  const rows: HatcheryExtractRow[] = []
  const inclusiveDateFrom = `${dateFrom}T00:00:00+08:00`
  const exclusiveDateTo = `${addDays(dateTo, 1)}T00:00:00+08:00`
  let offset = 0

  for (;;) {
    const { data, error, count } = await admin_db
      .from(table)
      .select('*', { count: 'exact' })
      .gte('created_at', inclusiveDateFrom)
      .lt('created_at', exclusiveDateTo)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw new Error(`${table}: ${error.message}`)
    const page = (data ?? []) as HatcheryExtractRow[]
    rows.push(...page)
    if (!page.length || (count != null && rows.length >= count)) break
    offset += page.length
  }

  return rows
}

async function loadLineRows(table: string, foreignKey: string, headerIds: number[]) {
  const rows: HatcheryExtractRow[] = []

  for (const ids of chunks(headerIds, IN_FILTER_SIZE)) {
    let offset = 0
    let batchRows = 0
    for (;;) {
      const { data, error, count } = await admin_db
        .from(table)
        .select('*', { count: 'exact' })
        .in(foreignKey, ids)
        .order(foreignKey, { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw new Error(`${table}: ${error.message}`)
      const page = (data ?? []) as HatcheryExtractRow[]
      rows.push(...page)
      batchRows += page.length
      if (!page.length || (count != null && batchRows >= count)) break
      offset += page.length
    }
  }

  return rows
}

function collectReferences(modules: HatcheryExtractModuleData[]) {
  const actorIds = new Set<string>()
  const userIds = new Set<number>()
  const farmIds = new Set<number>()

  for (const moduleData of modules) {
    for (const row of [...moduleData.headerRows, ...moduleData.lineRows]) {
      for (const [key, value] of Object.entries(row)) {
        if (value == null || value === '') continue
        if (ACTOR_FIELDS.has(key)) {
          if (Number.isFinite(Number(value))) userIds.add(Number(value))
          else if (UUID_PATTERN.test(String(value))) actorIds.add(String(value))
        }
        if ((key === 'users_id' || key.endsWith('_user_id')) && Number.isFinite(Number(value))) userIds.add(Number(value))
        if (key.endsWith('farm_id') && Number.isFinite(Number(value))) farmIds.add(Number(value))
        if (key === 'ta_id' && Number.isFinite(Number(value))) userIds.add(Number(value))
      }
    }
  }

  return { actorIds: [...actorIds], userIds: [...userIds], farmIds: [...farmIds] }
}

async function loadUsersByAuthIds(authIds: string[]) {
  const rows: UserLabel[] = []
  for (const ids of chunks(authIds, IN_FILTER_SIZE)) {
    const { data, error } = await admin_db.from('users').select('id, auth_id, email, firstname, middlename, lastname').in('auth_id', ids)
    if (error) throw error
    rows.push(...((data ?? []) as UserLabel[]))
  }
  return rows
}

async function loadUsersByIds(userIds: number[]) {
  const rows: UserLabel[] = []
  for (const ids of chunks(userIds, IN_FILTER_SIZE)) {
    const { data, error } = await admin_db.from('users').select('id, auth_id, email, firstname, middlename, lastname').in('id', ids)
    if (error) throw error
    rows.push(...((data ?? []) as UserLabel[]))
  }
  return rows
}

async function loadFarms(farmIds: number[]) {
  const rows: FarmLabel[] = []
  for (const ids of chunks(farmIds, IN_FILTER_SIZE)) {
    const { data, error } = await admin_db.from('farms').select('id, code, name').in('id', ids)
    if (error) throw error
    rows.push(...((data ?? []) as FarmLabel[]))
  }
  return rows
}

function userName(user: UserLabel) {
  return [user.firstname, user.middlename, user.lastname].map(value => value?.trim()).filter(Boolean).join(' ') || user.email || `User ${user.id}`
}

function appendUserLabels(target: HatcheryExtractRow, key: string, user: UserLabel | undefined) {
  if (!user) return
  target[`${key}_name`] = userName(user)
  target[`${key}_first_name`] = user.firstname
  target[`${key}_middle_name`] = user.middlename
  target[`${key}_last_name`] = user.lastname
  target[`${key}_email`] = user.email
}

function enrichRow(
  row: HatcheryExtractRow,
  usersByAuthId: Map<string, UserLabel>,
  usersById: Map<number, UserLabel>,
  farmsById: Map<number, FarmLabel>,
) {
  const result: HatcheryExtractRow = {}

  for (const [key, value] of Object.entries(row)) {
    result[key] = value

    if (ACTOR_FIELDS.has(key) && value != null) {
      appendUserLabels(result, key, usersByAuthId.get(String(value)) ?? usersById.get(Number(value)))
    }

    if ((key === 'users_id' || key.endsWith('_user_id')) && value != null) {
      appendUserLabels(result, key.replace(/_id$/, ''), usersById.get(Number(value)))
    }

    if (key.endsWith('farm_id') && value != null) {
      const farm = farmsById.get(Number(value))
      if (farm) {
        const prefix = key.slice(0, -3)
        result[`${prefix}_code`] = farm.code
        result[`${prefix}_name`] = farm.name
      }
    }

    if (key === 'ta_id' && value != null) {
      appendUserLabels(result, 'ta', usersById.get(Number(value)))
    }
  }

  return result
}

export async function getHatcheryExtractDataForAuthorizedUser(params: {
  authId: string
  dateFrom: string
  dateTo: string
  moduleKeys: HatcheryExtractModuleKey[]
}): Promise<HatcheryExtractData> {
  await requireHatcheryExtractAccess(params.authId)

  const selected = HATCHERY_EXTRACT_MODULES.filter(config => params.moduleKeys.includes(config.key))
  const modules = await Promise.all(selected.map(async config => {
    const lineTable = 'lineTable' in config ? config.lineTable : undefined
    const lineForeignKey = 'lineForeignKey' in config ? config.lineForeignKey : undefined
    const headerRows = await loadDateRangeRows(config.headerTable, params.dateFrom, params.dateTo)
    const headerIds = headerRows.map(row => Number(row.id)).filter(Number.isFinite)
    const lineRows = lineTable && lineForeignKey && headerIds.length
      ? await loadLineRows(lineTable, lineForeignKey, headerIds)
      : []

    return {
      key: config.key,
      label: config.label,
      headerTable: config.headerTable,
      lineTable,
      headerRows,
      lineRows,
    }
  }))

  const warnings: string[] = []
  const references = collectReferences(modules)
  let usersByAuthId = new Map<string, UserLabel>()
  let usersById = new Map<number, UserLabel>()
  let farmsById = new Map<number, FarmLabel>()

  try {
    const [authUsers, numericUsers] = await Promise.all([
      references.actorIds.length ? loadUsersByAuthIds(references.actorIds) : [],
      references.userIds.length ? loadUsersByIds(references.userIds) : [],
    ])
    const allUsers = [...authUsers, ...numericUsers]
    usersByAuthId = new Map(allUsers.filter(row => row.auth_id).map(row => [String(row.auth_id), row]))
    usersById = new Map(allUsers.map(row => [row.id, row]))
  } catch (error) {
    warnings.push(`User labels were not fully available: ${error instanceof Error ? error.message : 'query failed'}`)
  }

  try {
    const farms = references.farmIds.length ? await loadFarms(references.farmIds) : []
    farmsById = new Map(farms.map(row => [row.id, row]))
  } catch (error) {
    warnings.push(`Farm labels were not fully available: ${error instanceof Error ? error.message : 'query failed'}`)
  }

  return {
    warnings,
    modules: modules.map(moduleData => ({
      ...moduleData,
      headerRows: moduleData.headerRows.map(row => enrichRow(row, usersByAuthId, usersById, farmsById)),
      lineRows: moduleData.lineRows.map(row => enrichRow(row, usersByAuthId, usersById, farmsById)),
    })),
  }
}
