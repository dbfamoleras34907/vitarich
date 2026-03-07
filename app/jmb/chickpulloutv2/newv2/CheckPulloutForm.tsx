"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import {
  ChickPulloutProcess,
  createChickPulloutProcess,
  getChickPulloutProcessById,
  listEggReferences,
  getEggReferenceMeta,
  updateChickPulloutProcess,
} from "./api";

import Breadcrumb from "@/lib/Breadcrumb";
import FormActionButtons from "@/components/FormActionButtons";

function num(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function clampNonNegative(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

export default function CheckPulloutForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id");

  const editId = useMemo(() => (idParam ? Number(idParam) : null), [idParam]);
  const isEdit = !!editId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [eggRefs, setEggRefs] = useState<string[]>([]);
  const [eggRefsLoading, setEggRefsLoading] = useState(false);

  const [form, setForm] = useState<Partial<ChickPulloutProcess>>({
    egg_ref_no: "",
    chick_hatch_ref_no: "",
    farm_source: "",
    machine_no: "",
    hatch_date: "",
    chicks_hatched: 0,
    dead_in_shell: 0,
    hatch_window: 0,
  });

  function setField<K extends keyof ChickPulloutProcess>(
    key: K,
    value: ChickPulloutProcess[K],
  ) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function onNumChange<K extends keyof ChickPulloutProcess>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = clampNonNegative(e.target.value);
      setForm((p) => ({ ...p, [key]: v as any }));
    };
  }

  // ✅ load dropdown options
  useEffect(() => {
    let alive = true;
    (async () => {
      setEggRefsLoading(true);
      try {
        const refs = await listEggReferences();
        if (!alive) return;
        setEggRefs(refs);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setEggRefs([]);
      } finally {
        if (alive) setEggRefsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ✅ load edit record
  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    (async () => {
      try {
        const rec = await getChickPulloutProcessById(editId);
        setForm({
          ...rec,
          egg_ref_no: rec.egg_ref_no ?? "",
          chick_hatch_ref_no: rec.chick_hatch_ref_no ?? "",
          farm_source: rec.farm_source ?? "",
          machine_no: rec.machine_no ?? "",
          hatch_date: rec.hatch_date ?? "",
          chicks_hatched: rec.chicks_hatched ?? 0,
          dead_in_shell: rec.dead_in_shell ?? 0,
          hatch_window: rec.hatch_window ?? 0,
        });
      } catch (e: any) {
        alert(e?.message ?? "Failed to load record.");
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  // ✅ when egg_ref changes: auto mirror + auto meta
  useEffect(() => {
    const egg = (form.egg_ref_no ?? "").trim();
    if (!egg) return;

    // mirror chick hatch ref
    setForm((p) => ({ ...p, chick_hatch_ref_no: egg }));

    let alive = true;
    (async () => {
      try {
        const meta = await getEggReferenceMeta(egg);
        if (!alive || !meta) return;
        setForm((p) => ({
          ...p,
          farm_source: meta.farm_source ?? "",
          machine_no: meta.machine_no ? String(meta.machine_no) : "",
          hatch_window: meta.hatch_window ? Number(meta.hatch_window) : 0,
        }));
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.egg_ref_no]);

  const fertileTotal = useMemo(() => {
    return num(form.chicks_hatched) + num(form.dead_in_shell);
  }, [form.chicks_hatched, form.dead_in_shell]);

  const hatchOfFertile = useMemo(() => {
    if (fertileTotal <= 0) return 0;
    return (num(form.chicks_hatched) / fertileTotal) * 100;
  }, [fertileTotal, form.chicks_hatched]);

  const mortalityRate = useMemo(() => {
    if (fertileTotal <= 0) return 0;
    return (num(form.dead_in_shell) / fertileTotal) * 100;
  }, [fertileTotal, form.dead_in_shell]);

  async function onSave() {
    if (!(form.egg_ref_no ?? "").trim()) {
      alert("Egg Reference No. is required.");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<ChickPulloutProcess> = {
        egg_ref_no: form.egg_ref_no?.trim() || null,
        chick_hatch_ref_no: form.chick_hatch_ref_no?.trim() || null,
        farm_source: form.farm_source?.trim() || null,
        machine_no: form.machine_no?.trim() || null,
        hatch_date: form.hatch_date || null,

        chicks_hatched: num(form.chicks_hatched),
        dead_in_shell: num(form.dead_in_shell),
        hatch_window: num(form.hatch_window),

        hatch_fertile: Math.round(hatchOfFertile * 100) / 100,
        mortality_rate: Math.round(mortalityRate * 100) / 100,
      };

      if (isEdit && editId) {
        await updateChickPulloutProcess(editId, payload);
        alert("Updated successfully.");
      } else {
        await createChickPulloutProcess(payload as ChickPulloutProcess);
        alert("Saved successfully.");
      }

      router.push("/jmb/chickpulloutv2");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full  px-6 py-6  mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Chick Pullout Process"
        CurrentPageName={isEdit ? "Edit Record" : "New Entry"}
      />

      <Card className="w-full  min-h-[calc(90vh-120px)] p-6 space-y-4 mt-2">
        <CardContent className="max-w-2xl p-4 space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Reference */}
              <div className="space-y-1">
                <Label>Egg Reference No.</Label>
                <Select
                  value={form.egg_ref_no ?? ""}
                  onValueChange={(v) => setField("egg_ref_no", v as any)}
                  disabled={eggRefsLoading || saving}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        eggRefsLoading
                          ? "Loading..."
                          : "Select Egg Reference No."
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

              {/* AUTO fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Chick Hatch Ref. No.</Label>
                  <Input value={form.chick_hatch_ref_no ?? ""} disabled />
                </div>

                <div className="space-y-1">
                  <Label>Hatch Window</Label>
                  <Input value={String(form.hatch_window ?? 0)} disabled />
                </div>

                <div className="space-y-1">
                  <Label>Farm Source</Label>
                  <Input
                    value={form.farm_source ?? ""}
                    disabled
                    placeholder=""
                  />
                </div>

                <div className="space-y-1">
                  <Label>Machine Number</Label>
                  <Input
                    value={form.machine_no ?? ""}
                    disabled
                    placeholder=""
                  />
                </div>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <Label>Date Hatch</Label>
                <Input
                  type="date"
                  value={form.hatch_date ?? ""}
                  onChange={(e) =>
                    setField("hatch_date", e.target.value as any)
                  }
                />
              </div>

              {/* Numbers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Chick Hatched</Label>
                  <Input
                    type="number"
                    min={0}
                    value={String(form.chicks_hatched ?? 0)}
                    onChange={onNumChange("chicks_hatched")}
                    onBlur={(e) => {
                      const v = clampNonNegative(e.target.value);
                      e.currentTarget.value = String(v);
                      setForm((p) => ({ ...p, chicks_hatched: v }));
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Dead -In- Shell</Label>
                  <Input
                    type="number"
                    min={0}
                    value={String(form.dead_in_shell ?? 0)}
                    onChange={onNumChange("dead_in_shell")}
                    onBlur={(e) => {
                      const v = clampNonNegative(e.target.value);
                      e.currentTarget.value = String(v);
                      setForm((p) => ({ ...p, dead_in_shell: v }));
                    }}
                  />
                </div>
              </div>

              {/* Computed */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Hatch Of Fertile</Label>
                  <Input value={`${hatchOfFertile.toFixed(2)} %`} disabled />
                </div>

                <div className="space-y-1">
                  <Label>Mortality Rate</Label>
                  <Input value={`${mortalityRate.toFixed(2)} %`} disabled />
                </div>
              </div>

              {/* Actions */}
              <FormActionButtons
                saving={saving}
                isEdit={isEdit}
                cancelPath="/jmb/chickpulloutv2"
                onSave={onSave}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
