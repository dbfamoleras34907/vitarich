"use client";

import { useMemo } from "react";
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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { EggCollectionForecast as EggCollectionForecastData } from "@/app/jmb/lib/eggCollectionForecast";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export default function EggCollectionForecast({
  data,
  loading,
}: {
  data: EggCollectionForecastData | undefined;
  loading: boolean;
}) {
  const rows = useMemo(() => (data?.points ?? []).map((row) => ({
    ...row,
    label: format(parseISO(row.weekStart), "MMM d"),
    actualHatchingEgg: row.actualHatchingEgg,
    forecastHatchingEgg: row.forecastHatchingEgg,
    tep: row.actualTep ?? row.forecastTep,
  })), [data?.points]);
  const forecastStartLabel = rows.find(row => row.forecastHatchingEgg != null)?.label;

  return (
    <Card>
      <CardHeader className="gap-2 pb-2">
        <div>
          <div>
            <CardTitle>Egg Collection Forecast</CardTitle>
            <p className="text-sm text-muted-foreground">
              Actual and forecast Hatching Egg with Total Egg Production by week. The forecast extends 13 weeks (about three months) using the confirmed AIW 31–65 HW drop, 0.4% depletion, and HER standards.
            </p>
          </div>
        </div>
        {data?.actualThrough && <p className="text-xs text-muted-foreground">Actual through {format(parseISO(data.actualThrough), "MMM d, yyyy")}. Forecast begins on the following date.</p>}
      </CardHeader>
      <CardContent className="h-80">
        {loading ? <Skeleton className="h-full w-full" /> : rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 5, right: 10, left: 4, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} width={65} tickFormatter={(value) => integer.format(Number(value))} />
              <Tooltip formatter={(value) => Array.isArray(value)
                ? value.map(item => integer.format(Number(item))).join(", ")
                : value == null ? "—" : integer.format(Number(value))}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.weekEnd ? `${payload[0].payload.weekStart} – ${payload[0].payload.weekEnd}` : ""} />
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
    </Card>
  );
}
