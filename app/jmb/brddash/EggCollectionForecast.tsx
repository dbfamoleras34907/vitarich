"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EggCollectionForecast as EggCollectionForecastData, EggCollectionForecastHeader } from "@/app/jmb/lib/eggCollectionForecast";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const percentage = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const decimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function number(value: number | null | undefined) {
  return value == null ? "—" : integer.format(value);
}

function percent(value: number | null | undefined) {
  return value == null ? "—" : `${percentage.format(value)}%`;
}

function ageInWeeksDays(value: number | null | undefined) {
  return value == null ? "—" : `${Math.floor(value / 7)}.${value % 7}`;
}

function ratio(value: number | null | undefined) {
  return value == null ? "—" : decimal.format(value);
}

function ForecastHeader({ header }: { header: EggCollectionForecastHeader | undefined }) {
  return (
    <div className="grid gap-3 border-y py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto_minmax(18rem,1fr)] sm:items-center">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 sm:max-w-xs">
        <dt className="text-right font-medium text-muted-foreground">Farm</dt>
        <dd className="min-w-0 rounded-sm border px-2 py-0.5 font-semibold text-foreground">{header?.farmName ?? "—"}</dd>
        <dt className="text-right font-medium text-muted-foreground" title="Weeks na nangitlog yung 5% of total hens of all buildings.">Age at 5%</dt>
        <dd className="rounded-sm border px-2 py-0.5 font-semibold tabular-nums text-foreground">{ageInWeeksDays(header?.ageAtFivePercentDays)}</dd>
      </dl>
      <dl className="flex items-center gap-3 whitespace-nowrap">
        <dt className="font-semibold text-foreground" title="Actual inventory when 5% of the total hens across all buildings are laying eggs.">Hen-Housed</dt>
        <dd className="rounded-sm border px-3 py-1 font-semibold tabular-nums text-foreground">{number(header?.henHoused)}</dd>
      </dl>
      <dl className="grid grid-cols-3 divide-x rounded-sm border text-center">
        <div className="px-3 py-1.5"><dt className="font-semibold tabular-nums text-foreground">{ratio(header?.tepPerHenHoused)}</dt><dd className="mt-0.5 text-[11px] text-muted-foreground">TEP/HH</dd></div>
        <div className="px-3 py-1.5"><dt className="font-semibold tabular-nums text-foreground">{ratio(header?.hatchingEggPerHenHoused)}</dt><dd className="mt-0.5 text-[11px] text-muted-foreground">HE/HH</dd></div>
        <div className="px-3 py-1.5"><dt className="font-semibold tabular-nums text-foreground">{percent(header?.hatchingEggRecoveryPercent)}</dt><dd className="mt-0.5 text-[11px] text-muted-foreground">HER</dd></div>
      </dl>
    </div>
  );
}

