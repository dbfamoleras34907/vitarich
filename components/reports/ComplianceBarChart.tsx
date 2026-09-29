'use client'

import { useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ChartContainer } from '@/components/ui/chart'
import { exportChartPng } from '@/lib/reports/exportChart'
import type { groupCompliance } from '@/lib/broiler/dataCompliance'
import MaximizableCard from './MaximizableCard'

type Group = ReturnType<typeof groupCompliance>[number]
export type ComplianceSeries = { key: 'compliance' | 'updated' | 'overdue' | 'review' | 'notDue' | 'short' | 'medium' | 'long'; label: string; color: string }

type ComplianceBarChartProps = {
  title: string; description: string; data: Group[]; series: ComplianceSeries[]; percent?: boolean
  onSelect: (key: string) => void; exportContext: string
}

export default function ComplianceBarChart(props: ComplianceBarChartProps) {
  return <MaximizableCard title={props.title}>{(maximized, close) => <ComplianceBarChartContent {...props} maximized={maximized} onSelect={key => { close(); props.onSelect(key) }} />}</MaximizableCard>
}

function ComplianceBarChartContent({ title, description, data, series, percent = false, onSelect, exportContext, maximized }: ComplianceBarChartProps & { maximized: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  async function exportPng() {
    const svg = ref.current?.querySelector('svg.recharts-surface')
    if (!(svg instanceof SVGSVGElement)) return
    setExporting(true)
    try { await exportChartPng(svg, title, exportContext, series.map(item => item.label).join(' • ')) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to export chart.') }
    finally { setExporting(false) }
  }
  const selectBar = (value: unknown) => {
    if (!value || typeof value !== 'object' || !('payload' in value)) return
    const payload = value.payload
    if (payload && typeof payload === 'object' && 'key' in payload) onSelect(String(payload.key))
  }
  return <div ref={ref} className="min-w-0 bg-card p-4 text-card-foreground">
    <div className={`flex items-start justify-between gap-2 ${maximized ? '' : 'pr-8'}`}>
      <div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>
      <Button variant="ghost" size="icon" className="print:hidden" aria-label={`Download ${title} as PNG`} disabled={!data.length || exporting} onClick={() => void exportPng()}><Download className="size-4" /></Button>
    </div>
    <div className="my-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">{series.map(item => <span key={item.key} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: item.color }} />{item.label}</span>)}</div>
    {!data.length ? <p className="flex h-52 items-center justify-center text-sm text-muted-foreground">No matching records.</p> : <div className={maximized ? '' : 'max-h-[480px] overflow-y-auto print:max-h-none print:overflow-visible'}>
      <ChartContainer config={Object.fromEntries(series.map(item => [item.key, { label: item.label, color: item.color }]))} className="w-full aspect-auto" style={{ height: maximized ? `max(60vh, ${data.length * 48 + 40}px)` : Math.max(210, data.length * 42 + 40) }}>
        <BarChart data={data} layout="vertical" accessibilityLayer margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" domain={percent ? [0, 100] : [0, 'auto']} allowDecimals={percent} tickFormatter={value => percent ? `${value}%` : String(value)} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={maximized ? 200 : 115} tick={{ fontSize: maximized ? 13 : 11 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={value => percent ? `${Number(value).toFixed(1)}%` : String(value)} />
          {series.map(item => <Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color} stackId="status" barSize={22} isAnimationActive={false} onClick={selectBar} className="cursor-pointer" />)}
        </BarChart>
      </ChartContainer>
    </div>}
    {!!data.length && <details className="mt-2 text-xs print:hidden"><summary className="cursor-pointer text-muted-foreground">View values / open matching records</summary>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">{data.map(row => <li key={row.key}><button type="button" className="flex w-full justify-between gap-3 rounded px-2 py-1 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onSelect(row.key)}><span>{row.label}</span><span>{percent ? row.compliance === null ? 'Not assessed' : `${row.compliance.toFixed(1)}%` : series.map(item => `${item.label}: ${row[item.key] ?? '—'}`).join(' · ')}</span></button></li>)}</ul>
    </details>}
  </div>
}
