'use client'

import { useEffect, useState } from 'react'
import {
  Package,
  Boxes,
  Warehouse,
  Thermometer,
  Egg,
  ArrowRightLeft,
  Bird,
  Truck,
  BadgeCheck,
  Sigma,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { getInventoryTraceabilitySummary } from './api'

type DashboardItem = {
  process_name: string
  percentage: number
  completed_count: number
  total_count: number
}

type Props = {
  archipelago?: string
  region?: string
  dateFrom?: string
  dateTo?: string
}

const processIcons: Record<
  string,
  React.ElementType
> = {
  Receiving: Package,
  Classification: Boxes,
  Storage: Warehouse,
  'Pre-Warming': Thermometer,
  Setter: Egg,
  Transfer: ArrowRightLeft,
  Hatcher: Bird,
  Pullout: Truck,
  'Chick Grading': BadgeCheck,
}

const getStatusColor = (
  percentage: number
) => {
  if (percentage >= 80) {
    return {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600',
      progress:
        '[&>div]:bg-emerald-500',
    }
  }

  if (percentage >= 40) {
    return {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600',
      progress:
        '[&>div]:bg-amber-500',
    }
  }

  return {
    bg: 'bg-red-500/10',
    text: 'text-red-600',
    progress:
      '[&>div]:bg-red-500',
  }
}

export default function TraceabilityDashboard({
  archipelago,
  region,
  dateFrom,
  dateTo,
}: Props) {
  const [rows, setRows] =
    useState<DashboardItem[]>([])

  const [loading, setLoading] =
    useState(false)

  const loadData = async () => {
    try {
      setLoading(true)

      const response =
        await getInventoryTraceabilitySummary(
          {
            dateFrom,
            dateTo,
            region,
            archipelago,
          }
        )

      console.log(
        'FULL RESPONSE',
        response
      )

      const data =
        response?.response ??
        response?.data
          ?.response ??
        response?.data ??
        response ??
        []

      console.log(
        'DASHBOARD DATA',
        data
      )

      setRows(data)
    } catch (err) {
      console.error(
        'Dashboard Error:',
        err
      )
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [
    archipelago,
    region,
    dateFrom,
    dateTo,
  ])

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Traceability Dashboard
        </h1>

        <p className="text-muted-foreground">
          Process completion overview
        </p>
      </div>

      {!loading &&
        rows.length === 0 && (
          <Card className="p-10 text-center">
            <p className="text-muted-foreground">
              No dashboard data found
            </p>
          </Card>
        )}

      {/* <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading
          ? Array.from({
              length: 9,
            }).map((_, i) => (
              <Card
                key={i}
                className="p-5 animate-pulse"
              >
                <div className="mb-4 h-5 w-28 rounded bg-muted" />
                <div className="mb-4 h-2 rounded bg-muted" />
                <div className="h-4 w-20 rounded bg-muted" />
              </Card>
            ))
          : rows.map((item) => {
              const Icon =
                processIcons[
                  item.process_name
                ] || Package

              const colors =
                getStatusColor(
                  item.percentage
                )

              return (
                <Card
                  key={
                    item.process_name
                  }
                  className="group p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {
                          item.process_name
                        }
                      </p>

                      <h2 className="mt-2 text-3xl font-bold">
                        {
                          item.percentage
                        }
                        %
                      </h2>
                    </div>

                    <div
                      className={cn(
                        'rounded-2xl p-3 transition-all',
                        colors.bg
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-5 w-5',
                          colors.text
                        )}
                      />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <Progress
                      value={
                        item.percentage
                      }
                      className={cn(
                        'h-2',
                        colors.progress
                      )}
                    />

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Completed
                      </span>

                      <span className="font-semibold">
                        {
                          item.completed_count
                        }
                        /
                        {
                          item.total_count
                        }
                      </span>
                    </div>
                  </div>
                </Card>
              )
            })}
      </div> */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading
          ? Array.from({
            length: 10, // changed from 9 to 10
          }).map((_, i) => (
            <Card
              key={i}
              className="p-5 animate-pulse"
            >
              <div className="mb-4 h-5 w-28 rounded bg-muted" />
              <div className="mb-4 h-2 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
            </Card>
          ))
          : (() => {
            // const overallPercentage =
            //   rows.length > 0
            //     ? Math.round(
            //       rows.reduce(
            //         (sum, item) =>
            //           sum + item.percentage,
            //         0
            //       ) / rows.length
            //     )
            //     : 0


            // const totalCompleted =
            //   rows.reduce(
            //     (sum, item) =>
            //       sum + item.completed_count,
            //     0
            //   )

            // const totalCount =
            //   rows.reduce(
            //     (sum, item) =>
            //       sum + item.total_count,
            //     0
            //   )

            const totalCompleted =
              rows.reduce(
                (sum, item) =>
                  sum + item.completed_count,
                0
              )

            const totalCount =
              rows.reduce(
                (sum, item) =>
                  sum + item.total_count,
                0
              )

            const overallPercentage =
              totalCount > 0
                ? Math.round(
                  (totalCompleted /
                    totalCount) *
                  100
                )
                : 0
            const overallColors =
              getStatusColor(
                overallPercentage
              )

            return (
              <>
                {rows.map((item) => {
                  const Icon =
                    processIcons[
                    item.process_name
                    ] || Package

                  const colors =
                    getStatusColor(
                      item.percentage
                    )

                  return (
                    <Card
                      key={
                        item.process_name
                      }
                      className="group p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {
                              item.process_name
                            }
                          </p>

                          <h2 className="mt-2 text-3xl font-bold">
                            {
                              item.percentage
                            }
                            %
                          </h2>
                        </div>

                        <div
                          className={cn(
                            'rounded-2xl p-3 transition-all',
                            colors.bg
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-5 w-5',
                              colors.text
                            )}
                          />
                        </div>
                      </div>

                      <div className="mt-5 space-y-3">
                        <Progress
                          value={
                            item.percentage
                          }
                          className={cn(
                            'h-2',
                            colors.progress
                          )}
                        />

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Completed
                          </span>

                          <span className="font-semibold">
                            {
                              item.completed_count
                            }
                            /
                            {
                              item.total_count
                            }
                          </span>
                        </div>
                      </div>
                    </Card>
                  )
                })}

                {/* Overall KPI Card */}
                <Card className="group border-2 border-primary/20 bg-primary/5 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Overall KPI
                      </p>

                      <h2 className="mt-2 text-3xl font-bold">
                        {
                          overallPercentage
                        }
                        %
                      </h2>
                    </div>

                    <div
                      className={cn(
                        'rounded-2xl p-3 transition-all',
                        overallColors.bg
                      )}
                    >
                      <Sigma
                        className={cn(
                          'h-5 w-5',
                          overallColors.text
                        )}
                      />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <Progress
                      value={
                        overallPercentage
                      }
                      className={cn(
                        'h-2',
                        overallColors.progress
                      )}
                    />

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Total Completed
                      </span>

                      <span className="font-semibold">
                        {totalCompleted}/
                        {totalCount}
                      </span>
                    </div>
                  </div>
                </Card>
              </>
            )
          })()}
      </div>
    </div>
  )
}