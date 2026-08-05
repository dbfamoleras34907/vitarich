import type { KeyboardEventHandler, ReactNode } from 'react'

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

type BatchDetailsDialogProps = {
  open: boolean
  itemCode?: string
  children: ReactNode
  onClose: () => void
}

export default function BatchDetailsDialog({
  open,
  itemCode,
  children,
  onClose,
}: BatchDetailsDialogProps) {
  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = event => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={nextOpen => !nextOpen && onClose()}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-4xl"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>Batch Details</DialogTitle>
          <DialogDescription>
            {itemCode || 'Selected item'} batch information for this receipt line.
          </DialogDescription>
        </DialogHeader>

        {children}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
