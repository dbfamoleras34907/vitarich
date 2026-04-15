/**
 * Egg Setter Incubation Form Component
 *
 * A comprehensive form for creating and editing egg setter incubation records.
 * This component manages the entry of incubation parameters including temperature,
 * humidity, egg orientation, and turning intervals for poultry hatchery operations.
 *
 * @component
 *
 * @example
 * ```tsx
 * import Eggsetterform from '@/app/jmb/eggsetter/new/Eggsetterform';
 *
 * export default function Page() {
 *   return <Eggsetterform />;
 * }
 * ```
 *
 * @returns {JSX.Element} The rendered egg setter form with two-column layout
 *
 * @remarks
 * - Requires client-side rendering (`"use client"`)
 * - Supports both create and edit modes via URL `id` parameter
 * - Displays a temperature converter widget in the sidebar
 * - Validates date relationships: Egg Shell Temp Date must be after Setting Date
 * - Auto-populates farm source and total eggs from reference selection
 * - Session refresh is automatically triggered on component mount
 * - All numeric inputs are validated to prevent negative values
 *
 * @internal
 * Query Parameter:
 * - `id` (optional): Record ID for edit mode. If provided, loads existing record data.
 *
 * State Management:
 * - `form`: Primary form state containing all incubation parameters
 * - `refOptions`: Available egg reference numbers from API
 * - `defaultFarm`: User's default farm information
 * - Loading and saving states for async operations
 *
 * API Integration:
 * - Fetches reference numbers and user farm information on mount
 * - Creates new or updates existing incubation records via API
 * - Automatically refreshes session on component initialization
 *
 * Validation:
 * - Required fields: Reference Number, Setting Date, Setter Machine ID
 * - Date validation: Egg Shell Temp Date must be >= Setting Date
 * - Numeric validation: Non-negative values with optional decimal precision
 * - Temperature inputs support decimal values (°F)
 * - Humidity and angle inputs support decimal percentages
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Thermometer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  createSetterIncubationBatch,
  getSetterIncubationById,
  updateSetterIncubation,
  listHatchClassiRefs,
  listSetterReferenceHistory,
  type HatchClassiRefOption,
  type SetterRefHistory,
  getUserInfo,
} from "./api";
import FormActionButtons from "@/components/FormActionButtons";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import RequiredLabel from "@/components/RequiredLabel";
import { DefaultFarm } from "@/lib/types";
import TemperatureConverter from "@/components/TemperatureConverter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SearchableDropdown1 from "@/lib/SearchableDropdown1";
import { Separator } from "@/components/ui/separator";
type FormState = {
  ref_no: string[];
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
  qty_set_egg: number;
  sum_set_egg?: number;
};

type TemperatureFieldKey = "setter_temp" | "egg_shell_temp";
type EggShellOrientation = FormState["egg_shell_orientation"];
type EggReferenceRow = {
  ref_no: string;
  total_eggs: number;
  previous_egg_set: number;
  qty_set_egg: number;
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

function buildRefSelectionMeta(
  refs: string[],
  refOptions: HatchClassiRefOption[],
  fallbackFarm = "",
) {
  const picked = refOptions.filter((x) => refs.includes(x.classi_ref_no));
  const totalEggs = picked.reduce(
    (sum, item) => sum + Number(item.good_egg ?? 0),
    0,
  );
  const farms = Array.from(
    new Set(
      refs
        .map((ref) => extractFarmOnly(ref))
        .map((farm) => farm.trim())
        .filter(Boolean),
    ),
  );

  return {
    farm_source: farms.length ? farms.join(", ") : fallbackFarm,
    total_eggs: refs.length ? String(totalEggs) : "",
  };
}

function parseRefNumbers(value: string | null | undefined) {
  return String(value ?? "")
    .split(",")
    .map((ref) => ref.trim())
    .filter(Boolean);
}

function buildPreviousEggSetMap(history: SetterRefHistory[]) {
  return history.reduce<Record<string, number>>((acc, row) => {
    const qty = Number(row.qty_set_egg ?? 0);
    if (!Number.isFinite(qty)) return acc;

    for (const ref of parseRefNumbers(row.ref_no)) {
      acc[ref] = (acc[ref] ?? 0) + qty;
    }

    return acc;
  }, {});
}

function buildReferenceRows(
  refs: string[],
  refOptions: HatchClassiRefOption[],
  previousEggSetMap: Record<string, number>,
  existingRows: EggReferenceRow[] = [],
) {
  return refs.map((ref) => {
    const option = refOptions.find((item) => item.classi_ref_no === ref);
    const existingRow = existingRows.find((item) => item.ref_no === ref);
    const totalEggs = Number(option?.good_egg ?? 0);

    return {
      ref_no: ref,
      total_eggs: Number.isFinite(totalEggs) ? totalEggs : 0,
      previous_egg_set: previousEggSetMap[ref] ?? 0,
      qty_set_egg: existingRow?.qty_set_egg ?? 0,
    };
  });
}

function getRemainingHatchingEgg(row: EggReferenceRow) {
  return Math.max(0, row.total_eggs - row.previous_egg_set);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isEggShellOrientation(value: unknown): value is EggShellOrientation {
  return (
    value === "Pointed Up" ||
    value === "Pointed Down" ||
    value === "Pointed Middle"
  );
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
          <span className="text-xs font-medium">°F</span>
        </Button>
      </div>
    </div>
  );
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
  const [setterHistory, setSetterHistory] = useState<SetterRefHistory[]>([]);
  const [defaultFarm, setdefaultFarm] = useState<DefaultFarm>();
  const [converterField, setConverterField] =
    useState<TemperatureFieldKey | null>(null);
  const [referenceRows, setReferenceRows] = useState<EggReferenceRow[]>([]);
  const [form, setForm] = useState<FormState>({
    ref_no: [],
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
    qty_set_egg: 0,
  });
  // const getDefaultFarm = async () => {
  //   const data = await getUserInfo();
  //   setdefaultFarm(data[0]);
  //   // setHeader(h => h ? { ...h, delivered_to: data[0].code } : h)
  // };

  const getDefaultFarm = async () => {
    const data = await getUserInfo();
    const farm = data?.[0];

    setdefaultFarm(farm);
    setForm((p) => ({
      ...p,
      farm_source: p.farm_source || farm?.name || "",
    }));
  };
  useEffect(() => {
    getDefaultFarm();
  }, []);
  useEffect(() => {
    refreshSessionx(router);
  }, [router]);
  // Load Reference No. options
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingRefs(true);
      try {
        const [rows, history] = await Promise.all([
          listHatchClassiRefs(),
          listSetterReferenceHistory(),
        ]);
        if (!mounted) return;
        setRefOptions(rows);
        setSetterHistory(history);
      } catch (error: unknown) {
        alert(getErrorMessage(error, "Failed to load Reference Numbers."));
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
      router.push("/jmb/eggsetter");
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
          router.push("/jmb/eggsetter");
          return;
        }

        setForm((p) => ({
          ...p,
          ref_no: parseRefNumbers(row.ref_no),
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
          egg_shell_orientation: isEggShellOrientation(
            row.egg_shell_orientation,
          )
            ? row.egg_shell_orientation
            : "Pointed Down",

          turning_angle:
            row.turning_angle != null ? String(row.turning_angle) : "",
          qty_set_egg:
            row.qty_set_egg != null && Number.isFinite(Number(row.qty_set_egg))
              ? Number(row.qty_set_egg)
              : 0,
        }));

        setReferenceRows([
          {
            ref_no: String(row.ref_no ?? "").trim(),
            total_eggs:
              row.total_eggs != null && Number.isFinite(Number(row.total_eggs))
                ? Number(row.total_eggs)
                : 0,
            previous_egg_set: 0,
            qty_set_egg:
              row.qty_set_egg != null &&
              Number.isFinite(Number(row.qty_set_egg))
                ? Number(row.qty_set_egg)
                : 0,
          },
        ]);
      } catch (error: unknown) {
        alert(getErrorMessage(error, "Failed to load record."));
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
  const previousEggSetMap = useMemo(
    () => buildPreviousEggSetMap(setterHistory),
    [setterHistory],
  );
  const totalSelectedEggs = useMemo(
    () => referenceRows.reduce((sum, row) => sum + row.total_eggs, 0),
    [referenceRows],
  );
  const totalPreviousEggSet = useMemo(
    () => referenceRows.reduce((sum, row) => sum + row.previous_egg_set, 0),
    [referenceRows],
  );
  const totalQtySetEgg = useMemo(
    () => referenceRows.reduce((sum, row) => sum + row.qty_set_egg, 0),
    [referenceRows],
  );

  function handleSelectRef(refs: string[]) {
    const meta = buildRefSelectionMeta(
      refs,
      refOptions,
      defaultFarm?.name || "",
    );

    setForm((p) => ({
      ...p,
      ref_no: refs,
      farm_source: meta.farm_source,
      total_eggs: meta.total_eggs,
      qty_set_egg: refs.length === 1 ? p.qty_set_egg : 0,
    }));

    setReferenceRows((prev) =>
      buildReferenceRows(refs, refOptions, previousEggSetMap, prev),
    );
  }

  useEffect(() => {
    if (!form.ref_no.length || !refOptions.length) {
      setReferenceRows((prev) => (prev.length ? [] : prev));
      setForm((prev) => {
        if (!prev.ref_no.length && !prev.total_eggs && !prev.sum_set_egg) {
          return prev;
        }

        return {
          ...prev,
          total_eggs: "",
          sum_set_egg: 0,
          qty_set_egg: 0,
        };
      });
      return;
    }

    const meta = buildRefSelectionMeta(
      form.ref_no,
      refOptions,
      defaultFarm?.name || form.farm_source,
    );
    const nextRows = buildReferenceRows(
      form.ref_no,
      refOptions,
      previousEggSetMap,
      referenceRows,
    );
    const nextTotalEggs = nextRows.reduce(
      (sum, row) => sum + row.total_eggs,
      0,
    );
    const nextPreviousEggSet = nextRows.reduce(
      (sum, row) => sum + row.previous_egg_set,
      0,
    );
    const nextQtySetEgg = nextRows.reduce(
      (sum, row) => sum + row.qty_set_egg,
      0,
    );

    setReferenceRows((prev) =>
      JSON.stringify(prev) === JSON.stringify(nextRows) ? prev : nextRows,
    );

    setForm((prev) => {
      if (
        prev.farm_source === meta.farm_source &&
        prev.total_eggs === String(nextTotalEggs) &&
        (prev.sum_set_egg ?? 0) === nextPreviousEggSet &&
        prev.qty_set_egg === nextQtySetEgg
      ) {
        return prev;
      }

      return {
        ...prev,
        farm_source: meta.farm_source,
        total_eggs: String(nextTotalEggs),
        sum_set_egg: nextPreviousEggSet,
        qty_set_egg: nextQtySetEgg,
      };
    });
  }, [
    defaultFarm?.name,
    form.ref_no,
    form.farm_source,
    previousEggSetMap,
    refOptions,
    referenceRows,
  ]);

  async function onSave() {
    if (!form.ref_no.length) {
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
    if (
      !referenceRows.length ||
      referenceRows.some((row) => !row.qty_set_egg)
    ) {
      alert("Quantity of Set Eggs is required.");
      return;
    }
    const invalidRow = referenceRows.find(
      (row) => row.qty_set_egg + row.previous_egg_set > row.total_eggs,
    );
    if (invalidRow) {
      alert(
        `Qty Set + Previous Egg Set must not exceed Total Hatching Egg for ${invalidRow.ref_no}.`,
      );
      return;
    }
    if (!isValidDates) {
      alert("Egg Shell Temp Date & Time must be after Setting Date.");
      return;
    }

    const buildPayload = (row: EggReferenceRow) => ({
      ref_no: row.ref_no || null,
      setting_date: form.setting_date
        ? new Date(form.setting_date).toISOString()
        : null,
      farm_source: form.farm_source.trim() || null,
      machine_id: form.machine_id.trim() || null,

      total_eggs: Number.isFinite(row.total_eggs) ? row.total_eggs : null,
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
      qty_set_egg: Number.isFinite(row.qty_set_egg) ? row.qty_set_egg : null,
    });
    const payloads = referenceRows.map(buildPayload);
    const payload = payloads[0];

    if (!payload) {
      alert("At least one reference row is required.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const id = Number(idParam);
        if (!Number.isFinite(id)) throw new Error("Invalid id.");
        await updateSetterIncubation(id, payload);
      } else if (payloads.length === 1) {
        await createSetterIncubation(payload);
      } else {
        await createSetterIncubationBatch(payloads);
      }

      router.push("/jmb/eggsetter");
      router.refresh();
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Failed to save."));
    } finally {
      setSaving(false);
    }
  }

  function handleRowQtySetChange(refNo: string, value: string) {
    // Remove commas from formatted input
    const cleanValue = value.replace(/,/g, "");
    const parsedQty = Number(clampNonNegative(cleanValue));

    setReferenceRows((prev) => {
      const nextRows = prev.map((row) => {
        if (row.ref_no !== refNo) return row;

        const maxQty = getRemainingHatchingEgg(row);
        return {
          ...row,
          qty_set_egg: Math.min(parsedQty, maxQty),
        };
      });

      setForm((prevForm) => ({
        ...prevForm,
        qty_set_egg: nextRows.reduce((sum, row) => sum + row.qty_set_egg, 0),
      }));

      return nextRows;
    });
  }

  const disabledAll = saving || loadingRecord;
  const converterLabel =
    converterField === "setter_temp"
      ? "Setter Temperature"
      : converterField === "egg_shell_temp"
        ? "Egg Shell Temperature"
        : "Temperature";
  const converterInputValue = converterField ? Number(form[converterField]) : 0;

  return (
    // <div className="w-full  px-6 py-6  mt-4">
    <div className="space-y-4 mt-8">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Egg Setter List"
        CurrentPageName={isEdit ? "Edit Entry" : "New Egg Setter"}
      />

      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* SECTION 1 */}
          <div className="rounded-md border p-4 space-y-4">
            <div className="space-y-1 max-w-sm">
              <RequiredLabel>Egg Reference No.</RequiredLabel>
              <SearchableDropdown1
                list={refOptions}
                codeLabel="classi_ref_no"
                nameLabel="classi_ref_no"
                showNameOnly
                value={form.ref_no}
                onChange={(val) => handleSelectRef(val)}
                multiple
                disabled={saving || loadingRefs || isEdit}
              />
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-180 text-sm">
                  <thead className="bg-green-50">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">
                        Egg Reference No.
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Total Hatching Egg
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Previous Egg Set
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        <RequiredLabel>Qty Set</RequiredLabel>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {referenceRows.length ? (
                      referenceRows.map((row) => (
                        <tr key={row.ref_no} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <Input
                              value={row.ref_no}
                              readOnly
                              className="bg-green-100"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {row.total_eggs.toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            {row.previous_egg_set.toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            <div className="space-y-1">
                              <Input
                                type="text"
                                value={row.qty_set_egg.toLocaleString()}
                                onChange={(e) =>
                                  handleRowQtySetChange(
                                    row.ref_no,
                                    e.target.value,
                                  )
                                }
                                onFocus={(e) => e.target.select()}
                                disabled={disabledAll}
                                className="max-w-35 bg-red-100"
                              />
                              <p className="text-xs text-muted-foreground">
                                Max qty:{" "}
                                {getRemainingHatchingEgg(row).toLocaleString()}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          Select one or more Egg Reference No. to add rows.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Total Hatching Egg</Label>
                  <Input
                    value={totalSelectedEggs.toLocaleString()}
                    readOnly
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>Previous Egg Set</Label>
                  <Input
                    value={totalPreviousEggSet.toLocaleString()}
                    readOnly
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total Qty Set</Label>
                  <Input
                    value={totalQtySetEgg.toLocaleString()}
                    readOnly
                    disabled
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2 */}
          <div className="rounded-md border p-4 space-y-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* <div className="rounded-md border p-4 space-y-3 md:col-span-3"> */}
            {loadingRecord ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
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

            <TemperatureInput
              label="Setter Temperature (°F)"
              value={form.setter_temp}
              onChange={(value) =>
                setForm((p) => ({
                  ...p,
                  setter_temp: value,
                }))
              }
              onOpenConverter={() => setConverterField("setter_temp")}
              disabled={disabledAll}
            />

            <TemperatureInput
              label="Egg Shell Temperature (°F)"
              value={form.egg_shell_temp}
              onChange={(value) =>
                setForm((p) => ({
                  ...p,
                  egg_shell_temp: value,
                }))
              }
              onOpenConverter={() => setConverterField("egg_shell_temp")}
              disabled={disabledAll}
            />

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
                onValueChange={(v: EggShellOrientation) =>
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
                  <SelectItem value="Pointed Middle">Pointed Middle</SelectItem>
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
            key={`${converterField ?? "temperature"}-${form[converterField ?? "setter_temp"] ?? ""}`}
            title={converterLabel}
            defaultFromUnit="F"
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
