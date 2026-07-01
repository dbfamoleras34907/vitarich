'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import SearchableCombobox from '@/components/SearchableCombobox'
import DefaultFarmComboBox from '@/app/components/DefaultFarmComboBox'
import DynamicTable from '@/components/ui/DataTableV2'
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
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import Breadcrumb from '@/lib/Breadcrumb'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import {
  ArrowRightCircle,
  CheckCircle2,
  Edit,
  FileSliders,
  Hash,
  ListFilter,
  Loader2,
  PackageSearch,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  BatchDateFormat,
  BatchDefaultStatus,
  BatchIssueMethod,
  BatchLookupOption,
  BatchNumberSeries,
  BatchNumberSeriesPayload,
  BatchReferences,
  BatchResetType,
  BatchRule,
  BatchRulePayload,
  BatchTransactionTrail,
  CreatedBatchInventory,
  deleteBatchNumberSeries,
  deleteBatchRule,
  getBatchTransactionTrail,
  getBatchNumberSeries,
  getCreatedBatchInventory,
  getBatchReferences,
  getBatchRules,
  saveBatchNumberSeries,
  saveBatchRule,
} from './api'

type BatchSeriesForm = {
  code: string
  name: string
  prefix: string
  suffix: string
  separator: string
  next_number: string
  number_length: string
  reset_type: BatchResetType
  date_format: BatchDateFormat
  include_expiry_date: boolean
  active: boolean
  remarks: string
}

type BatchRuleForm = {
  code: string
  name: string
  series_id: string
  item_group_id: string
  item_id: string
  warehouse_id: string
  branch_id: string
  auto_generate: boolean
  manual_entry: boolean
  allow_duplicate: boolean
  require_manufacturing_date: boolean
  require_expiry_date: boolean
  expiry_days: string
  shelf_life_days: string
  issue_method: BatchIssueMethod
  require_supplier_batch: boolean
  require_qc: boolean
  default_status: BatchDefaultStatus
  active: boolean
  remarks: string
}

type BatchSeriesRow = BatchNumberSeries & {
  sample_number: string
  status_label: string
  [key: string]: unknown
}

type BatchRuleRow = BatchRule & {
  series_label: string
  scope_label: string
  behavior_label: string
  item_group_label: string
  item_label: string
  warehouse_label: string
  branch_label: string
  status_label: string
  [key: string]: unknown
}

type CreatedBatchInventoryRow = CreatedBatchInventory & {
  item_label: string
  warehouse_label: string
  on_hand_label: string
  supplier_batch_label: string
  source_label: string
  created_label: string
  [key: string]: unknown
}

type BatchTrailHeader = Pick<
  CreatedBatchInventoryRow,
  'itemCode' | 'item_label' | 'batchNumber' | 'warehouseCode' | 'warehouse_label' | 'on_hand_label'
>

const resetTypes: BatchResetType[] = ['Never', 'Daily', 'Monthly', 'Yearly']
const dateFormats: BatchDateFormat[] = ['NONE', 'YYYYMMDD', 'YYMMDD', 'YYYYMM', 'YYMM', 'YYYY', 'YY']
const issueMethods: BatchIssueMethod[] = ['FIFO', 'FEFO', 'LIFO', 'MANUAL']
const defaultStatuses: BatchDefaultStatus[] = ['Released', 'Hold', 'Blocked']

const emptySeriesForm: BatchSeriesForm = {
  code: '',
  name: '',
  prefix: 'FD',
  suffix: '',
  separator: '-',
  next_number: '1',
  number_length: '5',
  reset_type: 'Never',
  date_format: 'YYMMDD',
  include_expiry_date: true,
  active: true,
  remarks: '',
}

const emptyRuleForm: BatchRuleForm = {
  code: '',
  name: '',
  series_id: '',
  item_group_id: '',
  item_id: '',
  warehouse_id: '',
  branch_id: '',
  auto_generate: true,
  manual_entry: true,
  allow_duplicate: false,
  require_manufacturing_date: false,
  require_expiry_date: false,
  expiry_days: '',
  shelf_life_days: '',
  issue_method: 'FIFO',
  require_supplier_batch: false,
  require_qc: false,
  default_status: 'Released',
  active: true,
  remarks: '',
}

const emptyReferences: BatchReferences = {
  itemGroups: [],
  items: [],
  warehouses: [],
  farms: [],
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (!error || typeof error !== 'object') return String(error ?? '')

  const errorShape = error as {
    message?: string
    details?: string
    hint?: string
    code?: string
  }

  return [
    errorShape.message,
    errorShape.details,
    errorShape.hint,
    errorShape.code ? `Code: ${errorShape.code}` : '',
  ]
    .filter(Boolean)
    .join(' ') || 'Unknown error'
}

