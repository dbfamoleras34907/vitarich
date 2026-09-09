// app/a_dean/items/api.ts
import { db } from '@/lib/Supabase/supabaseClient'

export type ItemInsert = {
  item_code?: string
  item_name?: string
  description?: string
  barcode?: string
  unit_measure?: string
  inventory_uom?: string
  item_group?: string
  sub_item_group_id?: number | null
  sub_item_group_level_1_id?: number | null
  sub_item_group_level_2_id?: number | null
  sub_item_group_level_3_id?: number | null
  fms_group?: string
  group?: string
  is_inventory_item?: boolean
  is_sales_item?: boolean
  is_purchase_item?: boolean
  is_delivery_item?: boolean
  manage_batch_numbers?: boolean
  manage_serial_numbers?: boolean
  batch_management_method?: string
  default_shelf_life_days?: number | null
  default_expiration_months?: number | null
  default_expiry_required?: boolean
  allow_negative_batch_stock?: boolean
  batch_number_series?: string | null
  min_on_hand?: number | null
  max_on_hand?: number | null
}

export type ItemUomGroup = {
  id: number
  code: string
  name: string
  baseUomCode: string
}

export type ItemRow = Required<Pick<ItemInsert, 'item_code'>> & {
  id: number
  item_name: string | null
  description: string | null
  barcode: string | null
  unit_measure: string | null
  inventory_uom: string | null
  item_group: string | null
  sub_item_group_id: number | null
  sub_item_group_level_1_id: number | null
  sub_item_group_level_2_id: number | null
  sub_item_group_level_3_id: number | null
  fms_group: string | null
  group: string | null
  is_inventory_item: boolean
  is_sales_item: boolean
  is_purchase_item: boolean
  is_delivery_item: boolean | null
  manage_batch_numbers: boolean
  manage_serial_numbers: boolean
  batch_management_method: string | null
  default_shelf_life_days: number | null
  default_expiration_months: number | null
  default_expiry_required: boolean
  allow_negative_batch_stock: boolean
  batch_number_series: string | null
  min_on_hand: number | null
  max_on_hand: number | null
}

type UomGroupRecord = {
  id: number
  code: string
  name: string
  base_uom: { code: string } | { code: string }[] | null
}

const singleRelation = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] || null : value

const isUniqueViolation = (error: { code?: string; message?: string } | null) =>
  error?.code === '23505' ||
  Boolean(error?.message?.toLowerCase().includes('duplicate'))

const normalizeItemGroupCode = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

async function createItemCode(itemGroupCode?: string | null, offset = 0) {
  const prefix = normalizeItemGroupCode(itemGroupCode)
  if (!prefix) throw new Error('Item group is required before item code can be generated.')

  const { data, error } = await db
    .from('items')
    .select('item_code')
    .ilike('item_code', `${prefix}%`)

  if (error) throw error

  const matcher = new RegExp(`^${prefix}(\\d{5})$`, 'i')
  const latestSequence = (data ?? []).reduce((highest, row) => {
    const match = String(row.item_code ?? '').match(matcher)
    if (!match) return highest
    return Math.max(highest, Number(match[1]))
  }, 0)

  return `${prefix}${String(latestSequence + 1 + offset).padStart(5, '0')}`
}

export async function getNextItemCode(itemGroupCode?: string | null) {
  return createItemCode(itemGroupCode)
}

export async function getItemUomGroups(): Promise<ItemUomGroup[]> {
  const { data, error } = await db
    .from('uom_groups')
    .select(`
      id,
      code,
      name,
      base_uom:uom_master_data!uom_groups_base_uom_id_fkey(code)
    `)
    .eq('void', '1')
    .order('code')

  if (error) throw error

  return ((data ?? []) as unknown as UomGroupRecord[]).flatMap(group => {
    const baseUom = singleRelation(group.base_uom)
    if (!baseUom) return []

    return [{
      id: group.id,
      code: group.code,
      name: group.name,
      baseUomCode: baseUom.code,
    }]
  })
}

