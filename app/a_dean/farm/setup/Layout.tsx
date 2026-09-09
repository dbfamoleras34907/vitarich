'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import SearchableCombobox, { type ComboboxItemType } from '@/components/SearchableCombobox'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Warehouse,
  Clock,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { voidFarm } from '../api'
import {
  createFarmSetup,
  generateNextCode,
  getFarmSetup,
  updateFarmSetup,
  type FarmSetupPayload,
  type FarmSetupWarehouseDraft,
} from './api'

type FormDataMap = Record<string, string>

type FieldConfig = {
  code: string
  label: string
  placeholder?: string
  required?: boolean
  readOnly?: boolean
  type?: string
}

type WarehouseDraft = {
  clientKey: string
  id?: number | null
  hasAutomaticName?: boolean
  data: FormDataMap
}

const FARM_TYPES = [
  { value: 'BE', label: 'Breeder Farm', warehouseType: 'Breeder' },
  { value: 'HA', label: 'Hatcher', warehouseType: 'Hatchery' },
  { value: 'BR', label: 'Broiler', warehouseType: 'Broiler' },
]

const WAREHOUSE_TYPES = [
  { value: 'Warehouse', label: 'Warehouse' },
  { value: 'Building', label: 'Building' },
]

const isPenDraft = (draft: WarehouseDraft) => draft.data.warehouse_type === 'Pen'

const nextDefaultNameNumber = (drafts: WarehouseDraft[], prefix: string) => {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const defaultNamePattern = new RegExp(`^${escapedPrefix} (\\d+)$`)
  const highestDefaultNumber = drafts.reduce((highest, draft) => {
    const match = compact(draft.data.whse_name).match(defaultNamePattern)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)

  return Math.max(drafts.length, highestDefaultNumber) + 1
}

const STEPS = [
  {
    id: 0,
    title: 'Farm Info',
    description: 'Register the farm profile and location.',
  },
  {
    id: 1,
    title: 'Structure',
    description: 'Add the first warehouse or building.',
  },
  {
    id: 2,
    title: 'Review & Launch',
    description: 'Choose defaults and complete setup.',
  },
]

const farmFields: FieldConfig[] = [
  { code: 'code', label: 'Farm Code', readOnly: true, required: true },
  { code: 'name', label: 'Farm Name', placeholder: 'Farm site name', required: true },
  { code: 'tin', label: 'TIN No.', placeholder: 'Registered TIN', required: true },
  { code: 'tel', label: 'Telephone No.', placeholder: 'Site landline', required: true },
  { code: 'contact_person', label: 'Contact Person', placeholder: 'Primary site contact', required: true },
  { code: 'contact_number', label: 'Contact Number', placeholder: 'Mobile or direct line', required: true },
]

const addressFields: FieldConfig[] = [
  { code: 'address', label: 'Address', placeholder: 'Street, sitio, or site address', required: true },
  { code: 'barangay', label: 'Barangay', placeholder: 'Barangay', required: true },
  { code: 'city', label: 'City / Municipality', placeholder: 'City / Municipality', required: true },
  { code: 'province', label: 'Province', placeholder: 'Province', required: true },
]

const warehouseFields: FieldConfig[] = [
  { code: 'whse_name', label: 'Name', placeholder: 'Main Farm Warehouse', required: true },
  { code: 'full_location_code', label: 'Location Code', placeholder: 'SITE-MAIN' },
  { code: 'addr1', label: 'Address Line 1', placeholder: 'Building, street, or site' },
  { code: 'addr2', label: 'Address Line 2', placeholder: 'Zone, barangay, or landmark' },
  { code: 'city', label: 'City', placeholder: 'City / Municipality' },
  { code: 'province', label: 'Province', placeholder: 'Province' },
  { code: 'phone', label: 'Phone', placeholder: 'Landline or site local' },
  { code: 'mobile', label: 'Mobile', placeholder: 'Warehouse contact number' },
]

const compact = (value: unknown) => String(value ?? '').trim()
const warehouseDisplayName = (draft?: WarehouseDraft) => {
  if (!draft) return ''

  const code = compact(draft.data.whse_code)
  const name = compact(draft.data.whse_name)

  if (code && name) return `${code} - ${name}`
  return code || name || 'Unnamed draft'
}
const numericCapacity = (value: unknown) => {
  const text = compact(value)
  return text === '' ? null : Number(text)
}
const nullable = (value: unknown) => {
  const valueText = compact(value)
  return valueText ? valueText : null
}

function TextField({
  field,
  value,
  onChange,
  className,
}: {
  field: FieldConfig
  value: string
  onChange: (code: string, value: string) => void
  className?: string
}) {
  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label htmlFor={field.code} required={field.required} className="text-xs font-semibold text-neutral-950 dark:text-foreground">
        {field.label}
      </Label>
      <Input
        id={field.code}
        type={field.type ?? 'text'}
        value={value}
        placeholder={field.placeholder}
        required={field.required}
        readOnly={field.readOnly}
        className={`h-9 border-neutral-200 bg-white text-sm shadow-none placeholder:text-neutral-400 dark:border-border dark:bg-input/30 dark:placeholder:text-muted-foreground ${
          field.readOnly ? 'bg-neutral-50 font-mono dark:bg-input/20' : ''
        }`}
        onChange={(event) => onChange(field.code, event.target.value)}
      />
    </div>
  )
}

function SectionIntro({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-neutral-950 dark:text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-muted-foreground">{description}</p>
    </div>
  )
}

