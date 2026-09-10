'use client'

import { useState } from 'react'
import { Copy, Download, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { usePermission } from '@/hooks/usePermission'

const TEMPLATES = [
  {
    id: 'farm-addition',
    title: 'Farm Master Addition',
    description: 'Farm information, contact details, location, and number of buildings.',
    instructions: 'Complete one template per farm. Farm Code is assigned during farm setup.',
    path: '/templates/farm-master-addition.xlsx',
    ready: true,
  },
  {
    id: 'item-addition',
    title: 'Item Master Addition',
    description: 'Item details, groups, units of measure, item usage, and batch control.',
    instructions: 'Complete one template per item. Item Code is assigned when the item is created.',
    path: '/templates/item-master-addition.xlsx',
    ready: true,
  },
]

export default function ExcelRequestFilesPage() {
  const cannotView = usePermission('/others/excel-request-files/view')
  const [manualCopyLink, setManualCopyLink] = useState('')

  async function copyLink(path: string) {
    const url = new URL(path, window.location.origin).href
    try {
      await navigator.clipboard.writeText(url)
      setManualCopyLink('')
      toast.success('Link copied. Anyone with the link can download the template without signing in.')
    } catch {
      setManualCopyLink(url)
      toast.error('Unable to copy automatically. Select and copy the link shown below.')
    }
  }

  if (cannotView) {
    return <p className="p-4 text-sm text-muted-foreground">You do not have permission to view Excel Request Files.</p>
  }

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold">Excel Request Files</h1>
        <p className="text-sm text-muted-foreground">Download and complete an Excel template for your request.</p>
      </header>
      {TEMPLATES.map(template => (
      <section key={template.id} aria-labelledby={`${template.id}-title`} className="flex flex-wrap items-center justify-between gap-4 rounded-md border p-4">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <h2 id={`${template.id}-title`} className="text-sm font-semibold">{template.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">{template.instructions}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {template.ready ? <Button asChild size="sm">
            <a href={template.path} download={template.path.split('/').at(-1)}>
              <Download className="size-4" /> Download Excel Template
            </a>
          </Button> : <Button size="sm" disabled>Template in preparation</Button>}
          <Button type="button" variant="outline" size="sm" disabled={!template.ready} onClick={() => copyLink(template.path)}>
            <Copy className="size-4" /> Copy Link
          </Button>
        </div>
        {template.ready && <p className="w-full text-xs text-muted-foreground">Share the link with anyone. They can download this blank template without signing in.</p>}
        {manualCopyLink.endsWith(template.path) && (
          <input
            aria-label="Template download link"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={manualCopyLink}
            readOnly
            onFocus={event => event.currentTarget.select()}
          />
        )}
      </section>
      ))}
    </div>
  )
}
