"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import Breadcrumb from "@/lib/Breadcrumb"
import {
  createEggPreWarming,
  updateEggPreWarming,
  getEggPreWarmingById,
  listHatchClassiRefs,
  type HatchClassiRefOption,
} from "./api"
import FormActionButtons from "@/components/FormActionButtons"
import SearchableDropdown from "@/lib/SearchableDropdown"

type FormState = {
  egg_ref_no: string
  pre_temp: string
  egg_temp: string
  egg_temp_time_start: string // datetime-local
  egg_temp_time_end: string // datetime-local
  remarks: string
}

function durationInMinutes(startIsoLocal: string, endIsoLocal: string): number | null {
  if (!startIsoLocal || !endIsoLocal) return null

  const start = new Date(startIsoLocal).getTime()
  const end = new Date(endIsoLocal).getTime()

  if (Number.isNaN(start) || Number.isNaN(end)) return null
  const diffMs = end - start
  if (diffMs < 0) return null

  return Math.round(diffMs / 60000)
}

function fmtDuration(mins: number | null) {
  if (mins == null) return ""
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m} min`
  return `${h} hr ${m} min`
}

/** DB timestamp -> datetime-local */
function toLocalInputValue(v: string | null) {
  if (!v) return ""
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Prewarmingform() {
  const router = useRouter()
  const sp = useSearchParams()
  const idParam = sp.get("id")
  const editId = idParam ? Number(idParam) : null
  const isEdit = Number.isFinite(editId) && (editId as number) > 0

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState<boolean>(!!isEdit)

  const [eggRefs, setEggRefs] = useState<HatchClassiRefOption[]>([])
  const [refLoading, setRefLoading] = useState(true)

  const [form, setForm] = useState<FormState>({
    egg_ref_no: "",
    pre_temp: "",
    egg_temp: "",
    egg_temp_time_start: "",
    egg_temp_time_end: "",
    remarks: "",
  })

  // Load dropdown options
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setRefLoading(true)
      try {
        const refs = await listHatchClassiRefs()
        if (!mounted) return
        setEggRefs(refs)
      } catch (e) {
        console.error(e)
      } finally {
        if (mounted) setRefLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Load record on edit
  useEffect(() => {
    if (!isEdit) return
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const item = await getEggPreWarmingById(editId as number)
        if (!mounted) return
        if (!item) {
          alert("Record not found.")
          router.push("/a_baja/prewarming")
          return
        }

        setForm({
          egg_ref_no: item.egg_ref_no ?? "",
          pre_temp: item.pre_temp ?? "",
          egg_temp: item.egg_temp ?? "",
          egg_temp_time_start: toLocalInputValue(item.egg_temp_time_start),
          egg_temp_time_end: toLocalInputValue(item.egg_temp_time_end),
          remarks: item.remarks ?? "",
        })
      } catch (e: any) {
        alert(e?.message ?? "Failed to load record.")
        router.push("/a_baja/prewarming")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [isEdit, editId, router])

  const durationMins = useMemo(
    () => durationInMinutes(form.egg_temp_time_start, form.egg_temp_time_end),
    [form.egg_temp_time_start, form.egg_temp_time_end]
  )

  const durationDisplay = useMemo(() => fmtDuration(durationMins), [durationMins])

  async function onSave() {
    if (!form.egg_ref_no.trim()) {
      alert("Egg Reference No. is required.")
      return
    }
    if (form.egg_temp_time_start && form.egg_temp_time_end && durationMins === null) {
      alert("End Time must be after Start Time.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        egg_ref_no: form.egg_ref_no.trim(),
        pre_temp: form.pre_temp || null,
        egg_temp: form.egg_temp || null,
        egg_temp_time_start: form.egg_temp_time_start || null,
        egg_temp_time_end: form.egg_temp_time_end || null,
        duration: durationMins,
        remarks: form.remarks || null,
        is_active: true,
      }

      if (isEdit) {
        await updateEggPreWarming(editId as number, payload)
      } else {
        await createEggPreWarming(payload)
      }

      router.push("/a_baja/prewarming")
      router.refresh()
    } catch (e: any) {
      alert(e?.message ?? "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full  px-6 py-6  mt-4"> 
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Egg Pre-Warming"
        CurrentPageName={isEdit ? "Edit Entry" : "New Entry"}
      />

      <Card className="w-full  min-h-[calc(90vh-120px)] p-6 space-y-2 mt-2"> 
        <CardContent className="max-w-2xl p-2 space-y-2"> 
          {(loading || refLoading) && (
            <div className="text-sm text-muted-foreground">
              {loading ? "Loading record..." : "Loading egg references..."}
            </div>
          )}

          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Egg Reference No.</Label> 
              <Select
                value={form.egg_ref_no}
                onValueChange={(v) => setForm((p) => ({ ...p, egg_ref_no: v }))}
                disabled={saving || refLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={refLoading ? "Loading..." : "Select Egg Ref. No."} />
                </SelectTrigger>
                <SelectContent>
                  {eggRefs.map((r) => (
                    <SelectItem key={r.classi_ref_no} value={r.classi_ref_no}>
                      {r.classi_ref_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
             
            </div> 
          </div>
          <Separator />
          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Pre-Warming Temp</Label>
              <Input
                value={form.pre_temp}
                onChange={(e) => setForm((p) => ({ ...p, pre_temp: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Egg Shell Temp</Label>
              <Input
                value={form.egg_temp}
                onChange={(e) => setForm((p) => ({ ...p, egg_temp: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div />
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="datetime-local"
                value={form.egg_temp_time_start}
                onChange={(e) => setForm((p) => ({ ...p, egg_temp_time_start: e.target.value }))}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="datetime-local"
                value={form.egg_temp_time_end}
                onChange={(e) => setForm((p) => ({ ...p, egg_temp_time_end: e.target.value }))}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Input value={durationDisplay ?? ""} disabled />
            </div>
          </div>

          {/* Row 4 */}
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              value={form.remarks}
              onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
              className="min-h-27.5"
              disabled={saving}
            />
          </div>

          {/* Actions */}
             <FormActionButtons
                            saving={saving}
                            isEdit={isEdit}
                            // disabled={disabledAll}
                            cancelPath="/a_baja/prewarming"
                            onSave={onSave}
                          /> 
        </CardContent>
      </Card>
    </div>
  )
}