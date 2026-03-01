"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  createEggHatcheryProcess,
  deleteEggHatcheryProcess,
  getEggHatcheryProcessById,
  updateEggHatcheryProcess,
  listClassiRefNos, // ✅ NEW
} from "./api"

import Breadcrumb from "@/lib/Breadcrumb"
import { Separator } from "@/components/ui/separator"
import FormActionButtons from "@/components/FormActionButtons"

function toDatetimeLocalValue(v: string | null | undefined) {
  if (!v) return ""
  const d = new Date(v)
  const pad = (n: number) => String(n).padStart(2, "0")
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function minutesBetween(start: string, end: string) {
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  if (b < a) return null
  return Math.floor((b - a) / 60000)
}

function fmtDuration(mins: number | null) {
  if (mins == null) return ""
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

export default function EggHatchform() {
  const router = useRouter()
  const sp = useSearchParams()
  const idParam = sp.get("id")
  const editId = useMemo(() => (idParam ? Number(idParam) : null), [idParam])
  const isEdit = !!editId

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // ✅ dropdown state
  const [eggRefs, setEggRefs] = useState<string[]>([])
  const [eggRefsLoading, setEggRefsLoading] = useState(false)

  const [form, setForm] = useState({
    egg_ref: "",
    farm_source: "",
    daterec: "",

    machine_no: "",
    hatch_temp: "",
    hatch_humidity: "",

    hatch_time_start: "",
    hatch_time_end: "",
    duration: "" as string,

    hatch_window: "",
    total_egg: "",
  })

  const durationMinutes = useMemo(() => {
    if (!form.hatch_time_start) return null
    if (!form.hatch_time_end) return null
    return minutesBetween(form.hatch_time_start, form.hatch_time_end)
  }, [form.hatch_time_start, form.hatch_time_end])

  const isValidDates = useMemo(() => {
    if (!form.hatch_time_start) return true
    if (!form.hatch_time_end) return true
    return durationMinutes !== null
  }, [form.hatch_time_start, form.hatch_time_end, durationMinutes])

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  // ✅ load ref dropdown options
  useEffect(() => {
    let alive = true
    ;(async () => {
      setEggRefsLoading(true)
      try {
        const refs = await listClassiRefNos()
        if (!alive) return
        setEggRefs(refs)
      } catch (e: any) {
        console.error(e)
        if (!alive) return
        setEggRefs([])
      } finally {
        if (alive) setEggRefsLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // load edit record
  useEffect(() => {
    if (!editId) return
    setLoading(true)
    ;(async () => {
      try {
        const data = await getEggHatcheryProcessById(editId)
        setForm({
          egg_ref: data.egg_ref ?? "",
          farm_source: data.farm_source ?? "",
          daterec: data.daterec ?? "",

          machine_no: data.machine_no ?? "",
          hatch_temp: data.hatch_temp ?? "",
          hatch_humidity: data.hatch_humidity ?? "",

          hatch_time_start: toDatetimeLocalValue(data.hatch_time_start),
          hatch_time_end: toDatetimeLocalValue(data.hatch_time_end),
          duration: data.duration != null ? String(data.duration) : "",

          hatch_window: data.hatch_window != null ? String(data.hatch_window) : "",
          total_egg: data.total_egg != null ? String(data.total_egg) : "",
        })
      } catch (e: any) {
        alert(e?.message ?? "Failed to load record.")
      } finally {
        setLoading(false)
      }
    })()
  }, [editId])

  // auto compute duration minutes
  useEffect(() => {
    if (!form.hatch_time_start || !form.hatch_time_end) {
      setForm((p) => ({ ...p, duration: "" }))
      return
    }
    const mins = minutesBetween(form.hatch_time_start, form.hatch_time_end)
    setForm((p) => ({ ...p, duration: mins == null ? "" : String(mins) }))
  }, [form.hatch_time_start, form.hatch_time_end])

  async function onSave() {
    // optional: enforce ref selection
    if (!form.egg_ref) {
      alert("Reference No. is required.")
      return
    }
    if (!form.hatch_time_start || !form.hatch_time_end) {
      alert("Hatch Time Start and End are required.")
      return
    }
    if (!isValidDates) {
      alert("Hatch Time End must be after Start.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        egg_ref: form.egg_ref || null,
        farm_source: form.farm_source || null,
        daterec: form.daterec || null,
        machine_no: form.machine_no || null,
        hatch_temp: form.hatch_temp || null,
        hatch_humidity: form.hatch_humidity || null,
        hatch_time_start: form.hatch_time_start
          ? new Date(form.hatch_time_start).toISOString()
          : null,
        hatch_time_end: form.hatch_time_end
          ? new Date(form.hatch_time_end).toISOString()
          : null,
        duration: form.duration ? Number(form.duration) : null,
        hatch_window: form.hatch_window ? Number(form.hatch_window) : null,
        total_egg: form.total_egg ? Number(form.total_egg) : null,
      }

      if (isEdit && editId) {
        await updateEggHatcheryProcess(editId, payload)
        alert("Updated successfully.")
      } else {
        await createEggHatcheryProcess(payload)
        alert("Saved successfully.")
      }

      router.push("/a_baja/egghatcheryprocessform")
      router.refresh()
    } catch (e: any) {
      alert(e?.message ?? "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!editId) return
    const ok = confirm("Delete this record?")
    if (!ok) return
    setSaving(true)
    try {
      await deleteEggHatcheryProcess(editId)
      alert("Deleted.")
      router.push("/a_baja/egghatcheryprocessform")
      router.refresh()
    } catch (e: any) {
      alert(e?.message ?? "Delete failed.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full  px-6 py-6  mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Egg  Hatchery Process"
        CurrentPageName={isEdit ? "Edit Record" : "New Entry"}
      />

      <Card className="w-full  min-h-[calc(90vh-120px)] p-6 space-y-4 mt-2">
        <CardContent className="max-w-2xl p-4 space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-4"> 
                <div className="space-y-1">
                  <Label>Egg Reference No.</Label>
                  <Select
                    value={form.egg_ref}
                    onValueChange={(v) => setField("egg_ref", v)}
                    disabled={eggRefsLoading || saving}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          eggRefsLoading ? "Loading..." : "Select Egg Reference No."
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {eggRefs.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
               <Separator />
                <div className="space-y-1">
                  <Label>Farm Source</Label>
                  <Input
                    value={form.farm_source}
                    onChange={(e) => setField("farm_source", e.target.value)}
                    placeholder=""
                  />
                </div>

                <div className="space-y-1">
                  <Label>Date Received</Label>
                  <Input
                    type="date"
                    value={form.daterec}
                    onChange={(e) => setField("daterec", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Machine No.</Label>
                  <Input
                    value={form.machine_no}
                    onChange={(e) => setField("machine_no", e.target.value)}
                    placeholder=""
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Hatch Temperature</Label>
                  <Input
                    value={form.hatch_temp}
                    onChange={(e) => setField("hatch_temp", e.target.value)}
                    placeholder=""
                  />
                </div>

                <div className="space-y-1">
                  <Label>Hatch Humidity</Label>
                  <Input
                    value={form.hatch_humidity}
                    onChange={(e) => setField("hatch_humidity", e.target.value)}
                    placeholder=""
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Hatch Time Start</Label>
                  <Input
                    type="datetime-local"
                    value={form.hatch_time_start}
                    onChange={(e) => setField("hatch_time_start", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Hatch Time End</Label>
                  <Input
                    type="datetime-local"
                    value={form.hatch_time_end}
                    onChange={(e) => setField("hatch_time_end", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Duration</Label>
                  <Input disabled value={fmtDuration(durationMinutes)} placeholder="" />
                  <Input value={form.duration} disabled placeholder="" />
                </div>

                <div className="space-y-1">
                  <Label>Hatch Window (minutes)</Label>
                  <Input
                    inputMode="numeric"
                    value={form.hatch_window}
                    onChange={(e) => setField("hatch_window", e.target.value)}
                    placeholder=""
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Total Egg Loaded</Label>
                <Input
                  inputMode="numeric"
                  value={form.total_egg}
                  onChange={(e) => setField("total_egg", e.target.value)}
                  placeholder=""
                />
              </div>

      
              <FormActionButtons
                  saving={saving}
                  isEdit={isEdit}
                  // disabled={disabledAll}
                  cancelPath="/a_baja/egghatcheryprocessform"
                  onSave={onSave}
                />
                                
                {/* <Button type="button" onClick={onSave} disabled={saving}>
                  {saving ? "Saving..." : isEdit ? "Update" : "Save"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/a_baja/egghatcheryprocessform")}
                  disabled={saving}
                >
                  Cancel
                </Button> */} 
              
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}