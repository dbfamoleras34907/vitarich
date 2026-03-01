"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { printTransferSlip } from "./printTransferSlip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import Breadcrumb from "@/lib/Breadcrumb"
import FormActionButtons from "@/components/FormActionButtons"

import {
  createDispatchDoc,
  getDispatchDocById,
  updateDispatchDoc,
  listDistinctHaulers,
  type DispatchDocItemInsert,
  type SkuClassification,
  type UomType,
  // ✅ new
  generateNextDrNo,
  listDocBatchCodes,
} from "./api"
import { Trash2 } from "lucide-react"
import type { ChickGradingQtyRow } from "./api"
import { getChickGradingQtyByBatchCode } from "./api"
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

const FARM_OPTIONS = [
  "Wealthcore Bagbaguin",
  "Wealthcore Sta Cruz",
  "Fortune / Apena Hatchery",
  "Imperial Hatchery",
] as const

type SkuOption = {
  sku_name: string
  classification: SkuClassification
}
const SKU_TO_FIELD: Record<string, keyof ChickGradingQtyRow> = {
  "Class A": "class_a",
  "Class B": "class_b",
  "Class A Junior": "class_a_junior",
  "Class C": "class_c",

  "Infertile": "infertile",
  "Live PIP": "live_pip",
  "Dead Chick": "dead_chicks",
  "Dead Germ": "dead_germ",

  "Cull Chick": "cull_chicks",
  "Unhatched": "unhatched",
  "Dead Pip": "dead_pip",
  "Rotten": "rotten",
}

const SKU_OPTIONS: SkuOption[] = [
  { sku_name: "Class A", classification: "SALEABLE" },
  { sku_name: "Class A Junior", classification: "SALEABLE" },
  { sku_name: "Class B", classification: "SALEABLE" },
  { sku_name: "Class C", classification: "SALEABLE" },

  { sku_name: "Infertile", classification: "BY_PRODUCT" },
  { sku_name: "Live PIP", classification: "BY_PRODUCT" },
  { sku_name: "Dead Chick", classification: "BY_PRODUCT" },
  { sku_name: "Dead Germ", classification: "BY_PRODUCT" },

  { sku_name: "Cull Chick", classification: "DISPOSAL" },
  { sku_name: "Unhatched", classification: "DISPOSAL" },
  { sku_name: "Dead Pip", classification: "DISPOSAL" },
  { sku_name: "Rotten", classification: "DISPOSAL" },
]

function todayYMD() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function clampNonNegStringToNumberOrNull(v: any): number | null {
  if (v === "" || v == null) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, n)
}

function clampNonNegString(v: string) {
  const n = Number(v)
  if (!Number.isFinite(n)) return "0"
  return String(Math.max(0, n))
}

function labelClassification(v: SkuClassification | "" | null | undefined) {
  if (!v) return ""
  if (v === "SALEABLE") return "SALEABLE DOC"
  if (v === "BY_PRODUCT") return "BY-PRODUCT"
  if (v === "DISPOSAL") return "DISPOSAL"
  return String(v)
}

