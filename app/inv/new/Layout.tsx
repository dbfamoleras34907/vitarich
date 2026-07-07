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
import { InventoryMappingHeader, InventoryMappingRow, upsertInventoryMapping } from './api'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const isWarehouseCache = (value: unknown): value is { data: Warehouse[] } =>
  Boolean(value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data))

export default function Layout() {
  const { setValue, getValue } = useGlobalContext()
  const [loading, setLoading] = useState(false)
  const route = useRouter()

  const [pickedRows, setPickedRows] = useState<InventoryMappingRow[]>([])
  const [items, setitems] = useState<Items[]>([])
  const [whs, setwhs] = useState<Warehouse[]>([])

  const [header, setHeader] = useState<InventoryMappingHeader>({
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
    {
      code: "warehouse", name: "Warehouse", type: "search",
      list: () =>
        whs
          .map((e) => ({
            code: e.id,
            name: e.whse_code + " - " + e.whse_code,
          }))

    },
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // HEADER VALIDATION
      if (!header.section || !header.module) {
        toast("Please complete all header fields.")
        return
      }

      // ROW VALIDATION
      if (pickedRows.length === 0) {
        toast("Please add at least one row.")
        return
      }

      const hasInvalidRow = pickedRows.some(
        (row) =>
          !row.itemType ||
          !row.item ||
          !row.warehouse ||
          row.transtype === undefined ||
          row.transtype === null ||
          row.transtype === ''
      )

      if (hasInvalidRow) {
        toast("Please complete all required row fields.")
        return
      }

      setLoading(true)

      const payload = {
        header,
        rows: pickedRows,
      }

      const res = await upsertInventoryMapping(payload)

      console.log('Saved:', res)

      toast('Saved successfully!')

    } catch (err: unknown) {
      console.error(err)
      toast(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    route.prefetch("/inv/new")
  }, [route])

  useEffect(() => {
    setValue("loading_g", loading)
  }, [loading, setValue])

  useEffect(() => {
    const cachedItems = getValue("itemmaster")
    const cachedWarehouses = getValue("warehouses")

    if (Array.isArray(cachedItems)) {
      setitems(cachedItems)
    }

    if (isWarehouseCache(cachedWarehouses)) {
      setwhs(cachedWarehouses.data)
    }
  }, [getValue])

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
        <Card className='mx-4 my-4 grid gap-4 p-4 lg:grid-cols-2'>
          {headerComponents.map((e, i) => (
            <div key={i}>
              <Label className='mb-1'>{e.name}</Label>

              {e.type === "search" ? (
                <SearchableDropdown
                  list={e.list ?? []}
                  codeLabel="code"
                  nameLabel="name"
                  value={header[e.code as keyof InventoryMappingHeader] || ''}
                  onChange={(val: string) => {
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
        <Card className='mx-4 p-4'>
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
