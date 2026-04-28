'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import Breadcrumb from '@/lib/Breadcrumb'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { addFarmFull, formatCode, generateNextCode, getLastCode } from './api'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import SearchableDropdown from '@/lib/SearchableDropdown'

export default function Layout() {

  const router = useRouter()

  const [buildingCounter, setBuildingCounter] = useState<number | null>(null)
  const [penCounter, setPenCounter] = useState<number | null>(null)
  const [machineCounter, setMachineCounter] = useState<number | null>(null)

  const farmObj = [
    { code: "code", name: "Farm Code", type: "text", required: true },
    { code: "name", name: "Farm Name", type: "text", required: true },
    {
      code: "farm_type", name: "Farm Type", type: "search", list: [
        { code: "BE", name: "Breeder Farm" },
        { code: "HA", name: "Hatcher" },
        { code: "BR", name: "Broiler" },
      ]
    },
    { code: "tin", name: "TIN No.", type: "text", required: true },
    { code: "tel", name: "Telephone No.", type: "text", required: true },
    { code: "contact_person", name: "Contact Person", type: "text", required: true },
    { code: "contact_number", name: "Contact Number", type: "text", required: true },
  ]

  const addressObj = [
    { code: "address", name: "Address", type: "text", required: true },
    { code: "barangay", name: "Barangay", type: "text", required: true },
    { code: "city", name: "City / Municipality", type: "text", required: true },
    { code: "province", name: "Province", type: "text", required: true },
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

  const [farmData, setFarmData] = useState<any>({})
  const [addressData, setAddressData] = useState<any>({})
  const [buildings, setBuildings] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])

  const updateFarm = (code: string, value: any) => {
    setFarmData((prev: any) => ({ ...prev, [code]: value }))
  }

  const updateAddress = (code: string, value: any) => {
    setAddressData((prev: any) => ({ ...prev, [code]: value }))
  }

  // ================= BUILDING =================

  const addBuilding = () => {

    if (buildingCounter === null) return

    const next = buildingCounter + 1
    setBuildingCounter(next)

    const code = formatCode("BLD", next)

    setBuildings(prev => [
      ...prev,
      {
        id: Date.now(),
        data: { code },
        pens: [],
        expanded: true
      }
    ])
  }

  const updateBuilding = (id: number, code: string, value: any) => {
    setBuildings(prev =>
      prev.map(b =>
        b.id === id ? { ...b, data: { ...b.data, [code]: value } } : b
      )
    )
  }

  const toggleBuilding = (id: number) => {
    setBuildings(prev =>
      prev.map(b =>
        b.id === id ? { ...b, expanded: !b.expanded } : b
      )
    )
  }

  // ================= PEN =================

  const addPen = (buildingId: number) => {

    if (penCounter === null) return

    const next = penCounter + 1
    setPenCounter(next)

    const code = formatCode("PEN", next)

    setBuildings(prev =>
      prev.map(b =>
        b.id === buildingId
          ? {
            ...b,
            pens: [...b.pens, { id: Date.now(), data: { code } }]
          }
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
            p.id === penId ? { ...p, data: { ...p.data, [code]: value } } : p
          )
        }

      })
    )
  }

  // ================= MACHINE =================

  const addMachine = () => {

    if (machineCounter === null) return

    const next = machineCounter + 1
    setMachineCounter(next)

    const code = formatCode("MAC", next)

    setMachines(prev => [
      ...prev,
      {
        id: Date.now(),
        data: { code }
      }
    ])
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

  // ================= SUBMIT =================

  const handleAddFarm = async () => {

    try {
      const output = {
        farm: farmData,
        address: addressData,
        buildings,
        machines
      }
      const id = await addFarmFull(output)

      toast("Farm added with ID of " + id)

      router.push("/a_dean/farm")
    } catch (error) {
      // toast.error("Farm Code already exists")
    }
  }

  // ================= LOAD FARM CODE =================

  async function loadFarmCode() {

    const code = await generateNextCode("v_last_farm_code", "FRM", 6)

    setFarmData((prev: any) => ({ ...prev, code }))
  }

  useEffect(() => {

    router.prefetch("/a_dean/farm")

    loadFarmCode()

  }, [])

  // ================= LOAD COUNTERS =================

  useEffect(() => {

    async function loadCounters() {

      const bLast = await getLastCode("v_last_building_code")
      const pLast = await getLastCode("v_last_pen_code")
      const mLast = await getLastCode("v_last_machine_code")

      setBuildingCounter(bLast)
      setPenCounter(pLast)
      setMachineCounter(mLast)

    }

    loadCounters()

  }, [])

  // ================= UI =================

  return (
    <div>

      <div className='mt-5 mx-4 flex justify-between items-center'>

        <Breadcrumb
          SecondPreviewPageName='Settings'
          FirstPreviewsPageName='Farm Management'
          CurrentPageName='New Farm'
        />

        <Button onClick={handleAddFarm}>
          <Plus /> Add Farm
          {/* <EggHenLoaderIcon color='#fff' size={32} /> */}
{/* add add loading state and add that EggHenLoaderIcon as a lodaing state for ui  */}
        </Button>

      </div>

      <div className='bg-white shadow w-full mt-4 rounded'>

        {/* FARM DETAILS */}

        <div className='pt-4 px-4 font-semibold text-xl'>Details</div>

        <div className='grid grid-cols-2 gap-4 m-4'>

          {farmObj.map((i, x) => (

            <div key={x} className='space-y-2'>

              <Label required={i.required}>{i.name}</Label>

              {i.code === "code" ? (

                <Input
                  value={farmData.code || ""}
                  readOnly
                  className="bg-gray-100"
                />

              ) : i.type === "search" ?
                <SearchableDropdown
                  list={i.list || []}
                  codeLabel="code"
                  nameLabel="name"
                  value={farmData.farm_type || ''}
                  onChange={(val) => {
                    console.log({ farmData })
                    console.log({ val })
                    updateFarm(i.code, val)
                  }}
                />
                : (

                  <Input
                    type={i.type}
                    onChange={e => updateFarm(i.code, e.target.value)}
                  />

                )}

            </div>

          ))}

        </div>

        <Separator />

        {/* LOCATION */}

        <div className='pt-4 px-4 font-semibold text-xl'>Location</div>

        <div className='grid grid-cols-2 gap-4 m-4'>

          {addressObj.map((i, x) => (

            <div key={x} className='space-y-2'>

              <Label required={i.required}>{i.name}</Label>

              <Input
                type={i.type}
                onChange={e => updateAddress(i.code, e.target.value)}
              />

            </div>

          ))}

        </div>

        <Separator />

        {/* BUILDINGS */}

        <div className='py-4 px-4 font-semibold text-xl flex justify-between items-center'>

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

              <div
                className='flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer'
                onClick={() => toggleBuilding(b.id)}
              >

                <div className='font-medium text-sm flex items-center'>

                  Building {idx + 1}

                  {b.expanded
                    ? <ArrowDown className='size-4 mx-1' />
                    : <ArrowUp className='size-4 mx-1' />}

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

              {b.expanded && (

                <div className='p-3 space-y-3'>

                  <div className='grid grid-cols-4 gap-3'>

                    {buildingObj.map((i, x) => (

                      <div key={x} className={i.isLong ? 'col-span-4' : ''}>

                        <Label className='text-xs'>{i.name}</Label>

                        {i.code === "code" ? (

                          <Input
                            value={b.data.code || ""}
                            readOnly
                            className="h-8 text-sm bg-gray-100"
                          />

                        ) : (

                          <Input
                            className='h-8 text-sm'
                            type={i.type}
                            onChange={e =>
                              updateBuilding(b.id, i.code, e.target.value)
                            }
                          />

                        )}

                      </div>

                    ))}

                  </div>

                  {b.pens.length > 0 && (

                    <div className='border rounded'>

                      <div className='grid grid-cols-4 bg-gray-100 px-2 py-1 text-xs font-medium'>
                        <div>#</div>
                        <div>Pen Code</div>
                        <div>Pen Name</div>
                        <div>Status</div>
                      </div>

                      {b.pens.map((p: any, pIdx: number) => (

                        <div
                          key={p.id}
                          className='grid grid-cols-4 gap-2 px-2 py-2 border-t'
                        >

                          <div className='text-xs flex items-center'>
                            {pIdx + 1}
                          </div>

                          {penObj.map((i, x) =>
                            i.code === "code"
                              ? (
                                <Input
                                  key={x}
                                  value={p.data.code || ""}
                                  readOnly
                                  className='h-8 text-sm bg-gray-100'
                                />
                              )
                              : (
                                <Input
                                  key={x}
                                  className='h-8 text-sm'
                                  type={i.type}
                                  onChange={e =>
                                    updatePen(b.id, p.id, i.code, e.target.value)
                                  }
                                />
                              )
                          )}

                        </div>

                      ))}

                    </div>

                  )}

                </div>

              )}

            </div>

          ))}

        </div>

        <Separator />

        {/* MACHINES */}

        <div className='py-4 px-4 font-semibold text-xl flex justify-between items-center'>

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

                    {i.code === "code"
                      ? (
                        <Input
                          value={m.data.code || ""}
                          readOnly
                          className='h-8 text-sm bg-gray-100'
                        />
                      )
                      : i.type === "search"
                        ? (
                          <SearchableDropdown
                            list={i.list || []}
                            codeLabel="code"
                            nameLabel="name"
                            value={m.data[i.code] || ''}
                            onChange={(val) =>
                              updateMachine(m.id, i.code, val)
                            }
                          />
                        )
                        : (
                          <Input
                            className='h-8 text-sm'
                            type={i.type}
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
      {/* asd */}
      {/* <EggHenLoaderIcon2 /> */}
    </div>
  )
}