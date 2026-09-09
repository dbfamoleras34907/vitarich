"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ClipboardList } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import Breadcrumb from "@/lib/Breadcrumb";
import FormActionButtons from "@/components/FormActionButtons";
import RequiredLabel from "@/components/RequiredLabel";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import {
  createGrading,
  createGradingBatch,
  getGradingById,
  getGradingPlacementById,
  listGradingHistoryByFarm,
  listGradingPlacements,
  updateGrading,
  type Grading,
  type GradingFarmHistory,
  type GradingInsert,
  type GradingPlacement,
} from "./api";

type FormState = {
  placement_id: string;
  daterec: string;
  remarks: string;
};

type GradingPenRow = {
  placement_id: string;
  pen_no: string;
  female_qty_old: string;
  female_qty_new: string;
  male_qty_old: string;
  male_qty_new: string;
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

function getFarmKey(placement: GradingPlacement) {
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
    remarks: "",
  };
}

function createPenRow(placement: GradingPlacement): GradingPenRow {
  return {
    placement_id: String(placement.id),
    pen_no: placement.pen_no ?? "",
    female_qty_old: String(placement.f_endingbalance ?? 0),
    female_qty_new: "0",
    male_qty_old: String(placement.m_endingbalance ?? 0),
    male_qty_new: "0",
  };
}

function createPenRowFromGrading(row: Grading): GradingPenRow {
  return {
    placement_id: row.placement_id ? String(row.placement_id) : "",
    pen_no: row.placement?.pen_no ?? "",
    female_qty_old:
      row.female_qty_old != null ? String(row.female_qty_old) : "0",
    female_qty_new:
      row.female_qty_new != null ? String(row.female_qty_new) : "0",
    male_qty_old: row.male_qty_old != null ? String(row.male_qty_old) : "0",
    male_qty_new: row.male_qty_new != null ? String(row.male_qty_new) : "0",
  };
}

