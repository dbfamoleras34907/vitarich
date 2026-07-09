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
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  createFarmSetup,
  generateNextCode,
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

const STEPS = [
  {
    id: 0,
    title: 'Farm Info',
    description: 'Register the farm profile and location.',
  },
  {
    id: 1,
    title: 'Warehouse Structure',
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
    <div className={className ?? 'space-y-2'}>
      <Label htmlFor={field.code} required={field.required} className="text-xs font-semibold text-neutral-950">
        {field.label}
      </Label>
      <Input
        id={field.code}
        type={field.type ?? 'text'}
        value={value}
        placeholder={field.placeholder}
        required={field.required}
        readOnly={field.readOnly}
        className={`h-12 border-neutral-200 bg-white text-sm shadow-none placeholder:text-neutral-400 ${
          field.readOnly ? 'bg-neutral-50 font-mono' : ''
        }`}
        onChange={(event) => onChange(field.code, event.target.value)}
      />
    </div>
  )
}

function WizardHeader({
  title,
  description,
  onClose,
}: {
  title: string
  description: string
  onClose: () => void
}) {
  return (
    <div className="border-b border-neutral-100 px-5 py-5 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-950">{title}</h1>
          <p className="mt-1 text-sm leading-5 text-neutral-500">{description}</p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose} className="mt-0.5 text-neutral-600 hover:text-neutral-950">
          <ArrowLeft className="size-4" />
          Back to Farm List
        </Button>
      </div>
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
      <h2 className="text-sm font-semibold text-neutral-950">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>
    </div>
  )
}

