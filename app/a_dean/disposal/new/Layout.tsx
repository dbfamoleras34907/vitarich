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
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { toast } from 'sonner'
import { useConfirm } from '@/lib/ConfirmProvider'
import DefaultFarmComboBox from '@/app/components/DefaultFarmComboBox'
import { listBoilerMasterdata } from '@/app/jmb/boilermasterdata/new/api'

export default function Layout() {
  const { setValue } = useGlobalContext()
  const confirm = useConfirm()
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [pickedRows, setPickedRows] = useState<Record<string, any>[]>([])
  const [headerData, setHeaderData] = useState<Record<string, any>>({})
  const [batchCOdes, setbatchCOdes] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [broilers, setbroilers] = useState<any[]>([])

  const headerFieldsTop = [
    { code: "doc_date", label: 'Date', type: 'date' },
    { code: "farm_id", label: 'Farm', type: 'farm', disabled: true },
    { code: "ds_no", label: 'Delivery Reciept No.', type: 'text', disabled: true },
    { code: "cardname", label: 'Customer Name', type: 'search', allowFreeText: true, codeLabel: 'boiler_name', nameLabel: 'boiler_name', list: broilers, showcodes: true },
    { code: "contact_no", label: 'Contact No.', type: 'text' },
    { code: "customer_address", label: 'Customer Address', type: 'text' },
    {
      code: "mode_of_release", label: 'Mode Of Release', type: 'search', allowFreeText: false, codeLabel: 'code', nameLabel: 'name', list: [
        { code: '1', name: 'Pick-up' },
        { code: '2', name: 'Delivery' },
      ]
    },
  ]

  const getbroilers = async () => {
    try {
      const data = await listBoilerMasterdata()
      setbroilers(data || [])
    } catch (error) {
      toast.error("Error fetching broilers, check your connection and please try again.")
    }
  }

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
    try {
      setSaving(true)
      const data = await get_available_chick_grading_batch_refs(headerData.farm || "0")
      setbatchCOdes(data.data || [])
    } catch (error) {
    }
    setSaving(false)
  }

  const getData = async () => {
    if (!headerData.batch_code) return
    const data = await get_chick_grading_inventory(headerData.batch_code)
    setRows(data.data || [])
    setPickedRows([])
  }

  const getDrPreview = async () => {
    try {
      setSaving(true)
      const { data } = await db.rpc('get_next_ds_preview')
      setHeaderData(h => ({ ...h, ds_no: data || '' }))
    } catch (error) {
    }
    setSaving(false)
  }

  const handleSave = async () => {
    if (pickedRows.length === 0) return

    setSaving(true)
    console.log({ headerData, pickedRows })
    // return
    const res = await create_disposal(headerData, pickedRows)
    setSaving(false)

    if (!res.success) {
      alert("Save failed")
      return
    }

    toast("Disposal created successfully")

    setPickedRows([])
    setRows([])
    setHeaderData({})
    getDrPreview()
  }

  useEffect(() => {
    getbroilers()
    getBatchs()
    getDrPreview()
  }, [])

  useEffect(() => {
    getData()
  }, [headerData.batch_code])

  useEffect(() => {
    if (!headerData.cardname) return
    if (!broilers.length) return

    const match = broilers.find(
      b => b.boiler_name === headerData.cardname
    )

    if (!match) return

    setHeaderData(h => ({
      ...h,
      customer_address: match.address || h.customer_address
    }))
  }, [headerData.cardname, broilers])

  useEffect(() => {
    setValue("loading_g", saving)
  }, [saving])

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
        <div className='sm:grid gap-2 md:grid-cols-2 xl:grid-cols-3 gap-y-3'>
          {headerFieldsTop.map((e, i) => (
            <div key={i}>
              {e.code === "farm" ? "" : <Label className='mb-1 mt-1'>{e.label}</Label>}
              {e.type === 'search' ?
                <SearchableDropdown
                  list={e.list || []}
                  codeLabel={e.codeLabel || 'code'}
                  nameLabel={e.nameLabel || 'name'}
                  value={headerData[e.code] || ""}
                  allowFreeText={e.allowFreeText}
                  onChange={(val) => setHeaderData(h => ({ ...h, [e.code]: val }))}
                /> : e.type === "farm" ?
                  <DefaultFarmComboBox
                    label="Farm"
                    value={headerData[e.code] || ""}
                    setValue={(val) => setHeaderData(h => ({ ...h, [e.code]: val }))}
                  />
                  :
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

        <div className='sm:grid gap-2 md:grid-cols-2 xl:grid-cols-3 gap-y-3'>
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

        <Separator className='my-6' />

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