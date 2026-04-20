"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import { DateRange } from "react-day-picker";
import { EggIntakeTrendRow, getEggIntakeTrendDB } from "./api";

interface Props {
  date?: DateRange;
  groupBy: "daily" | "weekly" | "monthly";
}

const chartConfig = {
  total_eggs_received: {
    label: "Eggs Received",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export default function EggIntakeTrend({ date, groupBy }: Props) {
  const [data, setData] = useState<EggIntakeTrendRow[]>([]);

  useEffect(() => {
    if (!date?.from || !date?.to) return;

    const load = async () => {
      const res = await getEggIntakeTrendDB(
        format(date.from!, "yyyy-MM-dd"),
        format(date.to!, "yyyy-MM-dd"),
        groupBy,
      );

      setData(res);
    };

    load();
  }, [date, groupBy]);

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{ left: 12, right: 12 }}
      >
        <CartesianGrid vertical={false} />

        <XAxis
          dataKey="period"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => format(new Date(value), "MMM dd")}
        />

        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />

        <Area
          dataKey="total_eggs_received"
          type="natural"
          fill="var(--color-total_eggs_received)"
          fillOpacity={0.4}
          stroke="var(--color-total_eggs_received)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