const toOptionalNumber = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const formatDatePart = (format: BatchDateFormat, date = new Date()) => {
  if (format === 'NONE') return ''

  const year = String(date.getFullYear())
  const yy = year.slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return format
    .replace('YYYY', year)
    .replace('YY', yy)
    .replace('MM', month)
    .replace('DD', day)
}

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const buildSampleNumber = (series: {
  prefix?: string | null
  suffix?: string | null
  separator: string
  next_number: number | string
  number_length: number | string
  date_format: BatchDateFormat
  include_expiry_date?: boolean | null
}) => {
  const sampleMfgDate = new Date()
  const sampleExpDate = addDays(sampleMfgDate, 90)
  const nextNumber = Math.max(0, Number(series.next_number) || 0)
  const numberLength = Math.max(1, Number(series.number_length) || 1)
  const mfgPart = formatDatePart(series.date_format, sampleMfgDate)
  const expPart = series.include_expiry_date === false ? '' : formatDatePart(series.date_format, sampleExpDate)
  const sequence = String(nextNumber).padStart(numberLength, '0')
  const separator = series.separator || '-'

  return [series.prefix, mfgPart, expPart, sequence, series.suffix]
    .map(part => String(part ?? '').trim())
    .filter(Boolean)
    .join(separator)
}

const optionLabel = (option?: BatchLookupOption) => {
  if (!option) return '-'
  return [option.code, option.name].filter(Boolean).join(' - ') || String(option.id)
}

const makeOptionMap = (options: BatchLookupOption[]) =>
  new Map(options.map(option => [option.id, option]))

const formatBatchDate = (value: string) => value || '-'

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

const toSeriesForm = (series: BatchNumberSeries): BatchSeriesForm => ({
  code: series.code,
  name: series.name,
  prefix: series.prefix ?? '',
  suffix: series.suffix ?? '',
  separator: series.separator,
  next_number: String(series.next_number),
  number_length: String(series.number_length),
  reset_type: series.reset_type,
  date_format: series.date_format,
  include_expiry_date: series.include_expiry_date ?? true,
  active: series.active,
  remarks: series.remarks ?? '',
})

const toSeriesPayload = (form: BatchSeriesForm): BatchNumberSeriesPayload => ({
  code: form.code.trim().toUpperCase(),
  name: form.name.trim(),
  prefix: form.prefix.trim() || null,
  suffix: form.suffix.trim() || null,
  separator: form.separator || '-',
  next_number: Number(form.next_number),
  number_length: Number(form.number_length),
  reset_type: form.reset_type,
  date_format: form.date_format,
  include_expiry_date: form.include_expiry_date,
  active: form.active,
  remarks: form.remarks.trim() || null,
})

const toRuleForm = (rule: BatchRule): BatchRuleForm => ({
  code: rule.code,
  name: rule.name,
  series_id: String(rule.series_id),
  item_group_id: rule.item_group_id ? String(rule.item_group_id) : '',
  item_id: rule.item_id ? String(rule.item_id) : '',
  warehouse_id: rule.warehouse_id ? String(rule.warehouse_id) : '',
  branch_id: rule.branch_id ? String(rule.branch_id) : '',
  auto_generate: rule.auto_generate,
  manual_entry: rule.manual_entry,
  allow_duplicate: rule.allow_duplicate,
  require_manufacturing_date: rule.require_manufacturing_date,
  require_expiry_date: rule.require_expiry_date,
  expiry_days: rule.expiry_days ? String(rule.expiry_days) : '',
  shelf_life_days: rule.shelf_life_days ? String(rule.shelf_life_days) : '',
  issue_method: rule.issue_method,
  require_supplier_batch: rule.require_supplier_batch,
  require_qc: rule.require_qc,
  default_status: rule.default_status,
  active: rule.active,
  remarks: rule.remarks ?? '',
})

const toRulePayload = (form: BatchRuleForm): BatchRulePayload => ({
  code: form.code.trim().toUpperCase(),
  name: form.name.trim(),
  series_id: Number(form.series_id),
  item_group_id: toOptionalNumber(form.item_group_id),
  item_id: toOptionalNumber(form.item_id),
  warehouse_id: toOptionalNumber(form.warehouse_id),
  branch_id: toOptionalNumber(form.branch_id),
  auto_generate: form.auto_generate,
  manual_entry: form.manual_entry,
  allow_duplicate: form.allow_duplicate,
  require_manufacturing_date: form.require_manufacturing_date,
  require_expiry_date: form.require_expiry_date,
  expiry_days: toOptionalNumber(form.expiry_days),
  shelf_life_days: toOptionalNumber(form.shelf_life_days),
  issue_method: form.issue_method,
  require_supplier_batch: form.require_supplier_batch,
  require_qc: form.require_qc,
  default_status: form.default_status,
  active: form.active,
  remarks: form.remarks.trim() || null,
})

