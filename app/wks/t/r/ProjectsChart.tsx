// this dashboard should be updated with the workspace datas
"use client"

import * as React from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

type DataType = {
  month: string
  value: number
}

const getRandomValue = () => Math.floor(Math.random() * (300 - 1 + 1)) + 1

const sampleData: DataType[] = [
  "Mar 2025", "Apr 2025", "May 2025", "Jun 2025", "Jul 2025", "Aug 2025",
  "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026", "Mar 2026"
].map(month => ({
  month,
  value: getRandomValue(),
}))

export default function ProjectsChart() {
  const [loading, setLoading] = React.useState(true)
  const [groupBy, setGroupBy] = React.useState("monthly")
  const [data, setData] = React.useState<DataType[]>([])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setData(sampleData)
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <Card className="mt-9 shadow-none mx-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Completed Projects</CardTitle>
          <p className="text-sm text-muted-foreground">
            Last synced just now
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={groupBy === "yearly" ? "default" : "outline"}
            onClick={() => setGroupBy("yearly")}
          >
            Last Year
          </Button>

          <Button
            size="sm"
            variant={groupBy === "monthly" ? "default" : "outline"}
            onClick={() => setGroupBy("monthly")}
          >
            Monthly
          </Button>
        </div>
      </CardHeader>

      <CardContent className="h-[260px]">
        {loading ? (
          <Skeleton className="w-full h-full rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
              />

              <YAxis allowDecimals={false} />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="value"
                stroke="#ec4899"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}