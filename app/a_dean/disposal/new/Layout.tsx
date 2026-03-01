'use client'
import DataTable from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import Breadcrumb from '@/lib/Breadcrumb'
import SearchableDropdown from '@/lib/SearchableDropdown'
import { DataTableColumn } from '@/lib/types'
import { Edit } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { get_available_chick_grading_batch_refs, get_chick_grading_inventory, create_disposal } from './api'
import { db } from '@/lib/Supabase/supabaseClient'

export default function Layout() {
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [pickedRows, setPickedRows] = useState<Record<string, any>[]>([])
  const [headerData, setHeaderData] = useState<Record<string, any>>({})
  const [batchCOdes, setbatchCOdes] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const headerFieldsTop = [
    { code: "doc_date", label: 'Date', type: 'date' },
    { code: "ds_no", label: 'Delivery Reciept No.', type: 'text', disabled: true },
    { code: "cardname", label: 'Customer Name', type: 'text' },
    { code: "contact_no", label: 'Contact No.', type: 'text' },
    { code: "customer_address", label: 'Customer Address', type: 'text' },
    {
      code: "mode_of_release", label: 'Mode Of Release', type: 'search', codeLabel: 'code', nameLabel: 'name', list: [
        { code: '1', name: 'Pick-up' },
        { code: '2', name: 'Delivery' },
      ]
    },
  ]

  const headerFieldsBottom = [
    { code: "batch_code", label: 'DOC Batch Code', type: 'search', list: Array.isArray(batchCOdes) ? batchCOdes : [], codeLabel: 'batch_ref', nameLabel: 'batch_ref' },
    { code: "sku_class", label: 'Disposal Classification', type: 'text', disabled: true },
  ]

  const pickRow = (row: any) => {
    setPickedRows(prev => [...prev, row])
    setRows(prev => prev.filter(r => r !== row))
  }

  const unpickRow = (row: any) => {
    setRows(prev => [...prev, row])
    setPickedRows(prev => prev.filter(r => r !== row))
  }

  const sumQty = (list: any[]) =>
    list.reduce((t, r) => t + (Number(r.qty) || 0), 0)

  const sourceColumns: DataTableColumn[] = [
    {
      code: "action",
      name: "",
      type: "button",
      render: (row) => (
        <Button size="sm" onClick={() => pickRow(row)}>
          Pick
        </Button>
      ),
    },
    { code: "ref", name: "Batch Ref", type: "text" },
    { code: "SKU", name: "Sku", type: "text" },
    { code: "UoM", name: "UoM", type: "text" },
    { code: "qty", name: "Quantity", type: "text" },
  ]

  const targetColumns: DataTableColumn[] = [
    {
      code: "action",
      name: "",
      type: "button",
      render: (row) => (
        <Button size="sm" variant="secondary" onClick={() => unpickRow(row)}>
         Return
        </Button>
      ),
    },
    { code: "ref", name: "Batch Ref", type: "text" },
    { code: "SKU", name: "Sku", type: "text" },
    { code: "UoM", name: "UoM", type: "text" },
    { code: "qty", name: "Quantity", type: "text" },
  ]

  const getBatchs = async () => {
    const data = await get_available_chick_grading_batch_refs()
    setbatchCOdes(data.data || [])
  }

  const getData = async () => {
    if (!headerData.batch_code) return
    const data = await get_chick_grading_inventory(headerData.batch_code)
    console.log(data.data)
    setRows(data.data || [])
    setPickedRows([])
  }

  const getDrPreview = async () => {
    const { data } = await db.rpc('get_next_ds_preview')
    setHeaderData(h => ({ ...h, ds_no: data || '' }))
  }

  const handleSave = async () => {
    if (pickedRows.length === 0) return

    setSaving(true)

    const res = await create_disposal(headerData, pickedRows)

    setSaving(false)

    if (!res.success) {
      alert("Save failed")
      return
    }

    alert("Disposal created successfully")

    setPickedRows([])
    setRows([])
    setHeaderData({})
    getDrPreview()
  }

  useEffect(() => {
    getBatchs()
    getDrPreview()
  }, [])

  useEffect(() => {
    getData()
  }, [headerData.batch_code])

  return (
    <div>
      <div className='mt-8 flex justify-between items-center'>
        <Breadcrumb
          SecondPreviewPageName='Harchery'
          FirstPreviewsPageName='Disposal'
          CurrentPageName='New Disposal'
        />
        <Button onClick={handleSave} disabled={saving || pickedRows.length === 0}>
          <Edit />
          Save Disposal
        </Button>
      </div>

      <div className='mt-4 bg-white py-4 rounded-md shadow-sm px-4'>
        <div className='sm:grid gap-2 md:grid-cols-2 xl:grid-cols-4 gap-y-3'>
          {headerFieldsTop.map((e, i) => (
            <div key={i}>
              <Label className='mb-1'>{e.label}</Label>
              {e.type === 'search' ?
                <SearchableDropdown
                  list={e.list || []}
                  codeLabel='code'
                  nameLabel="name"
                  value={headerData[e.code] || ""}
                  onChange={(val) => setHeaderData(h => ({ ...h, [e.code]: val }))}
                /> :
                <Input
                  type={e.type}
                  disabled={e.disabled}
                  value={headerData[e.code] || ""}
                  onChange={(ev) => setHeaderData(h => ({ ...h, [e.code]: ev.target.value }))}
                />
              }
            </div>
          ))}
        </div>

        <Separator className="my-6" />

        <div className='sm:grid gap-2 md:grid-cols-2 xl:grid-cols-4 gap-y-3'>
          {headerFieldsBottom.map((e, i) => (
            <div key={i}>
              <Label className='mb-1'>{e.label}</Label>
              {e.type === 'search' ?
                <SearchableDropdown
                  list={e.list || []}
                  codeLabel={e.codeLabel || 'code'}
                  showNameOnly
                  value={headerData[e.code] || ""}
                  onChange={(val) => setHeaderData(h => ({ ...h, [e.code]: val }))}
                /> :
                <Input
                  type={e.type}
                  disabled={e.disabled}
                  value={headerData[e.code] || ""}
                  onChange={(ev) => setHeaderData(h => ({ ...h, [e.code]: ev.target.value }))}
                />
              }
            </div>
          ))}
        </div>

        <Separator className='my-6'/>

        <div className="xl:grid grid-cols-2 gap-10 xl:gap-2">

          <div>
            <h1 className='font-semibold mb-2'>Available (Source)</h1>
            <DataTable
              columns={sourceColumns}
              rows={rows}
              setRowsAction={setRows}
            />
            <div className="text-right font-semibold mt-2">
              Total Qty: {sumQty(rows)}
            </div>
          </div>

          <div>
            <h1 className='font-semibold mb-2'>Picked (Target)</h1>
            <DataTable
              columns={targetColumns}
              rows={pickedRows}
              setRowsAction={setPickedRows}
            />
            <div className="text-right font-semibold mt-2">
              Total Qty: {sumQty(pickedRows)}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}