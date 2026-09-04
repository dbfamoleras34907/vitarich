'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, PackageCheck, Save, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import Breadcrumb from '@/lib/Breadcrumb'
import SearchableCombobox from '@/components/SearchableCombobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import DynamicTable, { type Column } from '@/components/ui/DataTableV2'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { usePermission } from '@/hooks/usePermission'
import { listAssignedUserFarmOptions, type AssignedFarmOption } from '@/lib/data/repositories/farmOptions.client'
import {
  filterMedicationItems,
  getFarmFmsType,
  getItemUomOptions,
  getMedicationType,
  getVnmDocument,
  getVnmOnHandBatches,
  getVnmReferences,
  postVnmDocument,
  saveVnmDraft,
  type VnmBatch,
  type VnmDocument,
  type VnmFmsType,
  type VnmLine,
  type VnmReferences,
} from '@/lib/data/repositories/vaccinationMeds'

const today = () => new Date().toISOString().slice(0, 10)
const newLine = (): VnmLine => ({
  id: crypto.randomUUID(), buildingWarehouseId: null, buildingCode: '', buildingName: '', penWarehouseId: null, penCode: '', penName: '',
  treatmentDate: today(), treatmentPeriodDays: 1, itemId: null, medicationCode: '', medicationName: '', medicationType: '', quantity: 0,
  uom: '', baseQuantity: 0, baseUom: '', indicationId: null, indication: '', routeId: null, route: '', birdQuantityTreated: null,
  administeredBy: '', withdrawalPeriodDays: null, remarks: '', allocations: [],
})
const blankDocument = (): VnmDocument => ({
  id: null, documentNo: 'Automatic', farmId: null, farmCode: '', farmName: '', fmsType: 'Broiler', farmCycleId: null, cycleNo: null,
  storageWarehouseId: null, storageWarehouseCode: '', storageWarehouseName: '', createdDate: today(), status: 'Draft', remarks: '', lines: [newLine()],
})

