'use client'

import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  PageActionBar,
  PageHeader,
  PageHeaderActions,
  PageSection,
  PageSectionDescription,
  PageSectionHeader,
  PageSectionTitle,
  PageShell,
} from '@/components/ui/page-layout'
import { usePermission } from '@/hooks/usePermission'
import {
  getHatcheryExtractData,
  HATCHERY_EXTRACT_MODULES,
  type HatcheryExtractModuleKey,
} from '@/lib/data/repositories/hatcheryExtract'
import { exportReportWorkbook } from '@/lib/reports/exportWorkbook'
import { hatcheryExtractSheets } from '@/lib/reports/hatcheryExtract'

function currentMonth() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to create the Hatchery extract.'
}

export default function HatcheryExtractData() {
  const blocked = usePermission('/a_dean/hatchery/extract-data/view')
  const month = useMemo(currentMonth, [])
  const [dateFrom, setDateFrom] = useState(month.from)
  const [dateTo, setDateTo] = useState(month.to)
  const [selected, setSelected] = useState<Set<HatcheryExtractModuleKey>>(
    () => new Set(HATCHERY_EXTRACT_MODULES.map(module => module.key)),
  )
  const [exporting, setExporting] = useState(false)

  function toggleModule(key: HatcheryExtractModuleKey, checked: boolean) {
    setSelected(current => {
      const next = new Set(current)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  async function exportData() {
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      toast.error('Enter a valid From Date and To Date range.')
      return
    }
    if (!selected.size) {
      toast.error('Select at least one Hatchery module.')
      return
    }

    setExporting(true)
    try {
      const data = await getHatcheryExtractData({ dateFrom, dateTo, moduleKeys: [...selected] })
      await exportReportWorkbook(hatcheryExtractSheets(data), `Hatchery Extract ${dateFrom} to ${dateTo}.xlsx`)
      if (data.warnings.length) toast.warning(data.warnings.join(' '))
      else toast.success('Hatchery data exported to Excel.')
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setExporting(false)
    }
  }

  if (blocked) return <PageShell><div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">You do not have permission to extract Hatchery data.</div></PageShell>

  return <PageShell>
    <PageHeader>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Extract Data</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Download complete Hatchery table records by creation date. Each selected module is placed on its own Excel tab.</p>
      </div>
      <PageHeaderActions>
        <Button size="sm" disabled={exporting || selected.size === 0} onClick={() => void exportData()}>
          <Download className={exporting ? 'animate-pulse' : ''} />{exporting ? 'Creating Excel…' : 'Extract Excel'}
        </Button>
      </PageHeaderActions>
    </PageHeader>

    <PageSection>
      <PageSectionHeader>
        <div>
          <PageSectionTitle>Creation date</PageSectionTitle>
          <PageSectionDescription>Records are included when their header creation date falls within this date range.</PageSectionDescription>
        </div>
      </PageSectionHeader>
      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="block text-xs font-semibold text-muted-foreground">From Date</span>
          <input className="h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10" type="date" value={dateFrom} max={dateTo} onChange={event => setDateFrom(event.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="block text-xs font-semibold text-muted-foreground">To Date</span>
          <input className="h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10" type="date" value={dateTo} min={dateFrom} onChange={event => setDateTo(event.target.value)} />
        </label>
      </div>
    </PageSection>

    <PageSection>
      <PageSectionHeader>
        <div>
          <PageSectionTitle>Modules</PageSectionTitle>
          <PageSectionDescription>All modules default to Yes. Header and line records are separate tables inside the module tab.</PageSectionDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set(HATCHERY_EXTRACT_MODULES.map(module => module.key)))}>Select All</Button>
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Clear All</Button>
        </div>
      </PageSectionHeader>
      <div className="divide-y">
        {HATCHERY_EXTRACT_MODULES.map(module => {
          const checked = selected.has(module.key)
          return <label key={module.key} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-muted/30">
            <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
              <Checkbox checked={checked} onCheckedChange={value => toggleModule(module.key, value === true)} aria-label={`Include ${module.label}`} />
              <span className="truncate">{module.label}</span>
            </span>
            <span className={checked ? 'text-xs font-semibold text-primary' : 'text-xs font-medium text-muted-foreground'}>{checked ? 'Yes' : 'No'}</span>
          </label>
        })}
      </div>
      <PageActionBar>
        <span className="mr-auto text-xs text-muted-foreground">{selected.size} of {HATCHERY_EXTRACT_MODULES.length} modules selected</span>
        <Button disabled={exporting || selected.size === 0} onClick={() => void exportData()}>
          <FileSpreadsheet />{exporting ? 'Creating Excel…' : 'Extract Excel'}
        </Button>
      </PageActionBar>
    </PageSection>
  </PageShell>
}
