"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Separator } from "@/components/ui/separator"

import {
  ChickPulloutProcess,
  createChickPulloutProcess,
  getChickPulloutProcessById,
  listEggReferences,
  getEggReferenceMeta,
  updateChickPulloutProcess,
} from "./api"
import FormActionButtons from "@/components/FormActionButtons"

function num(v: any) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, n)
}

export default function CheckPulloutForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const idParam = sp.get("id")
  const editId = idParam ? Number(idParam) : null

  const [saving, setSaving] = useState(false)
  const [eggRefs, setEggRefs] = useState<string[]>([])

  const [form, setForm] = useState<Partial<ChickPulloutProcess>>({
    egg_ref_no: "",
    chick_hatch_ref_no: "", // auto: we can mirror egg ref or keep blank
    farm_source: "",
    machine_no: "",
    hatch_date: "",
    chicks_hatched: 0,
    dead_in_shell: 0,
    hatch_window: 0,
  })

  function clampNonNegative(value: string) {
  // allow empty while typing if you want; but you said "return to 0"
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, n)
}

function onNumChange<K extends keyof ChickPulloutProcess>(key: K) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = clampNonNegative(e.target.value)
    setForm((p) => ({ ...p, [key]: v }))
  }
}


  // Load dropdown + edit record
  useEffect(() => {
    ;(async () => {
      try {
        const refs = await listEggReferences()
        setEggRefs(refs)
      } catch (e: any) {
        console.error(e)
      }
    })()
  }, [])

  useEffect(() => {
    if (!editId) return
    ;(async () => {
      try {
        const rec = await getChickPulloutProcessById(editId)
        setForm({
          ...rec,
          // ensure strings
          egg_ref_no: rec.egg_ref_no ?? "",
          chick_hatch_ref_no: rec.chick_hatch_ref_no ?? "",
          farm_source: rec.farm_source ?? "",
          machine_no: rec.machine_no ?? "",
          hatch_date: rec.hatch_date ?? "",
          chicks_hatched: rec.chicks_hatched ?? 0,
          dead_in_shell: rec.dead_in_shell ?? 0,
          hatch_window: rec.hatch_window ?? 0,
        })
      } catch (e) {
        console.error(e)
      }
    })()
  }, [editId])

  // When egg_ref changes: auto-fill farm/machine/hatch_window, and auto set chick_hatch_ref_no
  useEffect(() => {
    const egg = form.egg_ref_no?.trim()
    if (!egg) return

    // auto mirror
    setForm((p) => ({ ...p, chick_hatch_ref_no: egg }))

    ;(async () => {
      try {
        const meta = await getEggReferenceMeta(egg)
        if (!meta) return
        setForm((p) => ({
          ...p,
          farm_source: meta.farm_source ?? "",
          machine_no: meta.machine_no ? String(meta.machine_no) : "",
          hatch_window: meta.hatch_window ? Number(meta.hatch_window) : 0,
        }))
      } catch (e) {
        console.error(e)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.egg_ref_no])

  const fertileTotal = useMemo(() => {
    return num(form.chicks_hatched) + num(form.dead_in_shell)
  }, [form.chicks_hatched, form.dead_in_shell])

  const hatchOfFertile = useMemo(() => {
    if (fertileTotal <= 0) return 0
    return (num(form.chicks_hatched) / fertileTotal) * 100
  }, [fertileTotal, form.chicks_hatched])

  const mortalityRate = useMemo(() => {
    if (fertileTotal <= 0) return 0
    return (num(form.dead_in_shell) / fertileTotal) * 100
  }, [fertileTotal, form.dead_in_shell])

  async function onSave() {
    try {
      setSaving(true)

      const payload: Partial<ChickPulloutProcess> = {
        egg_ref_no: form.egg_ref_no?.trim() || null,
        chick_hatch_ref_no: form.chick_hatch_ref_no?.trim() || null,
        farm_source: form.farm_source?.trim() || null,
        machine_no: form.machine_no?.trim() || null,
        hatch_date: form.hatch_date || null,
        chicks_hatched: num(form.chicks_hatched),
        dead_in_shell: num(form.dead_in_shell),
        hatch_window: num(form.hatch_window),

        // store computed (rounded)
        hatch_fertile: Math.round(hatchOfFertile * 100) / 100,
        mortality_rate: Math.round(mortalityRate * 100) / 100,
      }

      if (editId) {
        await updateChickPulloutProcess(editId, payload)
      } else {
        await createChickPulloutProcess(payload as ChickPulloutProcess)
      }

      router.push("/a_baja/chickpullout")
      router.refresh()
    } catch (e: any) {
      console.error(e)
      alert(e?.message ?? "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Chick Pullout Process</CardTitle>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4 space-y-3">
        {/* EGG REFERENCE */}
        <div className="space-y-1">
          <Label>Egg Refference No.</Label>
          <Select
            value={form.egg_ref_no ?? ""}
            onValueChange={(v) => setForm((p) => ({ ...p, egg_ref_no: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select egg reference..." />
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

        {/* CHICK HATCHED REFERENCE (AUTO) */}
        <div className="space-y-1">
          <Label>Chick Hatch Ref. No.</Label>
          <Input value={form.chick_hatch_ref_no ?? ""} disabled />
        </div>

        {/* FARM SOURCE */}
        <div className="space-y-1">
          <Label>Farm Source</Label>
          <Input value={form.farm_source ?? ""} disabled placeholder="AUTO" />
        </div>

        {/* MACHINE NUMBER */}
        <div className="space-y-1">
          <Label>Machine Number</Label>
          <Input value={form.machine_no ?? ""} disabled placeholder="AUTO" />
        </div>

        {/* DATE Hatch */}
        <div className="space-y-1">
          <Label>Date Hatch</Label>
          <Input
            type="date"
            value={form.hatch_date ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, hatch_date: e.target.value }))}
          />
        </div>

        {/* CHICKS HATCHED */}
        <div className="space-y-1">
          <Label>Chick Hatched</Label>
          <Input
            type="number"
            min={0}
            value={String(form.chicks_hatched ?? 0)}
            onChange={onNumChange("chicks_hatched")}
            onBlur={(e) => {
              // force to 0 if somehow left blank/negative
              const v = clampNonNegative(e.target.value)
              e.currentTarget.value = String(v)
              setForm((p) => ({ ...p, chicks_hatched: v }))
            }}
          />
        </div>

        {/* DEAD -IN- SHELL */}
        <div className="space-y-1">
          <Label>Dead -In- Shell</Label>
          <Input
            type="number"
            min={0}
            value={String(form.dead_in_shell ?? 0)}
            onChange={onNumChange("dead_in_shell")}
            onBlur={(e) => {
              const v = clampNonNegative(e.target.value)
              e.currentTarget.value = String(v)
              setForm((p) => ({ ...p, dead_in_shell: v }))
            }}
          />
        </div>


        {/* HATCH OF FERTILE (AUTO) */}
        <div className="space-y-1">
          <Label>Hatch Of Fertile</Label>
          <Input value={`${hatchOfFertile.toFixed(2)} %`} disabled />
        </div>

        {/* HATCH WINDOW (AUTO) */}
        <div className="space-y-1">
          <Label>Hatch Window</Label>
          <Input value={String(form.hatch_window ?? 0)} disabled />
        </div>

        {/* MORTALITY RATE (AUTO) */}
        <div className="space-y-1">
          <Label>Mortality Rate</Label>
          <Input value={`${mortalityRate.toFixed(2)} %`} disabled />
        </div>
       {/* Actions */}
                <FormActionButtons
                  saving={saving}
                  // isEdit={isEdit}
                  // disabled={disabledAll}
                  cancelPath="/a_baja/chickpullout"
                  onSave={onSave}
                />
                
        {/* <div className="flex gap-2 pt-2">
          <Button onClick={onSave} disabled={saving} className="w-32">
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/a_baja/chickpullout")}
            className="w-32"
          >
            Cancel
          </Button>
        </div> */}


      </CardContent>
    </Card>
  )
}
