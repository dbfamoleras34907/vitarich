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
import Breadcrumb from '@/lib/Breadcrumb'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Factory,
  MapPin,
  Plus,
  Save,
  Trash2,
  Warehouse,
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
  { id: 0, title: 'Farm Details' },
  { id: 1, title: 'Warehouse Or Building' },
  { id: 2, title: 'Defaults And Review' },
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
}: {
  field: FieldConfig
  value: string
  onChange: (code: string, value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.code} required={field.required}>
        {field.label}
      </Label>
      <Input
        id={field.code}
        type={field.type ?? 'text'}
        value={value}
        placeholder={field.placeholder}
        required={field.required}
        readOnly={field.readOnly}
        className={field.readOnly ? 'bg-stone-100 font-mono text-sm' : undefined}
        onChange={(event) => onChange(field.code, event.target.value)}
      />
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-stone-50 text-stone-700">
        <Icon className="size-4" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-stone-950">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-stone-500">{description}</p>
      </div>
    </div>
  )
}

function StepTabs({ currentStep }: { currentStep: number }) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {STEPS.map((step) => (
        <div
          key={step.id}
          className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
            currentStep === step.id
              ? 'border-stone-900 bg-stone-900 text-white'
              : currentStep > step.id
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-stone-200 bg-white text-stone-600'
          }`}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-current text-xs">
            {currentStep > step.id ? <Check className="size-3" /> : step.id + 1}
          </span>
          <span className="truncate font-medium">{step.title}</span>
        </div>
      ))}
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
    <div className="min-h-screen bg-[#f7f5f1]">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-[#f7f5f1]/95 px-4 py-3 backdrop-blur sm:px-8">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Breadcrumb
            SecondPreviewPageName="Farm"
            SecondPreviewPageLink="/a_dean/farm"
            CurrentPageName="Farm Setup Wizard"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={goBack}>
              <ArrowLeft className="size-4" />
              {step === 0 ? 'Back' : 'Previous'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext}>
                Next
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={loading}>
                <Save className="size-4" />
                {loading ? 'Saving...' : 'Complete Setup'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-8">
        <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-stone-900 text-white">
                <Factory className="size-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold text-stone-950">Farm Setup Wizard</h1>
                  <Badge variant="outline">Farm Management</Badge>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                  Create the farm, its first warehouse or building, and default warehouse flags in one final save.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <StepTabs currentStep={step} />
          </div>
        </section>

        {step === 0 ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={Factory}
                title="Farm Details"
                description="Core farm registration, classification, and contact details."
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {farmFields.map((field) => (
                  <TextField
                    key={field.code}
                    field={field}
                    value={farmData[field.code] ?? ''}
                    onChange={updateFarm}
                  />
                ))}
                <div className="space-y-2 sm:col-span-2">
                  <Label required>Farm Type</Label>
                  <Select value={farmData.farm_type ?? ''} onValueChange={(value) => updateFarm('farm_type', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select farm type" />
                    </SelectTrigger>
                    <SelectContent>
                      {FARM_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={MapPin}
                title="Location"
                description="Address used for farm lookup and warehouse defaults."
              />
              <div className="mt-5 grid gap-4">
                {addressFields.map((field) => (
                  <TextField
                    key={field.code}
                    field={field}
                    value={addressData[field.code] ?? ''}
                    onChange={(code, value) => setAddressData((prev) => ({ ...prev, [code]: value }))}
                  />
                ))}
                <div className="space-y-2">
                  <Label>Address Preview</Label>
                  <div className="min-h-10 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    {locationPreview || 'Address will be assembled from the location fields.'}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {step === 1 ? (
          <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <SectionHeader
                icon={Warehouse}
                title="Associated Warehouse Or Building"
                description="Create the warehouse or building draft first. It will be saved before the farm during final setup."
              />
              <Button type="button" onClick={addWarehouseDraft} disabled={!farmData.farm_type}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>

            {warehouseDrafts.length === 0 ? (
              <div className="mt-5 rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center">
                <div className="text-sm font-medium text-stone-900">No warehouse or building drafted</div>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Select the farm type, then add the first warehouse or building for this farm.
                </p>
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              {warehouseDrafts.map((draft, index) => (
                <div key={draft.clientKey} className="rounded-md border border-stone-200 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-stone-950">Draft {index + 1}</div>
                      <Badge variant="outline">{draft.data.warehouse_type || 'Warehouse'}</Badge>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeWarehouse(draft.clientKey)}
                      aria-label={`Remove draft ${index + 1}`}
                    >
                      <Trash2 className="size-4 text-red-600" />
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label required>Warehouse Type</Label>
                      <Select
                        value={draft.data.warehouse_type ?? 'Warehouse'}
                        onValueChange={(value) => updateWarehouse(draft.clientKey, 'warehouse_type', value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select warehouse type" />
                        </SelectTrigger>
                        <SelectContent>
                          {WAREHOUSE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>FMS Type</Label>
                      <Input value={draft.data.fms_type ?? ''} readOnly className="bg-stone-100" />
                    </div>
                    {warehouseFields.map((field) => (
                      <TextField
                        key={field.code}
                        field={field}
                        value={draft.data[field.code] ?? ''}
                        onChange={(code, value) => updateWarehouse(draft.clientKey, code, value)}
                      />
                    ))}
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`remarks-${draft.clientKey}`}>Remarks</Label>
                      <Textarea
                        id={`remarks-${draft.clientKey}`}
                        value={draft.data.remarks ?? ''}
                        className="min-h-20"
                        onChange={(event) => updateWarehouse(draft.clientKey, 'remarks', event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={Warehouse}
                title="Default Warehouses"
                description="Choose from the warehouse or building drafts that will be created in this setup."
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label required>Default Feed</Label>
                  <Select value={defaultFeedKey} onValueChange={setDefaultFeedKey}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select feed warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseDrafts.map((draft) => (
                        <SelectItem key={draft.clientKey} value={draft.clientKey}>
                          {draft.data.whse_name || 'Unnamed draft'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label required>Default Receiving</Label>
                  <Select value={defaultReceivingKey} onValueChange={setDefaultReceivingKey}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select receiving warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseDrafts.map((draft) => (
                        <SelectItem key={draft.clientKey} value={draft.clientKey}>
                          {draft.data.whse_name || 'Unnamed draft'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-5 rounded-md border border-stone-200">
                {warehouseDrafts.map((draft) => (
                  <div
                    key={draft.clientKey}
                    className="flex flex-col gap-2 border-t border-stone-200 px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium text-stone-950">{draft.data.whse_name || 'Unnamed draft'}</div>
                      <div className="mt-1 text-xs text-stone-500">
                        {draft.data.warehouse_type} | {draft.data.fms_type}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draft.clientKey === defaultFeedKey ? <Badge>Feed</Badge> : null}
                      {draft.clientKey === defaultReceivingKey ? <Badge>Receiving</Badge> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={Check}
                title="Review"
                description="Final save creates every draft in one database transaction."
              />
              <div className="mt-5 space-y-3 text-sm">
                <SummaryRow label="Farm" value={farmData.name || 'Not set'} />
                <SummaryRow label="Farm Code" value={farmData.code || 'Not set'} />
                <SummaryRow label="Farm Type" value={selectedFarmType?.label || 'Not selected'} />
                <SummaryRow label="Warehouses / Buildings" value={String(warehouseDrafts.length)} />
                <SummaryRow
                  label="Default Feed"
                  value={warehouseDrafts.find((draft) => draft.clientKey === defaultFeedKey)?.data.whse_name || 'Not selected'}
                />
                <SummaryRow
                  label="Default Receiving"
                  value={
                    warehouseDrafts.find((draft) => draft.clientKey === defaultReceivingKey)?.data.whse_name ||
                    'Not selected'
                  }
                />
              </div>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
      <div className="text-xs font-medium uppercase text-stone-500">{label}</div>
      <div className="mt-1 font-medium text-stone-950">{value}</div>
    </div>
  )
}
