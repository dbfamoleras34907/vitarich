'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import Breadcrumb from '@/lib/Breadcrumb'
import { getUomMasterData, UomMaster } from '../../uom-master/api'
import { addUomGroup, getUomGroupById, updateUomGroup } from '../api'

type ConversionFormRow = {
  key: number
  uom_id: string
  base_qty: string
  remarks: string
}

const newRow = (key: number): ConversionFormRow => ({
  key,
  uom_id: '',
  base_qty: '',
  remarks: '',
})

export default function NewUomConversionLayout() {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const groupId = params.id ? Number(params.id) : null
  const isEdit = groupId !== null && Number.isFinite(groupId)
  const [uoms, setUoms] = useState<UomMaster[]>([])
  const [loadingUoms, setLoadingUoms] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nextKey, setNextKey] = useState(2)
  const [form, setForm] = useState({ code: '', name: '', base_uom_id: '', remarks: '' })
  const [rows, setRows] = useState<ConversionFormRow[]>([newRow(1)])

  useEffect(() => {
    const loadForm = async () => {
      const uomData = await getUomMasterData()
      setUoms(uomData)

      if (!isEdit || groupId === null) return

      const data = await getUomGroupById(groupId) as {
        code: string
        name: string
        base_uom_id: number
        remarks: string | null
        conversions: Array<{
          uom_id: number
          base_qty: number
          remarks: string | null
          void: string
        }>
      }
      const activeRows = (data.conversions || []).filter(
        conversion =>
          conversion.void === '1' &&
          Number(conversion.uom_id) !== Number(data.base_uom_id)
      )

      setForm({
        code: data.code,
        name: data.name,
        base_uom_id: String(data.base_uom_id),
        remarks: data.remarks || '',
      })
      setRows(
        activeRows.length > 0
          ? activeRows.map((conversion, index) => ({
              key: index + 1,
              uom_id: String(conversion.uom_id),
              base_qty: String(conversion.base_qty),
              remarks: conversion.remarks || '',
            }))
          : [newRow(1)]
      )
      setNextKey(activeRows.length + 1)
    }

    loadForm()
      .catch(error => toast('Error: ' + (error instanceof Error ? error.message : 'Unable to load UoMs')))
      .finally(() => setLoadingUoms(false))
    router.prefetch('/a_dean/uom-conversions')
  }, [groupId, isEdit, router])

  const baseUom = useMemo(
    () => uoms.find(uom => String(uom.id) === form.base_uom_id),
    [form.base_uom_id, uoms]
  )

  const availableUoms = (currentRow: ConversionFormRow) => {
    const selectedElsewhere = new Set(
      rows.filter(row => row.key !== currentRow.key).map(row => row.uom_id).filter(Boolean)
    )
    return uoms.filter(
      uom => String(uom.id) !== form.base_uom_id && !selectedElsewhere.has(String(uom.id))
    )
  }

  const updateRow = (
    key: number,
    field: keyof Omit<ConversionFormRow, 'key'>,
    value: string
  ) => {
    setRows(prev => prev.map(row => row.key === key ? { ...row, [field]: value } : row))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.code.trim() || !form.name.trim() || !form.base_uom_id) {
      toast('Please fill in the group code, name, and base UoM.')
      return
    }
    if (rows.some(row => !row.uom_id || !row.base_qty || Number(row.base_qty) <= 0)) {
      toast('Every conversion row needs a UoM and a base quantity greater than zero.')
      return
    }
    const selectedIds = rows.map(row => row.uom_id)
    if (new Set(selectedIds).size !== selectedIds.length) {
      toast('A UoM can only appear once in a conversion group.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        code: form.code,
        name: form.name,
        base_uom_id: Number(form.base_uom_id),
        remarks: form.remarks,
        conversions: [
          { uom_id: Number(form.base_uom_id), base_qty: 1, remarks: 'Base Unit' },
          ...rows.map(row => ({
            uom_id: Number(row.uom_id),
            base_qty: Number(row.base_qty),
            remarks: row.remarks,
          })),
        ],
      }

      if (isEdit && groupId !== null) {
        await updateUomGroup(groupId, payload)
      } else {
        await addUomGroup(payload)
      }
      toast(`UoM conversion group ${isEdit ? 'updated' : 'created'} successfully`)
      router.push('/a_dean/uom-conversions')
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to save conversion group'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto p-6">
      <div className="mb-4">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          SecondPreviewPageName="UoM Conversions"
          SecondPreviewPageLink="/a_dean/uom-conversions"
          CurrentPageName={isEdit ? 'Edit Conversion Group' : 'New Conversion Group'}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Edit' : 'New'} UoM Conversion Group</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label required>Group Code</Label>
                <Input
                  value={form.code}
                  onChange={event => setForm(prev => ({ ...prev, code: event.target.value.toUpperCase() }))}
                  placeholder="MEDICINE"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label required>Group Name</Label>
                <Input
                  value={form.name}
                  onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                  placeholder="Medicine"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label required>Base UoM</Label>
                <Select
                  value={form.base_uom_id}
                  onValueChange={value => {
                    setForm(prev => ({ ...prev, base_uom_id: value }))
                    setRows(prev => prev.map(row => row.uom_id === value ? { ...row, uom_id: '' } : row))
                  }}
                  disabled={loadingUoms}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingUoms ? 'Loading UoMs...' : 'Select base UoM'} />
                  </SelectTrigger>
                  <SelectContent>
                    {uoms.map(uom => (
                      <SelectItem key={uom.id} value={String(uom.id)}>
                        {uom.code} - {uom.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={event => setForm(prev => ({ ...prev, remarks: event.target.value }))}
              />
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between border-b bg-stone-50 px-4 py-3">
                <div>
                  <h3 className="font-semibold">Conversion Rows</h3>
                  <p className="text-sm text-stone-500">
                    Enter how many {baseUom?.code || 'base units'} are in one selected UoM.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRows(prev => [...prev, newRow(nextKey)])
                    setNextKey(prev => prev + 1)
                  }}
                  disabled={!form.base_uom_id || rows.length >= Math.max(0, uoms.length - 1)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Row
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-stone-100 text-left text-xs uppercase text-stone-700">
                    <tr>
                      <th className="px-3 py-3">UoM Code / Name</th>
                      <th className="px-3 py-3">Base Qty</th>
                      <th className="px-3 py-3">Meaning</th>
                      <th className="px-3 py-3">Remarks</th>
                      <th className="px-3 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {baseUom && (
                      <tr className="bg-blue-50/60">
                        <td className="px-3 py-3 font-medium">{baseUom.code} - {baseUom.name}</td>
                        <td className="px-3 py-3">1</td>
                        <td className="px-3 py-3">Base Unit</td>
                        <td className="px-3 py-3 text-stone-500">Base Unit</td>
                        <td />
                      </tr>
                    )}
                    {rows.map(row => {
                      const selectedUom = uoms.find(uom => String(uom.id) === row.uom_id)
                      const quantity = Number(row.base_qty)
                      const meaning = selectedUom && baseUom && quantity > 0
                        ? `1 ${selectedUom.code} = ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(quantity)} ${baseUom.code}`
                        : '-'

                      return (
                        <tr key={row.key}>
                          <td className="min-w-64 px-3 py-3">
                            <Select
                              value={row.uom_id}
                              onValueChange={value => updateRow(row.key, 'uom_id', value)}
                              disabled={!form.base_uom_id}
                            >
                              <SelectTrigger className="w-full"><SelectValue placeholder="Select UoM" /></SelectTrigger>
                              <SelectContent>
                                {availableUoms(row).map(uom => (
                                  <SelectItem key={uom.id} value={String(uom.id)}>
                                    {uom.code} - {uom.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="min-w-36 px-3 py-3">
                            <Input
                              type="number"
                              min="0.000001"
                              step="0.000001"
                              value={row.base_qty}
                              onChange={event => updateRow(row.key, 'base_qty', event.target.value)}
                              placeholder="10"
                            />
                          </td>
                          <td className="min-w-56 px-3 py-3">{meaning}</td>
                          <td className="min-w-48 px-3 py-3">
                            <Input
                              value={row.remarks}
                              onChange={event => updateRow(row.key, 'remarks', event.target.value)}
                              placeholder="Optional"
                            />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => setRows(prev => prev.filter(item => item.key !== row.key))}
                              disabled={rows.length === 1}
                              aria-label="Remove conversion row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {uoms.length === 0 && !loadingUoms && (
              <p className="text-sm text-amber-700">
                Create UoMs in UoM Master before creating a conversion group.
              </p>
            )}
            <div className="flex gap-3">
              <Button type="submit" disabled={saving || uoms.length === 0}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Conversion Group'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/a_dean/uom-conversions')}>
                Back
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
