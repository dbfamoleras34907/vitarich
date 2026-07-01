'use client'

import SearchableCombobox, { type ComboboxItemType } from '@/components/SearchableCombobox'
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
import { ArrowLeft, Save } from 'lucide-react'
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

const FMS_FARM_TYPE: Record<string, string> = {
  Broiler: 'BR',
  Breeder: 'BE',
  Hatchery: 'HA',
}

const compact = (value: unknown) => String(value ?? '').trim()
const displayValue = (value: unknown) => String(value ?? '')
const nullable = (value: unknown) => {
  const trimmed = compact(value)
  return trimmed ? trimmed : null
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

  const selectedFarmType = FMS_FARM_TYPE[compact(formData.fms_type)] ?? ''
  const filteredFarms = useMemo(
    () => farms.filter((farm) => compact(farm.farm_type) === selectedFarmType),
    [farms, selectedFarmType]
  )

  const farmOptions: ComboboxItemType[] = useMemo(
    () =>
      filteredFarms.map((farm) => ({
        code: String(farm.id),
        name: `${farm.code} - ${farm.name || 'Unnamed farm'}`,
      })),
    [filteredFarms]
  )

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
    setFormData((prev) => {
      const nextFarmType = FMS_FARM_TYPE[value] ?? ''
      const selectedFarm = farms.find((farm) => farm.id === prev.farm_id)

      if (!selectedFarm || compact(selectedFarm.farm_type) === nextFarmType) {
        return { ...prev, fms_type: value }
      }

      return {
        ...prev,
        fms_type: value,
        farm_id: null,
        farm_code: null,
        farm_name: null,
      }
    })
  }

  const updateFarm = (farmId: string) => {
    const farm = filteredFarms.find((candidate) => String(candidate.id) === farmId)

    setFormData((prev) => ({
      ...prev,
      farm_id: farm?.id ?? null,
      farm_code: farm?.code ?? null,
      farm_name: farm?.name ?? null,
    }))
  }

  const saveWarehouse = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!compact(formData.whse_name)) {
      toast.error('Warehouse name is required.')
      return
    }

    setLoading(true)
    const payload: WarehouseData = {
      whse_name: nullable(formData.whse_name),
      farm_id: formData.farm_id ?? null,
      farm_code: nullable(formData.farm_code),
      farm_name: nullable(formData.farm_name),
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
        setFormData(result.data)
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

        <main className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-6 lg:px-8">
          <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Warehouse Code</Label>
                <Input value={formData.whse_code ?? ''} readOnly className="bg-stone-100" />
              </div>
              <div className="space-y-2">
                <Label required>Warehouse Name</Label>
                <Input
                  value={displayValue(formData.whse_name)}
                  onChange={(event) => updateText('whse_name', event.target.value)}
                />
              </div>
              <div className="space-y-2">
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
              <div className="space-y-2">
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
              <div className="space-y-2 sm:col-span-2">
                <SearchableCombobox
                  label="Farm"
                  items={farmOptions}
                  value={formData.farm_id ? String(formData.farm_id) : ''}
                  onValueChange={updateFarm}
                  showCode
                  placeholder={loadingFarms ? 'Loading farms...' : 'Select farm...'}
                  className="w-full"
                />
                {!loadingFarms && farmOptions.length === 0 ? (
                  <p className="text-xs leading-5 text-amber-700">
                    No active farms found for this FMS type.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ['full_location_code', 'Location Code'],
                ['addr1', 'Address Line 1'],
                ['addr2', 'Address Line 2'],
                ['city', 'City'],
                ['province', 'Province'],
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
              <div className="flex items-center justify-between rounded-md border border-stone-200 px-4 py-3 sm:col-span-2">
                <Label>Active Warehouse</Label>
                <Switch
                  checked={formData.is_active ?? true}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                />
              </div>
            </div>
          </section>
        </main>
      </form>
    </div>
  )
}

