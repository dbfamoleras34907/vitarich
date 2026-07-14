'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRightCircle,
  CalendarDays,
  Hash,
  List,
  Loader2,
  PackageCheck,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FormTable, FormTableFooter } from '@/components/ui/form-table'
import SearchableCombobox from '@/components/SearchableCombobox'
import SearchableDropdown from '@/lib/SearchableDropdown'
import Breadcrumb from '@/lib/Breadcrumb'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { useSidebar } from '@/lib/sidebar/SidebarProvider'
import { Items, WarehouseData } from '@/lib/types'
import { getInventoryStatusBadgeClass } from '@/app/inv/statusStyles'
import {
  createGoodsReceiptNumber,
  getGoodsReceiptById,
  GoodsReceipt,
  GoodsReceiptLine,
  saveGoodsReceipt,
} from '../api'
import {
  AssociatedWarehouse,
  findExistingItemBatch,
  GoodsReceiptBatchRule,
  GoodsReceiptBatchSeries,
  GoodsReceiptExistingBatch,
  GoodsReceiptPrefetchReferences,
  getGoodsReceiptReferences,
  GoodsReceiptFarm,
  GoodsReceiptItemGroup,
  UomConversionOption,
  UomGroupOption,
} from './api'
import {
  BatchTransactionTrail,
  getBatchTransactionTrail,
} from '../../btch/api'

const FMS_TYPE_OPTIONS = [
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

const today = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const newLine = (): GoodsReceiptLine => ({
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

const emptyReceipt = (grNo: string): GoodsReceipt => ({
  id: null,
  grNo,
  vendor: '',
  receiveDate: today(),
  fmsType: '',
  farmId: null,
  farmCode: '',
  farmName: '',
  defaultWarehouseId: null,
  status: 'Draft',
  lines: Array.from({ length: 5 }, newLine),
  createdAt: new Date().toISOString(),
})

const duplicateReceipt = (source: GoodsReceipt, grNo: string): GoodsReceipt => ({
  ...source,
  id: null,
  grNo,
  status: 'Draft',
  lines: source.lines.map(line => ({
    ...line,
    id: crypto.randomUUID(),
    returnedQty: 0,
  })),
  createdAt: new Date().toISOString(),
})

const numberValue = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const asArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? value as T[] : []

const getCachedWarehouses = (value: unknown): WarehouseData[] => {
  if (Array.isArray(value)) return value as WarehouseData[]
  if (value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: WarehouseData[] }).data
  }

  return []
}

const formatBatchDatePart = (
  format: GoodsReceiptBatchSeries['date_format'],
  dateValue: string,
) => {
  if (format === 'NONE' || !dateValue) return ''

  const [year = '', month = '', day = ''] = dateValue.split('-')
  const yy = year.slice(-2)

  return format
    .replace('YYYY', year)
    .replace('YY', yy)
    .replace('MM', month)
    .replace('DD', day)
}

const buildBatchNumber = (
  series: GoodsReceiptBatchSeries | null,
  manufacturingDate: string,
  expiryDate: string,
) => {
  const dateFormat = series?.date_format ?? 'YYMMDD'
  const nextNumber = Math.max(0, Number(series?.next_number ?? 1) || 0)
  const numberLength = Math.max(1, Number(series?.number_length ?? 5) || 1)
  const sequence = String(nextNumber).padStart(numberLength, '0')
  const mfgPart = formatBatchDatePart(dateFormat, manufacturingDate)
  const expPart = formatBatchDatePart(dateFormat, expiryDate)
  const separator = series?.separator || '-'
  const prefix = series?.prefix ?? 'FD'
  const suffix = series?.suffix ?? ''

  return [prefix, mfgPart, series?.include_expiry_date === false ? '' : expPart, sequence, suffix]
    .map(part => String(part ?? '').trim())
    .filter(Boolean)
    .join(separator)
}

const addMonthsToDate = (dateValue: string, months: number) => {
  if (!dateValue || !Number.isInteger(months) || months < 0) return ''

  const [year, month, day] = dateValue.split('-').map(Number)
  if (!year || !month || !day) return ''

  const date = new Date(year, month - 1, day)
  const targetMonth = date.getMonth() + months
  date.setMonth(targetMonth)

  if (date.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    date.setDate(0)
  }

  const nextYear = String(date.getFullYear())
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getDate()).padStart(2, '0')

  return `${nextYear}-${nextMonth}-${nextDay}`
}

const getAssociatedWarehouseCode = (warehouse: AssociatedWarehouse | string) => {
  if (typeof warehouse === 'string') return warehouse.trim()
  return String(warehouse.whse_code ?? '').trim()
}

const isDefaultReceivingAssociation = (warehouse: AssociatedWarehouse | string) =>
  typeof warehouse === 'object' && (
    Boolean(warehouse?.is_default_receiving) ||
    Boolean(warehouse?.is_default_receiving_warehouse)
  )

const isWarehouseType = (warehouse: WarehouseData) =>
  String(warehouse.warehouse_type ?? '').trim().toLowerCase() === 'warehouse'

const getFarmFmsType = (farm: GoodsReceiptFarm | undefined | null) =>
  FARM_TYPE_TO_FMS_TYPE[String(farm?.farm_type ?? '').trim().toUpperCase()] ?? ''

const getWarehouseFmsType = (warehouse: WarehouseData | undefined | null) =>
  FARM_TYPE_TO_FMS_TYPE[String(warehouse?.fms_type ?? '').trim().toUpperCase()] ?? ''

const getWarehousesForFarm = (farm: GoodsReceiptFarm | undefined | null, warehouseList: WarehouseData[]) => {
  const associations = farm?.associated_warehouses
  if (!Array.isArray(associations)) return []

  const allowedCodes = new Set(
    associations
      .map(getAssociatedWarehouseCode)
      .filter(Boolean)
  )

  return warehouseList.filter(warehouse =>
    allowedCodes.has(String(warehouse.whse_code ?? '').trim()) &&
    isWarehouseType(warehouse)
  )
}

const getDefaultReceivingWarehouse = (
  farm: GoodsReceiptFarm | undefined | null,
  farmWarehouseList: WarehouseData[],
) => {
  const associations = farm?.associated_warehouses
  const defaultAssociationCode = Array.isArray(associations)
    ? associations.find(isDefaultReceivingAssociation)
    : null
  const defaultCode = defaultAssociationCode
    ? getAssociatedWarehouseCode(defaultAssociationCode)
    : ''

  const defaultWarehouse = farmWarehouseList.find(warehouse =>
    defaultCode && String(warehouse.whse_code ?? '').trim() === defaultCode
  ) ?? farmWarehouseList.find(warehouse => Boolean(warehouse.is_default_receiving_warehouse)) ?? null

  return defaultWarehouse ?? (farmWarehouseList.length === 1 ? farmWarehouseList[0] : null)
}

const getItemDescription = (item: Items) =>
  item.item_name || item.description || ''

const getItemFmsType = (item: Items) =>
  String(item.fms_group ?? '').trim().toLowerCase()

const isDocItem = (item: Items) => {
  const tokens = [
    item.item_code,
    item.item_name,
    item.description,
    item.item_group,
    item.fms_group,
    item.group,
  ].map(value => String(value ?? '').trim().toUpperCase())

  return tokens.some(token => token === 'DOC' || token.startsWith('DOC'))
}

const formatQuantity = (value: number) =>
  Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 6 })

