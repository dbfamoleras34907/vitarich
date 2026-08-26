'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ClipboardList, FolderKanban, Plus, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import Breadcrumb from '@/lib/Breadcrumb'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { usePermission } from '@/hooks/usePermission'
import {
  getWorkspaceProjects,
  getWorkspaceTaskStatuses,
  getWorkspaceTasksForUser,
  type WorkspaceProject,
  type WorkspaceTask,
  type WorkspaceTaskStatus,
} from '@/lib/data/repositories/workspace'

export default function Layout() {
  const router = useRouter()
  const { getValue } = useGlobalContext()
  const taskInsertDenied = usePermission('/wks/tasks/insert')
  const projectInsertDenied = usePermission('/wks/projects/insert')
  const timesheetInsertDenied = usePermission('/wks/timelines/insert')
  const [projects, setProjects] = useState<WorkspaceProject[]>([])
  const [tasks, setTasks] = useState<WorkspaceTask[]>([])
  const [statuses, setStatuses] = useState<WorkspaceTaskStatus[]>([])
  const [selectedStatus, setSelectedStatus] = useState<number | 'all'>('all')
  const [loading, setLoading] = useState(true)

  const loadMyWork = useCallback(async () => {
    const session = getValue('UserInfoAuthSession')
    const userId = Number(Array.isArray(session) ? session[0]?.id : 0)
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [nextProjects, nextTasks, nextStatuses] = await Promise.all([
        getWorkspaceProjects(),
        getWorkspaceTasksForUser(userId),
        getWorkspaceTaskStatuses(),
      ])
      setProjects(nextProjects)
      setTasks(nextTasks)
      setStatuses(nextStatuses)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load My Work')
    } finally {
      setLoading(false)
    }
  }, [getValue])

  useEffect(() => {
    void loadMyWork()
  }, [loadMyWork])

  const projectNames = useMemo(
    () => Object.fromEntries(projects.map(project => [project.id, project.project_name])),
    [projects],
  )
  const statusById = useMemo(
    () => Object.fromEntries(statuses.map(status => [status.id, status])),
    [statuses],
  )
  const visibleTasks = selectedStatus === 'all'
    ? tasks
    : tasks.filter(task => task.status_id === selectedStatus)
  const completedCount = tasks.filter(task => task.status_id && statusById[task.status_id]?.is_final).length
  const openCount = tasks.length - completedCount

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Breadcrumb CurrentPageName="My Work" FirstPreviewsPageName="Workspace" />
          <p className="mt-1 text-sm text-muted-foreground">Your assigned tasks and active project work.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadMyWork} disabled={loading}>
            <RefreshCcw className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/wks/projects/new')} disabled={projectInsertDenied}>
            <Plus /> Project
          </Button>
          <Button size="sm" onClick={() => router.push('/wks/tasks/new')} disabled={taskInsertDenied}>
            <Plus /> Task
          </Button>
          <Button variant="secondary" size="sm" onClick={() => router.push('/wks/timelines/new')} disabled={timesheetInsertDenied}>
            <Plus /> Timesheet
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {loading ? Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24" />) : <>
          <Card className="p-4 shadow-none">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Assigned Tasks</span><ClipboardList className="size-4" /></div>
            <p className="mt-2 text-2xl font-semibold">{tasks.length}</p>
          </Card>
          <Card className="p-4 shadow-none">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Open</span><FolderKanban className="size-4" /></div>
            <p className="mt-2 text-2xl font-semibold">{openCount}</p>
          </Card>
          <Card className="p-4 shadow-none">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Completed</span><CheckCircle2 className="size-4" /></div>
            <p className="mt-2 text-2xl font-semibold">{completedCount}</p>
          </Card>
        </>}
      </section>

      <Card className="shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div>
            <h2 className="font-semibold">Assigned to Me</h2>
            <p className="text-xs text-muted-foreground">{visibleTasks.length} visible task{visibleTasks.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant={selectedStatus === 'all' ? 'default' : 'outline'} onClick={() => setSelectedStatus('all')}>All</Button>
            {statuses.map(status => (
              <Button key={status.id} size="sm" variant={selectedStatus === status.id ? 'default' : 'outline'} onClick={() => setSelectedStatus(status.id)}>
                <span className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
                {status.name}
              </Button>
            ))}
          </div>
        </div>
        <div className="divide-y">
          {loading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="p-3"><Skeleton className="h-12" /></div>) : visibleTasks.map(task => {
            const status = task.status_id ? statusById[task.status_id] : undefined
            return (
              <button key={task.id} type="button" className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50" onClick={() => router.push(`/wks/tasks/${task.id}`)}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{task.subject}</span>
                  <span className="block truncate text-xs text-muted-foreground">{projectNames[task.project_id] || `Project #${task.project_id}`} · {task.priority === 'mid' ? 'Medium' : task.priority || 'No priority'}</span>
                </span>
                <span className="shrink-0 rounded-full border px-2 py-1 text-xs" style={{ borderColor: status?.color, color: status?.color }}>
                  {status?.name || 'Unassigned'}
                </span>
              </button>
            )
          })}
          {!loading && visibleTasks.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No assigned tasks match this status.</div>
          )}
        </div>
      </Card>
    </main>
  )
}
