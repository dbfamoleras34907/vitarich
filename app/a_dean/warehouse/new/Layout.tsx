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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import Breadcrumb from '@/lib/Breadcrumb'
import { WarehouseData } from '@/lib/types'
import {
  ArrowLeft,
  MapPin,
  PackageCheck,
  Phone,
  Save,
  Warehouse,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getWarehouseBuildings, type WarehouseBuildingOption } from '../api'
import { createWarehouse } from './api'

type FieldCode = keyof Pick<
  WarehouseData,
  | 'whse_name'
  | 'fms_type'
  | 'warehouse_type'
  | 'full_location_code'
  | 'addr1'
  | 'addr2'
  | 'city'
  | 'province'
  | 'phone'
  | 'mobile'
>

type TextFieldConfig = {
  code: FieldCode
  label: string
  placeholder?: string
  required?: boolean
  helper?: string
  transform?: 'uppercase'
}

const FMS_TYPES = [
  { value: 'Broiler', label: 'Broiler' },
  { value: 'Breeder', label: 'Breeder' },
  { value: 'Hatchery', label: 'Hatchery' },
]

const WAREHOUSE_TYPE_PREFIX: Record<string, string> = {
  Warehouse: 'WH',
  Building: 'BD',
}

const WAREHOUSE_TYPES = [
  { value: 'Warehouse', label: 'Warehouse' },
  { value: 'Building', label: 'Building' },
  { value: 'Pen', label: 'Pen' },
]

const compact = (value: unknown) => String(value ?? '').trim()
const displayValue = (value: unknown) => String(value ?? '')
const nullable = (value: unknown) => {
  const trimmed = compact(value)
  return trimmed ? trimmed : null
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
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </div>
    </div>
  )
}

function TextField({
  field,
  value,
  onChange,
}: {
  field: TextFieldConfig
  value: string
  onChange: (code: FieldCode, value: string, transform?: TextFieldConfig['transform']) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.code} required={field.required}>
        {field.label}
      </Label>
      <Input
        id={field.code}
        value={value}
        placeholder={field.placeholder}
        required={field.required}
        onChange={(event) => onChange(field.code, event.target.value, field.transform)}
      />
      {field.helper ? <p className="text-xs leading-5 text-stone-500">{field.helper}</p> : null}
    </div>
  )
}

function OptionRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-stone-200 bg-white px-4 py-3">
      <div>
        <div className="text-sm font-medium text-stone-950">{title}</div>
        <div className="mt-1 text-xs leading-5 text-stone-500">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export default function Layout() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingBuildings, setLoadingBuildings] = useState(false)
  const [buildings, setBuildings] = useState<WarehouseBuildingOption[]>([])
  const [formData, setFormData] = useState<Partial<WarehouseData>>({
    is_active: true,
    fms_type: 'Broiler',
    warehouse_type: 'Warehouse',
  })

  const identityFields: TextFieldConfig[] = [
    {
      code: 'whse_name',
      label: 'Warehouse Name',
      placeholder: 'Main Feed Warehouse',
      required: true,
    },
  ]

  const locationFields: TextFieldConfig[] = [
    {
      code: 'full_location_code',
      label: 'Location Code',
      placeholder: 'PLANT-AREA-WHSE',
      helper: 'Use a stable operational code for reporting and bin hierarchy.',
      transform: 'uppercase',
    },
    { code: 'addr1', label: 'Address Line 1', placeholder: 'Building, street, or site' },
    { code: 'addr2', label: 'Address Line 2', placeholder: 'Zone, barangay, or landmark' },
    { code: 'city', label: 'City', placeholder: 'City / Municipality' },
    { code: 'province', label: 'Province', placeholder: 'Province / State' },
  ]

  const contactFields: TextFieldConfig[] = [
    { code: 'phone', label: 'Phone', placeholder: 'Landline or site local' },
    { code: 'mobile', label: 'Mobile', placeholder: 'Warehouse contact number' },
  ]

  const addressPreview = useMemo(
    () =>
      [formData.addr1, formData.addr2, formData.city, formData.province]
        .map(compact)
        .filter(Boolean)
        .join(', '),
    [formData.addr1, formData.addr2, formData.city, formData.province]
  )

  const selectedFatherBuilding = useMemo(
    () => buildings.find((building) => building.id === formData.father_id) ?? null,
    [buildings, formData.father_id]
  )

  const sampleWarehouseCode = useMemo(() => {
    if (formData.warehouse_type === 'Pen') {
      return selectedFatherBuilding?.whse_code
        ? `${selectedFatherBuilding.whse_code}-P#`
        : 'Select a father building'
    }

    const prefix = WAREHOUSE_TYPE_PREFIX[compact(formData.warehouse_type)] ?? 'WH'
    return `${prefix}-0000001`
  }, [formData.warehouse_type, selectedFatherBuilding])

  const handleTextChange = (
    code: FieldCode,
    value: string,
    transform?: TextFieldConfig['transform']
  ) => {
    const nextValue = transform === 'uppercase' ? value.toUpperCase() : value
    setFormData((prev) => ({ ...prev, [code]: nextValue }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!compact(formData.whse_name)) {
      toast.error('Warehouse name is required.')
      return
    }

    if (formData.warehouse_type === 'Pen' && !formData.father_id) {
      toast.error('Select a father Building for this Pen.')
      return
    }

    const capacityText = compact(formData.capacity)
    const capacity = capacityText === '' ? null : Number(capacityText)
    if (
      (formData.warehouse_type === 'Pen' && capacity == null) ||
      (capacity != null && (!Number.isFinite(capacity) || capacity < 0))
    ) {
      toast.error('Enter a valid non-negative capacity.')
      return
    }

    setLoading(true)
    const payload: WarehouseData = {
      whse_name: nullable(formData.whse_name),
      fms_type: nullable(formData.fms_type),
      warehouse_type: nullable(formData.warehouse_type),
      father_id: formData.warehouse_type === 'Pen' ? formData.father_id ?? null : null,
      capacity,
      full_location_code: nullable(formData.full_location_code),
      addr1: nullable(formData.addr1),
      addr2: nullable(formData.addr2),
      city: nullable(formData.city),
      province: nullable(formData.province),
      address: addressPreview || null,
      phone: nullable(formData.phone),
      mobile: nullable(formData.mobile),
      remarks: nullable(formData.remarks),
      is_active: formData.is_active ?? true,
    }

    const { success, error } = await createWarehouse(payload)
    setLoading(false)

    if (success) {
      toast.success('Warehouse created successfully.')
      router.push('/a_dean/warehouse')
      return
    }

    toast.error(`Error: ${error}`)
  }

  useEffect(() => {
    router.prefetch('/a_dean/warehouse')
  }, [router])

  useEffect(() => {
    async function loadBuildings() {
      setLoadingBuildings(true)
      const result = await getWarehouseBuildings()

      if (result.success && Array.isArray(result.data)) {
        setBuildings(result.data)
      } else {
        toast.error(result.error ?? 'Unable to load buildings.')
      }

      setLoadingBuildings(false)
    }

    loadBuildings()
  }, [])

  return (
    <div className="min-h-screen bg-[#f7f5f1]">
      <form onSubmit={handleSubmit}>
        <div className="sticky top-0 z-10 border-b border-stone-200 bg-[#f7f5f1]/95 px-4 py-3 backdrop-blur sm:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Breadcrumb
              SecondPreviewPageName="Warehouse"
              SecondPreviewPageLink="/a_dean/warehouse"
              CurrentPageName="New Warehouse"
            />
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <Button type="button" variant="secondary" onClick={() => router.push('/a_dean/warehouse')}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="size-4" />
                {loading ? 'Saving...' : 'Save Warehouse'}
              </Button>
            </div>
          </div>
        </div>

        <main className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:px-8">
          <div className="space-y-5">
            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-stone-900 text-white">
                    <Warehouse className="size-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-semibold text-stone-950">Warehouse Master Data</h1>
                      <Badge variant="outline">Inventory</Badge>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                      Maintain the FMS classification, warehouse type, location, and contact details used by inventory documents. Warehouse code is generated automatically from the selected warehouse type.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {identityFields.map((field,i) => (
                  <TextField
                    key={i}
                    field={field}
                    value={displayValue(formData[field.code])}
                    onChange={handleTextChange}
                  />
                ))}
                <div className="space-y-2 sm:col-span-2">
                  <Label required>FMS Type</Label>
                  <Select
                    value={formData.fms_type ?? ''}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, fms_type: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select FMS type" />
                    </SelectTrigger>
                    <SelectContent>
                      {FMS_TYPES.map((type,i) => (
                        <SelectItem key={i} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Farm</Label>
                  <Input value="Assigned from Farm Master" disabled className="bg-stone-100 text-stone-600" />
                  <p className="text-xs leading-5 text-stone-500">
                    Farm assignment is controlled in Farm Master.
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label required>Warehouse Type</Label>
                  <Select
                    value={formData.warehouse_type ?? ''}
                    onValueChange={(value) => setFormData((prev) => ({
                      ...prev,
                      warehouse_type: value,
                      father_id: value === 'Pen' ? prev.father_id : null,
                    }))}
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
                {formData.warehouse_type === 'Pen' ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label required>Father Building</Label>
                    <Select
                      value={formData.father_id == null ? '' : String(formData.father_id)}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, father_id: Number(value) }))}
                      disabled={loadingBuildings}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={loadingBuildings ? 'Loading buildings...' : 'Select father building'} />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map((building) => (
                          <SelectItem key={building.id} value={String(building.id)}>
                            {building.whse_code || `Building ${building.id}`} - {building.whse_name || 'Unnamed building'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                {formData.warehouse_type === 'Building' || formData.warehouse_type === 'Pen' ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label required={formData.warehouse_type === 'Pen'}>Capacity</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      required={formData.warehouse_type === 'Pen'}
                      value={formData.capacity ?? ''}
                      onChange={(event) => setFormData((prev) => ({
                        ...prev,
                        capacity: event.target.value === '' ? null : Number(event.target.value),
                      }))}
                    />
                    <p className="text-xs leading-5 text-stone-500">
                      A standalone building has no capacity-matching condition. Adding a Pen requires the total Pen capacity to equal its Building capacity.
                    </p>
                  </div>
                ) : null}
                <div className="space-y-2 sm:col-span-2">
                  <Label>Sample Warehouse Code</Label>
                  <div className="flex h-10 items-center rounded-md border border-dashed border-stone-300 bg-stone-50 px-3 font-mono text-sm font-semibold text-stone-800">
                    {sampleWarehouseCode}
                  </div>
                  <p className="text-xs leading-5 text-stone-500">
                    The final number is assigned automatically when the warehouse is saved.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={MapPin}
                title="Location"
                description="Codes and address lines used for inventory documents, audit trails, and warehouse lookup."
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {locationFields.map((field) => (
                  <TextField
                    key={field.code}
                    field={field}
                    value={displayValue(formData[field.code])}
                    onChange={handleTextChange}
                  />
                ))}
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address Preview</Label>
                  <div className="min-h-10 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    {addressPreview || 'Address will be assembled from the location fields.'}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={Phone}
                title="Contact And Remarks"
                description="Operational contact information for dispatch, receiving, and cycle count coordination."
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {contactFields.map((field) => (
                  <TextField
                    key={field.code}
                    field={field}
                    value={displayValue(formData[field.code])}
                    onChange={handleTextChange}
                  />
                ))}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks ?? ''}
                    placeholder="Receiving cut-off, storage rules, access notes, or other warehouse instructions"
                    onChange={(event) => setFormData((prev) => ({ ...prev, remarks: event.target.value }))}
                    className="min-h-24"
                  />
                </div>
              </div>
            </section>
          </div>

          <aside className="min-w-0 space-y-5">
            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={PackageCheck}
                title="Controls"
                description="Operational flags that determine warehouse availability."
              />
              <div className="mt-5 space-y-3">
                <OptionRow
                  title="Active Warehouse"
                  description="Allow this warehouse to appear in inventory transactions and master lookups."
                  checked={formData.is_active ?? true}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                />
              </div>
            </section>
          </aside>
        </main>
      </form>
    </div>
  )
}
