'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, List, Loader2, PackageCheck, Plus, Save, Trash2 } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Breadcrumb from '@/lib/Breadcrumb'
import SearchableDropdown from '@/lib/SearchableDropdown'
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
  getAssociatedWarehouseCode,
  getGoodsIssueReferences,
} from './api'
import {
  GoodsReceiptBatchRule,
  GoodsReceiptFarm,
  GoodsReceiptItemGroup,
  UomConversionOption,
  UomGroupOption,
} from '@/app/inv/gr/new/api'

const INITIAL_LINE_COUNT = 5
const MIN_LINES_TO_ADD = 1
const MAX_LINES_TO_ADD = 50
const QUANTITY_LOCALE = 'en-PH'
const QUANTITY_FORMAT_OPTIONS: Intl.NumberFormatOptions = { maximumFractionDigits: 6 }

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
})

const emptyIssue = (giNo: string): GoodsIssue => ({
  id: null,
  giNo,
  issueDate: today(),
  farmId: null,
  farmCode: '',
  farmName: '',
  fromWarehouseId: null,
  fromWarehouseCode: '',
  fromWarehouseName: '',
  remarks: '',
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

const canSearchLineInventory = (line: Pick<GoodsIssueLine, 'itemCode' | 'fromWarehouseCode'>) =>
  Boolean(line.itemCode.trim() && line.fromWarehouseCode.trim())

const getFarmWarehouseCodes = (farm?: GoodsReceiptFarm | null) => {
  const associations = farm?.associated_warehouses
  if (!Array.isArray(associations)) return new Set<string>()

  return new Set(associations.map(getAssociatedWarehouseCode).filter(Boolean))
}

const getWarehousesForFarm = (
  farm: GoodsReceiptFarm | null | undefined,
  warehouses: WarehouseData[],
) => {
  const warehouseCodes = getFarmWarehouseCodes(farm)
  if (!warehouseCodes.size) return []

  return warehouses.filter(warehouse =>
    warehouseCodes.has(String(warehouse.whse_code ?? '').trim()),
  )
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
}

type HeaderField = {
  key: string
  label: string
  className?: string
  content: ReactNode
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

export default function NewGoodsIssue({ mode = 'draft' }: NewGoodsIssueProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getValue } = useGlobalContext()
  const { setCollapsed } = useSidebar()
  const issueId = searchParams.get('id')
  const isPostMode = mode === 'post'
  const cannotInsert = usePermission('/inv/gi/insert')
  const cannotEdit = usePermission('/inv/gi/edit')
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
  const [activeBatchLineId, setActiveBatchLineId] = useState<GoodsIssueLine['id'] | null>(null)
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
        if (isPostMode && !issueId) {
          toast('Select a draft item stock out transaction to post.')
          router.push('/inv/gi')
          return
        }

        const cachedItems = asArray<Items>(getValue('itemmaster'))
          .filter(item => item.void === 1 || item.void == null)
        const cachedWarehouses = getCachedWarehouses(getValue('warehouses'))
          .filter(warehouse => !('is_active' in warehouse) || warehouse.is_active !== false)

        const referencesPromise = cachedItems.length > 0 && cachedWarehouses.length > 0
          ? getGoodsIssueReferences().then(references => ({
            ...references,
            items: cachedItems,
            warehouses: cachedWarehouses,
          }))
          : getGoodsIssueReferences()

        const [references, savedIssue, giNo] = await Promise.all([
          referencesPromise,
          issueId ? getGoodsIssueById(Number(issueId)) : Promise.resolve(null),
          issueId ? Promise.resolve('') : createGoodsIssueNumber(),
        ])

        if (cancelled) return

        setIssue(savedIssue ?? emptyIssue(giNo))
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
  }, [getValue, isPostMode, issueId, router])

  const selectedFarm = useMemo(
    () => farms.find(farm => farm.id === issue?.farmId),
    [farms, issue?.farmId],
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

  const getSelectedItem = (line: GoodsIssueLine) =>
    items.find(item => item.id === line.itemId)

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

  const calculateBaseQty = (altQty: number, altUom: string, groupCode: string) => {
    if (!altUom || !groupCode) return 0

    const conversion = conversions.find(
      option =>
        option.groupCode.toUpperCase() === groupCode.trim().toUpperCase() &&
        option.uomCode.toUpperCase() === altUom.trim().toUpperCase(),
    )

    return conversion ? altQty * conversion.baseQty : 0
  }

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
      const availableWarehouses = getWarehousesForFarm(farm, warehouses)
      return availableWarehouses.length === 1 ? availableWarehouses[0] : null
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

  const selectItem = async (line: GoodsIssueLine, value: string) => {
    const item = items.find(candidate => candidate.item_code === value)
    const baseUom = item?.inventory_uom || item?.unit_measure || ''
    const groupUoms = getGroupUoms(baseUom)
    const altUom = groupUoms.some(option => option.uomCode === baseUom)
      ? baseUom
      : groupUoms[0]?.uomCode ?? ''
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
      fromWarehouseId: issue?.fromWarehouseId ?? line.fromWarehouseId,
      fromWarehouseCode: issue?.fromWarehouseCode ?? line.fromWarehouseCode,
      fromWarehouseName: issue?.fromWarehouseName ?? line.fromWarehouseName,
      onHandQty: 0,
    }

    const batchRule = item ? getBatchRuleForLine(updatedLine) : null
    updateLine(line.id, {
      ...updatedLine,
      batchRuleId: batchRule?.id ?? null,
    })

    await refreshLineOnHand({
      ...updatedLine,
      batchRuleId: batchRule?.id ?? null,
    })
  }

  const selectBatch = async (line: GoodsIssueLine, batchNumber: string) => {
    if (issue?.status !== 'Draft') return

    const options = batchOptions[batchOptionKey(line)] ?? []
    const batch = options.find(option => option.batchNumber === batchNumber)
    updateLine(line.id, {
      batchNumber: batch?.batchNumber ?? '',
      manufacturingDate: batch?.manufacturingDate ?? '',
      expiryDate: batch?.expiryDate ?? '',
      onHandQty: batch?.onHandQty ?? 0,
    })
    setActiveBatchLineId(null)
  }

  const openBatchSelector = (line: GoodsIssueLine) => {
    if (!canSearchLineInventory(line)) return

    setActiveBatchLineId(line.id)
    if (issue?.status !== 'Posted') {
      refreshLineOnHand(line).catch(console.error)
    }
  }

  const completedLines = issue?.lines
    .filter(lineHasEnteredItem)
    .map(getLineWithRecalculatedQuantity) ?? []
  const totalQuantity = completedLines.reduce(
    (total, line) => total + Number(line.baseQty || 0),
    0,
  )
  const canEditDraft = issue?.status === 'Draft'
  const canPostDocument = isPostMode || Boolean(issue?.id)

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
    if (!issue.fromWarehouseId || !issue.fromWarehouseCode) {
      toast('Please select a warehouse.')
      return
    }
    const linesToSave = completedLines

    if (posting && linesToSave.length === 0) {
      toast('Please select at least one item.')
      return
    }
    if (linesToSave.some(lineHasInvalidQuantity)) {
      toast('Each item needs a UoM group, Alt UoM, and valid quantity.')
      return
    }

    const missingBatchLine = posting
      ? linesToSave.find(line => itemNeedsBatch(line) && !line.batchNumber.trim())
      : null
    if (missingBatchLine) {
      toast(`Please select an on-hand batch for ${missingBatchLine.itemCode}.`)
      return
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

      const savedIssue = await saveGoodsIssue({
        ...issue,
        status: targetStatus,
        lines: linesToSave,
      })

      toast(posting ? 'Item stock out posted successfully.' : 'Item stock out draft saved.')

      if (posting) {
        router.push('/inv/gi')
        return
      }
      if (!isPostMode && savedIssue?.id) {
        router.push(`/inv/gi/post?id=${savedIssue.id}`)
        return
      }
      if (savedIssue) setIssue(savedIssue)
    } catch (error) {
      console.error(error)
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to save item stock out'))
    } finally {
      setSaving(false)
    }
  }

  if (!issue) return <GoodsIssueLoadingShell />

  const activeBatchLine = issue.lines.find(line => line.id === activeBatchLineId) ?? null
  const activeBatchKey = activeBatchLine ? batchOptionKey(activeBatchLine) : ''
  const activeBatchOptions = activeBatchKey ? batchOptions[activeBatchKey] ?? [] : []
  const activeBatchLoading = activeBatchKey ? Boolean(loadingBatchOptions[activeBatchKey]) : false
  const activeBatchHasSearched = activeBatchKey
    ? Object.prototype.hasOwnProperty.call(batchOptions, activeBatchKey)
    : false
  const activeDocumentIsPosted = issue.status === 'Posted'

  const canSave = !saving && canEditDraft && (issue.id ? !cannotEdit : !cannotInsert)
  const headerComponentList: HeaderField[] = [
    {
      key: 'gi-no',
      label: 'GI No.',
      content:
        (
          <div className='flex items-center gap-1'>
            <Input value={issue.giNo} readOnly className="bg-stone-50" />,
            <span className={getInventoryStatusBadgeClass(issue.status)}>
              {issue.status}
            </span>
          </div>

        )
    },
    {
      key: 'issue-date',
      label: 'Issue Date',
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
    {
      key: 'warehouse',
      label: 'Warehouse',
      content: (
        <SearchableDropdown
          list={farmWarehouses}
          codeLabel="whse_code"
          nameLabel="whse_name"
          value={issue.fromWarehouseCode}
          placeholder={issue.farmId ? 'Select warehouse...' : 'Select farm first'}
          width={360}
          onChange={(value) => selectHeaderWarehouse(value)}
        />
      ),
    },
    {
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
    },
  ]

  return (
    <main className="min-h-[calc(100vh-4rem)]  text-stone-950">
      <div className="flex items-center justify-between gap-3 px-4 mt-4">
        <Breadcrumb
          SecondPreviewPageName="Inventory"
          SecondPreviewPageLink="/inv"
          FirstPreviewsPageName="Item Stock Out"
          FirstPreviewsPageLink="/inv/gi"
          CurrentPageName={isPostMode ? 'Post GI' : 'New GI'}
        />
        <Button type="button" variant="outline" onClick={() => router.push('/inv/gi')}>
          <List className="size-4" />
          Item Stock Out List
        </Button>
      </div>

      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid gap-x-16 gap-y-3 p-5 lg:grid-cols-2">
          {headerComponentList.map(item => (
            <div
              key={item.key}
              className={`grid items-center gap-2 ${item.className ?? 'sm:grid-cols-[112px_minmax(0,300px)]'}`}
            >
              <label className="text-sm font-semibold">{item.label}</label>
              {item.content}
            </div>
          ))}
        </div>

        <div className="border-t p-5">
          <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-200 bg-white px-3 py-3">
              <h2 className="text-base font-semibold">Issue Lines</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full border-collapse text-sm">
                <thead className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-600">
                  <tr>
                    <th className="w-12 px-3 py-3 text-center">#</th>
                    <th className="w-[280px] px-3 py-3">Item</th>
                    <th className="w-[240px] px-3 py-3">Batch</th>
                    <th className="w-[160px] px-3 py-3">UoM Group</th>
                    <th className="w-[120px] px-3 py-3">Qty</th>
                    <th className="w-[140px] px-3 py-3">Alt UoM</th>
                    <th className="w-[180px] px-3 py-3">Base Qty</th>
                    <th className="w-[130px] px-3 py-3">{activeDocumentIsPosted ? 'Used Qty' : 'On Hand'}</th>
                    <th className="w-14 px-3 py-3" />
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
                      <tr key={line.id} className="odd:bg-white even:bg-stone-50/70 hover:bg-stone-50">
                        <td className="px-3 py-3 text-center align-middle text-stone-500">{index + 1}</td>
                        <td className="px-3 py-2 align-middle">
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
                        <td className="px-3 py-2 align-middle">
                          {needsBatch ? (
                            <div className="space-y-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                disabled={!canSearchBatches}
                                onClick={() => openBatchSelector(line)}
                                className={`h-auto min-h-9 w-full justify-between border-stone-300 px-2 py-2 text-left font-normal hover:bg-stone-50 ${
                                  line.batchNumber
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                                    : 'bg-white text-stone-800'
                                }`}
                              >
                                <span className="min-w-0 flex-1">
                                  {line.batchNumber ? (
                                    <span className="block text-xs">
                                      <span className="flex items-center gap-2 font-semibold">
                                        <PackageCheck className="size-3.5" />
                                        <span className="truncate">{line.batchNumber}</span>
                                      </span>
                                      <span className="mt-1 grid gap-x-3 gap-y-0.5 sm:grid-cols-2">
                                        <span className={isOver ? 'font-semibold text-red-700' : ''}>
                                          {activeDocumentIsPosted ? 'Issued' : 'On hand'}:{' '}
                                          {formatQuantity(activeDocumentIsPosted ? line.baseQty : line.onHandQty)}
                                        </span>
                                        <span>Warehouse: {line.fromWarehouseCode || '-'}</span>
                                        <span>MFG: {formatDateValue(line.manufacturingDate)}</span>
                                        <span>EXP: {formatDateValue(line.expiryDate)}</span>
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="truncate">
                                      {canSearchBatches ? 'Select on-hand batch' : 'Select item and warehouse first'}
                                    </span>
                                  )}
                                </span>
                                {isLoadingBatches && (
                                  <Loader2 className="ml-2 size-4 shrink-0 animate-spin text-stone-500" />
                                )}
                              </Button>

                              {isLoadingBatches && (
                                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                                  <Loader2 className="size-3.5 animate-spin" />
                                  <span>Searching on-hand batches for this item and warehouse.</span>
                                </div>
                              )}

                              {!isLoadingBatches && hasSearchedBatches && canSearchBatches && batches.length === 0 && (
                                <div className="text-xs text-amber-700">
                                  No on-hand batches found for this item in {line.fromWarehouseCode}.
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex h-9 items-center text-stone-400">Not required</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <select
                            value={line.baseUom}
                            disabled
                            className="h-9 w-full rounded-md border border-stone-300 bg-stone-100 px-2 text-sm text-stone-600 outline-none disabled:cursor-not-allowed disabled:opacity-100"
                          >
                            <option value="">Select item</option>
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
                            onChange={event => {
                              const altQty = numberValue(event.target.value)
                              updateLine(line.id, {
                                altQty,
                                baseQty: calculateBaseQty(altQty, line.altUom, line.baseUom),
                              })
                            }}
                            className="border-stone-300 bg-white"
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
                            <option value="">{line.baseUom ? 'Select Alt UoM' : 'Select item first'}</option>
                            {getGroupUoms(line.baseUom).map(conversion => (
                              <option key={`${conversion.groupId}-${conversion.uomCode}`} value={conversion.uomCode}>
                                {conversion.uomCode}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 align-middle text-stone-800">
                          {line.baseUom && line.altUom ? (
                            <div className="whitespace-nowrap">
                              <span className="font-medium tabular-nums">
                                {formatQuantity(line.baseQty)}
                              </span>{' '}
                              <span className="text-stone-600">
                                {getSelectedGroup(line.baseUom)?.baseUomCode}
                              </span>
                              <div className="text-xs text-stone-500">
                                {formatQuantity(line.altQty)}{' '}
                                {line.altUom} x{' '}
                                {getSelectedConversion(line.baseUom, line.altUom)?.baseQty.toLocaleString(QUANTITY_LOCALE, QUANTITY_FORMAT_OPTIONS)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-stone-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle">
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
                        <td className="px-3 py-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => setIssue(current => current ? {
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
            </div>

            <div className="flex justify-end gap-2 border-t border-stone-200 bg-stone-50 px-3 py-3">
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
            </div>
          </section>

          <Dialog open={Boolean(activeBatchLine)} onOpenChange={open => !open && setActiveBatchLineId(null)}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{activeDocumentIsPosted ? 'Batch Information' : 'Select On-hand Batch'}</DialogTitle>
                <DialogDescription>
                  {activeDocumentIsPosted
                    ? 'This is the batch used by the posted item stock out transaction.'
                    : `${activeBatchLine?.itemCode || 'Selected item'} batches in ${activeBatchLine?.fromWarehouseCode || 'selected warehouse'}.`}
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
                        {activeBatchLine.batchNumber && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Selected: {activeBatchLine.batchNumber}
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
                        : 'Choose an available batch for this item stock out line. The selected batch will carry its on-hand quantity, manufacturing date, and expiry date back to the row.'}
                    </p>
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

                          <div className="mt-3 grid gap-2 text-xs text-stone-700 sm:grid-cols-4">
                            <div className="rounded-md bg-white/70 px-2 py-1">
                              <span className="block font-medium text-stone-500">Issued Quantity</span>
                              <span className="font-semibold text-stone-950">
                                {formatQuantity(activeBatchLine.baseQty)} {getSelectedGroup(activeBatchLine.baseUom)?.baseUomCode ?? 'base'}
                              </span>
                            </div>
                            <div className="rounded-md bg-white/70 px-2 py-1">
                              <span className="block font-medium text-stone-500">Warehouse</span>
                              <span className="font-semibold text-stone-950">{activeBatchLine.fromWarehouseCode || '-'}</span>
                            </div>
                            <div className="rounded-md bg-white/70 px-2 py-1">
                              <span className="block font-medium text-stone-500">Manufacturing Date</span>
                              <span className="font-semibold text-stone-950">{formatDateValue(activeBatchLine.manufacturingDate)}</span>
                            </div>
                            <div className="rounded-md bg-white/70 px-2 py-1">
                              <span className="block font-medium text-stone-500">Expiry Date</span>
                              <span className="font-semibold text-stone-950">{formatDateValue(activeBatchLine.expiryDate)}</span>
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

                        {!activeBatchLoading && activeBatchHasSearched && activeBatchOptions.length === 0 && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                            No on-hand batches found for this item and warehouse.
                          </div>
                        )}

                        {!activeBatchLoading && activeBatchOptions.length > 0 && (
                          <div className="grid gap-3">
                            {activeBatchOptions.map(batch => {
                              const selected = batch.batchNumber === activeBatchLine.batchNumber

                              return (
                                <button
                                  key={batch.batchNumber}
                                  type="button"
                                  onClick={() => selectBatch(activeBatchLine, batch.batchNumber)}
                                  className={`rounded-md border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-stone-200 ${
                                    selected
                                      ? 'border-emerald-300 bg-emerald-50'
                                      : 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <PackageCheck className={selected ? 'size-4 text-emerald-700' : 'size-4 text-stone-500'} />
                                      <span className="truncate font-semibold text-stone-900">
                                        {batch.batchNumber}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant="secondary">
                                        {formatQuantity(batch.onHandQty)} {getSelectedGroup(activeBatchLine.baseUom)?.baseUomCode ?? 'base'} on hand
                                      </Badge>
                                      {selected && (
                                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                          Selected
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3 grid gap-2 text-xs text-stone-600 sm:grid-cols-3">
                                    <div className="rounded-md bg-stone-50 px-2 py-1">
                                      <span className="block font-medium text-stone-500">Manufacturing Date</span>
                                      <span className="text-stone-900">{formatDateValue(batch.manufacturingDate)}</span>
                                    </div>
                                    <div className="rounded-md bg-stone-50 px-2 py-1">
                                      <span className="block font-medium text-stone-500">Expiry Date</span>
                                      <span className="text-stone-900">{formatDateValue(batch.expiryDate)}</span>
                                    </div>
                                    <div className="rounded-md bg-stone-50 px-2 py-1">
                                      <span className="block font-medium text-stone-500">Warehouse</span>
                                      <span className="text-stone-900">{batch.warehouseCode}</span>
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
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

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="mt-6 flex flex-col items-end gap-4">
            <div className="w-full rounded-xl border p-4 sm:w-[34rem]">
              <h3 className="text-sm font-semibold">Issue Summary</h3>
              <div className="mt-3 flex justify-between text-sm">
                <span>Total Base Quantity</span>
                <span className="font-medium tabular-nums">
                  {formatQuantity(totalQuantity)}
                </span>
              </div>
            </div>

            {canEditDraft ? (
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
            ) : (
              <p className="text-sm text-stone-500">This document is already posted and cannot be edited.</p>
            )}
          </div>
        </div>
      </section>

      <Dialog open={postConfirmOpen} onOpenChange={open => !saving && setPostConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post this item stock out?</DialogTitle>
            <DialogDescription>
              Posting {issue.giNo} will deduct inventory for the selected issue lines and cannot be edited afterward.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">Total Base Quantity</span>
              <span className="font-semibold tabular-nums">{formatQuantity(totalQuantity)}</span>
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
