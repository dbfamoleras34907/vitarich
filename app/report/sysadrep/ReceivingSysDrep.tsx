'use client'

import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  Bird,
  Boxes,
  CheckCircle2,
  Egg,
  Gauge,
  Package,
  Sigma,
  Thermometer,
  Truck,
  Warehouse,
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

type StatusTone = 'good' | 'warning' | 'critical' | 'neutral'

const processIcons: Record<string, ElementType> = {
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

const getStatusColor = (percentage: number) => {
  if (percentage >= 80) {
    return {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600',
      progress: '[&>div]:bg-emerald-500',
      tone: 'good' as const,
    }
  }

  if (percentage >= 40) {
    return {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600',
      progress: '[&>div]:bg-amber-500',
      tone: 'warning' as const,
    }
  }

  return {
    bg: 'bg-red-500/10',
    text: 'text-red-600',
    progress: '[&>div]:bg-red-500',
    tone: 'critical' as const,
  }
}

const summarizeRows = (rows: DashboardItem[]) => {
  const totalCompleted = rows.reduce((sum, item) => sum + (Number(item.completed_count) || 0), 0)
  const totalCount = rows.reduce((sum, item) => sum + (Number(item.total_count) || 0), 0)
  const overallPercentage = totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0
  const strongCount = rows.filter(item => item.percentage >= 80).length
  const weakCount = rows.filter(item => item.percentage < 60).length
  const bestProcess = [...rows].sort((a, b) => b.percentage - a.percentage)[0]
  const weakestProcess = [...rows].sort((a, b) => a.percentage - b.percentage)[0]

  return {
    totalCompleted,
    totalCount,
    overallPercentage,
    strongCount,
    weakCount,
    bestProcess,
    weakestProcess,
  }
}

const statusBadge = (percentage: number) => {
  if (percentage >= 80) return { label: 'Healthy', tone: 'good' as StatusTone }
  if (percentage >= 60) return { label: 'Monitor', tone: 'warning' as StatusTone }
  return { label: 'At Risk', tone: 'critical' as StatusTone }
}

export default function TraceabilityDashboard({ archipelago, region, dateFrom, dateTo }: Props) {
  const [rows, setRows] = useState<DashboardItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(null)

      const response = await getInventoryTraceabilitySummary({ dateFrom, dateTo, region, archipelago })
      const normalized = Array.isArray(response?.response)
        ? response.response
        : Array.isArray(response?.data?.response)
          ? response.data.response
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response)
              ? response
              : []

      setRows(normalized as DashboardItem[])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Traceability Dashboard Error:', message)
      setLoadError(message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [archipelago, dateFrom, dateTo, region])

  useEffect(() => {
    loadData()
  }, [loadData])

  const summary = useMemo(() => summarizeRows(rows), [rows])
  const overallColors = getStatusColor(summary.overallPercentage)

  const summaryCards = [
    {
      label: 'Overall adoption',
      value: `${summary.overallPercentage}%`,
      meta: `${summary.totalCompleted}/${summary.totalCount} completed`,
      icon: Sigma,
      tone: overallColors.tone,
    },
    {
      label: 'Healthy stages',
      value: `${summary.strongCount}`,
      meta: '≥ 80% completion',
      icon: CheckCircle2,
      tone: 'good' as StatusTone,
    },
    {
      label: 'Needs attention',
      value: `${summary.weakCount}`,
      meta: 'below 60% completion',
      icon: AlertTriangle,
      tone: 'critical' as StatusTone,
    },
    {
      label: 'Best process',
      value: summary.bestProcess ? summary.bestProcess.process_name : '—',
      meta: summary.bestProcess ? `${summary.bestProcess.percentage}%` : 'No data',
      icon: Gauge,
      tone: 'neutral' as StatusTone,
    },
  ]

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Hatchery adoption</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">System Adoption Report</h1>
        </div>

        {!loading && rows.length > 0 && (
          <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium', overallColors.bg, overallColors.text)}>
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
            {statusBadge(summary.overallPercentage).label}
          </div>
        )}
      </div>

      {loadError && (
        <Card role="alert" className="border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <h2 className="font-semibold text-destructive">Unable to load the report</h2>
              <p className="mt-1 break-words text-sm text-muted-foreground">{loadError}</p>
            </div>
          </div>
        </Card>
      )}

      {!loading && !loadError && rows.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">No hatchery dashboard data found for the current filter.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="p-5 animate-pulse">
                <div className="mb-4 h-5 w-28 rounded bg-muted" />
                <div className="mb-4 h-9 w-24 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
              </Card>
            ))
          : summaryCards.map((card) => {
              const Icon = card.icon
              const toneClasses = {
                good: 'bg-emerald-500/10 text-emerald-600',
                warning: 'bg-amber-500/10 text-amber-600',
                critical: 'bg-red-500/10 text-red-600',
                neutral: 'bg-primary/10 text-primary',
              }

              return (
                <Card key={card.label} className="p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <h2 className="mt-2 text-3xl font-bold tracking-tight">{card.value}</h2>
                    </div>
                    <div className={cn('rounded-xl p-2.5', toneClasses[card.tone])}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{card.meta}</p>
                </Card>
              )
            })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Process coverage</h2>
              <p className="text-xs text-muted-foreground">Completed records across the hatchery workflow</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-3 pr-4 font-semibold">Process</th>
                  <th className="pb-3 pr-4 font-semibold">Coverage</th>
                  <th className="pb-3 pr-4 font-semibold">Completed</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const Icon = processIcons[item.process_name] || Package
                  const colors = getStatusColor(item.percentage)
                  const badge = statusBadge(item.percentage)

                  return (
                    <tr key={item.process_name} className="border-t align-middle">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={cn('rounded-lg p-1.5', colors.bg)}>
                            <Icon className={cn('h-4 w-4', colors.text)} />
                          </span>
                          <span className="font-medium">{item.process_name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="min-w-[180px]">
                          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{item.percentage}%</span>
                            <span>{item.completed_count}/{item.total_count}</span>
                          </div>
                          <Progress value={item.percentage} className={cn('h-2', colors.progress)} />
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-medium tabular-nums">{item.completed_count}/{item.total_count}</td>
                      <td className="py-3">
                        <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-medium',
                          badge.tone === 'good' && 'border-emerald-200 bg-emerald-500/10 text-emerald-700',
                          badge.tone === 'warning' && 'border-amber-200 bg-amber-500/10 text-amber-700',
                          badge.tone === 'critical' && 'border-red-200 bg-red-500/10 text-red-700')}>{badge.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-base font-semibold">Key insights</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Top performer</p>
              <p className="mt-2 text-lg font-semibold">{summary.bestProcess ? summary.bestProcess.process_name : 'No process data'}</p>
              <p className="text-sm text-muted-foreground">{summary.bestProcess ? `${summary.bestProcess.percentage}% completion` : 'Awaiting report data'}</p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Needs attention</p>
              <p className="mt-2 text-lg font-semibold">{summary.weakestProcess ? summary.weakestProcess.process_name : 'No process data'}</p>
              <p className="text-sm text-muted-foreground">{summary.weakestProcess ? `${summary.weakestProcess.percentage}% completion` : 'Awaiting report data'}</p>
            </div>

            <div className="rounded-lg border border-dashed p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Operational note</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {summary.weakCount > 0
                  ? `${summary.weakCount} process${summary.weakCount > 1 ? 'es are' : ' is'} under the 60% threshold and may warrant follow-up.`
                  : 'All hatchery stages are tracking above the risk threshold.'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