function CompactStepper({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Farm setup progress" className="flex flex-wrap items-center gap-2">
      {STEPS.map((item) => (
        <React.Fragment key={item.id}>
          {item.id > 0 ? <ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" /> : null}
          <span aria-current={currentStep === item.id ? 'step' : undefined}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs ${currentStep === item.id ? 'bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'text-muted-foreground'}`}>
            <span className={`flex size-5 items-center justify-center rounded-full border ${currentStep >= item.id ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-border'}`}>
              {currentStep > item.id ? <Check className="size-3" aria-label="Completed" /> : item.id + 1}
            </span>
            {item.title}
          </span>
        </React.Fragment>
      ))}
    </nav>
  )
}

function WizardActions({
  step,
  loading,
  onBack,
  onNext,
  onSubmit,
  submitLabel,
  canVoid,
  voiding,
  onVoid,
  summary,
}: {
  step: number
  loading: boolean
  onBack: () => void
  onNext: () => void
  onSubmit: () => void
  submitLabel: string
  canVoid: boolean
  voiding: boolean
  onVoid: () => void
  summary: string
}) {
  return (
    <div className="sticky bottom-0 z-10 flex min-h-14 flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">{summary}</span>
        {canVoid ? (
          <Button type="button" variant="destructive" onClick={onVoid} disabled={loading || voiding} className="h-10 px-4">
            <Trash2 className="size-4" />
            {voiding ? 'Voiding...' : 'Void Farm'}
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" disabled={loading || voiding} onClick={onBack} className="h-10 bg-white px-4 text-neutral-700 dark:bg-secondary dark:text-secondary-foreground">
          <ArrowLeft className="size-4" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={onNext} disabled={loading || voiding} className="h-10 bg-emerald-700 px-5 text-white hover:bg-emerald-800">
            Next
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={loading || voiding}
            className="h-10 bg-emerald-700 px-5 text-white hover:bg-emerald-800"
          >
            <Save className="size-4" />
            {loading ? 'Submitting...' : submitLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

function InlineSelect({
  label,
  required,
  disabled,
  value,
  placeholder,
  onValueChange,
  children,
}: {
  label: string
  required?: boolean
  disabled?: boolean
  value: string
  placeholder: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}) {
  const id = React.useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required} className="text-xs font-semibold text-neutral-950 dark:text-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id} aria-required={required} className="data-[size=default]:h-9 w-full border-neutral-200 bg-white text-sm shadow-none dark:border-border dark:bg-input/30">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  )
}

function ApprovalNotice() {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 size-4 shrink-0" />
        <div>
          <div className="font-medium">Approval may be required</div>
          <p className="mt-1 text-xs leading-5">
            If your user is included in the Farm Setup Wizard trigger, this setup will be created as pending first. It becomes approved only after the approval request is completed.
          </p>
        </div>
      </div>
    </div>
  )
}

function StructureWorkspace({
  drafts, address, locationPreview, selectedKey, onSelect, onAdd, onAddPen, onUpdate, onRemove, disabled, assignment,
}: {
  drafts: WarehouseDraft[]
  address: FormDataMap
  locationPreview: string
  selectedKey: string
  onSelect: (key: string) => void
  onAdd: (type: 'Warehouse' | 'Building') => void
  onAddPen: (key: string) => void
  onUpdate: (key: string, code: string, value: string) => void
  onRemove: (key: string) => void
  disabled: boolean
  assignment: React.ReactNode
}) {
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())
  const [customAddressKeys, setCustomAddressKeys] = useState<Set<string>>(new Set())
  const [showMobileEditor, setShowMobileEditor] = useState(false)
  const structures = drafts.filter((draft) => !isPenDraft(draft))
  const selected = structures.find((draft) => draft.clientKey === selectedKey) ?? structures[0]
  const selectedPens = selected ? drafts.filter((pen) => isPenDraft(pen) && pen.data.father_client_key === selected.clientKey) : []
  const addressPairs = [['addr1', 'address'], ['addr2', 'barangay'], ['city', 'city'], ['province', 'province']]
  const usesFarmAddress = !!selected && !customAddressKeys.has(selected.clientKey) && addressPairs.every(([structureField, farmField]) => compact(selected.data[structureField]) === compact(address[farmField]))

  const selectStructure = (key: string, penKey?: string) => {
    onSelect(key)
    setShowMobileEditor(true)
    if (penKey) requestAnimationFrame(() => document.getElementById(`pen-name-${penKey}`)?.focus())
  }
  const addPen = (key: string) => {
    onAddPen(key)
    selectStructure(key)
    setCollapsedKeys((prev) => { const next = new Set(prev); next.delete(key); return next })
  }
  const field = (code: string) => {
    const config = warehouseFields.find((item) => item.code === code)!
    return <TextField key={code} field={config} value={selected.data[code] ?? ''} onChange={(fieldCode, value) => onUpdate(selected.clientKey, fieldCode, value)} />
  }

  return (
    <div className="grid min-w-0 md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[390px_minmax(0,1fr)]">
      <aside aria-label="Farm structures" className={`${showMobileEditor && selected ? 'hidden md:block' : ''} min-w-0 border-border bg-muted/20 md:border-r`}>
        <div className="space-y-3 border-b border-border p-3">
          <div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-wide">Structures</h2><span className="text-xs text-muted-foreground">{structures.length} total</span></div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => { onAdd('Warehouse'); setShowMobileEditor(true) }}><Plus className="size-3.5" /> Warehouse</Button>
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => { onAdd('Building'); setShowMobileEditor(true) }}><Plus className="size-3.5" /> Building</Button>
          </div>
        </div>
        {assignment}
        <div className="p-2 md:max-h-[65vh] md:overflow-y-auto">
          {structures.length === 0 ? <div className="px-2 py-5 text-xs text-muted-foreground">No structures yet. Add a warehouse or building to get started.</div> : null}
          <ul className="space-y-1">
            {structures.map((draft) => {
              const isBuilding = draft.data.warehouse_type === 'Building'
              const expanded = !collapsedKeys.has(draft.clientKey)
              const pens = drafts.filter((pen) => isPenDraft(pen) && pen.data.father_client_key === draft.clientKey)
              const active = selected?.clientKey === draft.clientKey
              const Icon = isBuilding ? Building2 : Warehouse
              return (
                <li key={draft.clientKey}>
                  <div className={`flex items-center rounded-md border ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100' : 'border-transparent hover:bg-muted'}`}>
                    {isBuilding ? <button type="button" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${draft.data.whse_name || 'building'}`} aria-expanded={expanded} aria-controls={`pens-${draft.clientKey}`} className="flex size-7 shrink-0 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-emerald-600" onClick={() => setCollapsedKeys((prev) => { const next = new Set(prev); if (next.has(draft.clientKey)) next.delete(draft.clientKey); else next.add(draft.clientKey); return next })}>
                      {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </button> : <span className="w-7 shrink-0" />}
                    <button type="button" aria-pressed={active} className="flex min-w-0 flex-1 items-start gap-2 rounded py-2 pr-2 text-left focus-visible:outline-2 focus-visible:outline-emerald-600" onClick={() => selectStructure(draft.clientKey)}>
                      <Icon className="mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium" title={draft.data.whse_name}>{draft.data.whse_name || 'Unnamed warehouse'}</span>
                        <span className="block truncate text-[11px] text-muted-foreground" title={draft.data.full_location_code}>{draft.data.full_location_code || draft.data.whse_code || 'Code on save'} · {draft.data.fms_type}</span>
                      </span>
                      <span className="pt-0.5 text-[10px] text-muted-foreground">{draft.data.warehouse_type}</span>
                    </button>
                  </div>
                  {isBuilding && expanded ? (
                    <ul id={`pens-${draft.clientKey}`} className="my-1 ml-7 border-l border-border pl-2">
                      {pens.map((pen) => <li key={pen.clientKey}><button type="button" className="w-full truncate rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-emerald-600" onClick={() => selectStructure(draft.clientKey, pen.clientKey)}>{pen.data.whse_name || 'Unnamed pen'}</button></li>)}
                      <li><button type="button" onClick={() => addPen(draft.clientKey)} className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-muted focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300"><Plus className="size-3" /> Add Pen</button></li>
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
      <section aria-label="Selected structure" className={`${!showMobileEditor ? 'hidden md:block' : ''} min-w-0 p-4`}>
        {selected ? (
          <div className="space-y-4">
            <Button type="button" variant="ghost" size="sm" className="md:hidden" onClick={() => setShowMobileEditor(false)}><ArrowLeft className="size-3.5" /> Structure List</Button>
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-sm font-semibold">{selected.data.warehouse_type} Configuration</h2><p className="mt-1 text-xs text-muted-foreground">Changes stay in this setup until you save the farm.</p></div>
              <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(selected.clientKey)} className="text-destructive"><Trash2 className="size-3.5" /> Remove</Button>
            </div>
            <div key={selected.clientKey} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <InlineSelect label="Structure Type" required disabled={selectedPens.length > 0} value={selected.data.warehouse_type ?? 'Warehouse'} placeholder="Select structure type" onValueChange={(value) => onUpdate(selected.clientKey, 'warehouse_type', value)}>
                {WAREHOUSE_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
              </InlineSelect>
              {field('whse_name')}
              {field('full_location_code')}
              <TextField field={{ code: 'fms_type', label: 'FMS Type', readOnly: true }} value={selected.data.fms_type ?? ''} onChange={() => undefined} />
              {field('phone')}
              {field('mobile')}
              {selected.data.warehouse_type === 'Building' ? <TextField field={{ code: 'capacity', label: 'Building Capacity', type: 'number' }} value={selected.data.capacity ?? ''} onChange={(code, value) => onUpdate(selected.clientKey, code, value)} /> : null}
            </div>
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <label className="flex shrink-0 items-center gap-2 text-xs font-medium">
                  <input type="checkbox" className="size-4 accent-emerald-700" checked={usesFarmAddress} onChange={(event) => {
                    const checked = event.target.checked
                    setCustomAddressKeys((prev) => { const next = new Set(prev); if (checked) next.delete(selected.clientKey); else next.add(selected.clientKey); return next })
                    if (checked) addressPairs.forEach(([structureField, farmField]) => onUpdate(selected.clientKey, structureField, address[farmField] ?? ''))
                  }} /> Use Farm Address
                </label>
                {usesFarmAddress ? <span className="text-xs text-muted-foreground">{locationPreview || 'No farm address entered.'}</span> : null}
              </div>
              {!usesFarmAddress ? <div className="grid gap-3 sm:grid-cols-2">{field('addr1')}{field('addr2')}{field('city')}{field('province')}</div> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`remarks-${selected.clientKey}`} className="text-xs font-semibold">Remarks</Label>
              <Textarea id={`remarks-${selected.clientKey}`} value={selected.data.remarks ?? ''} placeholder="Structure notes" className="min-h-16 text-sm shadow-none" onChange={(event) => onUpdate(selected.clientKey, 'remarks', event.target.value)} />
            </div>
            {selected.data.warehouse_type === 'Building' ? (
              <section className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide">Pens <span className="ml-2 font-normal text-muted-foreground">{selectedPens.length} Pens</span></h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => addPen(selected.clientKey)}><Plus className="size-3.5" /> Add Pen</Button>
                </div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[470px] text-left text-xs">
                    <thead className="border-b border-border bg-muted/50 text-muted-foreground"><tr><th className="w-8 px-2 py-2">#</th><th className="px-2 py-2">Pen Name <span className="text-destructive">*</span></th><th className="px-2 py-2">Pen Code</th><th className="w-28 px-2 py-2">Capacity <span className="text-destructive">*</span></th><th className="w-9"><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>
                      {selectedPens.map((pen, index) => <tr key={pen.clientKey} className="border-b border-border last:border-0">
                        <td className="px-2 text-muted-foreground">{index + 1}</td>
                        <td className="p-1"><Input id={`pen-name-${pen.clientKey}`} aria-label={`Pen ${index + 1} name`} required value={pen.data.whse_name ?? ''} className="h-9 min-w-28 text-xs shadow-none" onChange={(event) => onUpdate(pen.clientKey, 'whse_name', event.target.value)} /></td>
                        <td className="px-2 font-mono text-[11px] text-muted-foreground">{pen.data.whse_code || `${selected.data.whse_code || 'Building code'}-P${index + 1}`}</td>
                        <td className="p-1"><Input aria-label={`Pen ${index + 1} capacity`} type="number" required value={pen.data.capacity ?? ''} className="h-9 text-xs shadow-none" onChange={(event) => onUpdate(pen.clientKey, 'capacity', event.target.value)} /></td>
                        <td className="p-1"><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${pen.data.whse_name || `pen ${index + 1}`}`} onClick={() => onRemove(pen.clientKey)}><Trash2 className="size-3.5 text-destructive" /></Button></td>
                      </tr>)}
                      {!selectedPens.length ? <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No pens. Add pens if this building needs them.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted-foreground">Pen codes are generated from the building code on save.{selectedPens.length > 0 ? ` Total pen capacity: ${selectedPens.reduce((sum, pen) => sum + (Number(pen.data.capacity) || 0), 0)} / ${selected.data.capacity || 'Not set'} building capacity.` : ''}</p>
              </section>
            ) : null}
          </div>
        ) : <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center text-muted-foreground"><Building2 className="size-7" /><p className="text-sm">Add a structure to configure its details.</p><p className="text-xs">Buildings can contain pens. Warehouses stand on their own.</p></div>}
      </section>
    </div>
  )
}

export default function Layout() {
  const router = useRouter()
  const params = useParams<{ farmid?: string }>()
  const farmId = Number(params?.farmid ?? 0)
  const isEditMode = Number.isFinite(farmId) && farmId > 0
  const canVoid = !usePermission('/a_dean/farm/void')
  const [step, setStep] = useState(0)
  const [selectedStructureKey, setSelectedStructureKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingFarm, setLoadingFarm] = useState(isEditMode)
  const [voiding, setVoiding] = useState(false)
  const [farmData, setFarmData] = useState<FormDataMap>({})
  const [addressData, setAddressData] = useState<FormDataMap>({})
  const [warehouseDrafts, setWarehouseDrafts] = useState<WarehouseDraft[]>([])
  const [warehouseCatalog, setWarehouseCatalog] = useState<WarehouseDraft[]>([])
  const [existingStructureKeys, setExistingStructureKeys] = useState<string[]>([])
  const [defaultFeedKey, setDefaultFeedKey] = useState('')
  const [defaultReceivingKey, setDefaultReceivingKey] = useState('')
  const [defaultDisposalKey, setDefaultDisposalKey] = useState('')

  const selectedFarmType = FARM_TYPES.find((type) => type.value === farmData.farm_type)
  const defaultWarehouseOptions: ComboboxItemType[] = useMemo(
    () =>
      warehouseDrafts
        .filter((draft) => !isPenDraft(draft))
        .map((draft) => {
          const name = compact(draft.data.whse_name) || 'Unnamed warehouse'
          const code = compact(draft.data.whse_code)

          return {
            code: draft.clientKey,
            name: code ? `${code} - ${name}` : name,
          }
        }),
    [warehouseDrafts]
  )
  const assignableStructureOptions: ComboboxItemType[] = useMemo(() => {
    const assignedIds = new Set(
      warehouseDrafts.map((draft) => draft.id).filter((id): id is number => id != null)
    )
    const requiredFmsType = selectedFarmType?.warehouseType ?? ''

    return warehouseCatalog
      .filter(
        (draft) =>
          draft.id != null &&
          !assignedIds.has(draft.id) &&
          !isPenDraft(draft) &&
          draft.data.fms_type === requiredFmsType
      )
      .map((draft) => {
        const code = compact(draft.data.whse_code)
        const name = compact(draft.data.whse_name) || 'Unnamed structure'
        const type = compact(draft.data.warehouse_type) || 'Warehouse'

        return {
          code: draft.clientKey,
          name: `${code ? `${code} - ` : ''}${name} (${type})`,
        }
      })
  }, [selectedFarmType?.warehouseType, warehouseCatalog, warehouseDrafts])
  const locationPreview = useMemo(
    () =>
      [addressData.address, addressData.barangay, addressData.city, addressData.province]
        .map(compact)
        .filter(Boolean)
        .join(', '),
    [addressData.address, addressData.barangay, addressData.city, addressData.province]
  )

  const addWarehouseDraft = (type: 'Warehouse' | 'Building' = 'Warehouse') => {
    const clientKey = `warehouse-${Date.now()}`
    setSelectedStructureKey(clientKey)
    setWarehouseDrafts((prev) => [
      ...prev,
      {
        clientKey,
        hasAutomaticName: type === 'Building',
        data: {
          whse_name: type === 'Building' ? `Building ${nextDefaultNameNumber(prev.filter((draft) => draft.data.warehouse_type === 'Building'), 'Building')}` : '',
          fms_type: selectedFarmType?.warehouseType ?? 'Broiler',
          warehouse_type: type,
          addr1: addressData.address ?? '',
          addr2: addressData.barangay ?? '',
          city: addressData.city ?? '',
          province: addressData.province ?? '',
        },
      },
    ])
  }

  const addPenDraft = (buildingClientKey: string) => {
    setWarehouseDrafts((prev) => {
      const buildingPens = prev.filter(
        (draft) => isPenDraft(draft) && draft.data.father_client_key === buildingClientKey
      )
      const penNumber = nextDefaultNameNumber(buildingPens, 'Pen')

      return [
        ...prev,
        {
          clientKey: `pen-${Date.now()}`,
          data: {
            whse_name: `Pen ${penNumber}`,
            fms_type: selectedFarmType?.warehouseType ?? 'Broiler',
            warehouse_type: 'Pen',
            father_client_key: buildingClientKey,
          },
        },
      ]
    })
  }

  const updateFarm = (code: string, value: string) => {
    setFarmData((prev) => ({ ...prev, [code]: value }))

    if (code === 'farm_type') {
      const nextType = FARM_TYPES.find((type) => type.value === value)?.warehouseType ?? ''
      setExistingStructureKeys([])
      setWarehouseDrafts((prev) =>
        prev.map((draft) => ({ ...draft, data: { ...draft.data, fms_type: nextType } }))
      )
    }
  }

  const updateWarehouse = (clientKey: string, code: string, value: string) => {
    setWarehouseDrafts((prev) =>
      prev.map((draft) => {
        if (draft.clientKey !== clientKey) return draft

        if (code === 'warehouse_type') {
          if (value === 'Building' && !compact(draft.data.whse_name)) {
            const buildings = prev.filter(
              (item) => item.clientKey !== clientKey && item.data.warehouse_type === 'Building'
            )
            const buildingNumber = nextDefaultNameNumber(buildings, 'Building')

            return {
              ...draft,
              hasAutomaticName: true,
              data: { ...draft.data, warehouse_type: value, whse_name: `Building ${buildingNumber}` },
            }
          }

          if (value === 'Warehouse' && draft.hasAutomaticName) {
            return {
              ...draft,
              hasAutomaticName: false,
              data: { ...draft.data, warehouse_type: value, whse_name: '' },
            }
          }
        }

        return {
          ...draft,
          hasAutomaticName: code === 'whse_name' ? false : draft.hasAutomaticName,
          data: { ...draft.data, [code]: value },
        }
      })
    )
  }

  const removeWarehouse = (clientKey: string) => {
    const draft = warehouseDrafts.find((item) => item.clientKey === clientKey)
    if (!draft) return
    const penCount = warehouseDrafts.filter((item) => isPenDraft(item) && item.data.father_client_key === clientKey).length
    const message = penCount
      ? `"${draft.data.whse_name || 'This building'}" contains ${penCount} pens. Removing this building will also remove its pens from this setup.`
      : `Remove "${draft.data.whse_name || draft.data.warehouse_type}" from this setup?`
    if (!window.confirm(`${message}\n\nChanges take effect when you ${isEditMode ? 'save the farm' : 'create the farm'}.`)) return
    setWarehouseDrafts((prev) =>
      prev.filter(
        (draft) => draft.clientKey !== clientKey && draft.data.father_client_key !== clientKey
      )
    )

    if (defaultFeedKey === clientKey) setDefaultFeedKey('')
    if (defaultReceivingKey === clientKey) setDefaultReceivingKey('')
    if (defaultDisposalKey === clientKey) setDefaultDisposalKey('')
  }

  const validateFarmStep = () => {
    // Older farms store their location as one combined address and may predate
    // some of the newer required profile fields. Editing must not force users to
    // manufacture missing address segments just to manage warehouse assignments.
    const requiredFarmFields = isEditMode
      ? farmFields.filter((field) => ['code', 'name'].includes(field.code))
      : farmFields
    const requiredAddressFields = isEditMode
      ? addressFields.filter((field) => ['address', 'province'].includes(field.code))
      : addressFields
    const missingFarm = requiredFarmFields.filter(
      (field) => field.required && !compact(farmData[field.code])
    )
    const missingAddress = requiredAddressFields.filter(
      (field) => field.required && !compact(addressData[field.code])
    )

    if (missingFarm.length || missingAddress.length || !compact(farmData.farm_type)) {
      const missingLabels = [
        ...missingFarm.map((field) => field.label),
        ...missingAddress.map((field) => field.label),
        ...(!compact(farmData.farm_type) ? ['Farm Type'] : []),
      ]
      toast.error(`Complete the following before continuing: ${missingLabels.join(', ')}.`)
      return false
    }

    return true
  }

  const validateWarehouseStep = () => {
    if (warehouseDrafts.length === 0) {
      toast.error('Add at least one warehouse or building for the farm.')
      return false
    }

    if (warehouseDrafts.some((draft) => !compact(draft.data.whse_name))) {
      toast.error('Every warehouse or building needs a name.')
      return false
    }
    if (
      warehouseDrafts.some(
        (draft) =>
          isPenDraft(draft) &&
          !warehouseDrafts.some(
            (building) =>
              building.clientKey === draft.data.father_client_key &&
              building.data.warehouse_type === 'Building'
          )
      )
    ) {
      toast.error('Every pen must belong to a building.')
      return false
    }

    for (const building of warehouseDrafts.filter(
      (draft) => draft.data.warehouse_type === 'Building'
    )) {
      const pens = warehouseDrafts.filter(
        (draft) => isPenDraft(draft) && draft.data.father_client_key === building.clientKey
      )

      // A standalone building has no capacity-matching rule.
      if (pens.length === 0) continue

      const buildingCapacity = numericCapacity(building.data.capacity)
      const penCapacities = pens.map((pen) => numericCapacity(pen.data.capacity))

      if (
        buildingCapacity === null ||
        !Number.isFinite(buildingCapacity) ||
        buildingCapacity < 0 ||
        penCapacities.some(
          (capacity) => capacity === null || !Number.isFinite(capacity) || capacity < 0
        )
      ) {
        toast.error(`Enter valid capacities for ${building.data.whse_name || 'the building'} and all of its pens.`)
        return false
      }

      const totalPenCapacity = penCapacities.reduce<number>(
        (total, capacity) => total + (capacity ?? 0),
        0
      )

      if (Math.abs(totalPenCapacity - buildingCapacity) > 0.000001) {
        toast.error(
          `Pen capacity total (${totalPenCapacity}) must equal the capacity of ${building.data.whse_name || 'the building'} (${buildingCapacity}).`
        )
        return false
      }
    }

    return true
  }

  const goNext = () => {
    if (loadingFarm) return
    if (step === 0 && !validateFarmStep()) return
    if (step === 1 && !validateWarehouseStep()) return

    setStep((prev) => Math.min(prev + 1, STEPS.length - 1))
  }

  const goBack = () => {
    if (step === 0) {
      router.push('/a_dean/farm')
      return
    }

    setStep((prev) => Math.max(prev - 1, 0))
  }

  const buildWarehousePayload = (draft: WarehouseDraft): FarmSetupWarehouseDraft => {
    const address = [draft.data.addr1, draft.data.addr2, draft.data.city, draft.data.province]
      .map(compact)
      .filter(Boolean)
      .join(', ')

    return {
      id: draft.id ?? null,
      client_key: draft.clientKey,
      father_client_key: nullable(draft.data.father_client_key),
      whse_name: nullable(draft.data.whse_name),
      fms_type: nullable(draft.data.fms_type),
      warehouse_type: nullable(draft.data.warehouse_type),
      capacity: numericCapacity(draft.data.capacity),
      full_location_code: nullable(draft.data.full_location_code),
      addr1: nullable(draft.data.addr1),
      addr2: nullable(draft.data.addr2),
      city: nullable(draft.data.city),
      province: nullable(draft.data.province),
      address: address || null,
      phone: nullable(draft.data.phone),
      mobile: nullable(draft.data.mobile),
      remarks: nullable(draft.data.remarks),
      is_active: true,
      is_default_feed: draft.clientKey === defaultFeedKey,
      is_default_receiving: draft.clientKey === defaultReceivingKey,
      is_default_disposal: draft.clientKey === defaultDisposalKey,
    }
  }

  const handleSubmit = async () => {
    if (!validateFarmStep() || !validateWarehouseStep()) return

    if (!defaultFeedKey || !defaultReceivingKey || !defaultDisposalKey) {
      toast.error('Select the default feed, receiving, and disposal warehouses before saving.')
      return
    }

    setLoading(true)

    try {
      const payload: FarmSetupPayload = {
        farm: farmData,
        address: addressData,
        warehouses: [
          ...warehouseDrafts.filter((draft) => !isPenDraft(draft)),
          ...warehouseDrafts.filter(isPenDraft),
        ].map(buildWarehousePayload),
        machines: [],
      }

      if (isEditMode) {
        await updateFarmSetup(farmId, payload)
        toast.success('Farm updated successfully.')
        router.push(
          compact(farmData.farm_type).toUpperCase() === 'BR'
            ? `/brd/settings/farm-setup?farmId=${farmId}`
            : '/a_dean/farm'
        )
        return
      }

      const result = await createFarmSetup(payload)

      if (result.approval?.required) {
        toast.success(`Farm setup created as pending approval. Request #${result.approval.request_id ?? ''}`)
        router.push(
          compact(farmData.farm_type).toUpperCase() === 'BR' && result.farmId
            ? `/brd/settings/farm-setup?farmId=${result.farmId}`
            : '/a_dean/farm'
        )
        return
      }

      if (!result.farmId) {
        throw new Error('Farm setup did not return a farm id.')
      }

      toast.success('Farm setup completed.')
      router.push(
        compact(farmData.farm_type).toUpperCase() === 'BR'
          ? `/brd/settings/farm-setup?farmId=${result.farmId}`
          : `/a_dean/farm/${result.farmId}/edit`
      )
    } catch (error) {
      toast.error('Error: ' + (error instanceof Error ? error.message : 'Unable to complete farm setup'))
    } finally {
      setLoading(false)
    }
  }

  const addExistingStructures = () => {
    if (existingStructureKeys.length === 0) return

    const selectedKeySet = new Set(existingStructureKeys)
    const structures = warehouseCatalog.filter(
      (draft) =>
        selectedKeySet.has(draft.clientKey) &&
        !isPenDraft(draft) &&
        compact(draft.data.fms_type) === selectedFarmType?.warehouseType
    )
    const buildingKeySet = new Set(
      structures
        .filter((draft) => draft.data.warehouse_type === 'Building')
        .map((draft) => draft.clientKey)
    )
    const relatedPens = warehouseCatalog.filter(
      (draft) => isPenDraft(draft) && buildingKeySet.has(draft.data.father_client_key)
    )

    setWarehouseDrafts((prev) => {
      const selectedIds = new Set(
        prev.map((draft) => draft.id).filter((id): id is number => id != null)
      )
      const additions = [...structures, ...relatedPens].filter((draft) => {
        if (draft.id == null || selectedIds.has(draft.id)) return false
        selectedIds.add(draft.id)
        return true
      })

      return [...prev, ...additions]
    })
    if (structures[0]) setSelectedStructureKey(structures[0].clientKey)
    setExistingStructureKeys([])
  }

  const handleVoid = async () => {
    if (!isEditMode || !canVoid || voiding) return

    const code = compact(farmData.code)
    const name = compact(farmData.name)
    const confirmed = window.confirm(
      `Void farm "${[code, name].filter(Boolean).join(' - ')}"? The farm will no longer appear in farm lists.`,
    )
    if (!confirmed) return

    setVoiding(true)
    try {
      await voidFarm(farmId)
      toast.success('Farm voided successfully.')
      router.push('/a_dean/farm')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to void farm.')
    } finally {
      setVoiding(false)
    }
  }

  const loadFarm = useCallback(async () => {
    try {
      if (isEditMode) {
        const record = await getFarmSetup(farmId)
        setFarmData(record.farm)
        setAddressData(record.address)
        setWarehouseDrafts(
          record.warehouses.map((warehouse) => ({
            id: warehouse.id,
            clientKey: warehouse.client_key,
            data: Object.fromEntries(
              Object.entries(warehouse).map(([key, value]) => [key, String(value ?? '')])
            ),
          }))
        )
        setWarehouseCatalog(
          [...record.warehouses, ...record.assignableWarehouses].map((warehouse) => ({
            id: warehouse.id,
            clientKey: warehouse.client_key,
            data: Object.fromEntries(
              Object.entries(warehouse).map(([key, value]) => [key, String(value ?? '')])
            ),
          }))
        )
        setDefaultFeedKey(
          record.warehouses.find((warehouse) => warehouse.is_default_feed)?.client_key ?? ''
        )
        setDefaultReceivingKey(
          record.warehouses.find((warehouse) => warehouse.is_default_receiving)?.client_key ?? ''
        )
        setDefaultDisposalKey(
          record.warehouses.find((warehouse) => warehouse.is_default_disposal)?.client_key ?? ''
        )
        return
      }

      const code = await generateNextCode('v_last_farm_code', 'FRM', 6)
      setFarmData((prev) => ({ ...prev, code }))
    } catch (error) {
      toast.error(error instanceof Error
        ? error.message
        : isEditMode ? 'Unable to load farm.' : 'Unable to generate farm code.')
    } finally {
      setLoadingFarm(false)
    }
  }, [farmId, isEditMode])

  useEffect(() => {
    router.prefetch('/a_dean/farm')
    loadFarm()
  }, [loadFarm, router])

  const structures = warehouseDrafts.filter((draft) => !isPenDraft(draft))
  const summary = `${structures.filter((draft) => draft.data.warehouse_type === 'Building').length} Buildings · ${structures.filter((draft) => draft.data.warehouse_type === 'Warehouse').length} Warehouses · ${warehouseDrafts.filter(isPenDraft).length} Pens`
  const farmField = (code: string) => {
    const field = farmFields.find((item) => item.code === code)!
    return <TextField key={code} field={field} value={farmData[code] ?? ''} onChange={updateFarm} />
  }

  return (
    <div className="min-h-full bg-muted/30 p-3 md:p-4">
      <main className="mx-auto flex w-full max-w-[1400px] flex-col rounded-lg border border-border bg-card text-foreground shadow-sm">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-base font-semibold">Farm Setup</h1>
            <span className="text-xs text-muted-foreground">{farmData.code || 'New Farm'}{selectedFarmType ? ` · ${selectedFarmType.label}` : ''}</span>
          </div>
          <CompactStepper currentStep={step} />
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/a_dean/farm')}>
            <ArrowLeft className="size-3.5" /> Farm List
          </Button>
        </header>
        {loadingFarm ? <div role="status" className="p-6 text-sm text-muted-foreground">Loading farm details...</div> : (
          <div className="min-w-0 flex-1">
            {step === 0 ? (
              <div className="space-y-5 p-4">
                <SectionIntro title="Farm Information" description="Enter the farm profile and contact details." />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {farmField('code')}
                  {farmField('name')}
                  <InlineSelect label="Farm Type" required value={farmData.farm_type ?? ''} placeholder="Select farm type" onValueChange={(value) => updateFarm('farm_type', value)}>
                    {FARM_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                  </InlineSelect>
                  {farmField('tin')}
                  {farmField('contact_person')}
                  {farmField('contact_number')}
                  {farmField('tel')}
                </div>
                <section className="space-y-3 border-t border-border pt-4">
                  <SectionIntro title="Farm Location" description="The farm address is used as the initial address for new structures." />
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {addressFields.map((field) => <TextField key={field.code} field={field} value={addressData[field.code] ?? ''} onChange={(code, value) => setAddressData((prev) => ({ ...prev, [code]: value }))} />)}
                  </div>
                  <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <MapPin className="size-4 shrink-0" aria-label="Address preview" />
                    {locationPreview || 'Address preview appears here.'}
                  </div>
                </section>
              </div>
            ) : null}
            {step === 1 ? (
              <StructureWorkspace
                drafts={warehouseDrafts} address={addressData} locationPreview={locationPreview}
                selectedKey={selectedStructureKey} onSelect={setSelectedStructureKey}
                onAdd={addWarehouseDraft} onAddPen={addPenDraft} onUpdate={updateWarehouse} onRemove={removeWarehouse}
                disabled={!farmData.farm_type}
                assignment={isEditMode ? (
                  <div className="space-y-2 border-b border-border p-3">
                    <SearchableCombobox multiple label="Use Existing Warehouse / Building" items={assignableStructureOptions}
                      value={existingStructureKeys} onValueChange={setExistingStructureKeys}
                      placeholder="Select unassigned structures..." disabled={!farmData.farm_type || assignableStructureOptions.length === 0} className="w-full" />
                    <Button type="button" variant="secondary" size="sm" onClick={addExistingStructures} disabled={existingStructureKeys.length === 0}>
                      <Plus className="size-3.5" /> Use Structures
                    </Button>
                    {assignableStructureOptions.length === 0 ? <p className="text-xs text-muted-foreground">No unassigned structures match this farm type.</p> : null}
                  </div>
                ) : null}
              />
            ) : null}
            {step === 2 ? (
              <div className="space-y-5 p-4">
                <SectionIntro title={isEditMode ? 'Review & Save' : 'Review & Launch'} description="Review the farm and structures, then confirm the warehouse defaults." />
                <section className="rounded-md border border-border">
                  <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                    <h2 className="text-sm font-semibold">Farm Information & Location</h2>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setStep(0)}>Edit</Button>
                  </div>
                  <dl className="grid gap-3 p-3 text-sm md:grid-cols-3">
                    <div><dt className="text-xs text-muted-foreground">Farm</dt><dd className="mt-1 font-medium">{farmData.name}</dd><dd className="text-xs text-muted-foreground">{farmData.code} · {selectedFarmType?.label}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Location</dt><dd className="mt-1">{locationPreview || 'Not set'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Contact</dt><dd className="mt-1">{farmData.contact_person || 'Not set'}</dd><dd className="text-xs text-muted-foreground">{[farmData.contact_number, farmData.tel].filter(Boolean).join(' · ')}</dd></div>
                  </dl>
                </section>
                <section className="rounded-md border border-border">
                  <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                    <h2 className="text-sm font-semibold">Structures <span className="ml-2 text-xs font-normal text-muted-foreground">{summary}</span></h2>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>Edit</Button>
                  </div>
                  {structures.map((draft) => {
                    const pens = warehouseDrafts.filter((pen) => isPenDraft(pen) && pen.data.father_client_key === draft.clientKey)
                    return (
                      <details key={draft.clientKey} open className="border-b border-border last:border-b-0">
                        <summary className="cursor-pointer px-3 py-2 text-sm">
                          <span className="font-medium">{warehouseDisplayName(draft)}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{draft.data.warehouse_type} · {draft.data.fms_type}{draft.data.full_location_code ? ` · ${draft.data.full_location_code}` : ''}</span>
                          <span className="ml-2 inline-flex flex-wrap gap-1">
                            {draft.clientKey === defaultFeedKey ? <Badge variant="outline">Feed</Badge> : null}
                            {draft.clientKey === defaultReceivingKey ? <Badge variant="outline">Receiving</Badge> : null}
                            {draft.clientKey === defaultDisposalKey ? <Badge variant="outline">Disposal</Badge> : null}
                          </span>
                        </summary>
                        {pens.length ? <ul className="mb-2 ml-7 border-l border-border text-xs">{pens.map((pen, index) => <li key={pen.clientKey} className="flex flex-wrap justify-between gap-2 px-3 py-1.5"><span>{pen.data.whse_name} <span className="ml-2 text-muted-foreground">{pen.data.whse_code || `${draft.data.whse_code || 'Building code'}-P${index + 1}`}</span></span><span className="text-muted-foreground">Capacity: {pen.data.capacity || 'Not set'}</span></li>)}</ul> : <p className="pb-2 pl-7 text-xs text-muted-foreground">{draft.data.warehouse_type === 'Building' ? 'No pens configured.' : 'Warehouse'}</p>}
                      </details>
                    )
                  })}
                </section>
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold">Default Warehouses</h2>
                  <div className="grid gap-3 md:grid-cols-3">
                    <SearchableCombobox label="Default Feed Warehouse" items={defaultWarehouseOptions} required value={defaultFeedKey} placeholder="Select default feed warehouse..." onValueChange={setDefaultFeedKey} className="w-full" />
                    <SearchableCombobox label="Default Receiving Warehouse" items={defaultWarehouseOptions} required value={defaultReceivingKey} placeholder="Select default receiving warehouse..." onValueChange={setDefaultReceivingKey} className="w-full" />
                    <SearchableCombobox label="Default Disposal Warehouse" items={defaultWarehouseOptions} required value={defaultDisposalKey} placeholder="Select default disposal warehouse..." onValueChange={setDefaultDisposalKey} className="w-full" />
                  </div>
                </section>
                {!isEditMode ? <ApprovalNotice /> : null}
              </div>
            ) : null}
          </div>
        )}
        <WizardActions step={step} loading={loading || loadingFarm} onBack={goBack} onNext={goNext} onSubmit={handleSubmit}
          submitLabel={isEditMode ? 'Save Changes' : 'Create Farm'} canVoid={isEditMode && canVoid} voiding={voiding} onVoid={handleVoid} summary={summary} />
      </main>
    </div>
  )
}
