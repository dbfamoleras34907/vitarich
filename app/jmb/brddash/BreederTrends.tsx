"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getBreederTrend,
  type BreederTrendGroup,
  type BreederTrendRow,
} from "./api";

const groups: Array<{ value: BreederTrendGroup; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function periodLabel(period: string, groupBy: BreederTrendGroup) {
  const value = parseISO(period);
  if (groupBy === "monthly") return format(value, "MMM yyyy");
  if (groupBy === "weekly") return `Week of ${format(value, "MMM d")}`;
  return format(value, "MMM d");
}

export default function BreederTrends({
  from,
  to,
  farmId,
}: {
  from: string;
  to: string;
  farmId?: number;
}) {
  const [groupBy, setGroupBy] = useState<BreederTrendGroup>("daily");
  const [rows, setRows] = useState<BreederTrendRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return null;
        setLoading(true);
        setError("");
        return getBreederTrend({ from, to, farmId }, groupBy);
      })
      .then((data) => {
        if (active && data) setRows(data);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load breeder trends.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [farmId, from, groupBy, to]);

  const chartRows = rows.map((row) => ({
    ...row,
    label: periodLabel(row.period, groupBy),
  }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Breeder Production Trends</h2>
          <p className="text-sm text-muted-foreground">Performance across the selected breeder buildings</p>
        </div>
        <div className="flex items-center gap-2">
          {groups.map((group) => (
            <Button
              key={group.value}
              size="sm"
              variant={groupBy === group.value ? "default" : "outline"}
              onClick={() => setGroupBy(group.value)}
            >
              {group.label}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Population and Mortality</CardTitle>
            <p className="text-sm text-muted-foreground">Male and female closing population with period mortality</p>
          </CardHeader>
          <CardContent className="h-80">
            {loading ? <Skeleton className="h-full w-full" /> : chartRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                  <YAxis yAxisId="population" tick={{ fontSize: 11 }} width={55} />
                  <YAxis yAxisId="mortality" orientation="right" tick={{ fontSize: 11 }} width={45} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="population" type="monotone" dataKey="populationMale" name="Male Population" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line yAxisId="population" type="monotone" dataKey="populationFemale" name="Female Population" stroke="#db2777" strokeWidth={2} dot={false} />
                  <Line yAxisId="mortality" type="monotone" dataKey="mortalityMale" name="Male Mortality" stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line yAxisId="mortality" type="monotone" dataKey="mortalityFemale" name="Female Mortality" stroke="#dc2626" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="grid h-full place-items-center text-sm text-muted-foreground">No trend records found.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ALW and Feed Consumption</CardTitle>
            <p className="text-sm text-muted-foreground">Average live weight and average feed per bird</p>
          </CardHeader>
          <CardContent className="h-80">
            {loading ? <Skeleton className="h-full w-full" /> : chartRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                  <YAxis yAxisId="weight" tick={{ fontSize: 11 }} width={45} unit=" kg" />
                  <YAxis yAxisId="feed" orientation="right" tick={{ fontSize: 11 }} width={55} unit=" g" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="weight" type="monotone" dataKey="alwMale" name="Male ALW (kg)" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line yAxisId="weight" type="monotone" dataKey="alwFemale" name="Female ALW (kg)" stroke="#db2777" strokeWidth={2} dot={false} />
                  <Line yAxisId="feed" type="monotone" dataKey="averageFeedGrams" name="Ave Feed (g/bird)" stroke="#16a34a" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="grid h-full place-items-center text-sm text-muted-foreground">No trend records found.</div>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
