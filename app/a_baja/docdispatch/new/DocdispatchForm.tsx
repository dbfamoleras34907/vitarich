/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import Breadcrumb from "@/lib/Breadcrumb"
import {
  createDispatchDoc,
  getDispatchDocById,
  updateDispatchDoc,
  listDistinctHaulers,
  listDistinctPlates,
  type DispatchDocItemInsert,
  type SkuClassification,
  type UomType,
} from "./api"

type FormState = {
  doc_date: string // YYYY-MM-DD
  dr_no: string
  farm_name: string
  hauler_name: string
  hauler_plate_no: string
  truck_seal_no: string
  chick_van_temp_c: string
  number_of_fans: string
  remarks: string
}

type ItemDraft = {
  doc_batch_code: string
  sku_name: string
  classification: SkuClassification | ""
  uom: UomType | ""
  qty: string
}

function toNonNegNumber(v: any): number | null {
  if (v === "" || v == null) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, n)
}

function todayYMD() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export default function DocdispatchForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const idParam = sp.get("id")
  const isEdit = !!idParam

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [haulers, setHaulers] = useState<string[]>([])
  const [plates, setPlates] = useState<string[]>([])

  const [form, setForm] = useState<FormState>({
    doc_date: todayYMD(),
    dr_no: "",
    farm_name: "",
    hauler_name: "",
    hauler_plate_no: "",
    truck_seal_no: "",
    chick_van_temp_c: "",
    number_of_fans: "",
    remarks: "",
  })

  const [itemDraft, setItemDraft] = useState<ItemDraft>({
    doc_batch_code: "",
    sku_name: "",
    classification: "SALEABLE",
    uom: "PCS",
    qty: "",
  })

  const [items, setItems] = useState<DispatchDocItemInsert[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const [h, p] = await Promise.all([listDistinctHaulers(), listDistinctPlates()])
        setHaulers(h)
        setPlates(p)
      } catch {
        // ignore dropdown fetch errors
      }
    })()
  }, [])

  useEffect(() => {
    if (!isEdit) return
    const id = Number(idParam)
    if (!Number.isFinite(id)) return

    setLoading(true)
    ;(async () => {
      try {
        const res = await getDispatchDocById(id)
        if (!res) return

        const { header, items } = res

        setForm({
          doc_date: header.doc_date,
          dr_no: header.dr_no ?? "",
          farm_name: header.farm_name ?? "",
          hauler_name: header.hauler_name ?? "",
          hauler_plate_no: header.hauler_plate_no ?? "",
          truck_seal_no: header.truck_seal_no ?? "",
          chick_van_temp_c: header.chick_van_temp_c == null ? "" : String(header.chick_van_temp_c),
          number_of_fans: header.number_of_fans == null ? "" : String(header.number_of_fans),
          remarks: header.remarks ?? "",
        })

        setItems(
          (items ?? []).map((it) => ({
            doc_batch_code: it.doc_batch_code,
            sku_name: it.sku_name,
            classification: it.classification,
            uom: it.uom,
            qty: Number(it.qty ?? 0),
          }))
        )
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [idParam, isEdit])

  const totalQty = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number.isFinite(it.qty) ? it.qty : 0), 0)
  }, [items])

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function setDraft<K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) {
    setItemDraft((p) => ({ ...p, [k]: v }))
  }

  function addItem() {
    const doc_batch_code = itemDraft.doc_batch_code.trim()
    const sku_name = itemDraft.sku_name.trim()
    const qtyN = toNonNegNumber(itemDraft.qty)

    if (!doc_batch_code) return
    if (!sku_name) return
    if (qtyN == null) return

    setItems((prev) => [
      ...prev,
      {
        doc_batch_code,
        sku_name,
        classification: (itemDraft.classification || null) as any,
        uom: (itemDraft.uom || null) as any,
        qty: qtyN,
      },
    ])

    setItemDraft((p) => ({ ...p, sku_name: "", qty: "" }))
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function onSubmit() {
    // Basic validations
    if (!form.doc_date) return
    if (!form.dr_no.trim()) return
    if (!form.farm_name.trim()) return
    if (!items.length) return

    setSaving(true)
    try {
      const payload = {
        doc_date: form.doc_date,
        dr_no: form.dr_no.trim(),
        farm_name: form.farm_name.trim(),
        hauler_name: form.hauler_name.trim() || null,
        hauler_plate_no: form.hauler_plate_no.trim() || null,
        truck_seal_no: form.truck_seal_no.trim() || null,
        chick_van_temp_c: toNonNegNumber(form.chick_van_temp_c),
        number_of_fans: toNonNegNumber(form.number_of_fans),
        remarks: form.remarks.trim() || null,
        items,
      }

      if (isEdit) {
        const id = Number(idParam)
        await updateDispatchDoc(id, payload)
      } else {
        await createDispatchDoc(payload)
      }

      router.push("/a_baja/docdispatch")
      router.refresh()
    } catch (e) {
      console.error(e)
      alert("Failed to save. Please check console for error.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Egg Setter List"
        CurrentPageName={isEdit ? "Edit Delivery Receipt" : "Delivery Receipt"}
      /> 
      <Card className="max-w-4xl ml-0"> 

        <Separator />

        <CardContent className="pt-4 space-y-6">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              {/* Header section (2 columns like screenshot) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.doc_date}
                      onChange={(e) => setField("doc_date", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Farm Name</Label>
                    <Input
                      value={form.farm_name}
                      onChange={(e) => setField("farm_name", e.target.value)}
                      placeholder="BROILER FARM 1"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Hauler Plate Number</Label>
                    <Select
                      value={form.hauler_plate_no}
                      onValueChange={(v) => setField("hauler_plate_no", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select plate number" />
                      </SelectTrigger>
                      <SelectContent>
                        {plates.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Chick Van Temp</Label>
                    <Input
                      type="number"
                      value={form.chick_van_temp_c}
                      onChange={(e) => setField("chick_van_temp_c", e.target.value)}
                      placeholder="°C"
                      min={0}
                    />
                  </div>
                </div>

                {/* Right */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Delivery Receipt No.</Label>
                    <Input
                      value={form.dr_no}
                      onChange={(e) => setField("dr_no", e.target.value)}
                      placeholder="DR-11XXX11"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Hauler Name</Label>
                    <Select
                      value={form.hauler_name}
                      onValueChange={(v) => setField("hauler_name", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select hauler" />
                      </SelectTrigger>
                      <SelectContent>
                        {haulers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Truck Seal Number</Label>
                    <Input
                      value={form.truck_seal_no}
                      onChange={(e) => setField("truck_seal_no", e.target.value)}
                      placeholder=""
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Number of Fans</Label>
                    <Input
                      type="number"
                      value={form.number_of_fans}
                      onChange={(e) => setField("number_of_fans", e.target.value)}
                      placeholder=""
                      min={0}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Item entry row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>DOC Batch Code</Label>
                    <Input
                      value={itemDraft.doc_batch_code}
                      onChange={(e) => setDraft("doc_batch_code", e.target.value)}
                      placeholder="001FARM1B1P1-010126-B1%Sequence%"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>SKU Classification</Label>
                    <Select
                      value={itemDraft.classification}
                      onValueChange={(v) => setDraft("classification", v as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select classification" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SALEABLE">Saleable</SelectItem>
                        <SelectItem value="BY_PRODUCT">By Product</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>UoM</Label>
                    <Select value={itemDraft.uom} onValueChange={(v) => setDraft("uom", v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select UoM" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PCS">PCS</SelectItem>
                        <SelectItem value="TRAY">TRAY</SelectItem>
                        <SelectItem value="BOX">BOX</SelectItem>
                        <SelectItem value="CRATE">CRATE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      value={itemDraft.qty}
                      onChange={(e) => setDraft("qty", e.target.value)}
                      placeholder=""
                      min={0}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>SKU Name</Label>
                    <Input
                      value={itemDraft.sku_name}
                      onChange={(e) => setDraft("sku_name", e.target.value)}
                      placeholder="Class C"
                    />
                  </div>

                  <div className="pt-6">
                    <Button type="button" onClick={addItem}>
                      Add Item
                    </Button>
                  </div>
                </div>
              </div>

              {/* Items table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-6 bg-muted px-4 py-2 text-sm font-medium">
                  <div>Action</div>
                  <div className="col-span-2">Doc Batch Code</div>
                  <div>SKU</div>
                  <div>Classification</div>
                  <div className="text-right">Qty</div>
                </div>

                {items.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No items added.</div>
                ) : (
                  items.map((it, idx) => (
                    <div
                      key={`${it.doc_batch_code}-${idx}`}
                      className="grid grid-cols-6 px-4 py-2 border-t items-center text-sm"
                    >
                      <div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(idx)}
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="col-span-2">{it.doc_batch_code}</div>
                      <div>{it.sku_name}</div>
                      <div>{it.classification ?? ""}</div>
                      <div className="text-right">{it.qty}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                Total Qty: <span className="font-medium">{totalQty}</span>
              </div>

              <div className="space-y-1">
                <Label>Remarks</Label>
                <Textarea
                  value={form.remarks}
                  onChange={(e) => setField("remarks", e.target.value)}
                  placeholder="Sample remarks"
                />
              </div>

              <div className="flex gap-2">
                <Button disabled={saving} onClick={onSubmit}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/a_baja/docdispatch")}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}