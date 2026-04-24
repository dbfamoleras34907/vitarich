'use client'
// build 2
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import Breadcrumb from '@/lib/Breadcrumb'
import { Plus } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { getFarmFull, updateFarmFull, generateNextCode, getLastCode } from './api'
import { toast } from 'sonner'
import { useRouter, useParams } from 'next/navigation'
import SearchableDropdown from '@/lib/SearchableDropdown'

export default function Layout() {

    const router = useRouter()
    const params = useParams()
    const farmId = Number(params.farmid)

    const [buildings, setBuildings] = useState<any[]>([])
    const [machines, setMachines] = useState<any[]>([])

    const [farmData, setFarmData] = useState<any>({})
    const [addressData, setAddressData] = useState<any>({})

    const [buildingCounter, setBuildingCounter] = useState<number | null>(null)
    const [penCounter, setPenCounter] = useState<number | null>(null)
    const [machineCounter, setMachineCounter] = useState<number | null>(null)

    const farmObj = [
        { code: "code", name: "Farm Code", type: "text" },
        { code: "name", name: "Farm Name", type: "text" },
        {
            code: "farm_type", name: "Farm Type", type: "search", list: [
                { code: "BE", name: "Breeder Farm" },
                { code: "HA", name: "Hatcher" },
                { code: "BR", name: "Broiler" },
            ]
        },
        { code: "tin", name: "TIN No.", type: "text" },
        { code: "tel", name: "Telephone No.", type: "text" },
        { code: "contact_person", name: "Contact Person", type: "text" },
        { code: "contact_number", name: "Contact Number", type: "text" },
        { code: "ref", name: "Breeder ID Reference", type: "text" },
        // {
        //     code: "ref_type",
        //     name: "Reference Type",
        //     type: "search",
        //     list: [
        //         { code: "BE", name: "Breeder Farm" },
        //         { code: "HA", name: "Hatcher" },
        //         { code: "BR", name: "Broiler" },
        //     ]
        // },

    ]

    const addressObj = [
        { code: "address", name: "Address", type: "text" },
        { code: "barangay", name: "Barangay", type: "text" },
        { code: "city", name: "City / Municipality", type: "text" },
        { code: "province", name: "Province", type: "text" },
    ]

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

    const machineObj = [
        { code: "code", name: "Machine Code", type: "text" },
        { code: "name", name: "Machine Name", type: "text" },
        {
            code: "type", name: "Type", type: "search", list: [
                { code: "S", name: "Setter" },
                { code: "H", name: "Hatcher" },
            ]
        },
        { code: "capacity", name: "Capacity", type: "number" },
        { code: "remarks", name: "Remarks", type: "text", isLong: true },
    ]

    // const updateFarm = (code: string, value: any) => {

    //     setFarmData((prev: any) => {

    //         if (code === "ref" && !value) {
    //             return { ...prev, ref: value, ref_type: "" }
    //         }

    //         return { ...prev, [code]: value }
    //     })
    // }

    const updateFarm = (code: string, value: any) => {

        setFarmData((prev: any) => {

            // clear both if ref removed
            if (code === "ref" && !value) {
                return { ...prev, ref: value, ref_type: "" }
            }

            // auto-sync ref_type with farm_type
            if (code === "farm_type") {
                return { ...prev, farm_type: value, ref_type: value }
            }

            return { ...prev, [code]: value }
        })
    }


    const updateAddress = (code: string, value: any) => {
        setAddressData((prev: any) => ({ ...prev, [code]: value }))
    }

    const updateBuilding = (id: number, code: string, value: any) => {

        setBuildings(prev =>
            prev.map(b =>
                b.id === id
                    ? { ...b, data: { ...b.data, [code]: value } }
                    : b
            )
        )

    }

    const updatePen = (buildingId: number, penId: number, code: string, value: any) => {

        setBuildings(prev =>
            prev.map(b => {

                if (b.id !== buildingId) return b

                return {
                    ...b,
                    pens: b.pens.map((p: any) =>
                        p.id === penId
                            ? { ...p, data: { ...p.data, [code]: value } }
                            : p
                    )
                }

            })
        )

    }

    const updateMachine = (id: number, code: string, value: any) => {

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

    const addPen = (buildingId: number) => {

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

    // ================= SUBMIT =================

    const handleUpdateFarm = async () => {
        // if (farmData.ref && !farmData.ref_type) {
        //     toast("Reference Type is required when Reference is filled", {
        //         position: "top-center"
        //     })
        //     return
        // }
        const payload = {
            farm: farmData,
            address: addressData,
            buildings,
            machines
        }
        console.log({ farmId, payload })
        // return
        await updateFarmFull(farmId, payload)

        toast("Farm updated successfully", { position: 'top-center' })

        router.push("/a_dean/farm")

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

        }

        loadFarm()

    }, [farmId])

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

        <div>

            <div className='mt-5 mx-4 flex justify-between items-center'>

                <Breadcrumb
                    SecondPreviewPageName='Settings'
                    FirstPreviewsPageName='Farm Management'
                    CurrentPageName='Edit Farm'
                />

                <Button onClick={handleUpdateFarm}>
                    Update Farm
                </Button>

            </div>

            <div className='bg-white shadow w-full mt-4 rounded'>

                {/* FARM DETAILS */}

                <div className='pt-4 px-4 font-semibold text-xl'>Details</div>

                <div className='grid  lg:grid-cols-2 gap-4 m-4'>

                    {farmObj.map((i, x) => (

                        <div key={x} className='space-y-2'>

                            <Label>{i.name}</Label>

                            {i.code === "code"
                                ? (
                                    <Input
                                        value={farmData.code || ""}
                                        readOnly
                                        className="bg-gray-100"
                                    />
                                )
                                : i.type === "search"
                                    ? (
                                        <SearchableDropdown
                                            list={i.list || []}
                                            disabled={i.code === "ref_type" && !farmData.ref}
                                            codeLabel="code"
                                            nameLabel="name"
                                            value={farmData[i.code] || ''}
                                            onChange={(val) => updateFarm(i.code, val)}
                                        />
                                    )
                                    : (
                                        <Input
                                            type={i.type}
                                            value={farmData[i.code] || ""}
                                            onChange={e => updateFarm(i.code, e.target.value)}
                                        />
                                    )
                            }

                        </div>

                    ))}

                </div>

                <Separator />

                {/* LOCATION */}

                <div className='pt-4 px-4 font-semibold text-xl'>Location</div>

                <div className='grid grid-cols-2 gap-4 m-4'>

                    {addressObj.map((i, x) => (

                        <div key={x} className='space-y-2'>

                            <Label>{i.name}</Label>

                            <Input
                                value={addressData[i.code] || ""}
                                onChange={e => updateAddress(i.code, e.target.value)}
                            />

                        </div>

                    ))}

                </div>

                <Separator />

                {/* BUILDINGS */}

                <div className='py-4 px-4 font-semibold text-xl flex justify-between'>

                    Buildings

                    <Button
                        size="sm"
                        onClick={addBuilding}
                        disabled={buildingCounter === null}
                    >
                        <Plus className="mr-1 h-4 w-4" /> Add Building
                    </Button>

                </div>

                <div className='space-y-3 m-4'>

                    {buildings.map((b, idx) => (

                        <div key={b.id} className='border rounded-md'>

                            <div className='flex items-center justify-between px-3 py-2 bg-gray-50'>

                                <div className='font-medium text-sm'>
                                    Building {idx + 1}
                                </div>

                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={penCounter === null}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        addPen(b.id)
                                    }}
                                >
                                    <Plus className="mr-1 h-4 w-4" /> Pen
                                </Button>

                            </div>

                            <div className='p-3 space-y-3'>

                                <div className='grid grid-cols-4 gap-3'>

                                    {buildingObj.map((i, x) => (

                                        <div key={x} className={i.isLong ? 'col-span-4' : ''}>

                                            <Label className='text-xs'>{i.name}</Label>

                                            <Input
                                                className='h-8 text-sm'
                                                value={b.data?.[i.code] || ""}
                                                onChange={e =>
                                                    updateBuilding(b.id, i.code, e.target.value)
                                                }
                                            />

                                        </div>

                                    ))}

                                </div>

                            </div>
                            <div className='p-3 space-y-3'>

                                <div className='grid grid-cols-4 gap-3'>

                                    {buildingObj.map((i, x) => (

                                        <div key={x} className={i.isLong ? 'col-span-4' : ''}>

                                            <Label className='text-xs'>{i.name}</Label>

                                            <Input
                                                className='h-8 text-sm'
                                                value={b.data?.[i.code] || ""}
                                                onChange={e =>
                                                    updateBuilding(b.id, i.code, e.target.value)
                                                }
                                            />

                                        </div>

                                    ))}

                                </div>

                                {/* PENS */}

                                {b.pens?.map((p: any, pIdx: number) => (

                                    <div key={p.id} className="border rounded p-3 bg-gray-50">

                                        <div className="text-xs font-medium mb-2">
                                            Pen {pIdx + 1}
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">

                                            {penObj.map((i, x) => (

                                                <div key={x}>

                                                    <Label className="text-xs">{i.name}</Label>

                                                    <Input
                                                        className="h-8 text-sm"
                                                        value={p.data?.[i.code] || ""}
                                                        onChange={e =>
                                                            updatePen(b.id, p.id, i.code, e.target.value)
                                                        }
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

                <Separator />

                {/* MACHINES */}

                <div className='py-4 px-4 font-semibold text-xl flex justify-between'>

                    Machines

                    <Button
                        size="sm"
                        onClick={addMachine}
                        disabled={machineCounter === null}
                    >
                        <Plus className="mr-1 h-4 w-4" /> Add Machine
                    </Button>

                </div>

                <div className='space-y-3 m-4'>

                    {machines.map((m, idx) => (

                        <div key={m.id} className='border rounded p-3'>

                            <div className='text-sm font-medium mb-2'>
                                Machine {idx + 1}
                            </div>

                            <div className='grid grid-cols-4 gap-3'>

                                {machineObj.map((i, x) => (

                                    <div key={x} className={i.isLong ? 'col-span-4' : ''}>

                                        <Label className='text-xs'>{i.name}</Label>

                                        {i.type === "search"
                                            ? (
                                                <SearchableDropdown
                                                    list={i.list || []}
                                                    codeLabel="code"
                                                    nameLabel="name"
                                                    value={m.data?.[i.code] || ''}
                                                    onChange={(val) =>
                                                        updateMachine(m.id, i.code, val)
                                                    }
                                                />
                                            )
                                            : (
                                                <Input
                                                    className='h-8 text-sm'
                                                    type={i.type}
                                                    value={m.data?.[i.code] || ""}
                                                    onChange={e =>
                                                        updateMachine(m.id, i.code, e.target.value)
                                                    }
                                                />
                                            )
                                        }

                                    </div>

                                ))}

                            </div>

                        </div>

                    ))}

                </div>

            </div>

        </div>

    )

}