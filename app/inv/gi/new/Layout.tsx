'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, List, Loader2, PackageCheck, Plus, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import SearchableCombobox from '@/components/SearchableCombobox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Breadcrumb from '@/lib/Breadcrumb'
import SearchableDropdown from '@/lib/SearchableDropdown'
import DeliveryIssueLinesTable from './DeliveryIssueLinesTable'
import GoodsIssueHeaderSection, { type GoodsIssueHeaderField } from './GoodsIssueHeaderSection'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { useSidebar } from '@/lib/sidebar/SidebarProvider'
import { usePermission } from '@/hooks/usePermission'
import { Items, WarehouseData } from '@/lib/types'
import { getInventoryStatusBadgeClass } from '@/app/inv/statusStyles'
import {
  createGoodsIssueNumber,
  getGoodsIssueById,
  getGoodsIssueOnHandShortages,
  getItemWarehouseOnHand,
  getOnHandBatches,
  GoodsIssue,
  GoodsIssueLine,
  GoodsIssueOnHandBatch,
  GoodsIssueStatus,
  saveGoodsIssue,
} from '../api'
import {
  getDeliveryFlockCardInfo,
  getDeliveryFlockCardPlacementBatches,
  getBrDeliveryAgeShortage,
  getBrCleanupAgeShortage,
  getCleanupCycleSummaries,
  getAvailableDeliveryFlockCards,
  getAssociatedWarehouseCode,
  getGoodsIssueReferences,
  GoodsIssueFlockCardInfo,
  type CleanupCycleSummary,
} from './api'
import {
  GoodsReceiptBatchRule,
  GoodsReceiptFarm,
  GoodsReceiptItemGroup,
  UomConversionOption,
  UomGroupOption,
} from '@/app/inv/gr/new/api'
import { getBrDeliverySettings } from '@/app/brd/dr/settings/api'
import { getBrCleanupSettings } from '@/app/brd/cu/settings/api'

const INITIAL_LINE_COUNT = 5
const MIN_LINES_TO_ADD = 1
const MAX_LINES_TO_ADD = 50
const QUANTITY_LOCALE = 'en-PH'
const QUANTITY_FORMAT_OPTIONS: Intl.NumberFormatOptions = { maximumFractionDigits: 6 }

type DeliveryPlacementBatch = GoodsIssueOnHandBatch & {
  itemName?: string
}

const today = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const newLine = (): GoodsIssueLine => ({
  id: crypto.randomUUID(),
  itemId: null,
  itemCode: '',
  description: '',
  lineRemarks: '',
  batchRuleId: null,
  batchNumber: '',
  manufacturingDate: '',
  expiryDate: '',
  altQty: 1,
  altUom: '',
  baseQty: 1,
  baseUom: '',
  fromWarehouseId: null,
  fromWarehouseCode: '',
  fromWarehouseName: '',
  onHandQty: 0,
  requestedAltQty: 1,
  batchTotalQty: 0,
  varianceQty: 0,
})

const emptyIssue = (giNo: string): GoodsIssue => ({
  id: null,
  giNo,
  triggeredBy: 'GI',
  issueDate: today(),
  farmId: null,
  farmCode: '',
  farmName: '',
  fromWarehouseId: null,
  fromWarehouseCode: '',
  fromWarehouseName: '',
  remarks: '',
  haulerName: '',
  plateNumber: null,
  truckSeal: null,
  destination: '',
  liveSalesCustomerName: '',
  status: 'Draft',
  lines: Array.from({ length: INITIAL_LINE_COUNT }, newLine),
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

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) return JSON.stringify(error)
  return String(error)
}

const formatQuantity = (value: number) =>
  value.toLocaleString(QUANTITY_LOCALE, QUANTITY_FORMAT_OPTIONS)

const formatShortageMessage = (shortage: {
  itemCode: string
  warehouseCode: string
  batchNumber: string
  onHandQty: number
}) => {
  const batchText = shortage.batchNumber ? ` batch ${shortage.batchNumber}` : ''
  return `${shortage.itemCode}${batchText} has only ${formatQuantity(shortage.onHandQty)} on hand in ${shortage.warehouseCode}.`
}

const batchOptionKey = (line: Pick<GoodsIssueLine, 'itemCode' | 'fromWarehouseCode'>) =>
  `${line.itemCode.trim().toUpperCase()}|${line.fromWarehouseCode.trim().toUpperCase()}`

const allocatedBatchKey = (line: Pick<GoodsIssueLine, 'itemCode' | 'fromWarehouseCode' | 'batchNumber'>) =>
  [
    line.itemCode.trim().toUpperCase(),
    line.fromWarehouseCode.trim().toUpperCase(),
    line.batchNumber.trim().toUpperCase(),
  ].join('|')

const canSearchLineInventory = (line: Pick<GoodsIssueLine, 'itemCode' | 'fromWarehouseCode'>) =>
  Boolean(line.itemCode.trim() && line.fromWarehouseCode.trim())

const getLineFlockCardLookupKey = (
  farmId: number | null | undefined,
  line: Pick<GoodsIssueLine, 'fromWarehouseId' | 'fromWarehouseCode'>,
) => {
  const normalizedFarmId = Number(farmId ?? 0)
  const buildingCode = line.fromWarehouseCode.trim().toUpperCase()
  if (!Number.isFinite(normalizedFarmId) || normalizedFarmId <= 0 || !buildingCode) return ''

  return `${normalizedFarmId}|${line.fromWarehouseId ?? ''}|${buildingCode}`
}

const getFarmWarehouseCodes = (farm?: GoodsReceiptFarm | null) => {
  const associations = farm?.associated_warehouses
  if (!Array.isArray(associations)) return new Set<string>()

  return new Set(associations.map(getAssociatedWarehouseCode).filter(Boolean))
}

const getWarehousesForFarm = (
  farm: GoodsReceiptFarm | null | undefined,
  warehouses: WarehouseData[],
  warehouseTypeFilter?: string,
) => {
  const warehouseCodes = getFarmWarehouseCodes(farm)
  const farmId = farm?.id == null ? '' : String(farm.id)
  const farmCode = String(farm?.code ?? '').trim()
  if (!warehouseCodes.size && (!warehouseTypeFilter || (!farmId && !farmCode))) return []

  const normalizedTypeFilter = warehouseTypeFilter?.trim().toLowerCase()

  return warehouses.filter(warehouse => {
    const warehouseCode = String(warehouse.whse_code ?? '').trim()
    const matchesAssociation = warehouseCodes.has(warehouseCode)
    const matchesDirectFarm =
      Boolean(normalizedTypeFilter) &&
      ((farmId && String(warehouse.farm_id ?? '') === farmId) ||
        (farmCode && String(warehouse.farm_code ?? '').trim() === farmCode))
    const matchesType = !normalizedTypeFilter ||
      String(warehouse.warehouse_type ?? '').trim().toLowerCase() === normalizedTypeFilter

    return (matchesAssociation || matchesDirectFarm) && matchesType
  })
}

const formatDateValue = (value: string) => value || '-'

const itemUsesBatchManagement = (item?: Items | null) =>
  Boolean(
    item?.manage_batch_numbers ||
    (item?.batch_management_method && item.batch_management_method !== 'NONE'),
  )

const batchRulePriority = (rule: GoodsReceiptBatchRule) =>
  Number(Boolean(rule.item_id)) +
  Number(Boolean(rule.warehouse_id)) +
  Number(Boolean(rule.branch_id)) +
  Number(Boolean(rule.item_group_id))

const clearWarehouseSensitiveLineData = (
  line: GoodsIssueLine,
  warehouse: Pick<WarehouseData, 'id' | 'whse_code' | 'whse_name'> | null,
): GoodsIssueLine => ({
  ...line,
  fromWarehouseId: warehouse?.id ?? null,
  fromWarehouseCode: warehouse?.whse_code ?? '',
  fromWarehouseName: warehouse?.whse_name ?? '',
  batchNumber: '',
  manufacturingDate: '',
  expiryDate: '',
  onHandQty: 0,
})

const normalizeLineCount = (value: string) =>
  Math.max(MIN_LINES_TO_ADD, numberValue(value))

type GoodsIssueFormMode = 'draft' | 'post'

type NewGoodsIssueProps = {
  mode?: GoodsIssueFormMode
  triggeredBy?: string
  documentPrefix?: string
  documentNumberLabel?: string
  issueDateLabel?: string
  basePath?: string
  permissionPath?: string
  parentLabel?: string
  parentLink?: string
  listLabel?: string
  formLabel?: string
  useDefaultFarm?: boolean
  warehouseLabel?: string
  warehouseTypeFilter?: string
  showFlockCardInformation?: boolean
  warehouseScope?: 'header' | 'line'
  allowImmediatePost?: boolean
  showLineRemarks?: boolean
  lineQuantityLabel?: string
  showLineQuantityAllocationWarnings?: boolean
  showLineOnHandQuantity?: boolean
  showLineVariance?: boolean
  lockedLineQuantityEditable?: boolean
  showRemarksInActionRow?: boolean
}

