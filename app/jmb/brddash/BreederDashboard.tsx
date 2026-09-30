"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Bird, CalendarDays, Egg, HeartCrack, House, Percent, Scale, Wheat } from "lucide-react";

import Breadcrumb from "@/lib/Breadcrumb";
import { DatePickerWithRange } from "@/lib/DatePickerWithRange";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getBreederDashboard,
  listBreederDashboardFarms,
  type BreederDashboardFarm,
  type BreederDashboardSummary,
} from "./api";
import BreederTrends from "./BreederTrends";
import BreederBodyWeight from "./BreederBodyWeight";
import { breederFeedStandard } from "@/lib/data/queries/breederFeedStandard";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { breederAgeDays } from "./api";
import { COBB_EGG_PRODUCTION_LABEL, COBB_EGG_PRODUCTION_SOURCE } from "@/app/jmb/lib/data/queries/cobb500BreederEggProduction";
import type { EggRangeBuilding } from "@/app/jmb/lib/breederWeeklyEggProduction";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const showEggNumber = (value: number | null | undefined, suffix = "", whole = false) =>
  value == null ? "N/A" : `${(whole ? integer : decimal).format(value)}${suffix}`;

function EggRangeDetails({ rows, metric }: { rows: EggRangeBuilding[]; metric: "tep" | "hen" | "recovery" }) {
  return rows.length ? <div className="max-h-40 space-y-2 overflow-y-auto pr-1 text-xs">
    {rows.map(row => <div key={row.key} className="space-y-0.5 border-t pt-1">
      <p className="font-semibold text-foreground">{row.buildingName}</p>
      <p>{row.from} – {row.to} · {row.recordedDays}/{row.daysInRange} production days recorded{row.partial ? " (partial)" : ""}</p>
      <p className="font-medium text-foreground">{metric === "tep"
        ? `Actual ${showEggNumber(row.totalEggs, " eggs", true)} / Std ${showEggNumber(row.standardEggs, " eggs", true)}`
        : metric === "hen" ? `Actual ${showEggNumber(row.eggsPerHen)} / Std ${showEggNumber(row.standardEggsPerHen)} eggs/hen`
          : `${showEggNumber(row.hatchRecovery, "%")} · ${showEggNumber(row.goodEggs, " good eggs", true)}`}</p>
      {row.issue && <p className="text-amber-700 dark:text-amber-400">{row.issue}</p>}
    </div>)}
  </div> : <p>No egg production recorded in the selected date range.</p>;
}

