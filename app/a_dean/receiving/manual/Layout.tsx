'use client'
import React, { useEffect, useLayoutEffect, useState } from 'react'
import { format } from "date-fns"
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataRecordApproval, DefaultFarm, DraftItem, Farms } from '@/lib/types'
import { today } from '@/lib/Defaults/DefaultValues'
import Breadcrumb from '@/lib/Breadcrumb'
import SearchableDropdown from '@/lib/SearchableDropdown'
import { createReceiving, getUserInfo } from './api'
import { Plus, Save, CalendarDays } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { toast } from 'sonner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useConfirm } from '@/lib/ConfirmProvider'
import { refreshSessionx } from '@/app/admin/user/RefreshSession'
import SearchableCombobox from '@/components/SearchableCombobox'
import DefaultFarmComboBox from '@/app/components/DefaultFarmComboBox'
import { VerticalRuler2 } from '@/components/VerticalRuler2'

type ItemMasterType = {
  id: number
  item_code: string
  item_name: string
  unit_measure: string
}

const emptyApprovalRecord: DataRecordApproval = {
  uid: 0,
  id: '',
  posting_date: today,
  email: '',
  soldTo: '',
  doc_date: today,
  address: '',
  tin: '',
  shipped_via: '',
  shipped_to: '',
  dr_num: '',
  po_no: '',
  Attention: '',
  voyage_no: '',
  status: 'pending',
  checked: false,
  docentry: 0,
  delivered_to: 0
}

