"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Bird, Egg, Percent } from "lucide-react";

import Breadcrumb from "@/lib/Breadcrumb";
import { DatePickerWithRange } from "@/lib/DatePickerWithRange";
import { getAuthId } from "@/lib/getAuthId";
import { checkUserActive } from "@/lib/CheckUserIfActive";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { getDashboardSummary, type DashboardSummary } from "./api";
import EggIntakeTrend from "./EggIntakeTrend";
import Hatchabilitytrend from "./Hatchabilitytrend";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function toDateKey(value: Date) {
  return format(value, "yyyy-MM-dd");
}

/* ---------------- Skeleton Cards ---------------- */

function SkeletonStatCard() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-3 w-40" />
      </CardContent>
    </Card>
  );
}

/* ---------------- Real Stat Card ---------------- */

function StatCard({
  title,
  value,
  icon,
  accentClassName,
  badgeClassName,
  helper,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accentClassName: string;
  badgeClassName: string;
  helper: string;
}) {
  return (
    <Card
      className={`overflow-hidden ${accentClassName}`}
    >
      <CardContent className="p-0">
        <div className="h-1 w-full bg-current opacity-80" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {title}
              </p>
              <div className="text-4xl font-bold text-foreground">{value}</div>
              <p className="text-sm text-muted-foreground">{helper}</p>
            </div>
            <div className={`rounded-md p-3 ${badgeClassName}`}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StockDashboard() {
  const [groupBy, setgroupBy] = useState<"daily" | "weekly" | "monthly">(
    "daily",
  );

  const [eggGroupBy, setEggGroupBy] = useState<"daily" | "weekly" | "monthly">(
    "daily",
  );
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -60),
    to: new Date(),
  });

  // const [date, setDate] = useState<DateRange | undefined>(() => {
  //     const today = new Date();
  //     return { from: today, to: today };
  // });
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filter = useMemo(() => {
    if (!date?.from || !date?.to) return null;
    return {
      from: toDateKey(date.from),
      to: toDateKey(date.to),
    };
  }, [date]);

  const check = async () => {
    const authId = await getAuthId();
    await checkUserActive(authId || "");
  };

  useLayoutEffect(() => {
    check();
  }, []);

  useEffect(() => {
    if (!filter) return;

    let active = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getDashboardSummary(filter);
        if (!active) return;
        setSummary(data);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard.",
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [filter]);

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4">
          <div className="space-y-3">
            <Breadcrumb
              FirstPreviewsPageName="Home"
              CurrentPageName="Dashboard"
            />
            <Separator />
            {/* <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                Hatchery Dashboard
              </h1>
            </div> */}

            <Card className="p-4">
              <DatePickerWithRange
                label="Production Date Range"
                date={date}
                setDate={setDate}
              />
            </Card>
          </div>
        </div>
        {/* <Separator /> */}
        {error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-3">
          <StatCard
            title="Total Eggs Set"
            value={
              summary
                ? formatNumber(summary.eggsSet.filtered)
                : loading
                  ? "..."
                  : "0"
            }
            helper={
              summary
                ? `Today ${formatNumber(summary.eggsSet.today)} / Month ${formatNumber(summary.eggsSet.month)}`
                : "Today 0 / Month 0"
            }
            icon={<Egg className="size-6 text-primary" />}
            accentClassName="text-[var(--starbucks-green-accent)]"
            badgeClassName="bg-accent"
          />

          <StatCard
            title="Total Chicks Hatched"
            value={
              summary
                ? formatNumber(summary.chicksHatched.filtered)
                : loading
                  ? "..."
                  : "0"
            }
            helper={
              summary
                ? `Today ${formatNumber(summary.chicksHatched.today)} / Month ${formatNumber(summary.chicksHatched.month)}`
                : "Today 0 / Month 0"
            }
            icon={<Bird className="size-6 text-[var(--starbucks-house-green)]" />}
            accentClassName="text-[var(--starbucks-house-green)]"
            badgeClassName="bg-[var(--starbucks-green-light)]"
          />

          <StatCard
            title="Hatchability Rate"
            value={
              summary
                ? formatPercent(summary.hatchabilityRate.filtered)
                : loading
                  ? "..."
                  : "0.00%"
            }
            helper={
              summary
                ? `Today ${formatPercent(summary.hatchabilityRate.today)} / Month ${formatPercent(summary.hatchabilityRate.month)}`
                : "Today 0.00% / Month 0.00%"
            }
            icon={<Percent className="size-6 text-[var(--starbucks-gold)]" />}
            accentClassName="text-[var(--starbucks-gold)]"
            badgeClassName="bg-[var(--starbucks-gold)]/15"
          />
        </div>
      </div>

      <Card className="mx-auto mt-4 h-full max-w-7xl space-y-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Hatchery Production Overview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Hatchability % trend
            </p>
          </div>

          <div className="flex gap-2 items-center">
            <Button
              variant={groupBy === "daily" ? "default" : "outline"}
              size="sm"
              className={groupBy === "daily" ? "" : ""}
              onClick={() => setgroupBy("daily")}
            >
              Daily
            </Button>

            <Button
              variant={groupBy === "weekly" ? "default" : "outline"}
              size="sm"
              className={groupBy === "weekly" ? "" : ""}
              onClick={() => setgroupBy("weekly")}
            >
              Weekly
            </Button>

            <Button
              variant={groupBy === "monthly" ? "default" : "outline"}
              size="sm"
              className={groupBy === "monthly" ? "" : ""}
              onClick={() => setgroupBy("monthly")}
            >
              Monthly
            </Button>
          </div>
        </CardHeader>

        <CardContent className="h-60">
          <Hatchabilitytrend date={date} groupBy={groupBy} />
        </CardContent>
      </Card>
      <Card className="mx-auto mt-4 h-full max-w-7xl space-y-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Egg Intake Trends</CardTitle>
            <p className="text-sm text-muted-foreground">
              Eggs received from breeder farms
            </p>
          </div>

          <div className="flex gap-2 items-center">
            <Button
              variant={eggGroupBy === "daily" ? "default" : "outline"}
              size="sm"
              className={eggGroupBy === "daily" ? "" : ""}
              onClick={() => setEggGroupBy("daily")}
            >
              Daily
            </Button>

            <Button
              variant={eggGroupBy === "weekly" ? "default" : "outline"}
              size="sm"
              className={eggGroupBy === "weekly" ? "" : ""}
              onClick={() => setEggGroupBy("weekly")}
            >
              Weekly
            </Button>

            <Button
              variant={eggGroupBy === "monthly" ? "default" : "outline"}
              size="sm"
              className={eggGroupBy === "monthly" ? "" : ""}
              onClick={() => setEggGroupBy("monthly")}
            >
              Monthly
            </Button>
          </div>
        </CardHeader>

        <CardContent className="h-60">
          <EggIntakeTrend date={date} groupBy={eggGroupBy} />
        </CardContent>
      </Card>
    </main>
  );
}
