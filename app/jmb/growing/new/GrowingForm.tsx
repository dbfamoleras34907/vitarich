"use client";

import { useEffect, useMemo, useState } from "react";
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
import SearchableDropdown1 from "@/lib/SearchableDropdown1";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import {
  createGrowing,
  createGrowingBatch,
  getGrowingById,
  getGrowingPlacementById,
  listGrowingHistoryByFarm,
  listFeedTypes,
  listGrowingPlacements,
  updateGrowing,
  type FeedType,
  type Growing,
  type GrowingFarmHistory,
  type GrowingInsert,
  type GrowingPlacement,
} from "./api";

type FormState = {
  placement_id: string;
  daterec: string;
};

type GrowingPenRow = {
  placement_id: string;
  pen_no: string;
  female_mortality: string;
  female_feedtype_id: string;
  female_feed_consumption: string;
  female_body_weight: string;
  male_mortality: string;
  male_feedtype_id: string;
  male_feed_consumption: string;
  male_body_weight: string;
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

function getFeedTypeLabel(feedType: FeedType) {
  const description = feedType.description?.trim() || `Feed Type #${feedType.id}`;
  return feedType.uom ? `${description} (${feedType.uom})` : description;
}

function getFeedTypeOptions(feedTypes: FeedType[]) {
  return feedTypes.map((feedType) => ({
    ...feedType,
    id: String(feedType.id),
    description: getFeedTypeLabel(feedType),
  }));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const details = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    return [details.message, details.details, details.hint, details.code]
      .filter(
        (value): value is string => typeof value === "string" && value !== "",
      )
      .join("\n");
  }
  return fallback;
}

function getFarmKey(placement: GrowingPlacement) {
  return placement.farm_id != null
    ? String(placement.farm_id)
    : (placement.farm_name?.trim() ?? "");
}

