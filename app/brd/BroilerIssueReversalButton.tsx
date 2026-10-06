'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { usePermission } from '@/hooks/usePermission'
import { reverseBroilerDelivery } from '@/lib/data/repositories/brDelivery'
import { reverseBroilerCleanup } from '@/lib/data/repositories/brCleanup'

export default function BroilerIssueReversalButton({ kind = 'cleanup', documentId, documentNo, status, onReversed, open: controlledOpen, onOpenChange }: {
  kind?: 'cleanup' | 'harvest'
  documentId: number | null
  documentNo: string
  status: string
  onReversed: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const cleanup = kind === 'cleanup'
  const label = cleanup ? 'Clean Up' : 'Harvest & Delivery'
  const conVoid = usePermission(cleanup ? '/brd/cu/void' : '/brd/dr/void')
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  if (status !== 'Posted' || documentId === null) return null

  async function reverse() {
    if (conVoid || saving || documentId === null || !reason.trim()) return
    setSaving(true)
    try {
      await (cleanup ? reverseBroilerCleanup : reverseBroilerDelivery)(documentId, reason)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to reverse ${label}.`)
      setSaving(false)
      return
    }
    setSaving(false)
    setOpen(false)
    setReason('')
    toast.success(cleanup ? 'Clean Up reversed. Inventory restored and cycle reopened.' : 'Harvest & Delivery reversed. Harvested inventory restored.')
    onReversed()
  }

  return <>
    {controlledOpen === undefined && <Button type="button" size="sm" variant="outline" disabled={conVoid} onClick={() => setOpen(true)}>Reverse</Button>}
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reverse {label} {documentNo}</DialogTitle>
          <DialogDescription>{cleanup ? 'This will void the cleanup, restore its cleanup and variance quantities, and reopen the cycle. A newer cycle or subsequent building transaction will block reversal.' : 'This will void the harvest and restore its harvested inventory. Only the current active cycle qualifies. Posted Clean Up must be reversed first; draft and voided cleanup do not block reversal.'}</DialogDescription>
        </DialogHeader>
        <label className="space-y-1 text-sm">Reversal reason
          <Textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} disabled={saving} required />
        </label>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={conVoid || saving || !reason.trim()} onClick={reverse}>{saving ? 'Reversing…' : 'Confirm Reversal'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
