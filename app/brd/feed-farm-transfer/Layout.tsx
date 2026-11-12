'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, Copy, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import Breadcrumb from '@/lib/Breadcrumb'
import { usePermission } from '@/hooks/usePermission'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  approveFeedFarmTransfer,
  copyRemainingFeedInventory,
  getDefaultFeedWarehouse,
  listFeedFarmTransferFarms,
  listFeedFarmTransfers,
  saveFeedFarmTransfer,
  type FeedFarmTransfer,
  type FeedFarmTransferDraft,
  type FeedFarmTransferFarm,
  type FeedFarmTransferLine,
  type FeedFarmTransferWarehouse,
} from '@/lib/data/repositories/feedFarmTransfer'

const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const emptyDraft = (): FeedFarmTransferDraft => ({
  id: null,
  transferDate: today(),
  sourceFarmId: null,
  destinationFarmId: null,
  remarks: '',
  lines: [],
})

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const quantity = (value: number) => Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 6 })

function statusVariant(status: FeedFarmTransfer['status']): 'default' | 'secondary' | 'outline' {
  if (status === 'Approved') return 'default'
  if (status === 'Pending Approval') return 'secondary'
  return 'outline'
}

export default function FeedFarmTransferPage() {
  const cannotView = usePermission('/brd/feed-farm-transfer/view')
  const cannotInsert = usePermission('/brd/feed-farm-transfer/insert')
  const cannotEdit = usePermission('/brd/feed-farm-transfer/edit')
  const cannotApprove = usePermission('/brd/feed-farm-transfer/approval')
  const [tab, setTab] = useState('transfers')
  const [farms, setFarms] = useState<FeedFarmTransferFarm[]>([])
  const [transfers, setTransfers] = useState<FeedFarmTransfer[]>([])
  const [pending, setPending] = useState<FeedFarmTransfer[]>([])
  const [draft, setDraft] = useState<FeedFarmTransferDraft>(emptyDraft)
  const [sourceWarehouse, setSourceWarehouse] = useState<FeedFarmTransferWarehouse | null>(null)
  const [destinationWarehouse, setDestinationWarehouse] = useState<FeedFarmTransferWarehouse | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [approvingId, setApprovingId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [farmRows, transferRows, pendingRows] = await Promise.all([
        listFeedFarmTransferFarms(),
        listFeedFarmTransfers(),
        cannotApprove ? Promise.resolve([]) : listFeedFarmTransfers('Pending Approval'),
      ])
      setFarms(farmRows)
      setTransfers(transferRows)
      setPending(pendingRows)
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to load Feed Farm Transfers.'))
    } finally {
      setLoading(false)
    }
  }, [cannotApprove])

  useEffect(() => { void refresh() }, [refresh])

  const sourceFarm = useMemo(() => farms.find(farm => farm.id === draft.sourceFarmId) ?? null, [draft.sourceFarmId, farms])
  const destinationFarm = useMemo(() => farms.find(farm => farm.id === draft.destinationFarmId) ?? null, [draft.destinationFarmId, farms])
  const totalQuantity = useMemo(() => draft.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0), [draft.lines])
  const canSave = Boolean(
    !saving && draft.sourceFarmId && draft.destinationFarmId
    && draft.sourceFarmId !== draft.destinationFarmId
    && sourceWarehouse && destinationWarehouse
    && draft.lines.length > 0 && draft.lines.every(line => Number(line.quantity) > 0),
  )

  const resetForm = () => {
    setDraft(emptyDraft())
    setSourceWarehouse(null)
    setDestinationWarehouse(null)
    setFormOpen(false)
  }

  const changeFarm = async (kind: 'source' | 'destination', value: string) => {
    const farmId = value ? Number(value) : null
    setDraft(current => ({
      ...current,
      [kind === 'source' ? 'sourceFarmId' : 'destinationFarmId']: farmId,
      ...(kind === 'source' ? { lines: [] } : {}),
    }))
    const setter = kind === 'source' ? setSourceWarehouse : setDestinationWarehouse
    setter(null)
    if (!farmId) return
    try {
      setter(await getDefaultFeedWarehouse(farmId))
    } catch (error) {
      toast.error(errorMessage(error, `Unable to load the ${kind} default feed storage.`))
    }
  }

  const copyRemaining = async () => {
    if (!draft.sourceFarmId) return toast.info('Select the Source Farm first.')
    setCopying(true)
    try {
      const lines = await copyRemainingFeedInventory(draft.sourceFarmId)
      setDraft(current => ({ ...current, lines }))
      if (lines.length === 0) toast.info('No remaining feed inventory was found in the source default storage.')
      else toast.success(`${lines.length} remaining feed batch${lines.length === 1 ? '' : 'es'} copied.`)
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to copy remaining feed inventory.'))
    } finally {
      setCopying(false)
    }
  }

  const updateLine = (id: FeedFarmTransferLine['id'], value: number) => {
    setDraft(current => ({
      ...current,
      lines: current.lines.map(line => line.id === id ? { ...line, quantity: value } : line),
    }))
  }

  const removeLine = (id: FeedFarmTransferLine['id']) => {
    setDraft(current => ({ ...current, lines: current.lines.filter(line => line.id !== id) }))
  }

  const save = async (submitForApproval: boolean) => {
    if (!canSave) return toast.info('Complete the farms and feed quantities before saving.')
    setSaving(true)
    try {
      await saveFeedFarmTransfer(draft, submitForApproval)
      toast.success(submitForApproval ? 'Feed Farm Transfer submitted for approval.' : 'Feed Farm Transfer saved as Draft.')
      resetForm()
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to save Feed Farm Transfer.'))
    } finally {
      setSaving(false)
    }
  }

  const editDraft = (transfer: FeedFarmTransfer) => {
    setDraft({
      id: transfer.id,
      transferDate: transfer.transferDate,
      sourceFarmId: transfer.sourceFarmId,
      destinationFarmId: transfer.destinationFarmId,
      remarks: transfer.remarks,
      lines: transfer.lines,
    })
    setSourceWarehouse({ id: transfer.sourceWarehouseId, code: transfer.sourceWarehouseCode, name: transfer.sourceWarehouseName })
    setDestinationWarehouse({ id: transfer.destinationWarehouseId, code: transfer.destinationWarehouseCode, name: transfer.destinationWarehouseName })
    setFormOpen(true)
    setTab('transfers')
  }

  const approve = async (transfer: FeedFarmTransfer) => {
    setApprovingId(transfer.id)
    try {
      await approveFeedFarmTransfer(transfer.id)
      toast.success(`${transfer.transferNo} approved. Stock Out and Stock In were completed.`)
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error, 'Approval failed. No inventory movement was committed.'))
    } finally {
      setApprovingId(null)
    }
  }

  if (cannotView) return <main className="p-4 text-sm" role="alert">You do not have permission to view Feed Farm Transfer.</main>

  return (
    <main className="min-w-0 space-y-3 p-3 sm:p-4">
      <Breadcrumb CurrentPageName="Feed Farm Transfer" />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Feed Farm Transfer</h1>
          <p className="text-xs text-muted-foreground">Transfer feed between Broiler farms using each farm&apos;s default feed storage.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList>
          <TabsTrigger value="transfers">Feed Farm Transfer</TabsTrigger>
          {!cannotApprove && <TabsTrigger value="approval">For Approval <Badge variant="secondary" className="ml-1">{pending.length}</Badge></TabsTrigger>}
        </TabsList>

        <TabsContent value="transfers" className="mt-3 space-y-3">
          <div className="flex flex-wrap justify-end gap-2">
            {!cannotInsert && !formOpen && (
              <Button type="button" size="sm" onClick={() => { setDraft(emptyDraft()); setFormOpen(true) }}>
                <Plus className="size-4" /> New Transfer
              </Button>
            )}
          </div>

          {formOpen && (
            <section className="rounded-md border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                <div><h2 className="text-sm font-semibold">{draft.id ? 'Edit Draft Transfer' : 'New Feed Farm Transfer'}</h2><p className="text-xs text-muted-foreground">Copy current remaining batches, then adjust quantities if needed.</p></div>
                <Button type="button" variant="ghost" size="icon" onClick={resetForm} aria-label="Close transfer form"><X className="size-4" /></Button>
              </div>
              <div className="space-y-3 p-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1"><Label htmlFor="fft-date">Transfer Date</Label><Input id="fft-date" type="date" value={draft.transferDate} onChange={event => setDraft(current => ({ ...current, transferDate: event.target.value }))} /></div>
                  <div className="space-y-1"><Label htmlFor="fft-source">Source Farm</Label><select id="fft-source" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={draft.sourceFarmId ?? ''} onChange={event => void changeFarm('source', event.target.value)}><option value="">Select source farm</option>{farms.map(farm => <option key={farm.id} value={farm.id}>{farm.code} - {farm.name}</option>)}</select><p className="text-[11px] text-muted-foreground">Storage: {sourceWarehouse ? `${sourceWarehouse.code} - ${sourceWarehouse.name}` : sourceFarm ? 'No active default feed storage' : 'Select a farm'}</p></div>
                  <div className="space-y-1"><Label htmlFor="fft-destination">Destination Farm</Label><select id="fft-destination" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={draft.destinationFarmId ?? ''} onChange={event => void changeFarm('destination', event.target.value)}><option value="">Select destination farm</option>{farms.filter(farm => farm.id !== draft.sourceFarmId).map(farm => <option key={farm.id} value={farm.id}>{farm.code} - {farm.name}</option>)}</select><p className="text-[11px] text-muted-foreground">Storage: {destinationWarehouse ? `${destinationWarehouse.code} - ${destinationWarehouse.name}` : destinationFarm ? 'No active default feed storage' : 'Select a farm'}</p></div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h3 className="text-sm font-medium">Feed batches</h3><p className="text-[11px] text-muted-foreground">Quantities are copied at the current source balance and revalidated during approval.</p></div>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyRemaining()} disabled={!draft.sourceFarmId || copying}>
                    <Copy className="size-4" /> {copying ? 'Copying…' : 'Copy Remaining'}
                  </Button>
                </div>

                <div className="min-w-0 overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead className="bg-muted/50 text-left"><tr><th className="px-2 py-2">Feed</th><th className="px-2 py-2">Source Batch</th><th className="px-2 py-2">Mfg Date</th><th className="px-2 py-2">Expiry</th><th className="w-44 px-2 py-2 text-right">Transfer Qty</th><th className="w-12 px-2 py-2" /></tr></thead>
                    <tbody className="divide-y">
                      {draft.lines.map(line => <tr key={line.id}><td className="px-2 py-1.5"><div className="font-medium">{line.itemCode}</div><div className="text-muted-foreground">{line.description}</div></td><td className="px-2 py-1.5 font-medium">{line.sourceBatchNumber}</td><td className="px-2 py-1.5">{line.manufacturingDate || '-'}</td><td className="px-2 py-1.5">{line.expiryDate || '-'}</td><td className="px-2 py-1.5"><div className="flex items-center gap-2"><Input type="number" min="0.000001" step="0.000001" className="h-8 text-right" value={line.quantity} onChange={event => updateLine(line.id, Number(event.target.value))} /><span className="w-10 text-muted-foreground">{line.baseUom}</span></div></td><td className="px-2 py-1.5"><Button type="button" variant="ghost" size="icon" onClick={() => removeLine(line.id)} aria-label={`Remove ${line.itemCode} ${line.sourceBatchNumber}`}><Trash2 className="size-4" /></Button></td></tr>)}
                      {draft.lines.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Select a source farm, then use Copy Remaining.</td></tr>}
                    </tbody>
                    {draft.lines.length > 0 && <tfoot className="border-t bg-muted/20"><tr><td colSpan={4} className="px-2 py-2 text-right font-medium">Total</td><td className="px-2 py-2 text-right font-semibold">{quantity(totalQuantity)}</td><td /></tr></tfoot>}
                  </table>
                </div>

                <div className="space-y-1"><Label htmlFor="fft-remarks">Remarks</Label><Textarea id="fft-remarks" rows={2} value={draft.remarks} onChange={event => setDraft(current => ({ ...current, remarks: event.target.value }))} /></div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => void save(false)} disabled={!canSave || (draft.id ? cannotEdit : cannotInsert)}>{saving ? 'Saving…' : 'Save as Draft'}</Button>
                  <Button type="button" onClick={() => void save(true)} disabled={!canSave || (draft.id ? cannotEdit : cannotInsert)}><Check className="size-4" />{saving ? 'Submitting…' : 'Submit for Approval'}</Button>
                </div>
              </div>
            </section>
          )}

          <TransferTable transfers={transfers} loading={loading} action={transfer => transfer.status === 'Draft' && !cannotEdit ? <Button type="button" variant="outline" size="sm" onClick={() => editDraft(transfer)}><Pencil className="size-4" /> Edit</Button> : null} />
        </TabsContent>

        {!cannotApprove && <TabsContent value="approval" className="mt-3"><TransferTable transfers={pending} loading={loading} action={transfer => <Button type="button" size="sm" disabled={approvingId !== null} onClick={() => void approve(transfer)}><Check className="size-4" />{approvingId === transfer.id ? 'Approving…' : 'Approve'}</Button>} /></TabsContent>}
      </Tabs>
    </main>
  )
}