function getAgeInDays(placementDate?: string | null, endDateValue?: string) {
  if (!placementDate || !endDateValue) return 0;
  const start = new Date(`${placementDate}T00:00:00`);
  const end = new Date(`${endDateValue}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const elapsedDays = Math.floor(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86_400_000,
  );

  return elapsedDays < 0 ? 0 : elapsedDays + 1;
}

function formatWeeksDays(days: number) {
  if (days <= 0) return "0.0";
  return `${Math.floor(days / 7)}.${days % 7}`;
}

function createInitialForm(): FormState {
  return {
    placement_id: "",
    daterec: getToday(),
  };
}

function createPenRow(placement: GrowingPlacement): GrowingPenRow {
  return {
    placement_id: String(placement.id),
    pen_no: placement.pen_no ?? "",
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

function createPenRowFromGrowing(row: Growing): GrowingPenRow {
  return {
    placement_id: row.placement_id ? String(row.placement_id) : "",
    pen_no: row.placement?.pen_no ?? "",
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
    male_feedtype_id: row.male_feedtype_id ? String(row.male_feedtype_id) : "",
    male_feed_consumption:
      row.male_feed_consumption != null
        ? String(row.male_feed_consumption)
        : "",
    male_body_weight:
      row.male_body_weight != null ? String(row.male_body_weight) : "",
  };
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
  const [growingRows, setGrowingRows] = useState<GrowingPenRow[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [selectedBuildingNo, setSelectedBuildingNo] = useState("");
  const [selectedPlacement, setSelectedPlacement] =
    useState<GrowingPlacement | null>(null);
  const [history, setHistory] = useState<GrowingFarmHistory[]>([]);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [loadingFeedTypes, setLoadingFeedTypes] = useState(false);
  const [saving, setSaving] = useState(false);

  const disabledAll = saving || loadingRecord;
  const ageDays = selectedPlacement
    ? getAgeInDays(selectedPlacement.placement_date, form.daterec)
    : 0;
  const weekNumber = formatWeeksDays(ageDays);
  const farmOptions = useMemo(() => {
    const values = new Map<string, string>();
    placements.forEach((placement) => {
      const farmId = getFarmKey(placement);
      const farmName = placement.farm_name?.trim() ?? "";
      if (farmId && farmName) values.set(farmId, farmName);
    });
    return Array.from(values, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [placements]);
  const buildingOptions = useMemo(() => {
    const values = new Set<string>();
    placements.forEach((placement) => {
      if (
        selectedFarmId &&
        getFarmKey(placement) === selectedFarmId &&
        placement.building_no?.trim()
      ) {
        values.add(placement.building_no.trim());
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [placements, selectedFarmId]);
  const placementRows = useMemo(() => {
    if (!selectedFarmId || !selectedBuildingNo) return [];
    return placements.filter(
      (placement) =>
        getFarmKey(placement) === selectedFarmId &&
        placement.building_no === selectedBuildingNo,
    );
  }, [placements, selectedBuildingNo, selectedFarmId]);
  const feedTypeOptions = useMemo(
    () => getFeedTypeOptions(feedTypes),
    [feedTypes],
  );

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function applyPlacement(placement: GrowingPlacement) {
    setSelectedPlacement(placement);
    setSelectedFarmId(getFarmKey(placement));
    setSelectedBuildingNo(placement.building_no ?? "");
    setForm((prev) => ({ ...prev, placement_id: String(placement.id) }));
  }

  function handleFarmChange(value: string) {
    setSelectedFarmId(value);
    setSelectedBuildingNo("");
    setSelectedPlacement(null);
    setGrowingRows([]);
    setField("placement_id", "");
  }

  function handleBuildingChange(value: string) {
    setSelectedBuildingNo(value);
    setSelectedPlacement(null);
    setGrowingRows([]);
    setField("placement_id", "");
  }

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    (async () => {
      setLoadingFeedTypes(true);
      try {
        const feedRows = await listFeedTypes();
        setFeedTypes(feedRows);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load feed types.";
        alert(message);
      } finally {
        setLoadingFeedTypes(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const placementRows = await listGrowingPlacements();
        setPlacements(placementRows);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load placements.";
        alert(message);
      }
    })();
  }, []);

  useEffect(() => {
    if (isEdit) return;

    setGrowingRows((prev) => {
      const existing = new Map(prev.map((row) => [row.placement_id, row]));
      return placementRows.map((placement) => {
        const placementId = String(placement.id);
        return existing.get(placementId) ?? createPenRow(placement);
      });
    });

    if (placementRows.length) {
      applyPlacement(placementRows[0]);
    } else {
      setSelectedPlacement(null);
      setField("placement_id", "");
    }
  }, [isEdit, placementRows]);

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
        });
        setGrowingRows([createPenRowFromGrowing(row)]);

        if (row.placement) {
          applyPlacement(row.placement);
        } else if (row.placement_id) {
          const placement = await getGrowingPlacementById(row.placement_id);
          applyPlacement(placement);
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
    if (
      (!selectedPlacement?.farm_id && !selectedPlacement?.farm_name) ||
      !selectedBuildingNo
    ) {
      setHistory([]);
      return;
    }

    (async () => {
      try {
        const rows = await listGrowingHistoryByFarm({
          farmId: selectedPlacement.farm_id ?? null,
          farmName: selectedPlacement.farm_name ?? null,
          buildingNo: selectedBuildingNo,
        });
        setHistory(rows);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load history.";
        alert(message);
      }
    })();
  }, [
    selectedBuildingNo,
    selectedPlacement?.farm_id,
    selectedPlacement?.farm_name,
  ]);

  function handleGrowingRowChange(
    placementId: string,
    field: keyof GrowingPenRow,
    value: string,
  ) {
    setGrowingRows((prev) =>
      prev.map((row) =>
        row.placement_id === placementId
          ? {
              ...row,
              [field]:
                field.includes("mortality") ||
                field.includes("feed_consumption") ||
                field.includes("body_weight")
                  ? field.includes("mortality")
                    ? cleanInteger(value)
                    : cleanDecimal(value)
                  : value,
            }
          : row,
      ),
    );
  }

  function buildPayload(row: GrowingPenRow): GrowingInsert {
    return {
      placement_id: asNumber(row.placement_id),
      daterec: form.daterec,
      female_mortality: optionalNumber(row.female_mortality),
      female_feedtype_id: row.female_feedtype_id
        ? asNumber(row.female_feedtype_id)
        : null,
      female_feed_consumption: optionalNumber(row.female_feed_consumption),
      female_body_weight: optionalNumber(row.female_body_weight),
      male_mortality: optionalNumber(row.male_mortality),
      male_feedtype_id: row.male_feedtype_id
        ? asNumber(row.male_feedtype_id)
        : null,
      male_feed_consumption: optionalNumber(row.male_feed_consumption),
      male_body_weight: optionalNumber(row.male_body_weight),
      isactive: true,
    };
  }

  async function onSave() {
    if (!form.daterec) {
      alert("Record date is required.");
      return;
    }

    if (!growingRows.length) {
      alert("Select a farm and building to generate pen rows.");
      return;
    }

    if (growingRows.some((row) => !row.placement_id)) {
      alert("Every pen row must have a placement.");
      return;
    }

    const payloads = growingRows.map(buildPayload);

    setSaving(true);
    try {
      if (isEdit) {
        const id = Number(idParam);
        if (!Number.isFinite(id)) throw new Error("Invalid growing id.");
        await updateGrowing(id, payloads[0]);
      } else if (payloads.length === 1) {
        await createGrowing(payloads[0]);
      } else {
        await createGrowingBatch(payloads);
      }

      router.push("/jmb/growing");
    } catch (error) {
      console.error("Failed to save growing", { error, payloads });
      alert(getErrorMessage(error, "Failed to save growing."));
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
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <RequiredLabel>Farm Name</RequiredLabel>
                      <Select
                        value={selectedFarmId}
                        onValueChange={handleFarmChange}
                        disabled={disabledAll}
                      >
                        <SelectTrigger className="w-full border-emerald-100 bg-white">
                          <SelectValue placeholder="Select farm" />
                        </SelectTrigger>
                        <SelectContent>
                          {farmOptions.length ? (
                            farmOptions.map((farm) => (
                              <SelectItem key={farm.id} value={farm.id}>
                                {farm.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__no_farm_options__" disabled>
                              No placement farms
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <RequiredLabel>Building #</RequiredLabel>
                      <Select
                        value={selectedBuildingNo}
                        onValueChange={handleBuildingChange}
                        disabled={disabledAll || !selectedFarmId}
                      >
                        <SelectTrigger className="w-full border-emerald-100 bg-white">
                          <SelectValue
                            placeholder={
                              selectedFarmId
                                ? "Select building"
                                : "Select farm first"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {buildingOptions.length ? (
                            buildingOptions.map((buildingNo) => (
                              <SelectItem key={buildingNo} value={buildingNo}>
                                {buildingNo}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem
                              value="__no_building_options__"
                              disabled
                            >
                              No placement buildings
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
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
                    ["Week #", String(weekNumber)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className={
                        label === "Farm" ||
                        label === "Building"
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
              <div className="p-5">
                {growingRows.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1330px] border-separate border-spacing-x-3 border-spacing-y-2 text-sm">
                      <thead>
                        <tr>
                          <th
                            colSpan={5}
                            className="border-b border-slate-200 px-0 pb-3 text-left"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-pink-50 text-pink-600">
                                <Venus className="h-4 w-4" />
                              </span>
                              <span className="inline-flex items-center rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-600">
                                Female Information
                              </span>
                            </div>
                          </th>
                          <th
                            colSpan={4}
                            className="border-b border-slate-200 px-0 pb-3 text-left"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-sky-600">
                                <Mars className="h-4 w-4" />
                              </span>
                              <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-600">
                                Male Information
                              </span>
                            </div>
                          </th>
                        </tr>
                        <tr>
                          <th className="w-24 pt-5 text-left align-bottom">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Pen #
                            </Label>
                          </th>
                          <th className="w-32 pt-5 text-left align-bottom">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Female Mortality
                            </Label>
                          </th>
                          <th className="w-44 pt-5 text-left align-bottom">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Female Feed Consumption
                            </Label>
                          </th>
                          <th className="w-56 pt-5 text-left align-bottom">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Female Feed Type
                            </Label>
                          </th>
                          <th className="w-44 pt-5 text-left align-bottom">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Female Body Weight
                            </Label>
                          </th>
                          <th className="w-32 pt-5 text-left align-bottom">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Male Mortality
                            </Label>
                          </th>
                          <th className="w-44 pt-5 text-left align-bottom">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Male Feed Consumption
                            </Label>
                          </th>
                          <th className="w-56 pt-5 text-left align-bottom">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Male Feed Type
                            </Label>
                          </th>
                          <th className="w-44 pt-5 text-left align-bottom">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Male Body Weight
                            </Label>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {growingRows.map((row) => (
                          <tr key={row.placement_id}>
                            <td className="align-top">
                              <Input
                                value={row.pen_no || "-"}
                                disabled
                                className="h-10 rounded-md border-emerald-100 bg-slate-50 text-sm shadow-none"
                              />
                            </td>
                            <td className="align-top">
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={row.female_mortality}
                                onChange={(event) =>
                                  handleGrowingRowChange(
                                    row.placement_id,
                                    "female_mortality",
                                    event.target.value,
                                  )
                                }
                                disabled={disabledAll}
                                className="h-10 rounded-md border-emerald-100 bg-slate-50 text-sm shadow-none focus-visible:ring-emerald-500"
                              />
                            </td>
                            <td className="align-top">
                              <div className="relative">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={row.female_feed_consumption}
                                  placeholder="e.g. 250"
                                  onChange={(event) =>
                                    handleGrowingRowChange(
                                      row.placement_id,
                                      "female_feed_consumption",
                                      event.target.value,
                                    )
                                  }
                                  disabled={disabledAll}
                                  className="h-10 rounded-md border-emerald-100 bg-slate-50 pr-10 text-sm shadow-none focus-visible:ring-emerald-500"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500">
                                  kg
                                </span>
                              </div>
                            </td>
                            <td className="align-top">
                              <SearchableDropdown1
                                list={feedTypeOptions}
                                codeLabel="id"
                                nameLabel="description"
                                showNameOnly
                                value={
                                  row.female_feedtype_id
                                    ? [row.female_feedtype_id]
                                    : []
                                }
                                onChange={(value) =>
                                  handleGrowingRowChange(
                                    row.placement_id,
                                    "female_feedtype_id",
                                    value[0] ?? "",
                                  )
                                }
                                placeholder={
                                  loadingFeedTypes
                                    ? "Loading feed types..."
                                    : feedTypeOptions.length
                                      ? "Select feed type..."
                                      : "No feed type descriptions found"
                                }
                                disabled={disabledAll || loadingFeedTypes}
                                triggerClassName="h-10 rounded-md border-emerald-100 bg-slate-50 text-sm !font-normal shadow-none hover:bg-slate-50"
                              />
                            </td>
                            <td className="align-top">
                              <div className="relative">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={row.female_body_weight}
                                  placeholder="e.g. 1.80"
                                  onChange={(event) =>
                                    handleGrowingRowChange(
                                      row.placement_id,
                                      "female_body_weight",
                                      event.target.value,
                                    )
                                  }
                                  disabled={disabledAll}
                                  className="h-10 rounded-md border-emerald-100 bg-slate-50 pr-10 text-sm shadow-none focus-visible:ring-emerald-500"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500">
                                  kg
                                </span>
                              </div>
                            </td>
                            <td className="align-top">
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={row.male_mortality}
                                onChange={(event) =>
                                  handleGrowingRowChange(
                                    row.placement_id,
                                    "male_mortality",
                                    event.target.value,
                                  )
                                }
                                disabled={disabledAll}
                                className="h-10 rounded-md border-emerald-100 bg-slate-50 text-sm shadow-none focus-visible:ring-emerald-500"
                              />
                            </td>
                            <td className="align-top">
                              <div className="relative">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={row.male_feed_consumption}
                                  placeholder="e.g. 180"
                                  onChange={(event) =>
                                    handleGrowingRowChange(
                                      row.placement_id,
                                      "male_feed_consumption",
                                      event.target.value,
                                    )
                                  }
                                  disabled={disabledAll}
                                  className="h-10 rounded-md border-emerald-100 bg-slate-50 pr-10 text-sm shadow-none focus-visible:ring-emerald-500"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500">
                                  kg
                                </span>
                              </div>
                            </td>
                            <td className="align-top">
                              <SearchableDropdown1
                                list={feedTypeOptions}
                                codeLabel="id"
                                nameLabel="description"
                                showNameOnly
                                value={
                                  row.male_feedtype_id
                                    ? [row.male_feedtype_id]
                                    : []
                                }
                                onChange={(value) =>
                                  handleGrowingRowChange(
                                    row.placement_id,
                                    "male_feedtype_id",
                                    value[0] ?? "",
                                  )
                                }
                                placeholder={
                                  loadingFeedTypes
                                    ? "Loading feed types..."
                                    : feedTypeOptions.length
                                      ? "Select feed type..."
                                      : "No feed type descriptions found"
                                }
                                disabled={disabledAll || loadingFeedTypes}
                                triggerClassName="h-10 rounded-md border-emerald-100 bg-slate-50 text-sm !font-normal shadow-none hover:bg-slate-50"
                              />
                            </td>
                            <td className="align-top">
                              <div className="relative">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={row.male_body_weight}
                                  placeholder="e.g. 2.10"
                                  onChange={(event) =>
                                    handleGrowingRowChange(
                                      row.placement_id,
                                      "male_body_weight",
                                      event.target.value,
                                    )
                                  }
                                  disabled={disabledAll}
                                  className="h-10 rounded-md border-emerald-100 bg-slate-50 pr-10 text-sm shadow-none focus-visible:ring-emerald-500"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500">
                                  kg
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Select a farm and building above to generate pen rows.
                  </div>
                )}
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
                  {selectedPlacement?.farm_name && selectedBuildingNo
                    ? `Showing recent transactions for ${selectedPlacement.farm_name} / ${selectedBuildingNo}.`
                    : "Select a farm and building to show history."}
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
                      history.map((row, index) => {
                        const rowAge = Number(row.age ?? 0);

                        return (
                          <tr
                            key={[
                              index,
                              row.record_date ?? "",
                              row.farm ?? "",
                              row.building ?? "",
                              row.pen ?? "",
                            ].join("|")}
                            className="border-b last:border-0"
                          >
                            <td className="px-3 py-2">
                              {formatDate(row.record_date)}
                            </td>
                            <td className="px-3 py-2">{row.farm ?? ""}</td>
                            <td className="px-3 py-2">{row.building ?? ""}</td>
                            <td className="px-3 py-2">{row.pen ?? ""}</td>
                            <td className="px-3 py-2 text-right">
                              {rowAge.toLocaleString("en-US")}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {row.week_no ?? formatWeeksDays(rowAge)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatNumber(row.female_mortality)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatNumber(row.female_feed)}
                            </td>
                            <td className="px-3 py-2">
                              {row.female_feed_type ?? ""}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatNumber(row.female_body_weight)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatNumber(row.male_mortality)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatNumber(row.male_feed)}
                            </td>
                            <td className="px-3 py-2">
                              {row.male_feed_type ?? ""}
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
