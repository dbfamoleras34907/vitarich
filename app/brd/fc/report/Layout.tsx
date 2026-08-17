"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Download,
  FileText,
  Loader2,
  Printer,
  Search,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchableCombobox from "@/components/SearchableCombobox";
import Breadcrumb from "@/lib/Breadcrumb";
import { usePermission } from "@/hooks/usePermission";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { getUserFarms } from "@/app/admin/user/new/api";
import {
  getFarmBuildingsForFlockCard,
  type FarmBuildingListRow,
} from "../api";
import {
  getFlockCardReport,
  getFlockCardReportCardOptions,
  type FlockCardReport,
  type FlockCardReportCardOption,
} from "./api";

type FeedWarehouseAssociation = {
  id?: number | null;
  whse_code?: string | null;
  whse_name?: string | null;
  is_default_feed?: boolean | null;
};

type FeedFarm = {
  id: number;
  code: string;
  name: string | null;
  farm_id?: number | null;
  farm_code?: string | null;
  farm_name?: string | null;
  address?: string | null;
  farm_type?: string | null;
  contact_person?: string | null;
  associated_warehouses?: FeedWarehouseAssociation[] | string[] | null;
};

const asArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? value as T[] : [];

function normalizeFarmCode(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeFarm(farm: FeedFarm, masterFarms: FeedFarm[] = []): FeedFarm | null {
  const code = normalizeFarmCode(farm.code ?? farm.farm_code);
  if (!code) return null;

  const masterFarm = masterFarms.find(candidate => normalizeFarmCode(candidate.code) === code);
  const id = farm.id ?? farm.farm_id ?? masterFarm?.id ?? null;

  if (id == null) return null;

  return {
    ...masterFarm,
    ...farm,
    id,
    code,
    name: farm.name ?? farm.farm_name ?? masterFarm?.name ?? code,
    associated_warehouses: farm.associated_warehouses ?? masterFarm?.associated_warehouses ?? null,
  };
}

function formatNumber(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString("en-PH", { maximumFractionDigits });
}

function formatPercent(value: number) {
  return `${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatDate(value: string) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getKpiTone(variance: number) {
  if (variance <= 0) return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (variance <= 0.25) return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
  return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
}

function getFileSafeName(value: string) {
  return value.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "flock-card-report";
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Layout() {
  const searchParams = useSearchParams();
  const { getValue } = useGlobalContext();
  const flockCardViewBlocked = usePermission("/brd/fc/view");
  const reportViewBlocked = usePermission("/brd/fc/report/view");
  const viewBlocked = flockCardViewBlocked && reportViewBlocked;
  const [report, setReport] = useState<FlockCardReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportCardNo, setReportCardNo] = useState(searchParams.get("cardNo") ?? "");
  const [selectedFarmId, setSelectedFarmId] = useState(searchParams.get("farmId") ?? "");
  const [selectedBuildingKey, setSelectedBuildingKey] = useState(searchParams.get("buildingKey") ?? "");
  const [fallbackAssignedFarms, setFallbackAssignedFarms] = useState<FeedFarm[]>([]);
  const [buildings, setBuildings] = useState<FarmBuildingListRow[]>([]);
  const [cardOptions, setCardOptions] = useState<FlockCardReportCardOption[]>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [ageFrom, setAgeFrom] = useState(searchParams.get("ageFrom") ?? "");
  const [ageTo, setAgeTo] = useState(searchParams.get("ageTo") ?? "");

  const fcId = searchParams.get("fcId");
  const routeCardNo = searchParams.get("cardNo") ?? "";
  const cardNo = reportCardNo || routeCardNo;

  const farmMaster = useMemo(() => {
    const goodsReceiptReferences = getValue("goodsReceiptReferences") as
      | { farms?: FeedFarm[] }
      | undefined;

    const referenceFarms = asArray<FeedFarm>(goodsReceiptReferences?.farms);
    return referenceFarms.length
      ? referenceFarms
      : asArray<FeedFarm>(getValue("getFarmDB"));
  }, [getValue]);

  const sessionUser = getValue("UserInfoAuthSession")?.[0] as
    | { id?: number | string; users_farms?: unknown[] }
    | undefined;

  const assignedFarmCodes = useMemo(
    () => asArray<unknown>(sessionUser?.users_farms).map(normalizeFarmCode).filter(Boolean),
    [sessionUser?.users_farms],
  );

  const farms = useMemo(() => {
    const normalizedMasterFarms = farmMaster
      .map(farm => normalizeFarm(farm, farmMaster))
      .filter((farm): farm is FeedFarm => Boolean(farm));

    if (assignedFarmCodes.length > 0) {
      const assignedCodeSet = new Set(assignedFarmCodes);
      return normalizedMasterFarms.filter(farm => assignedCodeSet.has(farm.code));
    }

    return fallbackAssignedFarms
      .map(farm => normalizeFarm(farm, farmMaster))
      .filter((farm): farm is FeedFarm => Boolean(farm));
  }, [assignedFarmCodes, fallbackAssignedFarms, farmMaster]);

  const effectiveSelectedFarmId = useMemo(() => {
    if (selectedFarmId) return selectedFarmId;

    const defaultFarmId = getValue("DefaultFarmId");
    const defaultFarm = farms.find(farm => String(farm.id) === String(defaultFarmId));

    return defaultFarm ? String(defaultFarm.id) : farms[0] ? String(farms[0].id) : "";
  }, [farms, getValue, selectedFarmId]);

  const selectedFarm = useMemo(
    () => farms.find(farm => String(farm.id) === effectiveSelectedFarmId) ?? null,
    [effectiveSelectedFarmId, farms],
  );

  const selectedBuilding = useMemo(
    () => buildings.find(building => building.key === selectedBuildingKey) ?? null,
    [buildings, selectedBuildingKey],
  );

  const farmOptions = useMemo(
    () => farms.map(farm => ({
      code: String(farm.id),
      name: farm.code ? `${farm.code} - ${farm.name ?? ""}` : farm.name ?? String(farm.id),
    })),
    [farms],
  );

  const buildingOptions = useMemo(
    () => buildings.map(building => ({
      code: building.key,
      name: building.name ? `${building.code} - ${building.name}` : building.code,
    })),
    [buildings],
  );

  const summary = useMemo(() => {
    const startingPopulation = report?.startingPopulation ?? 0;
    const totalMortality = report?.lines.reduce((sum, line) => sum + line.mortalityTotal, 0) ?? 0;
    const totalThinning = report?.lines.reduce((sum, line) => sum + line.thinningTotal, 0) ?? 0;
    const totalDepletion = totalMortality + totalThinning;
    const cumulativeMortality = startingPopulation > 0 ? (totalMortality / startingPopulation) * 100 : 0;
    const cumulativeDepletion = startingPopulation > 0 ? (totalDepletion / startingPopulation) * 100 : 0;
    const livability = Math.max(0, 100 - cumulativeDepletion);
    const standardDepletion = report?.standardDepletionRate ?? 1.05;
    const variance = cumulativeDepletion - standardDepletion;

    return {
      startingPopulation,
      totalMortality,
      totalThinning,
      totalDepletion,
      cumulativeMortality,
      cumulativeDepletion,
      livability,
      standardDepletion,
      variance,
    };
  }, [report]);

  const loadReport = useCallback(async (nextAgeFrom = "", nextAgeTo = "") => {
    if (viewBlocked) return;
    if (!fcId && !cardNo) {
      setReport(null);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await getFlockCardReport({
        fcId: fcId ? Number(fcId) : null,
        cardNo,
        ageFrom: nextAgeFrom ? Number(nextAgeFrom) : null,
        ageTo: nextAgeTo ? Number(nextAgeTo) : null,
      });

      setReport(data);
      if (!data) setError("No flock card report data found.");
    } catch (loadError) {
      console.error(loadError);
      setReport(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load flock card report.");
    } finally {
      setLoading(false);
    }
  }, [cardNo, fcId, viewBlocked]);

  useEffect(() => {
    if (assignedFarmCodes.length > 0 || !sessionUser?.id) return;

    let cancelled = false;

    getUserFarms(Number(sessionUser.id))
      .then(farms => {
        if (!cancelled) setFallbackAssignedFarms(Array.isArray(farms) ? farms as FeedFarm[] : []);
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) setFallbackAssignedFarms([]);
      });

    return () => {
      cancelled = true;
    };
  }, [assignedFarmCodes.length, sessionUser?.id]);

  useEffect(() => {
    if (selectedFarmId || farms.length !== 1) return;
    setSelectedFarmId(String(farms[0].id));
  }, [farms, selectedFarmId]);

  useEffect(() => {
    if (!selectedFarm) {
      setBuildings([]);
      setSelectedBuildingKey("");
      return;
    }

    const farm = selectedFarm;
    let cancelled = false;

    async function loadBuildings() {
      setLoadingBuildings(true);

      try {
        const rows = await getFarmBuildingsForFlockCard(farm.id);
        if (!cancelled) {
          setBuildings(rows);
          setSelectedBuildingKey(current => rows.some(row => row.key === current) ? current : "");
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setBuildings([]);
          setSelectedBuildingKey("");
        }
      } finally {
        if (!cancelled) setLoadingBuildings(false);
      }
    }

    void loadBuildings();

    return () => {
      cancelled = true;
    };
  }, [selectedFarm]);

  useEffect(() => {
    if (selectedBuildingKey || buildings.length !== 1) return;
    setSelectedBuildingKey(buildings[0].key);
  }, [buildings, selectedBuildingKey]);

  useEffect(() => {
    if (!selectedFarm || !selectedBuilding) {
      setCardOptions([]);
      if (!routeCardNo) setReportCardNo("");
      return;
    }

    const farm = selectedFarm;
    const building = selectedBuilding;
    let cancelled = false;

    async function loadCards() {
      setLoadingCards(true);

      try {
        const rows = await getFlockCardReportCardOptions({
          farmId: farm.id,
          buildingKey: building.key,
          buildingId: building.id,
          buildingCode: building.code,
        });

        if (!cancelled) {
          setCardOptions(rows);
          setReportCardNo(current => rows.some(row => row.code === current) ? current : "");
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setCardOptions([]);
          if (!routeCardNo) setReportCardNo("");
        }
      } finally {
        if (!cancelled) setLoadingCards(false);
      }
    }

    void loadCards();

    return () => {
      cancelled = true;
    };
  }, [routeCardNo, selectedBuilding, selectedFarm]);

  useEffect(() => {
    if (reportCardNo || cardOptions.length !== 1) return;
    setReportCardNo(cardOptions[0].code);
  }, [cardOptions, reportCardNo]);

  useEffect(() => {
    void loadReport(searchParams.get("ageFrom") ?? "", searchParams.get("ageTo") ?? "");
  }, [loadReport, searchParams]);

  function exportExcel() {
    if (!report) return;

    const headerRows = [
      ["Farm", report.farmName || report.farmCode],
      ["House", report.houseName || report.houseCode],
      ["Flock / Batch No.", report.cardNo || report.fcNo],
      ["Breed", report.breed],
      ["Placement Date", formatDate(report.placementDate)],
      ["Starting Population", summary.startingPopulation],
      ["Current Age", `${report.currentAge} Days`],
      ["Current Live Birds", report.currentLiveBirds],
      ["Report Period", `${formatDate(report.reportFrom)} - ${formatDate(report.reportTo)}`],
      ["Status", report.status],
    ];
    const kpiRows = [
      ["Starting Population", summary.startingPopulation],
      ["Total Mortality", summary.totalMortality],
      ["Total Thinning", summary.totalThinning],
      ["Total Depletion", summary.totalDepletion],
      ["Cumulative Mortality", formatPercent(summary.cumulativeMortality)],
      ["Cumulative Depletion", formatPercent(summary.cumulativeDepletion)],
      ["Livability", formatPercent(summary.livability)],
      ["Standard Depletion", formatPercent(summary.standardDepletion)],
      ["Variance from Standard", `${summary.variance >= 0 ? "+" : ""}${formatPercent(summary.variance)}`],
    ];
    const lineHeaders = [
      "Age",
      "Mort AM",
      "Mort PM",
      "Mort Total",
      "Thin AM",
      "Thin PM",
      "Thinning Total",
      "Depletion",
      "Cumulative",
      "Feed kg",
      "Feed g/b",
      "Water L",
      "Body wt",
      "Temp Min",
      "Temp Max",
    ];

    const rows = [
      ["Flock Information"],
      ...headerRows,
      [],
      ["Summary"],
      ...kpiRows,
      [],
      lineHeaders,
      ...report.lines.map(line => [
        line.age,
        line.mortalityAm,
        line.mortalityPm,
        line.mortalityTotal,
        line.thinningAm,
        line.thinningPm,
        line.thinningTotal,
        line.depletionTotal,
        line.cumulativeDepletion,
        line.feedKg,
        line.feedBird,
        line.waterL,
        line.bodyWeight,
        line.tempMin,
        line.tempMax,
      ]),
    ];

    const content = rows.map(row => row.map(cell => String(cell ?? "").replace(/\t/g, " ")).join("\t")).join("\n");
    downloadFile(`${getFileSafeName(report.cardNo || report.fcNo)}-report.xls`, content, "application/vnd.ms-excel;charset=utf-8");
  }

  if (viewBlocked) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-4" />
            You do not have permission to view this report.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-8 text-stone-950 dark:bg-background dark:text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <Breadcrumb
          SecondPreviewPageName="Broiler"
          SecondPreviewPageLink="/brd"
          FirstPreviewsPageName="Growing & Farm Condition"
          FirstPreviewsPageLink="/brd/fc"
          CurrentPageName="Report"
        />

        <div className="flex gap-2 print:hidden">
          <Button type="button" size="sm" variant="outline" onClick={() => window.print()} disabled={!report}>
            <Printer className="size-4" />
            Print
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={exportExcel} disabled={!report}>
            <Download className="size-4" />
            Export
          </Button>
        </div>
      </div>

      <section className="m-3 mt-5 rounded-lg border bg-white shadow-sm dark:bg-card print:shadow-none">
        <div className="flex flex-col gap-3 border-b bg-muted/30 px-5 py-4 lg:flex-row lg:items-end lg:justify-between print:hidden">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="size-4" />
              Growing &amp; Farm Condition Report
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Filter by age range for reusable report parameters.</p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="grid min-w-[240px] gap-1">
              <Label className="text-xs">Farm</Label>
              <SearchableCombobox
                items={farmOptions}
                value={effectiveSelectedFarmId}
                onValueChange={(value) => {
                  setSelectedFarmId(value);
                  setSelectedBuildingKey("");
                  setReportCardNo("");
                  setReport(null);
                  setError("");
                }}
                placeholder="Select farm..."
                showCode
                className="h-9 w-full"
              />
            </div>
            <div className="grid min-w-[240px] gap-1">
              <Label className="text-xs">Building</Label>
              <SearchableCombobox
                items={buildingOptions}
                value={selectedBuildingKey}
                onValueChange={(value) => {
                  setSelectedBuildingKey(value);
                  setReportCardNo("");
                  setReport(null);
                  setError("");
                }}
                placeholder={loadingBuildings ? "Loading buildings..." : "Select building..."}
                className="h-9 w-full"
              />
            </div>
            <div className="grid min-w-[280px] gap-1">
              <Label className="text-xs">Flock Card #</Label>
              <SearchableCombobox
                items={cardOptions}
                value={reportCardNo}
                onValueChange={(value) => setReportCardNo(value)}
                placeholder={loadingCards ? "Loading flock cards..." : "Select flock card..."}
                className="h-9 w-full"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="age-from" className="text-xs">Age from</Label>
              <Input id="age-from" type="number" min="0" max="45" value={ageFrom} onChange={event => setAgeFrom(event.target.value)} className="h-9 w-28" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="age-to" className="text-xs">Age to</Label>
              <Input id="age-to" type="number" min="0" max="45" value={ageTo} onChange={event => setAgeTo(event.target.value)} className="h-9 w-28" />
            </div>
            <Button type="button" size="sm" onClick={() => void loadReport(ageFrom, ageTo)}>
              <Search className="size-4" />
              Filter
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading report...
          </div>
        ) : error ? (
          <div className="p-5">
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="size-4" />
              {error}
            </div>
          </div>
        ) : report ? (
          <div className="space-y-5 p-5">
            <div>
              <div className="flex items-center gap-2 text-base font-semibold">
                <FileText className="size-4" />
                Flock Information
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {[
                  ["Farm", report.farmName || report.farmCode || "-"],
                  ["House", report.houseName || report.houseCode || "-"],
                  ["Flock / Batch No.", report.cardNo || report.fcNo || "-"],
                  ["Breed", report.breed || "-"],
                  ["Placement Date", formatDate(report.placementDate)],
                  ["Starting Population", formatNumber(report.startingPopulation)],
                  ["Current Age", `${report.currentAge} Days`],
                  ["Current Live Birds", formatNumber(report.currentLiveBirds)],
                  ["Report Period", `${formatDate(report.reportFrom)} - ${formatDate(report.reportTo)}`],
                  ["Status", report.status || "-"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border bg-background px-3 py-2">
                    <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
                    <div className="mt-1 font-semibold">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              {[
                ["Starting Population", formatNumber(summary.startingPopulation)],
                ["Total Mortality", formatNumber(summary.totalMortality)],
                ["Total Thinning", formatNumber(summary.totalThinning)],
                ["Total Depletion", formatNumber(summary.totalDepletion)],
                ["Cumulative Mortality", formatPercent(summary.cumulativeMortality)],
                ["Cumulative Depletion", formatPercent(summary.cumulativeDepletion)],
                ["Livability", formatPercent(summary.livability)],
                ["Standard Depletion", formatPercent(summary.standardDepletion)],
                ["Variance from Standard", `${summary.variance >= 0 ? "+" : ""}${formatPercent(summary.variance)}`],
              ].map(([label, value]) => (
                <div key={label} className={`rounded-md border px-3 py-2 ${label === "Variance from Standard" ? getKpiTone(summary.variance) : "bg-background"}`}>
                  <div className="text-xs font-medium uppercase opacity-80">{label}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-[1180px] w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    {["Age", "Mort AM", "Mort PM", "Mort Total", "Thin AM", "Thin PM", "Thinning", "Depletion", "Cumulative", "Feed kg", "Feed g/b", "Water L", "Body wt", "Temp", "Humidity"].map(header => (
                      <th key={header} className="px-3 py-2 text-left font-semibold">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.lines.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-3 py-8 text-center text-muted-foreground">
                        No daily report lines found.
                      </td>
                    </tr>
                  ) : report.lines.map(line => (
                    <tr key={line.id}>
                      <td className="px-3 py-2 font-semibold">{line.age}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.mortalityAm, 3)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.mortalityPm, 3)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.mortalityTotal, 3)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.thinningAm, 3)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.thinningPm, 3)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.thinningTotal, 3)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.depletionTotal, 3)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.cumulativeDepletion, 3)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.feedKg, 3)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.feedBird, 3)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.waterL, 3)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.bodyWeight, 3)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.tempMin, 1)} - {formatNumber(line.tempMax, 1)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(line.humidityMin, 1)} - {formatNumber(line.humidityMax, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
