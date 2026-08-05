import { Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatQuantity } from './formUtils'

type PostGoodsReceiptDialogProps = {
  open: boolean
  receiptNumber: string
  totalQuantity: number
  saving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

export default function PostGoodsReceiptDialog({
  open,
  receiptNumber,
  totalQuantity,
  saving,
  onOpenChange,
  onConfirm,
}: PostGoodsReceiptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post this goods receipt?</DialogTitle>
          <DialogDescription>
            Posting {receiptNumber} will add inventory for the selected receipt lines and cannot be edited afterward.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-stone-500">Total Base Quantity</span>
            <span className="font-semibold tabular-nums">{formatQuantity(totalQuantity)}</span>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>Cancel</Button>
          </DialogClose>
          <Button type="button" disabled={saving} onClick={onConfirm}>
            <Save className="size-4" />
            {saving ? 'Posting...' : 'Confirm Post'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
