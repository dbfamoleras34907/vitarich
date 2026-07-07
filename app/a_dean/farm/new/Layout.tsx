'use client'

import SearchableCombobox, { type ComboboxItemType } from '@/components/SearchableCombobox'
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
import type { WarehouseData } from '@/lib/types'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Building2,
  Factory,
  MapPin,
  Plus,
  Save,
  Trash2,
  Warehouse,
  Wrench,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getWarehouses } from '../../warehouse/api'
import {
  addFarmFull,
  formatCode,
  generateNextCode,
  getAssignedWarehouseCodes,
  getLastCode,
  type FarmFullPayload,
} from './api'

type FormDataMap = Record<string, string>

type FieldConfig = {
  code: string
  label: string
  type?: string
  placeholder?: string
  required?: boolean
  readOnly?: boolean
  helper?: string
}

type SelectOption = {
  value: string
  label: string
}

type PenRow = {
  id: number
  data: FormDataMap
}

type BuildingRow = {
  id: number
  data: FormDataMap
  pens: PenRow[]
  expanded: boolean
}

type MachineRow = {
  id: number
  data: FormDataMap
}

const FARM_TYPES: SelectOption[] = [
  { value: 'BE', label: 'Breeder Farm' },
  { value: 'HA', label: 'Hatcher' },
  { value: 'BR', label: 'Broiler' },
]

const FARM_TYPE_TO_WAREHOUSE_FMS_TYPE: Record<string, string> = {
  BE: 'Breeder',
  HA: 'Hatchery',
  BR: 'Broiler',
}

const MACHINE_TYPES: SelectOption[] = [
  { value: 'S', label: 'Setter' },
  { value: 'H', label: 'Hatcher' },
]

const farmFields: FieldConfig[] = [
  {
    code: 'code',
    label: 'Farm Code',
    readOnly: true,
    required: true,
    helper: 'Generated from the latest farm sequence.',
  },
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

const buildingFields: FieldConfig[] = [
  { code: 'code', label: 'Building Code', readOnly: true },
  { code: 'name', label: 'Building Name' },
  { code: 'status', label: 'Status' },
]

const penFields: FieldConfig[] = [
  { code: 'code', label: 'Pen Code', readOnly: true },
  { code: 'name', label: 'Pen Name' },
  { code: 'status', label: 'Status' },
]

const machineFields: FieldConfig[] = [
  { code: 'code', label: 'Machine Code', readOnly: true },
  { code: 'name', label: 'Machine Name', placeholder: 'Machine name' },
  { code: 'capacity', label: 'Capacity', type: 'number', placeholder: 'Egg capacity' },
]

const compact = (value: unknown) => String(value ?? '').trim()
const displayValue = (value: unknown) => String(value ?? '')

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
      {field.helper ? <p className="text-xs leading-5 text-stone-500">{field.helper}</p> : null}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center">
      <div className="text-sm font-medium text-stone-800">{title}</div>
      <p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>
    </div>
  )
}