function TransferTable({ transfers, loading, action }: { transfers: FeedFarmTransfer[]; loading: boolean; action: (transfer: FeedFarmTransfer) => ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border bg-card">
      <div className="border-b px-3 py-2"><h2 className="text-sm font-semibold">Transfer History</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="bg-muted/50 text-left"><tr><th className="px-3 py-2">Transfer No.</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Destination</th><th className="px-3 py-2">Feed / Batch</th><th className="px-3 py-2 text-right">Quantity</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
          <tbody className="divide-y">
            {transfers.map(transfer => <tr key={transfer.id}><td className="px-3 py-2 font-semibold">{transfer.transferNo}</td><td className="px-3 py-2">{transfer.transferDate}</td><td className="px-3 py-2"><div>{transfer.sourceFarmName}</div><div className="text-muted-foreground">{transfer.sourceWarehouseCode}</div></td><td className="px-3 py-2"><div>{transfer.destinationFarmName}</div><div className="text-muted-foreground">{transfer.destinationWarehouseCode}</div></td><td className="px-3 py-2"><div>{transfer.lines.length} batch{transfer.lines.length === 1 ? '' : 'es'}</div><div className="max-w-64 truncate text-muted-foreground">{transfer.lines.map(line => `${line.itemCode}/${line.sourceBatchNumber}`).join(', ')}</div></td><td className="px-3 py-2 text-right font-medium">{quantity(transfer.lines.reduce((sum, line) => sum + line.quantity, 0))}</td><td className="px-3 py-2 text-center"><Badge variant={statusVariant(transfer.status)}>{transfer.status}</Badge></td><td className="px-3 py-2 text-right">{action(transfer)}</td></tr>)}
            {!loading && transfers.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No Feed Farm Transfers found.</td></tr>}
            {loading && <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">Loading transfers…</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