export default function VnmForm({ documentId }: { documentId?: number }) {
  const router = useRouter()
  const { getValue } = useGlobalContext()
  const cannotInsert = usePermission('/vnm/insert')
  const cannotEdit = usePermission('/vnm/edit')
  const sessionProfile = getValue('UserInfoAuthSession')?.[0]
  const defaultFarmId = getValue('DefaultFarmId') ?? sessionProfile?.default_farm
  const [farms, setFarms] = useState<AssignedFarmOption[]>([])
  const [farmsLoading, setFarmsLoading] = useState(true)
  const [document, setDocument] = useState<VnmDocument>(blankDocument)
  const [references, setReferences] = useState<VnmReferences | null>(null)
  const [batchOptions, setBatchOptions] = useState<Record<string, VnmBatch[]>>({})
  const [loading, setLoading] = useState(Boolean(documentId))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFarmsLoading(true)
    listAssignedUserFarmOptions(['BR', 'BE'])
      .then(items => { if (!cancelled) setFarms(items) })
      .catch(error => {
        if (!cancelled) {
          setFarms([])
          toast.error(error instanceof Error ? error.message : 'Assigned farms could not be loaded.')
        }
      })
      .finally(() => { if (!cancelled) setFarmsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const loadReferences = useCallback(async (farmId: number, fmsType: VnmFmsType, preferredCycleId?: number | null) => {
    const next = await getVnmReferences(farmId, fmsType)
    setReferences(next)
    const activeCycle = next.cycles.find(cycle => cycle.status === 'Saved')
    setDocument(current => ({
      ...current,
      fmsType,
      farmCycleId: fmsType === 'Broiler' ? preferredCycleId ?? activeCycle?.id ?? null : null,
      cycleNo: fmsType === 'Broiler' ? next.cycles.find(cycle => cycle.id === (preferredCycleId ?? activeCycle?.id))?.cycle_no ?? null : null,
    }))
  }, [])

  useEffect(() => {
    let cancelled = false
    const initialize = async () => {
      setLoading(true)
      try {
        if (documentId) {
          const saved = await getVnmDocument(documentId)
          if (!saved) throw new Error('Vaccination and Meds document was not found.')
          if (saved.status !== 'Draft') { router.replace(`/vnm/view/${documentId}`); return }
          if (!cancelled) {
            setDocument(saved)
            await loadReferences(Number(saved.farmId), saved.fmsType, saved.farmCycleId)
          }
          return
        }
        const preferred = farms.find(farm =>
          String(farm.id) === String(defaultFarmId)
          || farm.code.trim().toUpperCase() === String(defaultFarmId ?? '').trim().toUpperCase()
        ) ?? (farms.length === 1 ? farms[0] : null)
        if (preferred && !cancelled) {
          const fms = getFarmFmsType(preferred.farm_type)
          if (fms) {
            setDocument(current => ({ ...current, farmId: preferred.id, farmCode: preferred.code, farmName: preferred.name, fmsType: fms }))
            await loadReferences(preferred.id, fms)
          }
        }
      } catch (error) { toast.error(error instanceof Error ? error.message : 'The document could not be loaded.') }
      finally { if (!cancelled) setLoading(false) }
    }
    void initialize()
    return () => { cancelled = true }
  }, [defaultFarmId, documentId, farms, loadReferences, router])

  const medicationItems = useMemo(() => references ? filterMedicationItems(references.items, references.itemGroups, references.settings) : [], [references])
  const warehouses = references?.warehouses.filter(item => item.warehouse_type === 'Warehouse') ?? []
  const buildings = references?.warehouses.filter(item => item.warehouse_type === 'Building' && (
    document.fmsType === 'Breeder' || references.cycleBuildings.some(binding => binding.farmCycleId === document.farmCycleId && binding.buildingWarehouseId === item.id)
  )) ?? []
  const lineKey = (line: VnmLine) => String(line.id)

  const patchLine = (index: number, patch: Partial<VnmLine>) => setDocument(current => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line) }))
  const calculateBase = (line: VnmLine, quantity: number, uom: string) => {
    const item = medicationItems.find(candidate => candidate.id === line.itemId)
    if (!item) return { baseQuantity: 0, baseUom: '' }
    const conversion = getItemUomOptions(item, references?.conversions ?? []).find(option => option.uomCode === uom)
    return { baseQuantity: Number((quantity * Number(conversion?.baseQty ?? 0)).toFixed(6)), baseUom: conversion?.baseUomCode ?? item.inventory_uom }
  }

  const chooseFarm = async (value: string) => {
    const farm = farms.find(candidate => String(candidate.id) === value)
    const fms = getFarmFmsType(farm?.farm_type)
    if (!farm || !fms) return
    setReferences(null); setBatchOptions({})
    setDocument({ ...blankDocument(), farmId: farm.id, farmCode: farm.code, farmName: farm.name, fmsType: fms })
    try { await loadReferences(farm.id, fms) } catch (error) { toast.error(error instanceof Error ? error.message : 'Farm references could not be loaded.') }
  }

  const chooseItem = (index: number, value: string) => {
    const item = medicationItems.find(candidate => String(candidate.id) === value)
    if (!item) return patchLine(index, { itemId: null, medicationCode: '', medicationName: '', medicationType: '', uom: '', baseUom: '', baseQuantity: 0, allocations: [] })
    const firstUom = getItemUomOptions(item, references?.conversions ?? [])[0]?.uomCode ?? item.inventory_uom
    patchLine(index, { itemId: item.id, medicationCode: item.item_code, medicationName: item.item_name, medicationType: getMedicationType(item, references?.itemGroups ?? []), uom: firstUom, baseUom: item.inventory_uom, baseQuantity: 0, quantity: 0, allocations: [] })
  }

  const allocate = async (index: number) => {
    const line = document.lines[index]
    const item = medicationItems.find(candidate => candidate.id === line.itemId)
    if (!item || !document.storageWarehouseCode || line.baseQuantity <= 0) return toast.error('Select the storage warehouse, medication, quantity, and UoM first.')
    try {
      const batches = await getVnmOnHandBatches(item.item_code, document.storageWarehouseCode)
      setBatchOptions(current => ({ ...current, [lineKey(line)]: batches }))
      if (!item.manage_batch_numbers) {
        patchLine(index, { allocations: [{ batchNumber: '', baseQty: line.baseQuantity }] })
        return
      }
      if (!references?.settings?.auto_batch_selection) return
      let remaining = line.baseQuantity
      const allocations = batches.flatMap(batch => {
        if (remaining <= 0) return []
        const quantity = Math.min(remaining, batch.onHandQty)
        remaining -= quantity
        return quantity > 0 ? [{ batchNumber: batch.batchNumber, baseQty: quantity }] : []
      })
      if (remaining > 0.000001) return toast.error(`Only ${line.baseQuantity - remaining} ${line.baseUom} is available.`)
      patchLine(index, { allocations })
      toast.success(allocations.length > 1 ? `Allocated across ${allocations.length} FIFO batches.` : 'FIFO batch allocated.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Batches could not be loaded.') }
  }

  const validate = () => {
    if (!document.farmId || !document.storageWarehouseId) return 'Select a Farm and Medication Storage Warehouse.'
    if (!references?.settings?.medication_group_id) return `Vaccination and Meds settings are incomplete for ${document.fmsType}.`
    for (const [index, line] of document.lines.entries()) {
      const pens = references.warehouses.filter(candidate => candidate.warehouse_type === 'Pen' && candidate.father_id === line.buildingWarehouseId)
      if (!line.buildingWarehouseId) return `Line ${index + 1}: select a Building.`
      if (pens.length && !line.penWarehouseId) return `Line ${index + 1}: select a Pen.`
      if (!line.itemId || line.quantity <= 0 || !line.uom) return `Line ${index + 1}: enter Medication, Quantity, and UoM.`
      if (!line.treatmentDate || line.treatmentPeriodDays <= 0) return `Line ${index + 1}: enter Treatment Start Date and Period.`
      if (!line.indicationId || !line.routeId) return `Line ${index + 1}: select Indication and Route.`
      if (Math.abs(line.allocations.reduce((sum, allocation) => sum + allocation.baseQty, 0) - line.baseQuantity) > 0.000001) return `Line ${index + 1}: allocate the full quantity to inventory batches.`
    }
    return null
  }

  const submit = async (post: boolean) => {
    const error = validate(); if (error) return toast.error(error)
    if ((document.id ? cannotEdit : cannotInsert) || saving) return
    setSaving(true)
    try {
      const actionId = crypto.randomUUID()
      const saved = post ? await postVnmDocument(document, actionId) : await saveVnmDraft(document, actionId)
      if (!saved?.id) throw new Error('The document was not returned after saving.')
      toast.success(post ? `${saved.documentNo} posted.` : `${saved.documentNo} saved as Draft.`)
      router.push(post ? `/vnm/view/${saved.id}` : `/vnm/edit/${saved.id}`)
    } catch (submitError) { toast.error(submitError instanceof Error ? submitError.message : 'The document could not be saved.') }
    finally { setSaving(false) }
  }

  type VnmLineTableRow = VnmLine & Record<string, unknown>
  const lineRows = document.lines as VnmLineTableRow[]
  const rowIndex = (row: VnmLineTableRow) => document.lines.findIndex(line => lineKey(line) === lineKey(row))
  const lineColumns: Column<VnmLineTableRow>[] = [
    { key: 'lineNo', label: '#', width: 54, frozen: true, editable: false, render: row => rowIndex(row) + 1 },
    { key: 'buildingWarehouseId', label: 'Building', width: 230, editable: false, render: row => {
      const index = rowIndex(row)
      return <SearchableCombobox items={buildings.map(value => ({ code: String(value.id), name: `${value.whse_code} - ${value.whse_name}` }))} value={row.buildingWarehouseId ? String(row.buildingWarehouseId) : ''} onValueChange={value => { const building = buildings.find(item => String(item.id) === value); patchLine(index, { buildingWarehouseId: building?.id ?? null, buildingCode: building?.whse_code ?? '', buildingName: building?.whse_name ?? '', penWarehouseId: null, penCode: '', penName: '' }) }} className="w-full" />
    } },
    { key: 'penWarehouseId', label: 'Pen', width: 190, editable: false, render: row => {
      const index = rowIndex(row)
      const pens = references?.warehouses.filter(item => item.warehouse_type === 'Pen' && item.father_id === row.buildingWarehouseId) ?? []
      return <SearchableCombobox items={pens.map(value => ({ code: String(value.id), name: `${value.whse_code} - ${value.whse_name}` }))} value={row.penWarehouseId ? String(row.penWarehouseId) : ''} onValueChange={value => { const pen = pens.find(item => String(item.id) === value); patchLine(index, { penWarehouseId: pen?.id ?? null, penCode: pen?.whse_code ?? '', penName: pen?.whse_name ?? '' }) }} disabled={!pens.length} placeholder={pens.length ? 'Select Pen' : 'No Pen'} className="w-full" />
    } },
    { key: 'treatmentDate', label: 'Treatment Start', width: 155, editable: false, render: row => <Input type="date" value={row.treatmentDate} onChange={event => patchLine(rowIndex(row), { treatmentDate: event.target.value })} /> },
    { key: 'treatmentPeriodDays', label: 'Days', width: 90, editable: false, render: row => <Input type="number" min="1" step="1" value={row.treatmentPeriodDays || ''} onChange={event => patchLine(rowIndex(row), { treatmentPeriodDays: Number(event.target.value) })} /> },
    { key: 'itemId', label: 'Medication Code / Name', width: 290, editable: false, render: row => <SearchableCombobox items={medicationItems.map(value => ({ code: String(value.id), name: `${value.item_code} - ${value.item_name}` }))} value={row.itemId ? String(row.itemId) : ''} onValueChange={value => chooseItem(rowIndex(row), value)} className="w-full" /> },
    { key: 'medicationType', label: 'Medication Type', width: 175, editable: false, render: row => <Input value={row.medicationType} disabled /> },
    { key: 'quantity', label: 'Qty', width: 115, editable: false, render: row => <Input type="number" min="0" step="0.000001" value={row.quantity || ''} onChange={event => { const quantity = Number(event.target.value); patchLine(rowIndex(row), { quantity, ...calculateBase(row, quantity, row.uom), allocations: [] }) }} /> },
    { key: 'uom', label: 'UoM', width: 125, editable: false, render: row => {
      const item = medicationItems.find(candidate => candidate.id === row.itemId)
      const uoms = item ? getItemUomOptions(item, references?.conversions ?? []) : []
      return <select className="h-10 w-full rounded-md border bg-white px-2" value={row.uom} onChange={event => patchLine(rowIndex(row), { uom: event.target.value, ...calculateBase(row, row.quantity, event.target.value), allocations: [] })}><option value="">Select</option>{uoms.map(value => <option key={value.uomCode}>{value.uomCode}</option>)}</select>
    } },
    { key: 'allocations', label: 'Batch Allocation', width: 270, editable: false, render: row => {
      const index = rowIndex(row)
      const item = medicationItems.find(candidate => candidate.id === row.itemId)
      const batches = batchOptions[lineKey(row)] ?? []
      return <div className="space-y-1"><Button type="button" size="sm" variant="outline" onClick={() => void allocate(index)}><PackageCheck className="size-4" />{references?.settings?.auto_batch_selection ? 'Allocate FIFO' : 'Load Batches'}</Button>{!references?.settings?.auto_batch_selection && item?.manage_batch_numbers && <SearchableCombobox items={batches.map(value => ({ code: value.batchNumber, name: `${value.batchNumber} (${value.onHandQty} available)` }))} value={row.allocations[0]?.batchNumber ?? ''} onValueChange={value => patchLine(index, { allocations: value ? [{ batchNumber: value, baseQty: row.baseQuantity }] : [] })} className="w-full" placeholder="Select Batch" />}{row.allocations.length > 0 && <div className="text-xs text-muted-foreground">{row.allocations.map(value => `${value.batchNumber || 'No batch'} [${value.baseQty}]`).join(', ')}</div>}</div>
    } },
    { key: 'indicationId', label: 'Indication', width: 190, editable: false, render: row => <SearchableCombobox items={(references?.indications ?? []).map(value => ({ code: String(value.id), name: value.name }))} value={row.indicationId ? String(row.indicationId) : ''} onValueChange={value => { const selected = references?.indications.find(item => String(item.id) === value); patchLine(rowIndex(row), { indicationId: selected?.id ?? null, indication: selected?.name ?? '' }) }} className="w-full" /> },
    { key: 'routeId', label: 'Route', width: 175, editable: false, render: row => <SearchableCombobox items={(references?.routes ?? []).map(value => ({ code: String(value.id), name: value.name }))} value={row.routeId ? String(row.routeId) : ''} onValueChange={value => { const selected = references?.routes.find(item => String(item.id) === value); patchLine(rowIndex(row), { routeId: selected?.id ?? null, route: selected?.name ?? '' }) }} className="w-full" /> },
    { key: 'birdQuantityTreated', label: 'Bird Qty Treated', width: 140, editable: false, render: row => <Input type="number" min="0" step="1" value={row.birdQuantityTreated ?? ''} onChange={event => patchLine(rowIndex(row), { birdQuantityTreated: event.target.value ? Number(event.target.value) : null })} /> },
    { key: 'administeredBy', label: 'Administered By', width: 190, editable: false, render: row => <Input value={row.administeredBy} onChange={event => patchLine(rowIndex(row), { administeredBy: event.target.value })} /> },
    { key: 'withdrawalPeriodDays', label: 'Withdrawal Days', width: 145, editable: false, render: row => <Input type="number" min="0" step="1" value={row.withdrawalPeriodDays ?? ''} onChange={event => patchLine(rowIndex(row), { withdrawalPeriodDays: event.target.value ? Number(event.target.value) : null })} /> },
    { key: 'remarks', label: 'Line Remarks', width: 210, editable: false, render: row => <Input value={row.remarks} onChange={event => patchLine(rowIndex(row), { remarks: event.target.value })} /> },
  ]

  if (loading) return <main className="p-6 text-sm text-muted-foreground">Loading Vaccination and Meds...</main>

  return <main className="mx-auto max-w-[1800px] space-y-3 p-3 sm:p-4">
    <Breadcrumb FirstPreviewsPageName="Animal Health" FirstPreviewsPageLink="/vnm" SecondPreviewPageName="Vaccination and Meds" SecondPreviewPageLink="/vnm" CurrentPageName={document.id ? 'Edit Draft' : 'New'} />
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">{document.id ? `Edit ${document.documentNo}` : 'New Vaccination and Meds'}</h1><p className="text-sm text-muted-foreground">Record farm treatment usage and issue medication inventory.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => router.push('/vnm')}><ArrowLeft className="size-4" />Back</Button><Button variant="outline" disabled={saving} onClick={() => void submit(false)}><Save className="size-4" />Save Draft</Button><Button disabled={saving} onClick={() => void submit(true)}><Send className="size-4" />Post</Button></div></div>

    <section className="rounded-md border bg-white p-4">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div><Label>VM No.</Label><Input value={document.documentNo} disabled /></div>
          <div><Label required>Farm</Label><SearchableCombobox items={farms.map(farm => ({ code: String(farm.id), name: `${farm.code} - ${farm.name}` }))} value={document.farmId ? String(document.farmId) : ''} onValueChange={value => void chooseFarm(value)} disabled={Boolean(document.id) || farmsLoading} className="w-full" />{!farmsLoading && farms.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No assigned Broiler or Breeder farms available.</p>}</div>
          <div><Label>FMS Type</Label><Input value={document.fmsType} disabled /></div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div><Label>Created Date</Label><Input type="date" value={document.createdDate} disabled /></div>
          <div><Label>Farm Cycle</Label><select className="h-10 w-full rounded-md border bg-white px-3 text-sm disabled:bg-gray-100" value={document.farmCycleId ?? ''} disabled={document.fmsType === 'Breeder' || !references?.settings?.allow_historical_cycle_selection} onChange={event => { const cycle = references?.cycles.find(item => String(item.id) === event.target.value); setDocument(current => ({ ...current, farmCycleId: cycle?.id ?? null, cycleNo: cycle?.cycle_no ?? null })) }}><option value="">{document.fmsType === 'Breeder' ? 'Not applicable' : 'No active cycle'}</option>{references?.cycles.map(cycle => <option key={cycle.id} value={cycle.id}>{`Cycle ${cycle.cycle_no} - ${cycle.status === 'Saved' ? 'Active' : cycle.status}`}</option>)}</select></div>
          <div><Label required>Medication Storage Warehouse</Label><SearchableCombobox items={warehouses.map(item => ({ code: String(item.id), name: `${item.whse_code} - ${item.whse_name}` }))} value={document.storageWarehouseId ? String(document.storageWarehouseId) : ''} onValueChange={value => { const warehouse = warehouses.find(item => String(item.id) === value); setBatchOptions({}); setDocument(current => ({ ...current, storageWarehouseId: warehouse?.id ?? null, storageWarehouseCode: warehouse?.whse_code ?? '', storageWarehouseName: warehouse?.whse_name ?? '', lines: current.lines.map(line => ({ ...line, allocations: [] })) })) }} className="w-full" /></div>
        </div>
      </div>
      <div className="mt-6 w-full"><Label>Remarks</Label><Textarea className="w-full" value={document.remarks} onChange={event => setDocument(current => ({ ...current, remarks: event.target.value }))} /></div>
    </section>

    <section className="rounded-md border bg-white">
      <div className="overflow-x-auto">
        <DynamicTable<VnmLineTableRow>
          ExcelTable={true}
          loading={false}
          columns={lineColumns}
          data={lineRows}
          rowKey={row => lineKey(row)}
          title="Medication Usage Lines"
          description="Building and Pen identify usage; inventory is issued from the header warehouse."
          enableSearch={false}
          enableFilters={false}
          enablePagination={false}
          frozenColumns={1}
          createRow={() => newLine() as VnmLineTableRow}
          onDataChange={rows => setDocument(current => ({ ...current, lines: rows as VnmLine[] }))}
          emptyMessage="Add at least one medication line"
        />
      </div>
    </section>
  </main>
}
