"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Thermometer } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import Breadcrumb from "@/lib/Breadcrumb";
import {
  createEggPreWarming,
  updateEggPreWarming,
  getEggPreWarmingById,
  listHatchClassiRefs,
  type HatchClassiRefOption,
} from "./api";
import FormActionButtons from "@/components/FormActionButtons";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import RequiredLabel from "@/components/RequiredLabel";
import TemperatureConverter from "@/components/TemperatureConverter";
import SearchableDropdown1 from "@/lib/SearchableDropdown1";

type FormState = {
  egg_ref_no: string[];
  pre_temp: string;
  egg_temp: string;
  egg_temp_time_start: string;
  egg_temp_time_end: string;
  remarks: string;
};

type TemperatureFieldKey = "pre_temp" | "egg_temp";

function durationInMinutes(
  startIsoLocal: string,
  endIsoLocal: string,
): number | null {
  if (!startIsoLocal || !endIsoLocal) return null;

  const start = new Date(startIsoLocal).getTime();
  const end = new Date(endIsoLocal).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const diffMs = end - start;
  if (diffMs < 0) return null;

  return Math.round(diffMs / 60000);
}

function fmtDuration(mins: number | null) {
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} min`;
  return `${h} hr ${m} min`;
}

function toLocalInputValue(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function clampNonNegative(raw: string, opts?: { allowDecimal?: boolean }) {
  if (raw === "") return "";

  let v = raw.replace(/-/g, "");

  if (opts?.allowDecimal) {
    v = v.replace(/[^0-9.]/g, "");
    const parts = v.split(".");
    if (parts.length > 2) v = `${parts[0]}.${parts.slice(1).join("")}`;
  } else {
    v = v.replace(/[^0-9]/g, "");
  }

  if (opts?.allowDecimal && v.startsWith(".")) v = `0${v}`;

  const num = Number(v);
  if (!Number.isFinite(num)) return "";
  return String(Math.max(0, num));
}

function TemperatureInput({
  label,
  value,
  onChange,
  onOpenConverter,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onOpenConverter: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) =>
            onChange(
              clampNonNegative(e.target.value, {
                allowDecimal: true,
              }),
            )
          }
          className="pr-24"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenConverter}
          disabled={disabled}
          className="absolute right-1 top-1/2 h-8 -translate-y-1/2 gap-1 px-2 text-muted-foreground hover:text-foreground"
          aria-label={`Open temperature converter for ${label}`}
        >
          <Thermometer className="size-4" />
          <span className="text-xs font-medium">C/F</span>
        </Button>
      </div>
    </div>
  );
}

export default function Prewarmingform() {
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id");
  const editId = idParam ? Number(idParam) : null;
  const isEdit = Number.isFinite(editId) && (editId as number) > 0;

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState<boolean>(!!isEdit);

  const [eggRefs, setEggRefs] = useState<HatchClassiRefOption[]>([]);
  const [refLoading, setRefLoading] = useState(true);
  const [converterField, setConverterField] =
    useState<TemperatureFieldKey | null>(null);

  const [form, setForm] = useState<FormState>({
    egg_ref_no: [],
    pre_temp: "",
    egg_temp: "",
    egg_temp_time_start: "",
    egg_temp_time_end: "",
    remarks: "",
  });

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setRefLoading(true);
      try {
        const refs = await listHatchClassiRefs();
        if (!mounted) return;
        setEggRefs(refs);
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setRefLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const item = await getEggPreWarmingById(editId as number);
        if (!mounted) return;
        if (!item) {
          alert("Record not found.");
          router.push("/jmb/prewarmingv2");
          return;
        }

        setForm({
          egg_ref_no: item.egg_ref_no ? [item.egg_ref_no] : [],
          pre_temp: item.pre_temp ?? "",
          egg_temp: item.egg_temp ?? "",
          egg_temp_time_start: toLocalInputValue(item.egg_temp_time_start),
          egg_temp_time_end: toLocalInputValue(item.egg_temp_time_end),
          remarks: item.remarks ?? "",
        });
      } catch (e: any) {
        alert(e?.message ?? "Failed to load record.");
        router.push("/jmb/prewarmingv2");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isEdit, editId, router]);

  const durationMins = useMemo(
    () => durationInMinutes(form.egg_temp_time_start, form.egg_temp_time_end),
    [form.egg_temp_time_start, form.egg_temp_time_end],
  );

  const durationDisplay = useMemo(() => fmtDuration(durationMins), [durationMins]);

  const converterLabel =
    converterField === "pre_temp"
      ? "Pre-warming Temp"
      : converterField === "egg_temp"
        ? "Egg Shell Temp"
        : "Temperature";
  const converterInputValue = converterField ? Number(form[converterField]) : 0;

  async function onSave() {
    if (!form.egg_ref_no.length) {
      alert("Egg Reference No. is required.");
      return;
    }

    if (
      form.egg_temp_time_start &&
      form.egg_temp_time_end &&
      durationMins === null
    ) {
      alert("End Time must be after Start Time.");
      return;
    }

    setSaving(true);
    try {
      const basePayload = {
        pre_temp: form.pre_temp || null,
        egg_temp: form.egg_temp || null,
        egg_temp_time_start: form.egg_temp_time_start || null,
        egg_temp_time_end: form.egg_temp_time_end || null,
        duration: durationMins,
        remarks: form.remarks || null,
        is_active: true,
      };

      if (isEdit) {
        await updateEggPreWarming(editId as number, {
          ...basePayload,
          egg_ref_no: form.egg_ref_no[0] ?? null,
        });
      } else {
        const payloads = form.egg_ref_no.map((ref) => ({
          ...basePayload,
          egg_ref_no: ref,
        }));

        await createEggPreWarming(payloads);
      }

      router.push("/jmb/prewarmingv2");
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full px-6 py-6 mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Egg Pre-Warming"
        CurrentPageName={isEdit ? "Edit Entry" : "New Entry"}
      />

      <Card className="w-full min-h-[calc(90vh-120px)] p-6 space-y-2 mt-2">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CardContent className="max-w-2xl p-2 space-y-2">
              {(loading || refLoading) && (
                <div className="text-sm text-muted-foreground">
                  {loading ? "Loading record..." : "Loading egg references..."}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <RequiredLabel>Egg Reference No.</RequiredLabel>
                  <SearchableDropdown1
                    list={eggRefs}
                    codeLabel="egg_ref_no"
                    nameLabel="egg_ref_no"
                    showNameOnly
                    value={form.egg_ref_no}
                    onChange={(v) => setForm((p) => ({ ...p, egg_ref_no: v }))}
                    multiple
                    disabled={saving || refLoading}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <TemperatureInput
                  label="Pre-warming Temp"
                  value={form.pre_temp}
                  onChange={(value) =>
                    setForm((p) => ({ ...p, pre_temp: value }))
                  }
                  onOpenConverter={() => setConverterField("pre_temp")}
                  disabled={saving}
                />

                <TemperatureInput
                  label="Egg Shell Temp"
                  value={form.egg_temp}
                  onChange={(value) =>
                    setForm((p) => ({ ...p, egg_temp: value }))
                  }
                  onOpenConverter={() => setConverterField("egg_temp")}
                  disabled={saving}
                />

                <div />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="datetime-local"
                    value={form.egg_temp_time_start}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        egg_temp_time_start: e.target.value,
                      }))
                    }
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="datetime-local"
                    value={form.egg_temp_time_end}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        egg_temp_time_end: e.target.value,
                      }))
                    }
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input value={durationDisplay ?? ""} disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, remarks: e.target.value }))
                  }
                  className="min-h-27.5"
                  disabled={saving}
                />
              </div>

              <FormActionButtons
                saving={saving}
                isEdit={isEdit}
                cancelPath="/jmb/prewarmingv2"
                onSave={onSave}
              />
            </CardContent>
          </div>
        </div>
      </Card>

      <Dialog
        open={!!converterField}
        onOpenChange={(open) => {
          if (!open) setConverterField(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{converterLabel} Converter</DialogTitle>
            <DialogDescription>
              Convert temperatures and apply the result back to the selected
              field.
            </DialogDescription>
          </DialogHeader>

          <TemperatureConverter
            key={`${converterField ?? "temperature"}-${form[converterField ?? "pre_temp"] ?? ""}`}
            title={converterLabel}
            defaultFromUnit="C"
            defaultValue={
              Number.isFinite(converterInputValue) ? converterInputValue : 0
            }
            showApplyButton
            onApply={(value) => {
              if (!converterField) return;

              setForm((prev) => ({
                ...prev,
                [converterField]: String(Number(value.toFixed(2))),
              }));
              setConverterField(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
