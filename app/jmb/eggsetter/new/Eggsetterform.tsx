"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import Breadcrumb from "@/lib/Breadcrumb";

import {
  createSetterIncubation,
  getSetterIncubationById,
  updateSetterIncubation,
  listHatchClassiRefs,
  type HatchClassiRefOption,
  getUserInfo,
} from "./api";
import { Save, Pencil, Loader2, X } from "lucide-react";
import FormActionButtons from "@/components/FormActionButtons";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import RequiredLabel from "@/components/RequiredLabel";
import { DefaultFarm } from "@/lib/types";
import SearchableDropdown from "@/lib/SearchableDropdown";
import TemperatureConverter from "@/components/TemperatureConverter";
type FormState = {
  ref_no: string;
  setting_date: string; // datetime-local
  farm_source: string;
  machine_id: string;

  total_eggs: string;
  incubation_duration: string;

  setter_temp: string;
  egg_shell_temp: string;

  setter_humidity: string;
  egg_shell_temp_dt: string; // datetime-local

  turning_interval: string;
  egg_shell_orientation: "Pointed Up" | "Pointed Down" | "Pointed Middle";

  turning_angle: string;
};

function extractFarmOnly(ref: string) {
  const m = ref?.match(/FARM\d+/i);
  return m ? m[0].toUpperCase() : "";
}

// ISO (or any date string) -> datetime-local string "YYYY-MM-DDTHH:mm"
function toDatetimeLocalValue(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
function clampNonNegative(raw: string, opts?: { allowDecimal?: boolean }) {
  // allow empty (so user can clear the input)
  if (raw === "") return "";

  // remove minus signs
  let v = raw.replace(/-/g, "");

  // allow only digits (and optionally a single dot)
  if (opts?.allowDecimal) {
    v = v.replace(/[^0-9.]/g, "");
    const parts = v.split(".");
    if (parts.length > 2) v = `${parts[0]}.${parts.slice(1).join("")}`;
  } else {
    v = v.replace(/[^0-9]/g, "");
  }

  // normalize like ".5" -> "0.5"
  if (opts?.allowDecimal && v.startsWith(".")) v = `0${v}`;

  // clamp
  const num = Number(v);
  if (!Number.isFinite(num)) return "";
  return String(Math.max(0, num));
}

function blockNegativeKeys(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "-" || e.key === "Minus") e.preventDefault();
}

