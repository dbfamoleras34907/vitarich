'use client'

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
import type { WarehouseData } from '@/lib/types'
import { ArrowLeft, MapPin, PackageCheck, Phone, Save, Warehouse } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getWarehouses, updateWarehouse } from '../../api'
import { getWarehouseFarmOptions, type WarehouseFarmOption } from '../../new/api'

type FieldCode = keyof Pick<
  WarehouseData,
  | 'whse_name'
  | 'full_location_code'
  | 'addr1'
  | 'addr2'
  | 'city'
  | 'province'
  | 'phone'
  | 'mobile'
>

const FMS_TYPES = [
  { value: 'Broiler', label: 'Broiler' },
  { value: 'Breeder', label: 'Breeder' },
  { value: 'Hatchery', label: 'Hatchery' },
]

const WAREHOUSE_TYPES = [
  { value: 'Warehouse', label: 'Warehouse' },
  { value: 'Building', label: 'Building' },
]

const FMS_TYPE_VALUES = new Set(FMS_TYPES.map((type) => type.value))
const WAREHOUSE_TYPE_VALUES = new Set(WAREHOUSE_TYPES.map((type) => type.value))

const compact = (value: unknown) => String(value ?? '').trim()
const displayValue = (value: unknown) => String(value ?? '')
const nullable = (value: unknown) => {
  const trimmed = compact(value)
  return trimmed ? trimmed : null
}

const normalizeWarehouseForEdit = (warehouse: WarehouseData): WarehouseData => {
  const fmsType = compact(warehouse.fms_type)
  const warehouseType = compact(warehouse.warehouse_type)
  const legacyFmsType = FMS_TYPE_VALUES.has(warehouseType) ? warehouseType : ''

  return {
    ...warehouse,
    fms_type: FMS_TYPE_VALUES.has(fmsType) ? fmsType : legacyFmsType || 'Broiler',
    warehouse_type: WAREHOUSE_TYPE_VALUES.has(warehouseType) ? warehouseType : 'Warehouse',
  }
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

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
      <div className="text-xs font-medium uppercase text-stone-500">{label}</div>
      <div className="mt-1 break-words font-medium text-stone-950">{value}</div>
    </div>
  )
}

