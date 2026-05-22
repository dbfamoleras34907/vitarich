"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ClipboardList, Mars, Venus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import Breadcrumb from "@/lib/Breadcrumb";
import FormActionButtons from "@/components/FormActionButtons";
import RequiredLabel from "@/components/RequiredLabel";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import {
  createGrowing,
  getGrowingById,
  getGrowingPlacementById,
  listGrowingHistoryByFarm,
  listFeedTypes,
  listGrowingPlacements,
  updateGrowing,
  type FeedType,
  type Growing,
  type GrowingInsert,
  type GrowingPlacement,
} from "./api";

type FormState = {
  placement_id: string;
  daterec: string;
  female_mortality: string;
  female_feedtype_id: string;
  female_feed_consumption: string;
  female_body_weight: string;
  male_mortality: string;
  male_feedtype_id: string;
  male_feed_consumption: string;
  male_body_weight: string;
};

type MetricInputProps = {
  id: keyof FormState;
  label: string;
  value: string;
  placeholder?: string;
  suffix?: string;
  inputMode?: "decimal" | "numeric";
  disabled?: boolean;
  onChange: (field: keyof FormState, value: string) => void;
};

function getToday() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function asNumber(value: string | number | null | undefined) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: string) {
  return value === "" ? null : asNumber(value);
}

function formatNumber(value: string | number | null | undefined) {
  const parsed = asNumber(value);
  return parsed ? parsed.toLocaleString("en-US") : "";
}

function cleanDecimal(raw: string) {
  if (raw === "") return "";
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
}