function WizardSidebar({ currentStep }: { currentStep: number }) {
  const completedCount = currentStep + 1
  const progress = (completedCount / STEPS.length) * 100

  return (
    <aside className="flex shrink-0 flex-col border-b border-neutral-200 bg-[#f4f5f6] p-5 md:w-72 md:border-r md:border-b-0">
      <div>
        <div className="text-sm font-semibold text-neutral-950">Farm Setup Wizard</div>
        <div className="mt-3 h-px w-full bg-neutral-200">
          <div className="h-px bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 text-xs text-neutral-500">
          {completedCount}/{STEPS.length} completed
        </div>
      </div>

      <nav className="mt-8 grid gap-5 md:gap-6">
        {STEPS.map((stepItem) => {
          const isComplete = currentStep > stepItem.id
          const isActive = currentStep === stepItem.id

          return (
            <div key={stepItem.id} className="flex items-center gap-3 text-sm">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  isComplete
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : isActive
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-neutral-300 text-neutral-400'
                }`}
              >
                {isComplete ? <Check className="size-3" /> : <Circle className="size-2 fill-current" />}
              </span>
              <span className={isActive ? 'font-medium text-neutral-950' : 'text-neutral-500'}>
                {stepItem.title}
              </span>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

function WizardActions({
  step,
  loading,
  onBack,
  onNext,
  onSubmit,
}: {
  step: number
  loading: boolean
  onBack: () => void
  onNext: () => void
  onSubmit: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-neutral-100 px-5 py-4 sm:px-6">
      <Button type="button" variant="secondary" onClick={onBack} className="h-10 bg-white px-4 text-neutral-700">
        <ArrowLeft className="size-4" />
        Back
      </Button>
      {step < STEPS.length - 1 ? (
        <Button type="button" onClick={onNext} className="h-10 bg-emerald-700 px-5 text-white hover:bg-emerald-800">
          Next
          <ArrowRight className="size-4" />
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="h-10 bg-emerald-700 px-5 text-white hover:bg-emerald-800"
        >
          <Save className="size-4" />
          {loading ? 'Saving...' : 'Complete Setup'}
        </Button>
      )}
    </div>
  )
}

function InlineSelect({
  label,
  required,
  value,
  placeholder,
  onValueChange,
  children,
}: {
  label: string
  required?: boolean
  value: string
  placeholder: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label required={required} className="text-xs font-semibold text-neutral-950">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-12 w-full border-neutral-200 bg-white text-sm shadow-none">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  )
}

function EmptyDraftState({ onAdd, disabled }: { onAdd: () => void; disabled: boolean }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-4 py-7 text-center">
      <div className="text-sm font-medium text-neutral-950">No warehouse or building yet</div>
      <p className="mt-1 text-xs leading-5 text-neutral-500">
        Select the farm type first, then add the first farm structure.
      </p>
      <Button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="mt-4 h-9 bg-emerald-700 text-white hover:bg-emerald-800"
      >
        <Plus className="size-4" />
        Add Structure
      </Button>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase text-neutral-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-neutral-950">{value}</div>
    </div>
  )
}

function ReviewDraftRow({
  draft,
  isDefaultFeed,
  isDefaultReceiving,
}: {
  draft: WarehouseDraft
  isDefaultFeed: boolean
  isDefaultReceiving: boolean
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-neutral-950">{draft.data.whse_name || 'Unnamed draft'}</div>
        <div className="mt-1 text-xs text-neutral-500">
          {draft.data.warehouse_type} / {draft.data.fms_type}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {isDefaultFeed ? <Badge className="bg-emerald-700 text-white">Feed</Badge> : null}
        {isDefaultReceiving ? <Badge className="bg-emerald-700 text-white">Receiving</Badge> : null}
      </div>
    </div>
  )
}

export default function Layout() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [farmData, setFarmData] = useState<FormDataMap>({})
  const [addressData, setAddressData] = useState<FormDataMap>({})
  const [warehouseDrafts, setWarehouseDrafts] = useState<WarehouseDraft[]>([])
  const [defaultFeedKey, setDefaultFeedKey] = useState('')
  const [defaultReceivingKey, setDefaultReceivingKey] = useState('')

  const selectedFarmType = FARM_TYPES.find((type) => type.value === farmData.farm_type)
  const locationPreview = useMemo(
    () =>
      [addressData.address, addressData.barangay, addressData.city, addressData.province]
        .map(compact)
        .filter(Boolean)
        .join(', '),
    [addressData.address, addressData.barangay, addressData.city, addressData.province]
  )

  const addWarehouseDraft = () => {
    const baseName = farmData.name ? `${farmData.name} Main` : 'Main Farm Warehouse'

    setWarehouseDrafts((prev) => [
      ...prev,
      {
        clientKey: `warehouse-${Date.now()}`,
        data: {
          whse_name: baseName,
          fms_type: selectedFarmType?.warehouseType ?? 'Broiler',
          warehouse_type: 'Warehouse',
          addr1: addressData.address ?? '',
          addr2: addressData.barangay ?? '',
          city: addressData.city ?? '',
          province: addressData.province ?? '',
        },
      },
    ])
  }

  const updateFarm = (code: string, value: string) => {
    setFarmData((prev) => ({ ...prev, [code]: value }))

    if (code === 'farm_type') {
      const nextType = FARM_TYPES.find((type) => type.value === value)?.warehouseType ?? ''
      setWarehouseDrafts((prev) =>
        prev.map((draft) => ({ ...draft, data: { ...draft.data, fms_type: nextType } }))
      )
    }
  }

  const updateWarehouse = (clientKey: string, code: string, value: string) => {
    setWarehouseDrafts((prev) =>
      prev.map((draft) =>
        draft.clientKey === clientKey ? { ...draft, data: { ...draft.data, [code]: value } } : draft
      )
    )
  }

  const removeWarehouse = (clientKey: string) => {
    setWarehouseDrafts((prev) => prev.filter((draft) => draft.clientKey !== clientKey))

    if (defaultFeedKey === clientKey) setDefaultFeedKey('')
    if (defaultReceivingKey === clientKey) setDefaultReceivingKey('')
  }

  const validateFarmStep = () => {
    const missingFarm = farmFields.some((field) => field.required && !compact(farmData[field.code]))
    const missingAddress = addressFields.some((field) => field.required && !compact(addressData[field.code]))

    if (missingFarm || missingAddress || !compact(farmData.farm_type)) {
      toast.error('Complete the required farm details before continuing.')
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

    return true
  }

  const goNext = () => {
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
      client_key: draft.clientKey,
      whse_name: nullable(draft.data.whse_name),
      fms_type: nullable(draft.data.fms_type),
      warehouse_type: nullable(draft.data.warehouse_type),
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
    }
  }

  const handleSubmit = async () => {
    if (!validateFarmStep() || !validateWarehouseStep()) return

    if (!defaultFeedKey || !defaultReceivingKey) {
      toast.error('Select the default feed and default receiving warehouse before saving.')
      return
    }

    setLoading(true)

    try {
      const payload: FarmSetupPayload = {
        farm: farmData,
        address: addressData,
        warehouses: warehouseDrafts.map(buildWarehousePayload),
        machines: [],
      }

      const farmId = await createFarmSetup(payload)
      toast.success('Farm setup completed.')
      router.push(`/a_dean/farm/${farmId}/edit`)
    } catch (error) {
      toast.error('Error: ' + (error instanceof Error ? error.message : 'Unable to complete farm setup'))
    } finally {
      setLoading(false)
    }
  }

  const loadFarmCode = useCallback(async () => {
    try {
      const code = await generateNextCode('v_last_farm_code', 'FRM', 6)
      setFarmData((prev) => ({ ...prev, code }))
    } catch {
      toast.error('Unable to generate farm code.')
    }
  }, [])

  useEffect(() => {
    router.prefetch('/a_dean/farm')
    loadFarmCode()
  }, [loadFarmCode, router])

  return (
    <div className="min-h-screen bg-[#d7dcdf] px-3 py-5 sm:px-6 lg:px-8">
      <main className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl md:min-h-[680px] md:flex-row">
        <WizardSidebar currentStep={step} />

        <section className="flex min-w-0 flex-1 flex-col">
          {step === 0 ? (
            <>
              <WizardHeader
                title="Farm Info"
                description="Set up the core farm profile, contact details, and site address."
                onClose={() => router.push('/a_dean/farm')}
              />
              <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
                <SectionIntro title="Register Farm Details" description={STEPS[0].description} />
                <div className="grid gap-4 sm:grid-cols-2">
                  {farmFields.map((field) => (
                    <TextField
                      key={field.code}
                      field={field}
                      value={farmData[field.code] ?? ''}
                      onChange={updateFarm}
                    />
                  ))}
                  <div className="sm:col-span-2">
                    <InlineSelect
                      label="Farm Type"
                      required
                      value={farmData.farm_type ?? ''}
                      placeholder="select farm type"
                      onValueChange={(value) => updateFarm('farm_type', value)}
                    >
                      {FARM_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </InlineSelect>
                  </div>
                </div>

                <SectionIntro title="Farm Location" description="This address is reused as the initial warehouse address." />
                <div className="grid gap-4 sm:grid-cols-2">
                  {addressFields.map((field) => (
                    <TextField
                      key={field.code}
                      field={field}
                      value={addressData[field.code] ?? ''}
                      onChange={(code, value) => setAddressData((prev) => ({ ...prev, [code]: value }))}
                    />
                  ))}
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs font-semibold text-neutral-950">Address Preview</Label>
                    <div className="min-h-12 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm leading-5 text-neutral-600">
                      {locationPreview || 'Address will be assembled from the location fields.'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <WizardHeader
                title="Warehouse Structure"
                description="Create one or more warehouses or buildings for this farm."
                onClose={() => router.push('/a_dean/farm')}
              />
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <SectionIntro title="Associated Warehouse Or Building" description={STEPS[1].description} />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addWarehouseDraft}
                    disabled={!farmData.farm_type}
                    className="h-10 bg-white text-neutral-700"
                  >
                    <Plus className="size-4" />
                    Add Other Structure
                  </Button>
                </div>

                {warehouseDrafts.length === 0 ? (
                  <div className="mt-5">
                    <EmptyDraftState onAdd={addWarehouseDraft} disabled={!farmData.farm_type} />
                  </div>
                ) : null}

                <div className="mt-5 space-y-4">
                  {warehouseDrafts.map((draft, index) => (
                    <div key={draft.clientKey} className="rounded-md border border-neutral-200 bg-white p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-neutral-950">Structure {index + 1}</div>
                          <Badge variant="outline">{draft.data.warehouse_type || 'Warehouse'}</Badge>
                        </div>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => removeWarehouse(draft.clientKey)}
                          aria-label={`Remove structure ${index + 1}`}
                        >
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <InlineSelect
                          label="Warehouse Type"
                          required
                          value={draft.data.warehouse_type ?? 'Warehouse'}
                          placeholder="select warehouse type"
                          onValueChange={(value) => updateWarehouse(draft.clientKey, 'warehouse_type', value)}
                        >
                          {WAREHOUSE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </InlineSelect>
                        <TextField
                          field={{ code: 'fms_type', label: 'FMS Type', readOnly: true }}
                          value={draft.data.fms_type ?? ''}
                          onChange={(code, value) => updateWarehouse(draft.clientKey, code, value)}
                        />
                        {warehouseFields.map((field) => (
                          <TextField
                            key={field.code}
                            field={field}
                            value={draft.data[field.code] ?? ''}
                            onChange={(code, value) => updateWarehouse(draft.clientKey, code, value)}
                          />
                        ))}
                        <div className="space-y-2 sm:col-span-2">
                          <Label
                            htmlFor={`remarks-${draft.clientKey}`}
                            className="text-xs font-semibold text-neutral-950"
                          >
                            Remarks
                          </Label>
                          <Textarea
                            id={`remarks-${draft.clientKey}`}
                            value={draft.data.remarks ?? ''}
                            placeholder="e.g. Main feed storage, receiving dock, or building note."
                            className="min-h-24 border-neutral-200 bg-white text-sm placeholder:text-neutral-400"
                            onChange={(event) => updateWarehouse(draft.clientKey, 'remarks', event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <WizardHeader
                title="Review & Launch"
                description="Select defaults and confirm the farm setup before saving."
                onClose={() => router.push('/a_dean/farm')}
              />
              <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
                <SectionIntro title="Default Warehouses" description={STEPS[2].description} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <InlineSelect
                    label="Default Feed"
                    required
                    value={defaultFeedKey}
                    placeholder="select feed warehouse"
                    onValueChange={setDefaultFeedKey}
                  >
                    {warehouseDrafts.map((draft) => (
                      <SelectItem key={draft.clientKey} value={draft.clientKey}>
                        {draft.data.whse_name || 'Unnamed draft'}
                      </SelectItem>
                    ))}
                  </InlineSelect>
                  <InlineSelect
                    label="Default Receiving"
                    required
                    value={defaultReceivingKey}
                    placeholder="select receiving warehouse"
                    onValueChange={setDefaultReceivingKey}
                  >
                    {warehouseDrafts.map((draft) => (
                      <SelectItem key={draft.clientKey} value={draft.clientKey}>
                        {draft.data.whse_name || 'Unnamed draft'}
                      </SelectItem>
                    ))}
                  </InlineSelect>
                </div>

                <div className="rounded-md border border-neutral-200">
                  {warehouseDrafts.map((draft) => (
                    <ReviewDraftRow
                      key={draft.clientKey}
                      draft={draft}
                      isDefaultFeed={draft.clientKey === defaultFeedKey}
                      isDefaultReceiving={draft.clientKey === defaultReceivingKey}
                    />
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryRow label="Farm" value={farmData.name || 'Not set'} />
                  <SummaryRow label="Farm Code" value={farmData.code || 'Not set'} />
                  <SummaryRow label="Farm Type" value={selectedFarmType?.label || 'Not selected'} />
                  <SummaryRow label="Warehouses / Buildings" value={String(warehouseDrafts.length)} />
                  <SummaryRow
                    label="Default Feed"
                    value={
                      warehouseDrafts.find((draft) => draft.clientKey === defaultFeedKey)?.data.whse_name ||
                      'Not selected'
                    }
                  />
                  <SummaryRow
                    label="Default Receiving"
                    value={
                      warehouseDrafts.find((draft) => draft.clientKey === defaultReceivingKey)?.data.whse_name ||
                      'Not selected'
                    }
                  />
                </div>
              </div>
            </>
          ) : null}

          <WizardActions step={step} loading={loading} onBack={goBack} onNext={goNext} onSubmit={handleSubmit} />
        </section>
      </main>
    </div>
  )
}