export default function Layout() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [buildingCounter, setBuildingCounter] = useState<number | null>(null)
  const [penCounter, setPenCounter] = useState<number | null>(null)
  const [machineCounter, setMachineCounter] = useState<number | null>(null)
  const [farmData, setFarmData] = useState<FormDataMap>({})
  const [addressData, setAddressData] = useState<FormDataMap>({})
  const [buildings, setBuildings] = useState<BuildingRow[]>([])
  const [machines, setMachines] = useState<MachineRow[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [assignedWarehouseCodes, setAssignedWarehouseCodes] = useState<string[]>([])
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([])
  const [defaultFeedWarehouse, setDefaultFeedWarehouse] = useState('')
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)
  const showBuildingSection = false

  const availableWarehouses = useMemo(() => {
    const unavailableCodes = new Set(assignedWarehouseCodes)
    const requiredFmsType = FARM_TYPE_TO_WAREHOUSE_FMS_TYPE[farmData.farm_type]

    return warehouses.filter((warehouse) => {
      const code = compact(warehouse.whse_code)
      const warehouseFmsType = compact(warehouse.fms_type)

      return code && !unavailableCodes.has(code) && warehouseFmsType === requiredFmsType
    })
  }, [assignedWarehouseCodes, farmData.farm_type, warehouses])

  const warehouseOptions: ComboboxItemType[] = useMemo(
    () =>
      availableWarehouses.map((warehouse) => ({
          code: String(warehouse.whse_code ?? ''),
          name: warehouse.whse_name || warehouse.full_location_code || 'Unnamed warehouse',
      })),
    [availableWarehouses]
  )

  const locationPreview = useMemo(
    () =>
      [addressData.address, addressData.barangay, addressData.city, addressData.province]
        .map(compact)
        .filter(Boolean)
        .join(', '),
    [addressData.address, addressData.barangay, addressData.city, addressData.province]
  )

  const selectedFarmTypeLabel =
    FARM_TYPES.find((type) => type.value === farmData.farm_type)?.label ?? 'Select farm type'

  const updateFarm = (code: string, value: string) => {
    setFarmData((prev) => ({ ...prev, [code]: value }))

    if (code === 'farm_type') {
      setSelectedWarehouses([])
      setDefaultFeedWarehouse('')
    }
  }

  const updateAddress = (code: string, value: string) => {
    setAddressData((prev) => ({ ...prev, [code]: value }))
  }

  const addBuilding = () => {
    if (buildingCounter === null) return

    const next = buildingCounter + 1
    setBuildingCounter(next)

    setBuildings((prev) => [
      ...prev,
      {
        id: Date.now(),
        data: { code: formatCode('BLD', next) },
        pens: [],
        expanded: true,
      },
    ])
  }

  const updateBuilding = (id: number, code: string, value: string) => {
    setBuildings((prev) =>
      prev.map((building) =>
        building.id === id ? { ...building, data: { ...building.data, [code]: value } } : building
      )
    )
  }

  const toggleBuilding = (id: number) => {
    setBuildings((prev) =>
      prev.map((building) =>
        building.id === id ? { ...building, expanded: !building.expanded } : building
      )
    )
  }

  const addPen = (buildingId: number) => {
    if (penCounter === null) return

    const next = penCounter + 1
    setPenCounter(next)

    setBuildings((prev) =>
      prev.map((building) =>
        building.id === buildingId
          ? {
              ...building,
              pens: [...building.pens, { id: Date.now(), data: { code: formatCode('PEN', next) } }],
            }
          : building
      )
    )
  }

  const updatePen = (buildingId: number, penId: number, code: string, value: string) => {
    setBuildings((prev) =>
      prev.map((building) => {
        if (building.id !== buildingId) return building

        return {
          ...building,
          pens: building.pens.map((pen) =>
            pen.id === penId ? { ...pen, data: { ...pen.data, [code]: value } } : pen
          ),
        }
      })
    )
  }

  const addMachine = () => {
    if (machineCounter === null) return

    const next = machineCounter + 1
    setMachineCounter(next)

    setMachines((prev) => [
      ...prev,
      {
        id: Date.now(),
        data: { code: formatCode('MAC', next) },
      },
    ])
  }

  const updateMachine = (id: number, code: string, value: string) => {
    setMachines((prev) =>
      prev.map((machine) =>
        machine.id === id ? { ...machine, data: { ...machine.data, [code]: value } } : machine
      )
    )
  }

  const removeMachine = (id: number) => {
    setMachines((prev) => prev.filter((machine) => machine.id !== id))
  }

  const updateSelectedWarehouses = (codes: string[]) => {
    setSelectedWarehouses(codes)

    if (defaultFeedWarehouse && !codes.includes(defaultFeedWarehouse)) {
      setDefaultFeedWarehouse('')
    }
  }

  const updateDefaultFeedWarehouse = (code: string) => {
    setDefaultFeedWarehouse(code)

    if (code && !selectedWarehouses.includes(code)) {
      setSelectedWarehouses((prev) => [...prev, code])
    }
  }

  const handleAddFarm = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!compact(farmData.code) || !compact(farmData.name)) {
      toast.error('Farm code and farm name are required.')
      return
    }

    setLoading(true)

    try {
      const associatedWarehouses = selectedWarehouses.map((code) => {
        const warehouse = warehouses.find((item) => item.whse_code === code)

        return {
          id: warehouse?.id ?? null,
          whse_code: code,
          whse_name: warehouse?.whse_name ?? null,
          is_default_feed: code === defaultFeedWarehouse,
        }
      })

      const output: FarmFullPayload = {
        farm: farmData,
        address: addressData,
        buildings,
        machines,
        associated_warehouses: associatedWarehouses,
      }

      const id = await addFarmFull(output)

      toast.success(`Farm added with ID of ${id}`)
      router.push('/a_dean/farm')
    } catch (error) {
      toast.error('Error: ' + (error instanceof Error ? error.message : 'Unable to add farm'))
    } finally {
      setLoading(false)
    }
  }

  const loadFarmCode = useCallback(async () => {
    const code = await generateNextCode('v_last_farm_code', 'FRM', 6)
    setFarmData((prev) => ({ ...prev, code }))
  }, [])

  useEffect(() => {
    router.prefetch('/a_dean/farm')
    loadFarmCode()
  }, [loadFarmCode, router])

  useEffect(() => {
    async function loadWarehouses() {
      setLoadingWarehouses(true)

      try {
        const [warehousesResult, assignedCodes] = await Promise.all([
          getWarehouses(),
          getAssignedWarehouseCodes(),
        ])

        setAssignedWarehouseCodes(assignedCodes)

        if (warehousesResult.success && Array.isArray(warehousesResult.data)) {
          setWarehouses(warehousesResult.data)
          return
        }

        toast.error('Unable to load warehouses.')
      } catch (error) {
        toast.error('Error: ' + (error instanceof Error ? error.message : 'Unable to load warehouses'))
      } finally {
        setLoadingWarehouses(false)
      }
    }

    loadWarehouses()
  }, [])

  useEffect(() => {
    async function loadCounters() {
      const [bLast, pLast, mLast] = await Promise.all([
        getLastCode('v_last_building_code'),
        getLastCode('v_last_pen_code'),
        getLastCode('v_last_machine_code'),
      ])

      setBuildingCounter(bLast)
      setPenCounter(pLast)
      setMachineCounter(mLast)
    }

    loadCounters()
  }, [])

  return (
    <div className="bg-[#f7f5f1]">
      <form onSubmit={handleAddFarm}>
        <div className="sticky top-0 z-10 border-b border-stone-200 bg-[#f7f5f1]/95 px-4 py-3 backdrop-blur sm:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Breadcrumb
              SecondPreviewPageName="Farm"
              SecondPreviewPageLink="/a_dean/farm"
              CurrentPageName="New Farm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => router.push('/a_dean/farm')}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="size-4" />
                {loading ? 'Saving...' : 'Save Farm'}
              </Button>
            </div>
          </div>
        </div>

        <main className="mx-auto grid w-full max-w-7xl gap-3 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:px-8">
          <div className="space-y-3">
            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-stone-900 text-white">
                    <Factory className="size-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-semibold text-stone-950">Farm Master Data</h1>
                      <Badge variant="outline">Farm Management</Badge>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                      Maintain farm classification, registration, contact details, warehouse links, and site assets used by FMS transactions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {farmFields.map((field) => (
                  <TextField
                    key={field.code}
                    field={field}
                    value={displayValue(farmData[field.code])}
                    onChange={updateFarm}
                  />
                ))}
                <div className="space-y-2 sm:col-span-2">
                  <Label required>Farm Type</Label>
                  <Select
                    value={farmData.farm_type ?? ''}
                    onValueChange={(value) => updateFarm('farm_type', value)}
                  >
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
                  <p className="text-xs leading-5 text-stone-500">
                    Warehouse choices are filtered to the matching FMS type.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={MapPin}
                title="Location"
                description="Farm address fields used for operational lookup, logistics coordination, and reports."
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {addressFields.map((field) => (
                  <TextField
                    key={field.code}
                    field={field}
                    value={displayValue(addressData[field.code])}
                    onChange={updateAddress}
                  />
                ))}
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address Preview</Label>
                  <div className="min-h-10 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    {locationPreview || 'Address will be assembled from the location fields.'}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={Warehouse}
                title="Associated Warehouses"
                description="Link this farm to warehouses that should appear with the farm in master data and transaction screens."
              />
              <div className="mt-5 space-y-2">
                <SearchableCombobox
                  multiple
                  label="Associated Warehouse"
                  items={warehouseOptions}
                  value={selectedWarehouses}
                  onValueChange={updateSelectedWarehouses}
                  showCode
                  placeholder={
                    loadingWarehouses
                      ? 'Loading warehouses...'
                      : farmData.farm_type
                        ? 'Select warehouses...'
                        : 'Select farm type first'
                  }
                  className="w-full"
                />
                <SearchableCombobox
                  label="Default Feed Warehouse"
                  items={warehouseOptions}
                  value={defaultFeedWarehouse}
                  onValueChange={updateDefaultFeedWarehouse}
                  showCode
                  placeholder={
                    loadingWarehouses
                      ? 'Loading warehouses...'
                      : farmData.farm_type
                        ? 'Select default feed warehouse...'
                        : 'Select farm type first'
                  }
                  className="w-full"
                />
                {loadingWarehouses ? (
                  <p className="text-xs leading-5 text-stone-500">Loading warehouses...</p>
                ) : null}
                {!loadingWarehouses && !farmData.farm_type ? (
                  <p className="text-xs leading-5 text-stone-500">
                    Select a farm type to show matching warehouse FMS types.
                  </p>
                ) : null}
                {!loadingWarehouses && farmData.farm_type && warehouseOptions.length === 0 ? (
                  <p className="text-xs leading-5 text-amber-700">
                    No unassigned {selectedFarmTypeLabel.toLowerCase()} warehouses found for association.
                  </p>
                ) : null}
              </div>
            </section>

          </div>

          <aside className="min-w-0 space-y-3">
            {showBuildingSection ? (
              <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <SectionHeader
                    icon={Building2}
                    title="Buildings And Pens"
                    description="Optional housing structure and pen setup for farms that require deeper site hierarchy."
                  />
                  <Button type="button" size="sm" onClick={addBuilding} disabled={buildingCounter === null}>
                    <Plus className="size-4" />
                    Add Building
                  </Button>
                </div>

                <div className="mt-5 space-y-3">
                  {buildings.length === 0 ? (
                    <EmptyState
                      title="No buildings added"
                      description="Add a building when this farm needs building and pen tracking."
                    />
                  ) : null}

                  {buildings.map((building, index) => (
                    <div key={building.id} className="rounded-md border border-stone-200">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between bg-stone-50 px-3 py-2 text-left"
                        onClick={() => toggleBuilding(building.id)}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-stone-900">
                          Building {index + 1}
                          {building.expanded ? <ArrowDown className="size-4" /> : <ArrowUp className="size-4" />}
                        </span>
                      </button>

                      {building.expanded ? (
                        <div className="space-y-4 p-3">
                          <div className="grid gap-3 sm:grid-cols-3">
                            {buildingFields.map((field) => (
                              <TextField
                                key={field.code}
                                field={field}
                                value={displayValue(building.data[field.code])}
                                onChange={(code, value) => updateBuilding(building.id, code, value)}
                              />
                            ))}
                            <div className="space-y-2 sm:col-span-3">
                              <Label htmlFor={`building-remarks-${building.id}`}>Remarks</Label>
                              <Textarea
                                id={`building-remarks-${building.id}`}
                                value={building.data.remarks ?? ''}
                                onChange={(event) => updateBuilding(building.id, 'remarks', event.target.value)}
                                className="min-h-20"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={penCounter === null}
                              onClick={() => addPen(building.id)}
                            >
                              <Plus className="size-4" />
                              Pen
                            </Button>
                          </div>

                          {building.pens.length > 0 ? (
                            <div className="rounded-md border border-stone-200">
                              {building.pens.map((pen, penIndex) => (
                                <div
                                  key={pen.id}
                                  className="grid gap-3 border-t border-stone-200 p-3 first:border-t-0 sm:grid-cols-[3rem_1fr_1fr_1fr]"
                                >
                                  <div className="flex items-end text-xs font-medium text-stone-500">
                                    #{penIndex + 1}
                                  </div>
                                  {penFields.map((field) => (
                                    <TextField
                                      key={field.code}
                                      field={field}
                                      value={displayValue(pen.data[field.code])}
                                      onChange={(code, value) => updatePen(building.id, pen.id, code, value)}
                                    />
                                  ))}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <SectionHeader
                  icon={Wrench}
                  title="Machines"
                  description="Optional hatchery equipment or site machines assigned to this farm master record."
                />
                <Button type="button" size="sm" onClick={addMachine} disabled={machineCounter === null}>
                  <Plus className="size-4" />
                  Add Machine
                </Button>
              </div>

              <div className="mt-5 space-y-3">
                {machines.length === 0 ? (
                  <EmptyState
                    title="No machines added"
                    description="Add machines only when the farm requires equipment tracking."
                  />
                ) : null}

                {machines.map((machine, index) => (
                  <div key={machine.id} className="rounded-md border border-stone-200 bg-white p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-stone-950">Machine {index + 1}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{machine.data.code || 'New Machine'}</Badge>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeMachine(machine.id)}
                          aria-label={`Remove machine ${index + 1}`}
                        >
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {machineFields.map((field) => (
                        <TextField
                          key={field.code}
                          field={field}
                          value={displayValue(machine.data[field.code])}
                          onChange={(code, value) => updateMachine(machine.id, code, value)}
                        />
                      ))}
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={machine.data.type ?? ''}
                          onValueChange={(value) => updateMachine(machine.id, 'type', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select machine type" />
                          </SelectTrigger>
                          <SelectContent>
                            {MACHINE_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`machine-remarks-${machine.id}`}>Remarks</Label>
                        <Textarea
                          id={`machine-remarks-${machine.id}`}
                          value={machine.data.remarks ?? ''}
                          placeholder="Machine condition, usage notes, or capacity details"
                          onChange={(event) => updateMachine(machine.id, 'remarks', event.target.value)}
                          className="min-h-20"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <SectionHeader
                icon={Factory}
                title="Summary"
                description="Quick check before saving the new farm record."
              />
              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-xs font-medium uppercase text-stone-500">Farm Type</div>
                  <div className="mt-1 font-medium text-stone-950">{selectedFarmTypeLabel}</div>
                </div>
                <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-xs font-medium uppercase text-stone-500">Warehouses</div>
                  <div className="mt-1 font-medium text-stone-950">{selectedWarehouses.length}</div>
                </div>
                <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-xs font-medium uppercase text-stone-500">Default Feed WH</div>
                  <div className="mt-1 font-medium text-stone-950">
                    {defaultFeedWarehouse || 'Not selected'}
                  </div>
                </div>
                <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-xs font-medium uppercase text-stone-500">Machines</div>
                  <div className="mt-1 font-medium text-stone-950">{machines.length}</div>
                </div>
              </div>
            </section>
          </aside>
        </main>
      </form>
    </div>
  )
}