export default function ApprovalDecisionForm() {
  const confirm = useConfirm();
  const router = useRouter()
 
  const { getValue, setValue } = useGlobalContext()

  const [isAutoReceiving, setisAutoReceiving] = useState(false)
  const [loading, setloading] = useState(false)
  const [farms, setfarms] = useState<Farms[]>([])
  const [header, setHeader] = useState<DataRecordApproval>(emptyApprovalRecord)
  const [items, setItems] = useState<DraftItem[]>([])
  const [ItemMaster, setItemMaster] = useState<ItemMasterType[]>([])
  const [selectedRows, setSelectedRows] = useState<number[]>([])

  const [postingDate, setPostingDate] = useState(today)
  const [temperature, setTemperature] = useState('')
  const [humidity, sethumidity] = useState('')
  const [brdr_ref_no, setbrdr_ref_no] = useState('')
  const [defaultFarm, setdefaultFarm] = useState<DefaultFarm>()

  const [activeWeeks, setActiveWeeks] = useState(26)
  const [activeDays, setActiveDays] = useState(0)

  const parseAge = (ageString: string) => {
    if (!ageString) return { w: 26, d: 0 }
    const match = ageString.match(/(\d+)\s+Weeks,\s+(\d+)\s+Day(s)/)
    if (match) {
      return { w: parseInt(match[1]), d: parseInt(match[2]) }
    }
    return { w: 26, d: 0 }
  }

  const extractProdDate = (skuText?: string) => {
    if (!skuText) return undefined

    const match = skuText.match(/-(\d{8})-/)
    if (!match) return undefined

    const raw = match[1] // 03252026

    const month = raw.substring(0, 2)
    const day = raw.substring(2, 4)
    const year = raw.substring(4, 8)

    const parsedDate = new Date(`${year}-${month}-${day}`)

    return format(parsedDate, "dd/MM/yyyy")
  }

  // const getDefaultFarm = async () => {
  //   const defaultFarmId = getValue("DefaultFarmId")

  //   if (defaultFarmId) {
  //     setHeader(h =>
  //       h && !h.delivered_to
  //         ? { ...h, delivered_to: defaultFarmId }
  //         : h
  //     )
  //     return
  //   }

  //   const data = await getUserInfo()

  //   if (data?.length) {
  //     setdefaultFarm(data[0])

  //     setHeader(h =>
  //       h && !h.delivered_to
  //         ? { ...h, delivered_to: data[0].id }
  //         : h
  //     )
  //   }
  // }

  // useEffect(() => {
  //   if (!header) return
  //   getDefaultFarm()
  // }, [header, getValue])
  const getDefaultFarm = async () => {
    const defaultFarmId = getValue("DefaultFarmId")

    if (defaultFarmId) {
      setHeader(h =>
        h && h.delivered_to == null
          ? { ...h, delivered_to: defaultFarmId }
          : h
      )
      return
    }

    const data = await getUserInfo()

    if (data?.length) {
      setdefaultFarm(data[0])

      setHeader(h =>
        h && h.delivered_to == null
          ? { ...h, delivered_to: data[0].id }
          : h
      )
    }
  }
  useEffect(() => {
    getDefaultFarm()
  }, [])
  useEffect(() => {
    refreshSessionx(router)
  }, [])

  useEffect(() => {
    router.prefetch("/a_dean/receiving/")
    const init = () => {

      const items = getValue("itemmaster")
      const filterd = items.filter((items: any) => items.item_group === 'receiving_egg')
      setItemMaster(filterd)
      setfarms(getValue("getFarmDB_breeder") || [])
      setPostingDate(today)
    }
    init()

    setHeaderValuesFromScanning()
  }, [getValue])


  const updateItem = (id: number, changes: Partial<DraftItem>) =>
    setItems(p => p.map(i => i.id === id ? { ...i, ...changes } : i))

  const addRow = () => setItems(p => [
    ...p,
    {
      id: Date.now(),
      brdr_ref_no: '',
      brdr_ref_noVx: '',
      sku: '',
      UoM: 'PCS',
      expected_count: 0,
      actual_jr: 0,
      actual_he: 0,
      isNew: true,
      age: '26 Weeks, 0 Day(s)'
    },
  ])

  const toggleRow = (id: number) => {
    const item = items.find(i => i.id === id)
    if (!item?.isNew) return

    setSelectedRows(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  const removeSelectedRows = () => {
    setItems(p => p.filter(i => !(i.isNew && selectedRows.includes(i.id))))
    setSelectedRows([])
  }
  const [headerBreed, setHeaderBreed] = useState('')
  const headerFieldsLeft = [
    { required: true, disabled: false, code: "", label: 'Delivered Date', type: 'date', value: header?.doc_date || '', onChange: (v: string) => setHeader(h => h ? { ...h, doc_date: v } : h) },
    { required: true, disabled: true, code: "", label: 'Address', value: header?.address || '', onChange: (v: string) => setHeader(h => h ? { ...h, address: v } : h) },
    { required: false, disabled: true, code: "tin", label: 'Tin', value: header?.tin || '', onChange: (v: string) => setHeader(h => h ? { ...h, tin: v } : h) },
  ]

  const headerFieldsRight = [
    { required: false, disabled: false, code: "", label: 'Shipped Via', value: header?.shipped_via || '', onChange: (v: string) => setHeader(h => h ? { ...h, shipped_via: v } : h) },
    { required: true, disabled: false, code: "", label: 'Posting Date', type: 'date', value: postingDate, onChange: setPostingDate },
    { required: false, disabled: false, code: "", label: 'P.O No', value: header?.po_no || '', onChange: (v: string) => setHeader(h => h ? { ...h, po_no: v } : h) },
    { required: true, disabled: false, code: "", label: 'DR No', value: header?.dr_num || '', onChange: (v: string) => setHeader(h => h ? { ...h, dr_num: v } : h) },
    { required: false, disabled: false, code: "", label: 'Attention To', value: header?.Attention || '', onChange: (v: string) => setHeader(h => h ? { ...h, Attention: v } : h) },
    { required: false, disabled: false, code: "", label: 'Voyage No', value: header?.voyage_no || '', onChange: (v: string) => setHeader(h => h ? { ...h, voyage_no: v } : h) },
    { required: false, disabled: false, code: "", label: 'Temperature', type: 'number', value: temperature, onChange: setTemperature },
    { required: false, disabled: false, code: "", label: 'Humidity', type: 'number', value: humidity, onChange: sethumidity },
    { required: true, disabled: false, code: "", label: 'Breeder Ref. No.', type: 'text', value: brdr_ref_no, onChange: setbrdr_ref_no },
  ]

  const validateLineItems = () => {
    if (items.length === 0) {
      toast("Add at least one line item")
      return false
    }
    for (const row of items) {
      const missingFields: string[] = []
      if (!row.brdr_ref_no) missingFields.push("brdr_ref_no")
      if (!row.sku) missingFields.push("sku")
      if (!row.lot_no) missingFields.push("lot_no")
      // if (!row.breed) missingFields.push("breed")
      if (!row.prod_date) missingFields.push("prod_date")
      if (!row.age) missingFields.push("age")
      if (!row.house_no) missingFields.push("house_no")
      if (row.actual_total === undefined) missingFields.push("actual_total")
      if (headerBreed == "" || headerBreed == null) missingFields.push("Breed")

      if (missingFields.length > 0) {
        alert(`Missing fields: ${missingFields.join(", ")}`)
        return false
      }
    }
    return true
  }


  const insertMe = async () => {

  }
  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault()

    if (!validateLineItems()) return
    setloading(true)
    const confirmed = await confirm({
      title: "Receive items?",
      description: "Are you sure you want to record these items as received?",
      confirmText: "Confirm receipt",
      cancelText: "Cancel",
    });

    setloading(confirmed)
    if (!confirmed) return;

    console.log({ items })

    const transformedItems = items.map((i, e) => ({
      ...i,
      // brdr_ref_no: `${brdr_ref_no ?? ""}-${i.house_no ?? ""}-${e}`,
      brdr_ref_no: isAutoReceiving ? i.brdr_ref_noVx : `${brdr_ref_no ?? ""}-${i.house_no ?? ""}-${e}`,
      sku: i.sku ?? "",
      lot_no: i.lot_no ?? "",
      breed: headerBreed || "",
      house_no: i.house_no ?? "",
      prod_date: i.prod_date ?? "",
      prod_date_to: i.prod_date_to ?? "",
      age: i.age ?? "",
      total_api: i.total ?? 0,
      actual_count: i.actual_total ?? 0,
    }))
    console.log({ transformedItems })

    const payload = {
      doc_date: header?.doc_date ?? "",
      temperature: Number(temperature) || 0,
      humidity: Number(humidity) || 0,
      soldTo: header?.soldTo ?? "",
      Attention: header?.Attention ?? "",
      po_no: header?.po_no ?? "",
      voyage_no: header?.voyage_no ?? "",
      shipped_via: header?.shipped_via ?? "",
      dr_num: header?.dr_num ?? "",
      no_of_crates: Number(footer.crates) || 0,
      no_of_tray: Number(footer.trays) || 0,
      plate_no: footer.van_plate ?? "",
      driver: footer.driver ?? "",
      serial_no: footer.serial ?? "",
      delivered_to: header?.delivered_to ?? 0,
      brdr_ref_no: brdr_ref_no ?? "",
      items: transformedItems,
    }
    // console.log({ payload })
    // return
    const res = await createReceiving(payload)

    setloading(false)

    if (res.success) {
      alert(`Saved! DocEntry: ${res.docentry}`)
      router.push("/a_dean/receiving/")
    } else {
      alert(res.error)
    }
    setloading(false)
  }

  const extractDateFromSku = (sku?: string) => {
    if (!sku) return ""

    const match = sku.match(/-(\d{8})-/)
    return match ? match[1] : ""
  }



  const [footer, setFooter] = useState({
    crates: '',
    trays: '',
    van_plate: '',
    driver: '',
    serial: ''
  })

  const setHeaderValuesFromScanning = () => {
    const scanning = getValue("scanning")
    if (scanning !== "on") return
    setloading(true)
    setTimeout(() => {
      console.log("")
    }, 1000)

    const payload = getValue("forApproval")
    const farmsDB = getValue("getFarmDB")

    setisAutoReceiving(true)

    if (!payload || !farmsDB) return

    const refNumber =
      payload.dr && payload.dr !== "0"
        ? payload.dr
        : payload.ts || ""

    const firstSku = payload.modified_dispatchbody?.[0]?.skuText

    const prodDateRaw = extractDateFromSku(firstSku)

    const breederRefNo = `${prodDateRaw}${refNumber}`
    setbrdr_ref_no(breederRefNo)

    const farmMatch = farmsDB.find(
      (f: any) =>
        String(f.ref) === String(payload.farmid) &&
        f.ref_type === "BE"
    )

    const destinationMatch = farmsDB.find(
      (f: any) =>
        String(f.ref) === String(payload.destinationid) &&
        f.ref_type === "HA"
    )

    console.log("destinationMatch:", destinationMatch)

    if (!farmMatch || !destinationMatch) {
      console.log("Missing farmMatch or destinationMatch", {
        farmMatch,
        destinationMatch,
      })
      return
    }
    const classificationMap: Record<string, string> = {
      good_egg: "HE",
      junior: "JR",
    }

    setHeader(prev => ({
      ...(prev ?? emptyApprovalRecord),
      soldTo: farmMatch.code,
      delivered_to: destinationMatch.id,
      dr_num: payload.dr === "0" ? "" : payload.dr,
      // po_no: payload.ts,
    }))



    const mappedItems = (payload.modified_dispatchbody || []).map((row: any, index: number) => {
      const prodDate = extractProdDate(row.skuText)
      return {
        id: Date.now() + index,
        brdr_ref_no: row.skuText || "",
        brdr_ref_noVx: row.skuText || "",
        sku: classificationMap[row.classification] || "",
        UoM: "PCS",
        total: row.qty,
        actual_total: 0,
        age: "26 Weeks, 0 Day(s)",
        prod_date: prodDate,
        prod_date_to: prodDate,
        isNew: false,
      }
    }
    )

    setloading(false)
    setItems(mappedItems)
    setValue("scanning", "false")
  }

  useEffect(() => {
    setValue("loading_g", loading)
  }, [loading])

  useLayoutEffect(() => {
    if (items.length === 0) addRow()
  }, [])

  useEffect(() => {
    if (!header?.soldTo || farms.length === 0) return

    const selectedFarm = farms.find(f => f.code === header.soldTo)
    if (!selectedFarm) return
    setHeader(prev =>
      prev
        ? {
          ...prev,
          tin: selectedFarm.tin || '',
          address: selectedFarm.address || '',
        }
        : prev
    )
  }, [header?.soldTo, farms])


  return (
    <form onSubmit={handleSubmit}>
      <Card className="w-full border-none shadow-none bg-background p-0">
        <CardHeader className="border-b">
          <div className="flex justify-between items-center mt-8">
            <div>
              <Breadcrumb
                FirstPreviewsPageName='Receiving'
                SecondPreviewPageName='Hatchery'
                CurrentPageName='Manual Receiving'
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                <Save className="mr-2 h-4 w-4" /> Save Record
              </Button>
              {/* <Button type="button" onClick={() => {
                const getdata = getValue("forApproval")
                console.log({ getdata })

              }}>
                get header
              </Button> */}
            </div>
          </div>
        </CardHeader>

        <CardContent className='bg-white rounded-2xl p-4 space-y-6'>
          <div className="sm:grid md:grid-cols-2 lg:grid-cols-3 sm:grid-cols-1 gap-6">
            <div className='mt-2'>
              <Label className='pb-2'>Delivered From</Label>
              <SearchableCombobox
                multiple={false}
                showCode
                autoHighlight
                items={farms}
                value={header?.soldTo || ''}
                className='w-full'
                onValueChange={(val) => {
                  const selectedFarm = farms.find((f: any) => f.code === val)

                  setHeader(h => ({
                    ...(h ?? emptyApprovalRecord),
                    soldTo: val,
                    tin: selectedFarm?.tin || '',
                    address: selectedFarm?.address || '',
                  }))
                }}

              />
            </div>
            {headerFieldsLeft.map((field, i) => (
              <div key={i} className='mt-1'>
                <Label required={field.required} className='pb-2 mt-1'>{field.label}</Label>
                <Input
                  required={field.required}
                  readOnly={field.disabled}
                  type={field.type || 'text'}
                  value={field.value}
                  onChange={e => field.onChange?.(e.target.value)}
                />
              </div>
            ))}
          </div>

          <Separator className='my-2' />

          <div className="sm:grid md:grid-cols-2 lg:grid-cols-3 sm:grid-cols-1 gap-6">
            <div className='mt-1'>
              <DefaultFarmComboBox
                label="Shipped To"
                value={header?.delivered_to ?? undefined}
                setValue={(val) => {
                  setHeader(h => ({
                    ...(h ?? emptyApprovalRecord),
                    delivered_to: val
                  }))
                }
                }
              />
            </div>

            {headerFieldsRight.map((field, i) => (
              <div key={i} className='mt-1'>
                <Label required={field.required} className='pb-2 mt-1'>{field.label}</Label>
                <Input
                  required={field.required}
                  disabled={field.disabled}
                  type={field.type || 'text'}
                  value={field.value}
                  onChange={e => field.onChange?.(e.target.value)}
                />
              </div>
            ))}

            <div className='mt-1'>
              <Label className='pb-2' required>Breed</Label>
              <Input
                required
                value={headerBreed}
                onChange={(e) => setHeaderBreed(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-green-700">Line Items</Label>
              <div className="flex gap-2">
                {selectedRows.length > 0 && (
                  <Button variant="destructive" onClick={removeSelectedRows}>
                    Remove Selected
                  </Button>
                )}
                <Button type="button" onClick={addRow}>
                  <Plus className="mr-2 h-4 w-4" /> Add Row
                </Button>
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Line No</TableHead>
                    <TableHead>EGG SKU</TableHead>
                    <TableHead>UoM</TableHead>
                    <TableHead>Lot No.</TableHead>
                    <TableHead>Production Date</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>House No.</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Actual Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.isNew && (
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(item.id)}
                            onChange={() => toggleRow(item.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell>{index + 1}</TableCell>

                      <TableCell>
                        <SearchableDropdown
                          list={ItemMaster}
                          codeLabel="item_code"
                          nameLabel="item_name"
                          value={item.sku}
                          onChange={(val, selected) =>
                            updateItem(item.id, {
                              sku: val,
                              UoM: selected.unit_measure || 'PCS'
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>{item.UoM}</TableCell>
                      <TableCell>
                        <Input
                          required
                          value={item.lot_no || ''}
                          onChange={e => updateItem(item.id, { lot_no: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <DateRangePicker
                          value={{
                            from: item.prod_date,
                            to: item.prod_date_to,
                          }}
                          onChange={(e) => {
                            updateItem(item.id, {
                              prod_date: e.from,
                              prod_date_to: e.to,
                            })
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Popover
                          onOpenChange={(open) => {
                            if (open) {
                              const { w, d } = parseAge(item.age || "26 Weeks, 0 Day(s)");
                              setActiveWeeks(w);
                              setActiveDays(d);
                            } else {
                              updateItem(item.id, {
                                age: `${activeWeeks} Weeks, ${activeDays} Day(s)`,
                              });
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-45 justify-start text-left font-normal">
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {item.age || '26 Weeks, 0 Day(s)'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-4" align="start">
                            <div className="flex gap-4 items-center justify-center">
                              <VerticalRuler2
                                label='Weeks'
                                min={23}
                                max={104}
                                value={activeWeeks}
                                onChange={setActiveWeeks}
                              />

                              <VerticalRuler2
                                label='Days'
                                min={0}
                                max={6}
                                value={activeDays}
                                onChange={setActiveDays}
                              />
                            </div>
                            <div className="mt-4 text-center font-bold text-sm text-primary">
                              {activeWeeks} Weeks, {activeDays} Day(s)
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        <Input
                          required
                          maxLength={3}
                          value={item.house_no || ''}
                          onChange={e => {
                            const houseNo = e.target.value.slice(0, 3)
                            updateItem(item.id, {
                              house_no: houseNo,
                            })
                            updateItem(item.id, {
                              brdr_ref_no: `${brdr_ref_no}-${houseNo}`
                            })
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.total ?? 0}
                          readOnly
                          disabled
                          className='w-fit'
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          required
                          type="number"
                          value={item.actual_total ?? 0}
                          onChange={e =>
                            updateItem(item.id, {
                              actual_total: Number(e.target.value)
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-6">
            <div>
              <Label className='pb-2'>No Of Crates</Label>
              <Input
                required
                value={footer.crates}
                onChange={e => setFooter(f => ({ ...f, crates: e.target.value }))}
              />
            </div>
            <div>
              <Label className='pb-2'>No. of Tray</Label>
              <Input
                required
                value={footer.trays}
                onChange={e => setFooter(f => ({ ...f, trays: e.target.value }))}
              />
            </div>
            <div>
              <Label className='pb-2'>Van Plate No.</Label>
              <Input
                required
                value={footer.van_plate}
                onChange={e => setFooter(f => ({ ...f, van_plate: e.target.value }))}
              />
            </div>
            <div>
              <Label className='pb-2'>Driver</Label>
              <Input
                required
                value={footer.driver}
                onChange={e => setFooter(f => ({ ...f, driver: e.target.value }))}
              />
            </div>
            <div>
              <Label className='pb-2'>Serial Number</Label>
              <Input
                required
                value={footer.serial}
                onChange={e => setFooter(f => ({ ...f, serial: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}