function cleanInteger(raw: string) {
  if (raw === "") return "";
  return raw.replace(/[^0-9]/g, "");
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function getAgeInDays(placementDate?: string | null, endDateValue?: string) {
  if (!placementDate || !endDateValue) return 0;
  const start = new Date(`${placementDate}T00:00:00`);
  const end = new Date(`${endDateValue}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(
    0,
    Math.floor(
      (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
        Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
        86_400_000,
    ),
  );
}

function getWeekNumber(days: number) {
  return Math.max(1, Math.floor(days / 7) + 1);
}

function createInitialForm(): FormState {
  return {
    placement_id: "",
    daterec: getToday(),
    female_mortality: "0",
    female_feedtype_id: "",
    female_feed_consumption: "",
    female_body_weight: "",
    male_mortality: "0",
    male_feedtype_id: "",
    male_feed_consumption: "",
    male_body_weight: "",
  };
}

function getPlacementLabel(placement: GrowingPlacement) {
  return [
    placement.farm_name,
    placement.building_no,
    placement.pen_no,
    placement.placement_date ? formatDate(placement.placement_date) : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

function MetricInput({
  id,
  label,
  value,
  placeholder,
  suffix,
  inputMode = "decimal",
  disabled,
  onChange,
}: MetricInputProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-slate-600">
        {label}
      </Label>
      <div className="relative">
        <Input
          type="text"
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(event) =>
            onChange(
              id,
              inputMode === "numeric"
                ? cleanInteger(event.target.value)
                : cleanDecimal(event.target.value),
            )
          }
          disabled={disabled}
          className="h-10 rounded-md border-emerald-100 bg-slate-50 pr-10 text-sm shadow-none focus-visible:ring-emerald-500"
        />
        {suffix ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function GrowingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const placementIdParam = searchParams.get("placementId");
  const isEdit = Boolean(idParam);

  const [form, setForm] = useState<FormState>(() => createInitialForm());
  const [feedTypes, setFeedTypes] = useState<FeedType[]>([]);
  const [placements, setPlacements] = useState<GrowingPlacement[]>([]);
  const [selectedPlacement, setSelectedPlacement] =
    useState<GrowingPlacement | null>(null);
  const [history, setHistory] = useState<Growing[]>([]);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);

  const disabledAll = saving || loadingRecord;
  const ageDays = selectedPlacement
    ? getAgeInDays(selectedPlacement.placement_date, form.daterec)
    : 0;
  const weekNumber = getWeekNumber(ageDays);

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function applyPlacement(placement: GrowingPlacement) {
    setSelectedPlacement(placement);
    setForm((prev) => ({ ...prev, placement_id: String(placement.id) }));
  }

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    (async () => {
      try {
        const [feedRows, placementRows] = await Promise.all([
          listFeedTypes(),
          listGrowingPlacements(),
        ]);
        setFeedTypes(feedRows);
        setPlacements(placementRows);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load lookups.";
        alert(message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!placementIdParam || isEdit) return;

    (async () => {
      const placementId = Number(placementIdParam);
      if (!Number.isFinite(placementId)) return;

      try {
        const placement = await getGrowingPlacementById(placementId);
        applyPlacement(placement);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load placement.";
        alert(message);
      }
    })();
  }, [placementIdParam, isEdit]);

  useEffect(() => {
    if (!idParam) return;

    (async () => {
      const id = Number(idParam);
      if (!Number.isFinite(id)) {
        alert("Invalid growing id.");
        router.push("/jmb/growing");
        return;
      }

      setLoadingRecord(true);
      try {
        const row = await getGrowingById(id);
        setForm({
          placement_id: row.placement_id ? String(row.placement_id) : "",
          daterec: row.daterec ?? getToday(),
          female_mortality:
            row.female_mortality != null ? String(row.female_mortality) : "0",
          female_feedtype_id: row.female_feedtype_id
            ? String(row.female_feedtype_id)
            : "",
          female_feed_consumption:
            row.female_feed_consumption != null
              ? String(row.female_feed_consumption)
              : "",
          female_body_weight:
            row.female_body_weight != null
              ? String(row.female_body_weight)
              : "",
          male_mortality:
            row.male_mortality != null ? String(row.male_mortality) : "0",
          male_feedtype_id: row.male_feedtype_id
            ? String(row.male_feedtype_id)
            : "",
          male_feed_consumption:
            row.male_feed_consumption != null
              ? String(row.male_feed_consumption)
              : "",
          male_body_weight:
            row.male_body_weight != null ? String(row.male_body_weight) : "",
        });

        if (row.placement) {
          setSelectedPlacement(row.placement);
        } else if (row.placement_id) {
          const placement = await getGrowingPlacementById(row.placement_id);
          setSelectedPlacement(placement);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load growing.";
        alert(message);
        router.push("/jmb/growing");
      } finally {
        setLoadingRecord(false);
      }
    })();
  }, [idParam, router]);

  useEffect(() => {
    if (!selectedPlacement?.farm_id && !selectedPlacement?.farm_name) {
      setHistory([]);
      return;
    }

    (async () => {
      try {
        const rows = await listGrowingHistoryByFarm({
          farmId: selectedPlacement.farm_id ?? null,
          farmName: selectedPlacement.farm_name ?? null,
        });
        setHistory(rows);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load history.";
        alert(message);
      }
    })();
  }, [selectedPlacement?.farm_id, selectedPlacement?.farm_name]);

  async function handlePlacementChange(value: string) {
    setField("placement_id", value);
    const placement = placements.find((row) => String(row.id) === value);
    if (placement) {
      setSelectedPlacement(placement);
      return;
    }

    const placementId = Number(value);
    if (!Number.isFinite(placementId)) return;
    const loaded = await getGrowingPlacementById(placementId);
    setSelectedPlacement(loaded);
  }

  async function onSave() {
    if (!form.daterec) {
      alert("Record date is required.");
      return;
    }

    if (!form.placement_id) {
      alert("Placement is required.");
      return;
    }

    const payload: GrowingInsert = {
      placement_id: asNumber(form.placement_id),
      daterec: form.daterec,
      female_mortality: optionalNumber(form.female_mortality),
      female_feedtype_id: form.female_feedtype_id
        ? asNumber(form.female_feedtype_id)
        : null,
      female_feed_consumption: optionalNumber(form.female_feed_consumption),
      female_body_weight: optionalNumber(form.female_body_weight),
      male_mortality: optionalNumber(form.male_mortality),
      male_feedtype_id: form.male_feedtype_id
        ? asNumber(form.male_feedtype_id)
        : null,
      male_feed_consumption: optionalNumber(form.male_feed_consumption),
      male_body_weight: optionalNumber(form.male_body_weight),
      isactive: true,
    };

    setSaving(true);
    try {
      if (isEdit) {
        const id = Number(idParam);
        if (!Number.isFinite(id)) throw new Error("Invalid growing id.");
        await updateGrowing(id, payload);
      } else {
        await createGrowing(payload);
      }

      router.push("/jmb/growing");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save growing.";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <Breadcrumb
        SecondPreviewPageName="Breeder"
        FirstPreviewsPageName="Growing List"
        CurrentPageName={isEdit ? "Edit Growing" : "New Growing"}
      />

      <Card>
        <CardContent className="space-y-5 pt-4">
          <div className="space-y-4 rounded-md border p-4">
            <section className="overflow-hidden rounded-md border border-emerald-100 bg-white">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <h2 className="text-sm font-bold text-slate-800">
                    Batch Identity
                  </h2>
                </div>
                {/* <span className="text-xs text-slate-500">
                  Auto-filled from selected pen
                </span> */}
              </div>

              <div className="space-y-4 p-5">
                {!placementIdParam || isEdit ? (
                  <div className="max-w-xl space-y-2">
                    <RequiredLabel>Placement</RequiredLabel>
                    <select
                      value={form.placement_id}
                      onChange={(event) =>
                        handlePlacementChange(event.target.value)
                      }
                      disabled={disabledAll}
                      className="flex h-10 w-full rounded-md border border-emerald-100 bg-white px-3 py-2 text-sm shadow-none outline-none focus:border-emerald-400"
                    >
                      <option value="">Select placement...</option>
                      {placements.map((placement) => (
                        <option key={placement.id} value={placement.id}>
                          {getPlacementLabel(placement)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <div className="rounded-md border border-emerald-200 bg-white p-3">
                    <div className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <CalendarDays className="h-3 w-3 text-emerald-700" />
                      Record Date
                    </div>
                    <Input
                      type="date"
                      value={form.daterec}
                      onChange={(event) =>
                        setField("daterec", event.target.value)
                      }
                      disabled={disabledAll}
                      className="h-7 border-0 bg-transparent p-0 font-mono text-sm font-bold text-emerald-800 shadow-none focus-visible:ring-0"
                    />
                  </div>

                  {[
                    ["Age (Days)", String(ageDays)],
                    ["Farm", selectedPlacement?.farm_name ?? ""],
                    ["Building", selectedPlacement?.building_no ?? ""],
                    ["Pen", selectedPlacement?.pen_no ?? ""],
                    ["Week #", String(weekNumber)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className={
                        label === "Farm" ||
                        label === "Building" ||
                        label === "Pen"
                          ? "rounded-md border border-emerald-200 bg-emerald-50 p-3"
                          : "rounded-md border border-slate-200 bg-slate-50 p-3"
                      }
                    >
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {label}
                      </div>
                      <div className="min-h-5 truncate text-sm font-bold text-emerald-800">
                        {value || "-"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-md border border-emerald-100 bg-white">
              <div className="flex items-center gap-3 border-b px-5 py-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-pink-50 text-pink-600">
                  <Venus className="h-4 w-4" />
                </span>
                <h2 className="inline-flex items-center rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-600">
                  Female Information
                </h2>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricInput
                    id="female_mortality"
                    label="Female Mortality"
                    value={form.female_mortality}
                    inputMode="numeric"
                    disabled={disabledAll}
                    onChange={setField}
                  />
                  <MetricInput
                    id="female_feed_consumption"
                    label="Female Feed Consumption"
                    value={form.female_feed_consumption}
                    placeholder="e.g. 250"
                    suffix="kg"
                    disabled={disabledAll}
                    onChange={setField}
                  />
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-[11px] font-semibold text-slate-600">
                      Female Feed Type
                    </Label>
                    <Select
                      value={form.female_feedtype_id || undefined}
                      onValueChange={(value) =>
                        setField("female_feedtype_id", value)
                      }
                      disabled={disabledAll}
                    >
                      <SelectTrigger className="h-10 w-full min-w-0 border-emerald-100 bg-slate-50">
                        <SelectValue placeholder="Select feed type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {feedTypes.map((feedType) => (
                          <SelectItem
                            key={feedType.id}
                            value={String(feedType.id)}
                          >
                            {feedType.description}
                            {feedType.uom ? ` (${feedType.uom})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <MetricInput
                    id="female_body_weight"
                    label="Female Body Weight"
                    value={form.female_body_weight}
                    placeholder="e.g. 1.80"
                    suffix="kg"
                    disabled={disabledAll}
                    onChange={setField}
                  />
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-md border border-emerald-100 bg-white">
              <div className="flex items-center gap-3 border-b px-5 py-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-sky-600">
                  <Mars className="h-4 w-4" />
                </span>
                <h2 className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-600">
                  Male Information
                </h2>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricInput
                    id="male_mortality"
                    label="Male Mortality"
                    value={form.male_mortality}
                    inputMode="numeric"
                    disabled={disabledAll}
                    onChange={setField}
                  />
                  <MetricInput
                    id="male_feed_consumption"
                    label="Male Feed Consumption"
                    value={form.male_feed_consumption}
                    placeholder="e.g. 180"
                    suffix="kg"
                    disabled={disabledAll}
                    onChange={setField}
                  />
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-[11px] font-semibold text-slate-600">
                      Male Feed Type
                    </Label>
                    <Select
                      value={form.male_feedtype_id || undefined}
                      onValueChange={(value) =>
                        setField("male_feedtype_id", value)
                      }
                      disabled={disabledAll}
                    >
                      <SelectTrigger className="h-10 w-full min-w-0 border-emerald-100 bg-slate-50">
                        <SelectValue placeholder="Select feed type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {feedTypes.map((feedType) => (
                          <SelectItem
                            key={feedType.id}
                            value={String(feedType.id)}
                          >
                            {feedType.description}
                            {feedType.uom ? ` (${feedType.uom})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <MetricInput
                    id="male_body_weight"
                    label="Male Body Weight"
                    value={form.male_body_weight}
                    placeholder="e.g. 2.10"
                    suffix="kg"
                    disabled={disabledAll}
                    onChange={setField}
                  />
                </div>
              </div>
            </section>

            <Separator />
            <FormActionButtons
              saving={saving}
              isEdit={isEdit}
              disabled={disabledAll}
              cancelPath="/jmb/growing"
              onSave={onSave}
            />

            <Separator />

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Growing Farm History</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedPlacement?.farm_name
                    ? `Showing recent transactions for ${selectedPlacement.farm_name}.`
                    : "Select a placement to show farm history."}
                </p>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-245 text-sm">
                  <thead className="bg-green-50">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">
                        Record Date
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Farm</th>
                      <th className="px-3 py-2 text-left font-medium">
                        Building
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Pen</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Age
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Week #
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Female Mortality
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Female Feed
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Female Feed Type
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Female Body Weight
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Male Mortality
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Male Feed
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Male Feed Type
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Male Body Weight
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length ? (
                      history.map((row) => {
                        const rowAge = getAgeInDays(
                          row.placement?.placement_date,
                          row.daterec ?? undefined,
                        );

                        return (
                          <tr key={row.id} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              {formatDate(row.daterec)}
                            </td>
                            <td className="px-3 py-2">
                              {row.placement?.farm_name ?? ""}
                            </td>
                            <td className="px-3 py-2">
                              {row.placement?.building_no ?? ""}
                            </td>
                            <td className="px-3 py-2">
                              {row.placement?.pen_no ?? ""}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {rowAge.toLocaleString("en-US")}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {getWeekNumber(rowAge).toLocaleString("en-US")}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatNumber(row.female_mortality)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatNumber(row.female_feed_consumption)}
                            </td>
                            <td className="px-3 py-2">
                              {row.female_feedtype?.description ?? ""}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatNumber(row.female_body_weight)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatNumber(row.male_mortality)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatNumber(row.male_feed_consumption)}
                            </td>
                            <td className="px-3 py-2">
                              {row.male_feedtype?.description ?? ""}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatNumber(row.male_body_weight)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={14}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          No farm history found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