const formatDateTime = (value: string) => {
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

type GoodsReceiveFormMode = 'draft' | 'post'

type NewGoodsReceiveProps = {
  mode?: GoodsReceiveFormMode
}

function GoodsReceiveLoadingShell() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-stone-50/40 pb-8 text-stone-950">
      <div className="mx-4 mt-8 flex items-center justify-between gap-3">
        <div className="h-6 w-56 rounded bg-stone-200" />
        <div className="h-9 w-24 rounded-md bg-stone-100" />
      </div>

      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid gap-x-16 gap-y-3 p-5 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)]">
              <div className="h-4 w-20 rounded bg-stone-200" />
              <div className="h-9 rounded-md bg-stone-100" />
            </div>
          ))}
        </div>

        <div className="border-t p-5">
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-200 bg-white px-3 py-3">
              <div className="h-5 w-48 rounded bg-stone-200" />
              <div className="mt-2 h-4 w-20 rounded bg-stone-100" />
            </div>

            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid grid-cols-[40px_2fr_1fr_1fr_1fr_1fr_1fr_56px] gap-3">
                  {Array.from({ length: 8 }).map((__, cellIndex) => (
                    <div key={cellIndex} className="h-9 rounded bg-stone-100" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default function NewGoodsReceive({ mode = 'draft' }: NewGoodsReceiveProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getValue } = useGlobalContext()
  const { setCollapsed } = useSidebar()
  const receiptId = searchParams.get('id')
  const duplicateId = searchParams.get('duplicateId')
  const isPostMode = mode === 'post'
  const [receipt, setReceipt] = useState<GoodsReceipt | null>(null)
  const [items, setItems] = useState<Items[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [farms, setFarms] = useState<GoodsReceiptFarm[]>([])
  const [uomGroups, setUomGroups] = useState<UomGroupOption[]>([])
  const [conversions, setConversions] = useState<UomConversionOption[]>([])
  const [itemGroups, setItemGroups] = useState<GoodsReceiptItemGroup[]>([])
  const [batchRules, setBatchRules] = useState<GoodsReceiptBatchRule[]>([])
  const [batchSeries, setBatchSeries] = useState<GoodsReceiptBatchSeries[]>([])
  const [activeBatchLineId, setActiveBatchLineId] = useState<GoodsReceiptLine['id'] | null>(null)
  const [batchTrailRows, setBatchTrailRows] = useState<BatchTransactionTrail[]>([])
  const [loadingBatchTrail, setLoadingBatchTrail] = useState(false)
  const [batchMatches, setBatchMatches] = useState<Record<string, GoodsReceiptExistingBatch | null>>({})
  const [postConfirmOpen, setPostConfirmOpen] = useState(false)
  const [lineCount, setLineCount] = useState(1)
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCollapsed(true)
  }, [setCollapsed])

  useEffect(() => {
    let cancelled = false

    async function loadPageData() {
      try {
        if (isPostMode && !receiptId) {
          toast('Select a draft goods receipt to post.')
          router.push('/inv/gr')
          return
        }

        const cachedItems = asArray<Items>(getValue('itemmaster'))
          .filter(item => item.void === 1 || item.void == null)
        const cachedWarehouses = getCachedWarehouses(getValue('warehouses'))
          .filter(warehouse => !('is_active' in warehouse) || warehouse.is_active !== false)
        const cachedGrReferences = getValue('goodsReceiptReferences') as GoodsReceiptPrefetchReferences | undefined
        const cachedReferencesHaveFarmMetadata = (cachedGrReferences?.farms ?? []).every(
          farm => typeof farm.farm_type !== 'undefined',
        )
        const canUseCachedReferences = cachedItems.length > 0 &&
          cachedWarehouses.length > 0 &&
          Boolean(cachedGrReferences?.uomGroups && cachedGrReferences.conversions && cachedGrReferences.itemGroups) &&
          cachedReferencesHaveFarmMetadata

        const referencesPromise = canUseCachedReferences
          ? Promise.resolve({
              items: cachedItems,
              warehouses: cachedWarehouses,
              farms: cachedGrReferences?.farms ?? [],
              uomGroups: cachedGrReferences?.uomGroups ?? [],
              conversions: cachedGrReferences?.conversions ?? [],
              itemGroups: cachedGrReferences?.itemGroups ?? [],
              batchRules: cachedGrReferences?.batchRules ?? [],
              batchSeries: cachedGrReferences?.batchSeries ?? [],
            })
          : getGoodsReceiptReferences()

        const [references, savedReceipt, grNo] = await Promise.all([
          referencesPromise,
          receiptId
            ? getGoodsReceiptById(Number(receiptId))
            : duplicateId
              ? getGoodsReceiptById(Number(duplicateId))
              : Promise.resolve(null),
          receiptId && !duplicateId ? Promise.resolve('') : createGoodsReceiptNumber(),
        ])

        if (cancelled) return

        setReceipt(duplicateId && savedReceipt
          ? duplicateReceipt(savedReceipt, grNo)
          : savedReceipt ?? emptyReceipt(grNo))
        setItems(references.items)
        setWarehouses(references.warehouses)
        setFarms(references.farms)
        setUomGroups(references.uomGroups)
        setConversions(references.conversions)
        setItemGroups(references.itemGroups)
        setBatchRules(references.batchRules)
        setBatchSeries(references.batchSeries)
      } catch (error) {
        console.error(error)
        toast('Reference data could not be loaded.')
      } finally {
        if (!cancelled) setLoadingReferences(false)
      }
    }

    loadPageData()

    return () => {
      cancelled = true
    }
  }, [duplicateId, getValue, isPostMode, receiptId, router])

  const totalQuantity = useMemo(
    () => receipt?.lines.reduce(
      (total, line) => total + Number(line.baseQty || 0),
      0,
    ) ?? 0,
    [receipt],
  )

  const selectedFarm = useMemo(
    () => farms.find(farm => farm.id === receipt?.farmId),
    [farms, receipt?.farmId],
  )

  const farmWarehouses = useMemo(
    () => getWarehousesForFarm(selectedFarm, warehouses),
    [selectedFarm, warehouses],
  )

  const farmOptions = useMemo(
    () => farms.map(farm => ({
      code: String(farm.id),
      name: farm.code ? `${farm.code} - ${farm.name}` : farm.name || String(farm.id),
    })),
    [farms],
  )

  const availableItems = useMemo(() => {
    const fmsType = String(receipt?.fmsType ?? '').trim().toLowerCase()
    if (!fmsType) return []

    return items.filter(item => getItemFmsType(item) === fmsType && !isDocItem(item))
  }, [items, receipt?.fmsType])

  const itemDropdownOptions = useMemo(
    () => availableItems.map(item => ({
      ...item,
      itemDisplayDescription: getItemDescription(item),
    })),
    [availableItems],
  )

  const itemGroupIdByCode = useMemo(() => {
    const map = new Map<string, number>()

    itemGroups.forEach(group => {
      const code = String(group.code ?? '').trim().toUpperCase()
      if (code) map.set(code, group.id)
    })

    return map
  }, [itemGroups])

  useEffect(() => {
    if (loadingReferences || !receipt?.farmId) return

    const allowedCodes = new Set(
      farmWarehouses.map(warehouse => String(warehouse.whse_code ?? '').trim())
    )
    const currentDefaultWarehouse = receipt.defaultWarehouseId == null
      ? null
      : farmWarehouses.find(warehouse => warehouse.id === receipt.defaultWarehouseId) ?? null
    const defaultWarehouse = getDefaultReceivingWarehouse(selectedFarm, farmWarehouses)
    const nextDefaultWarehouse = defaultWarehouse ?? currentDefaultWarehouse
    const nextDefaultWarehouseId = nextDefaultWarehouse?.id ?? null
    const nextFmsType = getFarmFmsType(selectedFarm) || getWarehouseFmsType(nextDefaultWarehouse)

    const nextLines = receipt.lines.map(line => {
      if (line.warehouseCode && allowedCodes.has(line.warehouseCode)) return line
      if (!line.warehouseCode && !nextDefaultWarehouse) return line

      return {
        ...line,
        warehouseId: nextDefaultWarehouse?.id ?? null,
        warehouseCode: nextDefaultWarehouse?.whse_code ?? '',
        warehouseName: nextDefaultWarehouse?.whse_name ?? '',
      }
    })

    const linesChanged = nextLines.some((line, index) => line !== receipt.lines[index])
    const defaultWarehouseChanged = receipt.defaultWarehouseId !== nextDefaultWarehouseId
    const fmsTypeChanged = Boolean(nextFmsType) && receipt.fmsType !== nextFmsType

    if (!defaultWarehouseChanged && !fmsTypeChanged && !linesChanged) return

    setReceipt(current => current ? {
      ...current,
      fmsType: nextFmsType || current.fmsType,
      defaultWarehouseId: nextDefaultWarehouseId,
      lines: nextLines,
    } : current)
  }, [farmWarehouses, loadingReferences, receipt?.defaultWarehouseId, receipt?.farmId, receipt?.fmsType, receipt?.lines, selectedFarm])

  useEffect(() => {
    if (loadingReferences || receipt?.farmId || farms.length !== 1) return

    const [farm] = farms
    const availableFarmWarehouses = getWarehousesForFarm(farm, warehouses)
    const defaultWarehouse = getDefaultReceivingWarehouse(farm, availableFarmWarehouses)
    const allowedCodes = new Set(
      (farm.associated_warehouses ?? [])
        .map(getAssociatedWarehouseCode)
        .filter(Boolean)
    )

    setReceipt(current => {
      if (!current || current.farmId) return current

      return {
        ...current,
        farmId: farm.id,
        farmCode: farm.code,
        farmName: farm.name ?? '',
        fmsType: getFarmFmsType(farm) || getWarehouseFmsType(defaultWarehouse),
        defaultWarehouseId: defaultWarehouse?.id ?? null,
        lines: current.lines.map(line =>
          allowedCodes.has(line.warehouseCode)
            ? line
            : {
              ...line,
              warehouseId: defaultWarehouse?.id ?? null,
              warehouseCode: defaultWarehouse?.whse_code ?? '',
              warehouseName: defaultWarehouse?.whse_name ?? '',
            }
        ),
      }
    })
  }, [farms, loadingReferences, receipt?.farmId, warehouses])

  useEffect(() => {
    const fmsType = String(receipt?.fmsType ?? '').trim().toLowerCase()
    if (!fmsType || !receipt?.lines.length) return

    const allowedItemCodes = new Set(
      availableItems
        .map(item => String(item.item_code ?? '').trim())
        .filter(Boolean)
    )

    const nextLines = receipt.lines.map(line =>
      !line.itemCode || allowedItemCodes.has(line.itemCode)
        ? line
        : {
          ...line,
          itemId: null,
          itemCode: '',
          description: '',
          batchRuleId: null,
          batchNumber: '',
          supplierBatchNumber: '',
          manufacturingDate: '',
          expiryDate: '',
          altUom: '',
          baseUom: '',
        }
    )

    if (nextLines.every((line, index) => line === receipt.lines[index])) return

    setReceipt(current => current ? {
      ...current,
      lines: nextLines,
    } : current)
  }, [availableItems, receipt?.fmsType, receipt?.lines])

  const batchLineForLookup = receipt?.lines.find(line => line.id === activeBatchLineId) ?? null
  const batchTrailItemCode = batchLineForLookup?.itemCode.trim() ?? ''
  const batchTrailNumber = batchLineForLookup?.batchNumber.trim() ?? ''

  useEffect(() => {
    const lineId = batchLineForLookup?.id
    const lineKey = lineId == null ? '' : String(lineId)

    if (!lineId || !batchLineForLookup?.itemCode || !batchLineForLookup.manufacturingDate) {
      if (lineKey) {
        setBatchMatches(current => ({
          ...current,
          [lineKey]: null,
        }))
      }
      return
    }

    let cancelled = false
    findExistingItemBatch(
      batchLineForLookup.itemCode,
      batchLineForLookup.manufacturingDate,
      batchLineForLookup.expiryDate,
    )
      .then(existingBatch => {
        if (cancelled) return

        setBatchMatches(current => ({
          ...current,
          [lineKey]: existingBatch,
        }))

        if (existingBatch?.batch_number) {
          setReceipt(current => current ? {
            ...current,
            lines: current.lines.map(line =>
              line.id === lineId && line.batchNumber !== existingBatch.batch_number
                ? { ...line, batchNumber: existingBatch.batch_number }
                : line
            ),
          } : current)
        }
      })
      .catch(error => {
        console.error(error)
        if (!cancelled) {
          setBatchMatches(current => ({
            ...current,
            [lineKey]: null,
          }))
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    batchLineForLookup?.id,
    batchLineForLookup?.itemCode,
    batchLineForLookup?.manufacturingDate,
    batchLineForLookup?.expiryDate,
  ])

  useEffect(() => {
    if (!activeBatchLineId || !batchTrailItemCode || !batchTrailNumber) {
      setBatchTrailRows([])
      setLoadingBatchTrail(false)
      return
    }

    let cancelled = false
    setLoadingBatchTrail(true)
    setBatchTrailRows([])

    getBatchTransactionTrail(
      batchTrailItemCode,
      batchTrailNumber,
    )
      .then(rows => {
        if (!cancelled) setBatchTrailRows(rows)
      })
      .catch(error => {
        console.error(error)
        if (!cancelled) {
          setBatchTrailRows([])
          toast.error('Unable to load batch transaction trail')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBatchTrail(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeBatchLineId, batchTrailItemCode, batchTrailNumber])

  if (!receipt) return <GoodsReceiveLoadingShell />

  const updateLine = (id: GoodsReceiptLine['id'], changes: Partial<GoodsReceiptLine>) => {
    setReceipt(current => current
      ? { ...current, lines: current.lines.map(line => line.id === id ? { ...line, ...changes } : line) }
      : current,
    )
  }

  const calculateBaseQty = (
    altQty: number,
    altUom: string,
    groupCode: string,
  ) => {
    if (!altUom || !groupCode) return 0

    const normalizedAlt = altUom.trim().toUpperCase()
    const normalizedGroup = groupCode.trim().toUpperCase()
    const conversion = conversions.find(
      option =>
        option.groupCode.toUpperCase() === normalizedGroup &&
        option.uomCode.toUpperCase() === normalizedAlt,
    )

    return conversion ? altQty * conversion.baseQty : 0
  }

  const getGroupUoms = (groupCode: string) => {
    const seen = new Set<string>()

    return conversions
      .filter(conversion => conversion.groupCode === groupCode)
      .filter(conversion => {
        const code = conversion.uomCode.toUpperCase()
        if (seen.has(code)) return false
        seen.add(code)
        return true
      })
  }

  const getSelectedGroup = (groupCode: string) =>
    uomGroups.find(group => group.code === groupCode)

  const getSelectedConversion = (groupCode: string, uomCode: string) =>
    conversions.find(
      conversion =>
        conversion.groupCode === groupCode &&
        conversion.uomCode.toUpperCase() === uomCode.toUpperCase(),
    )

  const getSelectedItem = (line: GoodsReceiptLine) =>
    items.find(item => item.id === line.itemId)

  const getItemGroupId = (item: Items) => {
    const rawGroup = String(item.item_group ?? '').trim()
    const numericGroup = Number(rawGroup)

    if (Number.isFinite(numericGroup) && numericGroup > 0) return numericGroup

    return itemGroupIdByCode.get(rawGroup.toUpperCase()) ?? null
  }

  const getBatchRuleForLine = (line: GoodsReceiptLine) => {
    const item = getSelectedItem(line)
    if (!item) return null

    const itemUsesBatch = Boolean(
      item.manage_batch_numbers ||
      (item.batch_management_method && item.batch_management_method !== 'NONE')
    )
    if (!itemUsesBatch) return null

    const itemGroupId = getItemGroupId(item)
    const matchedRules = batchRules.filter(rule => {
      if (rule.item_id && rule.item_id !== item.id) return false
      if (rule.warehouse_id && rule.warehouse_id !== line.warehouseId) return false
      if (rule.branch_id && rule.branch_id !== receipt.farmId) return false
      if (rule.item_group_id && rule.item_group_id !== itemGroupId) return false
      return true
    })

    return matchedRules.sort((left, right) => {
      const leftScore = Number(Boolean(left.item_id)) + Number(Boolean(left.warehouse_id)) + Number(Boolean(left.branch_id)) + Number(Boolean(left.item_group_id))
      const rightScore = Number(Boolean(right.item_id)) + Number(Boolean(right.warehouse_id)) + Number(Boolean(right.branch_id)) + Number(Boolean(right.item_group_id))
      return rightScore - leftScore
    })[0] ?? null
  }

  const getBatchRequirement = (line: GoodsReceiptLine) => {
    const item = getSelectedItem(line)
    if (!item) return null

    const itemUsesBatch = Boolean(
      item.manage_batch_numbers ||
      (item.batch_management_method && item.batch_management_method !== 'NONE')
    )
    if (!itemUsesBatch) return null

    const rule = getBatchRuleForLine(line)

    return {
      rule,
      needsBatchNumber: true,
      needsSupplierBatch: Boolean(rule?.require_supplier_batch),
      needsManufacturingDate: true,
      needsExpiryDate: getBatchSeriesForRule(rule)?.include_expiry_date !== false,
    }
  }

  const getBatchSeriesForRule = (rule?: GoodsReceiptBatchRule | null) =>
    rule?.series_id ? batchSeries.find(series => series.id === rule.series_id) ?? null : null

  const getBatchKey = (line: GoodsReceiptLine) =>
    line.itemCode && line.manufacturingDate
      ? `${line.itemCode.trim().toUpperCase()}|${line.manufacturingDate}|${line.expiryDate || 'NO_EXP'}`
      : ''

  const getExistingLineBatch = (line: GoodsReceiptLine) => {
    const batchKey = getBatchKey(line)
    if (!batchKey) return null

    return receipt.lines.find(candidate =>
      candidate.id !== line.id &&
      getBatchKey(candidate) === batchKey &&
      candidate.batchNumber.trim()
    ) ?? null
  }

  const getBatchNumberParts = (line: GoodsReceiptLine) => {
    const requirement = getBatchRequirement(line)
    const series = getBatchSeriesForRule(requirement?.rule)
    const item = getSelectedItem(line)
    const existingLineBatch = getExistingLineBatch(line)

    const lineIndex = receipt.lines.findIndex(candidate => candidate.id === line.id)
    const usedBatchKeys = new Set<string>()
    receipt.lines
      .slice(0, Math.max(0, lineIndex))
      .forEach(candidate => {
        const candidateBatchKey = getBatchKey(candidate)
        if (!candidateBatchKey || usedBatchKeys.has(candidateBatchKey)) return

        const candidateRule = getBatchRuleForLine(candidate)
        const candidateSeries = getBatchSeriesForRule(candidateRule)

        if (series) {
          if (candidateSeries?.id === series.id) usedBatchKeys.add(candidateBatchKey)
          return
        }

        if (!candidateSeries && Boolean(getBatchRequirement(candidate))) {
          usedBatchKeys.add(candidateBatchKey)
        }
      })

    const seriesOffset = usedBatchKeys.size

    const numberedSeries = series
      ? { ...series, next_number: Number(series.next_number) + seriesOffset }
      : {
          id: 0,
          code: 'GR',
          name: 'Item Stock In',
          prefix: 'FD',
          suffix: null,
          separator: '-',
          next_number: seriesOffset + 1,
          number_length: 5,
          date_format: 'YYMMDD' as GoodsReceiptBatchSeries['date_format'],
          include_expiry_date: true,
          active: true,
        }

    const dateFormat = numberedSeries.date_format
    const sequence = String(Math.max(0, Number(numberedSeries.next_number) || 0)).padStart(
      Math.max(1, Number(numberedSeries.number_length) || 1),
      '0',
    )
    const mfgPart = formatBatchDatePart(dateFormat, line.manufacturingDate)
    const includesExpiryDate = numberedSeries.include_expiry_date !== false
    const expPart = includesExpiryDate ? formatBatchDatePart(dateFormat, line.expiryDate) : ''

    return {
      templateSource: series ? `${series.code} - ${series.name}` : 'GR fallback template',
      prefix: numberedSeries.prefix ?? '',
      mfgPart,
      expPart,
      sequence,
      suffix: numberedSeries.suffix ?? '',
      separator: numberedSeries.separator,
      dateFormat,
      includesExpiryDate,
      defaultExpirationMonths: item?.default_expiration_months ?? null,
      batchNumber: line.manufacturingDate && (!includesExpiryDate || line.expiryDate)
        ? existingLineBatch?.batchNumber || buildBatchNumber(numberedSeries, line.manufacturingDate, line.expiryDate)
        : '',
      reusedFromLine: existingLineBatch,
    }
  }

  const getGeneratedBatchNumber = (line: GoodsReceiptLine) => {
    const requirement = getBatchRequirement(line)
    if (!requirement || !line.manufacturingDate || (requirement.needsExpiryDate && !line.expiryDate)) return ''

    return getBatchNumberParts(line).batchNumber
  }

  const openBatchDialog = (line: GoodsReceiptLine) => {
    const requirement = getBatchRequirement(line)
    if (!requirement) return

    updateLine(line.id, {
      batchRuleId: requirement.rule?.id ?? null,
    })

    setActiveBatchLineId(line.id)
  }

  const updateBatchLine = (line: GoodsReceiptLine, changes: Partial<GoodsReceiptLine>) => {
    const item = getSelectedItem(line)
    const requirement = getBatchRequirement(line)
    const defaultExpirationMonths = item?.default_expiration_months
    const shouldDefaultExpiry = Object.prototype.hasOwnProperty.call(changes, 'manufacturingDate') &&
      !Object.prototype.hasOwnProperty.call(changes, 'expiryDate') &&
      requirement?.needsExpiryDate !== false &&
      typeof defaultExpirationMonths === 'number'
    const defaultExpiryDate = shouldDefaultExpiry
      ? addMonthsToDate(changes.manufacturingDate ?? '', defaultExpirationMonths)
      : ''
    const nextChanges = {
      ...changes,
      ...(defaultExpiryDate ? { expiryDate: defaultExpiryDate } : {}),
    }
    const nextLine = { ...line, ...nextChanges }
    const generatedBatchNumber = getGeneratedBatchNumber(nextLine)

    updateLine(line.id, {
      ...nextChanges,
      ...(generatedBatchNumber ? { batchNumber: generatedBatchNumber } : {}),
    })
  }

  const refreshGeneratedBatchNumber = (line: GoodsReceiptLine) => {
    const existingBatch = batchMatches[String(line.id)]
    if (existingBatch?.batch_number) {
      updateLine(line.id, { batchNumber: existingBatch.batch_number })
      return
    }

    const generatedBatchNumber = getGeneratedBatchNumber(line)
    if (!generatedBatchNumber) {
      toast(line.expiryDate ? 'Enter manufacturing date first.' : 'Enter required batch dates first.')
      return
    }

    updateLine(line.id, { batchNumber: generatedBatchNumber })
  }

  const selectItem = (line: GoodsReceiptLine, itemCode: string) => {
    const item = availableItems.find(candidate => candidate.item_code === itemCode)
    if (!item) {
      updateLine(line.id, {
        itemId: null,
        itemCode: '',
        description: '',
        batchRuleId: null,
        batchNumber: '',
        supplierBatchNumber: '',
        manufacturingDate: '',
        expiryDate: '',
        altUom: '',
        baseUom: '',
      })
      return
    }

    const inventoryUom = item.inventory_uom || ''
    const unitMeasure = item.unit_measure || ''
    const selectedGroup = uomGroups.find(group => group.code.toUpperCase() === inventoryUom.toUpperCase())
    const selectedGroupCode = selectedGroup?.code ?? conversions.find(
      option => option.uomCode.toUpperCase() === unitMeasure.toUpperCase(),
    )?.groupCode ?? ''
    const uom = selectedGroup?.baseUomCode || unitMeasure || inventoryUom
    updateLine(line.id, {
      itemId: item.id,
      itemCode: item.item_code || '',
      description: getItemDescription(item),
      batchRuleId: null,
      batchNumber: '',
      supplierBatchNumber: '',
      manufacturingDate: '',
      expiryDate: '',
      altUom: uom,
      baseUom: selectedGroupCode,
      baseQty: calculateBaseQty(line.altQty, uom, selectedGroupCode),
    })
  }

  const selectWarehouse = (lineId: GoodsReceiptLine['id'], warehouseCode: string) => {
    const warehouse = farmWarehouses.find(candidate => candidate.whse_code === warehouseCode)
    updateLine(lineId, {
      warehouseId: warehouse?.id ?? null,
      warehouseCode: warehouse?.whse_code ?? '',
      warehouseName: warehouse?.whse_name ?? '',
      batchRuleId: null,
    })
  }

  const applyDefaultWarehouse = (warehouseId: string) => {
    const id = warehouseId ? Number(warehouseId) : null
    const warehouse = farmWarehouses.find(candidate => candidate.id === id)

    setReceipt(current => current ? {
      ...current,
      defaultWarehouseId: id,
      lines: current.lines.map(line => line.warehouseId ? line : {
        ...line,
        warehouseId: warehouse?.id ?? null,
        warehouseCode: warehouse?.whse_code ?? '',
        warehouseName: warehouse?.whse_name ?? '',
      }),
    } : current)
  }

  const selectFarm = (farmId: string) => {
    const farm = farms.find(candidate => String(candidate.id) === farmId)
    const availableFarmWarehouses = getWarehousesForFarm(farm, warehouses)
    const defaultWarehouse = getDefaultReceivingWarehouse(farm, availableFarmWarehouses)
    const allowedCodes = new Set(
      (farm?.associated_warehouses ?? [])
        .map(getAssociatedWarehouseCode)
        .filter(Boolean)
    )

    setReceipt(current => current ? {
      ...current,
      farmId: farm?.id ?? null,
      farmCode: farm?.code ?? '',
      farmName: farm?.name ?? '',
      fmsType: getFarmFmsType(farm) || getWarehouseFmsType(defaultWarehouse),
      defaultWarehouseId: defaultWarehouse?.id ?? null,
      lines: current.lines.map(line =>
        allowedCodes.has(line.warehouseCode)
          ? line
          : {
            ...line,
            warehouseId: defaultWarehouse?.id ?? null,
            warehouseCode: defaultWarehouse?.whse_code ?? '',
            warehouseName: defaultWarehouse?.whse_name ?? '',
          }
      ),
    } : current)
  }

  const canEditDraft = receipt.status === 'Draft'
  const canPostDocument = isPostMode && receipt.status === 'Draft'

  const handleSave = async (targetStatus: 'Draft' | 'Posted') => {
    const completedLines = receipt.lines.filter(line => line.itemId)
    const posting = targetStatus === 'Posted'
    const completeLines = completedLines.filter(line =>
      line.itemCode &&
      line.baseUom &&
      line.altUom &&
      line.baseQty > 0 &&
      (!posting || line.warehouseId)
    )

    if (!canEditDraft) {
      toast('Only draft documents can be edited or posted.')
      return
    }

    if (!receipt.vendor.trim()) {
      toast('Please enter a vendor.')
      return
    }
    if (!receipt.fmsType) {
      toast('Please select an FMS type.')
      return
    }
    if (!receipt.farmId) {
      toast('Please select a farm.')
      return
    }
    if (posting && completedLines.length === 0) {
      toast('Please select at least one item.')
      return
    }
    if (posting && completedLines.some(line =>
      !line.warehouseId ||
      !line.baseUom ||
      !line.altUom ||
      line.baseQty <= 0
    )) {
      toast('Each item needs a warehouse, UoM group, Alt UoM, and a valid conversion.')
      return
    }
    const missingBatchLine = completedLines.find(line => {
      const requirement = getBatchRequirement(line)
      if (!requirement) return false

      return (requirement.needsSupplierBatch && !line.supplierBatchNumber.trim()) ||
        (requirement.needsManufacturingDate && !line.manufacturingDate) ||
        (requirement.needsExpiryDate && !line.expiryDate)
    })

    if (missingBatchLine) {
      toast(`Please enter batch details for ${missingBatchLine.itemCode}.`)
      return
    }
    if (!posting && completedLines.length !== completeLines.length) {
      toast('Incomplete item lines are ignored when saving draft.')
    }

    setSaving(true)
    try {
      const savedReceipt = await saveGoodsReceipt({
        ...receipt,
        status: targetStatus,
        lines: (posting ? completedLines : completeLines).map(line => ({
          ...line,
          batchRuleId: getBatchRuleForLine(line)?.id ?? null,
          batchNumber: line.batchNumber.trim() || getGeneratedBatchNumber(line),
        })),
      })
      toast(posting ? 'Goods receipt posted successfully.' : 'Goods receipt draft saved.')

      if (posting) {
        router.push('/inv/gr')
        return
      }

      if (!isPostMode && savedReceipt?.id) {
        router.push(`/inv/gr/post?id=${savedReceipt.id}`)
        return
      }

      if (savedReceipt) setReceipt(savedReceipt)
    } catch (error) {
      console.log({ error })
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to save goods receipt'))
    } finally {
      setSaving(false)
    }
  }

  const activeBatchLine = receipt.lines.find(line => line.id === activeBatchLineId) ?? null
  const activeBatchRequirement = activeBatchLine ? getBatchRequirement(activeBatchLine) : null
  const activeBatchSeries = getBatchSeriesForRule(activeBatchRequirement?.rule)
  const activeBatchParts = activeBatchLine ? getBatchNumberParts(activeBatchLine) : null
  const activeBatchMatch = activeBatchLine ? batchMatches[String(activeBatchLine.id)] ?? null : null
  const activeLineBatchMatch = activeBatchParts?.reusedFromLine ?? null
  const activeBatchDateText = activeBatchRequirement?.needsExpiryDate ? 'MFG and EXP dates' : 'MFG date'
  const activeBatchStatus = activeBatchMatch
    ? 'Existing database batch'
    : activeLineBatchMatch
      ? 'Reusing current GR batch'
      : activeBatchLine?.batchNumber
        ? 'New batch to create'
        : activeBatchRequirement?.needsExpiryDate
          ? 'Waiting for dates'
          : 'Waiting for MFG date'

  return (
    <main className="min-h-[calc(100vh-80rem)]">
      <div className="mx-4 mt-4 flex items-center justify-between gap-3">
        <Breadcrumb
          SecondPreviewPageName="Inventory"
          SecondPreviewPageLink="/inv"
          FirstPreviewsPageName="Item Stock In"
          FirstPreviewsPageLink="/inv/gr"
          CurrentPageName={isPostMode ? 'Post GR' : 'New GR'}
        />
        <Button type="button" variant="outline" onClick={() => router.push('/inv/gr')}>
          <List className="size-4" />
          GR List
        </Button>
      </div>

      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid gap-x-16 gap-y-3 p-5 lg:grid-cols-2">
          <div className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)]">
            <label className="text-sm font-semibold">GR No.</label>
            <div className="flex items-center gap-1">
              <Input value={receipt.grNo} readOnly className="bg-stone-50" />
              <span className={getInventoryStatusBadgeClass(receipt.status)}>
                {receipt.status}
              </span>
            </div>
          </div>

          <div className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)]">
            <label className="text-sm font-semibold">Vendor</label>
            <Input
              value={receipt.vendor}
              onChange={event => setReceipt(current => current ? { ...current, vendor: event.target.value } : current)}
              placeholder="Enter vendor"
            />
          </div>

          <div className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)]">
            <label className="text-sm font-semibold">Farm</label>
            <SearchableCombobox
              items={farmOptions}
              value={receipt.farmId == null ? '' : String(receipt.farmId)}
              onValueChange={selectFarm}
              showCode={false}
              placeholder={loadingReferences ? 'Loading farms...' : 'Select farm...'}
              className="w-full"
            />
            {!loadingReferences && farms.length === 0 && (
              <p className="text-xs text-stone-500">No assigned farms available.</p>
            )}
          </div>

          <div className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)]">
            <label className="text-sm font-semibold">Receive Date</label>
            <label className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-2.5 size-4" />
              <Input
                type="date"
                value={receipt.receiveDate}
                onChange={event => setReceipt(current => current ? { ...current, receiveDate: event.target.value } : current)}
                className="pl-9"
              />
            </label>
          </div>

          <div className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)] lg:col-span-2">
            <label className="text-sm font-semibold">Default WH</label>
            <select
              value={receipt.defaultWarehouseId ?? ''}
              disabled={loadingReferences || !receipt.farmId}
              onChange={event => applyDefaultWarehouse(event.target.value)}
              className="h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-stone-200"
            >
              <option value="">
                {loadingReferences
                  ? 'Loading warehouses...'
                  : receipt.farmId
                    ? 'Select default warehouse...'
                    : 'Select farm first'}
              </option>
              {farmWarehouses.map(warehouse => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.whse_code} - {warehouse.whse_name}
                </option>
              ))}
            </select>
            {!loadingReferences && Boolean(receipt.farmId) && farmWarehouses.length === 0 && (
              <p className="text-xs text-stone-500">No warehouses associated with this farm.</p>
            )}
          </div>

          <div className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)] lg:col-span-2">
            <label className="text-sm font-semibold">FMS Type</label>
            <select
              value={receipt.fmsType}
              disabled
              className="h-9 w-full rounded-md border bg-stone-100 px-3 text-sm text-stone-700 outline-none disabled:cursor-not-allowed disabled:opacity-100"
            >
              <option value="">Select FMS type...</option>
              {FMS_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t p-5">
          <FormTable
            title="Receive Item Lines"
            description={`${receipt.lines.length} ${receipt.lines.length === 1 ? 'line' : 'lines'}`}
            emptyState={receipt.lines.length === 0 && (
              <div className="border-t px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No item lines added</p>
                <p className="mt-1 text-sm text-muted-foreground">Use Add Lines to continue.</p>
              </div>
            )}
            footer={(
              <FormTableFooter>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={lineCount}
                  onChange={event => setLineCount(Math.max(1, numberValue(event.target.value)))}
                  className="w-20"
                  aria-label="Number of lines to add"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReceipt(current => current ? {
                    ...current,
                    lines: [...current.lines, ...Array.from({ length: lineCount }, newLine)],
                  } : current)}
                >
                  <Plus className="size-4" />
                  Add Lines
                </Button>
              </FormTableFooter>
            )}
          >
              <table className="min-w-[1480px] w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="h-10 w-12 whitespace-nowrap px-3 text-center align-middle text-xs font-semibold uppercase text-stone-700">#</th>
                    <th className="h-10 min-w-80 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Item Code &amp; Description</th>
                    <th className="h-10 min-w-72 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Batch</th>
                    <th className="h-10 w-44 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Base UOM Group</th>
                    <th className="h-10 w-28 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Alt Qty</th>
                    <th className="h-10 w-28 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Alt UoM</th>
                    <th className="h-10 w-52 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Conversion UoM</th>
                    <th className="h-10 min-w-48 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Warehouse</th>
                    <th className="h-10 w-20 whitespace-nowrap px-3 text-center align-middle text-xs font-semibold uppercase text-stone-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {receipt.lines.map((line, index) => {
                    const batchRequirement = getBatchRequirement(line)

                    return (
                      <tr key={line.id} className="odd:bg-card even:bg-secondary/40 hover:bg-accent/30">
                        <td className="px-3 py-3 text-center align-middle text-stone-500">{index + 1}</td>
                        <td className="px-3 py-2 align-middle">
                          <SearchableDropdown
                            list={itemDropdownOptions}
                            codeLabel="item_code"
                            nameLabel="itemDisplayDescription"
                            value={line.itemCode}
                            placeholder={receipt.fmsType ? 'Select item...' : 'Select FMS type first'}
                            width={420}
                            onChange={(value) => selectItem(line, value)}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          {batchRequirement ? (
                            <button
                              type="button"
                              onClick={() => openBatchDialog(line)}
                              className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-stone-300 bg-white px-3 py-2 text-left text-sm shadow-none transition hover:border-stone-500 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-200"
                            >
                              <span className="min-w-0">
                                <span className="flex items-center gap-2 font-medium text-stone-900">
                                  <PackageCheck className="size-4 shrink-0 text-stone-500" />
                                  <span className="truncate">
                                    {line.batchNumber || 'Batch details'}
                                  </span>
                                </span>
                                <span className="mt-1 flex flex-wrap gap-1 text-xs text-stone-500">
                                  {line.manufacturingDate && <span>MFG {line.manufacturingDate}</span>}
                                  {line.expiryDate && <span>EXP {line.expiryDate}</span>}
                                  {(!line.manufacturingDate || (batchRequirement.needsExpiryDate && !line.expiryDate)) && (
                                    <span>{batchRequirement.needsExpiryDate ? 'MFG/EXP required' : 'MFG required'}</span>
                                  )}
                                </span>
                              </span>
                              <Hash className="size-4 shrink-0 text-stone-400" />
                            </button>
                          ) : (
                            <span className="inline-flex h-9 items-center text-stone-400">Not required</span>
                          )}
                        </td>
                      <td className="px-3 py-2 align-middle">
                        <select
                          value={line.baseUom}
                          disabled
                          onChange={event => {
                            const groupCode = event.target.value
                            const altUomIsAvailable = conversions.some(
                              conversion =>
                                conversion.groupCode === groupCode &&
                                conversion.uomCode.toUpperCase() === line.altUom.toUpperCase(),
                            )
                            const altUom = altUomIsAvailable ? line.altUom : ''

                            updateLine(line.id, {
                              baseUom: groupCode,
                              altUom,
                              baseQty: calculateBaseQty(line.altQty, altUom, groupCode),
                            })
                          }}
                          className="h-9 w-full rounded-md border border-stone-300 bg-stone-100 px-2 text-sm text-stone-600 outline-none transition disabled:cursor-not-allowed disabled:opacity-100"
                        >
                          <option value="">Select UoM group</option>
                          {uomGroups.map(group => (
                            <option key={group.id} value={group.code}>
                              {group.code} - {group.name} ({group.baseUomCode})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={line.altQty}
                          onChange={event => updateLine(line.id, {
                            altQty: numberValue(event.target.value),
                            baseQty: calculateBaseQty(
                              numberValue(event.target.value),
                              line.altUom,
                              line.baseUom,
                            ),
                          })}
                          className="border-stone-300 bg-white shadow-none focus-visible:ring-stone-200"
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <select
                          value={line.altUom}
                          disabled={!line.baseUom}
                          onChange={event => {
                            const altUom = event.target.value
                            updateLine(line.id, {
                              altUom,
                              baseQty: calculateBaseQty(line.altQty, altUom, line.baseUom),
                            })
                          }}
                          className="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm outline-none transition focus:border-stone-500 focus:ring-2 focus:ring-stone-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:opacity-60"
                        >
                          <option value="">
                            {line.baseUom ? 'Select Alt UoM' : 'Select group first'}
                          </option>
                          {getGroupUoms(line.baseUom).map(conversion => (
                            <option
                              key={`${conversion.groupId}-${conversion.uomCode}`}
                              value={conversion.uomCode}
                            >
                              {conversion.uomCode}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 align-middle text-stone-800">
                        {line.baseUom && line.altUom ? (
                          <div className="whitespace-nowrap">
                            <span className="font-medium tabular-nums">
                              {line.baseQty.toLocaleString('en-PH', { maximumFractionDigits: 6 })}
                            </span>{' '}
                            <span className="text-stone-600">
                              {getSelectedGroup(line.baseUom)?.baseUomCode}
                            </span>
                            <div className="text-xs text-stone-500">
                              {line.altQty.toLocaleString('en-PH', { maximumFractionDigits: 6 })}{' '}
                              {line.altUom} ×{' '}
                              {getSelectedConversion(line.baseUom, line.altUom)?.baseQty.toLocaleString(
                                'en-PH',
                                { maximumFractionDigits: 6 },
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-stone-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <SearchableDropdown
                          list={farmWarehouses}
                          codeLabel="whse_code"
                          nameLabel="whse_name"
                          value={line.warehouseCode}
                          placeholder={receipt.farmId ? 'Select warehouse...' : 'Select farm first'}
                          width={360}
                          onChange={(value) => selectWarehouse(line.id, value)}
                        />
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => setReceipt(current => current ? {
                            ...current,
                            lines: current.lines.filter(candidate => candidate.id !== line.id),
                          } : current)}
                          className="inline-flex size-8 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                          aria-label={`Delete line ${index + 1}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
          </FormTable>

          <Dialog open={Boolean(activeBatchLine)} onOpenChange={open => !open && setActiveBatchLineId(null)}>
            <DialogContent
              className="max-h-[85vh] overflow-y-auto sm:max-w-4xl"
              onKeyDown={event => {
                if (event.key !== 'Enter' || event.shiftKey) return

                const target = event.target as HTMLElement
                if (target.closest('button')) return

                event.preventDefault()
                setActiveBatchLineId(null)
              }}
            >
              <DialogHeader>
                <DialogTitle>Batch Details</DialogTitle>
                <DialogDescription>
                  {activeBatchLine?.itemCode || 'Selected item'} batch information for this receipt line.
                </DialogDescription>
              </DialogHeader>

              {activeBatchLine && activeBatchRequirement && (
                <Tabs defaultValue="details" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="details">Batch Details</TabsTrigger>
                    <TabsTrigger value="trail">Transaction Trail</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4">
                    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {activeBatchRequirement.rule?.auto_generate || !activeBatchRequirement.rule ? 'Auto number' : 'Manual number'}
                        </Badge>
                        {activeBatchRequirement.rule?.manual_entry && (
                          <Badge variant="outline">Manual edits allowed</Badge>
                        )}
                        {activeBatchSeries && (
                          <Badge variant="secondary">{activeBatchSeries.code}</Badge>
                        )}
                        <Badge
                          className={
                            activeBatchMatch || activeLineBatchMatch
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                              : activeBatchLine?.batchNumber
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-100'
                          }
                        >
                          {activeBatchStatus}
                        </Badge>
                        {(activeBatchMatch || activeLineBatchMatch) && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Reusing batch
                          </Badge>
                        )}
                      </div>
                    </div>

                    {activeBatchMatch && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                        This item already has a batch for the selected {activeBatchDateText}. GR will use batch{' '}
                        <span className="font-semibold">{activeBatchMatch.batch_number}</span>.
                      </div>
                    )}

                    {!activeBatchMatch && activeLineBatchMatch && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                        Another line in this GR already uses the same item and {activeBatchDateText}. This line will use batch{' '}
                        <span className="font-semibold">{activeLineBatchMatch.batchNumber}</span>.
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      {activeBatchRequirement.needsManufacturingDate && (
                        <div className="space-y-2">
                          <Label htmlFor="gr-manufacturing-date" required>Manufacturing Date</Label>
                          <Input
                            id="gr-manufacturing-date"
                            type="date"
                            value={activeBatchLine.manufacturingDate}
                            onChange={event => updateBatchLine(activeBatchLine, { manufacturingDate: event.target.value })}
                            className="border-stone-300 bg-white shadow-none focus-visible:ring-stone-200"
                          />
                        </div>
                      )}

                      {activeBatchRequirement.needsExpiryDate && (
                        <div className="space-y-2">
                          <Label htmlFor="gr-expiry-date" required>Expiry Date</Label>
                          <Input
                            id="gr-expiry-date"
                            type="date"
                            value={activeBatchLine.expiryDate}
                            onChange={event => updateBatchLine(activeBatchLine, { expiryDate: event.target.value })}
                            className="border-stone-300 bg-white shadow-none focus-visible:ring-stone-200"
                          />
                        </div>
                      )}

                      {activeBatchRequirement.needsSupplierBatch && (
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="gr-supplier-batch" required>Supplier Batch Number</Label>
                          <Input
                            id="gr-supplier-batch"
                            value={activeBatchLine.supplierBatchNumber}
                            onChange={event => updateLine(activeBatchLine.id, { supplierBatchNumber: event.target.value })}
                            placeholder="Supplier batch no."
                            className="border-stone-300 bg-white shadow-none focus-visible:ring-stone-200"
                          />
                        </div>
                      )}

                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="gr-batch-number">Generated Batch Number</Label>
                        <div className="flex gap-2">
                          <Input
                            id="gr-batch-number"
                            value={activeBatchLine.batchNumber}
                            readOnly={!activeBatchRequirement.rule?.manual_entry && Boolean(activeBatchRequirement.rule)}
                            onChange={event => updateLine(activeBatchLine.id, { batchNumber: event.target.value })}
                            placeholder={activeBatchRequirement.needsExpiryDate ? 'Enter MFG and EXP dates to generate' : 'Enter MFG date to generate'}
                            className="border-stone-300 bg-white shadow-none focus-visible:ring-stone-200"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => refreshGeneratedBatchNumber(activeBatchLine)}
                          >
                            <Hash className="size-4" />
                            Generate
                          </Button>
                        </div>
                      </div>

                      {activeBatchParts && (
                        <div className="space-y-3 rounded-md border border-stone-200 bg-stone-50 p-3 sm:col-span-2">
                          <div className="grid gap-3 sm:grid-cols-4">
                            <div className="space-y-2">
                              <Label htmlFor="gr-batch-source">Template Source</Label>
                              <Input
                                id="gr-batch-source"
                                value={activeBatchParts.templateSource}
                                disabled
                                className="border-stone-300 bg-white text-stone-700 disabled:opacity-100"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="gr-batch-date-format">Date Format</Label>
                              <Input
                                id="gr-batch-date-format"
                                value={activeBatchParts.dateFormat}
                                disabled
                                className="border-stone-300 bg-white text-stone-700 disabled:opacity-100"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="gr-batch-exp-months">Exp. Months</Label>
                              <Input
                                id="gr-batch-exp-months"
                                value={activeBatchParts.defaultExpirationMonths == null ? '-' : String(activeBatchParts.defaultExpirationMonths)}
                                disabled
                                className="border-stone-300 bg-white text-stone-700 disabled:opacity-100"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="gr-batch-separator">Separator</Label>
                              <Input
                                id="gr-batch-separator"
                                value={activeBatchParts.separator}
                                disabled
                                className="border-stone-300 bg-white text-stone-700 disabled:opacity-100"
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-5">
                            <div className="space-y-2">
                              <Label htmlFor="gr-batch-prefix">Prefix</Label>
                              <Input
                                id="gr-batch-prefix"
                                value={activeBatchParts.prefix || '-'}
                                disabled
                                className="border-stone-300 bg-white text-stone-700 disabled:opacity-100"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="gr-batch-mfg-part">MFG Part</Label>
                              <Input
                                id="gr-batch-mfg-part"
                                value={activeBatchParts.mfgPart || '-'}
                                disabled
                                className="border-stone-300 bg-white text-stone-700 disabled:opacity-100"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="gr-batch-exp-part">EXP Part</Label>
                              <Input
                                id="gr-batch-exp-part"
                                value={activeBatchParts.expPart || '-'}
                                disabled
                                className="border-stone-300 bg-white text-stone-700 disabled:opacity-100"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="gr-batch-sequence">Sequence</Label>
                              <Input
                                id="gr-batch-sequence"
                                value={activeBatchParts.sequence}
                                disabled
                                className="border-stone-300 bg-white text-stone-700 disabled:opacity-100"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="gr-batch-suffix">Suffix</Label>
                              <Input
                                id="gr-batch-suffix"
                                value={activeBatchParts.suffix || '-'}
                                disabled
                                className="border-stone-300 bg-white text-stone-700 disabled:opacity-100"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="trail" className="space-y-4">
                    <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm sm:grid-cols-4">
                      <div>
                        <div className="text-xs font-medium text-amber-700">Batch</div>
                        <div className="truncate font-semibold text-stone-950">{activeBatchLine.batchNumber || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-amber-700">Item</div>
                        <div className="truncate font-semibold text-stone-950">{activeBatchLine.itemCode || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-amber-700">Warehouse</div>
                        <div className="font-semibold text-stone-950">{activeBatchLine.warehouseCode || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-amber-700">Line Quantity</div>
                        <div className="font-semibold tabular-nums text-stone-950">{formatQuantity(activeBatchLine.baseQty)}</div>
                      </div>
                    </div>

                    {loadingBatchTrail && (
                      <div className="flex min-h-32 items-center justify-center gap-2 rounded-md border border-dashed border-stone-300 bg-white text-sm text-stone-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading transaction trail...
                      </div>
                    )}

                    {!loadingBatchTrail && (!activeBatchLine.batchNumber || !activeBatchLine.itemCode) && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                        Enter an item and batch number to view the transaction trail.
                      </div>
                    )}

                    {!loadingBatchTrail && activeBatchLine.batchNumber && activeBatchLine.itemCode && batchTrailRows.length === 0 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                        No inventory postings were found for this batch.
                      </div>
                    )}

                    {!loadingBatchTrail && batchTrailRows.length > 0 && (
                      <div className="relative space-y-3 pl-5">
                        <div className="absolute left-[11px] top-2 h-[calc(100%-1rem)] w-px bg-amber-200" />
                        {batchTrailRows.map(row => {
                          const isOut = row.signedQty < 0
                          const movementLabel = isOut ? 'OUT' : 'IN'

                          return (
                            <div key={row.id} className="relative rounded-md border border-stone-200 bg-white p-3 shadow-sm">
                              <div className={`absolute -left-[17px] top-4 flex h-7 w-7 items-center justify-center rounded-full border bg-white ${isOut ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-700'}`}>
                                <ArrowRightCircle className={`h-4 w-4 ${isOut ? 'rotate-180' : ''}`} />
                              </div>

                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${isOut ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                      {movementLabel}
                                    </span>
                                    <span className="font-semibold text-stone-950">{row.documentLabel}</span>
                                    <span className="text-xs text-stone-500">{row.sourceDocType || '-'}</span>
                                  </div>
                                  <div className="mt-1 text-xs text-stone-500">
                                    {formatDateTime(row.createdAt)}
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className={`text-sm font-semibold tabular-nums ${isOut ? 'text-red-700' : 'text-emerald-700'}`}>
                                    {isOut ? '-' : '+'}{formatQuantity(Math.abs(row.signedQty))}
                                  </div>
                                  <div className="text-xs text-stone-500">
                                    Balance {formatQuantity(row.runningQty)}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-2 text-xs text-stone-600 sm:grid-cols-4">
                                <div className="rounded-md bg-stone-50 px-2 py-1">
                                  <span className="block font-medium text-stone-500">Warehouse</span>
                                  <span className="text-stone-900">{row.warehouseCode || '-'}</span>
                                </div>
                                <div className="rounded-md bg-stone-50 px-2 py-1">
                                  <span className="block font-medium text-stone-500">Bin</span>
                                  <span className="text-stone-900">{row.binCode || '-'}</span>
                                </div>
                                <div className="rounded-md bg-stone-50 px-2 py-1">
                                  <span className="block font-medium text-stone-500">Reference</span>
                                  <span className="text-stone-900">{row.ref || row.ref2 || '-'}</span>
                                </div>
                                <div className="rounded-md bg-stone-50 px-2 py-1">
                                  <span className="block font-medium text-stone-500">Posting ID</span>
                                  <span className="text-stone-900">#{row.id}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button">Done</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="mt-6 flex flex-col items-end gap-4">
            <div className="w-full rounded-xl border p-4 sm:w-[34rem]">
              <h3 className="text-sm font-semibold">Receiving Summary</h3>
              <div className="mt-3 flex justify-between text-sm">
                <span>Total Base Quantity</span>
                <span className="font-medium tabular-nums">
                  {totalQuantity.toLocaleString('en-PH', { maximumFractionDigits: 6 })}
                </span>
              </div>
            </div>

            {canEditDraft ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSave('Draft')}
                  disabled={saving}
                >
                  <Save className="size-4" />
                  {saving ? 'Saving...' : 'Save as Draft'}
                </Button>
                {canPostDocument && (
                  <Button type="button" onClick={() => setPostConfirmOpen(true)} disabled={saving}>
                    <Save className="size-4" />
                    {saving ? 'Posting...' : 'Post Document'}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-stone-500">This document is already posted and cannot be edited.</p>
            )}
          </div>
        </div>
      </section>

      <Dialog open={postConfirmOpen} onOpenChange={open => !saving && setPostConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post this goods receipt?</DialogTitle>
            <DialogDescription>
              Posting {receipt.grNo} will add inventory for the selected receipt lines and cannot be edited afterward.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">Total Base Quantity</span>
              <span className="font-semibold tabular-nums">
                {totalQuantity.toLocaleString('en-PH', { maximumFractionDigits: 6 })}
              </span>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={saving}
              onClick={async () => {
                await handleSave('Posted')
                setPostConfirmOpen(false)
              }}
            >
              <Save className="size-4" />
              {saving ? 'Posting...' : 'Confirm Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