export default function Layout() {
  const router = useRouter()
  const params = useParams()
  const warehouseId = String(params.warehouseid ?? '')
  const [formData, setFormData] = useState<Partial<WarehouseData>>({})
  const [farms, setFarms] = useState<WarehouseFarmOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPage, setLoadingPage] = useState(true)
  const [loadingFarms, setLoadingFarms] = useState(false)

  const selectedFarm = useMemo(
    () => farms.find((farm) => farm.id === formData.farm_id) ?? null,
    [farms, formData.farm_id]
  )

  const selectedFarmLabel = selectedFarm
    ? `${selectedFarm.code} - ${selectedFarm.name || 'Unnamed farm'}`
    : formData.farm_id
      ? `Farm ID ${formData.farm_id}`
      : 'Not selected'

  const addressPreview = useMemo(
    () =>
      [formData.addr1, formData.addr2, formData.city, formData.province]
        .map(compact)
        .filter(Boolean)
        .join(', '),
    [formData.addr1, formData.addr2, formData.city, formData.province]
  )

  const updateText = (code: FieldCode, value: string) => {
    setFormData((prev) => ({ ...prev, [code]: value }))
  }

  const updateFmsType = (value: string) => {
    setFormData((prev) => ({ ...prev, fms_type: value }))
  }

  const saveWarehouse = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!compact(formData.whse_name)) {
      toast.error('Warehouse name is required.')
      return
    }

    if (!FMS_TYPE_VALUES.has(compact(formData.fms_type))) {
      toast.error('Please select a valid FMS type.')
      return
    }

    if (!WAREHOUSE_TYPE_VALUES.has(compact(formData.warehouse_type))) {
      toast.error('Please select a valid warehouse type.')
      return
    }

    setLoading(true)
    const payload: WarehouseData = {
      whse_name: nullable(formData.whse_name),
      fms_type: nullable(formData.fms_type),
      warehouse_type: nullable(formData.warehouse_type),
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

    const result = await updateWarehouse(warehouseId, payload)
    setLoading(false)

    if (result.success) {
      toast.success('Warehouse updated successfully.')
      router.push('/a_dean/warehouse')
      return
    }

    toast.error(result.error ?? 'Unable to update warehouse.')
  }

  useEffect(() => {
    async function loadWarehouse() {
      setLoadingPage(true)
      const result = await getWarehouses(warehouseId)

      if (result.success && result.data && !Array.isArray(result.data)) {
        setFormData(normalizeWarehouseForEdit(result.data))
      } else {
        toast.error(result.error ?? 'Unable to load warehouse.')
      }

      setLoadingPage(false)
    }

    if (warehouseId) loadWarehouse()
  }, [warehouseId])

  useEffect(() => {
    async function loadFarms() {
      setLoadingFarms(true)

      try {
        const result = await getWarehouseFarmOptions()

        if (result.success && Array.isArray(result.data)) {
          setFarms(result.data)
          return
        }

        toast.error(result.error ?? 'Unable to load farms.')
      } finally {
        setLoadingFarms(false)
      }
    }

    loadFarms()
  }, [])

  return (
    <div className="min-h-screen bg-[#f7f5f1]">
      <form onSubmit={saveWarehouse}>
        <div className="sticky top-0 z-10 border-b border-stone-200 bg-[#f7f5f1]/95 px-4 py-3 backdrop-blur sm:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Breadcrumb
              SecondPreviewPageName="Warehouse"
              SecondPreviewPageLink="/a_dean/warehouse"
              CurrentPageName="Edit Warehouse"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => router.push('/a_dean/warehouse')}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button type="submit" disabled={loading || loadingPage}>
                <Save className="size-4" />
                {loading ? 'Saving...' : 'Update Warehouse'}
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
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                      Update the FMS classification, warehouse type, farm link, and operational identifiers used by inventory documents.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Warehouse Code</Label>
                  <Input value={formData.whse_code ?? ''} readOnly className="bg-stone-100 font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label required>Warehouse Name</Label>
                  <Input
                    value={displayValue(formData.whse_name)}
                    onChange={(event) => updateText('whse_name', event.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label required>FMS Type</Label>
                  <Select value={formData.fms_type ?? ''} onValueChange={updateFmsType}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select FMS type" />
                    </SelectTrigger>
                    <SelectContent>
                      {FMS_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Farm</Label>
                  <Input value={selectedFarmLabel} disabled className="bg-stone-100 text-stone-600" />
                  <p className="text-xs leading-5 text-stone-500">
                    Farm assignment is controlled in Farm Master.
                  </p>
                  {!loadingFarms && formData.farm_id && !selectedFarm ? (
                    <p className="text-xs leading-5 text-amber-700">
                      This farm link could not be found in the active farm list.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label required>Warehouse Type</Label>
                  <Select
                    value={formData.warehouse_type ?? ''}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, warehouse_type: value }))}
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
              </div>
            </section>

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={MapPin}
                title="Location"
                description="Codes and address lines used for inventory documents, audit trails, and warehouse lookup."
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {([
                  ['full_location_code', 'Location Code'],
                  ['addr1', 'Address Line 1'],
                  ['addr2', 'Address Line 2'],
                  ['city', 'City'],
                  ['province', 'Province'],
                ] as const).map(([code, label]) => (
                  <div key={code} className="space-y-2">
                    <Label>{label}</Label>
                    <Input
                      value={displayValue(formData[code])}
                      onChange={(event) => updateText(code, event.target.value)}
                    />
                  </div>
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
                {([
                  ['phone', 'Phone'],
                  ['mobile', 'Mobile'],
                ] as const).map(([code, label]) => (
                  <div key={code} className="space-y-2">
                    <Label>{label}</Label>
                    <Input
                      value={displayValue(formData[code])}
                      onChange={(event) => updateText(code, event.target.value)}
                    />
                  </div>
                ))}
                <div className="space-y-2 sm:col-span-2">
                  <Label>Remarks</Label>
                  <Textarea
                    value={formData.remarks ?? ''}
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
                icon={Warehouse}
                title="Summary"
                description="Quick check before saving the warehouse record."
              />
              <div className="mt-5 space-y-3 text-sm">
                <SummaryRow label="Warehouse Code" value={formData.whse_code || 'Not assigned'} />
                <SummaryRow label="FMS Type" value={formData.fms_type || 'Not selected'} />
                <SummaryRow label="Warehouse Type" value={formData.warehouse_type || 'Not selected'} />
                <SummaryRow label="Farm" value={selectedFarmLabel} />
              </div>
            </section>

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={PackageCheck}
                title="Controls"
                description="Operational flags that determine warehouse availability."
              />
              <div className="mt-5 flex items-start justify-between gap-4 rounded-md border border-stone-200 bg-white px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-stone-950">Active Warehouse</div>
                  <div className="mt-1 text-xs leading-5 text-stone-500">
                    Allow this warehouse to appear in inventory transactions and master lookups.
                  </div>
                </div>
                <Switch
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

