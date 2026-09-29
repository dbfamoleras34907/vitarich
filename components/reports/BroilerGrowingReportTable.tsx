import type { BroilerCycleBuilding } from '@/lib/data/repositories/broilerCycleReport'
import { cn } from '@/lib/utils'

const formatNumber = (value: number) => Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 3 })

export default function BroilerGrowingReportTable({ building }: { building: BroilerCycleBuilding }) {
  if (!building.growingLines.length) return <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
    No Growing &amp; Farm Condition records for this Building.
  </div>

  return <div className="max-h-[60vh] overflow-auto rounded-lg border bg-card">
    <table className="min-w-[1840px] border-collapse text-sm">
      <thead className="sticky top-0 z-20 bg-muted shadow-sm">
        <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <th rowSpan={2} className="sticky left-0 z-30 border-r bg-muted px-3 py-3 text-center">Age</th>
          <th colSpan={3} className="border-r bg-destructive/5 px-3 py-2 text-center">Mortality</th>
          <th colSpan={3} className="border-r bg-amber-500/5 px-3 py-2 text-center">Thinning</th>
          <th colSpan={2} className="border-r px-3 py-2 text-center">Batch</th>
          <th colSpan={4} className="border-r bg-primary/5 px-3 py-2 text-center">Feeds Consumption</th>
          <th colSpan={3} className="border-r bg-sky-500/5 px-3 py-2 text-center">Water Intake</th>
          <th colSpan={2} className="border-r px-3 py-2 text-center">Average Live Weight</th>
          <th colSpan={2} className="px-3 py-2 text-center">Average Daily Gain</th>
        </tr>
        <tr className="border-b text-xs [&>th]:whitespace-nowrap [&>th]:border-r [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-semibold">
          <th>AM</th><th>PM</th><th>Total</th><th>AM</th><th>PM</th><th>Total</th>
          <th>DOC Batch</th><th>Cumulative</th><th>Actual FC</th><th>Feed Type</th><th>Standard FC</th><th>Feeds Batch</th>
          <th>Daily L/Flock</th><th>Daily per Bird</th><th>Guideline</th><th>Actual ALW</th><th>Standard ALW</th>
          <th>Actual ADG</th><th>Standard ADG</th>
        </tr>
      </thead>
      <tbody>{building.growingLines.map((row, index) => <tr key={row.id} className={cn('border-b transition-colors last:border-0 hover:bg-muted/60 [&>td]:border-r [&>td]:px-3 [&>td]:py-2.5 [&>td]:text-right', index % 2 === 1 && 'bg-muted/20', row.age % 5 === 4 && 'bg-primary/5', row.isVoided && 'text-muted-foreground line-through')}>
        <td className="sticky left-0 z-10 bg-card text-center font-semibold shadow-[1px_0_0_var(--border)]">{row.age}</td>
        <td>{formatNumber(row.mortalityAm)}</td><td>{formatNumber(row.mortalityPm)}</td><td className="font-medium">{formatNumber(row.mortalityTotal)}</td>
        <td>{formatNumber(row.thinningAm)}</td><td>{formatNumber(row.thinningPm)}</td><td className="font-medium">{formatNumber(row.thinningTotal)}</td>
        <td className="max-w-40 text-left">{row.docBatch || '-'}</td><td>{formatNumber(row.cumulative)}</td>
        <td>{formatNumber(row.feedActual)}</td><td className="text-left">{row.feedType || '-'}</td><td>{formatNumber(row.feedStandard)}</td><td className="text-left">{row.feedBatch || '-'}</td>
        <td>{formatNumber(row.waterLiters)}</td><td>{formatNumber(row.waterPerBird)}</td><td>{formatNumber(row.waterGuideline)}</td>
        <td>{formatNumber(row.actualWeight)}</td><td>{formatNumber(row.standardWeight)}</td><td>{formatNumber(row.actualAdg)}</td><td>{formatNumber(row.standardAdg)}</td>
      </tr>)}</tbody>
    </table>
  </div>
}