export default function Eggsetterform() {
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id");
  const isEdit = !!idParam;

  const [saving, setSaving] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);

  const [refOptions, setRefOptions] = useState<HatchClassiRefOption[]>([]);
  const [defaultFarm, setdefaultFarm] = useState<DefaultFarm>();
  const [form, setForm] = useState<FormState>({
    ref_no: "",
    setting_date: "",
    farm_source: "",
    machine_id: "",
    total_eggs: "",
    incubation_duration: "",
    setter_temp: "",
    egg_shell_temp: "",
    setter_humidity: "",
    egg_shell_temp_dt: "",
    turning_interval: "",
    egg_shell_orientation: "Pointed Down",
    turning_angle: "",
  });
  const getDefaultFarm = async () => {
    const data = await getUserInfo();
    setdefaultFarm(data[0]);
    // setHeader(h => h ? { ...h, delivered_to: data[0].code } : h)
  };

  useEffect(() => {
    getDefaultFarm();
  }, []);
  useEffect(() => {
    refreshSessionx(router);
  }, []);
  // Load Reference No. options
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingRefs(true);
      try {
        const rows = await listHatchClassiRefs();
        if (!mounted) return;
        setRefOptions(rows);
      } catch (e: any) {
        alert(e?.message ?? "Failed to load Reference Numbers.");
      } finally {
        if (mounted) setLoadingRefs(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Load record when editing
  useEffect(() => {
    if (!isEdit) return;

    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      alert("Invalid id.");
      router.push("/a_baja/eggsetter");
      return;
    }

    let mounted = true;
    (async () => {
      setLoadingRecord(true);
      try {
        const row = await getSetterIncubationById(id);
        if (!mounted) return;
        if (!row) {
          alert("Record not found.");
          router.push("/a_baja/eggsetter");
          return;
        }

        setForm((p) => ({
          ...p,
          ref_no: row.ref_no ?? "",
          setting_date: toDatetimeLocalValue(row.setting_date),
          farm_source: row.farm_source ?? extractFarmOnly(row.ref_no ?? ""),
          machine_id: row.machine_id ?? "",

          total_eggs:
            row.total_eggs != null && Number.isFinite(Number(row.total_eggs))
              ? String(row.total_eggs)
              : "",
          incubation_duration:
            row.incubation_duration != null
              ? String(row.incubation_duration)
              : "",

          setter_temp: row.setter_temp != null ? String(row.setter_temp) : "",
          egg_shell_temp:
            row.egg_shell_temp != null ? String(row.egg_shell_temp) : "",

          setter_humidity:
            row.setter_humidity != null ? String(row.setter_humidity) : "",
          egg_shell_temp_dt: toDatetimeLocalValue(row.egg_shell_temp_dt),

          turning_interval:
            row.turning_interval != null ? String(row.turning_interval) : "",
          egg_shell_orientation:
            (row.egg_shell_orientation as any) || "Pointed Down",

          turning_angle:
            row.turning_angle != null ? String(row.turning_angle) : "",
        }));
      } catch (e: any) {
        alert(e?.message ?? "Failed to load record.");
      } finally {
        if (mounted) setLoadingRecord(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, idParam]);

  const isValidDates = useMemo(() => {
    if (!form.setting_date) return true;
    if (!form.egg_shell_temp_dt) return true;
    return (
      new Date(form.egg_shell_temp_dt).getTime() >=
      new Date(form.setting_date).getTime()
    );
  }, [form.setting_date, form.egg_shell_temp_dt]);

  function handleSelectRef(ref: string) {
    const picked = refOptions.find((x) => x.classi_ref_no === ref);

    setForm((p) => ({
      ...p,
      ref_no: ref,
      farm_source: extractFarmOnly(ref),
      // keep your old behavior: total_eggs from hatch classification good_egg
      total_eggs: picked?.good_egg != null ? String(picked.good_egg) : "",
    }));
  }

  async function onSave() {
    if (!form.ref_no) {
      alert("Reference Number is required.");
      return;
    }
    if (!form.setting_date) {
      alert("Setting Date is required.");
      return;
    }
    if (!form.machine_id.trim()) {
      alert("Setter Machine ID is required.");
      return;
    }
    if (!isValidDates) {
      alert("Egg Shell Temp Date & Time must be after Setting Date.");
      return;
    }

    const payload = {
      ref_no: form.ref_no.trim() || null,
      setting_date: form.setting_date
        ? new Date(form.setting_date).toISOString()
        : null,
      farm_source: form.farm_source.trim() || null,
      machine_id: form.machine_id.trim() || null,

      total_eggs: form.total_eggs ? Number(form.total_eggs) : null,
      incubation_duration: form.incubation_duration
        ? Number(form.incubation_duration)
        : null,

      setter_temp: form.setter_temp ? Number(form.setter_temp) : null,
      egg_shell_temp: form.egg_shell_temp ? Number(form.egg_shell_temp) : null,

      setter_humidity: form.setter_humidity
        ? Number(form.setter_humidity)
        : null,
      egg_shell_temp_dt: form.egg_shell_temp_dt
        ? new Date(form.egg_shell_temp_dt).toISOString()
        : null,

      turning_interval: form.turning_interval
        ? Number(form.turning_interval)
        : null,
      egg_shell_orientation: form.egg_shell_orientation || null,

      turning_angle: form.turning_angle ? Number(form.turning_angle) : null,
    };

    setSaving(true);
    try {
      if (isEdit) {
        const id = Number(idParam);
        if (!Number.isFinite(id)) throw new Error("Invalid id.");
        await updateSetterIncubation(id, payload);
      } else {
        await createSetterIncubation(payload);
      }

      router.push("/a_baja/eggsetter");
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const disabledAll = saving || loadingRecord;

  return (
    <div className="w-full  px-6 py-6  mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Egg Setter List"
        CurrentPageName={isEdit ? "Edit Entry" : "New Egg Setter"}
      />

      <Card className="w-full  min-h-[calc(90vh-120px)] p-6 space-y-4 mt-2">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CardContent className="max-w-2xl p-4 space-y-4">
              {/* SECTION 1 */}
              <div className="rounded-md border p-4 space-y-4">
                <div className="space-y-2">
                  <RequiredLabel>Egg Reference No.</RequiredLabel>
                  <SearchableDropdown
                    list={refOptions}
                    codeLabel="classi_ref_no"
                    nameLabel="classi_ref_no"
                    showNameOnly
                    value={form.ref_no}
                    onChange={(val) => handleSelectRef(val)}
                    disabled={saving || loadingRefs}
                  />
                  {/* <Select
                value={form.ref_no}
                onValueChange={handleSelectRef}
                disabled={loadingRefs || disabledAll}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingRefs ? "Loading..." : "Select EggReference Number"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {refOptions.map((r) => (
                    <SelectItem key={r.classi_ref_no} value={r.classi_ref_no}>
                      {r.classi_ref_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select> */}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Farm Source</Label>
                    <Input
                      // value={form.farm_source}
                      value={
                        isEdit ? form.farm_source : (defaultFarm?.name ?? "")
                      }
                      // value={defaultFarm?.name || ""}
                      readOnly
                      placeholder=""
                      disabled
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Total Number of Egg Set</Label>
                    <Input
                      value={form.total_eggs}
                      readOnly
                      placeholder=""
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2 */}
              <div className="rounded-md border p-4 space-y-3">
                {loadingRecord ? (
                  <div className="text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : null}

                <div className="space-y-2">
                  <RequiredLabel>Setting Date</RequiredLabel>
                  <Input
                    type="datetime-local"
                    value={form.setting_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, setting_date: e.target.value }))
                    }
                    disabled={disabledAll}
                  />
                </div>

                <div className="space-y-2">
                  <RequiredLabel>Setter Machine ID</RequiredLabel>
                  <Input
                    value={form.machine_id}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, machine_id: e.target.value }))
                    }
                    placeholder=""
                    disabled={disabledAll}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Incubation Duration (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.incubation_duration}
                    onKeyDown={blockNegativeKeys}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        incubation_duration: clampNonNegative(e.target.value),
                      }))
                    }
                    disabled={disabledAll}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Setter Temperature (°F)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.setter_temp}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        setter_temp: clampNonNegative(e.target.value, {
                          allowDecimal: true,
                        }),
                      }))
                    }
                    placeholder=""
                    disabled={disabledAll}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Egg Shell Temperature (°F)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.egg_shell_temp}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        egg_shell_temp: clampNonNegative(e.target.value, {
                          allowDecimal: true,
                        }),
                      }))
                    }
                    disabled={disabledAll}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Setter Humidity (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.setter_humidity}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        setter_humidity: clampNonNegative(e.target.value, {
                          allowDecimal: true,
                        }),
                      }))
                    }
                    disabled={disabledAll}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Egg Shell Temp Date &amp; Time</Label>
                  <Input
                    type="datetime-local"
                    value={form.egg_shell_temp_dt}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        egg_shell_temp_dt: e.target.value,
                      }))
                    }
                    disabled={disabledAll}
                  />
                  {!isValidDates ? (
                    <p className="text-xs text-destructive">
                      Egg Shell Temp Date &amp; Time must be after Setting Date.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Turning Interval (mins)</Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.turning_interval}
                    onKeyDown={blockNegativeKeys}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        turning_interval: clampNonNegative(e.target.value),
                      }))
                    }
                    placeholder=""
                    disabled={disabledAll}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Egg Shell Orientation</Label>
                  <Select
                    value={form.egg_shell_orientation}
                    onValueChange={(v: any) =>
                      setForm((p) => ({ ...p, egg_shell_orientation: v }))
                    }
                    disabled={disabledAll}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select orientation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pointed Down">Pointed Down</SelectItem>
                      <SelectItem value="Pointed Up">Pointed Up</SelectItem>
                      <SelectItem value="Pointed Middle">
                        Pointed Middle
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Turning Angle (°)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.turning_angle}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        turning_angle: clampNonNegative(e.target.value, {
                          allowDecimal: true,
                        }),
                      }))
                    }
                  />
                </div>

                {/* Actions */}
                <FormActionButtons
                  saving={saving}
                  isEdit={isEdit}
                  disabled={disabledAll}
                  cancelPath="/jmb/eggsetter"
                  onSave={onSave}
                />
              </div>
            </CardContent>
          </div>
          <div className="lg:col-span-1">
            <TemperatureConverter
              title="Temperature"
              defaultFromUnit="C"
              defaultValue={0}
              showApplyButton
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
