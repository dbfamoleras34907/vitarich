'use client'

import { useState, type ReactNode } from 'react'
import { Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/** Keep dashboard layout in place while presenting the same data in a full viewport dialog. */
export default function MaximizableCard({ title, children, className }: {
  title: string
  children: (maximized: boolean, close: () => void) => ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return <Dialog open={open} onOpenChange={setOpen}>
    <section className={cn('relative min-w-0 rounded-xl border bg-card text-card-foreground print:break-inside-avoid', className)}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 z-10 print:hidden" aria-label={`Maximize ${title}`} title={`Maximize ${title}`}><Maximize2 className="size-4" /></Button>
      </DialogTrigger>
      {children(false, close)}
    </section>
    <DialogContent className="inset-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-4 overflow-hidden rounded-none border-0 p-4 sm:max-w-none sm:p-6">
      <DialogHeader className="shrink-0 pr-10 text-left">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">Fullscreen card. Press Escape or use Close to return to the dashboard.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{children(true, close)}</div>
    </DialogContent>
  </Dialog>
}
