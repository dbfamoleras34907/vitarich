'use client'

import DataTable from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Breadcrumb from '@/lib/Breadcrumb'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { getInventoriableModules, NavFolders } from '@/lib/Defaults/DefaultValues'
import SearchableDropdown from '@/lib/SearchableDropdown'
import { DataTableColumn, Items, Warehouse } from '@/lib/types'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { upsertInventoryMapping } from './api'
import { Plus } from 'lucide-react'


export default function Layout() {
  const { setValue, getValue } = useGlobalContext()
  const [loading, setLoading] = useState(false)
  const route = useRouter()

  const [pickedRows, setPickedRows] = useState<Record<string, any>[]>([])
  const [items, setitems] = useState<Items[]>([])
  const [whs, setwhs] = useState<Warehouse[]>([])

  const [header, setHeader] = useState({
    section: '',
    module: '',
  })

  const inventoriableList = getInventoriableModules(NavFolders)

  const headerComponents: DataTableColumn[] = [
    {
      code: "section",
      name: "Section",
      type: "search",
      list: [
        { code: "BR", name: "Breeder" },
        { code: "HA", name: "Hatchery" },
        { code: "BL", name: "Broiler" },
        { code: "IV", name: "Inventory" },
      ]
    },
    {
      code: "module",
      name: "Module",
      type: "search",
      list: () =>
        inventoriableList
          .filter((ee) => ee.section === header.section)
          .map((e) => ({
            code: e.code,
            name: e.name,
          }))
    },
  ]

  const components: DataTableColumn[] = [
    {
      code: "action",
      name: "",
      type: "button",
      render: () => (
        <Button size="sm" variant="secondary">
          ...
        </Button>
      ),
    },
    {
      code: "itemType",
      name: "Item Type",
      type: "search",
      list: [
        { code: "E", name: "Eggs" },
        { code: "F", name: "Feeds" },
        { code: "C", name: "Consumables" },
        { code: "T", name: "Tools" }
      ]
    },
    {
      code: "item",
      name: "item",
      type: "search",
      list: (row) =>
        items
          .filter((ee) => ee.group === row?.itemType)
          .map((e) => ({
            code: e.id,
            name: e.item_code + " - " + e.item_name,
          }))
    },
    { code: "warehouse", name: "Warehouse", type: "search" },
    {
      code: "transtype",
      name: "Transaction type",
      type: "search",
      list: [
        { code: "1", name: "IN" },
        { code: "0", name: "OUT" },
      ]
    },
  ]

  // ✅ SUBMIT (RPC STYLE)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)

      const payload = {
        header,
        rows: pickedRows,
      }

      const res = await upsertInventoryMapping(payload)

      console.log('Saved:', res)

      alert('Saved successfully!')

    } catch (err: any) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    route.prefetch("/inv/new")

    setValue("loading_g", loading)

    const getData = async () => {
      const c = getValue("itemmaster") || []
      const w = getValue("warehouses") || []
      setitems(c)
      setwhs(w)
    }

    getData()
  }, [])

  return (
    <div>
      <form onSubmit={handleSubmit}>

        {/* HEADER */}
        <div className='px-4 mt-2 flex justify-between items-center'>
          <Breadcrumb
            SecondPreviewPageName='Inventory'
            CurrentPageName='Inventory Map'
          />

          <div className='flex gap-2'>
            <Button type='button' variant={"destructive"} onClick={() => console.log({ whs })}>
              Cancel
            </Button>

            <Button type='submit' disabled={loading}>
              <Plus /> {loading ? 'Saving...' : 'submit'}
            </Button>
          </div>
        </div>

        {/* HEADER FIELDS */}
        <Card className='my-4 grid lg:grid-cols-2'>
          {headerComponents.map((e, i) => (
            <div className='mx-4' key={i}>
              <Label className='mb-1'>{e.name}</Label>

              {e.type === "search" ? (
                <SearchableDropdown
                  list={e.list ?? []}
                  codeLabel="code"
                  nameLabel="name"
                  value={(header as any)[e.code] || ''}
                  onChange={(val: any) => {
                    setHeader((prev) => ({
                      ...prev,
                      [e.code]: val,
                    }))
                  }}
                />
              ) : (
                <Input type='text' />
              )}
            </div>
          ))}
        </Card>

        {/* TABLE */}
        <Card className='bg-white p-4 rounded-2xl'>
          <DataTable
            columns={components}
            rows={pickedRows}
            setRowsAction={setPickedRows}
            allowAddRow
          />
        </Card>

      </form>
    </div>
  )
}