function BoolSwitch({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex h-10 items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-3">
      <Label htmlFor={id} className="text-sm font-medium text-stone-800">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export default function Layout() {
  const { getValue } = useGlobalContext()
  const [series, setSeries] = useState<BatchNumberSeries[]>([])
  const [rules, setRules] = useState<BatchRule[]>([])
  const [createdBatches, setCreatedBatches] = useState<CreatedBatchInventory[]>([])
  const [batchDateFrom, setBatchDateFrom] = useState(() => toDateInputValue(addDays(new Date(), -30)))
  const [batchDateTo, setBatchDateTo] = useState(() => toDateInputValue(new Date()))
  const [batchFarmId, setBatchFarmId] = useState<string | number>(() => getValue('DefaultFarmId') ?? '')
  const [references, setReferences] = useState<BatchReferences>(emptyReferences)
  const [seriesForm, setSeriesForm] = useState<BatchSeriesForm>(emptySeriesForm)
  const [ruleForm, setRuleForm] = useState<BatchRuleForm>(emptyRuleForm)
  const [editingSeriesId, setEditingSeriesId] = useState<number | null>(null)
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingSeries, setSavingSeries] = useState(false)
  const [savingRule, setSavingRule] = useState(false)
  const [trailHeader, setTrailHeader] = useState<BatchTrailHeader | null>(null)
  const [trailRows, setTrailRows] = useState<BatchTransactionTrail[]>([])
  const [loadingTrail, setLoadingTrail] = useState(false)

  const seriesMap = useMemo(() => makeOptionMap(series.map(item => ({
    id: item.id,
    code: item.code,
    name: item.name,
  }))), [series])
  const itemGroupMap = useMemo(() => makeOptionMap(references.itemGroups), [references.itemGroups])
  const itemMap = useMemo(() => makeOptionMap(references.items), [references.items])
  const warehouseMap = useMemo(() => makeOptionMap(references.warehouses), [references.warehouses])
  const farmMap = useMemo(() => makeOptionMap(references.farms), [references.farms])
  const farmOptions = useMemo(
    () =>
      references.farms.map(farm => ({
        code: String(farm.id),
        name: optionLabel(farm),
      })),
    [references.farms],
  )

  const seriesRows: BatchSeriesRow[] = useMemo(
    () =>
      series.map(item => ({
        ...item,
        sample_number: buildSampleNumber(item),
        status_label: item.active ? 'Active' : 'Inactive',
      })),
    [series],
  )

  const ruleRows: BatchRuleRow[] = useMemo(
    () =>
      rules.map(rule => ({
        ...rule,
        series_label: optionLabel(seriesMap.get(rule.series_id)),
        item_group_label: optionLabel(rule.item_group_id ? itemGroupMap.get(rule.item_group_id) : undefined),
        item_label: optionLabel(rule.item_id ? itemMap.get(rule.item_id) : undefined),
        warehouse_label: optionLabel(rule.warehouse_id ? warehouseMap.get(rule.warehouse_id) : undefined),
        branch_label: optionLabel(rule.branch_id ? farmMap.get(rule.branch_id) : undefined),
        scope_label: [
          optionLabel(rule.item_group_id ? itemGroupMap.get(rule.item_group_id) : undefined),
          optionLabel(rule.warehouse_id ? warehouseMap.get(rule.warehouse_id) : undefined),
          optionLabel(rule.branch_id ? farmMap.get(rule.branch_id) : undefined),
        ].filter(label => label !== '-').join(' / ') || 'All items and locations',
        behavior_label: `${rule.issue_method} / ${rule.default_status}`,
        status_label: rule.active ? 'Active' : 'Inactive',
      })),
    [farmMap, itemGroupMap, itemMap, rules, seriesMap, warehouseMap],
  )

  const createdBatchRows: CreatedBatchInventoryRow[] = useMemo(
    () =>
      createdBatches.map(batch => ({
        ...batch,
        item_label: [batch.itemCode, batch.itemName].filter(Boolean).join(' - ') || batch.itemCode,
        warehouse_label: batch.warehouseCode || '-',
        on_hand_label: formatQuantity(batch.onHandQty),
        supplier_batch_label: batch.supplierBatchNumber || '-',
        source_label: batch.sourceGrNo || (batch.sourceGrId ? `GR #${batch.sourceGrId}` : '-'),
        created_label: formatDateTime(batch.createdAt),
      })),
    [createdBatches],
  )

  const sampleNumber = useMemo(() => buildSampleNumber(toSeriesPayload(seriesForm)), [seriesForm])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [seriesData, rulesData, createdBatchData, referenceData] = await Promise.all([
        getBatchNumberSeries(),
        getBatchRules(),
        getCreatedBatchInventory({
          dateFrom: batchDateFrom || undefined,
          dateTo: batchDateTo || undefined,
          farmId: batchFarmId || undefined,
        }),
        getBatchReferences(),
      ])
      setSeries(seriesData)
      setRules(rulesData)
      setCreatedBatches(createdBatchData)
      setReferences(referenceData)
    } catch (error) {
      console.error(error)
      toast.error('Unable to load batch setup')
    } finally {
      setLoading(false)
    }
  }, [batchDateFrom, batchDateTo, batchFarmId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (batchFarmId) return

    const defaultFarmId = getValue('DefaultFarmId')
    if (defaultFarmId) {
      setBatchFarmId(defaultFarmId)
    }
  }, [batchFarmId, getValue])

  const updateSeriesForm = <K extends keyof BatchSeriesForm>(key: K, value: BatchSeriesForm[K]) => {
    setSeriesForm(current => ({ ...current, [key]: value }))
  }

  const updateRuleForm = <K extends keyof BatchRuleForm>(key: K, value: BatchRuleForm[K]) => {
    setRuleForm(current => ({ ...current, [key]: value }))
  }

  const resetSeriesForm = () => {
    setSeriesForm(emptySeriesForm)
    setEditingSeriesId(null)
  }

  const resetRuleForm = () => {
    setRuleForm(emptyRuleForm)
    setEditingRuleId(null)
  }

  const validateSeriesForm = () => {
    const payload = toSeriesPayload(seriesForm)

    if (!payload.code) return 'Series code is required'
    if (!payload.name) return 'Series name is required'
    if (!Number.isInteger(payload.next_number) || payload.next_number < 1) return 'Next number must be greater than 0'
    if (!Number.isInteger(payload.number_length) || payload.number_length < 1) return 'Number length must be greater than 0'

    return ''
  }

  const validateRuleForm = () => {
    const payload = toRulePayload(ruleForm)

    if (!payload.code) return 'Rule code is required'
    if (!payload.name) return 'Rule name is required'
    if (!payload.series_id) return 'Number series is required'
    if (!payload.auto_generate && !payload.manual_entry) return 'Allow auto generation, manual entry, or both'
    if (payload.expiry_days !== null && (!Number.isInteger(payload.expiry_days) || payload.expiry_days < 0)) {
      return 'Expiry days must be 0 or greater'
    }
    if (payload.shelf_life_days !== null && (!Number.isInteger(payload.shelf_life_days) || payload.shelf_life_days < 0)) {
      return 'Shelf life days must be 0 or greater'
    }

    return ''
  }

  const handleSeriesSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const validationError = validateSeriesForm()
    if (validationError) {
      toast.warning(validationError)
      return
    }

    setSavingSeries(true)
    try {
      await saveBatchNumberSeries(toSeriesPayload(seriesForm), editingSeriesId)
      toast.success(editingSeriesId ? 'Batch number series updated' : 'Batch number series created')
      resetSeriesForm()
      await loadData()
    } catch (error) {
      const message = getErrorMessage(error)
      console.warn('Unable to save batch number series:', message)
      toast.error(message.includes('duplicate') || message.includes('batch_number_series_code_key')
        ? 'Series code already exists'
        : message)
    } finally {
      setSavingSeries(false)
    }
  }

  const handleRuleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const validationError = validateRuleForm()
    if (validationError) {
      toast.warning(validationError)
      return
    }

    setSavingRule(true)
    try {
      await saveBatchRule(toRulePayload(ruleForm), editingRuleId)
      toast.success(editingRuleId ? 'Batch rule updated' : 'Batch rule created')
      resetRuleForm()
      await loadData()
    } catch (error) {
      console.error(error)
      const message = getErrorMessage(error)
      toast.error(message.includes('duplicate') || message.includes('batch_rules_code_key')
        ? 'Rule code already exists'
        : 'Unable to save batch rule')
    } finally {
      setSavingRule(false)
    }
  }

  const handleDeleteSeries = async (item: BatchNumberSeries) => {
    if (!window.confirm(`Delete batch number series ${item.code}?`)) return

    try {
      await deleteBatchNumberSeries(item.id)
      toast.success('Batch number series deleted')
      if (editingSeriesId === item.id) resetSeriesForm()
      await loadData()
    } catch (error) {
      console.error(error)
      toast.error('Unable to delete batch number series')
    }
  }

  const handleDeleteRule = async (rule: BatchRule) => {
    if (!window.confirm(`Delete batch rule ${rule.code}?`)) return

    try {
      await deleteBatchRule(rule.id)
      toast.success('Batch rule deleted')
      if (editingRuleId === rule.id) resetRuleForm()
      await loadData()
    } catch (error) {
      console.error(error)
      toast.error('Unable to delete batch rule')
    }
  }

  const startSeriesEdit = (item: BatchNumberSeries) => {
    setEditingSeriesId(item.id)
    setSeriesForm(toSeriesForm(item))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startRuleEdit = (rule: BatchRule) => {
    setEditingRuleId(rule.id)
    setRuleForm(toRuleForm(rule))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openBatchTrail = async (batch: CreatedBatchInventoryRow) => {
    setTrailHeader(batch)
    setTrailRows([])
    setLoadingTrail(true)

    try {
      const rows = await getBatchTransactionTrail(
        batch.itemCode,
        batch.batchNumber,
        batch.warehouseCode || undefined,
      )
      setTrailRows(rows)
    } catch (error) {
      console.error(error)
      toast.error('Unable to load batch transaction trail')
    } finally {
      setLoadingTrail(false)
    }
  }

  return (
    <div className="mt-2 overflow-x-hidden">
      <div className="mx-4 mt-8 flex items-center justify-between">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          FirstPreviewsPageLink="/inv"
          CurrentPageName="Batch Management Setup"
        />
      </div>

      <Separator className="my-2" />

      <div className="mx-4 max-w-full overflow-hidden rounded-lg bg-white p-4">
        <Tabs defaultValue="inventory" className="w-full min-w-0">
          <TabsList className="bg-muted">
            <TabsTrigger value="inventory">
              <PackageSearch className="h-4 w-4" />
              My Batches
            </TabsTrigger>
            <TabsTrigger value="rules">
              <FileSliders className="h-4 w-4" />
              Batch Rules
            </TabsTrigger>
            <TabsTrigger value="series">
              <Hash className="h-4 w-4" />
              Number Series
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="mt-4 min-w-0">
            <div className="mb-4 grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 md:grid-cols-[180px_180px_minmax(220px,320px)]">
              <div className="space-y-2">
                <Label htmlFor="batch-date-from">From Date</Label>
                <Input
                  id="batch-date-from"
                  type="date"
                  value={batchDateFrom}
                  onChange={event => setBatchDateFrom(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch-date-to">To Date</Label>
                <Input
                  id="batch-date-to"
                  type="date"
                  value={batchDateTo}
                  onChange={event => setBatchDateTo(event.target.value)}
                />
              </div>

              <DefaultFarmComboBox
                label="Farm"
                value={batchFarmId}
                valueKey="id"
                setValue={setBatchFarmId}
              />
            </div>

            <DynamicTable
              loading={loading}
              initialFilters={[]}
              title="My Created Batches"
              description="Batches created by your goods receipt activity with current on-hand by warehouse"
              searchPlaceholder="Search batches..."
              emptyMessage="No batches created by your user were found"
              rowKey="id"
              columns={[
                { key: 'batchNumber', label: 'Batch', render: row => (
                  <span className="inline-flex max-w-full items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    <span className="truncate">{row.batchNumber || '-'}</span>
                  </span>
                ) },
                { key: 'item_label', label: 'Item' },
                { key: 'warehouse_label', label: 'Warehouse' },
                { key: 'onHandQty', label: 'On Hand', align: 'right', render: row => (
                  <span className={`font-medium tabular-nums ${Number(row.onHandQty ?? 0) > 0 ? 'text-emerald-700' : 'text-stone-500'}`}>
                    {row.on_hand_label}
                  </span>
                ) },
                { key: 'manufacturingDate', label: 'MFG Date', render: row => formatBatchDate(row.manufacturingDate) },
                { key: 'expiryDate', label: 'EXP Date', render: row => formatBatchDate(row.expiryDate) },
                { key: 'supplier_batch_label', label: 'Supplier Batch' },
                { key: 'status', label: 'Status', render: row => (
                  <span className="inline-flex rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700">
                    {row.status || 'Active'}
                  </span>
                ) },
                { key: 'source_label', label: 'Source' },
                { key: 'created_label', label: 'Created' },
                { key: 'trail', label: '', type: 'button', align: 'right', sortable: false, searchable: false, render: row => (
                  <Button
                    type="button"
                    variant="ghost"
                    title="Show batch transaction trail"
                    onClick={() => openBatchTrail(row)}
                    className="text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                  >
                    <ArrowRightCircle className="h-4 w-4" />
                    <span>Show trail</span>
                  </Button>
                ) },
              ]}
              data={createdBatchRows}
            />
          </TabsContent>

          <TabsContent value="rules" className="mt-4 min-w-0">
            <div className="grid min-w-0 gap-4 xl:grid-cols-[460px_minmax(0,1fr)]">
              <form onSubmit={handleRuleSubmit} className="min-w-0 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3">
                  <div>
                    <h1 className="text-base font-semibold text-stone-950">
                      {editingRuleId ? 'Edit Batch Rule' : 'New Batch Rule'}
                    </h1>
                    <p className="mt-1 text-sm text-stone-500">Rules define how batches are required and issued.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="rule-active" className="text-sm">Active</Label>
                    <Switch
                      id="rule-active"
                      checked={ruleForm.active}
                      onCheckedChange={checked => updateRuleForm('active', checked)}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="rule-code" required>Code</Label>
                      <Input
                        id="rule-code"
                        value={ruleForm.code}
                        onChange={event => updateRuleForm('code', event.target.value.toUpperCase())}
                        placeholder="BATCH-RAW"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rule-name" required>Name</Label>
                      <Input
                        id="rule-name"
                        value={ruleForm.name}
                        onChange={event => updateRuleForm('name', event.target.value)}
                        placeholder="Raw material batches"
                      />
                    </div>
                  </div>

                  <label className="space-y-2 text-sm font-medium text-stone-900">
                    <span>Number Series <span className="text-red-600">*</span></span>
                    <select
                      value={ruleForm.series_id}
                      onChange={event => updateRuleForm('series_id', event.target.value)}
                      className="h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
                    >
                      <option value="">Select series</option>
                      {series.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-2 text-sm font-medium text-stone-900">
                      <span>Item Group</span>
                      <select
                        value={ruleForm.item_group_id}
                        onChange={event => updateRuleForm('item_group_id', event.target.value)}
                        className="h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
                      >
                        <option value="">Any item group</option>
                        {references.itemGroups.map(item => (
                          <option key={item.id} value={item.id}>{optionLabel(item)}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm font-medium text-stone-900">
                      <span>Item</span>
                      <select
                        value={ruleForm.item_id}
                        onChange={event => updateRuleForm('item_id', event.target.value)}
                        className="h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
                      >
                        <option value="">Any item</option>
                        {references.items.map(item => (
                          <option key={item.id} value={item.id}>{optionLabel(item)}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-2 text-sm font-medium text-stone-900">
                      <span>Warehouse</span>
                      <select
                        value={ruleForm.warehouse_id}
                        onChange={event => updateRuleForm('warehouse_id', event.target.value)}
                        className="h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
                      >
                        <option value="">Any warehouse</option>
                        {references.warehouses.map(item => (
                          <option key={item.id} value={item.id}>{optionLabel(item)}</option>
                        ))}
                      </select>
                    </label>

                    <SearchableCombobox
                      label="Farm Code"
                      items={farmOptions}
                      value={ruleForm.branch_id}
                      onValueChange={value => updateRuleForm('branch_id', value)}
                      showCode={false}
                      placeholder={loading ? 'Loading farms...' : 'Any farm'}
                      className="w-full bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-2 text-sm font-medium text-stone-900">
                      <span>Issue Method</span>
                      <select
                        value={ruleForm.issue_method}
                        onChange={event => updateRuleForm('issue_method', event.target.value as BatchIssueMethod)}
                        className="h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
                      >
                        {issueMethods.map(method => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm font-medium text-stone-900">
                      <span>Default Status</span>
                      <select
                        value={ruleForm.default_status}
                        onChange={event => updateRuleForm('default_status', event.target.value as BatchDefaultStatus)}
                        className="h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
                      >
                        {defaultStatuses.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="rule-expiry-days">Expiry Days</Label>
                      <Input
                        id="rule-expiry-days"
                        type="number"
                        min={0}
                        step={1}
                        value={ruleForm.expiry_days}
                        onChange={event => updateRuleForm('expiry_days', event.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rule-shelf-days">Shelf Life Days</Label>
                      <Input
                        id="rule-shelf-days"
                        type="number"
                        min={0}
                        step={1}
                        value={ruleForm.shelf_life_days}
                        onChange={event => updateRuleForm('shelf_life_days', event.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <BoolSwitch id="rule-auto" label="Auto Generate" checked={ruleForm.auto_generate} onChange={checked => updateRuleForm('auto_generate', checked)} />
                    <BoolSwitch id="rule-manual" label="Manual Entry" checked={ruleForm.manual_entry} onChange={checked => updateRuleForm('manual_entry', checked)} />
                    <BoolSwitch id="rule-duplicate" label="Allow Duplicate" checked={ruleForm.allow_duplicate} onChange={checked => updateRuleForm('allow_duplicate', checked)} />
                    <BoolSwitch id="rule-mfg" label="Require MFG Date" checked={ruleForm.require_manufacturing_date} onChange={checked => updateRuleForm('require_manufacturing_date', checked)} />
                    <BoolSwitch id="rule-expiry" label="Require Expiry Date" checked={ruleForm.require_expiry_date} onChange={checked => updateRuleForm('require_expiry_date', checked)} />
                    <BoolSwitch id="rule-supplier" label="Supplier Batch" checked={ruleForm.require_supplier_batch} onChange={checked => updateRuleForm('require_supplier_batch', checked)} />
                    <BoolSwitch id="rule-qc" label="Require QC" checked={ruleForm.require_qc} onChange={checked => updateRuleForm('require_qc', checked)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rule-remarks">Remarks</Label>
                    <Textarea
                      id="rule-remarks"
                      value={ruleForm.remarks}
                      onChange={event => updateRuleForm('remarks', event.target.value)}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={resetRuleForm} disabled={savingRule}>
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button type="submit" disabled={savingRule}>
                    {editingRuleId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {savingRule ? 'Saving...' : editingRuleId ? 'Update Rule' : 'Create Rule'}
                  </Button>
                </div>
              </form>

              <div className="min-w-0">
                <DynamicTable
                  loading={loading}
                  initialFilters={[]}
                  title="Batch Rules"
                  description="Defines where and how batch numbers are used"
                  searchPlaceholder="Search rules..."
                  emptyMessage="No batch rules found"
                  rowKey="id"
                  columns={[
                    { key: 'code', label: 'Code', render: row => (
                      <span className="font-medium text-stone-900">{row.code}</span>
                    ) },
                    { key: 'name', label: 'Name' },
                    { key: 'series_label', label: 'Series' },
                    { key: 'scope_label', label: 'Scope' },
                    { key: 'behavior_label', label: 'Issue / Status' },
                    { key: 'status_label', label: 'Status', render: row => (
                      <StatusBadge active={row.active} label={row.status_label} />
                    ) },
                    { key: 'actions', label: 'Actions', type: 'button', align: 'right', sortable: false, searchable: false, render: row => (
                      <div className="flex justify-end gap-1">
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => startRuleEdit(row)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => handleDeleteRule(row)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    ) },
                  ]}
                  data={ruleRows}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="series" className="mt-4 min-w-0">
            <div className="grid min-w-0 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
              <form onSubmit={handleSeriesSubmit} className="min-w-0 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3">
                  <div>
                    <h1 className="text-base font-semibold text-stone-950">
                      {editingSeriesId ? 'Edit Series' : 'New Series'}
                    </h1>
                    <p className="mt-1 text-sm text-stone-500">
                      Sample: {sampleNumber} using prefix, MFG date{seriesForm.include_expiry_date ? ', EXP date' : ''}, sequence, suffix.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="series-active" className="text-sm">Active</Label>
                    <Switch
                      id="series-active"
                      checked={seriesForm.active}
                      onCheckedChange={checked => updateSeriesForm('active', checked)}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="series-code" required>Code</Label>
                    <Input
                      id="series-code"
                      value={seriesForm.code}
                      onChange={event => updateSeriesForm('code', event.target.value.toUpperCase())}
                      placeholder="BATCH"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="series-name" required>Name</Label>
                    <Input
                      id="series-name"
                      value={seriesForm.name}
                      onChange={event => updateSeriesForm('name', event.target.value)}
                      placeholder="Default batch numbering"
                    />
                  </div>

                  <div className="grid grid-cols-[1fr_96px_1fr] gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="series-prefix">Prefix</Label>
                      <Input id="series-prefix" value={seriesForm.prefix} onChange={event => updateSeriesForm('prefix', event.target.value)} placeholder="BATCH" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="series-separator" required>Separator</Label>
                      <Input id="series-separator" value={seriesForm.separator} maxLength={3} onChange={event => updateSeriesForm('separator', event.target.value)} placeholder="-" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="series-suffix">Suffix</Label>
                      <Input id="series-suffix" value={seriesForm.suffix} onChange={event => updateSeriesForm('suffix', event.target.value)} placeholder="A" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="series-next" required>Next Number</Label>
                      <Input id="series-next" type="number" min={1} step={1} value={seriesForm.next_number} onChange={event => updateSeriesForm('next_number', event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="series-length" required>Number Length</Label>
                      <Input id="series-length" type="number" min={1} step={1} value={seriesForm.number_length} onChange={event => updateSeriesForm('number_length', event.target.value)} />
                    </div>
                  </div>

                  <label htmlFor="series-exclude-expiry" className="flex items-start gap-3 rounded-md border border-stone-200 bg-white px-3 py-3 text-sm">
                    <Checkbox
                      id="series-exclude-expiry"
                      checked={!seriesForm.include_expiry_date}
                      onCheckedChange={checked => updateSeriesForm('include_expiry_date', checked !== true)}
                      className="mt-0.5"
                    />
                    <span className="grid gap-1">
                      <span className="font-medium text-stone-900">Exclude EXP Date from Series</span>
                      <span className="text-xs font-normal text-stone-500">
                        Check when batches can have no expiry date and the batch number should use prefix, MFG date, sequence, and suffix only.
                      </span>
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-2 text-sm font-medium text-stone-900">
                      <span>Reset Type</span>
                      <select value={seriesForm.reset_type} onChange={event => updateSeriesForm('reset_type', event.target.value as BatchResetType)} className="h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200">
                        {resetTypes.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm font-medium text-stone-900">
                      <span>MFG Date Format</span>
                      <select value={seriesForm.date_format} onChange={event => updateSeriesForm('date_format', event.target.value as BatchDateFormat)} className="h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200">
                        {dateFormats.map(format => <option key={format} value={format}>{format}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="series-remarks">Remarks</Label>
                    <Textarea id="series-remarks" value={seriesForm.remarks} onChange={event => updateSeriesForm('remarks', event.target.value)} placeholder="Optional notes" />
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={resetSeriesForm} disabled={savingSeries}>
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button type="submit" disabled={savingSeries}>
                    {editingSeriesId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {savingSeries ? 'Saving...' : editingSeriesId ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>

              <div className="min-w-0">
                <DynamicTable
                  loading={loading}
                  initialFilters={[]}
                  title="Batch Number Series"
                  description="Defines how batch numbers are generated"
                  searchPlaceholder="Search series..."
                  emptyMessage="No batch number series found"
                  rowKey="id"
                  columns={[
                    { key: 'code', label: 'Code' },
                    { key: 'name', label: 'Name' },
                    { key: 'sample_number', label: 'Sample Number' },
                    { key: 'include_expiry_date', label: 'EXP in Series', render: row => row.include_expiry_date === false ? 'Excluded' : 'Included' },
                    { key: 'next_number', label: 'Next', align: 'right' },
                    { key: 'reset_type', label: 'Reset' },
                    { key: 'status_label', label: 'Status', render: row => (
                      <StatusBadge active={row.active} label={row.status_label} />
                    ) },
                    { key: 'actions', label: 'Actions', type: 'button', align: 'right', sortable: false, searchable: false, render: row => (
                      <div className="flex justify-end gap-1">
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => startSeriesEdit(row)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => handleDeleteSeries(row)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    ) },
                  ]}
                  data={seriesRows}
                />

                {!loading && seriesRows.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
                    <ListFilter className="h-4 w-4 shrink-0" />
                    Active series can be selected by batch rules; inactive series remain saved for reference.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog
          open={Boolean(trailHeader)}
          onOpenChange={open => {
            if (open) return
            setTrailHeader(null)
            setTrailRows([])
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Batch Transaction Trail</DialogTitle>
              <DialogDescription>
                {trailHeader
                  ? `${trailHeader.batchNumber} movement history for ${trailHeader.itemCode}${trailHeader.warehouseCode ? ` in ${trailHeader.warehouseCode}` : ''}.`
                  : 'Movement history for the selected batch.'}
              </DialogDescription>
            </DialogHeader>

            {trailHeader && (
              <div className="space-y-4">
                <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs font-medium text-amber-700">Batch</div>
                    <div className="truncate font-semibold text-stone-950">{trailHeader.batchNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-amber-700">Item</div>
                    <div className="truncate font-semibold text-stone-950">{trailHeader.item_label}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-amber-700">Warehouse</div>
                    <div className="font-semibold text-stone-950">{trailHeader.warehouse_label}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-amber-700">Current On Hand</div>
                    <div className="font-semibold tabular-nums text-stone-950">{trailHeader.on_hand_label}</div>
                  </div>
                </div>

                {loadingTrail && (
                  <div className="flex min-h-32 items-center justify-center gap-2 rounded-md border border-dashed border-stone-300 bg-white text-sm text-stone-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading transaction trail...
                  </div>
                )}

                {!loadingTrail && trailRows.length === 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                    No inventory postings were found for this batch.
                  </div>
                )}

                {!loadingTrail && trailRows.length > 0 && (
                  <div className="relative space-y-3 pl-5">
                    <div className="absolute left-[11px] top-2 h-[calc(100%-1rem)] w-px bg-amber-200" />
                    {trailRows.map(row => {
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
                              <div className="text-xs text-stone-500">Movement</div>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-stone-600 sm:grid-cols-5">
                            <div className="rounded-md bg-amber-50 px-2 py-1">
                              <span className="block font-medium text-amber-700">Running Balance</span>
                              <span className="font-semibold tabular-nums text-amber-900">{formatQuantity(row.runningQty)}</span>
                            </div>
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
              </div>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  )
}
