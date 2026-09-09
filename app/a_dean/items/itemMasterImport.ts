import type { ItemInsert, ItemUomGroup } from './api'
import { ITEM_GROUP_MAX_SUBGROUP_LEVELS, type ItemGroup } from '../itemgroups/api'

export type ItemMasterImportRow = {
  rowNumber: number
  payload: ItemInsert
}

const SUB_ITEM_GROUP_HEADERS = [
  'Sub Group Level 1',
  'Sub Group Level 2',
  'Sub Group Level 3',
] as const

if (SUB_ITEM_GROUP_HEADERS.length !== ITEM_GROUP_MAX_SUBGROUP_LEVELS) {
  throw new Error('Item Master import headers do not match the configured Sub Group level count.')
}

const HEADERS = [
  'Item Name',
  'Description',
  'Barcode',
  'UoM Group',
  'Item Group',
  ...SUB_ITEM_GROUP_HEADERS,
  'FMS Group',
  'Inventory Item',
  'Sales Item',
  'Purchase Item',
  'Delivery Item',
  'Manage Batch Numbers',
  'Manage Serial Numbers',
  'Batch Management Method',
  'Shelf Life Days',
  'Expiration Months',
  'Expiry Required',
  'Allow Negative Batch Stock',
  'Batch Number Series',
  'Min On Hand',
  'Max On Hand',
] as const

type Header = typeof HEADERS[number]