export default function DocdispatchForm() {
  const [gradingCache, setGradingCache] = useState<Record<string, ChickGradingQtyRow | null>>({})
  const router = useRouter()
  const sp = useSearchParams()
  const idParam = sp.get("id")

  const editId = useMemo(() => (idParam ? Number(idParam) : null), [idParam])
  const isEdit = !!editId

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [haulers, setHaulers] = useState<string[]>([])
  const [haulersLoading, setHaulersLoading] = useState(false)

  const [docBatchCodes, setDocBatchCodes] = useState<string[]>([])
  const [docBatchLoading, setDocBatchLoading] = useState(false)

  // if user manually edits DR no, we stop auto-overwriting
  const drManualRef = useRef(false)

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
    classification: "",
    uom: "PCS",
    qty: "",
  })

  const [items, setItems] = useState<DispatchDocItemInsert[]>([])

  const totalQty = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number.isFinite(it.qty) ? it.qty : 0), 0)
  }, [items])

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function setDraft<K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) {
    setItemDraft((p) => ({ ...p, [k]: v }))
  }

  async function ensureGradingRow(batch_code: string) {
  const code = batch_code.trim()
  if (!code) return null

  if (code in gradingCache) return gradingCache[code]

  const row = await getChickGradingQtyByBatchCode(code)
  setGradingCache((p) => ({ ...p, [code]: row }))
  return row
}
  // ✅ load dropdowns
  useEffect(() => {
    let alive = true
    ;(async () => {
      setHaulersLoading(true)
      setDocBatchLoading(true)
      try {
        const [h, b] = await Promise.all([listDistinctHaulers(), listDocBatchCodes()])
        if (!alive) return
        setHaulers(h)
        setDocBatchCodes(b)
      } catch (e) {
        console.error(e)
        if (!alive) return
        setHaulers([])
        setDocBatchCodes([])
      } finally {
        if (alive) {
          setHaulersLoading(false)
          setDocBatchLoading(false)
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // ✅ load edit record
  useEffect(() => {
    if (!editId) return
    setLoading(true)
    ;(async () => {
      try {
        const res = await getDispatchDocById(editId)
        if (!res) return

        const { header, items } = res

        // editing: treat as manual (don’t auto-generate)
        drManualRef.current = true

        setForm({
          doc_date: header.doc_date,
          dr_no: header.dr_no ?? "",
          farm_name: header.farm_name ?? "",
          hauler_name: header.hauler_name ?? "",
          hauler_plate_no: header.hauler_plate_no ?? "",
          truck_seal_no: header.truck_seal_no ?? "",
          chick_van_temp_c:
            header.chick_van_temp_c == null ? "" : String(header.chick_van_temp_c),
          number_of_fans: header.number_of_fans == null ? "" : String(header.number_of_fans),
          remarks: header.remarks ?? "",
        })

        setItems(
          (items ?? []).map((it: any) => ({
            doc_batch_code: it.doc_batch_code,
            sku_name: it.sku_name,
            classification: it.classification,
            uom: it.uom,
            qty: Number(it.qty ?? 0),
          }))
        )
      } catch (e) {
        console.error(e)
        alert("Failed to load record.")
      } finally {
        setLoading(false)
      }
    })()
  }, [editId])

  // ✅ auto-generate DR (new record only)
  useEffect(() => {
    if (isEdit) return
    if (drManualRef.current) return
    if (!form.doc_date) return

    let alive = true
    ;(async () => {
      try {
        const dr = await generateNextDrNo(form.doc_date)
        if (!alive) return
        setForm((p) => ({ ...p, dr_no: dr }))
      } catch (e) {
        console.error(e)
        // keep empty if RPC fails
      }
    })()

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.doc_date, isEdit])

  // ✅ when SKU changes: auto set classification (and keep it locked)
async function handleSkuChange(skuName: string) {
  const found = SKU_OPTIONS.find((x) => x.sku_name === skuName)

  // set sku + classification first
  setItemDraft((p) => ({
    ...p,
    sku_name: skuName,
    classification: found?.classification ?? "",
  }))

  // auto-fill qty using selected batch code
  const batch = itemDraft.doc_batch_code?.trim()
  if (!batch) return // must select batch code first

  try {
    const row = await ensureGradingRow(batch)
    if (!row) return

    const field = SKU_TO_FIELD[skuName]
    if (!field) return

    const qty = row[field]
    const qtyStr = String(Math.max(0, Number(qty ?? 0)))

    setItemDraft((p) => ({
      ...p,
      qty: qtyStr,
    }))
  } catch (e) {
    console.error(e)
  }
}

  function addItem() {
    const doc_batch_code = itemDraft.doc_batch_code.trim()
    const sku_name = itemDraft.sku_name.trim()
    const qtyN = clampNonNegStringToNumberOrNull(itemDraft.qty)

    if (!doc_batch_code) return alert("DOC Batch Code is required.")
    if (!sku_name) return alert("SKU Name is required.")
    if (!itemDraft.classification) return alert("SKU Classification is required.")
    if (qtyN == null) return alert("Qty is required.")

    setItems((prev) => [
      ...prev,
      {
        doc_batch_code,
        sku_name,
        classification: itemDraft.classification as any,
        uom: (itemDraft.uom || null) as any,
        qty: qtyN,
      },
    ])

    setItemDraft((p) => ({
      ...p,
      sku_name: "",
      classification: "",
      qty: "",
    }))
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function onSave() {
    if (!form.doc_date) return alert("Date is required.")
    if (!form.dr_no.trim()) return alert("Delivery Receipt No. is required.")
    if (!form.farm_name.trim()) return alert("Farm Name is required.")
    if (!items.length) return alert("Please add at least 1 item.")

    setSaving(true)
    try {
      const payload = {
        doc_date: form.doc_date,
        dr_no: form.dr_no.trim(),
        farm_name: form.farm_name.trim(),
        hauler_name: form.hauler_name.trim() || null,
        hauler_plate_no: form.hauler_plate_no.trim() || null,
        truck_seal_no: form.truck_seal_no.trim() || null,
        chick_van_temp_c: clampNonNegStringToNumberOrNull(form.chick_van_temp_c),
        number_of_fans: clampNonNegStringToNumberOrNull(form.number_of_fans),
        remarks: form.remarks.trim() || null,
        items,
      }

      if (isEdit && editId) {
        await updateDispatchDoc(editId, payload)
        alert("Updated successfully.")
      } else {
        await createDispatchDoc(payload)
        alert("Saved successfully.")
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
    <div className="w-full  px-6 py-6  mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="DOC Dispatch"
        CurrentPageName={isEdit ? "Edit Delivery Receipt" : "Delivery Receipt"}
      />

      <Card className="w-full  min-h-[calc(90vh-120px)] p-6 space-y-4 mt-2">
        <CardContent className="max-w-4xl p-4 space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                {/* Left */}
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Delivery Receipt No.</Label>
                    <Input
                      value={form.dr_no}
                      onChange={(e) => {
                        drManualRef.current = true
                        setField("dr_no", e.target.value)
                      }}
                      placeholder="DR-MMDDYY-0001" 
                      disabled                    /> 
                  </div>
                  <div className="space-y-1">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.doc_date}
                      onChange={(e) => {
                        setField("doc_date", e.target.value)
                      }}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-1 max-w-xl">
                    <Label>Farm Name</Label>
                    <Select
                      value={form.farm_name}
                      onValueChange={(v) => setField("farm_name", v)}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Farm..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FARM_OPTIONS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Hauler Plate Number</Label>
                    <Input
                      value={form.hauler_plate_no}
                      onChange={(e) => setField("hauler_plate_no", e.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Chick Van Temp</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.chick_van_temp_c}
                      onChange={(e) => setField("chick_van_temp_c", e.target.value)}
                      onBlur={(e) => setField("chick_van_temp_c", clampNonNegString(e.target.value))}
                      placeholder="°C"
                      disabled={saving}
                    />
                  </div>
                </div>

                {/* Right */}
                <div className="space-y-4"> 
                  <div className="space-y-1">
                    <Label>Hauler Name</Label>

                     <Input
                      type="number"
                      min={0}
                      value={form.chick_van_temp_c}
                      onChange={(e) => setField("hauler_name", e.target.value)}
                      onBlur={(e) => setField("hauler_name", clampNonNegString(e.target.value))}
                    
                    />
 
                  </div>

                  <div className="space-y-1">
                    <Label>Truck Seal Number</Label>
                    <Input
                      value={form.truck_seal_no}
                      onChange={(e) => setField("truck_seal_no", e.target.value)}
                      placeholder=""
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Number of Fans</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.number_of_fans}
                      onChange={(e) => setField("number_of_fans", e.target.value)}
                      onBlur={(e) => setField("number_of_fans", clampNonNegString(e.target.value))}
                      placeholder=""
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              <Separator />
 
              {/* Item entry */}
              <div className="space-y-6">
                {/* Row 1: DOC Batch Code */}
                <div className="space-y-1 max-w-xl">
                  <Label>DOC Batch Code</Label>
                  <Select
                    value={itemDraft.doc_batch_code}
                    onValueChange={async (v) => {
                                                  setDraft("doc_batch_code", v)

                                                  // if SKU already selected, refresh qty
                                                  if (itemDraft.sku_name) {
                                                    try {
                                                      const row = await ensureGradingRow(v)
                                                      if (!row) return
                                                      const field = SKU_TO_FIELD[itemDraft.sku_name]
                                                      if (!field) return
                                                      const qtyStr = String(Math.max(0, Number(row[field] ?? 0)))
                                                      setItemDraft((p) => ({ ...p, qty: qtyStr }))
                                                    } catch (e) {
                                                      console.error(e)
                                                    }
                                                  }
                                                  }}
                    disabled={docBatchLoading || saving}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={docBatchLoading ? "Loading..." : "Select batch code"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {docBatchCodes.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Row 2: SKU Name | SKU Classification | UoM | Qty */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                  {/* SKU Name */}
                  <div className="space-y-1 md:col-span-4">
                    <Label>SKU Name</Label>
                    <Select
                      value={itemDraft.sku_name}
                      onValueChange={handleSkuChange}
                      disabled={saving}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select SKU name" />
                      </SelectTrigger>
                      <SelectContent>
                        {SKU_OPTIONS.map((s) => (
                          <SelectItem key={s.sku_name} value={s.sku_name}>
                            {s.sku_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SKU Classification (disabled input) */}
                  <div className="space-y-1 md:col-span-4">
                    <Label>SKU Classification</Label>
                    <Input
                      value={labelClassification(itemDraft.classification)}
                      placeholder="Auto"
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  {/* UoM */}
                  <div className="space-y-1 md:col-span-2">
                    <Label>UoM</Label>
                    <Select
                      value={itemDraft.uom}
                      onValueChange={(v) => setDraft("uom", v as any)}
                      disabled={saving}
                    >
                      <SelectTrigger className="w-full">
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

                  {/* Qty */}
                  <div className="space-y-1 md:col-span-2">
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={itemDraft.qty}
                      onChange={(e) => setDraft("qty", e.target.value)}
                      onBlur={(e) => setDraft("qty", clampNonNegString(e.target.value))}
                      disabled={saving}
                    />
                  </div>
                </div>

                {/* Button (optional: align under right side like typical forms) */}
                <div className="flex justify-start md:justify-end ">
                  <Button className="w-full md:w-auto h-full md:h-auto" type="button" onClick={addItem} disabled={saving}>
                    Add item
                  </Button>
                </div>
              </div>
              {/* Items table */} 
              <div className="space-y-3">
                <div className="border rounded-lg overflow-hidden bg-background">
                  {/* Header */}
                  <div className="grid grid-cols-12 bg-muted/60 px-5 py-3 text-sm font-medium">
                    <div className="col-span-2">Action</div>
                    <div className="col-span-5">Doc Batch Code</div>
                    <div className="col-span-2">SKU</div>
                    <div className="col-span-2">Classification</div>
                    <div className="col-span-1 text-right">Qty</div>
                  </div>

                  {/* Body */}
                  {items.length === 0 ? (
                    <div className="px-5 py-10 text-sm text-muted-foreground">
                      No items added.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {items.map((it, idx) => (
                        <div
                          key={`${it.doc_batch_code}-${idx}`}
                          className="grid grid-cols-12 px-5 py-3 text-sm items-center"
                        >
                          <div className="col-span-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Remove"
                          onClick={() => removeItem(idx)}
                          disabled={saving}
                          className="
                            text-red-500 
                            hover:bg-red-100 
                            hover:text-red-600
                            border
                            border-red-200
                            rounded-md
                          "
                        >
                          <Trash2 className="size-4" />
                        </Button>
                          </div>

                          <div className="col-span-5 truncate" title={it.doc_batch_code}>
                            {it.doc_batch_code}
                          </div>

                          <div className="col-span-2 truncate" title={it.sku_name}>
                            {it.sku_name}
                          </div>

                          <div className="col-span-2">
                            {labelClassification(it.classification as any)}
                          </div>

                          <div className="col-span-1 text-right tabular-nums">
                            {it.qty}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total Qty bottom-right (outside table) */}
                <div className="flex justify-end text-sm text-muted-foreground">
                  Total Qty: <span className="ml-1 font-medium text-foreground">{totalQty}</span>
                </div>
              </div>

              {/* Remarks (below table like screenshot) */}
              <div className="space-y-1">
                <Label>Remarks</Label>
                <Textarea
                  value={form.remarks}
                  onChange={(e) => setField("remarks", e.target.value)}
                  placeholder=""
                  className="min-h-30"
                  disabled={saving}
                />
              </div>
 <div className="space-y-1">
              <FormActionButtons
                saving={saving}
                isEdit={isEdit}
                cancelPath="/a_baja/docdispatch"
                onSave={onSave}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!form.dr_no.trim()) return alert("DR No is required to print.")
                    if (!form.doc_date) return alert("Date is required to print.")
                    if (!form.farm_name.trim()) return alert("Farm Name is required to print.")
                    if (!items.length) return alert("Please add at least 1 item to print.")

                    printTransferSlip({
                      dr_no: form.dr_no.trim(),
                      doc_date: form.doc_date,
                      farm_name: form.farm_name.trim(),
                      address: "", // optional: add farm address if you have it
                      from_name: "Hatchery / Dispatch", // or form.hauler_name, your choice
                      remarks: form.remarks ?? "",
                      items: items.map((it: any) => ({
                        doc_batch_code: it.doc_batch_code,
                        sku_name: it.sku_name,
                        classification: it.classification ?? "",
                        uom: it.uom ?? "",
                        qty: Number(it.qty ?? 0),
                      })),
                    })
                  }}
                  disabled={saving || loading}
                >
                  <Printer className="size-4 mr-2" />
                  Print
                </Button>
              </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}