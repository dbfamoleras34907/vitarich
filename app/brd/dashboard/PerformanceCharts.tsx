'use client'

import { useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { DashboardBuilding, DashboardCycleBuilding } from '@/lib/data/repositories/broilerCycleDashboard'
import { ageRange, dashboardMetrics, dashboardPerformance, type PerformancePoint } from '@/lib/broiler/cycleDashboard'

const chartStyle = { fontSize: 11 }
const tooltipStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--foreground)', fontSize: 12 }
const number = (value: unknown) => typeof value === 'number'
  ? value.toLocaleString('en-PH', { maximumFractionDigits: 2 }) : String(value ?? '—')

function Trend({ title, unit, data, actual, standard, actualLabel = 'Actual', standardLabel = 'Standard' }: {
  title: string
  unit: string
  data: PerformancePoint[]
  actual: keyof PerformancePoint
  standard: keyof PerformancePoint
  actualLabel?: string
  standardLabel?: string
}) {
  const hasData = data.some(point => point[actual] !== null)
  return <section className="min-w-0 rounded-lg border border-stone-200 bg-card p-3 dark:border-border" aria-label={title}>
    <h3 className="text-xs font-medium">{title}</h3>
    <p className="mb-3 mt-1 text-[10px] text-muted-foreground">{unit} · Posted age in days</p>
    {!hasData ? <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">No posted measurements</div> :
      <div className="h-48 w-full" role="img" aria-label={`${title}. Exact values are available in the detail tabs.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} style={chartStyle} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="age" type="number" domain={['dataMin', 'dataMax']} allowDecimals={false} tickLine={false} axisLine={false} minTickGap={18} />
            <YAxis width={45} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={number} labelFormatter={age => `Age ${age}`} />
            <Legend iconType="plainline" />
            <Line type="linear" dataKey={actual} name={actualLabel} stroke="#00754a" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
            <Line type="linear" dataKey={standard} name={standardLabel} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>}
  </section>
}

export function PerformanceCharts({ cycles }: { cycles: DashboardCycleBuilding[] }) {
  const data = dashboardPerformance(cycles)
  return <section className="space-y-3">
    <div>
      <h2 className="text-sm font-semibold">Cycle Performance</h2>
      {cycles.length > 1 && <p className="mt-1 text-[11px] text-muted-foreground">Aligned by age. Weight, feed, and water use bird-weighted measurements available at that age. Mortality totals require all selected flocks.</p>}
    </div>
    <div className="grid gap-3 xl:grid-cols-2">
      <Trend title="Body Weight" unit="g / bird" data={data} actual="weight" standard="standardWeight" />
      <Trend title="Mortality" unit="birds" data={data} actual="mortality" standard="cumulativeMortality" actualLabel="Daily" standardLabel="Cumulative" />
      <Trend title="Feed Consumption" unit="g / bird / day" data={data} actual="feed" standard="standardFeed" />
      <Trend title="Water Consumption" unit="mL / bird / day" data={data} actual="water" standard="standardWater" standardLabel="Guideline" />
    </div>
  </section>
}

const comparisons = [
  { key: 'mortalityPercent', label: 'Mortality (%)' },
  { key: 'weight', label: 'Body weight (g / bird)' },
  { key: 'feed', label: 'Feed consumed (kg)' },
  { key: 'water', label: 'Water consumed (L)' },
  { key: 'remaining', label: 'Remaining birds' },
  { key: 'deliveredHeads', label: 'Delivered heads' },
] as const

export function BuildingComparison({ buildings, onSelect }: { buildings: DashboardBuilding[]; onSelect: (key: string) => void }) {
  const [metric, setMetric] = useState<string>('mortalityPercent')
  const current = buildings.filter(building => building.cycles.length)
  const data = current.map(building => {
    const metrics = dashboardMetrics(building.cycles)
    return { ...metrics, name: building.code || building.name, key: building.key,
      age: ageRange(metrics.postedAges), cycle: [...new Set(building.cycles.map(cycle => cycle.cycleNumber))].join(', ') }
  })
  const label = comparisons.find(item => item.key === metric)?.label ?? ''
  return <section className="min-w-0 space-y-3 rounded-lg border border-stone-200 bg-card p-3 dark:border-border">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-sm font-semibold">Building Comparison</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">Selected cycle · Compare posted ages before assessing performance.</p></div>
      <select aria-label="Comparison metric" value={metric} onChange={event => setMetric(event.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
        {comparisons.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select>
    </div>
    <div className="h-52" role="img" aria-label={`${label} by building. Values and cycle ages appear in the table below.`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} style={chartStyle}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tickLine={false} /><YAxis width={50} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={number} />
          <Bar dataKey={metric} name={label} fill="#00754a" radius={[3, 3, 0, 0]} maxBarSize={50} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-xs">
        <thead className="border-y bg-muted/40 text-muted-foreground"><tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
          <th>Building</th><th>Cycle</th><th>Posted age</th><th>Calendar age</th><th>{label}</th>
        </tr></thead>
        <tbody>{data.map(row => <tr key={row.key} className="border-b last:border-0 [&>td]:px-2 [&>td]:py-2">
          <td><button type="button" className="text-primary underline underline-offset-2" onClick={() => onSelect(row.key)}>{row.name}</button></td>
          <td>{row.cycle}</td><td>{row.age}</td><td>{ageRange(row.calendarAges)}</td>
          <td className="tabular-nums">{number(row[metric as typeof comparisons[number]['key']])}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>
}
