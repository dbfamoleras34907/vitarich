'use client'

import { Button } from '@/components/ui/button'
import DynamicTable from '@/components/ui/DataTableV2'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Breadcrumb from '@/lib/Breadcrumb'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { ListFilter, Plus, RotateCcw, Save } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

type InventoryMapFields = {
  code: string
  module: string
  itemgroup: string
  warehouse_from: string
  warehouse_to: string
}

type InventoryMap = RowDataKey & InventoryMapFields

type InventoryMapForm = InventoryMapFields

const emptyForm: InventoryMapForm = {
  code: '',
  module: '',
  itemgroup: '',
  warehouse_from: '',
  warehouse_to: '',
}

const fieldLabels: Record<keyof InventoryMapForm, string> = {
  code: 'Code',
  module: 'Module',
  itemgroup: 'Item Group',
  warehouse_from: 'Warehouse From',
  warehouse_to: 'Warehouse To',
}

const normalize = (value: string) => value.trim().toLowerCase()

export default function Layout() {
  const [data, setData] = useState<InventoryMap[]>([])
  const [form, setForm] = useState<InventoryMapForm>(emptyForm)
  const [simulation, setSimulation] = useState<InventoryMapForm>(emptyForm)

  const tableColumns: ColumnConfig[] = useMemo(
    () => [
      { key: 'code', label: 'Code', type: 'text', disabled: true },
      { key: 'module', label: 'Module', type: 'text', disabled: true },
      { key: 'itemgroup', label: 'Item Group', type: 'text', disabled: true },
      { key: 'warehouse_from', label: 'Warehouse From', type: 'text', disabled: true },
      { key: 'warehouse_to', label: 'Warehouse To', type: 'text', disabled: true },
    ],
    []
  )

  const simulationResult = useMemo(() => {
    const entries = Object.entries(simulation) as [keyof InventoryMapForm, string][]
    const hasFilter = entries.some(([, value]) => value.trim())

    if (!hasFilter) return data

    return data.filter(row =>
      entries.every(([key, value]) => {
        if (!value.trim()) return true
        return normalize(String(row[key] ?? '')).includes(normalize(value))
      })
    )
  }, [data, simulation])

  const updateForm = (key: keyof InventoryMapForm, value: string) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const updateSimulation = (key: keyof InventoryMapForm, value: string) => {
    setSimulation(current => ({ ...current, [key]: value }))
  }

  const resetForm = () => setForm(emptyForm)

  const handleAddMap = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedForm = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim()])
    ) as InventoryMapForm

    const missingFields = (Object.keys(trimmedForm) as (keyof InventoryMapForm)[])
      .filter(key => !trimmedForm[key])
      .map(key => fieldLabels[key])

    if (missingFields.length > 0) {
      toast.warning(`Missing: ${missingFields.join(', ')}`)
      return
    }

    const alreadyExists = data.some(row =>
      normalize(row.code) === normalize(trimmedForm.code)
    )

    if (alreadyExists) {
      toast.warning('Mapping code already exists')
      return
    }

    setData(current => [
      {
        id: Date.now(),
        ...trimmedForm,
      },
      ...current,
    ])
    setForm(emptyForm)
    toast.success('Inventory mapping added')
  }

  return (
    <div className="mt-2">
      <div className="mx-4 mt-8 flex items-center justify-between">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          FirstPreviewsPageLink="/inv"
          CurrentPageName="Inventory Mapping"
        />
      </div>

      <Separator className="my-2" />

      <div className="mx-4 rounded-lg bg-white p-4">
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="bg-muted">
            <TabsTrigger value="list">
              <ListFilter className="h-4 w-4" />
              List and Simulation
            </TabsTrigger>
            <TabsTrigger value="add">
              <Plus className="h-4 w-4" />
              Add
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4 space-y-4">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {(Object.keys(simulation) as (keyof InventoryMapForm)[]).map(key => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`simulation-${key}`}>{fieldLabels[key]}</Label>
                    <Input
                      id={`simulation-${key}`}
                      value={simulation[key]}
                      onChange={event => updateSimulation(key, event.target.value)}
                      placeholder={fieldLabels[key]}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSimulation(emptyForm)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset Simulation
                </Button>
              </div>
            </div>

            <DynamicTable
              loading={false}
              initialFilters={[]}
              title="Inventory Mapping"
              description={`${simulationResult.length} matching mapping(s)`}
              columns={tableColumns.map(col => ({
                key: col.key,
                label: col.label,
                align: 'left',
                render: (row: InventoryMap) => {
                  const value = row[col.key]
                  if (value === null || value === undefined || value === '') return '-'
                  return String(value)
                },
              }))}
              data={simulationResult}
              emptyMessage="No inventory mappings added"
            />
          </TabsContent>

          <TabsContent value="add" className="mt-4">
            <form onSubmit={handleAddMap} className="rounded-lg border border-stone-200 p-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {(Object.keys(form) as (keyof InventoryMapForm)[]).map(key => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`map-${key}`} required>
                      {fieldLabels[key]}
                    </Label>
                    <Input
                      id={`map-${key}`}
                      value={form[key]}
                      onChange={event => updateForm(key, event.target.value)}
                      placeholder={fieldLabels[key]}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={resetForm}>
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button type="submit">
                  <Save className="h-4 w-4" />
                  Save Mapping
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
