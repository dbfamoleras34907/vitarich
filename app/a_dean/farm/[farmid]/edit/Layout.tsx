'use client'
// build 2
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
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Building2, Factory, MapPin, Plus, Save, Warehouse, Wrench } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { getFarmFull, updateFarmFull, getLastCode, type AssociatedWarehousePayload, type FarmBuildingPayload, type FarmChildRow, type FarmFormData, type FarmFullPayload } from './api'
import { toast } from 'sonner'
import { useRouter, useParams } from 'next/navigation'
import SearchableCombobox, { type ComboboxItemType } from '@/components/SearchableCombobox'
import { getWarehouses } from '../../../warehouse/api'
import type { WarehouseData } from '@/lib/types'

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

const machineFields: FieldConfig[] = [
    { code: 'code', label: 'Machine Code', readOnly: true },
    { code: 'name', label: 'Machine Name', placeholder: 'Machine name' },
    { code: 'capacity', label: 'Capacity', type: 'number', placeholder: 'Egg capacity' },
]

const compact = (value: unknown) => String(value ?? '').trim()
const displayValue = (value: unknown) => String(value ?? '')

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

export default function Layout() {

    const router = useRouter()
    const params = useParams()
    const farmId = Number(params.farmid)

    const [buildings, setBuildings] = useState<FarmBuildingPayload[]>([])
    const [machines, setMachines] = useState<FarmChildRow[]>([])

    const [farmData, setFarmData] = useState<FarmFormData>({})
    const [addressData, setAddressData] = useState<FarmFormData>({})
    const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
    const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([])
    const [defaultFeedWarehouse, setDefaultFeedWarehouse] = useState('')
    const [loadingWarehouses, setLoadingWarehouses] = useState(false)
    const showBuildingSection = false

    const [buildingCounter, setBuildingCounter] = useState<number | null>(null)
    const [penCounter, setPenCounter] = useState<number | null>(null)
    const [machineCounter, setMachineCounter] = useState<number | null>(null)

    const buildingObj = [
        { code: "code", name: "Building Code", type: "text" },
        { code: "name", name: "Building Name", type: "text" },
        { code: "status", name: "Status", type: "text" },
        { code: "remarks", name: "Remarks", type: "text", isLong: true },
    ]

    const penObj = [
        { code: "code", name: "Pen Code", type: "text" },
        { code: "name", name: "Pen Name", type: "text" },
        { code: "status", name: "Status", type: "text" },
    ]

    const requiredFmsType = FARM_TYPE_TO_WAREHOUSE_FMS_TYPE[farmData.farm_type]

    const warehouseOptions: ComboboxItemType[] = useMemo(
        () =>
            warehouses
                .filter(warehouse => {
                    const code = compact(warehouse.whse_code)
                    const warehouseFmsType = compact(warehouse.fms_type)

                    return code && (!requiredFmsType || warehouseFmsType === requiredFmsType)
                })
                .map(warehouse => ({
                    code: String(warehouse.whse_code),
                    name: warehouse.whse_name || warehouse.full_location_code || 'Unnamed warehouse',
                })),
        [requiredFmsType, warehouses]
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

    const normalizeAssociatedWarehouseCodes = (value: unknown) => {
        if (!Array.isArray(value)) return []

        return value
            .map(item => {
                if (typeof item === 'string') return item
                if (item && typeof item === 'object' && 'whse_code' in item) {
                    return String((item as AssociatedWarehousePayload).whse_code || '')
                }
                return ''
            })
            .filter(Boolean)
    }

    // const updateFarm = (code: string, value: any) => {

    //     setFarmData((prev: any) => {

    //         if (code === "ref" && !value) {
    //             return { ...prev, ref: value, ref_type: "" }
    //         }

    //         return { ...prev, [code]: value }
    //     })
    // }

    const updateFarm = (code: string, value: string) => {

        setFarmData(prev => {
            if (code === "farm_type") {
                return { ...prev, farm_type: value, ref_type: value }
            }

            return { ...prev, [code]: value }
        })

        if (code === "farm_type") {
            setSelectedWarehouses([])
            setDefaultFeedWarehouse('')
        }
    }


    const updateAddress = (code: string, value: string) => {
        setAddressData(prev => ({ ...prev, [code]: value }))
    }

    const updateBuilding = (id: number | string | undefined, code: string, value: string) => {

        setBuildings(prev =>
            prev.map(b =>
                b.id === id
                    ? { ...b, data: { ...b.data, [code]: value } }
                    : b
            )
        )

    }

    const updatePen = (buildingId: number | string | undefined, penId: number | string | undefined, code: string, value: string) => {

        setBuildings(prev =>
            prev.map(b => {

                if (b.id !== buildingId) return b

                return {
                    ...b,
                    pens: b.pens.map(p =>
                        p.id === penId
                            ? { ...p, data: { ...p.data, [code]: value } }
                            : p
                    )
                }

            })
        )

    }

    const updateMachine = (id: number | string | undefined, code: string, value: string) => {

        setMachines(prev =>
            prev.map(m =>
                m.id === id
                    ? { ...m, data: { ...m.data, [code]: value } }
                    : m
            )
        )

    }

    // ================= BUILDING =================

    const addBuilding = () => {

        if (buildingCounter === null) return

        const next = buildingCounter + 1
        setBuildingCounter(next)

        const code = `BLD${next.toString().padStart(6, "0")}`

        setBuildings(prev => [
            ...prev,
            {
                id: Date.now(),
                data: { code },
                pens: []
            }
        ])
    }

    // ================= PEN =================

    const addPen = (buildingId: number | string | undefined) => {

        if (penCounter === null) return

        const next = penCounter + 1
        setPenCounter(next)

        const code = `PEN${next.toString().padStart(6, "0")}`

        setBuildings(prev =>
            prev.map(b => {

                if (b.id !== buildingId) return b

                return {
                    ...b,
                    pens: [
                        ...(b.pens || []),
                        {
                            id: Date.now() + Math.random(),
                            data: { code }
                        }
                    ]
                }

            })
        )

    }
    // ================= MACHINE =================

    const addMachine = () => {

        if (machineCounter === null) return

        const next = machineCounter + 1
        setMachineCounter(next)

        const code = `MAC${next.toString().padStart(6, "0")}`

        setMachines(prev => [
            ...prev,
            {
                id: Date.now(),
                data: { code }
            }
        ])
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
            setSelectedWarehouses(prev => [...prev, code])
        }
    }

    // ================= SUBMIT =================

    const handleUpdateFarm = async () => {
        // if (farmData.ref && !farmData.ref_type) {
        //     toast("Reference Type is required when Reference is filled", {
        //         position: "top-center"
        //     })
        //     return
        // }
        const associatedWarehouses = selectedWarehouses.map(code => {
            const warehouse = warehouses.find(item => item.whse_code === code)

            return {
                id: warehouse?.id ?? null,
                whse_code: code,
                whse_name: warehouse?.whse_name ?? null,
                is_default_feed: code === defaultFeedWarehouse,
            }
        })

        const payload: FarmFullPayload = {
            farm: farmData,
            address: addressData,
            buildings,
            machines,
            associated_warehouses: associatedWarehouses,
        }
        console.log({ farmId, payload })
        try {
            await updateFarmFull(farmId, payload)

            toast("Farm updated successfully", { position: 'top-center' })

            router.push("/a_dean/farm")
        } catch (error) {
            toast('Error: ' + (error instanceof Error ? error.message : 'Unable to update farm'))
        }

    }

    // ================= LOAD DATA =================

    useEffect(() => {

        router.prefetch("/a_dean/farm")

        async function loadFarm() {

            const data = await getFarmFull(farmId)

            setFarmData(data.farm || {})
            setAddressData(data.address || {})
            setBuildings(data.buildings || [])
            setMachines(data.machines || [])
            setSelectedWarehouses(
                normalizeAssociatedWarehouseCodes(
                    data.associated_warehouses ?? data.farm?.associated_warehouses
                )
            )
            const associatedWarehouses = data.associated_warehouses ?? data.farm?.associated_warehouses
            const defaultWarehouse = Array.isArray(associatedWarehouses)
                ? associatedWarehouses.find(
                    (warehouse: unknown) =>
                        warehouse &&
                        typeof warehouse === 'object' &&
                        'is_default_feed' in warehouse &&
                        Boolean((warehouse as AssociatedWarehousePayload).is_default_feed)
                )
                : null

            setDefaultFeedWarehouse(
                defaultWarehouse && typeof defaultWarehouse === 'object' && 'whse_code' in defaultWarehouse
                    ? String((defaultWarehouse as AssociatedWarehousePayload).whse_code || '')
                    : ''
            )

        }

        loadFarm()

    }, [farmId, router])

    useEffect(() => {
        async function loadWarehouses() {
            setLoadingWarehouses(true)

            try {
                const result = await getWarehouses()

                if (result.success && Array.isArray(result.data)) {
                    setWarehouses(result.data)
                    return
                }

                toast('Unable to load warehouses')
            } catch (error) {
                toast('Error: ' + (error instanceof Error ? error.message : 'Unable to load warehouses'))
            } finally {
                setLoadingWarehouses(false)
            }
        }

        loadWarehouses()
    }, [])

    // ================= LOAD COUNTERS =================

    useEffect(() => {
        try {

            async function loadCounters() {

                const bLast = await getLastCode("v_last_building_code")
                const pLast = await getLastCode("v_last_pen_code")
                const mLast = await getLastCode("v_last_machine_code")

                setBuildingCounter(bLast)
                setPenCounter(pLast)
                setMachineCounter(mLast)

            }

            loadCounters()

        } catch (error) {
            console.log("Error loading counters:", error)
        }
    }, [])

    return (
        <div className="min-h-screen bg-[#f7f5f1]">
            <div className="sticky top-0 z-10 border-b border-stone-200 bg-[#f7f5f1]/95 px-4 py-3 backdrop-blur sm:px-8">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Breadcrumb
                        SecondPreviewPageName="Farm"
                        SecondPreviewPageLink="/a_dean/farm"
                        CurrentPageName="Edit Farm"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="secondary" onClick={() => router.push('/a_dean/farm')}>
                            <ArrowLeft className="size-4" />
                            Back
                        </Button>
                        <Button type="button" onClick={handleUpdateFarm}>
                            <Save className="size-4" />
                            Update Farm
                        </Button>
                    </div>
                </div>
            </div>

            <main className="mx-auto grid w-full max-w-7xl gap-3 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:px-8">
                <div className="space-y-3">
                <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-4 border-b border-stone-200 pb-5">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-stone-900 text-white">
                            <Factory className="size-6" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl font-semibold text-stone-950">Farm Master Data</h1>
                                <Badge variant="outline">Edit</Badge>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-stone-600">
                                Update farm classification, registration, and contact details.
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-stone-50 text-stone-700">
                            <Warehouse className="size-4" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-stone-950">Associated Warehouses</h2>
                            <p className="mt-1 text-sm text-stone-500">Warehouses linked to this farm record.</p>
                        </div>
                    </div>
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
                                No {selectedFarmTypeLabel.toLowerCase()} warehouses found for association.
                            </p>
                        ) : null}
                    </div>
                </section>

                <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-stone-50 text-stone-700">
                            <MapPin className="size-4" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-stone-950">Location</h2>
                            <p className="mt-1 text-sm text-stone-500">Address fields used for farm lookup and logistics.</p>
                        </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
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

                </div>

                <aside className="min-w-0 space-y-3">
                {showBuildingSection ? (
                    <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-stone-50 text-stone-700">
                                    <Building2 className="size-4" />
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold text-stone-950">Buildings And Pens</h2>
                                    <p className="mt-1 text-sm text-stone-500">Housing structure and pen setup.</p>
                                </div>
                            </div>
                            <Button size="sm" onClick={addBuilding} disabled={buildingCounter === null}>
                                <Plus className="size-4" />
                                Add Building
                            </Button>
                        </div>

                        <div className="mt-5 space-y-3">
                            {buildings.map((b, idx) => (
                                <div key={b.id} className="rounded-md border border-stone-200">
                                    <div className="flex items-center justify-between bg-stone-50 px-3 py-2">
                                        <div className="text-sm font-medium text-stone-950">Building {idx + 1}</div>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            disabled={penCounter === null}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                addPen(b.id)
                                            }}
                                        >
                                            <Plus className="size-4" />
                                            Pen
                                        </Button>
                                    </div>
                                    <div className="space-y-3 p-3">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {buildingObj.map((i, x) => (
                                                <div key={x} className={i.isLong ? "space-y-2 sm:col-span-2" : "space-y-2"}>
                                                    <Label className="text-xs">{i.name}</Label>
                                                    <Input
                                                        className="h-8 text-sm"
                                                        value={b.data?.[i.code] || ""}
                                                        onChange={e => updateBuilding(b.id, i.code, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {b.pens?.map((p, pIdx: number) => (
                                            <div key={p.id} className="rounded-md border border-stone-200 bg-stone-50 p-3">
                                                <div className="mb-2 text-xs font-medium text-stone-700">Pen {pIdx + 1}</div>
                                                <div className="grid gap-3 sm:grid-cols-3">
                                                    {penObj.map((i, x) => (
                                                        <div key={x} className="space-y-2">
                                                            <Label className="text-xs">{i.name}</Label>
                                                            <Input
                                                                className="h-8 text-sm"
                                                                value={p.data?.[i.code] || ""}
                                                                onChange={e => updatePen(b.id, p.id, i.code, e.target.value)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}

                <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-stone-50 text-stone-700">
                                <Wrench className="size-4" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-stone-950">Machines</h2>
                                <p className="mt-1 text-sm text-stone-500">Hatchery equipment or site machines.</p>
                            </div>
                        </div>
                        <Button size="sm" onClick={addMachine} disabled={machineCounter === null}>
                            <Plus className="size-4" />
                            Add Machine
                        </Button>
                    </div>

                    <div className="mt-5 space-y-3">
                        {machines.map((m, idx) => (
                            <div key={m.id} className="rounded-md border border-stone-200 bg-white p-3">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div className="text-sm font-medium text-stone-950">Machine {idx + 1}</div>
                                    <Badge variant="outline">{m.data?.code || 'Machine'}</Badge>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {machineFields.map((field) => (
                                        <TextField
                                            key={field.code}
                                            field={field}
                                            value={displayValue(m.data?.[field.code])}
                                            onChange={(code, value) => updateMachine(m.id, code, value)}
                                        />
                                    ))}
                                    <div className="space-y-2">
                                        <Label>Type</Label>
                                        <Select
                                            value={m.data?.type ?? ''}
                                            onValueChange={(value) => updateMachine(m.id, 'type', value)}
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
                                        <Label htmlFor={`machine-remarks-${m.id}`}>Remarks</Label>
                                        <Textarea
                                            id={`machine-remarks-${m.id}`}
                                            value={m.data?.remarks ?? ''}
                                            placeholder="Machine condition, usage notes, or capacity details"
                                            onChange={(event) => updateMachine(m.id, 'remarks', event.target.value)}
                                            className="min-h-20"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                </aside>
            </main>
        </div>
    )

}
