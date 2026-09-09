'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Download, FileCode2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { requestWorkspaceTimelineSql, type WorkspaceTimelineSql } from '@/lib/data/repositories/workspaceTimelineSql'

export default function TimelineSqlDialog() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<WorkspaceTimelineSql | null>(null)
  const [error, setError] = useState('')
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => () => requestRef.current?.abort(), [])

  const changeOpen = (next: boolean) => {
    requestRef.current?.abort()
    requestRef.current = null
    setPassword('')
    setResult(null)
    setError('')
    setLoading(false)
    setOpen(next)
  }

  const loadSql = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError('')
    try {
      const data = await requestWorkspaceTimelineSql(password, controller.signal)
      if (!controller.signal.aborted) {
        setResult(data)
        setPassword('')
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const message = err instanceof Error ? err.message
          : typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string'
            ? err.message : 'Unable to load the timeline SQL.'
        setError(message)
        toast.error(message)
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const copySql = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.sql)
      toast.success('SQL copied.')
    } catch {
      toast.error('Unable to copy. Select the SQL manually or download the file.')
    }
  }

  const downloadSql = () => {
    if (!result) return
    const url = URL.createObjectURL(new Blob([result.sql], { type: 'application/sql;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = result.filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><FileCode2 className="mr-2 h-4 w-4" />Timeline SQL</Button>
      </DialogTrigger>
      <DialogContent className={result ? 'sm:max-w-4xl max-h-[90vh] overflow-y-auto' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle>Timeline SQL</DialogTitle>
          <DialogDescription>
            August 31–September 4, 2026 · 6 tickets · 45 hours. Prepared for user 1 and Broiler project 4.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <>
            <p className="text-sm text-muted-foreground">Copy or download the prepared script. Hours are estimated allocations. Generating SQL does not save records.</p>
            <Label htmlFor="timeline-sql-preview">SQL</Label>
            <Textarea id="timeline-sql-preview" readOnly value={result.sql} spellCheck={false} className="h-[50vh] min-h-64 font-mono text-xs whitespace-pre" />
            <DialogFooter>
              <Button variant="outline" onClick={() => void copySql()}><Copy className="mr-2 h-4 w-4" />Copy SQL</Button>
              <Button onClick={downloadSql}><Download className="mr-2 h-4 w-4" />Download SQL</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={loadSql} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timeline-sql-password">Password</Label>
              <Input id="timeline-sql-password" type="password" autoComplete="off" value={password} onChange={event => setPassword(event.target.value)} maxLength={256} required disabled={loading} aria-invalid={Boolean(error)} aria-describedby={error ? 'timeline-sql-error' : undefined} />
            </div>
            {error && <p id="timeline-sql-error" role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading || !password}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Generate SQL
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
