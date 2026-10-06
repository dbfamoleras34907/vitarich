'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  allocationTotals, listReceivingSources, validateReceivingAllocations,
  type ReceivingAllocation, type ReceivingKind, type ReceivingSource,
} from '@/lib/data/repositories/receivingSources'

type Target = { key: string; label: string; allocations: ReceivingAllocation[] }
type Props = {
  kind: ReceivingKind
  farmId: number | null
  receiptId?: number | null
  targets: Target[]
  historical?: boolean
  disabled?: boolean
  onApply: (targetKey: string, allocations: ReceivingAllocation[], sources: ReceivingSource[]) => Promise<void> | void
}

export default function ReceivingSourcePicker({ kind, farmId, receiptId, targets, historical, disabled, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sources, setSources] = useState<ReceivingSource[]>([])
  const [targetKey, setTargetKey] = useState('')
  const [allocations, setAllocations] = useState<ReceivingAllocation[]>([])
  const [search, setSearch] = useState('')
  const action = historical ? 'Link Source' : 'Copy From'
  const total = allocationTotals(allocations)
  const linkedCount = targets.reduce((count, target) => count + target.allocations.length, 0)

  async function show() {
    if (!farmId) { toast.error('Select the receiving farm first.'); return }
    setBusy(true)
    try {
      const rows = await listReceivingSources(kind, farmId, receiptId)
      setSources(rows)
      setTargetKey(targets[0]?.key ?? 'new')
      setAllocations(targets[0]?.allocations ?? [])
      setSearch('')
      setOpen(true)
    } catch (error) {
      toast.error(error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unable to load dispatch sources.')
    } finally { setBusy(false) }
  }

  function update(source: ReceivingSource, field: 'quantity' | 'shortage' | 'doa' | 'rejects', value: string) {
    const quantity = Number(value)
    setAllocations(current => {
      const existing = current.find(row => row.sourceLineId === source.sourceLineId)
      const next = { ...(existing ?? { sourceLineId: source.sourceLineId, quantity: 0, shortage: 0, doa: 0, rejects: 0 }), [field]: quantity,
        sourceReference: source.sourceReference, documentNo: source.documentNo }
      return [...current.filter(row => row.sourceLineId !== source.sourceLineId), next].filter(row => row.quantity > 0 || row.shortage > 0 || row.doa > 0 || row.rejects > 0)
    })
  }

  async function apply() {
    setBusy(true)
    try {
      if (!allocations.length) throw new Error('Select at least one source and enter its quantity.')
      validateReceivingAllocations(allocations)
      for (const row of allocations) {
        const source = sources.find(source => source.sourceLineId === row.sourceLineId)
        if (!source || row.quantity > source.remainingQuantity) throw new Error('An allocation exceeds the remaining dispatch quantity. Refresh and review the source.')
        const elsewhere = targets.filter(target => target.key !== targetKey).flatMap(target => target.allocations)
          .filter(other => other.sourceLineId === row.sourceLineId).reduce((sum, other) => sum + other.quantity, 0)
        if (row.quantity + elsewhere > source.remainingQuantity) throw new Error('This source is already allocated to another line in this receipt.')
      }
      await onApply(targetKey, allocations, sources)
      setOpen(false)
    } catch (error) {
      toast.error(error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unable to apply source allocations.')
    } finally { setBusy(false) }
  }

  return <>
    <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => void show()}>{busy ? 'Loading…' : action}{linkedCount > 0 && <span className="text-xs">({linkedCount})</span>}</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value) }}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{action} — {kind === 'hatchery' ? 'Breeder Dispatch' : 'Hatchery DOC Dispatch'}</DialogTitle>
          <DialogDescription>{historical ? 'Attach verified source quantities to this existing receiving. Inventory and batch numbers remain unchanged.' : 'Choose posted dispatch lines addressed to this farm. All quantities are base quantities.'}</DialogDescription>
        </DialogHeader>
        <label className="space-y-1 text-sm">Receiving line
          <select className="block h-9 w-full rounded-md border bg-background px-2" value={targetKey} onChange={event => {
            setTargetKey(event.target.value)
            setAllocations(targets.find(target => target.key === event.target.value)?.allocations ?? [])
          }}>
            {!historical && <option value="new">New receiving line</option>}
            {targets.map(target => <option key={target.key} value={target.key}>{target.label}</option>)}
          </select>
        </label>
        <Input aria-label="Search dispatch sources" placeholder="Search document, source reference or item…" value={search} onChange={event => setSearch(event.target.value)} />
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm"><thead><tr className="bg-muted text-left">
            <th className="p-2">Dispatch / Item</th><th className="p-2">{kind === 'hatchery' ? 'Placement / Production Date' : 'DOC Batch'}</th>
            <th className="p-2">Remaining</th><th className="p-2">Allocate</th><th className="p-2">Short</th>
            {kind === 'broiler' && <><th className="p-2">DOA</th><th className="p-2">Reject</th></>}
          </tr></thead><tbody>
            {sources.filter(source => `${source.documentNo} ${source.description} ${source.sourceReference}`.toLowerCase().includes(search.toLowerCase())).map(source => {
              const row = allocations.find(row => row.sourceLineId === source.sourceLineId)
              return <tr key={source.sourceLineId} className="border-t">
                <td className="p-2"><div className="font-medium">{source.documentNo}</div><div>{source.description}</div><div className="text-xs text-muted-foreground">{source.originFarmName}</div></td>
                <td className="p-2">{source.sourceReference}{kind === 'hatchery' && <div className="text-xs text-muted-foreground">Placement #{source.placementId} · Produced {source.productionDate}</div>}</td>
                <td className="p-2 tabular-nums">{source.remainingQuantity.toLocaleString()}</td>
                {(['quantity', 'shortage', ...(kind === 'broiler' ? ['doa', 'rejects'] : [])] as const).map(field =>
                  <td key={field} className="p-2"><Input className="w-24" type="number" min="0" step="1" aria-label={`${field} ${source.documentNo} line ${source.sourceLineId}`} value={row?.[field as keyof ReceivingAllocation] ?? ''}
                    onChange={event => update(source, field as 'quantity' | 'shortage' | 'doa' | 'rejects', event.target.value)} /></td>)}
              </tr>
            })}
            {!sources.length && <tr><td colSpan={7} className="p-4 text-muted-foreground">No eligible posted dispatch lines for this farm.</td></tr>}
          </tbody></table>
        </div>
        <p className="text-sm">Allocated: {total.quantity.toLocaleString()} · Actual received: {total.actual.toLocaleString()}</p>
        {allocations.some(row => row.receivingBatch) && <div className="text-xs text-muted-foreground">
          {allocations.filter(row => row.receivingBatch).map(row => <p key={row.sourceLineId}>Receiving batch {row.receivingBatch} · Source {row.sourceReference} · {row.quantity.toLocaleString()}</p>)}
        </div>}
        <DialogFooter><Button type="button" disabled={busy || !targetKey} onClick={() => void apply()}>{busy ? 'Saving…' : action}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