export default function GradingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const placementIdParam = searchParams.get("placementId");
  const isEdit = Boolean(idParam);

  const [form, setForm] = useState<FormState>(() => createInitialForm());
  const [placements, setPlacements] = useState<GradingPlacement[]>([]);
  const [gradingRows, setGradingRows] = useState<GradingPenRow[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [selectedBuildingNo, setSelectedBuildingNo] = useState("");
  const [selectedPlacement, setSelectedPlacement] =
    useState<GradingPlacement | null>(null);
  const [history, setHistory] = useState<GradingFarmHistory[]>([]);
  const [loadingRecord, setLoadingRecord] = useState(false);
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

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function applyPlacement(placement: GradingPlacement) {
    setSelectedPlacement(placement);
    setSelectedFarmId(getFarmKey(placement));
    setSelectedBuildingNo(placement.building_no ?? "");
    setForm((prev) => ({ ...prev, placement_id: String(placement.id) }));
  }

  function handleFarmChange(value: string) {
    setSelectedFarmId(value);
    setSelectedBuildingNo("");
    setSelectedPlacement(null);
    setGradingRows([]);
    setField("placement_id", "");
  }

  function handleBuildingChange(value: string) {
    setSelectedBuildingNo(value);
    setSelectedPlacement(null);
    setGradingRows([]);
    setField("placement_id", "");
  }

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    (async () => {
      try {
        const rows = await listGradingPlacements();
        setPlacements(rows);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to load lookups.");
      }
    })();
  }, []);

  useEffect(() => {
    if (isEdit) return;

    setGradingRows((prev) => {
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
        const placement = await getGradingPlacementById(placementId);
        applyPlacement(placement);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to load placement.");
      }
    })();
  }, [placementIdParam, isEdit]);

  useEffect(() => {
    if (!idParam) return;

    (async () => {
      const id = Number(idParam);
      if (!Number.isFinite(id)) {
        alert("Invalid grading id.");
        router.push("/jmb/growing");
        return;
      }

      setLoadingRecord(true);
      try {
        const row = await getGradingById(id);
        setForm({
          placement_id: row.placement_id ? String(row.placement_id) : "",
          daterec: row.daterec?.slice(0, 10) ?? getToday(),
          remarks: row.remarks ?? "",
        });
        setGradingRows([createPenRowFromGrading(row)]);

        if (row.placement) {
          applyPlacement(row.placement);
        } else if (row.placement_id) {
          const placement = await getGradingPlacementById(row.placement_id);
          applyPlacement(placement);
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to load grading.");
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
        const rows = await listGradingHistoryByFarm({
          farmId: selectedPlacement.farm_id ?? null,
          farmName: selectedPlacement.farm_name ?? null,
          buildingNo: selectedBuildingNo,
        });
        setHistory(rows);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to load history.");
      }
    })();
  }, [
    selectedBuildingNo,
    selectedPlacement?.farm_id,
    selectedPlacement?.farm_name,
  ]);

  function handleRowChange(
    placementId: string,
    field: keyof GradingPenRow,
    value: string,
  ) {
    setGradingRows((prev) =>
      prev.map((row) =>
        row.placement_id === placementId
          ? {
              ...row,
              [field]: field.includes("qty") ? cleanDecimal(value) : value,
            }
          : row,
      ),
    );
  }

  function buildPayload(row: GradingPenRow): GradingInsert {
    return {
      placement_id: asNumber(row.placement_id),
      daterec: form.daterec,
      female_qty_old: optionalNumber(row.female_qty_old),
      female_qty_new: optionalNumber(row.female_qty_new),
      male_qty_old: optionalNumber(row.male_qty_old),
      male_qty_new: optionalNumber(row.male_qty_new),
      remarks: form.remarks.trim() || null,
      isactive: true,
    };
  }

  async function onSave() {
    if (!form.daterec) {
      alert("Record date is required.");
      return;
    }

    if (!gradingRows.length) {
      alert("Select a farm and building to generate pen rows.");
      return;
    }

    const payloads = gradingRows.map(buildPayload);

    setSaving(true);
    try {
      if (isEdit) {
        const id = Number(idParam);
        if (!Number.isFinite(id)) throw new Error("Invalid grading id.");
        await updateGrading(id, payloads[0]);
      } else if (payloads.length === 1) {
        await createGrading(payloads[0]);
      } else {
        await createGradingBatch(payloads);
      }

      router.push("/jmb/growing");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save grading.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <Breadcrumb
        SecondPreviewPageName="Breeder"
        FirstPreviewsPageName="Population Record"
        CurrentPageName={isEdit ? "Edit Grading" : "New Grading"}
      />

      <Card>
        <CardContent className="space-y-5 pt-4">
          <div className="space-y-4 rounded-md border p-4">
            <section className="overflow-hidden rounded-md border border-emerald-100 bg-white">
              <div className="flex items-center gap-3 border-b px-5 py-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-bold text-slate-800">
                  Batch Identity
                </h2>
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
                          {farmOptions.map((farm) => (
                            <SelectItem key={farm.id} value={farm.id}>
                              {farm.name}
                            </SelectItem>
                          ))}
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
                          {buildingOptions.map((buildingNo) => (
                            <SelectItem key={buildingNo} value={buildingNo}>
                              {buildingNo}
                            </SelectItem>
                          ))}
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
                    ["Week #", weekNumber],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className={
                        label === "Farm" || label === "Building"
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
              <div className="border-b px-5 py-4">
                <h2 className="text-sm font-bold text-slate-800">
                  Grading Information
                </h2>
              </div>
              <div className="p-5">
                {gradingRows.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-sm">
                      <thead>
                        <tr>
                          {[
                            "Pen #",
                            "Female Old Qty",
                            "Female New Qty",
                            "Male Old Qty",
                            "Male New Qty",
                          ].map((label) => (
                            <th
                              key={label}
                              className="px-2 text-left align-bottom"
                            >
                              <Label className="text-[11px] font-semibold text-slate-600">
                                {label}
                              </Label>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gradingRows.map((row) => (
                          <tr key={row.placement_id}>
                            <td className="w-24 px-2 align-top">
                              <Input
                                value={row.pen_no || "-"}
                                disabled
                                className="h-10 rounded-md border-emerald-100 bg-slate-50 text-sm shadow-none"
                              />
                            </td>
                            {(
                              [
                                "female_qty_old",
                                "female_qty_new",
                                "male_qty_old",
                                "male_qty_new",
                              ] as const
                            ).map((field) => (
                              <td key={field} className="px-2 align-top">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={row[field]}
                                  onChange={(event) =>
                                    handleRowChange(
                                      row.placement_id,
                                      field,
                                      event.target.value.replace(/,/g, ""),
                                    )
                                  }
                                  disabled={disabledAll}
                                  className="h-10 rounded-md border-emerald-100 bg-slate-50 text-sm shadow-none focus-visible:ring-emerald-500"
                                />
                              </td>
                            ))}
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

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(event) => setField("remarks", event.target.value)}
                disabled={disabledAll}
                className="min-h-20"
              />
            </div>

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
                <h3 className="text-sm font-medium">Grading History</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedPlacement?.farm_name && selectedBuildingNo
                    ? `Showing recent transactions for ${selectedPlacement.farm_name} / ${selectedBuildingNo}.`
                    : "Select a farm and building to show history."}
                </p>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[980px] text-sm">
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
                        Female Old Qty
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Female New Qty
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Male Old Qty
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Male New Qty
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Remarks
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length ? (
                      history.map((row) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            {formatDate(row.record_date)}
                          </td>
                          <td className="px-3 py-2">{row.farm ?? ""}</td>
                          <td className="px-3 py-2">{row.building ?? ""}</td>
                          <td className="px-3 py-2">{row.pen ?? ""}</td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.age)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.week_no ?? formatWeeksDays(Number(row.age ?? 0))}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.female_qty_old)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.female_qty_new)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.male_qty_old)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.male_qty_new)}
                          </td>
                          <td className="max-w-70 truncate px-3 py-2">
                            {row.remarks ?? ""}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={11}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          No grading history found.
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
