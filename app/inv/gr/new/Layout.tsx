'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowDownUp,
  CalendarDays,
  ClipboardClock,
  List,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SearchableDropdown from '@/lib/SearchableDropdown'
import { Farms, Items, WarehouseData } from '@/lib/types'
import {
  createGoodsReceiptNumber,
  getGoodsReceipts,
  GoodsReceipt,
  GoodsReceiptLine,
  saveGoodsReceipt,
} from '../api'
import {
  getGoodsReceiptReferences,
  UomConversionOption,
  UomGroupOption,
} from './api'

const today = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const newLine = (): GoodsReceiptLine => ({
  id: crypto.randomUUID(),
  itemId: null,
  itemCode: '',
  description: '',
  altQty: 1,
  altUom: '',
  baseQty: 1,
  baseUom: '',
  warehouseId: null,
  warehouseCode: '',
  warehouseName: '',
  returnedQty: 0,
})

const emptyReceipt = (): GoodsReceipt => ({
  id: crypto.randomUUID(),
  grNo: createGoodsReceiptNumber(),
  vendor: '',
  receiveDate: today(),
  farmId: null,
  farmCode: '',
  farmName: '',
  defaultWarehouseId: null,
  status: 'Draft',
  lines: Array.from({ length: 5 }, newLine),
  createdAt: new Date().toISOString(),
})

