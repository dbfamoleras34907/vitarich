"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { TrendingUp } from "lucide-react"
import {
    Area,
    AreaChart,
    CartesianGrid,
    XAxis,
} from "recharts"

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart"

import { DateRange } from "react-day-picker"
import { getHatchabilityTrendDB, HatchabilityTrendRow } from "./api"
// import {
//   getHatchabilityTrendDB,
//   HatchabilityTrendRow,
// } from "@/api/hatchability/getHatchabilityTrend"

interface Props {
    date?: DateRange
    groupBy: "daily" | "weekly" | "monthly"
}

const chartConfig = {
    hatchability_rate_percent: {
        label: "Hatchability %",
        color: "var(--chart-1)",
    },
} satisfies ChartConfig


export default function Hatchabilitytrend({
    date,
    groupBy,
}: Props) {

    const [data, setData] = useState<HatchabilityTrendRow[]>([])

    useEffect(() => {
        if (!date?.from || !date?.to) return

        const load = async () => {
            if (!date?.from || !date?.to) return

            const res = await getHatchabilityTrendDB(
                format(date.from, "yyyy-MM-dd"),
                format(date.to, "yyyy-MM-dd"),
                groupBy
            )

            setData(res)
        }

        load()
    }, [date, groupBy])

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
                    tickFormatter={(value) =>
                        format(new Date(value), "MMM dd")
                    }
                />

                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="line" />}
                />

                <Area
                    dataKey="hatchability_rate_percent"
                    type="natural"
                    fill="var(--color-hatchability_rate_percent)"
                    fillOpacity={0.4}
                    stroke="var(--color-hatchability_rate_percent)"
                />
            </AreaChart>
        </ChartContainer>
    )
}