function GoodsIssueLoadingShell() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-stone-50/40 pb-8 text-stone-950">
      <div className="mx-4 mt-8 flex items-center justify-between gap-3">
        <div className="h-6 w-56 rounded bg-stone-200" />
        <div className="h-9 w-24 rounded-md bg-stone-100" />
      </div>
      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid gap-x-16 gap-y-3 p-5 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid items-center gap-2 sm:grid-cols-[112px_minmax(0,300px)]">
              <div className="h-4 w-20 rounded bg-stone-200" />
              <div className="h-9 rounded-md bg-stone-100" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export default function NewGoodsIssue({
  mode = 'draft',
  triggeredBy = 'GI',
  documentPrefix = 'GI',
  documentNumberLabel,
  issueDateLabel = 'Issue Date',
  basePath = '/inv/gi',
  permissionPath = '/inv/gi',
  parentLabel = 'Inventory',
  parentLink = '/inv',
  listLabel = 'Item Stock Out',
  formLabel,
  useDefaultFarm = false,
  warehouseLabel = 'Warehouse',
  warehouseTypeFilter,
  showFlockCardInformation = false,
  warehouseScope = 'header',
  allowImmediatePost = false,
  showLineRemarks = false,
  lineQuantityLabel = 'To Transfer',
  showLineQuantityAllocationWarnings = true,
  showLineOnHandQuantity = true,
  showLineVariance = false,
  lockedLineQuantityEditable = false,
  showRemarksInActionRow = false,
}: NewGoodsIssueProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getValue } = useGlobalContext()
  const { setCollapsed } = useSidebar()
  const issueId = searchParams.get('id')
  const duplicateId = searchParams.get('duplicateId')
  const isPostMode = mode === 'post'
  const cannotInsert = usePermission(`${permissionPath}/insert`)
  const cannotEdit = usePermission(`${permissionPath}/edit`)
  const [issue, setIssue] = useState<GoodsIssue | null>(null)
  const [items, setItems] = useState<Items[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [farms, setFarms] = useState<GoodsReceiptFarm[]>([])
  const [uomGroups, setUomGroups] = useState<UomGroupOption[]>([])
  const [conversions, setConversions] = useState<UomConversionOption[]>([])
  const [itemGroups, setItemGroups] = useState<GoodsReceiptItemGroup[]>([])
  const [batchRules, setBatchRules] = useState<GoodsReceiptBatchRule[]>([])
  const [batchOptions, setBatchOptions] = useState<Record<string, GoodsIssueOnHandBatch[]>>({})
  const [loadingBatchOptions, setLoadingBatchOptions] = useState<Record<string, boolean>>({})
  const [batchAllocationDrafts, setBatchAllocationDrafts] = useState<Record<string, number>>({})
  const [flockCardInfo, setFlockCardInfo] = useState<GoodsIssueFlockCardInfo | null>(null)
  const [loadingFlockCardInfo, setLoadingFlockCardInfo] = useState(false)
  const [lineFlockCardInfo, setLineFlockCardInfo] = useState<Record<string, {
    loading: boolean
    info: GoodsIssueFlockCardInfo | null
  }>>({})
  const [linePlacementBatches, setLinePlacementBatches] = useState<Record<string, DeliveryPlacementBatch[]>>({})
  const [loadingLinePlacementBatches, setLoadingLinePlacementBatches] = useState<Record<string, boolean>>({})
  const lineFlockCardCacheRef = useRef<Record<string, {
    info: GoodsIssueFlockCardInfo | null
    placementBatches: DeliveryPlacementBatch[]
  }>>({})
  const batchSelectionActionsRef = useRef<{
    getBatchOptionsForLine?: (line: GoodsIssueLine) => GoodsIssueOnHandBatch[]
    selectBatch?: (line: GoodsIssueLine, batchNumber: string) => Promise<void>
    autoSelectDeliveryBatches?: (line: GoodsIssueLine) => void
  }>({})
  const itemSelectionActionsRef = useRef<{
    getItemsForLine?: (line: GoodsIssueLine) => Items[]
    selectItem?: (line: GoodsIssueLine, value: string) => Promise<void>
  }>({})
  const handledAutoBatchSelectionRef = useRef<Record<string, string>>({})
  const initializedDeliveryFarmRef = useRef<string>('')
  const [activeBatchLineId, setActiveBatchLineId] = useState<GoodsIssueLine['id'] | null>(null)
  const [deliveryBatchAutoSelection, setDeliveryBatchAutoSelection] = useState(false)
  const [eligibleDeliveryBuildingCodes, setEligibleDeliveryBuildingCodes] = useState<Set<string> | null>(null)
  const [noAvailableDeliveryBuildings, setNoAvailableDeliveryBuildings] = useState(false)
  const [postConfirmOpen, setPostConfirmOpen] = useState(false)
  const [lineCount, setLineCount] = useState(1)
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cleanupSummaries, setCleanupSummaries] = useState<CleanupCycleSummary[]>([])
  const [loadingCleanupSummaries, setLoadingCleanupSummaries] = useState(false)
  const [cleanupSummaryError, setCleanupSummaryError] = useState('')
  const usesLineWarehouse = warehouseScope === 'line'
  const isBroilerCycleIssue = triggeredBy === 'BR-DR' || triggeredBy === 'BR-CU'
  const usesBroilerLineLayout = usesLineWarehouse && isBroilerCycleIssue
  const isCleanup = triggeredBy === 'BR-CU'

  useEffect(() => {
    setCollapsed(true)
  }, [setCollapsed])

  useEffect(() => {
    let cancelled = false

    async function loadPageData() {
      try {
        if (isPostMode && !issueId) {
          toast(`Select a draft ${listLabel.toLowerCase()} transaction to post.`)
          router.push(basePath)
          return
        }

        const cachedItems = asArray<Items>(getValue('itemmaster'))
          .filter(item => item.void === 1 || item.void == null)
        const cachedWarehouses = getCachedWarehouses(getValue('warehouses'))
          .filter(warehouse => !('is_active' in warehouse) || warehouse.is_active !== false)
        const canUseCachedWarehouses = !warehouseTypeFilter ||
          cachedWarehouses.some(warehouse => 'warehouse_type' in warehouse)

        const referencesPromise = cachedItems.length > 0 && cachedWarehouses.length > 0 && canUseCachedWarehouses
          ? getGoodsIssueReferences().then(references => ({
            ...references,
            items: cachedItems,
            warehouses: cachedWarehouses,
          }))
          : getGoodsIssueReferences()

        const sourceIssueId = issueId ?? duplicateId
        const isDuplicating = !issueId && Boolean(duplicateId)
        const [references, savedIssue, giNo] = await Promise.all([
          referencesPromise,
          sourceIssueId ? getGoodsIssueById(Number(sourceIssueId), triggeredBy) : Promise.resolve(null),
          issueId ? Promise.resolve('') : createGoodsIssueNumber(documentPrefix),
        ])

        if (cancelled) return

        if (savedIssue && savedIssue.triggeredBy !== triggeredBy) {
          toast(`This document belongs to ${savedIssue.triggeredBy}.`)
          router.push(basePath)
          return
        }

        const requestedQtyByGroup = new Map<string, number>()
        if (isDuplicating && savedIssue) {
          savedIssue.lines.forEach(line => {
            const groupKey = `${line.fromWarehouseId ?? line.fromWarehouseCode}|${line.itemId ?? line.itemCode}`
            requestedQtyByGroup.set(
              groupKey,
              (requestedQtyByGroup.get(groupKey) ?? 0) + Number(line.altQty || 0),
            )
          })
        }

        const nextIssue: GoodsIssue = isDuplicating && savedIssue
          ? {
              ...savedIssue,
              id: null,
              giNo,
              issueDate: today(),
              status: 'Draft',
              createdAt: new Date().toISOString(),
              triggeredBy,
              lines: savedIssue.lines.map(line => {
                const groupKey = `${line.fromWarehouseId ?? line.fromWarehouseCode}|${line.itemId ?? line.itemCode}`
                return {
                  ...line,
                  id: crypto.randomUUID(),
                  requestedAltQty: requestedQtyByGroup.get(groupKey) ?? Number(line.altQty || 0),
                }
              }),
            }
          : savedIssue
            ? { ...savedIssue, triggeredBy: savedIssue.triggeredBy || triggeredBy }
            : { ...emptyIssue(giNo), triggeredBy }

        if (!savedIssue && useDefaultFarm) {
          const defaultFarmId = getValue('DefaultFarmId')
          const defaultFarm = references.farms.find(farm => String(farm.id) === String(defaultFarmId))
          const farmToAutoSelect = defaultFarm ?? (references.farms.length === 1 ? references.farms[0] : null)

          if (farmToAutoSelect) {
            const availableWarehouses = getWarehousesForFarm(farmToAutoSelect, references.warehouses, warehouseTypeFilter)
            const autoSelectedWarehouse = !usesLineWarehouse && availableWarehouses.length === 1
              ? availableWarehouses[0]
              : null

            nextIssue.farmId = farmToAutoSelect.id
            nextIssue.farmCode = farmToAutoSelect.code ?? ''
            nextIssue.farmName = farmToAutoSelect.name ?? ''
            nextIssue.fromWarehouseId = autoSelectedWarehouse?.id ?? null
            nextIssue.fromWarehouseCode = autoSelectedWarehouse?.whse_code ?? ''
            nextIssue.fromWarehouseName = autoSelectedWarehouse?.whse_name ?? ''
            nextIssue.lines = nextIssue.lines.map(line => clearWarehouseSensitiveLineData(line, autoSelectedWarehouse))
          }
        }

        setIssue(nextIssue)
        setItems(references.items)
        setWarehouses(references.warehouses)
        setFarms(references.farms)
        setUomGroups(references.uomGroups)
        setConversions(references.conversions)
        setItemGroups(references.itemGroups)
        setBatchRules(references.batchRules)
      } catch (error) {
        const message = getErrorMessage(error)
        console.error('Goods issue load failed:', message, error)
        toast(message || 'Reference data could not be loaded.')
      } finally {
        if (!cancelled) setLoadingReferences(false)
      }
    }

    loadPageData()

    return () => {
      cancelled = true
    }
  }, [basePath, documentPrefix, duplicateId, getValue, isPostMode, issueId, listLabel, router, triggeredBy, useDefaultFarm, usesLineWarehouse, warehouseTypeFilter])

  const selectedFarm = useMemo(
    () => farms.find(farm => farm.id === issue?.farmId),
    [farms, issue?.farmId],
  )

  const farmWarehouses = useMemo(
    () => getWarehousesForFarm(selectedFarm, warehouses, warehouseTypeFilter),
    [selectedFarm, warehouses, warehouseTypeFilter],
  )
  const deliveryFarmWarehouses = useMemo(
    () => !isBroilerCycleIssue
      ? farmWarehouses
      : farmWarehouses.filter(warehouse =>
          eligibleDeliveryBuildingCodes?.has(String(warehouse.whse_code ?? '').trim().toUpperCase()),
        ),
    [eligibleDeliveryBuildingCodes, farmWarehouses, isBroilerCycleIssue],
  )

  useEffect(() => {
    let cancelled = false

    async function loadDeliverySettings() {
      if (!isBroilerCycleIssue || !issue?.farmId) {
        setDeliveryBatchAutoSelection(false)
        setEligibleDeliveryBuildingCodes(null)
        setNoAvailableDeliveryBuildings(false)
        initializedDeliveryFarmRef.current = ''
        return
      }

      setEligibleDeliveryBuildingCodes(new Set())
      try {
        const cleanupSettings = triggeredBy === 'BR-CU'
          ? await getBrCleanupSettings(Number(issue.farmId))
          : null
        const deliverySettings = triggeredBy === 'BR-DR'
          ? await getBrDeliverySettings(Number(issue.farmId))
          : null
        if (cancelled) return

        setDeliveryBatchAutoSelection(
          triggeredBy === 'BR-CU' || Boolean(deliverySettings?.batch_auto_selection),
        )

        const farmKey = String(issue.farmId)
        const shouldInitializeBuildings =
          !loadingReferences &&
          !issue.id &&
          !duplicateId &&
          issue.status === 'Draft' &&
          initializedDeliveryFarmRef.current !== farmKey

        const availableCards = await getAvailableDeliveryFlockCards({
          farmId: Number(issue.farmId),
          targetAge: Number(cleanupSettings?.target_cleanup_age ?? deliverySettings?.target_delivery_age ?? 0),
        })
        if (cancelled) return

        const warehouseById = new Map(
          farmWarehouses.map(warehouse => [Number(warehouse.id), warehouse]),
        )
        const warehouseByCode = new Map(
          farmWarehouses.map(warehouse => [
            String(warehouse.whse_code ?? '').trim().toUpperCase(),
            warehouse,
          ]),
        )
        const availableBuildings = availableCards.flatMap(card => {
          const warehouse =
            warehouseById.get(Number(card.buildingWarehouseId ?? 0)) ??
            warehouseByCode.get(card.buildingCode.trim().toUpperCase())
          return warehouse ? [warehouse] : []
        })

        setEligibleDeliveryBuildingCodes(new Set(
          availableBuildings.map(warehouse => String(warehouse.whse_code ?? '').trim().toUpperCase()),
        ))
        setNoAvailableDeliveryBuildings(availableBuildings.length === 0)
        if (!shouldInitializeBuildings) return

        initializedDeliveryFarmRef.current = farmKey
        setIssue(current => {
          if (!current || String(current.farmId) !== farmKey || current.id) return current
          return {
            ...current,
            lines: availableBuildings.length > 0
              ? availableBuildings.map(warehouse =>
                  clearWarehouseSensitiveLineData(newLine(), warehouse),
                )
              : [newLine()],
          }
        })
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setDeliveryBatchAutoSelection(false)
          setEligibleDeliveryBuildingCodes(new Set())
          initializedDeliveryFarmRef.current = ''
        }
      }
    }

    handledAutoBatchSelectionRef.current = {}
    loadDeliverySettings()

    return () => {
      cancelled = true
    }
  }, [
    duplicateId,
    farmWarehouses,
    issue?.farmId,
    issue?.id,
    issue?.status,
    loadingReferences,
    triggeredBy,
    isBroilerCycleIssue,
  ])

  const lineWarehouseSignature = useMemo(
    () => issue?.lines
      .map(line => `${line.id}:${line.fromWarehouseId ?? ''}:${line.fromWarehouseCode}`)
      .join('|') ?? '',
    [issue?.lines],
  )

  const lineWarehouseLookups = useMemo(
    () => lineWarehouseSignature
      .split('|')
      .filter(Boolean)
      .map(value => {
        const [id, rawWarehouseId, ...warehouseCodeParts] = value.split(':')
        const warehouseId = Number(rawWarehouseId)

        return {
          id,
          fromWarehouseId: Number.isFinite(warehouseId) && warehouseId > 0 ? warehouseId : null,
          fromWarehouseCode: warehouseCodeParts.join(':'),
        }
      }),
    [lineWarehouseSignature],
  )

  useEffect(() => {
    let cancelled = false

    async function loadCleanupSummaries() {
      if (!isCleanup || !issue?.farmId) {
        setCleanupSummaries([])
        setCleanupSummaryError('')
        return
      }

      const buildings = Array.from(new Map(
        lineWarehouseLookups
          .filter(line => line.fromWarehouseCode)
          .map(line => [
            `${line.fromWarehouseId ?? ''}|${line.fromWarehouseCode.trim().toUpperCase()}`,
            { warehouseId: line.fromWarehouseId, warehouseCode: line.fromWarehouseCode },
          ]),
      ).values())

      if (buildings.length === 0) {
        setCleanupSummaries([])
        setCleanupSummaryError('')
        return
      }

      setLoadingCleanupSummaries(true)
      setCleanupSummaryError('')
      try {
        const summaries = await getCleanupCycleSummaries({
          farmId: Number(issue.farmId),
          cleanupDocumentId: issue.id,
          buildings,
        })
        if (!cancelled) setCleanupSummaries(summaries)
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setCleanupSummaries([])
          setCleanupSummaryError(error instanceof Error ? error.message : 'Unable to load Clean up summary.')
        }
      } finally {
        if (!cancelled) setLoadingCleanupSummaries(false)
      }
    }

    void loadCleanupSummaries()
    return () => { cancelled = true }
  }, [isCleanup, issue?.farmId, issue?.id, lineWarehouseLookups])

  useEffect(() => {
    let cancelled = false

    async function loadFlockCardInfo() {
      if (usesLineWarehouse || !showFlockCardInformation || !issue?.farmId || !issue.fromWarehouseCode) {
        setFlockCardInfo(null)
        return
      }

      setLoadingFlockCardInfo(true)
      try {
        const info = await getDeliveryFlockCardInfo({
          farmId: issue.farmId,
          buildingWarehouseId: issue.fromWarehouseId,
          buildingCode: issue.fromWarehouseCode,
        })

        if (!cancelled) setFlockCardInfo(info)
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setFlockCardInfo(null)
          toast('Flock card information could not be loaded.')
        }
      } finally {
        if (!cancelled) setLoadingFlockCardInfo(false)
      }
    }

    loadFlockCardInfo()

    return () => {
      cancelled = true
    }
  }, [issue?.farmId, issue?.fromWarehouseCode, issue?.fromWarehouseId, showFlockCardInformation, usesLineWarehouse])

  useEffect(() => {
    if (isCleanup) lineFlockCardCacheRef.current = {}
  }, [isCleanup, issue?.id])

  useEffect(() => {
    let cancelled = false

    async function loadLineFlockCardInfo() {
      if (!usesLineWarehouse || !showFlockCardInformation || !issue?.farmId) {
        setLineFlockCardInfo({})
        setLinePlacementBatches({})
        setLoadingLinePlacementBatches({})
        lineFlockCardCacheRef.current = {}
        return
      }

      const linesWithBuildings = lineWarehouseLookups.filter(line => line.fromWarehouseCode)
      const activeLineIds = new Set(lineWarehouseLookups.map(line => String(line.id)))
      const missingLookups = new Map<string, {
        farmId: number
        buildingWarehouseId: number | null
        buildingCode: string
      }>()

      lineWarehouseLookups.forEach(line => {
        const lookupKey = getLineFlockCardLookupKey(issue.farmId, line)
        const cached = lookupKey ? lineFlockCardCacheRef.current[lookupKey] : null

        if (lookupKey && !cached) {
          missingLookups.set(lookupKey, {
            farmId: Number(issue.farmId),
            buildingWarehouseId: line.fromWarehouseId,
            buildingCode: line.fromWarehouseCode,
          })
        }
      })

      setLineFlockCardInfo(current => {
        const nextState: Record<string, { loading: boolean; info: GoodsIssueFlockCardInfo | null }> = {}

        lineWarehouseLookups.forEach(line => {
          const id = String(line.id)
          const lookupKey = getLineFlockCardLookupKey(issue.farmId, line)
          const cached = lookupKey ? lineFlockCardCacheRef.current[lookupKey] : null

          nextState[id] = cached
            ? { loading: false, info: cached.info }
            : {
                loading: Boolean(lookupKey),
                info: current[id]?.info ?? null,
              }
        })

        return nextState
      })

      setLinePlacementBatches(current => {
        const nextBatches: Record<string, DeliveryPlacementBatch[]> = {}

        lineWarehouseLookups.forEach(line => {
          const id = String(line.id)
          const lookupKey = getLineFlockCardLookupKey(issue.farmId, line)
          const cached = lookupKey ? lineFlockCardCacheRef.current[lookupKey] : null
          nextBatches[id] = cached?.placementBatches ?? current[id] ?? []
        })

        Object.keys(nextBatches).forEach(id => {
          if (!activeLineIds.has(id)) delete nextBatches[id]
        })

        return nextBatches
      })
      setLoadingLinePlacementBatches(() => {
        const nextLoading: Record<string, boolean> = {}

        lineWarehouseLookups.forEach(line => {
          const id = String(line.id)
          const lookupKey = getLineFlockCardLookupKey(issue.farmId, line)
          const cached = lookupKey ? lineFlockCardCacheRef.current[lookupKey] : null
          nextLoading[id] = Boolean(lookupKey && !cached)
        })

        Object.keys(nextLoading).forEach(id => {
          if (!activeLineIds.has(id)) delete nextLoading[id]
        })

        return nextLoading
      })

      if (missingLookups.size === 0) return

      const infoResults = await Promise.all(
        Array.from(missingLookups.entries()).map(async ([lookupKey, params]) => {
          try {
            const info = await getDeliveryFlockCardInfo({
              farmId: params.farmId,
              buildingWarehouseId: params.buildingWarehouseId,
              buildingCode: params.buildingCode,
              cleanupDocumentId: isCleanup ? issue.id : null,
            })
            return { lookupKey, info }
          } catch (error) {
            console.error(error)
            return { lookupKey, info: null }
          }
        }),
      )

      if (cancelled) return

      infoResults.forEach(result => {
        lineFlockCardCacheRef.current[result.lookupKey] = {
          info: result.info,
          placementBatches: lineFlockCardCacheRef.current[result.lookupKey]?.placementBatches ?? [],
        }
      })

      setLineFlockCardInfo(() => {
        const updated: Record<string, { loading: boolean; info: GoodsIssueFlockCardInfo | null }> = {}
        lineWarehouseLookups.forEach(line => {
          const id = String(line.id)
          const lookupKey = getLineFlockCardLookupKey(issue.farmId, line)
          const cached = lookupKey ? lineFlockCardCacheRef.current[lookupKey] : null
          updated[id] = { loading: false, info: cached?.info ?? null }
        })
        infoResults.forEach(result => {
          const matchingLines = linesWithBuildings.filter(line =>
            getLineFlockCardLookupKey(issue.farmId, line) === result.lookupKey,
          )
          matchingLines.forEach(line => {
            updated[String(line.id)] = { loading: false, info: result.info }
          })
        })
        return updated
      })

      const placementResults = await Promise.all(
        infoResults.map(async result => {
          try {
            const placementBatches = result.info?.cardNo
              ? await getDeliveryFlockCardPlacementBatches({
                  flockCardId: result.info.id,
                  farmId: result.info.farmId,
                  buildingWarehouseId: result.info.buildingWarehouseId,
                  buildingCode: result.info.buildingCode,
                  cycleNumber: result.info.cycleNumber,
                })
              : []
            return { lookupKey: result.lookupKey, placementBatches }
          } catch (error) {
            console.error(error)
            return { lookupKey: result.lookupKey, placementBatches: [] }
          }
        }),
      )

      if (cancelled) return

      placementResults.forEach(result => {
        const cached = lineFlockCardCacheRef.current[result.lookupKey]
        lineFlockCardCacheRef.current[result.lookupKey] = {
          info: cached?.info ?? null,
          placementBatches: result.placementBatches,
        }
      })

      setLinePlacementBatches(() => {
        const updated: Record<string, DeliveryPlacementBatch[]> = {}
        lineWarehouseLookups.forEach(line => {
          const lookupKey = getLineFlockCardLookupKey(issue.farmId, line)
          const cached = lookupKey ? lineFlockCardCacheRef.current[lookupKey] : null
          updated[String(line.id)] = cached?.placementBatches ?? []
        })
        return updated
      })
      setLoadingLinePlacementBatches(current => {
        const updated = { ...current }
        placementResults.forEach(result => {
          const matchingLines = linesWithBuildings.filter(line =>
            getLineFlockCardLookupKey(issue.farmId, line) === result.lookupKey,
          )
          matchingLines.forEach(line => {
            updated[String(line.id)] = false
          })
        })
        return updated
      })
    }

    loadLineFlockCardInfo()

    return () => {
      cancelled = true
    }
  }, [isCleanup, issue?.farmId, issue?.id, lineWarehouseLookups, showFlockCardInformation, usesLineWarehouse])

  const farmOptions = useMemo(
    () => farms.map(farm => ({
      code: String(farm.id),
      name: farm.code ? `${farm.code} - ${farm.name}` : farm.name || String(farm.id),
    })),
    [farms],
  )

  const itemGroupIdByCode = useMemo(() => {
    const map = new Map<string, number>()
    itemGroups.forEach(group => {
      const code = String(group.code ?? '').trim().toUpperCase()
      if (code) map.set(code, group.id)
    })
    return map
  }, [itemGroups])

  const updateLine = (id: GoodsIssueLine['id'], changes: Partial<GoodsIssueLine>) => {
    setIssue(current => current
      ? { ...current, lines: current.lines.map(line => line.id === id ? { ...line, ...changes } : line) }
      : current,
    )
  }

  const getSelectedItem = useCallback((line: GoodsIssueLine) =>
    items.find(item => item.id === line.itemId), [items])

  const getItemGroupId = (item: Items) => {
    const rawGroup = String(item.item_group ?? '').trim()
    const numericGroup = Number(rawGroup)
    if (Number.isFinite(numericGroup) && numericGroup > 0) return numericGroup
    return itemGroupIdByCode.get(rawGroup.toUpperCase()) ?? null
  }

  const getBatchRuleForLine = (line: GoodsIssueLine) => {
    const item = getSelectedItem(line)
    if (!item || !issue) return null

    if (!itemUsesBatchManagement(item)) return null

    const itemGroupId = getItemGroupId(item)
    const matchedRules = batchRules.filter(rule => {
      if (rule.item_id && rule.item_id !== item.id) return false
      if (rule.warehouse_id && rule.warehouse_id !== line.fromWarehouseId) return false
      if (rule.branch_id && rule.branch_id !== issue.farmId) return false
      if (rule.item_group_id && rule.item_group_id !== itemGroupId) return false
      return true
    })

    return matchedRules.sort((left, right) => {
      return batchRulePriority(right) - batchRulePriority(left)
    })[0] ?? null
  }

  const itemNeedsBatch = (line: GoodsIssueLine) => {
    const item = getSelectedItem(line)
    return itemUsesBatchManagement(item)
  }

  const calculateBaseQty = useCallback((altQty: number, altUom: string, groupCode: string) => {
    if (!altUom || !groupCode) return 0

    const conversion = conversions.find(
      option =>
        option.groupCode.toUpperCase() === groupCode.trim().toUpperCase() &&
        option.uomCode.toUpperCase() === altUom.trim().toUpperCase(),
    )

    return conversion ? altQty * conversion.baseQty : 0
  }, [conversions])

  const getLineWithRecalculatedQuantity = (line: GoodsIssueLine): GoodsIssueLine => {
    const altQty = Number(line.altQty || 0)

    return {
      ...line,
      altQty,
      baseQty: calculateBaseQty(altQty, line.altUom, line.baseUom),
      batchRuleId: getBatchRuleForLine(line)?.id ?? null,
    }
  }

  const lineHasEnteredItem = (line: GoodsIssueLine) =>
    Boolean(line.itemCode.trim() || line.description.trim() || line.itemId)

  const lineHasInvalidQuantity = (line: GoodsIssueLine) =>
    !line.baseUom || !line.altUom || line.altQty <= 0 || line.baseQty <= 0

  const getGroupUoms = useCallback((groupCode: string) => {
    const seen = new Set<string>()
    return conversions
      .filter(conversion => conversion.groupCode === groupCode)
      .filter(conversion => {
        const code = conversion.uomCode.toUpperCase()
        if (seen.has(code)) return false
        seen.add(code)
        return true
      })
  }, [conversions])

  const getSelectedGroup = (groupCode: string) =>
    uomGroups.find(group => group.code === groupCode)

  const getSelectedConversion = (groupCode: string, uomCode: string) =>
    conversions.find(
      conversion =>
        conversion.groupCode === groupCode &&
        conversion.uomCode.toUpperCase() === uomCode.toUpperCase(),
    )

  const getDefaultAltUom = useCallback((groupCode: string) =>
    getGroupUoms(groupCode)[0]?.uomCode ?? '', [getGroupUoms])

  const refreshLineOnHand = async (line: GoodsIssueLine) => {
    if (!canSearchLineInventory(line)) return

    const needsBatch = itemNeedsBatch(line)
    const key = batchOptionKey(line)

    if (needsBatch) {
      setLoadingBatchOptions(current => ({ ...current, [key]: true }))
    }

    try {
      const [onHandQty, batches] = await Promise.all([
        getItemWarehouseOnHand(line.itemCode, line.fromWarehouseCode, needsBatch ? line.batchNumber : undefined),
        needsBatch ? getOnHandBatches(line.itemCode, line.fromWarehouseCode) : Promise.resolve([]),
      ])

      setBatchOptions(current => ({
        ...current,
        [key]: batches,
      }))

      updateLine(line.id, { onHandQty })
    } finally {
      if (needsBatch) {
        setLoadingBatchOptions(current => ({ ...current, [key]: false }))
      }
    }
  }

  const selectFarm = (value: string) => {
    const farm = farms.find(candidate => String(candidate.id) === value)
    const autoSelectedWarehouse = (() => {
      const availableWarehouses = getWarehousesForFarm(farm, warehouses, warehouseTypeFilter)
      return !usesLineWarehouse && availableWarehouses.length === 1 ? availableWarehouses[0] : null
    })()
    const updatedLines = issue?.lines.map(line =>
      clearWarehouseSensitiveLineData(line, autoSelectedWarehouse),
    ) ?? []

    setIssue(current => current ? {
      ...current,
      farmId: farm?.id ?? null,
      farmCode: farm?.code ?? '',
      farmName: farm?.name ?? '',
      fromWarehouseId: autoSelectedWarehouse?.id ?? null,
      fromWarehouseCode: autoSelectedWarehouse?.whse_code ?? '',
      fromWarehouseName: autoSelectedWarehouse?.whse_name ?? '',
      lines: current.lines.map(line => clearWarehouseSensitiveLineData(line, autoSelectedWarehouse)),
    } : current)

    updatedLines
      .filter(canSearchLineInventory)
      .forEach(line => {
        refreshLineOnHand(line).catch(console.error)
      })
  }

  const selectHeaderWarehouse = (value: string) => {
    const warehouse = farmWarehouses.find(candidate => candidate.whse_code === value) ?? null
    const updatedLines = issue?.lines.map(line => clearWarehouseSensitiveLineData(line, warehouse)) ?? []

    setIssue(current => {
      if (!current) return current

      return {
        ...current,
        fromWarehouseId: warehouse?.id ?? null,
        fromWarehouseCode: warehouse?.whse_code ?? '',
        fromWarehouseName: warehouse?.whse_name ?? '',
        lines: current.lines.map(line => clearWarehouseSensitiveLineData(line, warehouse)),
      }
    })

    updatedLines
      .filter(canSearchLineInventory)
      .forEach(line => {
        refreshLineOnHand(line).catch(console.error)
      })
  }

  const selectLineWarehouse = async (line: GoodsIssueLine, value: string) => {
    const warehouse = farmWarehouses.find(candidate => candidate.whse_code === value) ?? null
    const updatedLine = clearWarehouseSensitiveLineData(line, warehouse)

    updateLine(line.id, updatedLine)

    if (canSearchLineInventory(updatedLine)) {
      await refreshLineOnHand(updatedLine)
    }
  }

  const selectItem = async (line: GoodsIssueLine, value: string) => {
    const item = items.find(candidate => candidate.item_code === value)
    const baseUom = item?.inventory_uom || item?.unit_measure || ''
    const altUom = getDefaultAltUom(baseUom)
    const updatedLine = {
      ...line,
      itemId: item?.id ?? null,
      itemCode: item?.item_code ?? '',
      description: item?.item_name || item?.description || '',
      batchRuleId: null,
      batchNumber: '',
      manufacturingDate: '',
      expiryDate: '',
      altQty: line.altQty || 1,
      altUom,
      baseQty: calculateBaseQty(line.altQty || 1, altUom, baseUom),
      baseUom,
      fromWarehouseId: usesLineWarehouse ? line.fromWarehouseId : issue?.fromWarehouseId ?? line.fromWarehouseId,
      fromWarehouseCode: usesLineWarehouse ? line.fromWarehouseCode : issue?.fromWarehouseCode ?? line.fromWarehouseCode,
      fromWarehouseName: usesLineWarehouse ? line.fromWarehouseName : issue?.fromWarehouseName ?? line.fromWarehouseName,
      onHandQty: 0,
    }

    const batchRule = item ? getBatchRuleForLine(updatedLine) : null
    updateLine(line.id, {
      ...updatedLine,
      batchRuleId: batchRule?.id ?? null,
    })

    const lineForRefresh = {
      ...updatedLine,
      batchRuleId: batchRule?.id ?? null,
    }

    if (!lineHasPlacementBatchOptions(lineForRefresh)) {
      await refreshLineOnHand(lineForRefresh)
    }
  }

  const getRawBatchOptionsForLine = (line: GoodsIssueLine) => {
    const placementBatches = linePlacementBatches[String(line.id)] ?? []
    if (usesLineWarehouse && placementBatches.length > 0) {
      const selectedItemCode = line.itemCode.trim().toUpperCase()
      const matchingBatches = selectedItemCode
        ? placementBatches.filter(batch => batch.itemCode.trim().toUpperCase() === selectedItemCode)
        : placementBatches
      return matchingBatches.filter(batch => batch.onHandQty > 0 || batch.batchNumber === line.batchNumber)
    }

    return batchOptions[batchOptionKey(line)] ?? []
  }

  const getAllocatedBaseQtyForBatch = (line: GoodsIssueLine) => {
    if (!issue || !line.itemCode || !line.fromWarehouseCode || !line.batchNumber) return 0

    const key = allocatedBatchKey(line)

    return issue.lines.reduce((total, candidate) => {
      if (candidate.id === line.id || allocatedBatchKey(candidate) !== key) return total
      return total + Number(candidate.baseQty || 0)
    }, 0)
  }

  const getAvailableOnHandForLine = (line: GoodsIssueLine) => {
    if (!line.batchNumber) return line.onHandQty

    const rawBatch = getRawBatchOptionsForLine(line)
      .find(option => option.batchNumber.trim().toUpperCase() === line.batchNumber.trim().toUpperCase())
    const originalOnHandQty = rawBatch?.onHandQty ?? line.onHandQty

    return Math.max(0, originalOnHandQty - getAllocatedBaseQtyForBatch(line))
  }

  const getTotalBatchOnHandForLine = (line: GoodsIssueLine) =>
    getRawBatchOptionsForLine(line).reduce((total, batch) => total + Number(batch.onHandQty || 0), 0)

  const getBatchOptionsForLine = (line: GoodsIssueLine) =>
    getRawBatchOptionsForLine(line)
      .map(batch => {
        const optionLine = {
          ...line,
          itemCode: batch.itemCode || line.itemCode,
          fromWarehouseCode: batch.warehouseCode || line.fromWarehouseCode,
          batchNumber: batch.batchNumber,
        }
        const remainingOnHandQty = Math.max(0, batch.onHandQty - getAllocatedBaseQtyForBatch(optionLine))

        return {
          ...batch,
          onHandQty: remainingOnHandQty,
        }
      })
      .filter(batch => batch.onHandQty > 0 || batch.batchNumber === line.batchNumber)

  const lineHasPlacementBatchOptions = (line: GoodsIssueLine) =>
    usesLineWarehouse && (linePlacementBatches[String(line.id)]?.length ?? 0) > 0

  const getItemsForLine = (line: GoodsIssueLine) => {
    if (!usesLineWarehouse) return items

    const placementItemCodes = new Set(
      (linePlacementBatches[String(line.id)] ?? [])
        .map(batch => batch.itemCode.trim().toUpperCase())
        .filter(Boolean),
    )

    return items.filter(item => placementItemCodes.has(String(item.item_code ?? '').trim().toUpperCase()))
  }

  const canOpenBatchSelector = (line: Pick<GoodsIssueLine, 'id' | 'itemCode' | 'fromWarehouseCode'>) =>
    lineHasPlacementBatchOptions(line as GoodsIssueLine) || canSearchLineInventory(line)

  const selectBatch = async (line: GoodsIssueLine, batchNumber: string, requestedAllocationQty?: number) => {
    if (issue?.status !== 'Draft') return

    const options = getBatchOptionsForLine(line)
    const batch = options.find(option => option.batchNumber === batchNumber)
    const batchItem = batch?.itemCode
      ? items.find(item => item.item_code === batch.itemCode) ?? null
      : null
    const batchItemName = batch && 'itemName' in batch ? String(batch.itemName ?? '') : ''
    const selectedItem = batchItem ?? getSelectedItem(line)
    const baseUom = selectedItem?.inventory_uom || selectedItem?.unit_measure || line.baseUom || ''
    const availableAltUoms = getGroupUoms(baseUom)
    const lineAltUomIsAvailable = availableAltUoms.some(option => option.uomCode === line.altUom)
    const altUom = lineAltUomIsAvailable ? line.altUom : getDefaultAltUom(baseUom)
    const allocationGroup = issue.lines.filter(candidate =>
      candidate.fromWarehouseCode === line.fromWarehouseCode && candidate.itemCode === line.itemCode,
    )
    const requiredAltQty = line.requestedAltQty ?? allocationGroup.reduce(
      (total, candidate) => total + Number(candidate.altQty || 0),
      0,
    )
    const alreadyAllocatedAltQty = allocationGroup
      .filter(candidate => candidate.batchNumber)
      .reduce((total, candidate) => total + Number(candidate.altQty || 0), 0)
    const remainingAltQty = Math.max(requiredAltQty - alreadyAllocatedAltQty, 0)
    const baseQtyPerAltQty = calculateBaseQty(1, altUom, baseUom)
    const availableAltQty = baseQtyPerAltQty > 0 ? Number(batch?.onHandQty || 0) / baseQtyPerAltQty : 0
    const defaultAllocationQty = line.batchNumber ? remainingAltQty : requiredAltQty
    const altQty = Math.min(requestedAllocationQty ?? defaultAllocationQty, remainingAltQty || requiredAltQty, availableAltQty)
    if (altQty <= 0) {
      toast(remainingAltQty <= 0 ? `${lineQuantityLabel} is already fully allocated.` : 'This batch has no available quantity.')
      return
    }
    const updatedLine = {
      ...line,
      itemId: selectedItem?.id ?? line.itemId,
      itemCode: selectedItem?.item_code ?? batch?.itemCode ?? line.itemCode,
      description: selectedItem?.item_name || selectedItem?.description || batchItemName || line.description,
      batchRuleId: null,
      batchNumber: batch?.batchNumber ?? '',
      manufacturingDate: batch?.manufacturingDate ?? '',
      expiryDate: batch?.expiryDate ?? '',
      altQty,
      altUom,
      baseQty: calculateBaseQty(altQty, altUom, baseUom),
      baseUom,
      onHandQty: batch?.onHandQty ?? 0,
    }
    const batchRule = selectedItem ? getBatchRuleForLine(updatedLine) : null

    const duplicateBatchLine = usesLineWarehouse && issue.lines.some(candidate =>
      candidate.id !== line.id &&
      candidate.fromWarehouseCode === updatedLine.fromWarehouseCode &&
      candidate.itemCode === updatedLine.itemCode &&
      candidate.batchNumber === updatedLine.batchNumber,
    )
    if (duplicateBatchLine) {
      toast(`Batch ${updatedLine.batchNumber} is already selected for this ${warehouseLabel.toLowerCase()}.`)
      return
    }

    if (usesLineWarehouse && line.batchNumber && line.batchNumber !== updatedLine.batchNumber) {
      setIssue(current => current ? {
        ...current,
        lines: current.lines.flatMap(candidate => candidate.id === line.id
          ? [
              candidate,
              {
                ...updatedLine,
                id: crypto.randomUUID(),
                batchRuleId: batchRule?.id ?? null,
              },
            ]
          : [candidate]),
      } : current)
      return
    }

    updateLine(line.id, {
      ...updatedLine,
      batchRuleId: batchRule?.id ?? null,
    })
    if (!usesLineWarehouse) setActiveBatchLineId(null)
  }

  const autoSelectDeliveryBatches = (line: GoodsIssueLine) => {
    if (!issue || issue.status !== 'Draft') return

    const groupLines = issue.lines.filter(candidate =>
      candidate.fromWarehouseCode === line.fromWarehouseCode &&
      candidate.itemCode === line.itemCode,
    )
    const requestedAltQty = line.requestedAltQty ?? groupLines.reduce(
      (total, candidate) => total + Number(candidate.altQty || 0),
      0,
    )
    if (requestedAltQty <= 0) {
      toast(`Enter ${lineQuantityLabel} before using Auto Select.`)
      return
    }

    const rawOptions = [...getRawBatchOptionsForLine(line)].sort((left, right) => {
      const leftDate = left.manufacturingDate || left.expiryDate || '9999-12-31'
      const rightDate = right.manufacturingDate || right.expiryDate || '9999-12-31'
      return leftDate.localeCompare(rightDate) || left.batchNumber.localeCompare(right.batchNumber)
    })
    let remainingAltQty = requestedAltQty
    const allocations: GoodsIssueLine[] = []

    rawOptions.forEach(batch => {
      if (remainingAltQty <= 0) return

      const selectedItem = batch.itemCode
        ? items.find(item => item.item_code === batch.itemCode) ?? getSelectedItem(line)
        : getSelectedItem(line)
      const baseUom = selectedItem?.inventory_uom || selectedItem?.unit_measure || line.baseUom || ''
      const availableAltUoms = getGroupUoms(baseUom)
      const altUom = availableAltUoms.some(option => option.uomCode === line.altUom)
        ? line.altUom
        : getDefaultAltUom(baseUom)
      const baseQtyPerAltQty = calculateBaseQty(1, altUom, baseUom)
      const availableAltQty = baseQtyPerAltQty > 0 ? batch.onHandQty / baseQtyPerAltQty : 0
      const altQty = Math.min(remainingAltQty, availableAltQty)
      if (altQty <= 0) return

      const allocation: GoodsIssueLine = {
        ...line,
        id: allocations.length === 0 ? line.id : crypto.randomUUID(),
        itemId: selectedItem?.id ?? line.itemId,
        itemCode: selectedItem?.item_code ?? batch.itemCode ?? line.itemCode,
        description: selectedItem?.item_name || selectedItem?.description || line.description,
        batchNumber: batch.batchNumber,
        manufacturingDate: batch.manufacturingDate,
        expiryDate: batch.expiryDate,
        altQty,
        altUom,
        baseQty: calculateBaseQty(altQty, altUom, baseUom),
        baseUom,
        onHandQty: batch.onHandQty,
        requestedAltQty,
      }
      const batchRule = selectedItem ? getBatchRuleForLine(allocation) : null
      allocations.push({ ...allocation, batchRuleId: batchRule?.id ?? null })
      remainingAltQty -= altQty
    })

    if (allocations.length === 0) {
      toast(`No available batches can fulfill ${lineQuantityLabel}.`)
      return
    }
    if (remainingAltQty > 0) {
      toast(`Auto Select could not allocate the remaining ${formatQuantity(remainingAltQty)} ${line.altUom || ''}.`.trim())
      return
    }

    const groupIds = new Set(groupLines.map(candidate => candidate.id))
    setIssue(current => {
      if (!current) return current
      const firstGroupIndex = current.lines.findIndex(candidate => groupIds.has(candidate.id))
      const remainingLines = current.lines.filter(candidate => !groupIds.has(candidate.id))
      remainingLines.splice(Math.max(firstGroupIndex, 0), 0, ...allocations)
      return { ...current, lines: remainingLines }
    })
  }

  const openBatchSelector = (line: GoodsIssueLine) => {
    if (!canOpenBatchSelector(line)) return

    setActiveBatchLineId(line.id)
    if (issue?.status !== 'Posted' && canSearchLineInventory(line) && !lineHasPlacementBatchOptions(line)) {
      refreshLineOnHand(line).catch(console.error)
    }
  }

  const handleTransferQuantityChange = (line: GoodsIssueLine, requestedAltQty: number) => {
    if (!deliveryBatchAutoSelection || issue?.status !== 'Draft') return
    autoSelectDeliveryBatches({ ...line, requestedAltQty })
  }

  useEffect(() => {
    if (!issue || issue.status !== 'Draft' || !isCleanup) return

    const processedGroups = new Set<string>()
    issue.lines.forEach(line => {
      if (!line.fromWarehouseCode || !line.itemCode || line.batchNumber) return
      const groupKey = `${line.fromWarehouseCode.trim().toUpperCase()}::${line.itemCode.trim().toUpperCase()}`
      if (processedGroups.has(groupKey)) return
      processedGroups.add(groupKey)

      const options = linePlacementBatches[String(line.id)]
        ?.filter(option => option.itemCode.trim().toUpperCase() === line.itemCode.trim().toUpperCase())
        .filter(option => option.onHandQty > 0) ?? []
      if (options.length === 0 || loadingLinePlacementBatches[String(line.id)]) return

      const selectedItem = getSelectedItem(line)
      const baseUom = selectedItem?.inventory_uom || selectedItem?.unit_measure || line.baseUom
      const altUom = line.altUom || getDefaultAltUom(baseUom)
      const baseQtyPerAltQty = calculateBaseQty(1, altUom, baseUom)
      if (baseQtyPerAltQty <= 0) return

      const fullBaseQty = options.reduce((total, option) => total + Number(option.onHandQty || 0), 0)
      const requestedAltQty = fullBaseQty / baseQtyPerAltQty
      if (requestedAltQty <= 0) return

      const signature = options.map(option => `${option.itemCode}:${option.batchNumber}:${option.onHandQty}`).join('|')
      if (handledAutoBatchSelectionRef.current[String(line.id)] === `CLEANUP:${signature}`) return
      handledAutoBatchSelectionRef.current[String(line.id)] = `CLEANUP:${signature}`
      batchSelectionActionsRef.current.autoSelectDeliveryBatches?.({ ...line, requestedAltQty })
    })
  }, [calculateBaseQty, getDefaultAltUom, getSelectedItem, isCleanup, issue, linePlacementBatches, loadingLinePlacementBatches])

  itemSelectionActionsRef.current = {
    getItemsForLine,
    selectItem,
  }

  useEffect(() => {
    if (!issue || issue.status !== 'Draft' || !usesLineWarehouse) return

    issue.lines.forEach(line => {
      if (!line.fromWarehouseCode || line.itemCode || loadingLinePlacementBatches[String(line.id)]) return
      const lineItems = itemSelectionActionsRef.current.getItemsForLine?.(line) ?? []
      if (lineItems.length !== 1 || !lineItems[0]?.item_code) return
      itemSelectionActionsRef.current.selectItem?.(line, lineItems[0].item_code).catch(console.error)
    })
  }, [issue, items, linePlacementBatches, loadingLinePlacementBatches, usesLineWarehouse])

  batchSelectionActionsRef.current = {
    getBatchOptionsForLine,
    selectBatch,
    autoSelectDeliveryBatches,
  }

  useEffect(() => {
    if (!issue || issue.status !== 'Draft' || !deliveryBatchAutoSelection || !usesLineWarehouse) return

    issue.lines.forEach(line => {
      if (!line.fromWarehouseCode || line.batchNumber) return

      const options = batchSelectionActionsRef.current.getBatchOptionsForLine?.(line) ?? []
      if (options.length === 0 || loadingLinePlacementBatches[String(line.id)]) return

      const signature = [
        issue.farmId ?? '',
        line.fromWarehouseCode,
        line.itemCode,
        line.requestedAltQty ?? '',
        options.map(option => `${option.itemCode}:${option.batchNumber}`).join('|'),
      ].join('::')

      if (handledAutoBatchSelectionRef.current[String(line.id)] === signature) return
      handledAutoBatchSelectionRef.current[String(line.id)] = signature

      if (options.length === 1) {
        batchSelectionActionsRef.current.selectBatch?.(line, options[0].batchNumber).catch(console.error)
        return
      }

      if (Number(line.requestedAltQty ?? 0) > 0) {
        batchSelectionActionsRef.current.autoSelectDeliveryBatches?.(line)
      }
    })
  }, [
    activeBatchLineId,
    deliveryBatchAutoSelection,
    issue,
    linePlacementBatches,
    loadingLinePlacementBatches,
    usesLineWarehouse,
  ])

  const completedLines = issue?.lines
    .filter(lineHasEnteredItem)
    .map(getLineWithRecalculatedQuantity) ?? []
  const totalQuantity = completedLines.reduce(
    (total, line) => total + Number(line.baseQty || 0),
    0,
  )
  const cleanupVarianceTotal = isCleanup
    ? Array.from(completedLines.reduce((groups, line) => {
        const key = `${line.fromWarehouseCode.trim().toUpperCase()}::${line.itemCode.trim().toUpperCase()}`
        groups.set(key, [...(groups.get(key) ?? []), line])
        return groups
      }, new Map<string, GoodsIssueLine[]>()).values()).reduce((total, group) => {
        const firstLine = group[0]
        if (!firstLine) return total
        if (issue?.status === 'Posted') return total + Number(firstLine.varianceQty ?? 0)
        const batchTotal = getTotalBatchOnHandForLine(firstLine)
        const cleanUpTotal = group.reduce((sum, line) => sum + Number(line.baseQty || 0), 0)
        return total + Math.max(batchTotal - cleanUpTotal, 0)
      }, 0)
    : 0
  const canEditDraft = issue?.status === 'Draft'
  const canPostDocument = allowImmediatePost || isPostMode || Boolean(issue?.id)

  const handleSave = async (targetStatus: GoodsIssueStatus) => {
    if (!issue) return

    const posting = targetStatus === 'Posted'
    if (!canEditDraft) {
      toast('Only draft documents can be edited or posted.')
      return
    }
    if (!issue.farmId) {
      toast('Please select a farm.')
      return
    }
    if (!usesLineWarehouse && (!issue.fromWarehouseId || !issue.fromWarehouseCode)) {
      toast(`Please select a ${warehouseLabel.toLowerCase()}.`)
      return
    }
    const linesToSave = isCleanup
      ? completedLines.map(line => {
          const group = completedLines.filter(candidate =>
            candidate.fromWarehouseCode === line.fromWarehouseCode && candidate.itemCode === line.itemCode,
          )
          const batchTotalQty = getTotalBatchOnHandForLine(line)
          const cleanedQty = group.reduce((total, candidate) => total + Number(candidate.baseQty || 0), 0)
          return {
            ...line,
            batchTotalQty,
            varianceQty: Math.max(batchTotalQty - cleanedQty, 0),
          }
        })
      : completedLines

    if (linesToSave.length === 0) {
      toast('Please select at least one item.')
      return
    }
    if (usesLineWarehouse) {
      const invalidLine = linesToSave.find(line =>
        !line.itemCode ||
        !line.fromWarehouseCode ||
        lineHasInvalidQuantity(line),
      )

      if (invalidLine) {
        if (!invalidLine.fromWarehouseCode) {
          toast(`Please select a ${warehouseLabel.toLowerCase()} for each line.`)
          return
        }

        toast(`Please complete the line for ${invalidLine.itemCode || warehouseLabel.toLowerCase()}.`)
        return
      }
    }
    if (posting && isBroilerCycleIssue) {
      try {
        const ageShortage = await (triggeredBy === 'BR-CU' ? getBrCleanupAgeShortage : getBrDeliveryAgeShortage)({
          farmId: Number(issue.farmId),
          lines: linesToSave,
        })
        if (ageShortage) {
          const currentAgeText = ageShortage.currentAge === null
            ? 'has no saved flock card'
            : `is only ${ageShortage.currentAge} day${ageShortage.currentAge === 1 ? '' : 's'} old`
          toast(
            `${ageShortage.buildingName} ${currentAgeText}. DOC must be at least ${ageShortage.targetAge} days old for ${isCleanup ? 'clean up' : 'delivery'}.`,
          )
          return
        }
      } catch (error) {
        console.error(error)
        toast('Error: ' + (error instanceof Error ? error.message : `Unable to validate the DOC ${isCleanup ? 'clean-up' : 'delivery'} age.`))
        return
      }
    }
    if (linesToSave.some(lineHasInvalidQuantity)) {
      toast('Each item needs a UoM group, Alt UoM, and valid quantity.')
      return
    }
    const overOnHandLine = linesToSave.find(line => line.batchNumber && line.baseQty > getAvailableOnHandForLine(line))
    if (overOnHandLine) {
      toast(`${lineQuantityLabel} for ${overOnHandLine.itemCode} must be less than or equal to the selected batch remaining on-hand quantity.`)
      return
    }
    const missingWarehouseLine = usesLineWarehouse
      ? linesToSave.find(line => !line.fromWarehouseId || !line.fromWarehouseCode)
      : null
    if (missingWarehouseLine) {
      toast(`Please select a ${warehouseLabel.toLowerCase()} for ${missingWarehouseLine.itemCode || 'each line'}.`)
      return
    }

    const missingBatchLine = linesToSave.find(line =>
      (itemNeedsBatch(line) || lineHasPlacementBatchOptions(line) || isBroilerCycleIssue) &&
      !line.batchNumber.trim(),
    )
    if (missingBatchLine) {
      toast(`Please select an on-hand batch for ${missingBatchLine.itemCode}.`)
      return
    }

    if (usesLineWarehouse) {
      const allocationGroups = new Map<string, GoodsIssueLine[]>()
      linesToSave
        .filter(line => itemNeedsBatch(line) || lineHasPlacementBatchOptions(line) || isBroilerCycleIssue)
        .forEach(line => {
          const key = `${line.fromWarehouseCode.trim().toUpperCase()}::${line.itemCode.trim().toUpperCase()}`
          allocationGroups.set(key, [...(allocationGroups.get(key) ?? []), line])
        })
      const incompleteAllocation = Array.from(allocationGroups.values()).find(group => {
        const requestedQty = group.find(line => line.requestedAltQty !== undefined)?.requestedAltQty
          ?? group.reduce((total, line) => total + Number(line.altQty || 0), 0)
        const selectedQty = group
          .filter(line => line.batchNumber)
          .reduce((total, line) => total + Number(line.altQty || 0), 0)
        return Math.abs(requestedQty - selectedQty) > 0.000001
      })
      if (incompleteAllocation) {
        const requestedQty = incompleteAllocation.find(line => line.requestedAltQty !== undefined)?.requestedAltQty
          ?? incompleteAllocation.reduce((total, line) => total + Number(line.altQty || 0), 0)
        const selectedQty = incompleteAllocation.reduce((total, line) => total + Number(line.altQty || 0), 0)
        toast(`Batch selection for ${incompleteAllocation[0].itemCode} must equal ${lineQuantityLabel} (${formatQuantity(requestedQty)} required, ${formatQuantity(selectedQty)} selected).`)
        return
      }
    }

    setSaving(true)
    try {
      if (linesToSave.length > 0) {
        const [shortage] = await getGoodsIssueOnHandShortages(linesToSave)
        if (shortage) {
          toast(formatShortageMessage(shortage))
          return
        }
      }

      const firstLine = linesToSave[0]
      const issueToSave = usesLineWarehouse
        ? {
            ...issue,
            fromWarehouseId: firstLine?.fromWarehouseId ?? null,
            fromWarehouseCode: firstLine?.fromWarehouseCode ?? '',
            fromWarehouseName: firstLine?.fromWarehouseName ?? '',
          }
        : issue

      const savedIssue = await saveGoodsIssue({
        ...issueToSave,
        triggeredBy,
        status: targetStatus,
        lines: linesToSave,
      })

      toast(posting ? `${listLabel} posted successfully.` : `${listLabel} draft saved.`)

      if (posting) {
        router.push(basePath)
        return
      }
      if (!isPostMode && savedIssue?.id) {
        router.push(`${basePath}/post?id=${savedIssue.id}`)
        return
      }
      if (savedIssue) setIssue(savedIssue)
    } catch (error) {
      console.error(error)
      toast('Error: ' + (error instanceof Error ? error.message : `Unable to save ${listLabel.toLowerCase()}`))
    } finally {
      setSaving(false)
    }
  }

  if (!issue) return <GoodsIssueLoadingShell />

  const activeBatchLine = issue.lines.find(line => line.id === activeBatchLineId) ?? null
  const activeBatchAllocationLines = activeBatchLine
    ? issue.lines.filter(line =>
        line.fromWarehouseCode === activeBatchLine.fromWarehouseCode &&
        line.itemCode === activeBatchLine.itemCode &&
        Boolean(line.batchNumber),
      )
    : []
  const activeBatchKey = activeBatchLine ? batchOptionKey(activeBatchLine) : ''
  const activeBatchOptions = activeBatchLine ? getBatchOptionsForLine(activeBatchLine) : []
  const activeRequiredAltQty = activeBatchLine
    ? activeBatchLine.requestedAltQty ?? (activeBatchAllocationLines.reduce((total, line) => total + Number(line.altQty || 0), 0) || activeBatchLine.altQty)
    : 0
  const activeAllocatedAltQty = activeBatchAllocationLines.reduce((total, line) => total + Number(line.altQty || 0), 0)
  const activeRemainingAltQty = Math.max(activeRequiredAltQty - activeAllocatedAltQty, 0)
  const activeTotalBatchOnHand = activeBatchLine ? getTotalBatchOnHandForLine(activeBatchLine) : 0
  const activeAvailableBatchOptions = activeBatchLine
    ? getRawBatchOptionsForLine(activeBatchLine).map(batch => {
        const selectedBaseQty = activeBatchAllocationLines
          .filter(allocation => allocation.batchNumber === batch.batchNumber)
          .reduce((total, allocation) => total + Number(allocation.baseQty || 0), 0)
        return { ...batch, onHandQty: Math.max(batch.onHandQty - selectedBaseQty, 0) }
      })
    : []
  const activeBatchLoading = activeBatchKey ? Boolean(loadingBatchOptions[activeBatchKey]) : false
  const activeBatchHasSearched = activeBatchKey
    ? Object.prototype.hasOwnProperty.call(batchOptions, activeBatchKey)
    : false
  const activeDocumentIsPosted = issue.status === 'Posted'

  const canSave = !saving && canEditDraft && (issue.id ? !cannotEdit : !cannotInsert)
  const renderFlockCardInformation = (
    info: GoodsIssueFlockCardInfo | null,
    loading: boolean,
    hasBuilding: boolean,
    compact = false,
  ) => (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
      {loading ? (
        <span className="text-stone-500">Loading flock card information...</span>
      ) : info ? (
        <div className={`grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          <div>
            <div className="text-xs font-medium text-stone-500">Flock Card</div>
            <div className="font-semibold text-stone-950">{info.cardNo || '-'}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-stone-500">Flock Code</div>
            <div className="font-semibold text-stone-950">{info.flockCode || '-'}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-stone-500">Breed / Age</div>
            <div className="font-semibold text-stone-950">
              {info.breed || '-'} / {info.age}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-stone-500">Start Date</div>
            <div className="font-semibold text-stone-950">{formatDateValue(info.startDate)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-stone-500">Animal Qty</div>
            <div className="font-semibold text-stone-950">{formatQuantity(info.animalQty)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-stone-500">Broiler Type</div>
            <div className="font-semibold text-stone-950">{info.broilerType || '-'}</div>
          </div>
        </div>
      ) : (
        <span className="text-stone-500">
          {hasBuilding ? 'No saved flock card found for this farm and building.' : 'Select a building to load flock card information.'}
        </span>
      )}
    </div>
  )
  const cleanupSummaryTotals = cleanupSummaries.reduce(
    (totals, row) => ({
      placement: totals.placement + row.totalPlacement,
      mortality: totals.mortality + row.totalMortality,
      delivered: totals.delivered + row.totalDelivered,
      cleaned: totals.cleaned + row.totalCleaned,
      variance: totals.variance + row.totalVariance,
    }),
    { placement: 0, mortality: 0, delivered: 0, cleaned: 0, variance: 0 },
  )
  const flockCardInformationContent = showFlockCardInformation
    ? renderFlockCardInformation(flockCardInfo, loadingFlockCardInfo, Boolean(issue.fromWarehouseCode))
    : null
  const headerComponentList: GoodsIssueHeaderField[] = [
    {
      key: 'gi-no',
      label: documentNumberLabel ?? `${documentPrefix} No.`,
      content:
        (
          <div className='flex items-center gap-1'>
            <Input value={issue.giNo} readOnly className="bg-stone-50" />
            <span className={getInventoryStatusBadgeClass(issue.status)}>
              {issue.status}
            </span>
          </div>

        )
    },
    {
      key: 'issue-date',
      label: issueDateLabel,
      content: (
        <label className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-2.5 size-4" />
          <Input
            type="date"
            value={issue.issueDate}
            onChange={event => setIssue(current => current ? { ...current, issueDate: event.target.value } : current)}
            className="pl-9"
          />
        </label>
      ),
    },
    {
      key: 'farm',
      label: 'Farm',
      content: (
        <SearchableCombobox
          items={farmOptions}
          value={issue.farmId == null ? '' : String(issue.farmId)}
          onValueChange={selectFarm}
          showCode={false}
          placeholder={loadingReferences ? 'Loading farms...' : 'Select farm...'}
          className="w-full"
        />
      ),
    },

    {
      key: 'status',
      label: '',
      content: (
        <div>
        
        </div>
      ),
    },
    ...(!usesLineWarehouse
      ? [{
          key: 'warehouse',
          label: warehouseLabel,
          content: (
            <SearchableDropdown
              list={farmWarehouses}
              codeLabel="whse_code"
              nameLabel="whse_name"
              value={issue.fromWarehouseCode}
              placeholder={issue.farmId ? `Select ${warehouseLabel.toLowerCase()}...` : 'Select farm first'}
              width={360}
              onChange={(value) => selectHeaderWarehouse(value)}
            />
          ),
        }]
      : []),
    ...(!usesLineWarehouse && showFlockCardInformation
      ? [{
          key: 'flock-card-information',
          label: 'Flock card information',
          className: 'sm:col-span-2 sm:grid-cols-[112px_minmax(0,1fr)]',
          content: flockCardInformationContent,
        }]
      : []),
    ...(triggeredBy === 'BR-DR'
      ? [
          {
            key: 'hauler-name',
            label: 'Hauler Name',
            content: (
              <Input
                type="text"
                value={issue.haulerName}
                onChange={event => setIssue(current => current ? { ...current, haulerName: event.target.value } : current)}
                placeholder="Enter hauler name"
              />
            ),
          },
          {
            key: 'plate-number',
            label: 'Plate Number',
            content: (
              <Input
                type="text"
                value={issue.plateNumber ?? ''}
                onChange={event => setIssue(current => current ? { ...current, plateNumber: event.target.value || null } : current)}
                placeholder="Enter plate number"
              />
            ),
          },
          {
            key: 'destination',
            label: 'Destination',
            className: 'sm:grid-cols-[112px_minmax(0,1fr)] lg:col-start-1',
            content: (
              <div className="flex w-full items-center gap-2">
                <Select
                  value={issue.destination}
                  onValueChange={value => setIssue(current => current ? { ...current, destination: value } : current)}
                >
                  <SelectTrigger className="w-fit  shrink-0">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dressing Plant">Dressing Plant</SelectItem>
                    <SelectItem value="Live Sales">Live Sales</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  value={issue.liveSalesCustomerName}
                  onChange={event => setIssue(current => current ? { ...current, liveSalesCustomerName: event.target.value } : current)}
                  placeholder="Live Sales Customer Name"
                  className="min-w-0 max-w-sm"
                />
              </div>
            ),
          },
          {
            key: 'truck-seal',
            label: 'Truck Seal',
            className: 'sm:grid-cols-[112px_minmax(0,300px)] lg:col-start-2',
            content: (
              <Input
                type="number"
                value={issue.truckSeal ?? ''}
                onChange={event => setIssue(current => current ? { ...current, truckSeal: event.target.value === '' ? null : Number(event.target.value) } : current)}
                placeholder="Enter truck seal"
              />
            ),
          },
        ]
      : []),
    ...(!showRemarksInActionRow
      ? [{
          key: 'remarks',
          label: 'Remarks',
          className: 'sm:col-span-2 sm:grid-cols-[112px_minmax(0,1fr)]',
          content: (
            <Input
              value={issue.remarks}
              onChange={event => setIssue(current => current ? { ...current, remarks: event.target.value } : current)}
              placeholder="Optional remarks"
            />
          ),
        }]
      : []),
  ]

  return (
    <main className="min-h-[calc(100vh-4rem)]  text-stone-950">
      <div className="flex items-center justify-between gap-3 px-4 mt-4">
        <Breadcrumb
          SecondPreviewPageName={parentLabel}
          SecondPreviewPageLink={parentLink}
          FirstPreviewsPageName={listLabel}
          FirstPreviewsPageLink={basePath}
          CurrentPageName={formLabel ?? (isPostMode ? `Post ${documentPrefix}` : `New ${documentPrefix}`)}
        />
        <Button type="button" variant="outline" onClick={() => router.push(basePath)}>
          <List className="size-4" />
          {listLabel} List
        </Button>
      </div>

      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <GoodsIssueHeaderSection fields={headerComponentList} />

        <div className="border-t p-5">
          <Tabs defaultValue="lines" className="space-y-3">
            {isCleanup && (
              <TabsList>
                <TabsTrigger value="lines">Clean up Lines</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="lines" className="mt-0">
          <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-3 py-3">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-base font-semibold">Issue Lines</h2>
                {usesLineWarehouse && showFlockCardInformation && (
                  <span className="truncate text-xs text-muted-foreground">
                    {noAvailableDeliveryBuildings
                      ? `No buildings meet the ${isCleanup ? 'Clean-up' : 'Delivery'} age and available-batch requirements.`
                      : isCleanup
                        ? 'Eligible buildings load their full placement-batch balance by default. Clean up Quantity can be reduced, and Variance shows the remaining difference.'
                        : 'Flock card information: eligible buildings load automatically, or select a building manually.'}
                  </span>
                )}
              </div>
            </div>

            {usesBroilerLineLayout ? (
              <DeliveryIssueLinesTable
                issue={issue}
                warehouseLabel={warehouseLabel}
                farmWarehouses={deliveryFarmWarehouses}
                loadingBatchOptions={loadingBatchOptions}
                batchOptions={batchOptions}
                lineFlockCardInfo={lineFlockCardInfo}
                loadingLinePlacementBatches={loadingLinePlacementBatches}
                activeDocumentIsPosted={activeDocumentIsPosted}
                lockCycleCloseout={isCleanup}
                showLineRemarks={showLineRemarks}
                quantityLabel={lineQuantityLabel}
                showQuantityAllocationWarnings={showLineQuantityAllocationWarnings}
                showOnHandQuantity={showLineOnHandQuantity}
                showVariance={showLineVariance}
                lockedQuantityEditable={lockedLineQuantityEditable}
                getItemsForLine={getItemsForLine}
                itemNeedsBatch={itemNeedsBatch}
                lineHasPlacementBatchOptions={lineHasPlacementBatchOptions}
                batchOptionKey={batchOptionKey}
                getBatchOptionsForLine={getBatchOptionsForLine}
                getTotalBatchOnHandForLine={getTotalBatchOnHandForLine}
                canOpenBatchSelector={canOpenBatchSelector}
                selectLineWarehouse={selectLineWarehouse}
                selectItem={selectItem}
                openBatchSelector={openBatchSelector}
                updateLine={updateLine}
                onTransferQuantityChange={handleTransferQuantityChange}
                setIssue={setIssue}
                newLine={newLine}
                calculateBaseQty={calculateBaseQty}
                getGroupUoms={getGroupUoms}
                getSelectedGroup={getSelectedGroup}
                numberValue={numberValue}
                formatQuantity={formatQuantity}
              />
            ) : (
            <div className="overflow-x-auto">
              <table className={`${usesLineWarehouse ? 'min-w-[1350px]' : 'min-w-[1090px]'} w-full table-fixed border-collapse text-xs [&_[data-slot=searchable-dropdown-trigger]]:h-7 [&_[data-slot=searchable-dropdown-trigger]]:rounded-none [&_[data-slot=searchable-dropdown-trigger]]:border-0 [&_[data-slot=searchable-dropdown-trigger]]:px-1.5 [&_[data-slot=searchable-dropdown-trigger]]:text-xs`}>
                <thead className="bg-muted text-left text-[11px] text-muted-foreground">
                  <tr>
                    <th className="w-9 border border-border px-1 py-1 text-center">#</th>
                    <th className="w-[240px] border border-border px-1.5 py-1">Item</th>
                    {usesLineWarehouse && (
                      <th className="w-[260px] border border-border px-1.5 py-1">{warehouseLabel}</th>
                    )}
                    <th className="w-[140px] border border-border px-1.5 py-1">UoM Group</th>
                    <th className="w-[90px] border border-border px-1.5 py-1">Qty</th>
                    <th className="w-[100px] border border-border px-1.5 py-1">Alt UoM</th>
                    <th className="w-[140px] border border-border px-1.5 py-1">Base Qty</th>
                    <th className="w-[190px] border border-border px-1.5 py-1">Batch</th>
                    <th className="w-[110px] border border-border px-1.5 py-1">{activeDocumentIsPosted ? 'Used Qty' : 'On Hand'}</th>
                    <th className="w-11 border border-border px-1 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {issue.lines.map((line, index) => {
                    const needsBatch = itemNeedsBatch(line)
                    const batchKey = batchOptionKey(line)
                    const batches = batchOptions[batchKey] ?? []
                    const isLoadingBatches = Boolean(loadingBatchOptions[batchKey])
                    const hasSearchedBatches = Object.prototype.hasOwnProperty.call(batchOptions, batchKey)
                    const canSearchBatches = canSearchLineInventory(line)
                    const isOver = canPostDocument && line.itemCode && line.onHandQty > 0 && line.baseQty > line.onHandQty

                    return (
                      <tr key={line.id} className="odd:bg-background even:bg-muted/40 hover:bg-accent/40">
                        <td className="border border-border bg-muted px-1 py-1 text-center align-middle text-muted-foreground">{index + 1}</td>
                        <td className="border border-border p-1 align-middle">
                          <SearchableDropdown
                            list={items}
                            codeLabel="item_code"
                            nameLabel="item_name"
                            value={line.itemCode}
                            placeholder="Select item..."
                            width={420}
                            onChange={(value) => selectItem(line, value)}
                          />
                        </td>
                        {usesLineWarehouse && (
                          <td className="border border-border p-1 align-top">
                            <div className="space-y-2">
                              <SearchableDropdown
                                list={farmWarehouses}
                                codeLabel="whse_code"
                                nameLabel="whse_name"
                                value={line.fromWarehouseCode}
                                placeholder={issue.farmId ? `Select ${warehouseLabel.toLowerCase()}...` : 'Select farm first'}
                                width={360}
                                onChange={(value) => {
                                  selectLineWarehouse(line, value).catch(console.error)
                                }}
                              />
                              {showFlockCardInformation && (() => {
                                const state = lineFlockCardInfo[String(line.id)]
                                return renderFlockCardInformation(
                                  state?.info ?? null,
                                  Boolean(state?.loading),
                                  Boolean(line.fromWarehouseCode),
                                  true,
                                )
                              })()}
                            </div>
                          </td>
                        )}
                        <td className="border border-border p-1 align-middle">
                          <select
                            value={line.baseUom}
                            disabled
                            className="h-7 w-full rounded-none border-0 bg-muted px-1.5 text-xs text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-100"
                          >
                            <option value="">Select item</option>
                            {uomGroups.map(group => (
                              <option key={group.id} value={group.code}>
                                {group.code} - {group.name} ({group.baseUomCode})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-border p-1 align-middle">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={line.altQty}
                            onChange={event => {
                              const altQty = numberValue(event.target.value)
                              updateLine(line.id, {
                                altQty,
                                baseQty: calculateBaseQty(altQty, line.altUom, line.baseUom),
                              })
                            }}
                            className="h-7 rounded-none border-0 bg-background px-1.5 text-xs shadow-none focus-visible:ring-2 focus-visible:ring-inset"
                          />
                        </td>
                        <td className="border border-border p-1 align-middle">
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
                            className="h-7 w-full rounded-none border-0 bg-background px-1.5 text-xs outline-none transition focus:ring-2 focus:ring-inset focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60"
                          >
                            <option value="">{line.baseUom ? 'Select Alt UoM' : 'Select item first'}</option>
                            {getGroupUoms(line.baseUom).map(conversion => (
                              <option key={`${conversion.groupId}-${conversion.uomCode}`} value={conversion.uomCode}>
                                {conversion.uomCode}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-border px-1.5 py-1 align-middle text-foreground">
                          {line.baseUom && line.altUom ? (
                            <div className="whitespace-nowrap">
                              <span className="font-medium tabular-nums">
                                {formatQuantity(line.baseQty)}
                              </span>{' '}
                              <span className="text-stone-600">
                                {getSelectedGroup(line.baseUom)?.baseUomCode}
                              </span>
                              <div className="text-[10px] leading-tight text-muted-foreground">
                                {formatQuantity(line.altQty)}{' '}
                                {line.altUom} x{' '}
                                {getSelectedConversion(line.baseUom, line.altUom)?.baseQty.toLocaleString(QUANTITY_LOCALE, QUANTITY_FORMAT_OPTIONS)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-stone-400">-</span>
                          )}
                        </td>
                        <td className="border border-border p-1 align-middle">
                          {needsBatch ? (
                            <div className="space-y-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                disabled={!canSearchBatches}
                                onClick={() => openBatchSelector(line)}
                                className={`h-7 w-full justify-start rounded-none border-0 px-1.5 text-left text-xs font-normal hover:bg-accent ${
                                  line.batchNumber
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                                    : 'bg-white text-stone-800'
                                }`}
                              >
                                {line.batchNumber ? (
                                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                                    <PackageCheck className="size-3.5 shrink-0" />
                                    <span className="truncate">{line.batchNumber}</span>
                                  </span>
                                ) : (
                                  <span className="truncate">
                                    {canSearchBatches ? 'Select on-hand batch' : `Select item and ${warehouseLabel.toLowerCase()} first`}
                                  </span>
                                )}
                                {isLoadingBatches && (
                                  <Loader2 className="ml-auto size-4 shrink-0 animate-spin text-stone-500" />
                                )}
                              </Button>

                              {isLoadingBatches && (
                                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                                  <Loader2 className="size-3.5 animate-spin" />
                                  <span>Searching on-hand batches for this item and {warehouseLabel.toLowerCase()}.</span>
                                </div>
                              )}

                              {!isLoadingBatches && hasSearchedBatches && canSearchBatches && batches.length === 0 && (
                                <div className="text-xs text-amber-700">
                                  No on-hand batches found for this item in {line.fromWarehouseCode}.
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex h-7 items-center px-1 text-muted-foreground">Not required</span>
                          )}
                        </td>
                        <td className="border border-border px-1.5 py-1 align-middle">
                          <div>
                            <div className="whitespace-nowrap">
                              <span className={`font-medium tabular-nums ${isOver ? 'text-red-600' : 'text-stone-800'}`}>
                                {formatQuantity(activeDocumentIsPosted ? line.baseQty : line.onHandQty)}
                              </span>{' '}
                              {line.baseUom && (
                                <span className={isOver ? 'text-red-600' : 'text-stone-600'}>
                                  {getSelectedGroup(line.baseUom)?.baseUomCode}
                                </span>
                              )}
                            </div>
                            {isOver && (
                              <div className="mt-1 text-xs font-medium text-red-600">
                                Exceeds on-hand
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="border border-border p-1 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => setIssue(current => current ? {
                              ...current,
                              lines: current.lines.filter(candidate => candidate.id !== line.id),
                            } : current)}
                            className="inline-flex size-7 items-center justify-center rounded-none text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
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
            </div>
            )}

            {!isCleanup && <div className="flex justify-end gap-2 border-t border-stone-200 bg-stone-50 px-3 py-3">
              <Input
                type="number"
                min="1"
                max={MAX_LINES_TO_ADD}
                value={lineCount}
                onChange={event => setLineCount(normalizeLineCount(event.target.value))}
                className="w-20 border-stone-300 bg-white"
                aria-label="Number of lines to add"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setIssue(current => current ? {
                  ...current,
                  lines: [...current.lines, ...Array.from({ length: lineCount }, newLine)],
                } : current)}
              >
                <Plus className="size-4" />
                Add Lines
              </Button>
            </div>}
          </section>
            </TabsContent>

            {isCleanup && (
              <TabsContent value="summary" className="mt-0">
                <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                  <div className="border-b border-stone-200 bg-white px-4 py-3">
                    <h2 className="text-base font-semibold">Cycle Summary</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Posted bird movements from placement through mortality, Harvest & Delivery, and Clean up.
                      Clean up and variance are shown separately from their posted inventory movements.
                    </p>
                  </div>

                  {loadingCleanupSummaries ? (
                    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading inventory summary...
                    </div>
                  ) : cleanupSummaryError ? (
                    <div className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                      {cleanupSummaryError}
                    </div>
                  ) : cleanupSummaries.length === 0 ? (
                    <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                      No Flock Card cycle summary is available for the selected buildings.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[1120px] w-full border-collapse text-sm">
                        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="border-r px-3 py-3">Building</th>
                            <th className="border-r px-3 py-3">Flock Card</th>
                            <th className="border-r px-3 py-3 text-right">Growing #</th>
                            <th className="border-r px-3 py-3 text-right">Age</th>
                            <th className="border-r px-3 py-3 text-right">Total Placement</th>
                            <th className="border-r px-3 py-3 text-right">Total Mortality</th>
                            <th className="border-r px-3 py-3 text-right">Total Delivered</th>
                            <th className="border-r px-3 py-3 text-right">Total (TO) Cleaned</th>
                            <th className="px-3 py-3 text-right">Total Variance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cleanupSummaries.map(row => (
                            <tr key={row.flockCardId} className="border-t odd:bg-white even:bg-stone-50/70">
                              <td className="border-r px-3 py-3 font-medium">{row.buildingName || row.buildingCode}</td>
                              <td className="border-r px-3 py-3">{row.flockCard || '-'}</td>
                              <td className="border-r px-3 py-3 text-right tabular-nums">{row.cycleCount || '-'}</td>
                              <td className="border-r px-3 py-3 text-right tabular-nums">{row.age}</td>
                              <td className="border-r px-3 py-3 text-right tabular-nums">{formatQuantity(row.totalPlacement)}</td>
                              <td className="border-r px-3 py-3 text-right tabular-nums">{formatQuantity(row.totalMortality)}</td>
                              <td className="border-r px-3 py-3 text-right tabular-nums">{formatQuantity(row.totalDelivered)}</td>
                              <td className="border-r px-3 py-3 text-right font-semibold tabular-nums">{formatQuantity(row.totalCleaned)}</td>
                              <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatQuantity(row.totalVariance)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 bg-stone-100 font-semibold">
                          <tr>
                            <td colSpan={4} className="border-r px-3 py-3 text-right uppercase">Total</td>
                            <td className="border-r px-3 py-3 text-right tabular-nums">{formatQuantity(cleanupSummaryTotals.placement)}</td>
                            <td className="border-r px-3 py-3 text-right tabular-nums">{formatQuantity(cleanupSummaryTotals.mortality)}</td>
                            <td className="border-r px-3 py-3 text-right tabular-nums">{formatQuantity(cleanupSummaryTotals.delivered)}</td>
                            <td className="border-r px-3 py-3 text-right tabular-nums">{formatQuantity(cleanupSummaryTotals.cleaned)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatQuantity(cleanupSummaryTotals.variance)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </section>
              </TabsContent>
            )}
          </Tabs>

          <Dialog open={Boolean(activeBatchLine)} onOpenChange={open => !open && setActiveBatchLineId(null)}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>{activeDocumentIsPosted ? 'Batch Information' : 'Batch Selection'}</DialogTitle>
                <DialogDescription>
                  {activeDocumentIsPosted
                    ? 'This is the batch used by the posted item stock out transaction.'
                    : `${activeBatchLine?.itemCode || 'Selected item'} batches in ${activeBatchLine?.fromWarehouseCode || `selected ${warehouseLabel.toLowerCase()}`}.`}
                </DialogDescription>
              </DialogHeader>

              {activeBatchLine && (
                <Tabs defaultValue="batches" className="space-y-4">
                  <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{activeBatchLine.itemCode}</Badge>
                        <Badge variant="outline">{activeBatchLine.fromWarehouseCode}</Badge>
                        {activeDocumentIsPosted && (
                          <Badge className={getInventoryStatusBadgeClass(issue.status)}>Posted</Badge>
                        )}
                        {activeBatchAllocationLines.length > 0 && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            {activeBatchAllocationLines.length} selected
                          </Badge>
                        )}
                      </div>
                      <TabsList>
                        <TabsTrigger value="batches">Batches</TabsTrigger>
                        <TabsTrigger value="conversion">UoM Conversion</TabsTrigger>
                      </TabsList>
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                      {activeDocumentIsPosted
                        ? 'Posted documents are read-only, so this view shows the batch saved on this transaction line.'
                        : usesLineWarehouse
                          ? `Choose one or more available batches. Additional selections are added to this ${warehouseLabel.toLowerCase()} automatically.`
                          : 'Choose an available batch for this item stock out line. The selected batch will carry its on-hand quantity and manufacturing date back to the row.'}
                    </p>
                    {!activeDocumentIsPosted && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        <div className="rounded-md bg-white px-3 py-2 text-sm">
                          <div className="text-xs font-medium text-muted-foreground">Total On Hand</div>
                          <div className="font-semibold tabular-nums">{formatQuantity(activeTotalBatchOnHand)} {getSelectedGroup(activeBatchLine.baseUom)?.baseUomCode ?? activeBatchLine.altUom}</div>
                        </div>
                        <div className="rounded-md bg-white px-3 py-2 text-sm">
                          <div className="text-xs font-medium text-muted-foreground">Total Needed</div>
                          <div className="font-semibold tabular-nums">{formatQuantity(activeRequiredAltQty)} {activeBatchLine.altUom}</div>
                        </div>
                        <div className="rounded-md bg-white px-3 py-2 text-sm">
                          <div className="text-xs font-medium text-muted-foreground">Total Selected</div>
                          <div className="font-semibold tabular-nums">{formatQuantity(activeAllocatedAltQty)} {activeBatchLine.altUom}</div>
                        </div>
                        <div className="rounded-md bg-white px-3 py-2 text-sm">
                          <div className="text-xs font-medium text-muted-foreground">Remaining</div>
                          <div className={`font-semibold tabular-nums ${activeRemainingAltQty > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatQuantity(activeRemainingAltQty)} {activeBatchLine.altUom}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <TabsContent value="batches" className="space-y-4">
                    {activeDocumentIsPosted ? (
                      activeBatchLine.batchNumber ? (
                        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <PackageCheck className="size-4 text-emerald-700" />
                              <span className="truncate font-semibold text-emerald-950">
                                {activeBatchLine.batchNumber}
                              </span>
                            </div>
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                              Used by this GI
                            </Badge>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-stone-700 sm:grid-cols-3">
                            <div className="rounded-md bg-white/70 px-2 py-1">
                              <span className="block font-medium text-stone-500">Issued Quantity</span>
                              <span className="font-semibold text-stone-950">
                                {formatQuantity(activeBatchLine.baseQty)} {getSelectedGroup(activeBatchLine.baseUom)?.baseUomCode ?? 'base'}
                              </span>
                            </div>
                            <div className="rounded-md bg-white/70 px-2 py-1">
                              <span className="block font-medium text-stone-500">{warehouseLabel}</span>
                              <span className="font-semibold text-stone-950">{activeBatchLine.fromWarehouseCode || '-'}</span>
                            </div>
                            <div className="rounded-md bg-white/70 px-2 py-1">
                              <span className="block font-medium text-stone-500">Manufacturing Date</span>
                              <span className="font-semibold text-stone-950">{formatDateValue(activeBatchLine.manufacturingDate)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                          No batch was saved on this posted transaction line.
                        </div>
                      )
                    ) : (
                      <>
                        {activeBatchLoading && (
                          <div className="flex min-h-32 items-center justify-center gap-2 rounded-md border border-dashed border-stone-300 bg-white text-sm text-stone-600">
                            <Loader2 className="size-4 animate-spin" />
                            Searching on-hand batches...
                          </div>
                        )}

                        {!activeBatchLoading && activeBatchHasSearched && activeBatchOptions.length === 0 && activeBatchAllocationLines.length === 0 && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                            No on-hand batches found for this item and {warehouseLabel.toLowerCase()}.
                          </div>
                        )}

                        {!activeBatchLoading && (activeBatchOptions.length > 0 || activeBatchAllocationLines.length > 0) && (
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="min-w-0 overflow-hidden rounded-md border">
                              <div className="border-b bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Available Batches</div>
                              <div className="grid grid-cols-[36px_minmax(100px,1fr)_90px_100px_84px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                                <div>#</div><div>Batch</div><div className="text-right">Remaining Qty</div><div className="text-right">Selected Qty</div><div className="text-right">Allocate</div>
                              </div>
                              <div className="max-h-[38vh] overflow-y-auto bg-white">
                                {activeAvailableBatchOptions.length === 0 ? (
                                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">No available batches.</div>
                                ) : activeAvailableBatchOptions.map((batch, index) => {
                                  const existingAllocation = activeBatchAllocationLines.find(allocation => allocation.batchNumber === batch.batchNumber)
                                  const baseQtyPerAltQty = calculateBaseQty(1, activeBatchLine.altUom, activeBatchLine.baseUom)
                                  const remainingBatchAltQty = baseQtyPerAltQty > 0 ? batch.onHandQty / baseQtyPerAltQty : 0
                                  const qtyToAllocate = Math.min(activeRemainingAltQty, remainingBatchAltQty)
                                  const allocationDraftKey = `${activeBatchLine.fromWarehouseCode}|${activeBatchLine.itemCode}|${batch.batchNumber}`
                                  const selectedQty = Math.min(batchAllocationDrafts[allocationDraftKey] ?? qtyToAllocate, qtyToAllocate)
                                  return (
                                  <div key={batch.batchNumber} className="grid grid-cols-[36px_minmax(100px,1fr)_90px_100px_84px] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0">
                                    <div className="text-muted-foreground">{index + 1}</div>
                                    <div className="min-w-0">
                                      <div className="truncate font-semibold">{batch.batchNumber}</div>
                                      <div className="truncate text-xs text-muted-foreground">MFG: {formatDateValue(batch.manufacturingDate)}</div>
                                    </div>
                                    <div className="text-right font-semibold tabular-nums">{formatQuantity(batch.onHandQty)}</div>
                                    <Input
                                      type="number"
                                      min="0"
                                      max={qtyToAllocate}
                                      step="any"
                                      value={selectedQty}
                                      disabled={qtyToAllocate <= 0}
                                      onChange={event => {
                                        const value = Math.min(Math.max(numberValue(event.target.value), 0), qtyToAllocate)
                                        setBatchAllocationDrafts(current => ({ ...current, [allocationDraftKey]: value }))
                                      }}
                                      className="h-8 text-right tabular-nums"
                                    />
                                    <div className="text-right">
                                      <Button
                                        type="button"
                                        size="xs"
                                        disabled={selectedQty <= 0}
                                        onClick={() => {
                                          if (!existingAllocation) {
                                            selectBatch(activeBatchLine, batch.batchNumber, selectedQty).catch(console.error)
                                            setBatchAllocationDrafts(current => {
                                              const next = { ...current }
                                              delete next[allocationDraftKey]
                                              return next
                                            })
                                            return
                                          }
                                          const altQty = existingAllocation.altQty + selectedQty
                                          updateLine(existingAllocation.id, {
                                            altQty,
                                            baseQty: calculateBaseQty(altQty, existingAllocation.altUom, existingAllocation.baseUom),
                                          })
                                          setBatchAllocationDrafts(current => {
                                            const next = { ...current }
                                            delete next[allocationDraftKey]
                                            return next
                                          })
                                        }}
                                      >&gt;</Button>
                                    </div>
                                  </div>
                                  )
                                })}
                              </div>
                            </div>

                            <div className="min-w-0 overflow-hidden rounded-md border">
                              <div className="border-b bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Selected Batches</div>
                              <div className="grid grid-cols-[36px_minmax(100px,1fr)_100px_100px_64px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                                <div>#</div><div>Batch</div><div className="text-right">Selected Qty</div><div className="text-right">Remaining</div><div className="text-right">Remove</div>
                              </div>
                              <div className="max-h-[38vh] overflow-y-auto bg-white">
                                {activeBatchAllocationLines.length === 0 ? (
                                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">No batches selected yet.</div>
                                ) : activeBatchAllocationLines.map((allocation, index) => {
                                  const otherSelectedQty = activeBatchAllocationLines.reduce(
                                    (total, candidate) => candidate.id === allocation.id ? total : total + Number(candidate.altQty || 0),
                                    0,
                                  )
                                  const baseQtyPerAltQty = calculateBaseQty(1, allocation.altUom, allocation.baseUom)
                                  const batchMaxAltQty = baseQtyPerAltQty > 0 ? allocation.onHandQty / baseQtyPerAltQty : 0
                                  const maxSelectedQty = Math.max(Math.min(activeRequiredAltQty - otherSelectedQty, batchMaxAltQty), 0)
                                  const remainingBatchQty = Math.max(getAvailableOnHandForLine(allocation) - allocation.baseQty, 0)
                                  return (
                                  <div key={allocation.id} className="grid grid-cols-[36px_minmax(100px,1fr)_100px_100px_64px] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0">
                                    <div className="text-muted-foreground">{index + 1}</div>
                                    <div className="min-w-0">
                                      <div className="truncate font-semibold">{allocation.batchNumber}</div>
                                      <div className="truncate text-xs text-muted-foreground">{allocation.itemCode}</div>
                                    </div>
                                    <Input
                                      type="number"
                                      min="0"
                                      max={maxSelectedQty}
                                      step="any"
                                      value={allocation.altQty}
                                      onChange={event => {
                                        const altQty = Math.min(Math.max(numberValue(event.target.value), 0), maxSelectedQty)
                                        updateLine(allocation.id, {
                                          altQty,
                                          baseQty: calculateBaseQty(altQty, allocation.altUom, allocation.baseUom),
                                        })
                                      }}
                                      className="h-8 text-right tabular-nums"
                                    />
                                    <div className="text-right font-medium tabular-nums">
                                      {formatQuantity(remainingBatchQty)}
                                    </div>
                                    <div className="text-right">
                                      <Button
                                        type="button"
                                        size="icon-xs"
                                        variant="outline"
                                        onClick={() => {
                                          if (activeBatchAllocationLines.length === 1) {
                                            updateLine(allocation.id, {
                                              batchNumber: '', manufacturingDate: '', expiryDate: '', onHandQty: 0,
                                            })
                                            return
                                          }
                                          setIssue(current => current ? {
                                            ...current,
                                            lines: current.lines.filter(candidate => candidate.id !== allocation.id),
                                          } : current)
                                        }}
                                        aria-label={`Remove ${allocation.batchNumber}`}
                                      ><X className="size-3.5" /></Button>
                                    </div>
                                  </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="conversion">
                    <div className="rounded-md border border-stone-200 bg-white p-4">
                      {(() => {
                        const conversion = getSelectedConversion(activeBatchLine.baseUom, activeBatchLine.altUom)
                        const baseUomCode = getSelectedGroup(activeBatchLine.baseUom)?.baseUomCode ?? 'base'
                        const recalculatedBaseQty = calculateBaseQty(
                          activeBatchLine.altQty,
                          activeBatchLine.altUom,
                          activeBatchLine.baseUom,
                        )

                        return (
                          <div className="space-y-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-semibold">{activeBatchLine.itemCode}</div>
                                <div className="text-xs text-stone-500">{activeBatchLine.description || 'Selected line'}</div>
                              </div>
                              <Badge variant="secondary">
                                Base UoM: {baseUomCode}
                              </Badge>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="rounded-md bg-stone-50 px-3 py-2">
                                <div className="text-xs font-medium text-stone-500">Entered Qty</div>
                                <div className="font-semibold tabular-nums">
                                  {formatQuantity(activeBatchLine.altQty)} {activeBatchLine.altUom || '-'}
                                </div>
                              </div>
                              <div className="rounded-md bg-stone-50 px-3 py-2">
                                <div className="text-xs font-medium text-stone-500">Conversion</div>
                                <div className="font-semibold tabular-nums">
                                  1 {activeBatchLine.altUom || '-'} = {formatQuantity(conversion?.baseQty ?? 0)} {baseUomCode}
                                </div>
                              </div>
                              <div className="rounded-md bg-stone-50 px-3 py-2">
                                <div className="text-xs font-medium text-stone-500">Base Quantity</div>
                                <div className="font-semibold tabular-nums">
                                  {formatQuantity(recalculatedBaseQty)} {baseUomCode}
                                </div>
                              </div>
                            </div>

                            <p className="text-xs text-stone-500">
                              Inventory on-hand quantities are already stored in base UoM. This tab only explains how the entered issue quantity converts to base quantity.
                            </p>
                          </div>
                        )
                      })()}
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              <DialogFooter className="sm:justify-between">
                {!activeDocumentIsPosted && activeBatchLine ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={activeBatchLoading || getRawBatchOptionsForLine(activeBatchLine).length === 0 || activeRequiredAltQty <= 0}
                    onClick={() => autoSelectDeliveryBatches(activeBatchLine)}
                  >
                    <PackageCheck className="size-4" />
                    Auto Select
                  </Button>
                ) : <span />}
                <DialogClose asChild>
                  <Button type="button" disabled={!activeDocumentIsPosted && Math.abs(activeRequiredAltQty - activeAllocatedAltQty) > 0.000001}>Done</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="mt-6 flex flex-col items-end gap-4">
            <div className="w-full rounded-lg border bg-card text-card-foreground">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold">Issue Summary</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Quantity summary</p>
                </div>
                <div className={`grid gap-2 text-right text-xs ${isCleanup ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="rounded-md border px-3 py-2">
                    <div className="text-muted-foreground">
                      {isCleanup ? 'Total Clean up Quantity' : 'Total Base Quantity'}
                    </div>
                    <div className="font-semibold tabular-nums">{formatQuantity(totalQuantity)}</div>
                  </div>
                  {isCleanup && (
                    <div className="rounded-md border px-3 py-2">
                      <div className="text-muted-foreground">Total Variance</div>
                      <div className="font-semibold tabular-nums">{formatQuantity(cleanupVarianceTotal)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {canEditDraft ? (
              <div className={`w-full ${showRemarksInActionRow ? 'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between' : ''}`}>
                {showRemarksInActionRow && (
                  <div className="w-full space-y-2 sm:max-w-xl">
                    <Label htmlFor="goods-issue-remarks">Remarks</Label>
                    <Input
                      id="goods-issue-remarks"
                      value={issue.remarks}
                      onChange={event => setIssue(current => current ? { ...current, remarks: event.target.value } : current)}
                      placeholder="Enter remarks..."
                      disabled={saving}
                    />
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSave('Draft')}
                    disabled={!canSave}
                  >
                    <Save className="size-4" />
                    {saving ? 'Saving...' : 'Save as Draft'}
                  </Button>
                  {canPostDocument && (
                    <Button type="button" onClick={() => setPostConfirmOpen(true)} disabled={!canSave}>
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

      <Dialog open={postConfirmOpen} onOpenChange={open => !saving && setPostConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post this {listLabel.toLowerCase()}?</DialogTitle>
            <DialogDescription>
              Posting {issue.giNo} will deduct inventory for the selected {listLabel.toLowerCase()} lines and cannot be edited afterward.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
            {isCleanup ? (
              <div className="space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-stone-500">Total Clean up Quantity</span>
                  <span className="font-semibold tabular-nums">{formatQuantity(totalQuantity)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-stone-500">Total Variance</span>
                  <span className="font-semibold tabular-nums">{formatQuantity(cleanupVarianceTotal)}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between gap-3">
                <span className="text-stone-500">Total Base Quantity</span>
                <span className="font-semibold tabular-nums">{formatQuantity(totalQuantity)}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={!canSave}
              onClick={async () => {
                await handleSave('Posted')
                setPostConfirmOpen(false)
              }}
            >
              {/*  */}
              <Save className="size-4" />
              {saving ? 'Posting...' : 'Confirm Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
