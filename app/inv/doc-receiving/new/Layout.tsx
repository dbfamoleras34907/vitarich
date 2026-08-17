'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRightCircle,
  ChevronDown,
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
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FormTable } from '@/components/ui/form-table'
import SearchableCombobox from '@/components/SearchableCombobox'
import SearchableDropdown from '@/lib/SearchableDropdown'
import Breadcrumb from '@/lib/Breadcrumb'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { useSidebar } from '@/lib/sidebar/SidebarProvider'
import { usePermission } from '@/hooks/usePermission'
import { Items, WarehouseData } from '@/lib/types'
import { getInventoryStatusBadgeClass } from '@/app/inv/statusStyles'
import {
  createGoodsReceiptNumber,
  getFirstDocPlacementDates,
  getGoodsReceiptById,
  GoodsReceipt,
  GoodsReceiptDocLine,
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
  GoodsReceiptOpenFlockBuilding,
  UomConversionOption,
  UomGroupOption,
} from './api'
import {
  DocReceivingSettings,
  getDocReceivingSettings,
} from '@/app/a_dean/doc-receiving-settings/api'
import {
  BatchTransactionTrail,
  getBatchTransactionTrail,
} from '../../btch/api'
import {
  getFarmBuildingsForFlockCard,
  type FarmBuildingListRow,
} from '@/app/brd/fc/api'
import {
  ensureActiveDocFarmCycle,
  isDocCycleBuildingExcluded,
  previewDocFarmCycle,
  saveFlockCardPlacement,
} from '@/app/brd/fc/[buildingId]/add-flock/api'
import CycleInformationModal, {
  type CycleInformationForm,
} from './CycleInformationModal'

const DOC_RECEIVING_DETAIL_COLUMNS = [
  { code: 'receive_date', name: 'Date Receive' },
  { code: 'receive_time', name: 'Time Receive' },
  { code: 'mnf_date', name: 'Production Date' },
  { code: 'doc_source', name: 'DOC Source' },
  { code: 'building', name: 'Building' },
  { code: 'transfer_slip', name: 'Hatchery Ref' },
  { code: 'average_doc_weight', name: 'Average DOC Weight' },
  { code: 'quantity_received', name: 'Total Received' },
  { code: 'doa_quantity', name: 'DOA Count' },
  { code: 'reject_count', name: 'Reject Count' },
  { code: 'short_count', name: 'Short Count' },
  { code: 'actual_received', name: 'Actual Received' },
  { code: 'short_count_remarks', name: 'Short Count Remarks' },
  { code: 'doa_count_remarks', name: 'DOA Count Remarks' },
  { code: 'reject_count_remarks', name: 'Reject Count Remarks' },
]

const DOC_RECEIVING_MODAL_GROUPS = [
  {
    key: 'receiving',
    codes: ['receive_date', 'receive_time', 'mnf_date', 'doc_source', 'building', 'transfer_slip'],
  },
  {
    key: 'quantities',
    codes: [
      'average_doc_weight',
      'quantity_received',
      'doa_quantity',
      'reject_count',
      'short_count',
      'actual_received',
    ],
  },
  {
    key: 'remarks',
    codes: ['short_count_remarks', 'doa_count_remarks', 'reject_count_remarks'],
  },
].map(group => ({
  ...group,
  columns: group.codes.flatMap(code => {
    const column = DOC_RECEIVING_DETAIL_COLUMNS.find(candidate => candidate.code === code)
    return column ? [column] : []
  }),
}))

const DOC_RECEIVING_NUMERIC_DETAIL_CODES = new Set([
  'average_doc_weight',
  'quantity_received',
  'actual_received',
  'doa_quantity',
  'short_count',
  'reject_count',
])

const DOC_RECEIVING_DATE_DETAIL_CODES = new Set([
  'receive_date',
  'mnf_date',
])

const DOC_RECEIVING_DETAIL_UNITS: Record<string, string> = {
  average_doc_weight: 'in Grams',
  quantity_received: 'in PC',
  doa_quantity: 'in PC',
  reject_count: 'in PC',
  short_count: 'in PC',
  actual_received: 'in PC',
}

const DOC_RECEIVING_ALIGNED_HEADER_CODES = new Set([
  'receive_date',
  'receive_time',
  'mnf_date',
  'doc_source',
  'building',
  'transfer_slip',
  'short_count_remarks',
  'doa_count_remarks',
  'reject_count_remarks',
])

type DocDetailRow = GoodsReceiptDocLine & {
  id: number | string
  receive_date: string
  receive_time: string
  mnf_date: string
  doc_source: string
  building_warehouse_id: number | null
  flock_card_id: number | null
  transfer_slip: string
  average_doc_weight: string
  quantity_received: string
  actual_received: string
  short_count: string
  short_count_remarks: string
  doa_quantity: string
  doa_count_remarks: string
  reject_count: string
  reject_count_remarks: string
}

type DerivedGoodsReceiptLine = GoodsReceiptLine & {
  docBatchSeparated?: boolean
  docBatchReference?: string
  docBatchReferenceKey?: string
  docBatchReferenceColumn?: string
}

const createClientId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

const defaultNumericDetailValue = (value: string | number | null | undefined) => {
  const text = String(value ?? '').trim()
  return text === '' ? '0' : text
}

const calculateActualReceived = (row: Partial<DocDetailRow>) => Math.max(
  numberValue(String(row.quantity_received ?? '')) -
  numberValue(String(row.doa_quantity ?? '')) -
  numberValue(String(row.reject_count ?? '')) -
  numberValue(String(row.short_count ?? '')),
  0,
)

const normalizeDocDetailRow = (
  row: Partial<DocDetailRow>,
  receiveDate = '',
): DocDetailRow => {
  const shortCount = row.short_count ?? Math.max(
    numberValue(String(row.quantity_received ?? '')) -
    numberValue(String(row.actual_received ?? '')) -
    numberValue(String(row.doa_quantity ?? '')) -
    numberValue(String(row.reject_count ?? '')),
    0,
  )
  const normalized = {
    id: row.id ?? createClientId(),
    receive_date: row.receive_date || receiveDate,
    receive_time: row.receive_time ?? '',
    mnf_date: row.mnf_date ?? '',
    doc_source: row.doc_source ?? '',
    building_warehouse_id: row.building_warehouse_id ?? null,
    flock_card_id: row.flock_card_id ?? null,
    transfer_slip: row.transfer_slip ?? '',
    average_doc_weight: defaultNumericDetailValue(row.average_doc_weight),
    quantity_received: defaultNumericDetailValue(row.quantity_received),
    actual_received: defaultNumericDetailValue(row.actual_received),
    short_count: defaultNumericDetailValue(shortCount),
    short_count_remarks: row.short_count_remarks ?? '',
    doa_quantity: defaultNumericDetailValue(row.doa_quantity),
    doa_count_remarks: row.doa_count_remarks ?? '',
    reject_count: defaultNumericDetailValue(row.reject_count),
    reject_count_remarks: row.reject_count_remarks ?? '',
  }

  return {
    ...normalized,
    actual_received: String(calculateActualReceived(normalized)),
  }
}

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

const FUTURE_RECEIVING_DATE_MESSAGE = 'DOC Placement dates cannot be advanced/future-dated.'

const isFutureReceivingDate = (value: string) => Boolean(value) && value > today()

const calendarDayNumber = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null

  return Math.floor(date.getTime() / 86_400_000)
}

const calculateCycleRange = (startDate: string, asOfDate: string) => {
  const start = calendarDayNumber(startDate)
  const end = calendarDayNumber(asOfDate)
  if (start == null || end == null) return 0
  return Math.max(0, end - start)
}

const placementAge = (firstPlacementDate: string, receiveDate: string) => {
  const start = calendarDayNumber(firstPlacementDate)
  const placement = calendarDayNumber(receiveDate)
  if (start == null || placement == null) return Number.POSITIVE_INFINITY
  return placement - start
}

const DOC_PLACEMENT_WINDOW_LAST_DAY_OFFSET = 6

const isOutsideDocPlacementWindow = (age: number) => (
  age < 0 || age > DOC_PLACEMENT_WINDOW_LAST_DAY_OFFSET
)

const formatCalendarDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${month}/${day}/${year}` : value
}

const addDaysToDate = (value: string, days: number) => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const emptyCycleForm = (): CycleInformationForm => ({
  startDate: '',
  breed: '',
  cycleNumber: '1',
})

const newLine = (): GoodsReceiptLine => ({
  id: createClientId(),
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
  remarks: '',
  status: 'Draft',
  lines: Array.from({ length: 1 }, newLine),
  docDetails: [],
  createdAt: new Date().toISOString(),
})

const duplicateReceipt = (source: GoodsReceipt, grNo: string): GoodsReceipt => ({
  ...source,
  id: null,
  grNo,
  status: 'Draft',
  lines: source.lines.map(line => ({
    ...line,
    id: createClientId(),
    returnedQty: 0,
  })),
  docDetails: source.docDetails.map(row => normalizeDocDetailRow({
    ...row,
    id: createClientId(),
  }, source.receiveDate)),
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

const getFarmFmsType = (farm: GoodsReceiptFarm | undefined | null) =>
  FARM_TYPE_TO_FMS_TYPE[String(farm?.farm_type ?? '').trim().toUpperCase()] ?? ''

const getAssociatedWarehouseCode = (warehouse: AssociatedWarehouse | string) =>
  typeof warehouse === 'string'
    ? warehouse.trim()
    : String(warehouse.whse_code ?? '').trim()

const isDefaultDisposalAssociation = (warehouse: AssociatedWarehouse | string) =>
  typeof warehouse === 'object' && (
    Boolean(warehouse.is_default_disposal) ||
    Boolean(warehouse.is_default_disposal_warehouse)
  )

const getBuildingCodeIdentity = (value: string | null | undefined) => {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+/, '')
  return digits || ''
}

const currentTime = () => {
  const date = new Date()
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const newDocDetailRow = (receiveDate = ''): DocDetailRow =>
  normalizeDocDetailRow({
    receive_date: receiveDate,
    receive_time: currentTime(),
    mnf_date: today(),
  }, receiveDate)

const getItemFmsType = (item: Items) =>
  String(item.fms_group ?? '').trim().toLowerCase()

const getItemDescription = (item: Items) =>
  item.item_name || item.description || ''

const hasDocReceivingSettings = (
  settings: DocReceivingSettings | null,
): settings is DocReceivingSettings & { good_doc: number; bad_doc: number; reject_doc: number } =>
  Boolean(settings?.good_doc && settings.bad_doc && settings.reject_doc)

const hasDocDetailValues = (rows: DocDetailRow[]) =>
  rows.some(row =>
    row.mnf_date ||
    numberValue(row.quantity_received) > 0 ||
    numberValue(row.actual_received) > 0 ||
    numberValue(row.short_count) > 0 ||
    numberValue(row.doa_quantity) > 0 ||
    numberValue(row.reject_count) > 0
  )

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

      <section className="m-3 mt-6 flex min-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid gap-y-3 p-5">
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
  const canInsert = usePermission('/inv/doc-receiving/insert')
  const receiptId = searchParams.get('id')
  const duplicateId = searchParams.get('duplicateId')
  const isPostMode = mode === 'post'
  const [receipt, setReceipt] = useState<GoodsReceipt | null>(null)
  const [items, setItems] = useState<Items[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [farms, setFarms] = useState<GoodsReceiptFarm[]>([])
  const [farmBuildings, setFarmBuildings] = useState<FarmBuildingListRow[]>([])
  const [firstPlacementDates, setFirstPlacementDates] = useState<Record<number, string>>({})
  const [buildingRefreshKey, setBuildingRefreshKey] = useState(0)
  const [uomGroups, setUomGroups] = useState<UomGroupOption[]>([])
  const [conversions, setConversions] = useState<UomConversionOption[]>([])
  const [itemGroups, setItemGroups] = useState<GoodsReceiptItemGroup[]>([])
  const [batchRules, setBatchRules] = useState<GoodsReceiptBatchRule[]>([])
  const [batchSeries, setBatchSeries] = useState<GoodsReceiptBatchSeries[]>([])
  const [docReceivingSettings, setDocReceivingSettings] = useState<DocReceivingSettings | null>(null)
  const [activeBatchLineId, setActiveBatchLineId] = useState<GoodsReceiptLine['id'] | null>(null)
  const [batchTrailRows, setBatchTrailRows] = useState<BatchTransactionTrail[]>([])
  const [loadingBatchTrail, setLoadingBatchTrail] = useState(false)
  const [batchMatches, setBatchMatches] = useState<Record<string, GoodsReceiptExistingBatch | null>>({})
  const [postConfirmOpen, setPostConfirmOpen] = useState(false)
  const [docDetailRows, setDocDetailRows] = useState<DocDetailRow[]>([])
  const [forceDocDetailsModal, setForceDocDetailsModal] = useState(false)
  const [docDetailsModalOpen, setDocDetailsModalOpen] = useState(false)
  const [modalDocDetailRow, setModalDocDetailRow] = useState<DocDetailRow | null>(null)
  const [cycleModalOpen, setCycleModalOpen] = useState(false)
  const [cycleBuilding, setCycleBuilding] = useState<FarmBuildingListRow | null>(null)
  const [cycleTarget, setCycleTarget] = useState<{ kind: 'row'; rowId: number | string } | { kind: 'modal' } | null>(null)
  const [cycleForm, setCycleForm] = useState<CycleInformationForm>(emptyCycleForm)
  const [savingCycle, setSavingCycle] = useState(false)
  const [cycleIsExcluded, setCycleIsExcluded] = useState(false)
  const separateBatchByReference = true
  const batchReferenceColumn = 'transfer_slip'
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCollapsed(true)
  }, [setCollapsed])

  useEffect(() => {
    const farmId = Number(receipt?.farmId ?? 0)
    if (!farmId) {
      setFarmBuildings([])
      setFirstPlacementDates({})
      return
    }

    let cancelled = false
    getFarmBuildingsForFlockCard(farmId)
      .then(async rows => {
        const buildings = rows.filter(row => row.source === 'WAREHOUSE')
        const dates = await getFirstDocPlacementDates(buildings.flatMap(building =>
          building.flockCard ? [building.flockCard.id] : []
        ))
        if (!cancelled) {
          setFarmBuildings(buildings)
          setFirstPlacementDates(dates)
        }
      })
      .catch(error => {
        if (!cancelled) toast.error(`Unable to load farm buildings: ${error instanceof Error ? error.message : 'Unknown error'}`)
      })

    return () => {
      cancelled = true
    }
  }, [buildingRefreshKey, receipt?.farmId])

  useEffect(() => {
    const updateForWidth = () => {
      const isTabletWidth = window.innerWidth <= 1024
      setForceDocDetailsModal(isTabletWidth)
    }

    updateForWidth()
    window.addEventListener('resize', updateForWidth)
    return () => window.removeEventListener('resize', updateForWidth)
  }, [])

  useEffect(() => {
    if (!isPostMode && canInsert) {
      router.replace('/inv/doc-receiving')
    }
  }, [canInsert, isPostMode, router])

  useEffect(() => {
    if (!isPostMode && canInsert) return

    let cancelled = false

    async function loadPageData() {
      try {
        if (isPostMode && !receiptId) {
          toast('Select a draft DOC receiving document to post.')
          router.push('/inv/doc-receiving')
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
          Boolean(cachedGrReferences?.uomGroups && cachedGrReferences.conversions && cachedGrReferences.itemGroups && cachedGrReferences.openFlockBuildings) &&
          cachedReferencesHaveFarmMetadata

        const referencesPromise = canUseCachedReferences
          ? Promise.resolve({
              items: cachedItems,
              warehouses: cachedWarehouses,
              farms: cachedGrReferences?.farms ?? [],
              openFlockBuildings: cachedGrReferences?.openFlockBuildings ?? [],
              uomGroups: cachedGrReferences?.uomGroups ?? [],
              conversions: cachedGrReferences?.conversions ?? [],
              itemGroups: cachedGrReferences?.itemGroups ?? [],
              batchRules: cachedGrReferences?.batchRules ?? [],
              batchSeries: cachedGrReferences?.batchSeries ?? [],
            })
          : getGoodsReceiptReferences()

        const [references, savedReceipt, grNo, settings] = await Promise.all([
          referencesPromise,
          receiptId
            ? getGoodsReceiptById(Number(receiptId))
            : duplicateId
              ? getGoodsReceiptById(Number(duplicateId))
              : Promise.resolve(null),
          receiptId && !duplicateId ? Promise.resolve('') : createGoodsReceiptNumber(),
          getDocReceivingSettings(),
        ])

        if (cancelled) return

        const nextReceipt = duplicateId && savedReceipt
          ? duplicateReceipt(savedReceipt, grNo)
          : savedReceipt ?? emptyReceipt(grNo)

        setReceipt(nextReceipt)
        setDocDetailRows(nextReceipt.docDetails.length > 0
          ? nextReceipt.docDetails.map(row => normalizeDocDetailRow({
              ...row,
              doc_source: row.doc_source || nextReceipt.vendor,
            }, nextReceipt.receiveDate))
          : [])
        setItems(references.items)
        setWarehouses(references.warehouses)
        setFarms(references.farms)
        setUomGroups(references.uomGroups)
        setConversions(references.conversions)
        setItemGroups(references.itemGroups)
        setBatchRules(references.batchRules)
        setBatchSeries(references.batchSeries)
        setDocReceivingSettings(settings)
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
  }, [canInsert, duplicateId, getValue, isPostMode, receiptId, router])

  const selectedFarm = useMemo(
    () => farms.find(farm => farm.id === receipt?.farmId),
    [farms, receipt?.farmId],
  )

  const farmOpenFlockBuildings = useMemo(() => {
    const selectableBuildings = farmBuildings.filter(building => Number(building.id ?? 0) > 0)
    const resolvedBuildings = selectableBuildings.flatMap(building => {
      const codeIdentity = getBuildingCodeIdentity(building.code)
      const cycleSource = building.flockCard
        ? building
        : farmBuildings.find(candidate =>
            Boolean(candidate.flockCard) &&
            codeIdentity !== '' &&
            getBuildingCodeIdentity(candidate.code) === codeIdentity
          )
      const flockCard = cycleSource?.flockCard
      const warehouseId = Number(building.id ?? 0)
      if (!flockCard || !warehouseId) return []

      return [{
        flockCardId: flockCard.id,
        farmId: building.farmId,
        warehouseId,
        warehouseCode: building.warehouseCode || building.code,
        warehouseName: building.name,
        cardNo: flockCard.cardNo,
        flockCode: flockCard.flockCode,
        cycleAge: flockCard.age,
      } satisfies GoodsReceiptOpenFlockBuilding]
    })
    return resolvedBuildings
  }, [farmBuildings])

  const selectableFarmBuildings = useMemo(() => farmBuildings.map(building => {
    const activeCycle = farmOpenFlockBuildings.find(candidate => candidate.warehouseId === building.id)
    return { building, activeCycle }
  }).filter(entry => Number(entry.building.id ?? 0) > 0), [farmBuildings, farmOpenFlockBuildings])

  const defaultDisposalWarehouse = useMemo(() => {
    const associations = selectedFarm?.associated_warehouses
    const defaultCode = Array.isArray(associations)
      ? getAssociatedWarehouseCode(associations.find(isDefaultDisposalAssociation) ?? '')
      : ''

    return warehouses.find(warehouse =>
      defaultCode &&
      String(warehouse.whse_code ?? '').trim() === defaultCode
    ) ?? warehouses.find(warehouse =>
      Boolean(warehouse.is_default_disposal_warehouse) &&
      (
        warehouse.farm_id === selectedFarm?.id ||
        String(warehouse.farm_code ?? '').trim() === String(selectedFarm?.code ?? '').trim()
      )
    ) ?? null
  }, [selectedFarm, warehouses])

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

    return items.filter(item => getItemFmsType(item) === fmsType)
  }, [items, receipt?.fmsType])

  const itemById = useMemo(() => {
    const map = new Map<number, Items>()

    items.forEach(item => {
      if (typeof item.id === 'number') map.set(item.id, item)
    })

    return map
  }, [items])

  const itemGroupIdByCode = useMemo(() => {
    const map = new Map<string, number>()

    itemGroups.forEach(group => {
      const code = String(group.code ?? '').trim().toUpperCase()
      if (code) map.set(code, group.id)
    })

    return map
  }, [itemGroups])

  const getDocDetailReferenceValue = (row: DocDetailRow, code: string) =>
    String(row[code as keyof DocDetailRow] ?? '').trim()

  const derivedReceiptLines = useMemo(() => {
    if (!receipt || !hasDocReceivingSettings(docReceivingSettings)) return []

    const existingLineByKey = new Map<string, DerivedGoodsReceiptLine>()

    receipt.lines.forEach(line => {
      if (!line.itemId || !line.manufacturingDate) return
      const derivedLine = line as DerivedGoodsReceiptLine
      if (Boolean(derivedLine.docBatchSeparated) !== separateBatchByReference) return
      if (separateBatchByReference && derivedLine.docBatchReferenceColumn !== batchReferenceColumn) return

      const referenceKey = separateBatchByReference
        ? derivedLine.docBatchReferenceKey || derivedLine.docBatchReference || ''
        : ''
      existingLineByKey.set(
        `${line.itemId}|${line.manufacturingDate}|${referenceKey}|${line.warehouseId ?? ''}`,
        derivedLine,
      )
    })

    const quantities = new Map<string, {
      itemId: number
      manufacturingDate: string
      referenceValue: string
      referenceKey: string
      quantity: number
      buildingWarehouseId: number | null
      docLineNo: number
    }>()

    const addQuantity = (
      itemId: number | null | undefined,
      manufacturingDate: string,
      referenceValue: string,
      sourceRowId: number | string,
      quantity: number,
      buildingWarehouseId: number | null,
      docLineNo: number,
    ) => {
      if (!itemId || !manufacturingDate || quantity <= 0) return

      const referenceKey = separateBatchByReference
        ? `${referenceValue || 'NO_REFERENCE'}|${String(sourceRowId)}`
        : ''
      const key = `${itemId}|${manufacturingDate}|${referenceKey}|${buildingWarehouseId ?? ''}`
      const current = quantities.get(key)
      quantities.set(key, {
        itemId,
        manufacturingDate,
        referenceValue,
        referenceKey,
        quantity: (current?.quantity ?? 0) + quantity,
        buildingWarehouseId,
        docLineNo,
      })
    }

    docDetailRows.forEach((row, index) => {
      const manufacturingDate = row.mnf_date
      const referenceValue = getDocDetailReferenceValue(row, batchReferenceColumn) || String(row.id)
      const actualReceived = numberValue(row.actual_received)
      const daoQuantity = numberValue(row.doa_quantity)
      const rejectCount = numberValue(row.reject_count)
      const goodQuantity = actualReceived

      addQuantity(docReceivingSettings.good_doc, manufacturingDate, referenceValue, row.id, goodQuantity, row.building_warehouse_id, index + 1)
      addQuantity(docReceivingSettings.bad_doc, manufacturingDate, referenceValue, row.id, daoQuantity, row.building_warehouse_id, index + 1)
      addQuantity(docReceivingSettings.reject_doc, manufacturingDate, referenceValue, row.id, rejectCount, row.building_warehouse_id, index + 1)
    })

    return Array.from(quantities.values()).flatMap(({ itemId, manufacturingDate, referenceValue, referenceKey, quantity, buildingWarehouseId, docLineNo }) => {
      const item = itemById.get(itemId)
      if (!item) return []

      const inventoryUom = item.inventory_uom || ''
      const unitMeasure = item.unit_measure || ''
      const selectedGroup = uomGroups.find(group => group.code.toUpperCase() === inventoryUom.toUpperCase())
      const selectedGroupCode = selectedGroup?.code ?? conversions.find(
        option => option.uomCode.toUpperCase() === unitMeasure.toUpperCase(),
      )?.groupCode ?? ''
      const uom = selectedGroup?.baseUomCode || unitMeasure || inventoryUom
      const conversion = conversions.find(
        option =>
          option.groupCode.toUpperCase() === selectedGroupCode.toUpperCase() &&
          option.uomCode.toUpperCase() === uom.toUpperCase(),
      )
      const baseQty = selectedGroupCode && uom
        ? quantity * (conversion?.baseQty ?? 0)
        : 0
      const rowBuilding = farmOpenFlockBuildings.find(
        building => building.warehouseId === buildingWarehouseId,
      )
      const isGoodDoc = itemId === docReceivingSettings.good_doc
      const destination = isGoodDoc
        ? rowBuilding
          ? {
              id: rowBuilding.warehouseId,
              whse_code: rowBuilding.warehouseCode,
              whse_name: rowBuilding.warehouseName,
            }
          : null
        : defaultDisposalWarehouse
      const existingLine = existingLineByKey.get(
        `${itemId}|${manufacturingDate}|${referenceKey}|${destination?.id ?? ''}`,
      )
      const expiryDate = typeof item.default_expiration_months === 'number'
        ? addMonthsToDate(manufacturingDate, item.default_expiration_months)
        : ''

      return [{
        id: existingLine?.id ?? createClientId(),
        itemId,
        itemCode: item.item_code || '',
        description: getItemDescription(item),
        batchRuleId: existingLine?.batchRuleId ?? null,
        batchNumber: existingLine?.batchNumber ?? '',
        supplierBatchNumber: existingLine?.supplierBatchNumber ?? '',
        manufacturingDate,
        expiryDate,
        altQty: quantity,
        altUom: uom,
        baseQty,
        baseUom: selectedGroupCode,
        warehouseId: destination?.id ?? null,
        warehouseCode: destination?.whse_code ?? '',
        warehouseName: destination?.whse_name ?? '',
        returnedQty: existingLine?.returnedQty ?? 0,
        docLineNo,
        docBatchSeparated: separateBatchByReference,
        docBatchReference: referenceValue,
        docBatchReferenceKey: referenceKey,
        docBatchReferenceColumn: separateBatchByReference ? batchReferenceColumn : '',
      }]
    })
  }, [batchReferenceColumn, conversions, defaultDisposalWarehouse, docDetailRows, docReceivingSettings, farmOpenFlockBuildings, itemById, receipt, separateBatchByReference, uomGroups])

  const shouldDeriveReceiptLines = Boolean(
    receipt &&
    hasDocReceivingSettings(docReceivingSettings) &&
    (!receipt.id || hasDocDetailValues(docDetailRows)),
  )
  const displayReceiptLines = shouldDeriveReceiptLines ? derivedReceiptLines : receipt?.lines ?? []
  const displayTotalQuantity = docDetailRows.reduce(
    (total, row) => total + numberValue(row.quantity_received),
    0,
  )
  const displayGoodChickQuantity = displayReceiptLines
    .filter(line => line.itemId === docReceivingSettings?.good_doc)
    .reduce(
      (total, line) => total + Number(line.baseQty || 0),
      0,
    )
  const receivingSummary = [
    {
      key: 'good',
      label: 'Good Chick',
      itemId: docReceivingSettings?.good_doc,
    },
    {
      key: 'doa',
      label: 'DOA',
      itemId: docReceivingSettings?.bad_doc,
    },
    {
      key: 'reject',
      label: 'Reject',
      itemId: docReceivingSettings?.reject_doc,
    },
  ].map(group => {
    const lines = displayReceiptLines.filter(line => line.itemId === group.itemId)
    return {
      ...group,
      quantity: lines.reduce((total, line) => total + Number(line.baseQty || 0), 0),
    }
  })

  useEffect(() => {
    if (!receipt || !shouldDeriveReceiptLines) return

    const lineSignature = (line: GoodsReceiptLine) => [
      line.itemId,
      line.itemCode,
      line.description,
      line.batchRuleId,
      line.batchNumber,
      line.supplierBatchNumber,
      line.manufacturingDate,
      line.expiryDate,
      line.altQty,
      line.altUom,
      line.baseQty,
      line.baseUom,
      line.warehouseId,
      line.warehouseCode,
      line.warehouseName,
      line.returnedQty,
      (line as DerivedGoodsReceiptLine).docBatchSeparated,
      (line as DerivedGoodsReceiptLine).docBatchReference,
      (line as DerivedGoodsReceiptLine).docBatchReferenceKey,
      (line as DerivedGoodsReceiptLine).docBatchReferenceColumn,
    ].join('|')

    const currentSignature = receipt.lines.map(lineSignature).join('||')
    const nextSignature = derivedReceiptLines.map(lineSignature).join('||')
    if (currentSignature === nextSignature) return

    setReceipt(current => current ? {
      ...current,
      lines: derivedReceiptLines,
    } : current)
  }, [derivedReceiptLines, receipt, shouldDeriveReceiptLines])

  useEffect(() => {
    if (loadingReferences || !receipt?.farmId) return

    const nextFmsType = getFarmFmsType(selectedFarm)
    const fmsTypeChanged = Boolean(nextFmsType) && receipt.fmsType !== nextFmsType

    if (!fmsTypeChanged) return

    setReceipt(current => current ? {
      ...current,
      fmsType: nextFmsType || current.fmsType,
    } : current)
  }, [loadingReferences, receipt?.farmId, receipt?.fmsType, selectedFarm])

  useEffect(() => {
    if (loadingReferences || receipt?.farmId || farms.length === 0) return

    const defaultFarmId = getValue('DefaultFarmId')
    const farm = farms.find(candidate => String(candidate.id) === String(defaultFarmId))
      ?? (farms.length === 1 ? farms[0] : null)
    if (!farm) return

    setReceipt(current => {
      if (!current || current.farmId) return current

      return {
        ...current,
        farmId: farm.id,
        farmCode: farm.code,
        farmName: farm.name ?? '',
        fmsType: getFarmFmsType(farm),
        defaultWarehouseId: null,
      }
    })
  }, [farms, getValue, loadingReferences, receipt?.farmId])

  useEffect(() => {
    if (shouldDeriveReceiptLines) return

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
  }, [availableItems, receipt?.fmsType, receipt?.lines, shouldDeriveReceiptLines])

  const batchLineForLookup = displayReceiptLines.find(line => line.id === activeBatchLineId) ?? null
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

        if (existingBatch?.batch_number && !separateBatchByReference) {
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
      .catch(() => {
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
    separateBatchByReference,
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

  const canEditDraft = receipt.status === 'Draft'
  const canPostDocument = receipt.status === 'Draft'
  const canEditDocDetails = receipt.status !== 'Posted'

  const updateLine = (id: GoodsReceiptLine['id'], changes: Partial<GoodsReceiptLine>) => {
    setReceipt(current => current
      ? { ...current, lines: current.lines.map(line => line.id === id ? { ...line, ...changes } : line) }
      : current,
    )
  }

  const updateDocDetailRow = (rowId: number | string, code: string, value: string) => {
    if (!canEditDocDetails) return

    setDocDetailRows(current => current.map(row => {
      if (row.id !== rowId) return row

      const nextRow = {
        ...row,
        [code]: value,
      }

      return DOC_RECEIVING_NUMERIC_DETAIL_CODES.has(code) && code !== 'actual_received'
        ? { ...nextRow, actual_received: String(calculateActualReceived(nextRow)) }
        : nextRow
    }))

    if (code === 'receive_date') {
      setReceipt(current => current ? { ...current, receiveDate: value } : current)
    }
  }

  const removeDocDetailRow = (rowId: number | string) => {
    if (!canEditDocDetails) return

    setDocDetailRows(current => {
      return current.filter(row => row.id !== rowId)
    })
  }

  const getDocDetailValue = (row: DocDetailRow, code: string) => {
    if (code === 'receive_date') return row.receive_date || receipt.receiveDate
    if (code === 'actual_received') return String(calculateActualReceived(row))

    return String(row[code as keyof DocDetailRow] ?? '')
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
      ? [
          line.itemCode.trim().toUpperCase(),
          line.manufacturingDate,
          line.expiryDate || 'NO_EXP',
          separateBatchByReference
            ? (line as DerivedGoodsReceiptLine).docBatchReferenceKey ?? (line as DerivedGoodsReceiptLine).docBatchReference ?? ''
            : '',
        ].join('|')
      : ''

  const getExistingLineBatch = (line: GoodsReceiptLine) => {
    const batchKey = getBatchKey(line)
    if (!batchKey) return null

    return displayReceiptLines.find(candidate =>
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

    const lineIndex = displayReceiptLines.findIndex(candidate => candidate.id === line.id)
    const usedBatchKeys = new Set<string>()
    displayReceiptLines
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
          name: 'DOC Placement',
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
      templateSource: series ? `${series.code} - ${series.name}` : 'DOC Placement fallback template',
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
      description: item.item_name || item.description || '',
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

  const clearCycleTarget = () => {
    if (cycleTarget?.kind === 'row') {
      setDocDetailRows(current => current.map(row => row.id === cycleTarget.rowId ? {
        ...row,
        building_warehouse_id: null,
        flock_card_id: null,
      } : row))
    } else if (cycleTarget?.kind === 'modal') {
      setModalDocDetailRow(current => current ? {
        ...current,
        building_warehouse_id: null,
        flock_card_id: null,
      } : current)
    }
  }

  const getFirstPlacementDate = (flockCardId: number, fallbackDate: string) => {
    const persistedDate = firstPlacementDates[flockCardId]
    if (persistedDate) return persistedDate

    const localDates = [
      ...docDetailRows
        .filter(row => row.flock_card_id === flockCardId)
        .map(row => row.receive_date || receipt.receiveDate),
      ...(modalDocDetailRow?.flock_card_id === flockCardId
        ? [modalDocDetailRow.receive_date || receipt.receiveDate]
        : []),
      fallbackDate,
    ].filter(Boolean).sort()

    return localDates[0] ?? fallbackDate
  }

  const beginCycleCreation = async (
    building: FarmBuildingListRow,
    target: { kind: 'row'; rowId: number | string } | { kind: 'modal' },
  ) => {
    if (!receipt?.farmId) return
    const nextForm = emptyCycleForm()
    setCycleBuilding(building)
    setCycleTarget(target)
    setCycleForm(nextForm)
    setCycleIsExcluded(false)
    setCycleModalOpen(true)

    try {
      const excluded = await isDocCycleBuildingExcluded(receipt.farmId, Number(building.id))
      setCycleIsExcluded(excluded)
      if (excluded) {
        setCycleForm(current => ({ ...current, cycleNumber: '' }))
      } else {
        const farmCycle = await previewDocFarmCycle(receipt.farmId)
        setCycleForm(current => ({ ...current, cycleNumber: farmCycle.cycleNumber }))
      }
    } catch (error) {
      toast.error(`Unable to calculate Cycle Count: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const selectBuilding = (rowId: number | string, warehouseId: string) => {
    const entry = selectableFarmBuildings.find(
      candidate => candidate.building.id === Number(warehouseId),
    )
    const building = entry?.activeCycle
    setDocDetailRows(current => current.map(row => row.id === rowId ? {
      ...row,
      building_warehouse_id: entry?.building.id ?? null,
      flock_card_id: building?.flockCardId ?? null,
    } : row))

    if (entry && !building) {
      void beginCycleCreation(entry.building, { kind: 'row', rowId })
      return
    }

  }

  const addDocDetailsUsingModal = () => {
    setModalDocDetailRow(newDocDetailRow(receipt.receiveDate))
    setDocDetailsModalOpen(true)
  }

  const handleAddDocDetailsRow = () => {
    if (forceDocDetailsModal) {
      addDocDetailsUsingModal()
      return
    }

    setDocDetailRows(current => [...current, newDocDetailRow(receipt.receiveDate)])
  }

  const updateModalDocDetail = (code: string, value: string) => {
    setModalDocDetailRow(current => {
      if (!current) return current
      const nextRow = { ...current, [code]: value }
      return DOC_RECEIVING_NUMERIC_DETAIL_CODES.has(code) && code !== 'actual_received'
        ? { ...nextRow, actual_received: String(calculateActualReceived(nextRow)) }
        : nextRow
    })
  }

  const selectModalBuilding = (warehouseId: string) => {
    const entry = selectableFarmBuildings.find(
      candidate => candidate.building.id === Number(warehouseId),
    )
    const building = entry?.activeCycle
    setModalDocDetailRow(current => current ? {
      ...current,
      building_warehouse_id: entry?.building.id ?? null,
      flock_card_id: building?.flockCardId ?? null,
    } : current)

    if (entry && !building) {
      void beginCycleCreation(entry.building, { kind: 'modal' })
      return
    }

  }

  const createCycle = async () => {
    if (!receipt?.farmId || !cycleBuilding || !cycleTarget) return
    if (!cycleForm.startDate || !cycleForm.breed.trim()) {
      toast.error('Complete the Cycle / Age Start and Breed.')
      return
    }
    if (cycleIsExcluded && !cycleForm.cycleNumber.trim()) {
      toast.error('Enter the Cycle Count for the exempted building.')
      return
    }

    const cycleAge = Math.min(calculateCycleRange(cycleForm.startDate, today()), 45)
    const targetRow = cycleTarget.kind === 'row'
      ? docDetailRows.find(row => row.id === cycleTarget.rowId)
      : modalDocDetailRow

    setSavingCycle(true)
    try {
      const farmCycle = cycleIsExcluded ? null : await ensureActiveDocFarmCycle(receipt.farmId)
      const saved = await saveFlockCardPlacement({
        farmId: receipt.farmId,
        farmCode: receipt.farmCode,
        farmName: receipt.farmName,
        buildingWarehouseId: cycleBuilding.id,
        buildingSource: cycleBuilding.source,
        buildingKey: cycleBuilding.key,
        buildingCode: cycleBuilding.code,
        buildingName: cycleBuilding.name,
        age: cycleAge,
        startDate: cycleForm.startDate,
        breed: cycleForm.breed,
        cycleNumber: farmCycle?.cycleNumber ?? cycleForm.cycleNumber,
        farmCycleId: farmCycle?.id ?? null,
        animalQty: calculateActualReceived(targetRow ?? {}),
        extra: {
          cycleAsOfDate: today(),
          expectedCycleEndDate: addDaysToDate(cycleForm.startDate, 45),
          createdFrom: 'DOC_RECEIVING',
          goodsReceiptNo: receipt.grNo,
        },
      })

      const createdBuilding: GoodsReceiptOpenFlockBuilding = {
        flockCardId: saved.id,
        farmId: receipt.farmId,
        warehouseId: Number(cycleBuilding.id),
        warehouseCode: cycleBuilding.code,
        warehouseName: cycleBuilding.name,
        cardNo: saved.cardNo,
        flockCode: '',
        cycleAge,
      }
      if (cycleTarget.kind === 'row') {
        setDocDetailRows(current => current.map(row => row.id === cycleTarget.rowId ? {
          ...row,
          building_warehouse_id: createdBuilding.warehouseId,
          flock_card_id: saved.id,
        } : row))
      } else {
        setModalDocDetailRow(current => current ? {
          ...current,
          building_warehouse_id: createdBuilding.warehouseId,
          flock_card_id: saved.id,
        } : current)
      }
      setFarmBuildings(current => current.map(building =>
        building.id === cycleBuilding.id
          ? { ...building, flockCard: { id: saved.id, cardNo: saved.cardNo, age: cycleAge, startDate: cycleForm.startDate, flockCode: '', breed: cycleForm.breed, animalQty: calculateActualReceived(targetRow ?? {}), status: 'Saved' } }
          : building
      ))
      setCycleModalOpen(false)
      setCycleBuilding(null)
      setCycleTarget(null)
      toast.success(`Cycle created: ${saved.cardNo}`)
    } catch (error) {
      toast.error(`Unable to create cycle: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSavingCycle(false)
    }
  }

  const confirmModalDocDetail = () => {
    if (!modalDocDetailRow) return
    if (isFutureReceivingDate(modalDocDetailRow.receive_date || receipt.receiveDate)) {
      toast.error(FUTURE_RECEIVING_DATE_MESSAGE)
      return
    }
    if (!modalDocDetailRow.mnf_date) {
      toast.error('Enter the Production Date before adding the DOC Details line.')
      return
    }
    if (!modalDocDetailRow.doc_source.trim()) {
      toast.error('Enter the DOC Source before adding the DOC Details line.')
      return
    }
    if (!modalDocDetailRow.building_warehouse_id || !modalDocDetailRow.flock_card_id) {
      toast.error('Select a building with an active flock-card cycle.')
      return
    }

    setDocDetailRows(current => [...current, normalizeDocDetailRow(modalDocDetailRow, receipt.receiveDate)])
    if (modalDocDetailRow.receive_date) {
      setReceipt(current => current ? { ...current, receiveDate: modalDocDetailRow.receive_date } : current)
    }
    setDocDetailsModalOpen(false)
    setModalDocDetailRow(null)
  }

  const selectFarm = (farmId: string) => {
    const farm = farms.find(candidate => String(candidate.id) === farmId)
    setReceipt(current => current ? {
      ...current,
      farmId: farm?.id ?? null,
      farmCode: farm?.code ?? '',
      farmName: farm?.name ?? '',
      fmsType: getFarmFmsType(farm),
      defaultWarehouseId: null,
    } : current)
    setDocDetailRows(current => current.map(row => ({
      ...row,
      building_warehouse_id: null,
      flock_card_id: null,
    })))
  }

  const handleSave = async (targetStatus: 'Draft' | 'Posted') => {
    if (!hasDocReceivingSettings(docReceivingSettings)) {
      return
    }

    const receiptLines = shouldDeriveReceiptLines ? derivedReceiptLines : receipt.lines
    const completedLines = receiptLines.filter(line => line.itemId)
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

    if (docDetailRows.length === 0 || docDetailRows.some(row => !row.doc_source.trim())) {
      toast('Please enter a DOC source for every DOC Details row.')
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
    if (
      isFutureReceivingDate(receipt.receiveDate) ||
      docDetailRows.some(row => isFutureReceivingDate(row.receive_date || receipt.receiveDate))
    ) {
      toast.error(FUTURE_RECEIVING_DATE_MESSAGE)
      return
    }
    const rowsWithReceivedChicks = docDetailRows.filter(row => numberValue(row.quantity_received) > 0)
    const missingBuildingRow = rowsWithReceivedChicks.find(row =>
      !farmOpenFlockBuildings.some(building =>
        building.warehouseId === row.building_warehouse_id &&
        building.flockCardId === row.flock_card_id
      )
    )
    if (posting && missingBuildingRow) {
      toast('Select a building with an active flock-card cycle for every DOC Details row.')
      return
    }
    const ageIssue = rowsWithReceivedChicks
      .map(row => farmOpenFlockBuildings.find(building =>
        building.warehouseId === row.building_warehouse_id &&
        building.flockCardId === row.flock_card_id
      ))
      .find((building, index) => building && isOutsideDocPlacementWindow(placementAge(
        getFirstPlacementDate(building.flockCardId, rowsWithReceivedChicks[index]?.receive_date || receipt.receiveDate),
        rowsWithReceivedChicks[index]?.receive_date || receipt.receiveDate,
      )))
    if (posting && ageIssue) {
      return
    }
    if (
      posting &&
      !defaultDisposalWarehouse &&
      docDetailRows.some(row => numberValue(row.doa_quantity) > 0 || numberValue(row.reject_count) > 0)
    ) {
      toast('Set a default disposal warehouse before posting DOA or Reject quantities.')
      return
    }
    if (posting && completedLines.length === 0) {
      toast('Please enter DOC Details that generate at least one item line.')
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
        vendor: docDetailRows.find(row => row.doc_source.trim())?.doc_source.trim() || receipt.vendor,
        status: targetStatus,
        docDetails: docDetailRows.map(row => normalizeDocDetailRow(row, receipt.receiveDate)),
        lines: (posting ? completedLines : completeLines).map(line => ({
          ...line,
          batchRuleId: getBatchRuleForLine(line)?.id ?? null,
          batchNumber: line.batchNumber.trim() || getGeneratedBatchNumber(line),
        })),
      })
      toast(posting ? 'Goods receipt posted successfully.' : 'Goods receipt draft saved.')

      if (posting) {
        router.push('/inv/doc-receiving')
        return
      }

      if (!isPostMode && savedReceipt?.id) {
        router.push(`/inv/doc-receiving/post?id=${savedReceipt.id}`)
        return
      }

      if (savedReceipt) {
        setReceipt(savedReceipt)
        setDocDetailRows(savedReceipt.docDetails.length > 0
          ? savedReceipt.docDetails.map(row => normalizeDocDetailRow(row, savedReceipt.receiveDate))
          : [])
      }
    } catch (error) {
      console.log({ error })
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to save DOC receiving document'))
    } finally {
      setSaving(false)
    }
  }

  const activeBatchLine = displayReceiptLines.find(line => line.id === activeBatchLineId) ?? null
  const activeBatchRequirement = activeBatchLine ? getBatchRequirement(activeBatchLine) : null
  const activeBatchSeries = getBatchSeriesForRule(activeBatchRequirement?.rule)
  const activeBatchParts = activeBatchLine ? getBatchNumberParts(activeBatchLine) : null
  const activeBatchMatch = activeBatchLine ? batchMatches[String(activeBatchLine.id)] ?? null : null
  const activeLineBatchMatch = activeBatchParts?.reusedFromLine ?? null
  const activeBatchReadOnly = Boolean(activeBatchLine && (shouldDeriveReceiptLines || !canEditDraft))
  const activeBatchNumber = activeBatchLine?.batchNumber || activeBatchParts?.batchNumber || ''
  const activeBatchStatus = activeBatchMatch
    ? 'Existing database batch'
    : activeLineBatchMatch
      ? 'Reusing current DOC Placement batch'
      : activeBatchNumber
        ? 'New batch to create'
        : activeBatchRequirement?.needsExpiryDate
          ? 'Waiting for dates'
          : 'Waiting for MFG date'

  const docPlacementWindowError = docDetailRows.flatMap(row => {
    if (numberValue(row.quantity_received) <= 0) return []
    const building = farmOpenFlockBuildings.find(candidate =>
      candidate.warehouseId === row.building_warehouse_id &&
      candidate.flockCardId === row.flock_card_id
    )
    if (!building) return []

    const receiveDate = row.receive_date || receipt.receiveDate
    const firstDate = getFirstPlacementDate(building.flockCardId, receiveDate)
    const day = placementAge(firstDate, receiveDate)
    return isOutsideDocPlacementWindow(day)
      ? [`${building.warehouseCode}: Date Receive must be from ${firstDate} through ${addDaysToDate(firstDate, DOC_PLACEMENT_WINDOW_LAST_DAY_OFFSET)} (7 calendar dates including the first placement date).`]
      : []
  })[0] ?? ''

  return (
    <main className="min-h-[calc(100vh-80rem)]">
      <div className="mx-4 mt-4 flex items-center justify-between gap-3">
        <Breadcrumb
          SecondPreviewPageName="Inventory"
          SecondPreviewPageLink="/inv"
          FirstPreviewsPageName="DOC Placement"
          FirstPreviewsPageLink="/inv/doc-receiving"
          CurrentPageName={isPostMode ? 'Post DOC Placement' : 'New DOC Placement'}
        />
        <Button type="button" variant="outline" onClick={() => router.push('/inv/doc-receiving')}>
          <List className="size-4" />
          DOC Placement List
        </Button>
      </div>

      <section className="m-3 mt-6 flex min-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex flex-col items-start gap-1 p-5">
          <div className="w-full max-w-md space-y-2">
            <label className="text-sm font-semibold">DOC Placement No.</label>
            <div className="flex items-center gap-1">
              <Input value={receipt.grNo} readOnly className="bg-stone-50" />
              <span className={getInventoryStatusBadgeClass(receipt.status)}>
                {receipt.status}
              </span>
            </div>
          </div>

          <div className="w-full max-w-md space-y-2">
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

        </div>

        <div className="flex flex-1 flex-col border-t">
          <FormTable
            title="DOC Details"
            description={`${docDetailRows.length} ${docDetailRows.length === 1 ? 'row' : 'rows'}`}
            actions={(
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canEditDocDetails}
                  onClick={handleAddDocDetailsRow}
                  className="rounded-r-none"
                >
                  <Plus className="size-4" />
                  {forceDocDetailsModal ? 'Add Row as Modal' : 'Add Row'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!canEditDocDetails}
                      className="-ml-px rounded-l-none"
                      aria-label="More add row options"
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={addDocDetailsUsingModal}>
                      Add as modal
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            className="rounded-none border-0 border-b shadow-none"
          >
            <table className="min-w-[1840px] w-full text-sm">
              <thead className="bg-secondary">
                <tr>
                  <th className="h-9 w-20 whitespace-nowrap px-2 text-center align-middle text-xs font-semibold uppercase text-stone-700">
                    <p aria-hidden="true" className="invisible text-[10px] font-normal normal-case">
                      spacer
                    </p>
                    Action
                  </th>
                  {DOC_RECEIVING_DETAIL_COLUMNS.map(column => (
                    <th
                      key={column.code}
                      className="h-9 whitespace-nowrap px-2 text-left align-middle text-xs font-semibold uppercase text-stone-700"
                    >
                      {DOC_RECEIVING_DETAIL_UNITS[column.code] && (
                        <span className="block text-[10px] font-normal normal-case text-stone-500">
                          {DOC_RECEIVING_DETAIL_UNITS[column.code]}
                        </span>
                      )}
                      {DOC_RECEIVING_ALIGNED_HEADER_CODES.has(column.code) && (
                        <p aria-hidden="true" className="invisible text-[10px] font-normal normal-case">
                          spacer
                        </p>
                      )}
                      <span className="block">{column.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {docDetailRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={DOC_RECEIVING_DETAIL_COLUMNS.length + 1}
                      className="px-4 py-10 text-center text-sm text-stone-500"
                    >
                      No DOC Details lines yet. Use Add Row to create the first line.
                    </td>
                  </tr>
                )}
                {docDetailRows.map(row => (
                  <tr key={row.id} className="odd:bg-card even:bg-secondary/40">
                    <td className="px-1 py-1 align-top">
                      <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => removeDocDetailRow(row.id)}
                        disabled={!canEditDocDetails}
                        className="inline-flex size-8 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Remove DOC detail row"
                      >
                        <Trash2 className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleAddDocDetailsRow}
                        disabled={!canEditDocDetails}
                        className="inline-flex size-8 items-center justify-center rounded-md text-emerald-700 transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Add DOC detail row"
                        title="Add DOC detail row"
                      >
                        <Plus className="size-4" />
                      </button>
                      </div>
                    </td>
                    {DOC_RECEIVING_DETAIL_COLUMNS.map(column => {
                      const selectedRowBuilding = farmOpenFlockBuildings.find(building =>
                        building.warehouseId === row.building_warehouse_id &&
                        building.flockCardId === row.flock_card_id
                      )
                      const rowReceiveDate = row.receive_date || receipt.receiveDate
                      const firstPlacementDate = selectedRowBuilding
                        ? getFirstPlacementDate(selectedRowBuilding.flockCardId, rowReceiveDate)
                        : ''
                      const hasAgeIssue = Boolean(firstPlacementDate && isOutsideDocPlacementWindow(placementAge(
                        firstPlacementDate,
                        rowReceiveDate,
                      )))

                      return (
                      <td key={column.code} className="px-1 py-1 align-top">
                        {column.code === 'building' ? (
                          <div className="min-w-80">
                            <select
                              value={row.building_warehouse_id ?? ''}
                              disabled={!canEditDocDetails || loadingReferences || !receipt.farmId}
                              onFocus={() => setBuildingRefreshKey(current => current + 1)}
                              onChange={event => selectBuilding(row.id, event.target.value)}
                              className={`h-8 w-full rounded-md border px-2 text-sm outline-none focus:ring-2 ${
                                hasAgeIssue
                                  ? 'border-red-500 bg-red-50 text-red-700 focus:ring-red-200'
                                  : 'border-stone-300 bg-white focus:ring-stone-200'
                              } disabled:cursor-not-allowed disabled:bg-stone-100`}
                              aria-label="Building"
                            >
                              <option value="">
                                {loadingReferences
                                  ? 'Loading buildings...'
                                  : receipt.farmId
                                    ? 'Select building...'
                                    : 'Select farm first'}
                              </option>
                              {selectableFarmBuildings.map(({ building, activeCycle }) => (
                                <option
                                  key={building.key}
                                  value={building.id ?? ''}
                                >
                                  {building.code} - {building.name}
                                  {activeCycle ? ` · Age ${activeCycle.cycleAge}` : ' · No active cycle'}
                                </option>
                              ))}
                            </select>
                            {hasAgeIssue && (
                              <p className="mt-1 text-xs font-medium text-red-700">
                                Date Receive is outside the 7-calendar-date placement window from : {formatCalendarDate(firstPlacementDate)}
                              </p>
                            )}
                          </div>
                        ) : (
                        <div>
                          <Input
                            type={
                              DOC_RECEIVING_DATE_DETAIL_CODES.has(column.code)
                                ? 'date'
                                : column.code === 'receive_time'
                                  ? 'time'
                                : DOC_RECEIVING_NUMERIC_DETAIL_CODES.has(column.code)
                                  ? 'number'
                                  : 'text'
                            }
                            value={getDocDetailValue(row, column.code)}
                            readOnly={column.code === 'actual_received'}
                            disabled={!canEditDocDetails}
                            onChange={event => updateDocDetailRow(row.id, column.code, event.target.value)}
                            min={DOC_RECEIVING_NUMERIC_DETAIL_CODES.has(column.code) ? '0' : undefined}
                            max={column.code === 'receive_date' ? today() : undefined}
                            step={DOC_RECEIVING_NUMERIC_DETAIL_CODES.has(column.code) ? 'any' : undefined}
                            className={`h-8 border-stone-300 px-2 text-sm shadow-none focus-visible:ring-stone-200 ${column.code === 'actual_received' || !canEditDocDetails ? 'bg-stone-100' : 'bg-white'}`}
                            aria-label={column.name}
                          />
                        </div>
                        )}
                      </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </FormTable>
          {docPlacementWindowError && (
            <div role="alert" className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {docPlacementWindowError}
            </div>
          )}

          <Dialog
            open={docDetailsModalOpen}
            onOpenChange={open => {
              if (!open && cycleModalOpen) return
              setDocDetailsModalOpen(open)
              if (!open) setModalDocDetailRow(null)
            }}
          >
            <DialogContent
              className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"
              onInteractOutside={event => {
                if (cycleModalOpen) event.preventDefault()
              }}
            >
              <DialogHeader>
                <DialogTitle>Add DOC Details Line</DialogTitle>
                <DialogDescription>
                  Complete the receiving details below. The line is added only after you confirm.
                </DialogDescription>
              </DialogHeader>

              {modalDocDetailRow && (
                <div className="space-y-4">
                  {DOC_RECEIVING_MODAL_GROUPS.map((group, groupIndex) => (
                    <div key={group.key} className="space-y-4">
                      {groupIndex > 0 && <Separator />}
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.columns.map(column => {
                    const selectedModalBuilding = farmOpenFlockBuildings.find(building =>
                      building.warehouseId === modalDocDetailRow.building_warehouse_id &&
                      building.flockCardId === modalDocDetailRow.flock_card_id
                    )
                    const modalReceiveDate = modalDocDetailRow.receive_date || receipt.receiveDate
                    const firstPlacementDate = selectedModalBuilding
                      ? getFirstPlacementDate(selectedModalBuilding.flockCardId, modalReceiveDate)
                      : ''
                    const hasAgeIssue = Boolean(firstPlacementDate && isOutsideDocPlacementWindow(placementAge(
                      firstPlacementDate,
                      modalReceiveDate,
                    )))

                    return (
                      <div
                        key={column.code}
                        className={
                          ['short_count_remarks', 'doa_count_remarks', 'reject_count_remarks'].includes(column.code)
                            ? 'space-y-2 sm:col-span-2 lg:col-span-1'
                            : 'space-y-2'
                        }
                      >
                        <Label required={['mnf_date', 'doc_source', 'building'].includes(column.code)}>
                          <span className="flex flex-col items-start">
                            {DOC_RECEIVING_DETAIL_UNITS[column.code] && (
                              <span className="text-xs font-normal text-muted-foreground">
                                {DOC_RECEIVING_DETAIL_UNITS[column.code]}
                              </span>
                            )}
                            <span>{column.name}</span>
                          </span>
                        </Label>
                        {column.code === 'building' ? (
                          <>
                            <select
                              value={modalDocDetailRow.building_warehouse_id ?? ''}
                              onFocus={() => setBuildingRefreshKey(current => current + 1)}
                              onChange={event => selectModalBuilding(event.target.value)}
                              className={`h-9 w-full rounded-md border px-3 py-2 text-sm text-stone-950 shadow-none outline-none focus:ring-2 dark:text-stone-950 ${
                                hasAgeIssue
                                  ? 'border-red-500 bg-red-50 text-red-700 focus:ring-red-200 dark:bg-red-50'
                                  : 'border-stone-300 bg-white focus:ring-stone-200 dark:bg-white'
                              }`}
                            >
                              <option value="">
                                {receipt.farmId ? 'Select building...' : 'Select farm first'}
                              </option>
                              {selectableFarmBuildings.map(({ building, activeCycle }) => (
                                <option
                                  key={building.key}
                                  value={building.id ?? ''}
                                >
                                  {building.code} - {building.name}
                                  {activeCycle ? ` · Age ${activeCycle.cycleAge}` : ' · No active cycle'}
                                </option>
                              ))}
                            </select>
                            {hasAgeIssue && (
                              <p className="text-xs font-medium text-red-700">
                                Date Receive is outside the 7-calendar-date placement window from : {formatCalendarDate(firstPlacementDate)}
                              </p>
                            )}
                          </>
                        ) : (
                          <div>
                            <Input
                              type={
                                DOC_RECEIVING_DATE_DETAIL_CODES.has(column.code)
                                  ? 'date'
                                  : column.code === 'receive_time'
                                    ? 'time'
                                    : DOC_RECEIVING_NUMERIC_DETAIL_CODES.has(column.code)
                                      ? 'number'
                                      : 'text'
                              }
                              value={getDocDetailValue(modalDocDetailRow, column.code)}
                              readOnly={column.code === 'actual_received'}
                              onChange={event => updateModalDocDetail(column.code, event.target.value)}
                              min={DOC_RECEIVING_NUMERIC_DETAIL_CODES.has(column.code) ? '0' : undefined}
                              max={column.code === 'receive_date' ? today() : undefined}
                              step={DOC_RECEIVING_NUMERIC_DETAIL_CODES.has(column.code) ? 'any' : undefined}
                              className={`h-9 rounded-md border-stone-300 px-3 py-2 text-sm text-stone-950 shadow-none focus-visible:border-stone-400 focus-visible:ring-stone-200 dark:text-stone-950 ${
                                column.code === 'actual_received'
                                  ? 'bg-stone-50 dark:bg-stone-50'
                                  : 'bg-white dark:bg-white'
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDocDetailsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={confirmModalDocDetail}>
                  <Plus className="size-4" />
                  Add Line
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <FormTable
            title="Receive Item Lines"
            description={`${displayReceiptLines.length} ${displayReceiptLines.length === 1 ? 'line' : 'lines'}`}
            className="rounded-none border-0 shadow-none"
            emptyState={displayReceiptLines.length === 0 && (
              <div className="border-t px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No item lines added</p>
                <p className="mt-1 text-sm text-muted-foreground">Item lines will follow the DOC details.</p>
              </div>
            )}
          >
              <table className="min-w-[1480px] w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="h-9 w-12 whitespace-nowrap px-2 text-center align-middle text-xs font-semibold uppercase text-stone-700">#</th>
                    <th className="h-9 min-w-80 whitespace-nowrap px-2 text-left align-middle text-xs font-semibold uppercase text-stone-700">Item Code &amp; Description</th>
                    <th className="h-9 w-56 max-w-56 whitespace-nowrap px-2 text-left align-middle text-xs font-semibold uppercase text-stone-700">Batch</th>
                    <th className="h-9 w-44 whitespace-nowrap px-2 text-left align-middle text-xs font-semibold uppercase text-stone-700">Base UOM Group</th>
                    <th className="h-9 w-28 whitespace-nowrap px-2 text-left align-middle text-xs font-semibold uppercase text-stone-700">Alt Qty</th>
                    <th className="h-9 w-52 whitespace-nowrap px-2 text-left align-middle text-xs font-semibold uppercase text-stone-700">Conversion UoM</th>
                    <th className="h-9 min-w-48 whitespace-nowrap px-2 text-left align-middle text-xs font-semibold uppercase text-stone-700">Warehouse</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayReceiptLines.map((line, index) => {
                    const batchRequirement = getBatchRequirement(line)

                    return (
                      <tr key={line.id} className="odd:bg-card even:bg-secondary/40 hover:bg-accent/30">
                        <td className="px-1 py-1 text-center align-middle text-stone-500">{index + 1}</td>
                        <td className="px-1 py-1 align-middle">
                          <SearchableDropdown
                            list={availableItems}
                            codeLabel="item_code"
                            nameLabel="item_name"
                          value={line.itemCode}
                          placeholder={receipt.fmsType ? 'Select item...' : 'Select FMS type first'}
                          width={420}
                          disabled
                          onChange={(value) => selectItem(line, value)}
                        />
                        </td>
                        <td className="w-56 max-w-56 px-1 py-1 align-top">
                          {batchRequirement ? (
                            <button
                              type="button"
                              onClick={() => setActiveBatchLineId(line.id)}
                              className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-stone-300 bg-stone-100 px-3 py-2 text-left text-sm shadow-none text-stone-600 transition hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-300"
                            >
                              <span className="min-w-0">
                                <span className="flex items-center gap-2 font-medium text-stone-900">
                                  <PackageCheck className="size-4 shrink-0 text-stone-500" />
                                  <span className="truncate">
                                    {line.batchNumber || getGeneratedBatchNumber(line) || 'Batch details'}
                                  </span>
                                </span>
                                {/* <span className="mt-1 flex flex-wrap gap-1 text-xs text-stone-500">
                                  {line.manufacturingDate && <span>MFG {line.manufacturingDate}</span>}
                                  {line.expiryDate && <span>EXP {line.expiryDate}</span>}
                                  {(!line.manufacturingDate || (batchRequirement.needsExpiryDate && !line.expiryDate)) && (
                                    <span>{batchRequirement.needsExpiryDate ? 'MFG/EXP required' : 'MFG required'}</span>
                                  )}
                                </span> */}
                              </span>
                              <Hash className="size-4 shrink-0 text-stone-400" />
                            </button>
                          ) : (
                            <span className="inline-flex h-9 items-center text-stone-400">Not required</span>
                          )}
                        </td>
                      <td className="px-1 py-1 align-middle">
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
                      <td className="px-1 py-1 align-middle">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={line.altQty}
                          disabled
                          onChange={event => updateLine(line.id, {
                            altQty: numberValue(event.target.value),
                            baseQty: calculateBaseQty(
                              numberValue(event.target.value),
                              line.altUom,
                              line.baseUom,
                            ),
                          })}
                          className="border-stone-300 bg-stone-100 shadow-none disabled:cursor-not-allowed disabled:opacity-100"
                        />
                      </td>
                      <td className="px-1 py-1 align-middle text-stone-800">
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
                      <td className="px-1 py-1 align-middle">
                        <div className="min-h-9 rounded-md border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-stone-700">
                          {line.warehouseCode ? (
                            <>
                              <span className="font-medium">{line.warehouseCode}</span>
                              {line.warehouseName ? ` - ${line.warehouseName}` : ''}
                            </>
                          ) : (
                            <span className="text-amber-700">Destination not configured</span>
                          )}
                        </div>
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
                              : activeBatchNumber
                                ? 'bg-stone-100 text-stone-700 hover:bg-stone-100'
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

                    <div className="grid gap-4 sm:grid-cols-2">
                      {activeBatchRequirement.needsManufacturingDate && (
                        <div className="space-y-2">
                          <Label htmlFor="gr-manufacturing-date" required>Manufacturing Date</Label>
                          <Input
                            id="gr-manufacturing-date"
                            type="date"
                            value={activeBatchLine.manufacturingDate}
                            disabled={activeBatchReadOnly}
                            onChange={event => updateBatchLine(activeBatchLine, { manufacturingDate: event.target.value })}
                            className="border-stone-300 bg-white shadow-none focus-visible:ring-stone-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:opacity-100"
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
                            disabled={activeBatchReadOnly}
                            onChange={event => updateBatchLine(activeBatchLine, { expiryDate: event.target.value })}
                            className="border-stone-300 bg-white shadow-none focus-visible:ring-stone-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:opacity-100"
                          />
                        </div>
                      )}

                      {activeBatchRequirement.needsSupplierBatch && (
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="gr-supplier-batch" required>Supplier Batch Number</Label>
                          <Input
                            id="gr-supplier-batch"
                            value={activeBatchLine.supplierBatchNumber}
                            disabled={activeBatchReadOnly}
                            onChange={event => updateLine(activeBatchLine.id, { supplierBatchNumber: event.target.value })}
                            placeholder="Supplier batch no."
                            className="border-stone-300 bg-white shadow-none focus-visible:ring-stone-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:opacity-100"
                          />
                        </div>
                      )}

                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="gr-batch-number">Generated Batch Number</Label>
                        <div className="flex gap-2">
                          <Input
                            id="gr-batch-number"
                            value={activeBatchReadOnly ? activeBatchNumber : activeBatchLine.batchNumber}
                            disabled={activeBatchReadOnly}
                            readOnly={!activeBatchRequirement.rule?.manual_entry && Boolean(activeBatchRequirement.rule)}
                            onChange={event => updateLine(activeBatchLine.id, { batchNumber: event.target.value })}
                            placeholder={activeBatchRequirement.needsExpiryDate ? 'Enter MFG and EXP dates to generate' : 'Enter MFG date to generate'}
                            className="border-stone-300 bg-white shadow-none focus-visible:ring-stone-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:opacity-100"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={activeBatchReadOnly}
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
                    <div className="grid gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-3 text-sm sm:grid-cols-4">
                      <div>
                        <div className="text-xs font-medium text-stone-600">Batch</div>
                        <div className="truncate font-semibold text-stone-950">{activeBatchNumber || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-stone-600">Item</div>
                        <div className="truncate font-semibold text-stone-950">{activeBatchLine.itemCode || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-stone-600">Warehouse</div>
                        <div className="font-semibold text-stone-950">{activeBatchLine.warehouseCode || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-stone-600">Line Quantity</div>
                        <div className="font-semibold tabular-nums text-stone-950">{formatQuantity(activeBatchLine.baseQty)}</div>
                      </div>
                    </div>

                    {loadingBatchTrail && (
                      <div className="flex min-h-32 items-center justify-center gap-2 rounded-md border border-dashed border-stone-300 bg-white text-sm text-stone-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading transaction trail...
                      </div>
                    )}

                    {!loadingBatchTrail && batchTrailRows.length > 0 && (
                      <div className="relative space-y-3 pl-5">
                        <div className="absolute left-[11px] top-2 h-[calc(100%-1rem)] w-px bg-stone-200" />
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

          <div className="mx-2 mb-4 mt-auto flex flex-col items-stretch gap-3 pt-4 sm:mx-4">
            <div className="w-full rounded-lg border bg-card text-card-foreground">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold">Receiving Summary</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Quantity by condition</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-right text-xs sm:grid-cols-4">
                  <div className="rounded-md border px-3 py-2">
                    <div className="text-muted-foreground">Total</div>
                    <div className="font-semibold tabular-nums">
                      {formatQuantity(displayTotalQuantity)}
                    </div>
                  </div>
                  {receivingSummary.map(group => (
                    <div key={group.key} className="rounded-md border px-3 py-2">
                      <div className="text-muted-foreground">{group.label}</div>
                      <div className="font-semibold tabular-nums">
                        {formatQuantity(group.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {canEditDraft ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full space-y-2 sm:max-w-xl">
                  <Label htmlFor="doc-receiving-remarks">Remarks</Label>
                  <Input
                    id="doc-receiving-remarks"
                    value={receipt.remarks}
                    onChange={event => setReceipt(current => current ? { ...current, remarks: event.target.value } : current)}
                    placeholder="Enter remarks..."
                    disabled={saving}
                  />
                </div>
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
              </div>
            ) : (
              <p className="text-sm text-stone-500">This document is already posted and cannot be edited.</p>
            )}
          </div>
        </div>
      </section>

      <CycleInformationModal
        open={cycleModalOpen}
        building={cycleBuilding}
        form={cycleForm}
        age={Math.min(calculateCycleRange(cycleForm.startDate, today()), 45)}
        saving={savingCycle}
        cycleNumberEditable={cycleIsExcluded}
        farmCycle={!cycleIsExcluded}
        onFormChange={changes => setCycleForm(current => ({ ...current, ...changes }))}
        onCreate={createCycle}
        onCancel={() => {
          clearCycleTarget()
          setCycleModalOpen(false)
          setCycleBuilding(null)
          setCycleTarget(null)
        }}
        onOpenChange={open => {
          if (savingCycle) return
          if (!open) {
            clearCycleTarget()
            setCycleBuilding(null)
            setCycleTarget(null)
          }
          setCycleModalOpen(open)
        }}
      />

      <Dialog open={postConfirmOpen} onOpenChange={open => !saving && setPostConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post this DOC receiving document?</DialogTitle>
            <DialogDescription>
              Posting {receipt.grNo} will add inventory for the selected receipt lines and cannot be edited afterward.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">Total Base Quantity</span>
              <span className="font-semibold tabular-nums">
                {displayGoodChickQuantity.toLocaleString('en-PH', { maximumFractionDigits: 6 })}
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
