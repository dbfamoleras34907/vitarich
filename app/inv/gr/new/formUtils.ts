import { addMonths, format, parseISO } from 'date-fns'

import type { GoodsReceipt, GoodsReceiptLine } from '../api'
import type {
  AssociatedWarehouse,
  GoodsReceiptBatchSeries,
  GoodsReceiptFarm,
} from './api'
import type { Items, WarehouseData } from '@/lib/types'

export const FMS_TYPE_OPTIONS = [
  { value: 'broiler', label: 'Broiler' },
  { value: 'breeder', label: 'Breeder' },
  { value: 'hatchery', label: 'Hatchery' },
]

const FARM_TYPE_TO_FMS_TYPE: Record<string, string> = {
  BE: 'breeder',
  HA: 'hatchery',
  BR: 'broiler',
  BREEDER: 'breeder',
  HATCHERY: 'hatchery',
  BROILER: 'broiler',
}

export type GoodsReceiveFormMode = 'draft' | 'post'

export const newLine = (): GoodsReceiptLine => ({
  id: crypto.randomUUID(),
  itemId: null,
  itemCode: '',
  description: '',
  batchRuleId: null,
  batchNumber: '',
  supplierBatchNumber: '',
  manufacturingDate: '',
  expiryDate: '',
  altQty: 1,
  altUom: '',
  baseQty: 1,
  baseUom: '',
  warehouseId: null,
  warehouseCode: '',
  warehouseName: '',
  returnedQty: 0,
})

export const emptyReceipt = (grNo: string): GoodsReceipt => ({
  id: null,
  grNo,
  drReference: '',
  vendor: '',
  receiveDate: format(new Date(), 'yyyy-MM-dd'),
  fmsType: '',
  farmId: null,
  farmCode: '',
  farmName: '',
  defaultWarehouseId: null,
  status: 'Draft',
  lines: Array.from({ length: 5 }, newLine),
  createdAt: new Date().toISOString(),
})

export const duplicateReceipt = (source: GoodsReceipt, grNo: string): GoodsReceipt => ({
  ...source,
  id: null,
  grNo,
  drReference: '',
  status: 'Draft',
  lines: source.lines.map(line => ({
    ...line,
    id: crypto.randomUUID(),
    returnedQty: 0,
  })),
  createdAt: new Date().toISOString(),
})

export const numberValue = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const asArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? value as T[] : []

export const getCachedWarehouses = (value: unknown): WarehouseData[] => {
  if (Array.isArray(value)) return value as WarehouseData[]
  if (value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: WarehouseData[] }).data
  }
  return []
}

export const formatBatchDatePart = (
  dateFormat: GoodsReceiptBatchSeries['date_format'],
  dateValue: string,
) => {
  if (dateFormat === 'NONE' || !dateValue) return ''

  const [year = '', month = '', day = ''] = dateValue.split('-')
  return dateFormat
    .replace('YYYY', year)
    .replace('YY', year.slice(-2))
    .replace('MM', month)
    .replace('DD', day)
}

export const buildBatchNumber = (
  series: GoodsReceiptBatchSeries | null,
  manufacturingDate: string,
  expiryDate: string,
) => {
  const dateFormat = series?.date_format ?? 'YYMMDD'
  const nextNumber = Math.max(0, Number(series?.next_number ?? 1) || 0)
  const numberLength = Math.max(1, Number(series?.number_length ?? 5) || 1)
  const sequence = String(nextNumber).padStart(numberLength, '0')
  const separator = series?.separator || '-'

  return [
    series?.prefix ?? 'FD',
    formatBatchDatePart(dateFormat, manufacturingDate),
    series?.include_expiry_date === false ? '' : formatBatchDatePart(dateFormat, expiryDate),
    sequence,
    series?.suffix ?? '',
  ]
    .map(part => String(part ?? '').trim())
    .filter(Boolean)
    .join(separator)
}

export const addMonthsToDate = (dateValue: string, months: number) => {
  if (!dateValue || !Number.isInteger(months) || months < 0) return ''
  const date = parseISO(dateValue)
  if (Number.isNaN(date.getTime())) return ''
  return format(addMonths(date, months), 'yyyy-MM-dd')
}

export const getAssociatedWarehouseCode = (warehouse: AssociatedWarehouse | string) =>
  typeof warehouse === 'string' ? warehouse.trim() : String(warehouse.whse_code ?? '').trim()

const isDefaultReceivingAssociation = (warehouse: AssociatedWarehouse | string) =>
  typeof warehouse === 'object' && (
    Boolean(warehouse.is_default_receiving) ||
    Boolean(warehouse.is_default_receiving_warehouse)
  )

const isWarehouseType = (warehouse: WarehouseData) =>
  String(warehouse.warehouse_type ?? '').trim().toLowerCase() === 'warehouse'

export const getFarmFmsType = (farm: GoodsReceiptFarm | undefined | null) =>
  FARM_TYPE_TO_FMS_TYPE[String(farm?.farm_type ?? '').trim().toUpperCase()] ?? ''

export const getWarehouseFmsType = (warehouse: WarehouseData | undefined | null) =>
  FARM_TYPE_TO_FMS_TYPE[String(warehouse?.fms_type ?? '').trim().toUpperCase()] ?? ''

export const getWarehousesForFarm = (
  farm: GoodsReceiptFarm | undefined | null,
  warehouseList: WarehouseData[],
) => {
  if (!Array.isArray(farm?.associated_warehouses)) return []
  const allowedCodes = new Set(farm.associated_warehouses.map(getAssociatedWarehouseCode).filter(Boolean))
  return warehouseList.filter(warehouse =>
    allowedCodes.has(String(warehouse.whse_code ?? '').trim()) && isWarehouseType(warehouse),
  )
}

export const getDefaultReceivingWarehouse = (
  farm: GoodsReceiptFarm | undefined | null,
  farmWarehouses: WarehouseData[],
) => {
  const associations = farm?.associated_warehouses
  const defaultAssociation = Array.isArray(associations)
    ? associations.find(isDefaultReceivingAssociation)
    : null
  const defaultCode = defaultAssociation ? getAssociatedWarehouseCode(defaultAssociation) : ''
  const defaultWarehouse = farmWarehouses.find(warehouse =>
    defaultCode && String(warehouse.whse_code ?? '').trim() === defaultCode,
  ) ?? farmWarehouses.find(warehouse => Boolean(warehouse.is_default_receiving_warehouse))

  return defaultWarehouse ?? (farmWarehouses.length === 1 ? farmWarehouses[0] : null)
}

export const getItemDescription = (item: Items) => item.item_name || item.description || ''
export const getItemFmsType = (item: Items) => String(item.fms_group ?? '').trim().toLowerCase()

export const isDocItem = (item: Items) => [
  item.item_code,
  item.item_name,
  item.description,
  item.item_group,
  item.fms_group,
  item.group,
].map(value => String(value ?? '').trim().toUpperCase())
  .some(token => token === 'DOC' || token.startsWith('DOC'))

export const formatQuantity = (value: number) =>
  Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 6 })

export const formatDateTime = (value: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
