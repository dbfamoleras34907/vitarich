"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Check,
  ClipboardList,
  Mars,
  Pencil,
  Save,
  Sprout,
  Venus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Breadcrumb from "@/lib/Breadcrumb";
import RequiredLabel from "@/components/RequiredLabel";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import {
  createGrowing,
  getGrowingById,
  getGrowingPlacementById,
  listFeedTypes,
  listGrowingPlacements,
  updateGrowing,
  type FeedType,
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

function Stepper() {
  const steps: Array<{ step: string; label: string; active: boolean }> = [
    { step: "1", label: "Details", active: true },
    { step: "2", label: "Review", active: false },
    { step: "3", label: "Save", active: false },
  ];

  return (
    <div className="hidden items-center gap-2 text-[11px] text-slate-500 md:flex">
      {steps.map(({ step, label, active }, index) => (
        <div key={step} className="flex items-center gap-2">
          {index ? <span className="h-px w-8 bg-emerald-100" /> : null}
          <span
            className={
              active
                ? "flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white"
                : "flex h-5 w-5 items-center justify-center rounded-full border border-emerald-100 bg-white text-[10px]"
            }
          >
            {step}
          </span>
          <span className={active ? "font-semibold text-emerald-700" : ""}>
            {label}
          </span>
        </div>
      ))}
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
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);

  const disabledAll = saving || loadingRecord;
  const ageDays = selectedPlacement
    ? getAgeInDays(selectedPlacement.placement_date, form.daterec)
    : 0;
  const weekNumber = getWeekNumber(ageDays);
  const hasChanges = useMemo(
    () =>
      Object.entries(form).some(([key, value]) => {
        if (key === "daterec") return value !== getToday();
        if (key === "female_mortality" || key === "male_mortality") {
          return value !== "0";
        }
        return value !== "";
      }),
    [form],
  );

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
            row.female_body_weight != null ? String(row.female_body_weight) : "",
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
    <div className="min-h-[calc(100vh-80px)] bg-[#f5faf6] pb-24">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-950">
                {isEdit ? "Edit Growing Record" : "Add Growing Record"}
              </h1>
              <div className="mt-1">
                <Breadcrumb
                  SecondPreviewPageName="Breeder"
                  FirstPreviewsPageName="Growing List"
                  CurrentPageName={isEdit ? "Edit Growing" : "New Growing"}
                />
              </div>
            </div>
          </div>
          <Stepper />
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <section className="overflow-hidden rounded-lg border border-emerald-100 bg-white shadow-sm shadow-emerald-950/5">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <ClipboardList className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-800">
                Batch Identity
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Auto-filled from selected pen
            </span>
          </div>

          <div className="space-y-4 p-5">
            {!placementIdParam || isEdit ? (
              <div className="max-w-xl space-y-2">
                <RequiredLabel>Placement</RequiredLabel>
                <select
                  value={form.placement_id}
                  onChange={(event) => handlePlacementChange(event.target.value)}
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
                  onChange={(event) => setField("daterec", event.target.value)}
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
                    label === "Farm" || label === "Building" || label === "Pen"
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

        <section className="overflow-hidden rounded-lg border border-emerald-100 bg-white shadow-sm shadow-emerald-950/5">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-pink-50 text-pink-600">
              <Venus className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-800">
              Female Information
            </h2>
          </div>
          <div className="space-y-4 p-5">
            <span className="inline-flex items-center rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-600">
              Female
            </span>
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
              <div className="space-y-1.5">
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
                  <SelectTrigger className="h-10 border-emerald-100 bg-slate-50">
                    <SelectValue placeholder="Select feed type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {feedTypes.map((feedType) => (
                      <SelectItem key={feedType.id} value={String(feedType.id)}>
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
            <p className="text-xs text-slate-500">
              Number of deaths today
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-emerald-100 bg-white shadow-sm shadow-emerald-950/5">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-sky-600">
              <Mars className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-800">
              Male Information
            </h2>
          </div>
          <div className="space-y-4 p-5">
            <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-600">
              Male
            </span>
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
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-600">
                  Male Feed Type
                </Label>
                <Select
                  value={form.male_feedtype_id || undefined}
                  onValueChange={(value) => setField("male_feedtype_id", value)}
                  disabled={disabledAll}
                >
                  <SelectTrigger className="h-10 border-emerald-100 bg-slate-50">
                    <SelectValue placeholder="Select feed type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {feedTypes.map((feedType) => (
                      <SelectItem key={feedType.id} value={String(feedType.id)}>
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
            <p className="text-xs text-slate-500">
              Number of deaths today
            </p>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="truncate text-xs text-slate-500">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" />
            {hasChanges
              ? `Unsaved changes - Week ${weekNumber} ${
                  selectedPlacement?.pen_no ? `- ${selectedPlacement.pen_no}` : ""
                }`
              : "No changes"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/jmb/growing")}
              disabled={disabledAll}
              className="min-w-24"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSave}
              disabled={disabledAll}
              className="min-w-32 bg-emerald-700 text-white hover:bg-emerald-800"
            >
              {saving ? (
                "Saving..."
              ) : isEdit ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Update Record
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Record
                </>
              )}
            </Button>
            {isEdit ? (
              <span className="hidden h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 md:flex">
                <Check className="h-4 w-4" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
