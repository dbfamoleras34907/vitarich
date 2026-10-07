'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import readXlsxFile from 'read-excel-file/browser'
import { AlertTriangle, Check, CheckCircle2, Download, FileSpreadsheet, History, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PageHeader, PageHeaderActions, PageSection, PageSectionDescription, PageSectionHeader, PageSectionTitle, PageShell } from '@/components/ui/page-layout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  getBroilerDtwImportJobs,
  getBroilerDtwReferences,
  importBroilerDtwWorkbook,
} from '@/lib/data/repositories/broilerDtw'
import { exportBroilerDtwTemplate, parseBroilerDtwWorkbook } from './workbook'
import type { BroilerDtwImportJob, BroilerDtwMode, BroilerDtwReferences, BroilerDtwValidation } from './types'

const EMPTY_REFERENCES: BroilerDtwReferences = { farms: [], buildings: [], cycles: [] }
const errorText = (error: unknown, fallback: string) =>
  error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : fallback

export default function Layout() {
  const blocked = usePermission('/brd/dtw/view')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<BroilerDtwMode>('standard')
  const [references, setReferences] = useState<BroilerDtwReferences>(EMPTY_REFERENCES)
  const [jobs, setJobs] = useState<BroilerDtwImportJob[]>([])
  const [validation, setValidation] = useState<BroilerDtwValidation | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const counts = useMemo(() => validation ? [
    ['DOC Placement', validation.payload.placement.length],
    ['Growing', validation.payload.growing.length],
    ['Harvest & Delivery', validation.payload.harvest.length],
    ['Clean Up', validation.payload.cleanup.length],
  ] as const : [], [validation])

  const refresh = async () => {
    const [referenceResult, jobResult] = await Promise.allSettled([
      getBroilerDtwReferences(),
      getBroilerDtwImportJobs(),
    ])
    if (referenceResult.status === 'fulfilled') setReferences(referenceResult.value)
    if (jobResult.status === 'fulfilled') setJobs(jobResult.value)
    if (referenceResult.status === 'rejected') throw referenceResult.reason
    if (jobResult.status === 'rejected') throw jobResult.reason
  }

  useEffect(() => {
    if (blocked) {
      setLoading(false)
      return
    }
    void refresh()
      .catch(error => toast.error(errorText(error, 'Unable to load DTW.')))
      .finally(() => setLoading(false))
  }, [blocked])

  const handleFile = async (file: File) => {
    setWorking(true)
    setValidation(null)
    try {
      const sheets = await readXlsxFile(file)
      setValidation(parseBroilerDtwWorkbook(sheets, file.name, mode, references))
    } catch (error) {
      toast.error(errorText(error, 'The Excel workbook could not be read.'))
    } finally {
      setWorking(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleImport = async () => {
    if (!validation || validation.errors.length > 0) return
    setWorking(true)
    try {
      const result = await importBroilerDtwWorkbook(validation.payload)
      toast.success(`DTW import completed for ${result.cycleCount} cycle${result.cycleCount === 1 ? '' : 's'}.`)
      setValidation(null)
      await refresh()
    } catch (error) {
      toast.error(errorText(error, 'The DTW import failed. No workbook rows were imported.'))
    } finally {
      setWorking(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const workbookReferences = references.farms.length > 0
        ? references
        : await getBroilerDtwReferences()
      setReferences(workbookReferences)
      if (workbookReferences.farms.length === 0) {
        toast.error('No active, approved Broiler farms were found in the farms table.')
        return
      }
      if (workbookReferences.buildings.length === 0) {
        toast.error('No active Broiler buildings are available for the workbook dropdowns.')
        return
      }
      await exportBroilerDtwTemplate(workbookReferences)
    } catch (error) {
      toast.error(errorText(error, 'The DTW workbook could not be downloaded.'))
    } finally {
      setDownloading(false)
    }
  }

  if (blocked) return <PageShell><Alert variant="destructive"><AlertTitle>Access denied</AlertTitle><AlertDescription>You do not have permission to view Data Transfer Workbench.</AlertDescription></Alert></PageShell>

  return (
    <PageShell>
      <PageHeader>
        <div>
          <h1 className="text-lg font-semibold">Data Transfer Workbench</h1>
          <p className="text-xs text-muted-foreground">Import Broiler cycles sequentially from DOC Placement through Clean Up.</p>
        </div>
        <PageHeaderActions>
          <Button type="button" size="sm" variant="outline" disabled={downloading} onClick={() => void handleDownload()}>
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download Workbook
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={event => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
          }} />
          <Button type="button" size="sm" disabled={loading || working} onClick={() => fileInputRef.current?.click()}>
            {working ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Validate Workbook
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PageSection>
        <PageSectionHeader>
          <div><PageSectionTitle>Import mode</PageSectionTitle><PageSectionDescription>One mode applies to the complete workbook.</PageSectionDescription></div>
        </PageSectionHeader>
        <div className="grid gap-2 md:grid-cols-2">
          <button type="button" aria-pressed={mode === 'standard'} onClick={() => { setMode('standard'); setValidation(null) }} className={`min-h-11 rounded-md border p-3 text-left ${mode === 'standard' ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
            <span className="block text-sm font-medium">Standard</span>
            <span className="block text-xs text-muted-foreground">Requires normal fields, valid calculations, and sufficient inventory.</span>
          </button>
          <button type="button" aria-pressed={mode === 'legacy'} onClick={() => { setMode('legacy'); setValidation(null) }} className={`min-h-11 rounded-md border p-3 text-left ${mode === 'legacy' ? 'border-amber-500 bg-amber-50 text-amber-950' : 'border-border bg-card'}`}>
            <span className="flex items-center gap-2 text-sm font-medium"><span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${mode === 'legacy' ? 'border-amber-700 bg-amber-700 text-white' : 'border-input bg-background'}`}>{mode === 'legacy' && <Check className="size-3" />}</span> Legacy / Non-Regulated</span>
            <span className="mt-1 block text-xs opacity-75">Supports Legacy cycle continuation and suppresses notifications; automatic item and batch fields still use configured items and available stock.</span>
          </button>
        </div>
      </PageSection>

      {validation && (
        <PageSection>
          <PageSectionHeader>
            <div><PageSectionTitle>Validation preview</PageSectionTitle><PageSectionDescription>{validation.payload.fileName}</PageSectionDescription></div>
            <Button size="sm" disabled={working || validation.errors.length > 0} onClick={() => void handleImport()}>
              {working ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Import Workbook
            </Button>
          </PageSectionHeader>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {counts.map(([label, count]) => <div key={label} className="rounded-md border bg-card p-2"><div className="text-[11px] text-muted-foreground">{label}</div><div className="text-lg font-semibold tabular-nums">{count}</div></div>)}
          </div>
          {validation.errors.length > 0 && <Alert variant="destructive" className="mt-3"><AlertTriangle className="size-4" /><AlertTitle>Import blocked</AlertTitle><AlertDescription><ul className="mt-1 list-disc space-y-1 pl-5">{validation.errors.map(error => <li key={error}>{error}</li>)}</ul></AlertDescription></Alert>}
          {validation.warnings.length > 0 && <Alert className="mt-3 border-amber-300 bg-amber-50 text-amber-950"><AlertTriangle className="size-4" /><AlertTitle>Legacy warnings</AlertTitle><AlertDescription><ul className="mt-1 list-disc space-y-1 pl-5">{validation.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></AlertDescription></Alert>}
        </PageSection>
      )}

      <PageSection>
        <PageSectionHeader><div><PageSectionTitle><History className="mr-1 inline size-4" />Import history</PageSectionTitle><PageSectionDescription>Insert-only workbook jobs performed by the signed-in user.</PageSectionDescription></div></PageSectionHeader>
        <div className="max-w-full overflow-x-auto rounded-md border">
          <Table className="min-w-[760px]">
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>File</TableHead><TableHead>Mode</TableHead><TableHead>Cycles</TableHead><TableHead>Placement</TableHead><TableHead>Growing</TableHead><TableHead>Harvest</TableHead><TableHead>Clean Up</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={9}><Loader2 className="mx-auto size-4 animate-spin" /></TableCell></TableRow> : jobs.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground"><FileSpreadsheet className="mx-auto mb-1 size-5" />No imports yet.</TableCell></TableRow> : jobs.map(job => <TableRow key={job.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(job.createdAt).toLocaleString()}</TableCell><TableCell>{job.fileName}</TableCell><TableCell className="capitalize">{job.mode}</TableCell><TableCell>{job.cycleCount}</TableCell><TableCell>{job.placementCount}</TableCell><TableCell>{job.growingCount}</TableCell><TableCell>{job.harvestCount}</TableCell><TableCell>{job.cleanupCount}</TableCell><TableCell>{job.status}</TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </div>
      </PageSection>
    </PageShell>
  )
}