type ItemMasterImportReferences = {
  itemGroups: ItemGroup[]
  subItemGroups: ItemGroup[]
  uomGroups: ItemUomGroup[]
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const textValue = (value: unknown) => String(value ?? '').trim()
const normalizedCode = (value: unknown) => normalize(value).replace(/\s+-\s+.*$/, '')

const booleanValue = (value: unknown) => {
  const normalized = normalize(value)
  if (['yes', 'true', '1'].includes(normalized)) return true
  if (['no', 'false', '0'].includes(normalized)) return false
  return null
}

const optionalNonNegativeNumber = (value: unknown) => {
  const text = textValue(value).replace(/,/g, '')
  if (!text) return { value: null, valid: true }
  const parsed = Number(text)
  return { value: parsed, valid: Number.isFinite(parsed) && parsed >= 0 }
}

const optionalNonNegativeInteger = (value: unknown) => {
  const parsed = optionalNonNegativeNumber(value)
  return { value: parsed.value, valid: parsed.valid && (parsed.value == null || Number.isInteger(parsed.value)) }
}

export function parseItemMasterImport(
  data: unknown[][],
  references: ItemMasterImportReferences,
) {
  const issues: string[] = []
  const headerRow = data[0] ?? []
  const headerIndexes = new Map(
    headerRow.map((header, index) => [normalize(header), index]),
  )
  const missingHeaders = HEADERS.filter(header => !headerIndexes.has(normalize(header)))

  if (missingHeaders.length > 0) {
    return {
      rows: [] as ItemMasterImportRow[],
      issues: [`Missing column${missingHeaders.length === 1 ? '' : 's'}: ${missingHeaders.join(', ')}.`],
    }
  }

  const cell = (row: unknown[], header: Header) =>
    row[headerIndexes.get(normalize(header)) ?? -1]

  const rows = data.slice(1).flatMap((row, index) => {
    if (row.every(value => textValue(value) === '')) return []

    const rowNumber = index + 2
    const itemName = textValue(cell(row, 'Item Name'))
    const rawUomGroup = textValue(cell(row, 'UoM Group'))
    const rawItemGroup = textValue(cell(row, 'Item Group'))
    const rawSubItemGroups = SUB_ITEM_GROUP_HEADERS.map(header => textValue(cell(row, header)))
    const rawFmsGroup = normalize(cell(row, 'FMS Group'))
    const uomGroup = references.uomGroups.find(group =>
      normalize(group.code) === normalizedCode(rawUomGroup) ||
      normalize(`${group.code} - ${group.name}`) === normalize(rawUomGroup),
    )
    const itemGroup = references.itemGroups.find(group =>
      normalize(group.code) === normalizedCode(rawItemGroup) ||
      normalize(`${group.code} - ${group.name}`) === normalize(rawItemGroup),
    )
    const rootItemGroupId = itemGroup?.id == null ? null : Number(itemGroup.id)
    let subItemGroup: ItemGroup | undefined
    const selectedSubItemGroupIds: number[] = []
    let hierarchyInvalid = false

    rawSubItemGroups.forEach((rawSubItemGroup, levelIndex) => {
      if (!rawSubItemGroup) {
        if (!hierarchyInvalid && rawSubItemGroups.slice(levelIndex + 1).some(Boolean)) {
          issues.push(`Row ${rowNumber}: Sub Group Level ${levelIndex + 1} is required before a deeper Sub Group level can be selected.`)
          hierarchyInvalid = true
        }
        return
      }
      if (hierarchyInvalid || rootItemGroupId == null) return

      const availableGroups = references.subItemGroups.filter(group =>
        Number(group.root_item_group_id) === rootItemGroupId &&
        Number(group.subgroup_level) === levelIndex + 1,
      )
      const matchedGroup = availableGroups.find(group =>
        normalize(group.code) === normalizedCode(rawSubItemGroup) ||
        normalize(group.name) === normalize(rawSubItemGroup) ||
        normalize(group.remarks) === normalize(rawSubItemGroup) ||
        normalize(`${group.code} - ${group.name}`) === normalize(rawSubItemGroup),
      )
      if (!matchedGroup?.id) {
        issues.push(`Row ${rowNumber}: Sub Group Level ${levelIndex + 1} does not match an active Category Segment, Category Description, or ID under the selected Item Group.`)
        hierarchyInvalid = true
        return
      }

      subItemGroup = matchedGroup
      selectedSubItemGroupIds[levelIndex] = Number(matchedGroup.id)
    })

    if (!itemName) issues.push(`Row ${rowNumber}: Item Name is required.`)
    if (!uomGroup) issues.push(`Row ${rowNumber}: UoM Group is not active or valid.`)
    if (!itemGroup) issues.push(`Row ${rowNumber}: Item Group is not active or valid.`)
    if (!['broiler', 'breeder', 'hatchery'].includes(rawFmsGroup)) {
      issues.push(`Row ${rowNumber}: FMS Group must be Broiler, Breeder, or Hatchery.`)
    }

    const booleanHeaders = [
      'Inventory Item',
      'Sales Item',
      'Purchase Item',
      'Delivery Item',
      'Manage Batch Numbers',
      'Manage Serial Numbers',
      'Expiry Required',
      'Allow Negative Batch Stock',
    ] as const
    const booleans = Object.fromEntries(booleanHeaders.map(header => [header, booleanValue(cell(row, header))])) as Record<typeof booleanHeaders[number], boolean | null>
    booleanHeaders.forEach(header => {
      if (booleans[header] == null) issues.push(`Row ${rowNumber}: ${header} must be Yes or No.`)
    })

    const manageBatchNumbers = booleans['Manage Batch Numbers'] ?? false
    const batchMethod = textValue(cell(row, 'Batch Management Method')).toUpperCase() || 'NONE'
    if (manageBatchNumbers && !['MANUAL', 'AUTO'].includes(batchMethod)) {
      issues.push(`Row ${rowNumber}: Batch Management Method must be MANUAL or AUTO when batch numbers are managed.`)
    }
    if (!manageBatchNumbers && batchMethod !== 'NONE') {
      issues.push(`Row ${rowNumber}: Batch Management Method must be NONE when batch numbers are not managed.`)
    }

    const shelfLifeDays = optionalNonNegativeInteger(cell(row, 'Shelf Life Days'))
    const expirationMonths = optionalNonNegativeInteger(cell(row, 'Expiration Months'))
    const minOnHand = optionalNonNegativeNumber(cell(row, 'Min On Hand'))
    const maxOnHand = optionalNonNegativeNumber(cell(row, 'Max On Hand'))
    if (!shelfLifeDays.valid) issues.push(`Row ${rowNumber}: Shelf Life Days must be a whole number greater than or equal to 0.`)
    if (!expirationMonths.valid) issues.push(`Row ${rowNumber}: Expiration Months must be a whole number greater than or equal to 0.`)
    if (!minOnHand.valid) issues.push(`Row ${rowNumber}: Min On Hand must be a number greater than or equal to 0.`)
    if (!maxOnHand.valid) issues.push(`Row ${rowNumber}: Max On Hand must be a number greater than or equal to 0.`)
    if (minOnHand.value != null && maxOnHand.value != null && maxOnHand.value < minOnHand.value) {
      issues.push(`Row ${rowNumber}: Max On Hand cannot be less than Min On Hand.`)
    }

    return [{
      rowNumber,
      payload: {
        item_name: itemName,
        description: textValue(cell(row, 'Description')),
        barcode: textValue(cell(row, 'Barcode')),
        unit_measure: uomGroup?.baseUomCode || rawUomGroup,
        inventory_uom: uomGroup?.code || rawUomGroup,
        item_group: itemGroup?.code || rawItemGroup,
        sub_item_group_id: subItemGroup?.id == null ? null : Number(subItemGroup.id),
        sub_item_group_level_1_id: selectedSubItemGroupIds[0] ?? null,
        sub_item_group_level_2_id: selectedSubItemGroupIds[1] ?? null,
        sub_item_group_level_3_id: selectedSubItemGroupIds[2] ?? null,
        fms_group: rawFmsGroup,
        group: itemGroup?.code || rawItemGroup,
        is_inventory_item: booleans['Inventory Item'] ?? true,
        is_sales_item: booleans['Sales Item'] ?? true,
        is_purchase_item: booleans['Purchase Item'] ?? true,
        is_delivery_item: booleans['Delivery Item'] ?? true,
        manage_batch_numbers: manageBatchNumbers,
        manage_serial_numbers: booleans['Manage Serial Numbers'] ?? false,
        batch_management_method: manageBatchNumbers ? batchMethod : 'NONE',
        default_shelf_life_days: manageBatchNumbers ? shelfLifeDays.value : null,
        default_expiration_months: manageBatchNumbers ? expirationMonths.value : null,
        default_expiry_required: manageBatchNumbers ? booleans['Expiry Required'] ?? false : false,
        allow_negative_batch_stock: manageBatchNumbers ? booleans['Allow Negative Batch Stock'] ?? false : false,
        batch_number_series: manageBatchNumbers ? textValue(cell(row, 'Batch Number Series')) || null : null,
        min_on_hand: minOnHand.value,
        max_on_hand: maxOnHand.value,
      },
    }]
  })

  if (rows.length === 0 && issues.length === 0) {
    issues.push('The Items worksheet has no data rows.')
  }

  return { rows, issues }
}