export default function EggCollectionForecast({
  data,
  loading,
}: {
  data: EggCollectionForecastData | undefined;
  loading: boolean;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportInfoVisible, setReportInfoVisible] = useState(false);
  const rows = useMemo(() => (data?.points ?? []).map((row) => ({
    ...row,
    aiwLabel: row.aiw == null ? "—" : String(row.aiw),
    actualHatchingEgg: row.actualHatchingEgg,
    forecastHatchingEgg: row.forecastHatchingEgg,
    tep: row.actualTep ?? row.forecastTep,
  })), [data?.points]);
  const forecastStartLabel = rows.find(row => row.forecastHatchingEgg != null)?.aiwLabel;
  const reportRows = data?.reportRows ?? [];

  return (
    <Card>
      <CardHeader className="gap-2 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Egg Collection Forecast</CardTitle>
            <p className="text-sm text-muted-foreground">
              Friday–Thursday Actual and Forecast Hatching Egg with Total Egg Production, starting from WIP 1 through WIP 43.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setReportOpen(true)} disabled={loading || !reportRows.length}>View report</Button>
        </div>
        {data?.actualThrough && <p className="text-xs text-muted-foreground">Actual through {format(parseISO(data.actualThrough), "MMM d, yyyy")}. Forecast begins on the following date.</p>}
        <ForecastHeader header={data?.header} />
      </CardHeader>
      <CardContent className="h-80">
        {loading ? <Skeleton className="h-full w-full" /> : rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 5, right: 10, left: 4, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="aiwLabel" tick={{ fontSize: 11 }} minTickGap={24} label={{ value: "AIW", position: "insideBottom", offset: -2, fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={65} tickFormatter={(value) => integer.format(Number(value))} />
              <Tooltip formatter={(value) => Array.isArray(value)
                ? value.map(item => integer.format(Number(item))).join(", ")
                : value == null ? "—" : integer.format(Number(value))}
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload;
                  return point?.weekEnd ? `AIW ${point.aiw ?? "—"} · WIP ${point.wip ?? "—"} · ${point.weekStart} – ${point.weekEnd}` : "";
                }} />
              <Legend />
              {forecastStartLabel && <ReferenceLine x={forecastStartLabel} stroke="#2563eb" strokeDasharray="3 3" label={{ value: "Forecast", position: "insideTopRight", fill: "#2563eb", fontSize: 11 }} />}
              <Line type="monotone" dataKey="actualHatchingEgg" name="Actual Hatching Egg" stroke="#16a34a" strokeWidth={2.5} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="forecastHatchingEgg" name="Forecast Hatching Egg" stroke="#2563eb" strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="tep" name="TEP (Actual / Forecast)" stroke="#9333ea" strokeWidth={2.5} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <div className="grid h-full place-items-center text-sm text-muted-foreground">{data?.message ?? "No egg collection forecast is available."}</div>}
      </CardContent>
      {data?.message && rows.length ? <p className="px-6 pb-5 text-xs text-amber-700 dark:text-amber-400">{data.message}</p> : null}
      <Dialog open={reportOpen} onOpenChange={(open) => {
        setReportOpen(open);
        if (!open) setReportInfoVisible(false);
      }}>
        <DialogContent className="grid max-h-[calc(100vh-1rem)] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden p-4 sm:max-w-7xl sm:p-6">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <DialogTitle>Egg Collection Forecast Report</DialogTitle>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Show or hide forecast report information" aria-expanded={reportInfoVisible} onClick={() => setReportInfoVisible(visible => !visible)}>
                <Info className="size-4" />
              </Button>
            </div>
            {reportInfoVisible ? <DialogDescription>
              Friday–Thursday rows from WIP 1 through WIP 43. Status uses A for Actual and F for Forecast. Actual HE is Hatching Egg + Class B + Junior; forecast HE is TEP × HER. Forecast depletion uses 0.4% unless the previous three actual weeks average higher; HW Drop uses −0.1 percentage point unless the previous three actual weeks average higher. Forecast HER follows the workbook age standard.
            </DialogDescription> : <DialogDescription className="sr-only">Forecast report information is hidden.</DialogDescription>}
          </DialogHeader>
          <ForecastHeader header={data?.header} />
          <Table containerClassName="min-h-0 overflow-auto rounded-md border" className="w-full table-fixed text-xs">
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-30 [&_th]:bg-muted [&_th]:shadow-sm">
              <TableRow>
                <TableHead className="w-11 px-1 text-center">Status</TableHead>
                <TableHead className="w-11 px-1 text-right">AIW</TableHead>
                <TableHead className="w-11 px-1 text-right">WIP</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead className="text-right">F Pop&apos;n</TableHead>
                <TableHead className="text-right">Depletion Rate</TableHead>
                <TableHead className="text-right">TEP</TableHead>
                <TableHead className="text-right">HE</TableHead>
                <TableHead className="text-right">HW</TableHead>
                <TableHead className="text-right">DROP</TableHead>
                <TableHead className="text-right">HER</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportRows.map((row) => (
                <TableRow key={`${row.source}:${row.weekStart}`} className={row.source === "forecast" ? "bg-primary/5" : undefined}>
                  <TableCell className="px-1 text-center font-semibold" title={row.source === "actual" ? `Actual${row.recordedDays != null && row.recordedDays < 7 ? ` (${row.recordedDays}/7 days)` : ""}` : "Forecast"}>{row.source === "actual" ? "A" : "F"}</TableCell>
                  <TableCell className="px-1 text-right tabular-nums">{row.aiw ?? "—"}</TableCell>
                  <TableCell className="px-1 text-right tabular-nums">{row.wip ?? "—"}</TableCell>
                  <TableCell>{format(parseISO(row.weekStart), "MMM d, yyyy")}</TableCell>
                  <TableCell>{format(parseISO(row.weekEnd), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-right tabular-nums">{number(row.femalePopulation)}</TableCell>
                  <TableCell className="text-right tabular-nums">{percent(row.depletionRatePercent)}</TableCell>
                  <TableCell className="text-right tabular-nums">{number(row.tep)}</TableCell>
                  <TableCell className="text-right tabular-nums">{number(row.hatchingEgg)}</TableCell>
                  <TableCell className="text-right tabular-nums">{percent(row.hatchingWeekPercent)}</TableCell>
                  <TableCell className="text-right tabular-nums">{percent(row.dropPercent)}</TableCell>
                  <TableCell className="text-right tabular-nums">{percent(row.hatchingEggRecoveryPercent)}</TableCell>
                </TableRow>
              ))}
              {!reportRows.length ? <TableRow><TableCell colSpan={12} className="h-24 text-center text-muted-foreground">No Egg Collection forecast report is available.</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
