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
import { db } from "@/lib/Supabase/supabaseClient"
import {
  createEggStorage,
  getEggStorageById,
  updateEggStorage,
  type EggStorageInsert,
} from "./api"
import FormActionButtons from "@/components/FormActionButtons"

type HatchClassiRefOption = {
  classi_ref_no: string
  date_classify: string | null
}

function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(value: string) {
  if (!value) return null
  const d = new Date(value)
  return d.toISOString()
}

export default function Eggstorageform() {
  const router = useRouter()
  const sp = useSearchParams()
  const idParam = sp.get("id")
  const editId = idParam ? Number(idParam) : null
  const isEdit = Number.isFinite(editId) && (editId as number) > 0

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // dropdown
  const [classiRefNo, setClassiRefNo] = useState("")
  const [classiRefs, setClassiRefs] = useState<HatchClassiRefOption[]>([])
  const [classiRefLoading, setClassiRefLoading] = useState(false)

  const [stor_temp, setStorTemp] = useState("")
  const [room_temp, setRoomTemp] = useState("")
  const [stor_humi, setStorHumi] = useState("")
  const [shellStartLocal, setShellStartLocal] = useState("")
  const [shellEndLocal, setShellEndLocal] = useState("")
  const [remarks, setRemarks] = useState("")

  // load ref options
  useEffect(() => {
    const loadClassiRefs = async () => {
      try {
        setClassiRefLoading(true)
        const { data, error } = await db
          .from("hatch_classification")
          .select("classi_ref_no,date_classify")
          .order("date_classify", { ascending: false })
          .order("classi_ref_no", { ascending: false })

        if (error) throw error
        setClassiRefs((data ?? []) as HatchClassiRefOption[])
      } catch (e) {
        console.error(e)
        setClassiRefs([])
      } finally {
        setClassiRefLoading(false)
      }
    }
    loadClassiRefs()
  }, [])

  // load record if edit
  useEffect(() => {
    if (!isEdit) return

    const loadRecord = async () => {
      try {
        setLoading(true)
        const data = await getEggStorageById(editId as number)

        setClassiRefNo(data.classi_ref_no ?? "")
        setStorTemp(data.stor_temp ?? "")
        setRoomTemp(data.room_temp ?? "")
        setStorHumi(data.stor_humi ?? "")
        setShellStartLocal(toDatetimeLocalValue(data.shell_start))
        setShellEndLocal(toDatetimeLocalValue(data.shell_end))
        setRemarks(data.remarks ?? "")
      } catch (e) {
        console.error(e)
        alert("Failed to load record.")
        router.push("/a_baja/eggstorage")
      } finally {
        setLoading(false)
      }
    }

    loadRecord()
  }, [isEdit, editId, router])

  const durationSeconds = useMemo(() => {
    if (!shellStartLocal || !shellEndLocal) return null
    const s = new Date(shellStartLocal).getTime()
    const e = new Date(shellEndLocal).getTime()
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null
    return Math.floor((e - s) / 1000)
  }, [shellStartLocal, shellEndLocal])

  const durationDisplay = useMemo(() => {
    if (durationSeconds == null) return ""
    const hours = Math.floor(durationSeconds / 3600)
    const minutes = Math.floor((durationSeconds % 3600) / 60)
    if (hours <= 0) return `${minutes}m`
    return `${hours}h ${minutes}m`
  }, [durationSeconds])

  async function onSave() {
    try {
      setSaving(true)

      const payload: EggStorageInsert = {
        stor_temp: stor_temp || null,
        room_temp: room_temp || null,
        stor_humi: stor_humi || null,
        shell_start: fromDatetimeLocalValue(shellStartLocal),
        shell_end: fromDatetimeLocalValue(shellEndLocal),
        duration: durationSeconds,
        remarks: remarks || null,
        classi_ref_no: classiRefNo || null,
      }

      if (isEdit) {
        await updateEggStorage(editId as number, payload) // ✅ 2 args
      } else {
        await createEggStorage(payload)
      }

      router.push("/a_baja/eggstorage")
      router.refresh()
    } catch (err: any) {
      alert(err?.message ?? "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-6xl ml-0 p-6 space-y-2">
      <Breadcrumb
        FirstPreviewsPageName="Egg Storage Management"
        SecondPreviewPageName="Hatchery "
        CurrentPageName={isEdit ? "Edit Record" : "New Record"}
      />
      <Separator />

      <CardContent className="p-2 space-y-2">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <>
            {/* Reference No. */}
            <div className="grid grid-cols-1 gap-2">
              <Label>Reference No.</Label>
              <Select value={classiRefNo} onValueChange={setClassiRefNo}>
                <SelectTrigger disabled={classiRefLoading || saving}>
                  <SelectValue
                    placeholder={
                      classiRefLoading ? "Loading..." : "Select Reference No."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {classiRefs.map((r) => (
                    <SelectItem key={r.classi_ref_no} value={r.classi_ref_no}>
                      {r.classi_ref_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* TEMPS / HUMI */}
            <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
              <div className="grid grid-cols-1 gap-2">
                <Label>Storage Temperature</Label>
                <Input
                  value={stor_temp}
                  onChange={(e) => setStorTemp(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Label>Room Temperature</Label>
                <Input
                  value={room_temp}
                  onChange={(e) => setRoomTemp(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Label>Storage Humidity</Label>
                <Input
                  value={stor_humi}
                  onChange={(e) => setStorHumi(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            {/* SHELL TEMP TIMESTAMPS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="grid grid-cols-1 gap-2">
                <Label>Shell Temp DateTime Start</Label>
                <Input
                  type="datetime-local"
                  value={shellStartLocal}
                  onChange={(e) => setShellStartLocal(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Label>Shell Temp DateTime End</Label>
                <Input
                  type="datetime-local"
                  value={shellEndLocal}
                  onChange={(e) => setShellEndLocal(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Label>Duration</Label>
                <Input disabled value={durationDisplay} />
                {shellStartLocal && shellEndLocal && durationSeconds == null && (
                  <p className="text-sm text-destructive mt-1">
                    End must be greater than Start.
                  </p>
                )}
              </div>
            </div>

            {/* REMARKS */}
            <div className="grid grid-cols-1 gap-2">
              <Label>Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="min-h-30"
                disabled={saving}
              />
            </div>

            {/* ACTIONS */}
               <FormActionButtons
                              saving={saving}
                              isEdit={isEdit}
                              // disabled={disabledAll}
                              cancelPath="/a_baja/eggstorage"
                              onSave={onSave}
                            />
                            
            {/* <div className="flex gap-2 justify-end">
              <Button type="button" onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : isEdit ? "Update" : "Save"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/a_baja/eggstorage")}
                disabled={saving}
              >
                Cancel
              </Button>
            </div> */}
          </>
        )}
      </CardContent>
    </Card>
  )
}