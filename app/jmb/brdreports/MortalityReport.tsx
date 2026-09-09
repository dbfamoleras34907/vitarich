"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { getUserInfo, listBreederCycles, listBreederFarms, listFarmLocationLookup, type BreederCycle, type BreederFarm, type FarmLocationLookup } from "@/app/jmb/placement/new/api";
import {
  listMedicationReport, listMortalityReport, listRegradingReport, listVaccinationReport,
  type MedicationReportRow, type MortalityReportRow, type RegradingReportRow, type VaccinationReportRow,
} from "./api";

type ReportType = "mortality" | "feed" | "liveweight" | "uniformity" | "vaccination" | "medication" | "regrading";
type ChartRow = { date: string; male?: number; female?: number; total?: number; old?: number; next?: number; missed?: number; averageFeed?: number; standardFeed?: number };
type FeedDailyRow = {
  date: string; cycleNumber: number | null; ageWeek: number; totalPopulation: number; malePopulation: number; femalePopulation: number;
  standardFeed: number | null; maleFeedKg: number; femaleFeedKg: number; totalFeedKg: number;
  maleFeedGrams: number; femaleFeedGrams: number; totalFeedGrams: number; averageFeed: number;
};

const ALL = "__ALL__";
const REPORT_OPTIONS: Array<{ value: ReportType; label: string; scope: string }> = [
  { value: "mortality", label: "Mortality Report", scope: "per Farm / Building / Pen" },
  { value: "feed", label: "Feeds Consumption Report", scope: "per Building" },
  { value: "liveweight", label: "Average Liveweight Report", scope: "per Building" },
  { value: "uniformity", label: "Uniformity Report", scope: "per Building" },
  { value: "vaccination", label: "Vaccine Report", scope: "per Farm" },
  { value: "medication", label: "Medication Report", scope: "per Farm" },
  { value: "regrading", label: "Regrading Report", scope: "per Farm" },
];
const STANDARD_FEED_BY_WEEK: Record<number, number> = { 21: 118, 22: 121, 23: 124, 24: 127, 25: 130 };

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function number(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function formatNumber(value: number, decimals = 2) { return number(value).toLocaleString("en-PH", { maximumFractionDigits: decimals }); }
function formatFixed(value: number, decimals: number) { return number(value).toLocaleString("en-PH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }
function formatPercent(value: number) { return `${number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`; }
function rate(numerator: number, denominator: number) { return denominator > 0 ? (numerator / denominator) * 100 : 0; }
function label(code: string | null, name: string) { return code?.trim() && code.trim() !== name.trim() ? `${code} - ${name}` : name; }
function safeFilename(value: string) { return value.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "breeder-report"; }
function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US");
}
function ageWeek(placementDate: string, recordDate: string) {
  const start = new Date(`${placementDate}T00:00:00`); const end = new Date(`${recordDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
  return Math.ceil(days / 7);
}

function dailyFeedRows(rows: MortalityReportRow[]) {
  const dates = new Map<string, Omit<FeedDailyRow, "standardFeed" | "totalFeedKg" | "maleFeedGrams" | "femaleFeedGrams" | "totalFeedGrams" | "averageFeed">>();
  for (const row of rows) {
    const key = `${row.cycleNumber ?? "none"}:${row.recordDate}`;
    const current = dates.get(key) ?? { date: row.recordDate, cycleNumber: row.cycleNumber, ageWeek: 0, totalPopulation: 0, malePopulation: 0, femalePopulation: 0, maleFeedKg: 0, femaleFeedKg: 0 };
    current.ageWeek = Math.max(current.ageWeek, ageWeek(row.placementDate, row.recordDate));
    current.malePopulation += row.inventoryMale; current.femalePopulation += row.inventoryFemale;
    current.totalPopulation += row.inventoryMale + row.inventoryFemale;
    current.maleFeedKg += row.feedConsumptionMale; current.femaleFeedKg += row.feedConsumptionFemale;
    dates.set(key, current);
  }
  return [...dates.values()].sort((left, right) => left.date.localeCompare(right.date) || number(left.cycleNumber) - number(right.cycleNumber)).map((row): FeedDailyRow => {
    const totalFeedKg = row.maleFeedKg + row.femaleFeedKg; const maleFeedGrams = row.maleFeedKg * 1000;
    const femaleFeedGrams = row.femaleFeedKg * 1000; const totalFeedGrams = totalFeedKg * 1000;
    return { ...row, standardFeed: STANDARD_FEED_BY_WEEK[row.ageWeek] ?? null, totalFeedKg, maleFeedGrams, femaleFeedGrams, totalFeedGrams, averageFeed: row.totalPopulation > 0 ? totalFeedGrams / row.totalPopulation : 0 };
  });
}

function groupPerformance(rows: MortalityReportRow[], reportType: ReportType) {
  const groups = new Map<string, {
    key: string; date: string; farm: string; building: string; pen: string; cycleNumber: number | null; inventoryMale: number; inventoryFemale: number;
    male: number; female: number; maleWeighted: number; femaleWeighted: number; placements: Set<number>;
  }>();
  for (const row of rows) {
    const byDate = reportType === "liveweight";
    const byPen = reportType === "mortality";
    const key = [row.farmId, row.cycleNumber ?? "none", row.buildingId, byPen ? row.penId : "building", byDate ? row.recordDate : "period"].join(":");
    const current = groups.get(key) ?? {
      key, date: byDate ? row.recordDate : "", farm: row.farmName, building: row.buildingName, pen: byPen ? row.penName : "All pens", cycleNumber: row.cycleNumber,
      inventoryMale: 0, inventoryFemale: 0, male: 0, female: 0, maleWeighted: 0, femaleWeighted: 0, placements: new Set<number>(),
    };
    if (reportType === "mortality") {
      if (!current.placements.has(row.placementId)) {
        current.inventoryMale += row.inventoryMale; current.inventoryFemale += row.inventoryFemale; current.placements.add(row.placementId);
      }
      current.male += row.mortalityMale; current.female += row.mortalityFemale;
    } else if (reportType === "feed") {
      current.inventoryMale += row.inventoryMale; current.inventoryFemale += row.inventoryFemale;
      current.male += row.feedConsumptionMale; current.female += row.feedConsumptionFemale;
    } else {
      if (row.averageWeightMale > 0) { current.inventoryMale += row.inventoryMale; current.maleWeighted += row.averageWeightMale * row.inventoryMale; }
      if (row.averageWeightFemale > 0) { current.inventoryFemale += row.inventoryFemale; current.femaleWeighted += row.averageWeightFemale * row.inventoryFemale; }
    }
    groups.set(key, current);
  }
  return [...groups.values()].map((row) => reportType === "liveweight" ? {
    ...row,
    male: row.inventoryMale > 0 ? row.maleWeighted / row.inventoryMale : 0,
    female: row.inventoryFemale > 0 ? row.femaleWeighted / row.inventoryFemale : 0,
  } : row);
}

function trendPerformance(rows: MortalityReportRow[], type: ReportType): ChartRow[] {
  const dates = new Map<string, { male: number; female: number; maleInventory: number; femaleInventory: number; maleWeighted: number; femaleWeighted: number }>();
  for (const row of rows) {
    const current = dates.get(row.recordDate) ?? { male: 0, female: 0, maleInventory: 0, femaleInventory: 0, maleWeighted: 0, femaleWeighted: 0 };
    if (type === "mortality") { current.male += row.mortalityMale; current.female += row.mortalityFemale; }
    else if (type === "feed") { current.male += row.feedConsumptionMale; current.female += row.feedConsumptionFemale; }
    else {
      current.maleInventory += row.inventoryMale; current.femaleInventory += row.inventoryFemale;
      current.maleWeighted += row.averageWeightMale * row.inventoryMale; current.femaleWeighted += row.averageWeightFemale * row.inventoryFemale;
    }
    dates.set(row.recordDate, current);
  }
  return [...dates.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, row]) => ({
    date,
    male: type === "liveweight" ? (row.maleInventory ? row.maleWeighted / row.maleInventory : 0) : row.male,
    female: type === "liveweight" ? (row.femaleInventory ? row.femaleWeighted / row.femaleInventory : 0) : row.female,
    total: type === "liveweight" ? undefined : row.male + row.female,
  }));
}

function ReportChart({ data, type }: { data: ChartRow[]; type: ReportType }) {
  if (!data.length) return null;
  const regrading = type === "regrading"; const vaccination = type === "vaccination"; const feed = type === "feed";
  return <div className="h-[360px] min-w-0 rounded-lg border bg-background p-4">
    <h3 className="mb-4 text-center text-sm font-semibold">{type === "feed" ? "Feed Consumption in Grams" : `${REPORT_OPTIONS.find((option) => option.value === type)?.label} Trend`}</h3>
    <ResponsiveContainer width="100%" height="90%"><LineChart data={data} margin={{ left: 4, right: 16, top: 8, bottom: 18 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" angle={-35} textAnchor="end" height={60} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
      <Tooltip formatter={(value) => formatNumber(Number(value), type === "liveweight" ? 3 : 2)} /><Legend />
      {regrading ? <><Line type="monotone" dataKey="old" name="Previous Quantity" stroke="#2563eb" strokeWidth={2} /><Line type="monotone" dataKey="next" name="New Quantity" stroke="#ea580c" strokeWidth={2} /></> : null}
      {vaccination ? <><Line type="monotone" dataKey="total" name="Vaccinated Birds" stroke="#15803d" strokeWidth={2} /><Line type="monotone" dataKey="missed" name="Missed Birds" stroke="#dc2626" strokeWidth={2} /></> : null}
      {feed ? <><Line type="monotone" dataKey="averageFeed" name="Ave Feeds (g/bird)" stroke="#ea580c" strokeWidth={2.5} connectNulls /><Line type="monotone" dataKey="standardFeed" name="Std Feed (g/bird)" stroke="#0369a1" strokeWidth={2.5} connectNulls /></> : null}
      {!regrading && !vaccination && !feed ? <><Line type="monotone" dataKey="male" name="Male" stroke="#2563eb" strokeWidth={2} /><Line type="monotone" dataKey="female" name="Female" stroke="#db2777" strokeWidth={2} />{type !== "liveweight" ? <Line type="monotone" dataKey="total" name="Total" stroke="#15803d" strokeWidth={2} /> : null}</> : null}
    </LineChart></ResponsiveContainer>
  </div>;
}

export default function BreederReports() {
  const router = useRouter(); const reportRef = useRef<HTMLDivElement>(null); const { setValue } = useGlobalContext();
  const [reportType, setReportType] = useState<ReportType>("mortality");
  const [farms, setFarms] = useState<BreederFarm[]>([]); const [locations, setLocations] = useState<FarmLocationLookup[]>([]); const [cycles, setCycles] = useState<BreederCycle[]>([]);
  const [farmId, setFarmId] = useState(""); const [cycleNumber, setCycleNumber] = useState(ALL); const [buildingId, setBuildingId] = useState(ALL); const [penId, setPenId] = useState(ALL);
  const [dateFrom, setDateFrom] = useState(() => { const date = new Date(); date.setDate(1); return localDate(date); }); const [dateTo, setDateTo] = useState(() => localDate(new Date()));
  const [performanceRows, setPerformanceRows] = useState<MortalityReportRow[]>([]); const [vaccinationRows, setVaccinationRows] = useState<VaccinationReportRow[]>([]);
  const [medicationRows, setMedicationRows] = useState<MedicationReportRow[]>([]); const [regradingRows, setRegradingRows] = useState<RegradingReportRow[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(true); const [loading, setLoading] = useState(false); const [generated, setGenerated] = useState(false); const [error, setError] = useState("");

  useEffect(() => { refreshSessionx(router); }, [router]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([listBreederFarms(), listFarmLocationLookup(), listBreederCycles(), getUserInfo().catch(() => [])]).then(([farmRows, locationRows, cycleRows, defaults]) => {
      if (cancelled) return; setFarms(farmRows); setLocations(locationRows); setCycles(cycleRows);
      const initial = farmRows.find((farm) => Number(farm.id) === Number(defaults[0]?.id)) ?? farmRows[0]; if (initial) setFarmId(String(initial.id));
    }).catch((loadError) => { console.error(loadError); if (!cancelled) setError("Unable to load breeder report filters."); }).finally(() => { if (!cancelled) setLoadingSetup(false); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { setValue("loading_g", loading || loadingSetup); }, [loading, loadingSetup, setValue]);

  const selectedReport = REPORT_OPTIONS.find((option) => option.value === reportType) ?? REPORT_OPTIONS[0];
  const usesLocationFilters = !["vaccination", "medication"].includes(reportType);
  const farmLocations = useMemo(() => locations.filter((location) => String(location.farm_id) === farmId), [farmId, locations]);
  const farmOptions = useMemo(() => farms.map((farm) => ({ code: String(farm.id), name: label(farm.code, farm.name) })), [farms]);
  const buildingOptions = useMemo(() => { const unique = new Map<number, FarmLocationLookup>(); farmLocations.forEach((row) => unique.set(row.building_id, row)); return [{ code: ALL, name: "All buildings" }, ...[...unique.values()].map((row) => ({ code: String(row.building_id), name: label(row.building_code, row.building_name) }))]; }, [farmLocations]);
  const penOptions = useMemo(() => { const filtered = buildingId === ALL ? farmLocations : farmLocations.filter((row) => String(row.building_id) === buildingId); const unique = new Map<number, FarmLocationLookup>(); filtered.forEach((row) => unique.set(row.pen_id, row)); return [{ code: ALL, name: "All pens" }, ...[...unique.values()].map((row) => ({ code: String(row.pen_id), name: buildingId === ALL ? `${row.building_name} / ${row.pen_name}` : row.pen_name }))]; }, [buildingId, farmLocations]);
  const cycleOptions = useMemo(() => {
    const numbers = [...new Set(cycles.filter((cycle) => String(cycle.farm_id) === farmId && (buildingId === ALL || String(cycle.building_id) === buildingId) && (penId === ALL || String(cycle.pen_id) === penId)).map((cycle) => Number(cycle.cycle_no)))].sort((left, right) => right - left);
    return [{ code: ALL, name: "All cycles" }, ...numbers.map((value) => ({ code: String(value), name: `Cycle ${value}` }))];
  }, [buildingId, cycles, farmId, penId]);
  const groupedPerformance = useMemo(() => groupPerformance(performanceRows, reportType), [performanceRows, reportType]);
  const feedRows = useMemo(() => dailyFeedRows(performanceRows), [performanceRows]);
  const chartData = useMemo((): ChartRow[] => {
    if (reportType === "feed") return feedRows.map((row) => ({ date: formatDate(row.date), averageFeed: row.averageFeed, standardFeed: row.standardFeed ?? undefined }));
    if (["mortality", "liveweight"].includes(reportType)) return trendPerformance(performanceRows, reportType);
    if (reportType === "regrading") { const dates = new Map<string, { old: number; next: number }>(); regradingRows.forEach((row) => { const current = dates.get(row.recordDate) ?? { old: 0, next: 0 }; current.old += row.maleOld + row.femaleOld; current.next += row.maleNew + row.femaleNew; dates.set(row.recordDate, current); }); return [...dates.entries()].map(([date, values]) => ({ date, ...values })); }
    if (reportType === "vaccination") {
      const dates = new Map<string, { total: number; missed: number }>();
      vaccinationRows.forEach((row) => { const current = dates.get(row.recordDate) ?? { total: 0, missed: 0 }; current.total += row.birdsVaccinated; current.missed += row.birdsMissed; dates.set(row.recordDate, current); });
      return [...dates.entries()].map(([date, values]) => ({ date, ...values }));
    }
    return [];
  }, [feedRows, performanceRows, regradingRows, reportType, vaccinationRows]);
  const totalRows = reportType === "vaccination" ? vaccinationRows.length : reportType === "medication" ? medicationRows.length : reportType === "regrading" ? regradingRows.length : performanceRows.length;
  const selectedFarm = farms.find((farm) => String(farm.id) === farmId);

  function resetReport() { setPerformanceRows([]); setVaccinationRows([]); setMedicationRows([]); setRegradingRows([]); setGenerated(false); setError(""); }
  async function generateReport() {
    if (!farmId) return void toast.error("Select a breeder farm."); if (!dateFrom || !dateTo || dateFrom > dateTo) return void toast.error("Enter a valid report date range.");
    if (reportType === "feed" && buildingId === ALL) return void toast.error("Select one building for the Feeds Consumption Report.");
    setLoading(true); setError("");
    const filters = { farmId: Number(farmId), cycleNumber: cycleNumber === ALL ? null : Number(cycleNumber), buildingId: usesLocationFilters && buildingId !== ALL ? Number(buildingId) : null, penId: usesLocationFilters && penId !== ALL ? Number(penId) : null, dateFrom, dateTo };
    try {
      resetReport();
      if (["mortality", "feed", "liveweight"].includes(reportType)) setPerformanceRows(await listMortalityReport(filters));
      else if (reportType === "vaccination") setVaccinationRows(await listVaccinationReport(filters));
      else if (reportType === "medication") setMedicationRows(await listMedicationReport(filters));
      else if (reportType === "regrading") setRegradingRows(await listRegradingReport(filters));
      setGenerated(true);
    } catch (loadError) { console.error(loadError); setGenerated(true); setError(loadError instanceof Error ? loadError.message : "Unable to generate report."); } finally { setLoading(false); }
  }
  function printableDocument() { const content = reportRef.current?.innerHTML ?? ""; return `<!doctype html><html><head><meta charset="utf-8"><title>${selectedReport.label}</title><style>body{font-family:Arial,sans-serif;color:#111827;margin:24px}h2{font-size:20px;margin-bottom:4px}.report-context{font-size:12px;color:#4b5563;margin-bottom:16px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #d1d5db;padding:5px 6px;text-align:left}th{background:#f3f4f6}svg{max-width:100%}@media print{body{margin:10mm}button{display:none}}</style></head><body><h2>${selectedReport.label} ${selectedReport.scope}</h2><div class="report-context">${selectedFarm?.name ?? ""} | Cycle ${cycleNumber === ALL ? "All" : cycleNumber} | ${dateFrom} to ${dateTo}</div>${content}</body></html>`; }
  function exportExcel() { const url = URL.createObjectURL(new Blob([printableDocument()], { type: "application/vnd.ms-excel;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${safeFilename(`${selectedReport.label}-${selectedFarm?.code || "farm"}-${dateFrom}-${dateTo}`)}.xls`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); toast.success("Report downloaded."); }
  function printReport() { const popup = window.open("", "_blank", "noopener,noreferrer"); if (!popup) return void toast.error("Allow pop-ups to print or save as PDF."); popup.document.open(); popup.document.write(printableDocument()); popup.document.close(); popup.focus(); popup.print(); }

  return <main className="min-h-[calc(100vh-4rem)] pb-8 text-stone-950 dark:bg-background dark:text-foreground">
    <div className="mt-4 px-4"><Breadcrumb SecondPreviewPageName="Breeder" CurrentPageName="Breeder Reports" /></div>
    <section className="m-3 mt-6 overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
      <div className="border-b bg-muted/30 p-5">
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div><label className="mb-2 block border-b border-emerald-600 pb-1 text-sm font-semibold">Select Report</label><Select value={reportType} onValueChange={(value) => { setReportType(value as ReportType); resetReport(); }}><SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger><SelectContent>{REPORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}><span className="font-medium">{option.label}</span><span className="ml-1 text-muted-foreground">— {option.scope}</span></SelectItem>)}</SelectContent></Select></div>
            <div><label className="mb-2 block border-b border-emerald-600 pb-1 text-sm font-semibold">Breeder Farm</label><SearchableCombobox items={farmOptions} value={farmId} onValueChange={(value) => { setFarmId(value); setCycleNumber(ALL); setBuildingId(ALL); setPenId(ALL); resetReport(); }} placeholder="Select breeder farm..." className="w-full" /></div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div><label className="mb-2 block text-sm font-semibold">Cycle #</label><SearchableCombobox items={cycleOptions} value={cycleNumber} onValueChange={(value) => { setCycleNumber(value); resetReport(); }} className="w-full" /></div>
            {usesLocationFilters ? <><div><label className="mb-2 block text-sm font-semibold">Building</label><SearchableCombobox items={buildingOptions} value={buildingId} onValueChange={(value) => { setBuildingId(value); setCycleNumber(ALL); setPenId(ALL); resetReport(); }} className="w-full" /></div><div><label className="mb-2 block text-sm font-semibold">Pen</label><SearchableCombobox items={penOptions} value={penId} onValueChange={(value) => { setPenId(value); setCycleNumber(ALL); resetReport(); }} className="w-full" /></div></> : <div className="md:col-span-2 flex items-end"><div className="w-full rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">This report is summarized per farm. Building and pen coverage remains visible in the result.</div></div>}
          </div>

          <div className="grid grid-cols-3 items-end gap-4">
            <div><label className="mb-2 block text-sm font-semibold">Date From</label><Input type="date" value={dateFrom} max={dateTo} onChange={(event) => { setDateFrom(event.target.value); resetReport(); }} /></div>
            <div><label className="mb-2 block text-sm font-semibold">Date To</label><Input type="date" value={dateTo} min={dateFrom} onChange={(event) => { setDateTo(event.target.value); resetReport(); }} /></div>
            <Button className="w-full whitespace-nowrap" onClick={() => void generateReport()} disabled={loading || loadingSetup || !farmId}>{loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{loading ? "Generating..." : "Generate Report"}</Button>
          </div>
        </div>
      </div>
      {error ? <div className="m-5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}
      {generated && !error ? <div className="p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{selectedReport.label}</h2><p className="text-sm text-muted-foreground">{selectedReport.scope} · Cycle {cycleNumber === ALL ? "All" : cycleNumber} · {dateFrom} to {dateTo}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={exportExcel} disabled={!totalRows}><Download className="size-4" /> Excel</Button><Button size="sm" variant="outline" onClick={printReport} disabled={!totalRows}><FileText className="size-4" /> Print / PDF</Button></div></div>
        {reportType === "uniformity" ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:bg-amber-950/20"><h3 className="font-semibold">Uniformity data is not recorded yet</h3><p className="mt-2 max-w-3xl text-sm text-muted-foreground">This report is available in the selector, but an accurate uniformity percentage requires individual sampled-bird weights or stored Light, Standard, and Heavy bird counts. Average body weight alone cannot calculate weight distribution. Once those fields are captured, this page can show the ±10% uniformity calculation and trend.</p></div> : <div ref={reportRef} className="space-y-5"><ReportChart data={chartData} type={reportType} />{["mortality", "liveweight"].includes(reportType) ? <PerformanceTable type={reportType} rows={groupedPerformance} /> : null}{reportType === "feed" ? <FeedConsumptionTable rows={feedRows} /> : null}{reportType === "vaccination" ? <VaccinationTable rows={vaccinationRows} /> : null}{reportType === "medication" ? <MedicationTable rows={medicationRows} /> : null}{reportType === "regrading" ? <RegradingTable rows={regradingRows} /> : null}</div>}
      </div> : !error ? <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-8 text-center"><BarChart3 className="size-10 text-muted-foreground/50" /><p className="font-medium">Choose a report and generate it.</p><p className="text-sm text-muted-foreground">All breeder reports are available from the Select Report dropdown above.</p></div> : null}
    </section>
  </main>;
}

type PerformanceGroup = ReturnType<typeof groupPerformance>[number];
function FeedConsumptionTable({ rows }: { rows: FeedDailyRow[] }) {
  return <><div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 dark:bg-sky-950/20 dark:text-sky-100">Standard feed is configured from the supplied schedule: Week 21 = 118, Week 22 = 121, Week 23 = 124, Week 24 = 127, and Week 25 = 130 g/bird. Other weeks display “—” until their standard is configured.</div><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Cycle #</TableHead><TableHead className="text-right">Age (Week)</TableHead><TableHead className="text-right">Total Pop</TableHead><TableHead className="text-right">Male Pop</TableHead><TableHead className="text-right">Female Pop</TableHead><TableHead className="text-right">Std Feed (g/bird)</TableHead><TableHead className="text-right">Male Feed (kg)</TableHead><TableHead className="text-right">Female Feed (kg)</TableHead><TableHead className="text-right">Total Feed (kg)</TableHead><TableHead className="text-right">Male Feed (g)</TableHead><TableHead className="text-right">Female Feed (g)</TableHead><TableHead className="text-right">Total Feed (g)</TableHead><TableHead className="text-right">Ave Feeds (g/bird)</TableHead></TableRow></TableHeader><TableBody>{rows.length ? rows.map((row) => <TableRow key={`${row.cycleNumber ?? "none"}:${row.date}`}><TableCell>{formatDate(row.date)}</TableCell><TableCell className="text-right">{row.cycleNumber ?? "-"}</TableCell><TableCell className="text-right">{row.ageWeek}</TableCell><TableCell className="text-right">{formatNumber(row.totalPopulation, 0)}</TableCell><TableCell className="text-right">{formatNumber(row.malePopulation, 0)}</TableCell><TableCell className="text-right">{formatNumber(row.femalePopulation, 0)}</TableCell><TableCell className="text-right">{row.standardFeed == null ? "—" : formatFixed(row.standardFeed, 2)}</TableCell><TableCell className="text-right">{formatFixed(row.maleFeedKg, 2)}</TableCell><TableCell className="text-right">{formatFixed(row.femaleFeedKg, 2)}</TableCell><TableCell className="text-right font-semibold">{formatFixed(row.totalFeedKg, 2)}</TableCell><TableCell className="text-right">{formatNumber(row.maleFeedGrams, 0)}</TableCell><TableCell className="text-right">{formatNumber(row.femaleFeedGrams, 0)}</TableCell><TableCell className="text-right">{formatNumber(row.totalFeedGrams, 0)}</TableCell><TableCell className="text-right font-semibold">{formatFixed(row.averageFeed, 2)}</TableCell></TableRow>) : <EmptyRow columns={14} />}</TableBody></Table></>;
}
function PerformanceTable({ type, rows }: { type: ReportType; rows: PerformanceGroup[] }) {
  const totalMale = rows.reduce((sum, row) => sum + row.male, 0); const totalFemale = rows.reduce((sum, row) => sum + row.female, 0);
  return <Table><TableHeader><TableRow>{type === "liveweight" ? <TableHead>Date</TableHead> : null}<TableHead>Farm</TableHead><TableHead className="text-right">Cycle #</TableHead><TableHead>Building</TableHead>{type === "mortality" ? <TableHead>Pen</TableHead> : null}<TableHead className="text-right">{type === "mortality" ? "Opening Inventory" : type === "feed" ? "Bird-Days" : "Male Birds"}</TableHead><TableHead className="text-right">Male {type === "feed" ? "Feed (kg)" : type === "liveweight" ? "Avg Weight" : "Mortality"}</TableHead><TableHead className="text-right">Female {type === "feed" ? "Feed (kg)" : type === "liveweight" ? "Avg Weight" : "Mortality"}</TableHead><TableHead className="text-right">{type === "liveweight" ? "Combined Avg" : "Total"}</TableHead><TableHead className="text-right">{type === "mortality" ? "Mortality Rate" : type === "feed" ? "kg / Bird-Day" : "Female Birds"}</TableHead></TableRow></TableHeader><TableBody>{rows.length ? rows.map((row) => { const inventory = row.inventoryMale + row.inventoryFemale; const total = row.male + row.female; const combinedWeight = inventory ? ((row.male * row.inventoryMale) + (row.female * row.inventoryFemale)) / inventory : 0; return <TableRow key={row.key}>{type === "liveweight" ? <TableCell>{row.date}</TableCell> : null}<TableCell>{row.farm}</TableCell><TableCell className="text-right">{row.cycleNumber ?? "-"}</TableCell><TableCell>{row.building}</TableCell>{type === "mortality" ? <TableCell>{row.pen}</TableCell> : null}<TableCell className="text-right">{formatNumber(type === "liveweight" ? row.inventoryMale : inventory)}</TableCell><TableCell className="text-right">{formatNumber(row.male, type === "liveweight" ? 3 : 2)}</TableCell><TableCell className="text-right">{formatNumber(row.female, type === "liveweight" ? 3 : 2)}</TableCell><TableCell className="text-right font-semibold">{formatNumber(type === "liveweight" ? combinedWeight : total, type === "liveweight" ? 3 : 2)}</TableCell><TableCell className="text-right">{type === "mortality" ? formatPercent(rate(total, inventory)) : type === "feed" ? formatNumber(inventory ? total / inventory : 0, 4) : formatNumber(row.inventoryFemale)}</TableCell></TableRow>; }) : <EmptyRow columns={type === "mortality" ? 9 : type === "liveweight" ? 9 : 8} />}</TableBody>{rows.length && type !== "liveweight" ? <TableFooter><TableRow><TableCell colSpan={type === "mortality" ? 5 : 4} className="text-right uppercase">Total</TableCell><TableCell /><TableCell className="text-right">{formatNumber(totalMale)}</TableCell><TableCell className="text-right">{formatNumber(totalFemale)}</TableCell><TableCell className="text-right">{formatNumber(totalMale + totalFemale)}</TableCell><TableCell /></TableRow></TableFooter> : null}</Table>;
}
function VaccinationTable({ rows }: { rows: VaccinationReportRow[] }) {
  return <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Document</TableHead><TableHead>Farm / Coverage</TableHead><TableHead className="text-right">Cycle #</TableHead><TableHead>Vaccine</TableHead><TableHead>Disease Target</TableHead><TableHead>Dosage / Route</TableHead><TableHead className="text-right">Before</TableHead><TableHead className="text-right">Vaccinated</TableHead><TableHead className="text-right">Missed</TableHead><TableHead>Batch / Expiry</TableHead><TableHead>Next Dose</TableHead></TableRow></TableHeader><TableBody>{rows.length ? rows.map((row) => <TableRow key={row.id}><TableCell>{row.recordDate}</TableCell><TableCell>{row.documentNo}</TableCell><TableCell><div>{row.farmName}</div><div className="text-xs text-muted-foreground">{row.scope}: {row.targetNames || row.buildingName || "Entire farm"}</div></TableCell><TableCell className="text-right">{row.cycleNumber ?? "-"}</TableCell><TableCell>{row.vaccine}</TableCell><TableCell>{row.diseaseTarget}</TableCell><TableCell>{formatNumber(row.dosage)} {row.unit} · {row.route}</TableCell><TableCell className="text-right">{formatNumber(row.birdsBefore)}</TableCell><TableCell className="text-right">{formatNumber(row.birdsVaccinated)}</TableCell><TableCell className="text-right">{formatNumber(row.birdsMissed)}</TableCell><TableCell>{row.batchNumber}<div className="text-xs text-muted-foreground">{row.expiryDate}</div></TableCell><TableCell>{row.nextDoseDate || "-"}</TableCell></TableRow>) : <EmptyRow columns={12} />}</TableBody></Table>;
}
function MedicationTable({ rows }: { rows: MedicationReportRow[] }) {
  return <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Document</TableHead><TableHead>Farm / Coverage</TableHead><TableHead className="text-right">Cycle #</TableHead><TableHead>Medication</TableHead><TableHead>Indication</TableHead><TableHead>Dosage / Route</TableHead><TableHead className="text-right">Treatment Days</TableHead><TableHead>End Date</TableHead><TableHead>Prescribed By</TableHead><TableHead>Administered By</TableHead></TableRow></TableHeader><TableBody>{rows.length ? rows.map((row) => <TableRow key={row.id}><TableCell>{row.recordDate}</TableCell><TableCell>{row.documentNo}</TableCell><TableCell><div>{row.farmName}</div><div className="text-xs text-muted-foreground">{row.scope}: {row.targetNames || row.buildingName || "Entire farm"}</div></TableCell><TableCell className="text-right">{row.cycleNumber ?? "-"}</TableCell><TableCell>{row.medication}<div className="text-xs text-muted-foreground">{row.medicationType}</div></TableCell><TableCell>{row.indication}</TableCell><TableCell>{formatNumber(row.dosage)} {row.unit} · {row.route}</TableCell><TableCell className="text-right">{formatNumber(row.treatmentDays)}</TableCell><TableCell>{row.treatmentEndDate || "-"}</TableCell><TableCell>{row.prescribedBy || "-"}</TableCell><TableCell>{row.administeredBy || "-"}</TableCell></TableRow>) : <EmptyRow columns={11} />}</TableBody></Table>;
}
function RegradingTable({ rows }: { rows: RegradingReportRow[] }) {
  return <><div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:bg-blue-950/20 dark:text-blue-100">The trend uses recorded previous and new male/female quantities. The screenshot’s Lower Limit, Upper Limit, Light, Standard, Heavy, and Action Taken columns can be added after those values are captured in the regrading form.</div><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Farm</TableHead><TableHead className="text-right">Cycle #</TableHead><TableHead>Building</TableHead><TableHead>Pen</TableHead><TableHead className="text-right">Male Previous</TableHead><TableHead className="text-right">Male New</TableHead><TableHead className="text-right">Female Previous</TableHead><TableHead className="text-right">Female New</TableHead><TableHead className="text-right">Previous Total</TableHead><TableHead className="text-right">New Total</TableHead><TableHead className="text-right">Variance</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader><TableBody>{rows.length ? rows.map((row) => { const oldTotal = row.maleOld + row.femaleOld; const newTotal = row.maleNew + row.femaleNew; return <TableRow key={row.id}><TableCell>{row.recordDate}</TableCell><TableCell>{row.farmName}</TableCell><TableCell className="text-right">{row.cycleNumber ?? "-"}</TableCell><TableCell>{row.buildingName}</TableCell><TableCell>{row.penName}</TableCell><TableCell className="text-right">{formatNumber(row.maleOld)}</TableCell><TableCell className="text-right">{formatNumber(row.maleNew)}</TableCell><TableCell className="text-right">{formatNumber(row.femaleOld)}</TableCell><TableCell className="text-right">{formatNumber(row.femaleNew)}</TableCell><TableCell className="text-right">{formatNumber(oldTotal)}</TableCell><TableCell className="text-right">{formatNumber(newTotal)}</TableCell><TableCell className="text-right font-semibold">{formatNumber(newTotal - oldTotal)}</TableCell><TableCell>{row.remarks || "-"}</TableCell></TableRow>; }) : <EmptyRow columns={13} />}</TableBody></Table></>;
}
function EmptyRow({ columns }: { columns: number }) { return <TableRow><TableCell colSpan={columns} className="h-24 text-center text-muted-foreground">No records found for the selected farm and date range.</TableCell></TableRow>; }