function StatCard({
  title,
  value,
  helper,
  icon,
  accent,
  className,
}: {
  title: string;
  value: string;
  helper: React.ReactNode;
  icon: React.ReactNode;
  accent: string;
  className?: string;
}) {
  const titleColors: Record<string, string> = {
    "text-violet-500": "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
    "text-cyan-600": "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
    "text-rose-500": "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
    "text-blue-500": "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    "text-amber-500": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    "text-emerald-500": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    "text-teal-500": "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
  };
  return (
    <Card className={`overflow-hidden gap-0 py-0 ${accent} ${className ?? ""}`}>
      <CardContent className="p-0">
        <div className="h-1 w-full bg-current opacity-80" />
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 space-y-2">
            <p className={`inline-block rounded-md px-3 py-1.5 text-xs font-bold uppercase ${titleColors[accent] ?? "bg-muted text-foreground"}`}>{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            <div className="text-sm text-muted-foreground">{helper}</div>
          </div>
          <div className="shrink-0 rounded-md bg-current/10 p-2">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BreederDashboard() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -60),
    to: new Date(),
  });
  const { getValue } = useGlobalContext();
  const defaultFarmReference = getValue("DefaultFarmId") ?? getValue("UserInfoAuthSession")?.[0]?.default_farm;
  const defaultFarmRow = getValue("getFarmDB")?.find((row: { id?: number | string; code?: string }) =>
    String(row.id) === String(defaultFarmReference) || String(row.code) === String(defaultFarmReference));
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [farms, setFarms] = useState<BreederDashboardFarm[]>([]);
  const defaultFarmId = String(defaultFarmRow?.id ?? defaultFarmReference ?? "");
  const farmId = selectedFarmId ?? (farms.some(farm => String(farm.id) === defaultFarmId)
    ? defaultFarmId
    : String(farms[0]?.id ?? ""));
  const [summary, setSummary] = useState<BreederDashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filter = useMemo(() => {
    const selectedId = Number(farmId);
    if (!date?.from || !date?.to || !Number.isInteger(selectedId) || selectedId <= 0) return null;
    return {
      from: format(date.from, "yyyy-MM-dd"),
      to: format(date.to, "yyyy-MM-dd"),
      farmId: selectedId,
    };
  }, [date, farmId]);

  useEffect(() => {
    let active = true;
    void listBreederDashboardFarms()
      .then((rows) => {
        if (active) setFarms(rows);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load breeder farms.");
      });

    return () => {
      active = false;
    };
  }, []);

  const farmOptions = useMemo(
    () => farms.map((farm) => ({ code: String(farm.id), name: farm.name })),
    [farms],
  );

  useEffect(() => {
    if (!filter) return;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return null;
        setLoading(true);
        setSummary(null);
        setError("");
        return getBreederDashboard(filter);
      })
      .then((data) => {
        if (active && data) setSummary(data);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load breeder dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filter]);

  const totals = summary?.totals;
  const eggRange = summary?.eggRangeProduction;
  const eggRangeTotals = eggRange?.totals;
  const eggStandardLink = <a className="underline underline-offset-2" href={COBB_EGG_PRODUCTION_SOURCE} target="_blank" rel="noreferrer">{COBB_EGG_PRODUCTION_LABEL}</a>;
  const activePlacements = summary?.activePlacements ?? [];
  const agePlacement = activePlacements[0];
  const ageOnCalendarDate = (date: Date) => {
    if (!agePlacement) return undefined;
    const days = breederAgeDays(agePlacement.placementDate, format(date, "yyyy-MM-dd"));
    return days == null ? undefined : `${Math.floor(days / 7)}.${days % 7}`;
  };
  const latestFlockAge = summary?.latestFlockAge;
  const latestFeed = summary?.latestFeed;
  const feedStandard = breederFeedStandard(latestFeed?.ageDays ?? null);
  const population = (totals?.populationMale ?? 0) + (totals?.populationFemale ?? 0);
  const mortality = (totals?.mortalityMale ?? 0) + (totals?.mortalityFemale ?? 0);
  const depletion = mortality + (totals?.soldCulls ?? 0) + (totals?.transferOut ?? 0)
    + (totals?.kitchen ?? 0) + (totals?.condemn ?? 0);
  const depletionRows = [
    { label: "Mortality / Dead", value: mortality },
    { label: "Growing Mortality (0.1–25.0)", value: totals?.growingMortality ?? 0, period: "growing" as const },
    { label: "Laying Mortality (25.1–65.0)", value: totals?.layingMortality ?? 0, period: "laying" as const },
    { label: "Other Age Mortality", value: totals?.otherAgeMortality ?? 0 },
    { label: "Sold / Culls", value: totals?.soldCulls ?? 0 },
    { label: "Transfer Out", value: totals?.transferOut ?? 0 },
    { label: "Kitchen", value: totals?.kitchen ?? 0 },
    { label: "Condemn", value: totals?.condemn ?? 0 },
    { label: "Total Depletion", value: depletion },
  ];
  const combinedAlw = population
    ? (((totals?.alwMale ?? 0) * (totals?.populationMale ?? 0)) +
        ((totals?.alwFemale ?? 0) * (totals?.populationFemale ?? 0))) /
      population
    : 0;

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-3">
          <Breadcrumb SecondPreviewPageName="Breeder" CurrentPageName="Breeder Dashboard" />
          <Separator />
        </div>
          <Card className="sticky top-0 z-40 bg-background p-4 shadow-sm print:static">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-60">
                <SearchableCombobox
                  label="Farm"
                  items={farmOptions}
                  value={farmId}
                  onValueChange={setSelectedFarmId}
                  placeholder="Select breeder farm"
                  className="w-full"
                />
              </div>
              <DatePickerWithRange label="Production Date Range" date={date} setDate={setDate}
                dayAnnotation={agePlacement ? ageOnCalendarDate : undefined}
                annotationHelp={agePlacement
                  ? `Age in Weeks.Day appears below each date. Placement day is 0.1. ${agePlacement.farmName} / ${agePlacement.buildingName} / ${agePlacement.penName}; placed ${agePlacement.placementDate}.`
                  : "No active placement is available for the selected farm and end date."}
              />
            </div>
          </Card>

        {error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading && !summary ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }, (_, index) => <Skeleton key={index} className="h-48 w-full" />)}
          </div>
        ) : (
          <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy={loading}>
            <StatCard
            title="Population"
            value={loading ? "Loading..." : integer.format(population)}
            helper={<div className="space-y-2">
              <p>Growing Population: {integer.format(population)} (live males + females)</p>
              <p>Male {integer.format(totals?.populationMale ?? 0)} / Female {integer.format(totals?.populationFemale ?? 0)}</p>
              <p>Hen House Population: {integer.format(totals?.populationFemale ?? 0)} live females.</p>
              <p>Hen House per building as of {filter?.to}:</p>
              {!loading && summary?.buildings.length ? (
                <dl className="max-h-48 space-y-2 overflow-y-auto">
                  {summary.buildings.map(row => (
                    <div key={row.key} className="flex justify-between gap-4 border-t pt-2">
                      <dt>{row.buildingName}</dt>
                      <dd className="font-semibold tabular-nums text-foreground">{integer.format(row.populationFemale)}</dd>
                    </div>
                  ))}
                </dl>
              ) : !loading ? <p>No population records for this farm.</p> : null}
            </div>}
            icon={<Bird className="size-6 text-violet-700" />}
            accent="text-violet-500"
          />
            <StatCard
            title="Latest Flock Age"
            value={loading ? "Loading..." : latestFlockAge
              ? `${Math.floor(latestFlockAge.ageDays / 7)}.${latestFlockAge.ageDays % 7}` : "N/A"}
            helper={latestFlockAge ? <div className="space-y-1">
              <p>Weeks.Day as of {filter?.to}. Placement day is 0.1.</p>
              <p>{latestFlockAge.farmName} / {latestFlockAge.buildingName} / {latestFlockAge.penName}</p>
              <p>Latest placement: {latestFlockAge.placementDate} (#{latestFlockAge.placementId})</p>
            </div> : "No flock with a valid placement date for the selected farm and end date."}
            icon={<CalendarDays className="size-6 text-cyan-700" />}
            accent="text-cyan-600"
          />
            <StatCard
            title="Depletion"
            value={loading ? "Loading..." : integer.format(depletion)}
            helper={<div className="space-y-2">
              <p>Total depletion in the selected date range.</p>
              <dl className="space-y-1">
                {depletionRows.map(({ label, value, period }) => {
                  const rate = period ? summary?.depletionRates[period] : undefined;
                  return (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className={period ? "font-bold text-foreground" : undefined}>{label}</dt>
                      <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-foreground"
                        title={period ? (rate?.openingPopulation != null
                          ? `Opening population: ${integer.format(rate.openingPopulation)} birds` : "Opening population unavailable") : undefined}>
                        {loading ? "—" : `${integer.format(value)}${period ? `-${rate?.ratePercent == null ? "N/A" : `${decimal.format(rate.ratePercent)}%`}` : ""}`}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>}
            icon={<HeartCrack className="size-6 text-rose-700" />}
            accent="text-rose-500"
          />
            <StatCard
              title="Body Weight"
              value={`${decimal.format(combinedAlw)} kg`}
              helper={`Male ${decimal.format(totals?.alwMale ?? 0)} / Female ${decimal.format(totals?.alwFemale ?? 0)} kg`}
              icon={<Scale className="size-6 text-blue-700" />}
              accent="text-blue-500"
            />
            <StatCard
            title="Uniformity"
            value={loading ? "Loading..." : `Male ${summary?.latestUniformity.male ? decimal.format(summary.latestUniformity.male.value) + "%" : "N/A"} / Female ${summary?.latestUniformity.female ? decimal.format(summary.latestUniformity.female.value) + "%" : "N/A"}`}
            helper={<div className="space-y-1">
              <p>{summary?.weightSampleStorageAvailable === false ? "Weight sample storage is not installed." : "Latest 50-bird samples for the latest flock."}</p>
              <p>{latestFlockAge ? `${latestFlockAge.farmName} / ${latestFlockAge.buildingName} / ${latestFlockAge.penName}` : "No flock selected."}</p>
              {(["male", "female"] as const).map(sex => {
                const reading = summary?.latestUniformity[sex];
                return <p key={sex}>
                  {sex === "male" ? "Male" : "Female"}: {reading ? `${reading.sampleCount} samples · ${decimal.format(reading.meanGrams)} g average · ${reading.date}` : "No samples recorded"}
                  {reading?.ageDays != null ? ` · Age ${Math.floor(reading.ageDays / 7)}.${reading.ageDays % 7} (Weeks.Day)` : ""}
                </p>;
              })}
            </div>}
            icon={<Percent className="size-6 text-violet-700" />}
            accent="text-violet-500"
          />
            <StatCard
              title="Feed Consumption"
              value={`${decimal.format(totals?.averageFeedGrams ?? 0)} g/bird`}
              helper={<div className="space-y-2">
                <p>Average daily feed per bird in the selected date range.</p>
                {latestFeed ? <>
                  <p>Latest flock record: {latestFeed.date}<br />
                    Age {latestFeed.ageDays == null ? "N/A" : `${Math.floor(latestFeed.ageDays / 7)}.${latestFeed.ageDays % 7}`} (Weeks.Day)
                  </p>
                  <p>Actual: {latestFeed.gramsPerBird == null ? "N/A" : `${decimal.format(latestFeed.gramsPerBird)} g/bird`}<br />
                    Standard: {feedStandard ? `${decimal.format(feedStandard.gramsPerBird)} g/bird (Week ${feedStandard.week})` : "Not configured"}
                  </p>
                  <p className="text-xs">{latestFlockAge?.farmName} / {latestFlockAge?.buildingName} / {latestFlockAge?.penName}. Breeder Reports feed schedule.</p>
                </> : <p>No feed record for the latest flock.</p>}
              </div>}
              icon={<Wheat className="size-6 text-amber-700" />}
              accent="text-amber-500"
            />
            <StatCard
              title="TEP"
              value={loading ? "Loading..." : showEggNumber(eggRangeTotals?.totalEggs, " eggs", true)}
              helper={<div className="space-y-1">
                <p className="font-semibold text-foreground">Standard: {showEggNumber(eggRangeTotals?.standardEggs, " eggs", true)}</p>
                <p>Production: {showEggNumber(eggRangeTotals?.productionPercent, "%")} / Std {showEggNumber(eggRangeTotals?.standardPercent, "%")}</p>
                <p>Totals for the selected Production Date Range.</p>
                <EggRangeDetails rows={eggRange?.buildings ?? []} metric="tep" />
                <p className="text-xs">{eggStandardLink}. Actual and standard use the same recorded days.</p>
                {!!eggRange?.excludedRecords && <p className="text-xs text-amber-700">{eggRange.excludedRecords} unmatched egg records excluded.</p>}
              </div>}
              icon={<Egg className="size-6 text-emerald-700" />}
              accent="text-emerald-500"
            />
            <StatCard
              title="TEP per Hen House"
              value={loading ? "Loading..." : showEggNumber(eggRangeTotals?.eggsPerHen, " eggs/hen")}
              helper={<div className="space-y-1">
                <p className="font-semibold text-foreground">Standard: {showEggNumber(eggRangeTotals?.standardEggsPerHen, " eggs/hen")}</p>
                <p>TEP ÷ average live females on recorded days.</p>
                <p>Average live females: {showEggNumber(eggRangeTotals?.averageLiveFemales, "", true)}</p>
                <EggRangeDetails rows={eggRange?.buildings ?? []} metric="hen" />
                <p className="text-xs">{eggStandardLink} production rate converted to eggs per live hen.</p>
              </div>}
              icon={<House className="size-6 text-teal-700" />}
              accent="text-teal-500"
            />
            <StatCard
              title="Hatch Recovery"
              value={loading ? "Loading..." : showEggNumber(eggRangeTotals?.hatchRecovery, "%")}
              helper={<div className="space-y-1">
                <p>Good Egg ÷ TEP × 100</p>
                <p>Good Egg: {showEggNumber(eggRangeTotals?.goodEggs, "", true)} / TEP: {showEggNumber(eggRangeTotals?.totalEggs, "", true)}</p>
                <p>Good Egg uses Egg Laying&apos;s Hatching Egg count.</p>
                <EggRangeDetails rows={eggRange?.buildings ?? []} metric="recovery" />
              </div>}
              icon={<Percent className="size-6 text-blue-700" />}
              accent="text-blue-500"
            />
          </div>
        )}

        <BreederBodyWeight rows={summary?.weeklyBodyWeights ?? []} loading={loading} asOf={filter?.to} />

        {filter ? <BreederTrends from={filter.from} to={filter.to} farmId={filter.farmId} /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Breeder Performance per Building</CardTitle>
            <p className="text-sm text-muted-foreground">
              Population uses closing inventory from each placement&apos;s latest record through the selected end date, or its placement balance when no record exists. ALW uses the latest available record; mortality and feed are period totals.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Farm</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead className="text-right">Male Pop.</TableHead>
                  <TableHead className="text-right">Female Pop.</TableHead>
                  <TableHead className="text-right">Total Pop.</TableHead>
                  <TableHead className="text-right">Male Mort.</TableHead>
                  <TableHead className="text-right">Female Mort.</TableHead>
                  <TableHead className="text-right">Growing Mort. (0.1–25.0)</TableHead>
                  <TableHead className="text-right">Laying Mort. (25.1–65.0)</TableHead>
                  <TableHead className="text-right">Other Age Mort.</TableHead>
                  <TableHead className="text-right">Male ALW</TableHead>
                  <TableHead className="text-right">Female ALW</TableHead>
                  <TableHead className="text-right">Feed (kg)</TableHead>
                  <TableHead className="text-right">Ave Feed (g/bird)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={14} className="h-24 text-center">Loading dashboard...</TableCell></TableRow>
                ) : summary?.buildings.length ? (
                  summary.buildings.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>{row.farmName}</TableCell>
                      <TableCell className="font-medium">{row.buildingName}</TableCell>
                      <TableCell className="text-right">{integer.format(row.populationMale)}</TableCell>
                      <TableCell className="text-right">{integer.format(row.populationFemale)}</TableCell>
                      <TableCell className="text-right font-semibold">{integer.format(row.populationMale + row.populationFemale)}</TableCell>
                      <TableCell className="text-right">{integer.format(row.mortalityMale)}</TableCell>
                      <TableCell className="text-right">{integer.format(row.mortalityFemale)}</TableCell>
                      <TableCell className="text-right">{integer.format(row.growingMortality)}</TableCell>
                      <TableCell className="text-right">{integer.format(row.layingMortality)}</TableCell>
                      <TableCell className="text-right">{integer.format(row.otherAgeMortality)}</TableCell>
                      <TableCell className="text-right">{decimal.format(row.alwMale)} kg</TableCell>
                      <TableCell className="text-right">{decimal.format(row.alwFemale)} kg</TableCell>
                      <TableCell className="text-right">{decimal.format(row.feedMaleKg + row.feedFemaleKg)}</TableCell>
                      <TableCell className="text-right">{decimal.format(row.averageFeedGrams)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={14} className="h-24 text-center text-muted-foreground">
                      No breeder performance records found for the selected date range and farm.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