const cleanItemPayload = (payload: ItemInsert, itemCode: string) => {
  const manageBatchNumbers = Boolean(payload.manage_batch_numbers)

  return {
    item_code: itemCode.trim().toUpperCase(),
    item_name: payload.item_name?.trim() || null,
    description: payload.description?.trim() || null,
    barcode: payload.barcode?.trim() || null,
    unit_measure: payload.unit_measure?.trim() || 'pcs',
    inventory_uom: payload.inventory_uom?.trim() || payload.unit_measure?.trim() || 'pcs',
    item_group: payload.item_group?.trim() || null,
    sub_item_group_id: payload.sub_item_group_id ?? null,
    sub_item_group_level_1_id: payload.sub_item_group_level_1_id ?? null,
    sub_item_group_level_2_id: payload.sub_item_group_level_2_id ?? null,
    sub_item_group_level_3_id: payload.sub_item_group_level_3_id ?? null,
    fms_group: payload.fms_group?.trim() || null,
    group: payload.group?.trim() || payload.item_group?.trim() || null,
    is_inventory_item: payload.is_inventory_item ?? true,
    is_sales_item: payload.is_sales_item ?? true,
    is_purchase_item: payload.is_purchase_item ?? true,
    is_delivery_item: payload.is_delivery_item ?? true,
    manage_batch_numbers: manageBatchNumbers,
    manage_serial_numbers: payload.manage_serial_numbers ?? false,
    batch_management_method: manageBatchNumbers
      ? payload.batch_management_method || 'MANUAL'
      : 'NONE',
    default_shelf_life_days: manageBatchNumbers ? payload.default_shelf_life_days ?? null : null,
    default_expiration_months: manageBatchNumbers ? payload.default_expiration_months ?? null : null,
    default_expiry_required: manageBatchNumbers ? payload.default_expiry_required ?? false : false,
    allow_negative_batch_stock: manageBatchNumbers ? payload.allow_negative_batch_stock ?? false : false,
    batch_number_series: manageBatchNumbers ? payload.batch_number_series?.trim() || null : null,
    min_on_hand: payload.min_on_hand ?? null,
    max_on_hand: payload.max_on_hand ?? null,
  }
}

export async function addItem(payload: ItemInsert) {
  let latestError: unknown = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const itemCode = await createItemCode(payload.item_group || payload.group, attempt)
    const { data, error } = await db
      .from('items')
      .insert({
        ...cleanItemPayload(payload, itemCode),
        void: 1, // active by default
      })
      .select()
      .single()

    if (!error) return data
    latestError = error

    if (!isUniqueViolation(error)) throw error
  }

  throw latestError instanceof Error
    ? latestError
    : new Error('Unable to generate a unique item code after 3 attempts.')
}



export async function getRecentItems() {
  const { data, error } = await db
    .from('items')
    .select('*')
    .eq('void', 1)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error

  return data
}


export async function getItems() {
  const { data, error } = await db
    .from('items')
    .select('*')
  // .eq('id', id)
  // .single()

  if (error) throw error

  return data
}


export async function getItemById(id: number) {
  const { data, error } = await db
    .from('items')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data
}

export async function itemHasInventoryMovement(itemCode: string) {
  const { count, error } = await db
    .from('inventory_postings')
    .select('id', { count: 'exact', head: true })
    .eq('item_code', itemCode)

  if (error) throw error

  return Number(count ?? 0) > 0
}

export async function updateItem(
  id: number,
  payload: ItemInsert
) {
  const current = await getItemById(id) as ItemRow
  const nextManageBatch = Boolean(payload.manage_batch_numbers)
  const currentManageBatch = Boolean(current.manage_batch_numbers)

  if (nextManageBatch !== currentManageBatch && await itemHasInventoryMovement(current.item_code)) {
    throw new Error('Batch management cannot be changed because this item already has inventory movement.')
  }

  const { data, error } = await db
    .from('items')
    .update({
      ...cleanItemPayload(payload, payload.item_code || ''),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}
