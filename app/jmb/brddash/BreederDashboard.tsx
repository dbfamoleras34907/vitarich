"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Bird, Scale, Skull, Wheat } from "lucide-react";

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

const ALL_FARMS = "__all__";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function StatCard({
  title,
  value,
  helper,
  icon,
  accent,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className={`overflow-hidden ${accent}`}>
      <CardContent className="p-0">
        <div className="h-1 w-full bg-current opacity-80" />
        <div className="flex items-start justify-between gap-4 p-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground">{helper}</p>
          </div>
          <div className="rounded-md bg-current/10 p-3">{icon}</div>
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
  const [farmId, setFarmId] = useState(ALL_FARMS);
  const [farms, setFarms] = useState<BreederDashboardFarm[]>([]);
  const [summary, setSummary] = useState<BreederDashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filter = useMemo(() => {
    if (!date?.from || !date?.to) return null;
    return {
      from: format(date.from, "yyyy-MM-dd"),
      to: format(date.to, "yyyy-MM-dd"),
      farmId: farmId === ALL_FARMS ? undefined : Number(farmId),
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
    () => [
      { code: ALL_FARMS, name: "All farms" },
      ...farms.map((farm) => ({ code: String(farm.id), name: farm.name })),
    ],
    [farms],
  );

  useEffect(() => {
    if (!filter) return;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return null;
        setLoading(true);
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
  const population = (totals?.populationMale ?? 0) + (totals?.populationFemale ?? 0);
  const mortality = (totals?.mortalityMale ?? 0) + (totals?.mortalityFemale ?? 0);
  const feed = (totals?.feedMaleKg ?? 0) + (totals?.feedFemaleKg ?? 0);
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
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <DatePickerWithRange label="Production Date Range" date={date} setDate={setDate} />
              <div className="w-60">
                <SearchableCombobox
                  label="Farm"
                  items={farmOptions}
                  value={farmId}
                  onValueChange={setFarmId}
                  placeholder="All farms"
                  className="w-full"
                />
              </div>
            </div>
          </Card>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading && !summary ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-36 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Population"
              value={integer.format(population)}
              helper={`Male ${integer.format(totals?.populationMale ?? 0)} / Female ${integer.format(totals?.populationFemale ?? 0)}`}
              icon={<Bird className="size-6 text-emerald-700" />}
              accent="text-emerald-600"
            />
            <StatCard
              title="Total Mortality"
              value={integer.format(mortality)}
              helper={`Male ${integer.format(totals?.mortalityMale ?? 0)} / Female ${integer.format(totals?.mortalityFemale ?? 0)}`}
              icon={<Skull className="size-6 text-rose-700" />}
              accent="text-rose-500"
            />
            <StatCard
              title="Average Live Weight"
              value={`${decimal.format(combinedAlw)} kg`}
              helper={`Male ${decimal.format(totals?.alwMale ?? 0)} / Female ${decimal.format(totals?.alwFemale ?? 0)} kg`}
              icon={<Scale className="size-6 text-blue-700" />}
              accent="text-blue-500"
            />
            <StatCard
              title="Feed Consumption"
              value={`${decimal.format(feed)} kg`}
              helper={`Average ${decimal.format(totals?.averageFeedGrams ?? 0)} g/bird`}
              icon={<Wheat className="size-6 text-amber-700" />}
              accent="text-amber-500"
            />
          </div>
        )}

        {filter ? <BreederTrends from={filter.from} to={filter.to} farmId={filter.farmId} /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Breeder Performance per Building</CardTitle>
            <p className="text-sm text-muted-foreground">
              Population and ALW use each placement&apos;s latest record in the selected period; mortality and feed are period totals.
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
                  <TableHead className="text-right">Male ALW</TableHead>
                  <TableHead className="text-right">Female ALW</TableHead>
                  <TableHead className="text-right">Feed (kg)</TableHead>
                  <TableHead className="text-right">Ave Feed (g/bird)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={11} className="h-24 text-center">Loading dashboard...</TableCell></TableRow>
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
                      <TableCell className="text-right">{decimal.format(row.alwMale)} kg</TableCell>
                      <TableCell className="text-right">{decimal.format(row.alwFemale)} kg</TableCell>
                      <TableCell className="text-right">{decimal.format(row.feedMaleKg + row.feedFemaleKg)}</TableCell>
                      <TableCell className="text-right">{decimal.format(row.averageFeedGrams)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
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