const numberValue = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function NewGoodsReceive() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const receiptId = searchParams.get('id')
  const [receipt, setReceipt] = useState<GoodsReceipt | null>(null)
  const [items, setItems] = useState<Items[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [farms, setFarms] = useState<Farms[]>([])
  const [uomGroups, setUomGroups] = useState<UomGroupOption[]>([])
  const [conversions, setConversions] = useState<UomConversionOption[]>([])
  const [lineCount, setLineCount] = useState(1)
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const savedReceipt = receiptId
      ? getGoodsReceipts().find(row => row.id === receiptId)
      : null

    setReceipt(savedReceipt ?? emptyReceipt())

    getGoodsReceiptReferences()
      .then(data => {
        setItems(data.items)
        setWarehouses(data.warehouses)
        setFarms(data.farms)
        setUomGroups(data.uomGroups)
        setConversions(data.conversions)
      })
      .catch(error => {
        console.error(error)
        toast('Reference data could not be loaded.')
      })
      .finally(() => setLoadingReferences(false))
  }, [receiptId])

  const totalQuantity = useMemo(
    () => receipt?.lines.reduce(
      (total, line) => total + Number(line.baseQty || 0),
      0,
    ) ?? 0,
    [receipt],
  )

  if (!receipt) return null

  const updateLine = (id: string, changes: Partial<GoodsReceiptLine>) => {
    setReceipt(current => current
      ? { ...current, lines: current.lines.map(line => line.id === id ? { ...line, ...changes } : line) }
      : current,
    )
  }

  const calculateBaseQty = (
    altQty: number,
    altUom: string,
    groupCode: string,
  ) => {
    if (!altUom || !groupCode) return 0

    const normalizedAlt = altUom.trim().toUpperCase()
    const normalizedGroup = groupCode.trim().toUpperCase()
    const conversion = conversions.find(
      option =>
        option.groupCode.toUpperCase() === normalizedGroup &&
        option.uomCode.toUpperCase() === normalizedAlt,
    )

    return conversion ? altQty * conversion.baseQty : 0
  }

  const getGroupUoms = (groupCode: string) => {
    const seen = new Set<string>()

    return conversions
      .filter(conversion => conversion.groupCode === groupCode)
      .filter(conversion => {
        const code = conversion.uomCode.toUpperCase()
        if (seen.has(code)) return false
        seen.add(code)
        return true
      })
  }

  const getSelectedGroup = (groupCode: string) =>
    uomGroups.find(group => group.code === groupCode)

  const getSelectedConversion = (groupCode: string, uomCode: string) =>
    conversions.find(
      conversion =>
        conversion.groupCode === groupCode &&
        conversion.uomCode.toUpperCase() === uomCode.toUpperCase(),
    )

  const selectItem = (line: GoodsReceiptLine, itemCode: string) => {
    const item = items.find(candidate => candidate.item_code === itemCode)
    if (!item) {
      updateLine(line.id, {
        itemId: null,
        itemCode: '',
        description: '',
        altUom: '',
        baseUom: '',
      })
      return
    }

    const uom = item.inventory_uom || item.unit_measure || ''
    const selectedGroupCode = conversions.find(
      option => option.uomCode.toUpperCase() === uom.toUpperCase(),
    )?.groupCode ?? ''
    updateLine(line.id, {
      itemId: item.id,
      itemCode: item.item_code || '',
      description: item.item_name || item.description || '',
      altUom: uom,
      baseUom: selectedGroupCode,
      baseQty: calculateBaseQty(line.altQty, uom, selectedGroupCode),
    })
  }

  const selectWarehouse = (lineId: string, warehouseCode: string) => {
    const warehouse = warehouses.find(candidate => candidate.whse_code === warehouseCode)
    updateLine(lineId, {
      warehouseId: warehouse?.id ?? null,
      warehouseCode: warehouse?.whse_code ?? '',
      warehouseName: warehouse?.whse_name ?? '',
    })
  }

  const applyDefaultWarehouse = (warehouseId: string) => {
    const id = warehouseId ? Number(warehouseId) : null
    const warehouse = warehouses.find(candidate => candidate.id === id)

    setReceipt(current => current ? {
      ...current,
      defaultWarehouseId: id,
      lines: current.lines.map(line => line.warehouseId ? line : {
        ...line,
        warehouseId: warehouse?.id ?? null,
        warehouseCode: warehouse?.whse_code ?? '',
        warehouseName: warehouse?.whse_name ?? '',
      }),
    } : current)
  }

  const handleSave = () => {
    const completedLines = receipt.lines.filter(line => line.itemId)

    if (!receipt.vendor.trim()) {
      toast('Please enter a vendor.')
      return
    }
    if (!receipt.farmId) {
      toast('Please select a farm.')
      return
    }
    if (completedLines.length === 0) {
      toast('Please select at least one item.')
      return
    }
    if (completedLines.some(line =>
      !line.warehouseId ||
      !line.baseUom ||
      !line.altUom ||
      line.baseQty <= 0
    )) {
      toast('Each item needs a warehouse, UoM group, Alt UoM, and a valid conversion.')
      return
    }

    setSaving(true)
    try {
      saveGoodsReceipt({
        ...receipt,
        status: 'Received',
        lines: completedLines,
      })
      toast('Goods receipt saved successfully.')
      router.push('/inv/gr')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-stone-50/40 pb-8 text-stone-950">
      <header className="px-4 py-4">
        <h1 className="text-xl font-semibold ">Goods Receive</h1>
        <p className="mt-1 text-sm text-stone-500">Manage your goods receive direct.</p>
      </header>

      <div className="px-3 pt-4">
        <div className="inline-flex rounded-full border bg-white p-1 shadow-sm">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-2 rounded-full bg-stone-950 px-4 text-sm font-semibold text-white shadow-sm"
          >
            <ArrowDownUp className="size-4" />
            New GR
          </button>
          <button
            type="button"
            onClick={() => router.push('/inv/gr')}
            className="inline-flex h-8 items-center gap-2 rounded-full px-4 text-sm font-medium hover:bg-stone-100"
          >
            <ClipboardClock className="size-4" />
            Receive History
          </button>
        </div>
      </div>

      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid gap-x-16 gap-y-3 p-5 lg:grid-cols-2">
          <div className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)]">
            <label className="text-sm font-semibold">GR No.</label>
            <div className="flex gap-2">
              <Input value={receipt.grNo} readOnly className="bg-stone-50" />
              <Button type="button" variant="outline" onClick={() => router.push('/inv/gr')}>
                <List className="size-4" />
                GRs
              </Button>
            </div>
          </div>

          <div className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)]">
            <label className="text-sm font-semibold">Farm</label>
            <select
              value={receipt.farmId ?? ''}
              disabled={loadingReferences}
              onChange={event => {
                const farm = farms.find(candidate => String(candidate.id) === event.target.value)
                setReceipt(current => current ? {
                  ...current,
                  farmId: farm?.id ?? null,
                  farmCode: farm?.code ?? '',
                  farmName: farm?.name ?? '',
                } : current)
              }}
              className="h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-stone-200"
            >
              <option value="">{loadingReferences ? 'Loading farms...' : 'Select farm'}</option>
              {farms.map(farm => <option key={farm.id} value={farm.id}>{farm.code} - {farm.name}</option>)}
            </select>
          </div>

          <div className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)]">
            <label className="text-sm font-semibold">Vendor</label>
            <Input
              value={receipt.vendor}
              onChange={event => setReceipt(current => current ? { ...current, vendor: event.target.value } : current)}
              placeholder="Enter vendor"
            />
          </div>

          <div className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)]">
            <label className="text-sm font-semibold">Status:</label>
            <div>
              <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold text-white">
                {receipt.status}
              </span>
            </div>
          </div>

          <div className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)]">
            <label className="text-sm font-semibold">Receive Date</label>
            <label className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-2.5 size-4" />
              <Input
                type="date"
                value={receipt.receiveDate}
                onChange={event => setReceipt(current => current ? { ...current, receiveDate: event.target.value } : current)}
                className="pl-9"
              />
            </label>
          </div>

          <div className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,300px)]">
            <label className="text-sm font-semibold">Default WH</label>
            <select
              value={receipt.defaultWarehouseId ?? ''}
              disabled={loadingReferences}
              onChange={event => applyDefaultWarehouse(event.target.value)}
              className="h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-stone-200"
            >
              <option value="">{loadingReferences ? 'Loading warehouses...' : 'Select default warehouse...'}</option>
              {warehouses.map(warehouse => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.whse_code} - {warehouse.whse_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t p-5">
          <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-200 bg-white px-3 py-3">
              <h2 className="text-base font-semibold text-stone-950">
                Receive Item Lines (Non-PO)
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {receipt.lines.length} {receipt.lines.length === 1 ? 'line' : 'lines'}
              </p>
            </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="h-10 w-12 whitespace-nowrap px-3 text-center align-middle text-xs font-semibold uppercase text-stone-700">#</th>
                  <th className="h-10 min-w-80 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Item Code &amp; Description</th>
                  <th className="h-10 w-44 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Base UOM Group</th>
                  <th className="h-10 w-28 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Alt Qty</th>
                  <th className="h-10 w-28 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Alt UoM</th>
                  <th className="h-10 w-52 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Conversion UoM</th>
                  <th className="h-10 min-w-48 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold uppercase text-stone-700">Warehouse</th>
                  <th className="h-10 w-20 whitespace-nowrap px-3 text-center align-middle text-xs font-semibold uppercase text-stone-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {receipt.lines.map((line, index) => (
                  <tr key={line.id} className="odd:bg-white even:bg-stone-50/70 hover:bg-stone-50">
                    <td className="px-3 py-3 text-center align-middle text-stone-500">{index + 1}</td>
                    <td className="px-3 py-2 align-middle">
                      <SearchableDropdown
                        list={items}
                        codeLabel="item_code"
                        nameLabel="item_name"
                        value={line.itemCode}
                        placeholder="Select item..."
                        width={420}
                        onChange={(value) => selectItem(line, value)}
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <select
                        value={line.baseUom}
                        onChange={event => {
                          const groupCode = event.target.value
                          const altUomIsAvailable = conversions.some(
                            conversion =>
                              conversion.groupCode === groupCode &&
                              conversion.uomCode.toUpperCase() === line.altUom.toUpperCase(),
                          )
                          const altUom = altUomIsAvailable ? line.altUom : ''

                          updateLine(line.id, {
                            baseUom: groupCode,
                            altUom,
                            baseQty: calculateBaseQty(line.altQty, altUom, groupCode),
                          })
                        }}
                        className="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm outline-none transition focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
                      >
                        <option value="">Select UoM group</option>
                        {uomGroups.map(group => (
                          <option key={group.id} value={group.code}>
                            {group.code} - {group.name} ({group.baseUomCode})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={line.altQty}
                        onChange={event => updateLine(line.id, {
                          altQty: numberValue(event.target.value),
                          baseQty: calculateBaseQty(
                            numberValue(event.target.value),
                            line.altUom,
                            line.baseUom,
                          ),
                        })}
                        className="border-stone-300 bg-white shadow-none focus-visible:ring-stone-200"
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <select
                        value={line.altUom}
                        disabled={!line.baseUom}
                        onChange={event => {
                          const altUom = event.target.value
                          updateLine(line.id, {
                            altUom,
                            baseQty: calculateBaseQty(line.altQty, altUom, line.baseUom),
                          })
                        }}
                        className="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm outline-none transition focus:border-stone-500 focus:ring-2 focus:ring-stone-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:opacity-60"
                      >
                        <option value="">
                          {line.baseUom ? 'Select Alt UoM' : 'Select group first'}
                        </option>
                        {getGroupUoms(line.baseUom).map(conversion => (
                          <option
                            key={`${conversion.groupId}-${conversion.uomCode}`}
                            value={conversion.uomCode}
                          >
                            {conversion.uomCode}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 align-middle text-stone-800">
                      {line.baseUom && line.altUom ? (
                        <div className="whitespace-nowrap">
                          <span className="font-medium tabular-nums">
                            {line.baseQty.toLocaleString('en-PH', { maximumFractionDigits: 6 })}
                          </span>{' '}
                          <span className="text-stone-600">
                            {getSelectedGroup(line.baseUom)?.baseUomCode}
                          </span>
                          <div className="text-xs text-stone-500">
                            {line.altQty.toLocaleString('en-PH', { maximumFractionDigits: 6 })}{' '}
                            {line.altUom} ×{' '}
                            {getSelectedConversion(line.baseUom, line.altUom)?.baseQty.toLocaleString(
                              'en-PH',
                              { maximumFractionDigits: 6 },
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <SearchableDropdown
                        list={warehouses}
                        codeLabel="whse_code"
                        nameLabel="whse_name"
                        value={line.warehouseCode}
                        placeholder="Select warehouse..."
                        width={360}
                        onChange={(value) => selectWarehouse(line.id, value)}
                      />
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => setReceipt(current => current ? {
                          ...current,
                          lines: current.lines.filter(candidate => candidate.id !== line.id),
                        } : current)}
                        className="inline-flex size-8 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                        aria-label={`Delete line ${index + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

            {receipt.lines.length === 0 && (
              <div className="border-t border-stone-200 px-4 py-10 text-center">
                <p className="text-sm font-medium text-stone-900">No item lines added</p>
                <p className="mt-1 text-sm text-stone-500">Use Add Lines to continue.</p>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-stone-200 bg-stone-50 px-3 py-3">
              <Input
                type="number"
                min="1"
                max="50"
                value={lineCount}
                onChange={event => setLineCount(Math.max(1, numberValue(event.target.value)))}
                className="w-20 border-stone-300 bg-white"
                aria-label="Number of lines to add"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setReceipt(current => current ? {
                  ...current,
                  lines: [...current.lines, ...Array.from({ length: lineCount }, newLine)],
                } : current)}
              >
                <Plus className="size-4" />
                Add Lines
              </Button>
            </div>
          </section>

          <div className="mt-6 flex flex-col items-end gap-4">
            <div className="w-full rounded-xl border p-4 sm:w-[34rem]">
              <h3 className="text-sm font-semibold">Receiving Summary</h3>
              <div className="mt-3 flex justify-between text-sm">
                <span>Total Base Quantity</span>
                <span className="font-medium tabular-nums">
                  {totalQuantity.toLocaleString('en-PH', { maximumFractionDigits: 6 })}
                </span>
              </div>
            </div>

            <Button type="button" onClick={handleSave} disabled={saving}>
              <Save className="size-4" />
              {saving ? 'Saving...' : 'Receive Goods'}
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
