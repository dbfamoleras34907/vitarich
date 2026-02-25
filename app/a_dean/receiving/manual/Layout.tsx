'use client'
import React, { useEffect, useState } from 'react'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataRecordApproval, Farms } from '@/lib/types'
import { today } from '@/lib/Defaults/DefaultValues'
import Breadcrumb from '@/lib/Breadcrumb'
import SearchableDropdown from '@/lib/SearchableDropdown'
import { createReceiving } from './api'
import { Plus, Save } from 'lucide-react'

type DraftItem = {
  id: number
  brdr_ref_no: string
  sku: string
  UoM: string
  lot_no?: string
  breed?: string
  prod_date?: string
  age?: string
  house_no?: string
  jr?: number
  he?: number
  actual_jr?: number
  actual_he?: number
  expected_count: number
  actual_count?: number
  isNew?: boolean
}

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
  status: 'pending', // ⚠️ must match your DraftStatus type
  checked: false,
  docentry: 0
}



export default function ApprovalDecisionForm() {
  const { getValue } = useGlobalContext()

  const [farms, setfarms] = useState<Farms[]>([])
  const [header, setHeader] = useState<DataRecordApproval | null>(null)
  const [items, setItems] = useState<DraftItem[]>([])
  const [ItemMaster, setItemMaster] = useState<ItemMasterType[]>([])
  const [selectedRows, setSelectedRows] = useState<number[]>([])

  const [postingDate, setPostingDate] = useState(today)
  const [temperature, setTemperature] = useState('')
  const [humidity, sethumidity] = useState('')

  const [footer, setFooter] = useState({
    crates: '',
    trays: '',
    van_plate: '',
    driver: '',
    serial: ''
  })

  // ---------- INIT

  useEffect(() => {
    const init = () => {
      setItemMaster(getValue("itemmaster") || [])
      setfarms(getValue("getFarmDB") || [])

      const ctx = getValue('forApproval')
      // if (!ctx?.row) return

      setHeader(emptyApprovalRecord)
      setPostingDate(today)
    }
    init()
  }, [getValue])

  // ---------- ROW FUNCTIONS

  const updateItem = (id: number, changes: Partial<DraftItem>) =>
    setItems(p => p.map(i => i.id === id ? { ...i, ...changes } : i))

  const addRow = () => setItems(p => [
    ...p,
    {
      id: Date.now(),
      brdr_ref_no: '',
      sku: '',
      UoM: 'PCS',
      expected_count: 0,
      actual_jr: 0,
      actual_he: 0,
      isNew: true,
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

  // if (!header) return null

  // ---------- HEADER FIELDS (EXCLUDING SOLD TO)

  const headerFields = [
    { code: "", label: 'Date', type: 'date', value: header?.doc_date || '', onChange: (v: string) => setHeader(h => h ? { ...h, doc_date: v } : h) },
    { code: "", label: 'Posting Date', type: 'date', value: postingDate, onChange: setPostingDate },
    { code: "", label: 'Address', value: header?.address || '', onChange: (v: string) => setHeader(h => h ? { ...h, address: v } : h) },
    { code: "", label: 'P.O No', value: header?.po_no || '', onChange: (v: string) => setHeader(h => h ? { ...h, po_no: v } : h) },
    { code: "", label: 'DR No', value: header?.dr_num || '', onChange: (v: string) => setHeader(h => h ? { ...h, dr_num: v } : h) },
    { code: "", label: 'Attention To', value: header?.Attention || '', onChange: (v: string) => setHeader(h => h ? { ...h, Attention: v } : h) },
    { code: "", label: 'Voyage No', value: header?.voyage_no || '', onChange: (v: string) => setHeader(h => h ? { ...h, voyage_no: v } : h) },
    { code: "", label: 'Temperature', value: temperature, onChange: setTemperature },
    { code: "", label: 'Humidity', value: humidity, onChange: sethumidity },
    { code: "tin", label: 'Tin', value: header?.tin || '', onChange: (v: string) => setHeader(h => h ? { ...h, tin: v } : h) },
    { code: "", label: 'Shipped Via', value: header?.shipped_via || '', onChange: (v: string) => setHeader(h => h ? { ...h, shipped_via: v } : h) },
    { code: "", label: 'Shipped To', value: header?.shipped_to || '', onChange: (v: string) => setHeader(h => h ? { ...h, shipped_to: v } : h) },
  ]




  // const insertMe = async () => {
  //   const payload = {
  //     doc_date: header?.doc_date,
  //     temperature,
  //     humidity,

  //     soldTo: header?.soldTo,
  //     Attention: header?.Attention,
  //     po_no: header?.po_no,
  //     voyage_no: header?.voyage_no,
  //     shipped_via: header?.shipped_via,
  //     dr_num: header?.dr_num,

  //     no_of_crates: footer.crates,
  //     no_of_tray: footer.trays,
  //     plate_no: footer.van_plate,
  //     driver: footer.driver,
  //     serial_no: footer.serial,

  //     items,
  //   }

  //   const res = await createReceiving(payload)

  //   if (res.success) {
  //     alert(`Saved! DocEntry: ${res.docentry}`)
  //   } else {
  //     alert(res.error)
  //   }
  // }
  const insertMe = async () => {

    const transformedItems = items.map(i => {
      const actualTotal = (i.actual_jr || 0) + (i.actual_he || 0)

      return {
        ...i,

        // ✅ overwrite values as requested
        jr: i.actual_jr ?? 0,
        he: i.actual_he ?? 0,
        actual_count: actualTotal,
      }
    })

    const payload = {
      doc_date: header?.doc_date,
      temperature,
      humidity,

      soldTo: header?.soldTo,
      Attention: header?.Attention,
      po_no: header?.po_no,
      voyage_no: header?.voyage_no,
      shipped_via: header?.shipped_via,
      dr_num: header?.dr_num,

      no_of_crates: footer.crates,
      no_of_tray: footer.trays,
      plate_no: footer.van_plate,
      driver: footer.driver,
      serial_no: footer.serial,

      // ✅ send transformed items
      items: transformedItems,
    }

    const res = await createReceiving(payload)

    if (res.success) {
      alert(`Saved! DocEntry: ${res.docentry}`)
    } else {
      alert(res.error)
    }
  }


  return (
    <Card className="w-full border-none shadow-none bg-background p-0">
      <CardHeader className="border-b">
        <div className="flex justify-between items-center">
          <div className='mt-8'>
            <Breadcrumb
              FirstPreviewsPageName='Receiving'
              SecondPreviewPageName='Hatchery'
              CurrentPageName='Manual Receiving'
            />
          </div>
          <Button
            onClick={insertMe}
          >
          <Save/>  Add Record
          </Button>

        </div>
      </CardHeader>

      <CardContent className='bg-white rounded-2xl p-4 space-y-6'>

        {/* HEADER */}

        <div className="grid grid-cols-3 gap-6">

          {/* ✅ SOLD TO DROPDOWN */}

          <div>
            <Label className='pb-2'>Delivered From</Label>
            <SearchableDropdown
              list={farms}
              codeLabel="code"
              nameLabel="name"
              value={header?.soldTo || ''}
              onChange={(val) =>
                setHeader(h => h ? { ...h, soldTo: val } : h)
              }
            />
          </div>

          {/* OTHER HEADER FIELDS */}

          {headerFields.map((field, i) => (
            <div key={i}>
              <Label className='pb-2'>{field.label}</Label>
              <Input
                type={field.type || 'text'}
                value={field.value}
                // readOnly disabled ={field.readOnly disabled }
                onChange={
                  // field.readOnly disabled 
                    // ? undefined
                    /*:*/ e => field.onChange?.(e.target.value)
                }
              />
            </div>
          ))}
        </div>

        {/* LINE ITEMS */}

        <div>
          <div className="flex justify-between items-center mb-2">
            <Label className="text-green-700">Line Items</Label>

            <div className="flex gap-2">
              {selectedRows.length > 0 && (
                <Button variant="destructive" onClick={removeSelectedRows}>
                  Remove Selected
                </Button>
              )}
              <Button onClick={addRow}>
                <Plus/>
                Add Row</Button>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Line No</TableHead>
                  <TableHead>BREEDER REF. NO.</TableHead>
                  <TableHead>EGG SKU</TableHead>
                  <TableHead>UoM</TableHead>
                  <TableHead>Lot No.</TableHead>
                  <TableHead>Breed</TableHead>
                  <TableHead>Production Date</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>House No.</TableHead>
                  <TableHead>JR</TableHead>
                  <TableHead>HE</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Actual JR</TableHead>
                  <TableHead>Actual HE</TableHead>
                  <TableHead>Actual Total</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {items.map((item, index) => {
                  const total = (item.jr || 0) + (item.he || 0)
                  const actualTotal = (item.actual_jr || 0) + (item.actual_he || 0)

                  return (
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
                        <Input
                          value={item.brdr_ref_no || ''}
                          onChange={e =>
                            updateItem(item.id, { brdr_ref_no: e.target.value })
                          }
                        />
                      </TableCell>

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
                          value={item.lot_no || ''}
                          onChange={e =>
                            updateItem(item.id, { lot_no: e.target.value })
                          }
                        />
                      </TableCell>

                      <TableCell>
                        <Input
                          value={item.breed || ''}
                          onChange={e =>
                            updateItem(item.id, { breed: e.target.value })
                          }
                        />
                      </TableCell>

                      <TableCell>
                        <Input
                          type="date"
                          value={item.prod_date || ''}
                          onChange={e =>
                            updateItem(item.id, { prod_date: e.target.value })
                          }
                        />
                      </TableCell>

                      <TableCell>
                        <Input
                          value={item.age || ''}
                          onChange={e =>
                            updateItem(item.id, { age: e.target.value })
                          }
                        />
                      </TableCell>

                      <TableCell>
                        <Input
                          value={item.house_no || ''}
                          onChange={e =>
                            updateItem(item.id, { house_no: e.target.value })
                          }
                        />
                      </TableCell>

                      <TableCell><Input type="number" value={item.jr || 0} readOnly disabled /></TableCell>
                      <TableCell><Input type="number" value={item.he || 0} readOnly disabled /></TableCell>
                      <TableCell><Input type="number" value={total} readOnly disabled /></TableCell>

                      <TableCell>
                        <Input
                          type="number"
                          value={item.actual_jr ?? 0}
                          onChange={e =>
                            updateItem(item.id, { actual_jr: Number(e.target.value) })
                          }
                        />
                      </TableCell>

                      <TableCell>
                        <Input
                          type="number"
                          value={item.actual_he ?? 0}
                          onChange={e =>
                            updateItem(item.id, { actual_he: Number(e.target.value) })
                          }
                        />
                      </TableCell>

                      <TableCell>
                        <Input type="number" value={actualTotal} readOnly disabled />
                      </TableCell>

                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* FOOTER */}

        <div className="grid grid-cols-5 gap-6">
          <div>
            <Label className='pb-2'>No Of Crates</Label>
            <Input
              value={footer.crates}
              onChange={e => setFooter(f => ({ ...f, crates: e.target.value }))}
            />
          </div>

          <div>
            <Label className='pb-2'>No. of Tray</Label>
            <Input
              value={footer.trays}
              onChange={e => setFooter(f => ({ ...f, trays: e.target.value }))}
            />
          </div>

          <div>
            <Label className='pb-2'>Van Plate No.</Label>
            <Input
              value={footer.van_plate}
              onChange={e => setFooter(f => ({ ...f, van_plate: e.target.value }))}
            />
          </div>

          <div>
            <Label className='pb-2'>Driver</Label>
            <Input
              value={footer.driver}
              onChange={e => setFooter(f => ({ ...f, driver: e.target.value }))}
            />
          </div>

          <div>
            <Label className='pb-2'>Serial Number</Label>
            <Input
              value={footer.serial}
              onChange={e => setFooter(f => ({ ...f, serial: e.target.value }))}
            />
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
