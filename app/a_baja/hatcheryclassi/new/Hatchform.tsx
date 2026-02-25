"use client"

import { useEffect, useMemo, useState, ChangeEvent } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label" 
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { db } from "@/lib/Supabase/supabaseClient"
import { useRouter } from "next/navigation"
import { createHatchClassification, HatchClassificationInsert } from "./api"
import FormActionButtons from "@/components/FormActionButtons"
import SearchableDropdown from "@/lib/SearchableDropdown"
import Breadcrumb from "@/lib/Breadcrumb"

type ViewForHatcheryClassi = {
  id: string | null
  dr_num: string | null
  doc_date: string | null
  temperature: string | null
  humidity: string | null
  brdr_ref_no: string | null
  sku: string | null
  UoM: string | null
  actual_count: number | null
  classfi_ref_no: string | null
}
  

export default function Hatchform() {
  const router = useRouter()

  const [breeders, setBreeders] = useState<ViewForHatcheryClassi[]>([])
  const [saving, setSaving] = useState(false)
  const [refLoading, setRefLoading] = useState(false)

  const [form, setForm] = useState({
  br_no: "",
  dr_no: "",
  dr_date: "",
  temperature: "",
  sku: "",
  uom: "",
  total_count_view: 0, 
  classfi_ref_no: "",   
  classi_ref_no: "",
  date_classify: "",
  // numeric...
  good_egg: 0,
  trans_crack: 0,
  trans_condemn: 0,
  hatc_crack: 0,
  thin_shell: 0,
  hatc_condemn: 0,
  small: 0,
  pee_wee: 0,
  d_yolk: 0,
  jumbo: 0, 
  ttl_count: 0,
  discrepancy: 0,
})

  const numericFields = useMemo(
    () => [
      { label: "Hatching Egg", name: "good_egg", placeholder: "0" },
      { label: "Transport Crack", name: "trans_crack", placeholder: "0" },
      { label: "Transport Condemn", name: "trans_condemn", placeholder: "0" },
      { label: "Hatch Crack", name: "hatc_crack", placeholder: "0" },
      { label: "Thin Shell", name: "thin_shell", placeholder: "0" },
      { label: "Hatch Condemn", name: "hatc_condemn", placeholder: "0" },
      { label: "Small", name: "small", placeholder: "0" },
      { label: "Pee Wee", name: "pee_wee", placeholder: "0" },
      { label: "Double Yolk", name: "d_yolk", placeholder: "0" },
      { label: "Jumbo", name: "jumbo", placeholder: "0" },
    ],
    []
  )

  // load view
  useEffect(() => {
    const loadBreeders = async () => {
      const { data, error } = await db
        .from("viewforhatcheryclassi")
        .select("dr_num,doc_date,temperature,humidity,brdr_ref_no,sku,UoM,actual_count,classfi_ref_no")
        .order("doc_date", { ascending: false })
      console.log({ data })
      if (!error && data) setBreeders(data as any)
      if (error) console.error(error)
    }
    loadBreeders()
  }, [])

  useEffect(() => {
    const run = async () => {
      if (!form.date_classify) return
      if (!form.classfi_ref_no) return

      try {
        setRefLoading(true)
        const finalRef = await generateRef(form.date_classify, form.classfi_ref_no)
        setForm((p) => ({ ...p, classi_ref_no: finalRef }))
      } catch (e: any) {
        // ✅ show real error details
        console.error("RPC generate_hatch_classi_ref failed:", e?.message ?? e, e)
        setForm((p) => ({ ...p, classi_ref_no: "" }))
        alert(e?.message ?? "Failed to generate Classification Ref No.")
      } finally {
        setRefLoading(false)
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date_classify, form.classfi_ref_no])

  // breeder selected -> auto populate
  const generateRef = async (dateClassify: string, baseRef: string) => {
    const { data, error } = await db.rpc("generate_hatch_classi_ref", {
      p_date_classify: dateClassify,     // expects YYYY-MM-DD
      p_classfi_ref_no: baseRef,
    })

    if (error) throw error
    // data is array with 1 row: [{ seq, classi_ref_no }]
    return data?.[0]?.classi_ref_no as string
  }

  const handleBreederChange = async (value: string) => {
    const selected = breeders.find((b) => b.brdr_ref_no === value)
    if (!selected) return

    const baseRef = selected.classfi_ref_no ?? ""
    const dateClassify = form.date_classify // current state

    // populate view fields + base ref
    setForm((prev) => ({
      ...prev,
      br_no: selected.brdr_ref_no ?? "",
      dr_no: selected.dr_num ?? "",
      dr_date: selected.doc_date ?? "",
      temperature: selected.temperature ?? "",
      sku: selected.sku ?? "",
      uom: selected.UoM ?? "",
      total_count_view: Number(selected.actual_count ?? 0),
      classfi_ref_no: baseRef, // ✅ store base
      classi_ref_no: "",       // reset generated
    }))

    // trigger when selecting breeder ref no (ONLY if date already chosen)
    if (!dateClassify || !baseRef) return

    try {
      setRefLoading(true)
      const finalRef = await generateRef(dateClassify, baseRef)
      setForm((prev) => ({ ...prev, classi_ref_no: finalRef }))
    } catch (e: any) {
      console.error("RPC generate_hatch_classi_ref failed:", e?.message ?? e, e)
      setForm((prev) => ({ ...prev, classi_ref_no: "" }))
      alert(e?.message ?? "Failed to generate Classification Ref No.")
    } finally {
      setRefLoading(false)
    }
  }


  // handle inputs (numbers + date_classify)
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target

    setForm((prev) => {
      const updated: any = { ...prev }

      if (type === "number") {
        if (value === "") {
          updated[name] = null
        } else {
          let n = Number(value)
          if (!Number.isFinite(n)) n = 0
          if (n < 0) n = 0 // ✅ clamp
          updated[name] = n
        }
      } else {
        updated[name] = value
      }

      const total = numericFields.reduce(
        (sum, f) => sum + Number(updated[f.name] || 0),
        0
      )
      updated.ttl_count = total
      updated.discrepancy = Number(updated.total_count_view || 0) - total

    return updated
  })
}


  useEffect(() => {
  const run = async () => {
    if (!form.date_classify) return
    if (!form.classi_ref_no) return

    try {
      setRefLoading(true)
      const finalRef = await generateRef(form.date_classify, form.classi_ref_no)
      setForm((p) => ({ ...p, classi_ref_no: finalRef }))
    } catch (e) {
      console.error(e)
      setForm((p) => ({ ...p, classi_ref_no: "" }))
    } finally {
      setRefLoading(false)
    }
  }

  run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [form.date_classify])


  const handleSave = async () => {
    // required checks
    if (!form.br_no || form.br_no.trim() === "") {
      alert("Please select Breeder Ref. No.")
      return
    }
    if (!form.date_classify) {
      alert("Please fill Date Classify.")
      return
    }
    if (!form.classi_ref_no) {
      alert("Classification Ref. No. not generated yet.")
      return
    }
    if (Number(form.ttl_count) !== Number(form.total_count_view)) {
      alert("Total Classify must be equal to Total Count.")
      return
    }

    try {
      setSaving(true)

      const payload: HatchClassificationInsert = {
        created_at: new Date().toISOString(),
        date_classify: form.date_classify,
        classi_ref_no: form.classi_ref_no || null,
        br_no: form.br_no,
        good_egg: form.good_egg,
        trans_crack: form.trans_crack,
        trans_condemn: form.trans_condemn,
        hatc_crack: form.hatc_crack,
        thin_shell: form.thin_shell,
        hatc_condemn: form.hatc_condemn,
        small: form.small,
        pee_wee: form.pee_wee,
        d_yolk: form.d_yolk,
        jumbo: form.jumbo,

        ttl_count: form.ttl_count,
        is_active: true,
      }

      await createHatchClassification(payload)
      router.push("/a_baja/hatcheryclassi")
    } catch (err: any) {
      console.error(err)
      alert(err?.message ?? "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl ml-0 p-6 space-y-2">
      <h1 className="text-2xl font-bold">Hatch Classification</h1>

      {/* TOP CARD (Breeder + view fields) */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1 max-w-sm">
            <Label>Breeder Ref. No.</Label>
            {/* <Select onValueChange={handleBreederChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select Breeder Ref No" />
              </SelectTrigger>
              <SelectContent>
                {breeders.map((b, i) => (
                  <SelectItem key={i} value={b.brdr_ref_no ?? ""}>
                    {b.brdr_ref_no} 
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DisabledField label="DR No." value={form.dr_no} />
            <DisabledField label="DR Date" value={form.dr_date} />
            <DisabledField label="Temperature" value={form.temperature} />
            <DisabledField label="SKU" value={form.sku} />
            <DisabledField label="UOM" value={form.uom} />
            <DisabledField label="Total Count" value={form.total_count_view} />
          </div>
        </CardContent>
      </Card>

      {/* SECOND CARD (Classification inputs) */}
      <Card>
        <CardContent className="pt-2 space-y-2">
          {/* header row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-3 md:col-span-1">
              <Label>Date Classify</Label>
              <Input
                type="date"
                name="date_classify"
                value={form.date_classify}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1">
              <Label>Classification Ref. No.</Label>
              <Input
              
                value={
                  refLoading ? "Generating..." : form.classi_ref_no ?? ""
                }
                disabled
              />
            </div>
          </div>

          {/* fields layout like image */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Good Egg (single wide row-left feel) */}
            <div className="md:col-span-1">
              <NumberField
                label="Hatching Egg"
                name="good_egg"
                placeholder="0"
                form={form}
                onChange={handleChange}
                 min={0}
                 
              />
            </div>
            <div className="md:col-span-2" />

            {/* Transport Crack / Condemn */}
            <NumberField
              label="Transport Crack"
              name="trans_crack"
              placeholder="0"
              form={form}
              onChange={handleChange}
            />
            <NumberField
              label="Transport Condemn"
              name="trans_condemn"
              placeholder="0"
              form={form}
              onChange={handleChange}
            />
            <div />

            {/* Hatch Crack / Thin Shell / Hatch Condemn */}
            <NumberField
              label="Hatch Crack"
              name="hatc_crack"
              placeholder="0"
              form={form}
              onChange={handleChange}
            />
            <NumberField
              label="Thin Shell"
              name="thin_shell"
              placeholder="0"
              form={form}
              onChange={handleChange}
            />
            <NumberField
              label="Hatch Condemn"
              name="hatc_condemn"
              placeholder="0"
              form={form}
              onChange={handleChange}
            />

            {/* Small / Pee Wee / Double Yolk */}
            <NumberField
              label="Small"
              name="small"
              placeholder="0"
              form={form}
              onChange={handleChange}
            />
            <NumberField
              label="Pee Wee"
              name="pee_wee"
              placeholder="0"
              form={form}
              onChange={handleChange}
            />
            <NumberField
              label="Double Yolk"
              name="d_yolk"
              placeholder="0"
              form={form}
              onChange={handleChange}
            />

            {/* Jumbo */}
            <div className="md:col-span-1">
              <NumberField
                label="Jumbo"
                name="jumbo"
                placeholder="0"
                form={form}
                onChange={handleChange}
              />
            </div>
            <div className="md:col-span-2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <NumberField label="Total Classify" name="ttl_count" form={form} disabled />
            <NumberField label="Discrepancy" name="discrepancy" form={form} disabled />
          </div>

          {/* <div className="flex justify-end gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/a_baja/hatcheryclassi")}
            >
              Cancel
            </Button>
          </div> */}
          <FormActionButtons
            saving={saving}
            // isEdit={isEdit}
            // disabled={disabledAll}
            cancelPath="/a_baja/hatcheryclassi"
            onSave={handleSave}
          />

        </CardContent>
      </Card>
    </div>
  )
}

function DisabledField({ label, value }: any) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value ?? ""} disabled />
    </div>
  )
}

function NumberField({
  label,
  name,
  placeholder,
  form,
  onChange,
  disabled = false,
  min = 0,
}: any) {
  const blockBadKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // block negative sign and exponent chars (some browsers allow "e" in type=number)
    if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
      e.preventDefault()
    }
  }

  const blockNegativePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const txt = e.clipboardData.getData("text")
    // allow only digits (optional: allow empty)
    if (txt.includes("-") || /[eE+]/.test(txt)) {
      e.preventDefault()
      return
    }
    const n = Number(txt)
    if (Number.isFinite(n) && n < 0) e.preventDefault()
  }

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        value={form[name] ?? ""}
        onChange={onChange}
        min={min}          // ✅ UI-level prevention
        step={1}           // ✅ integers only (remove if you want decimals)
        inputMode="numeric"
        onKeyDown={blockBadKeys}
        onPaste={blockNegativePaste}
        onFocus={(e) => e.target.select()}
        className="focus:select all in input"
      />
    </div>
  )
}

