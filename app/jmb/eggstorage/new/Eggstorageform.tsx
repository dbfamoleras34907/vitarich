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
import { db } from "@/lib/Supabase/supabaseClient";
import {
  createEggStorage,
  getEggStorageById,
  updateEggStorage,
  type EggStorageInsert,
} from "./api";
import FormActionButtons from "@/components/FormActionButtons";
import RequiredLabel from "@/components/RequiredLabel";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import TemperatureConverter from "@/components/TemperatureConverter";
import SearchableDropdown1 from "@/lib/SearchableDropdown1";

type HatchClassiRefOption = {
  classi_ref_no: string;
  date_classify: string | null;
};

type TemperatureFieldKey = "stor_temp" | "room_temp";

function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return d.toISOString();
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
    <div className="grid grid-cols-1 gap-2">
      <RequiredLabel>{label}</RequiredLabel>
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

export default function Eggstorageform() {
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id");
  const editId = idParam ? Number(idParam) : null;
  const isEdit = Number.isFinite(editId) && (editId as number) > 0;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [classiRefNos, setClassiRefNos] = useState<string[]>([]);
  const [classiRefs, setClassiRefs] = useState<HatchClassiRefOption[]>([]);
  const [classiRefLoading, setClassiRefLoading] = useState(false);

  const [stor_temp, setStorTemp] = useState("");
  const [room_temp, setRoomTemp] = useState("");
  const [stor_humi, setStorHumi] = useState("");
  const [shellStartLocal, setShellStartLocal] = useState("");
  const [shellEndLocal, setShellEndLocal] = useState("");
  const [remarks, setRemarks] = useState("");
  const [converterField, setConverterField] =
    useState<TemperatureFieldKey | null>(null);

  useEffect(() => {
    const loadClassiRefs = async () => {
      try {
        setClassiRefLoading(true);
        const { data, error } = await db
          .from("view_eggclassi_for_eggstorage")
          .select("classi_ref_no,date_classify")
          .order("date_classify", { ascending: false })
          .order("classi_ref_no", { ascending: false });

        if (error) throw error;
        setClassiRefs((data ?? []) as HatchClassiRefOption[]);
      } catch (error) {
        console.error(error);
        setClassiRefs([]);
      } finally {
        setClassiRefLoading(false);
      }
    };

    loadClassiRefs();
  }, []);

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    if (!isEdit) return;

    const loadRecord = async () => {
      try {
        setLoading(true);
        const data = await getEggStorageById(editId as number);

        setClassiRefNos(data.classi_ref_no ? [data.classi_ref_no] : []);
        setStorTemp(data.stor_temp ?? "");
        setRoomTemp(data.room_temp ?? "");
        setStorHumi(data.stor_humi ?? "");
        setShellStartLocal(toDatetimeLocalValue(data.shell_start));
        setShellEndLocal(toDatetimeLocalValue(data.shell_end));
        setRemarks(data.remarks ?? "");
      } catch (error) {
        console.error(error);
        alert("Failed to load record.");
        router.push("/jmb/eggstorage");
      } finally {
        setLoading(false);
      }
    };

    loadRecord();
  }, [isEdit, editId, router]);

  const durationSeconds = useMemo(() => {
    if (!shellStartLocal || !shellEndLocal) return null;
    const s = new Date(shellStartLocal).getTime();
    const e = new Date(shellEndLocal).getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
    return Math.floor((e - s) / 1000);
  }, [shellStartLocal, shellEndLocal]);

  const durationDisplay = useMemo(() => {
    if (durationSeconds == null) return "";
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    if (hours <= 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  }, [durationSeconds]);

  const converterLabel =
    converterField === "stor_temp"
      ? "Storage Temperature"
      : converterField === "room_temp"
        ? "Room Temperature"
        : "Temperature";
  const converterInputValue =
    converterField === "stor_temp"
      ? Number(stor_temp)
      : converterField === "room_temp"
        ? Number(room_temp)
        : 0;

  async function onSave() {
    try {
      setSaving(true);

      if (classiRefNos.length === 0) {
        alert("Please select at least one Egg Reference No.");
        return;
      }

      const basePayload = {
        stor_temp: stor_temp || null,
        room_temp: room_temp || null,
        stor_humi: stor_humi || null,
        shell_start: fromDatetimeLocalValue(shellStartLocal),
        shell_end: fromDatetimeLocalValue(shellEndLocal),
        duration: durationSeconds,
        remarks: remarks || null,
      };

      if (isEdit) {
        await updateEggStorage(editId as number, {
          ...basePayload,
          classi_ref_no: classiRefNos[0] ?? null,
        });
      } else {
        const payloads: EggStorageInsert[] = classiRefNos.map((ref) => ({
          ...basePayload,
          classi_ref_no: ref,
        }));

        await createEggStorage(payloads);
      }

      router.push("/jmb/eggstorage");
      router.refresh();
    } catch (err: any) {
      alert(err?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full px-6 py-6 mt-4">
      <Breadcrumb
        FirstPreviewsPageName="Egg Storage Management"
        SecondPreviewPageName="Hatchery "
        CurrentPageName={isEdit ? "Edit Record" : "New Record"}
      />
      <Card className="w-full min-h-[calc(90vh-120px)] p-6 space-y-4 mt-2">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CardContent className="max-w-2xl p-4 space-y-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2">
                    <RequiredLabel>Egg Reference No.</RequiredLabel>
                    <SearchableDropdown1
                      list={classiRefs}
                      codeLabel="classi_ref_no"
                      nameLabel="classi_ref_no"
                      showNameOnly
                      value={classiRefNos}
                      onChange={(val) => setClassiRefNos(val)}
                      multiple
                      disabled={saving || classiRefLoading}
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 gap-2">
                    <TemperatureInput
                      label="Storage Temperature (°C)"
                      value={stor_temp}
                      onChange={setStorTemp}
                      onOpenConverter={() => setConverterField("stor_temp")}
                      disabled={saving}
                    />

                    <TemperatureInput
                      label="Room Temperature (°C)"
                      value={room_temp}
                      onChange={setRoomTemp}
                      onOpenConverter={() => setConverterField("room_temp")}
                      disabled={saving}
                    />

                    <div className="grid grid-cols-1 gap-2">
                      <RequiredLabel>Storage Humidity %</RequiredLabel>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={stor_humi}
                        onChange={(e) =>
                          setStorHumi(
                            clampNonNegative(e.target.value, {
                              allowDecimal: true,
                            }),
                          )
                        }
                        disabled={saving}
                      />
                    </div>
                  </div>

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
                      {shellStartLocal &&
                        shellEndLocal &&
                        durationSeconds == null && (
                          <p className="text-sm text-destructive mt-1">
                            End must be greater than Start.
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <Label>Remarks</Label>
                    <Textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="min-h-30"
                      disabled={saving}
                    />
                  </div>

                  <FormActionButtons
                    saving={saving}
                    isEdit={isEdit}
                    cancelPath="/jmb/eggstorage"
                    onSave={onSave}
                  />
                </>
              )}
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
            key={`${converterField ?? "temperature"}-${converterInputValue}`}
            title={converterLabel}
            defaultFromUnit="C"
            defaultValue={
              Number.isFinite(converterInputValue) ? converterInputValue : 0
            }
            showApplyButton
            onApply={(value) => {
              const nextValue = String(Number(value.toFixed(2)));

              if (converterField === "stor_temp") {
                setStorTemp(nextValue);
              } else if (converterField === "room_temp") {
                setRoomTemp(nextValue);
              }

              setConverterField(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
