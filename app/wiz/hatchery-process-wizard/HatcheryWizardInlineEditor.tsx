"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  HatcheryWizardClassification,
  HatcheryWizardStage,
  HatcheryWizardStageRecord,
} from "@/lib/data/repositories/hatcheryProcessWizard";
import {
  createEggStorage,
  updateEggStorage,
  type EggStorageInsert,
} from "@/app/jmb/eggstorage/new/api";
import {
  createEggPreWarming,
  updateEggPreWarming,
  type EggPreWarmingInsert,
} from "@/app/jmb/prewarmingv2/new2/api";
import {
  createSetterIncubationBatch,
  updateSetterIncubation,
  type SetterIncubationInsert,
} from "@/app/jmb/eggsetter/new/api";
import {
  createEggTransferBatch,
  updateEggTransfer,
  type EggTransferInsert,
} from "@/app/jmb/eggtransferv2/newv2/api";
import {
  createEggHatcheryProcess,
  updateEggHatcheryProcess,
  type EggHatcheryProcessCreate,
} from "@/app/jmb/egghatcherv2/newv2/api";
import {
  createChickPulloutProcess,
  updateChickPulloutProcess,
  type ChickPulloutProcessCreate,
} from "@/app/jmb/chickpulloutv2/newv2/api";

type DraftRow = Record<string, string> & { clientKey: string };

type FieldConfig = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local";
  required?: boolean;
  readOnly?: boolean;
  options?: string[];
  minWidth?: string;
};

const FIELDS: Record<HatcheryWizardStage, FieldConfig[]> = {
  storage: [
    { key: "stor_temp", label: "Storage Temp", type: "number" },
    { key: "room_temp", label: "Room Temp", type: "number" },
    { key: "stor_humi", label: "Storage Humidity %", type: "number" },
    { key: "shell_start", label: "Shell Temp Start", type: "datetime-local", minWidth: "min-w-48" },
    { key: "shell_end", label: "Shell Temp End", type: "datetime-local", minWidth: "min-w-48" },
    { key: "remarks", label: "Remarks", minWidth: "min-w-56" },
  ],
  pre_warming: [
    { key: "pre_temp", label: "Pre-Warming Temp", type: "number" },
    { key: "egg_temp", label: "Egg Shell Temp", type: "number" },
    { key: "egg_temp_time_start", label: "Start Time", type: "datetime-local", minWidth: "min-w-48" },
    { key: "egg_temp_time_end", label: "End Time", type: "datetime-local", minWidth: "min-w-48" },
    { key: "remarks", label: "Remarks", minWidth: "min-w-56" },
  ],
  setter: [
    { key: "setting_date", label: "Setting Date", type: "datetime-local", required: true, minWidth: "min-w-48" },
    { key: "machine_id", label: "Setter Machine ID", required: true },
    { key: "total_eggs", label: "Total Hatching Egg", type: "number", readOnly: true },
    { key: "qty_set_egg", label: "Qty Set", type: "number", required: true },
    { key: "setter_temp", label: "Setter Temp", type: "number" },
    { key: "setter_humidity", label: "Setter Humidity", type: "number" },
    { key: "incubation_duration", label: "Incubation Duration", type: "number" },
    { key: "turning_interval", label: "Turning Interval", type: "number" },
    { key: "turning_angle", label: "Turning Angle", type: "number" },
    { key: "egg_shell_temp", label: "Egg Shell Temp", type: "number" },
    { key: "egg_shell_temp_dt", label: "Shell Temp Date", type: "datetime-local", minWidth: "min-w-48" },
    {
      key: "egg_shell_orientation",
      label: "Shell Orientation",
      options: ["Pointed Up", "Pointed Down", "Pointed Middle"],
      minWidth: "min-w-44",
    },
  ],
  transfer: [
    { key: "trans_date_start", label: "Transfer Start", type: "datetime-local", required: true, minWidth: "min-w-48" },
    { key: "trans_date_end", label: "Transfer End", type: "datetime-local", minWidth: "min-w-48" },
    { key: "num_bangers", label: "No. of Bangers", type: "number" },
    { key: "total_egg_transfer", label: "Total Egg Transfer", type: "number" },
  ],
  hatcher: [
    { key: "daterec", label: "Date Received", type: "date" },
    { key: "machine_no", label: "Machine No." },
    { key: "hatch_temp", label: "Hatch Temp", type: "number" },
    { key: "hatch_humidity", label: "Hatch Humidity", type: "number" },
    { key: "hatch_time_start", label: "Hatch Start", type: "datetime-local", required: true, minWidth: "min-w-48" },
    { key: "hatch_time_end", label: "Hatch End", type: "datetime-local", required: true, minWidth: "min-w-48" },
    { key: "hatch_window", label: "Hatch Window", type: "number" },
    { key: "total_egg", label: "Total Egg Loaded", type: "number" },
  ],
  pullout: [
    { key: "machine_no", label: "Machine No.", readOnly: true },
    { key: "hatch_date", label: "Date Hatch", type: "date" },
    { key: "chicks_hatched", label: "Chicks Hatched", type: "number" },
    { key: "dead_in_shell", label: "Dead-In-Shell", type: "number" },
    { key: "hatch_window", label: "Hatch Window", type: "number", readOnly: true },
  ],
};

function rowKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nullable(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function numeric(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegative(value: string) {
  return Math.max(0, numeric(value) ?? 0);
}

function isoValue(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function localInputValue(value: unknown, type: FieldConfig["type"]) {
  const text = String(value ?? "").trim();
  if (!text || (type !== "date" && type !== "datetime-local")) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  const pad = (part: number) => String(part).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return type === "date" ? day : `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function durationBetween(start: string, end: string, unit: "seconds" | "minutes") {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Math.floor((endMs - startMs) / (unit === "seconds" ? 1000 : 60000));
}

function makeDraft(
  stage: HatcheryWizardStage,
  classification: HatcheryWizardClassification,
  recordsByStage: Record<HatcheryWizardStage, HatcheryWizardStageRecord[]>,
  source?: HatcheryWizardStageRecord,
) {
  const row: DraftRow = { clientKey: rowKey() };
  for (const field of FIELDS[stage]) {
    row[field.key] = source
      ? localInputValue(source.raw[field.key], field.type)
      : field.options?.[0] ?? "";
  }

  if (source) return row;

  const active = (key: HatcheryWizardStage) =>
    recordsByStage[key].filter((record) => !record.isVoided);
  const farmSource = classification.farmName || classification.farmCode;
  const latestHatcher = active("hatcher").at(-1);

  if (stage === "setter") {
    row.total_eggs = String(classification.totalHatchingEggs || 0);
    row.egg_shell_orientation = "Pointed Down";
  }
  if (stage === "pullout") {
    row.machine_no = String(latestHatcher?.raw.machine_no ?? "");
    row.hatch_window = String(latestHatcher?.raw.hatch_window ?? "");
  }
  row.farm_source = farmSource;
  return row;
}

function validateRows(stage: HatcheryWizardStage, rows: DraftRow[]) {
  for (const [index, row] of rows.entries()) {
    for (const field of FIELDS[stage]) {
      if (field.required && !row[field.key]?.trim()) {
        throw new Error(`${field.label} is required on row ${index + 1}.`);
      }
      if (field.type === "number" && numeric(row[field.key] ?? "") !== null && Number(row[field.key]) < 0) {
        throw new Error(`${field.label} cannot be negative on row ${index + 1}.`);
      }
    }
  }
}

export default function HatcheryWizardInlineEditor({
  stage,
  classification,
  recordsByStage,
  editRecord,
  onCancel,
  onSaved,
}: {
  stage: HatcheryWizardStage;
  classification: HatcheryWizardClassification;
  recordsByStage: Record<HatcheryWizardStage, HatcheryWizardStageRecord[]>;
  editRecord?: HatcheryWizardStageRecord | null;
  onCancel: () => void;
  onSaved: (continueToNext: boolean) => Promise<void>;
}) {
  const [rows, setRows] = useState<DraftRow[]>(() => [
    makeDraft(stage, classification, recordsByStage, editRecord ?? undefined),
  ]);
  const [saving, setSaving] = useState(false);
  const fields = FIELDS[stage];
  const isEdit = Boolean(editRecord);

  const activeQuantity = useMemo(() => {
    const sum = (key: HatcheryWizardStage, field: string) =>
      recordsByStage[key]
        .filter(
          (record) =>
            !record.isVoided &&
            (!editRecord || key !== stage || record.id !== editRecord.id),
        )
        .reduce((total, record) => total + Number(record.raw[field] ?? 0), 0);
    if (stage === "setter") return classification.totalHatchingEggs - sum("setter", "qty_set_egg");
    if (stage === "transfer") return sum("setter", "qty_set_egg") - sum("transfer", "total_egg_transfer");
    if (stage === "hatcher") return sum("transfer", "total_egg_transfer") - sum("hatcher", "total_egg");
    return null;
  }, [classification.totalHatchingEggs, editRecord, recordsByStage, stage]);

  function updateRow(clientKey: string, key: string, value: string) {
    setRows((current) =>
      current.map((row) => (row.clientKey === clientKey ? { ...row, [key]: value } : row)),
    );
  }

  function addRow() {
    setRows((current) => [...current, makeDraft(stage, classification, recordsByStage)]);
  }

  function removeRow(clientKey: string) {
    setRows((current) => current.filter((row) => row.clientKey !== clientKey));
  }

  async function save(continueToNext = false) {
    try {
      validateRows(stage, rows);
      if (!rows.length) throw new Error("Add at least one row.");

      if (stage === "setter") {
        const requested = rows.reduce((sum, row) => sum + nonNegative(row.qty_set_egg), 0);
        if (activeQuantity !== null && requested > Math.max(activeQuantity, 0)) {
          throw new Error("Total Qty Set exceeds the available hatching eggs.");
        }
      }
      if (stage === "transfer") {
        const requested = rows.reduce(
          (sum, row) => sum + nonNegative(row.num_bangers) + nonNegative(row.total_egg_transfer),
          0,
        );
        if (activeQuantity !== null && requested > Math.max(activeQuantity, 0)) {
          throw new Error("Bangers plus Total Egg Transfer exceeds the available quantity.");
        }
      }

      setSaving(true);
      const ref = classification.classificationRefNo;
      const farmSource = classification.farmName || classification.farmCode || null;

      if (stage === "storage") {
        const payloads: EggStorageInsert[] = rows.map((row) => ({
          classi_ref_no: ref,
          stor_temp: nullable(row.stor_temp),
          room_temp: nullable(row.room_temp),
          stor_humi: nullable(row.stor_humi),
          shell_start: isoValue(row.shell_start),
          shell_end: isoValue(row.shell_end),
          duration: durationBetween(row.shell_start, row.shell_end, "seconds"),
          remarks: nullable(row.remarks),
        }));
        if (editRecord) await updateEggStorage(editRecord.id, payloads[0]);
        else await createEggStorage(payloads);
      }

      if (stage === "pre_warming") {
        const payloads: EggPreWarmingInsert[] = rows.map((row) => {
          const duration = durationBetween(row.egg_temp_time_start, row.egg_temp_time_end, "minutes");
          if (row.egg_temp_time_start && row.egg_temp_time_end && duration === null) {
            throw new Error("Pre-Warming End Time must be after Start Time.");
          }
          return {
            egg_ref_no: ref,
            pre_temp: nullable(row.pre_temp),
            egg_temp: nullable(row.egg_temp),
            egg_temp_time_start: isoValue(row.egg_temp_time_start),
            egg_temp_time_end: isoValue(row.egg_temp_time_end),
            duration,
            remarks: nullable(row.remarks),
            is_active: true,
          };
        });
        if (editRecord) await updateEggPreWarming(editRecord.id, payloads[0]);
        else await createEggPreWarming(payloads);
      }

      if (stage === "setter") {
        const payloads: SetterIncubationInsert[] = rows.map((row) => {
          if (row.egg_shell_temp_dt && new Date(row.egg_shell_temp_dt) < new Date(row.setting_date)) {
            throw new Error("Egg Shell Temp Date must be after Setting Date.");
          }
          return {
            ref_no: ref,
            setting_date: isoValue(row.setting_date),
            farm_source: farmSource,
            machine_id: nullable(row.machine_id),
            total_eggs: numeric(row.total_eggs),
            setter_temp: numeric(row.setter_temp),
            setter_humidity: numeric(row.setter_humidity),
            incubation_duration: numeric(row.incubation_duration),
            turning_interval: numeric(row.turning_interval),
            turning_angle: numeric(row.turning_angle),
            egg_shell_temp: numeric(row.egg_shell_temp),
            egg_shell_temp_dt: isoValue(row.egg_shell_temp_dt),
            egg_shell_orientation: (row.egg_shell_orientation || "Pointed Down") as SetterIncubationInsert["egg_shell_orientation"],
            qty_set_egg: numeric(row.qty_set_egg),
          };
        });
        if (editRecord) await updateSetterIncubation(editRecord.id, payloads[0]);
        else await createSetterIncubationBatch(payloads);
      }

      if (stage === "transfer") {
        const payloads: EggTransferInsert[] = rows.map((row) => {
          const duration = durationBetween(row.trans_date_start, row.trans_date_end, "minutes");
          if (row.trans_date_end && duration === null) {
            throw new Error("Transfer End must be after Transfer Start.");
          }
          return {
            ref_no: ref,
            farm_source: farmSource,
            trans_date_start: isoValue(row.trans_date_start),
            trans_date_end: isoValue(row.trans_date_end),
            duration,
            num_bangers: nonNegative(row.num_bangers),
            total_egg_transfer: nonNegative(row.total_egg_transfer),
          };
        });
        if (editRecord) await updateEggTransfer(editRecord.id, payloads[0]);
        else await createEggTransferBatch(payloads);
      }

      if (stage === "hatcher") {
        const payloads: EggHatcheryProcessCreate[] = rows.map((row) => {
          const duration = durationBetween(row.hatch_time_start, row.hatch_time_end, "minutes");
          if (duration === null) throw new Error("Hatch End must be after Hatch Start.");
          return {
            egg_ref: ref,
            farm_source: farmSource,
            daterec: nullable(row.daterec),
            machine_no: nullable(row.machine_no),
            hatch_temp: nullable(row.hatch_temp),
            hatch_humidity: nullable(row.hatch_humidity),
            hatch_time_start: isoValue(row.hatch_time_start),
            hatch_time_end: isoValue(row.hatch_time_end),
            duration,
            hatch_window: numeric(row.hatch_window),
            total_egg: numeric(row.total_egg),
          };
        });
        if (editRecord) await updateEggHatcheryProcess(editRecord.id, payloads[0]);
        else await Promise.all(payloads.map((payload) => createEggHatcheryProcess(payload)));
      }

      if (stage === "pullout") {
        const payloads: ChickPulloutProcessCreate[] = rows.map((row) => {
          const chicks = nonNegative(row.chicks_hatched);
          const dead = nonNegative(row.dead_in_shell);
          const fertile = chicks + dead;
          return {
            egg_ref_no: ref,
            chick_hatch_ref_no: ref,
            farm_source: farmSource,
            machine_no: nullable(row.machine_no),
            hatch_date: nullable(row.hatch_date),
            chicks_hatched: chicks,
            dead_in_shell: dead,
            hatch_fertile: fertile ? Math.round((chicks / fertile) * 10000) / 100 : 0,
            mortality_rate: fertile ? Math.round((dead / fertile) * 10000) / 100 : 0,
            hatch_window: nonNegative(row.hatch_window),
          };
        });
        if (editRecord) await updateChickPulloutProcess(editRecord.id, payloads[0]);
        else await Promise.all(payloads.map((payload) => createChickPulloutProcess(payload)));
      }

      toast.success(isEdit ? "Record updated." : `${rows.length} record${rows.length === 1 ? "" : "s"} saved.`);
      await onSaved(continueToNext);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to save records.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border bg-card p-3">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold">{isEdit ? `Edit Record ${editRecord?.id}` : "Add Records"}</h3>
          <p className="text-xs text-muted-foreground">
            {isEdit ? "Update this record inside the wizard." : "Add one or more rows, then save them together."}
          </p>
        </div>
        {!isEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={saving}>
            <Plus className="size-3.5" />
            Add Row
          </Button>
        ) : null}
      </div>

      {activeQuantity !== null ? (
        <div className="text-xs text-muted-foreground">
          Available quantity: <span className="font-semibold tabular-nums text-foreground">{Math.max(activeQuantity, 0).toLocaleString("en-PH")}</span>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              {fields.map((field) => (
                <TableHead key={field.key} className={field.minWidth ?? "min-w-36"}>
                  {field.label}{field.required ? " *" : ""}
                </TableHead>
              ))}
              {!isEdit ? <TableHead className="w-16" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.clientKey}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                {fields.map((field) => (
                  <TableCell key={field.key} className="p-1.5 align-top">
                    {field.options ? (
                      <select
                        value={row[field.key] ?? ""}
                        onChange={(event) => updateRow(row.clientKey, field.key, event.target.value)}
                        disabled={saving || field.readOnly}
                        className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                      >
                        {field.options.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    ) : (
                      <Input
                        type={field.type ?? "text"}
                        value={row[field.key] ?? ""}
                        onChange={(event) => updateRow(row.clientKey, field.key, event.target.value)}
                        required={field.required}
                        readOnly={field.readOnly}
                        min={field.type === "number" ? 0 : undefined}
                        step={field.type === "number" ? "any" : undefined}
                        disabled={saving}
                        className="h-8 px-2 text-xs"
                      />
                    )}
                  </TableCell>
                ))}
                {!isEdit ? (
                  <TableCell className="p-1.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => removeRow(row.clientKey)}
                      disabled={saving || rows.length === 1}
                      aria-label={`Remove row ${index + 1}`}
                    >
                      <Trash2 className="size-4 text-red-600" />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap justify-end gap-1.5">
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          <X className="size-3.5" />
          Cancel
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void save(false)} disabled={saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {saving ? "Saving..." : isEdit ? "Update" : "Save Records"}
        </Button>
        <Button type="button" size="sm" onClick={() => void save(true)} disabled={saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {saving ? "Saving..." : isEdit ? "Update & Continue" : "Save & Continue"}
        </Button>
      </div>
    </div>
  );
}
