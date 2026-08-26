// app/wks/tasks/Layout.tsx
'use client'
import { Button } from '@/components/ui/button'
import { ColumnConfig } from '@/components/ui/DataTable'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { getTask, getTaskType } from './api'
import { usePermission } from '@/hooks/usePermission'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { getWorkspaceTaskStatuses, type WorkspaceTaskStatus } from '@/lib/data/repositories/workspace'
import { moveWorkspaceTask } from '@/lib/data/mutations/workspace'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function Layout() {
  const route = useRouter()
  const { getValue } = useGlobalContext()
  const [loading, setLoading] = useState(false)
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
  const insertDenied = usePermission('/wks/tasks/insert')
  const viewDenied = usePermission('/wks/tasks/view')
  const editDenied = usePermission('/wks/tasks/edit')
  const [taskTypeNames, setTaskTypeNames] = useState<Record<string, string>>({})
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  const [statuses, setStatuses] = useState<Record<string, WorkspaceTaskStatus>>({})
  const [statusOptions, setStatusOptions] = useState<WorkspaceTaskStatus[]>([])
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<number>>(new Set())

  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'action', label: 'Action', type: 'button' },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'status_id', label: 'Status', type: 'text' },
      { key: 'task_type', label: 'Type', type: 'text' },
      { key: 'assigned_to', label: 'Assigned To', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'text' },
    ],
    []
  )
  useEffect(() => {
    route.prefetch("/wks/tasks/new")
  }, [route])



  useEffect(() => {
    const loadtasks = async () => {
      setLoading(true)

      try {
        const [data, taskTypes, taskStatuses] = await Promise.all([getTask(), getTaskType(), getWorkspaceTaskStatuses()])
        setinitialRows(data)
        setTaskTypeNames(Object.fromEntries(taskTypes.map(type => [String(type.id), type.name])))
        setStatuses(Object.fromEntries(taskStatuses.map(status => [String(status.id), status])))
        setStatusOptions(taskStatuses)
        const users = getValue('activeUsers')
        setUserNames(Object.fromEntries((Array.isArray(users) ? users : []).map(user => [
          String(user.code),
          String(user.name),
        ])))
      } catch (err) {
        console.error(err)
      }

      setLoading(false)
    }

    loadtasks()
  }, [getValue])

  useEffect(() => {
    initialRows.forEach((row) => {
      route.prefetch(`/wks/tasks/${row.id}`)
    })
  }, [initialRows, route])

  const updateTaskStatus = async (row: RowDataKey, statusId: number) => {
    const taskId = Number(row.id)
    const previousStatusId = row.status_id == null ? null : Number(row.status_id)
    if (!taskId || previousStatusId === statusId || editDenied) return

    setinitialRows(current => current.map(task =>
      Number(task.id) === taskId ? { ...task, status_id: statusId } : task
    ))
    setUpdatingTaskIds(current => new Set(current).add(taskId))

    try {
      await moveWorkspaceTask(taskId, statusId)
      toast.success(`Task status updated to ${statuses[String(statusId)]?.name || 'the selected status'}`)
    } catch (error) {
      setinitialRows(current => current.map(task =>
        Number(task.id) === taskId ? { ...task, status_id: previousStatusId } : task
      ))
      toast.error(error instanceof Error ? error.message : 'Unable to update task status')
    } finally {
      setUpdatingTaskIds(current => {
        const next = new Set(current)
        next.delete(taskId)
        return next
      })
    }
  }

  return (
    <div>
      <div className='flex items-center justify-between mt-8 mx-4'>
        <Breadcrumb
          CurrentPageName='Tasks'
          FirstPreviewsPageName='Workspace'
        />
        <div>
          <Button size="sm"

            disabled={insertDenied}
            onClick={() => route.push("/wks/tasks/new")}>
            <Plus /> New Task
          </Button>
        </div>
      </div>
      <p className='text-gray-600 mx-4'>Manage your tasks and related tasks here.</p>
      <DynamicTable
        loading={loading}

        columns={tableColumnsx.map((col) => ({
          key: col.key,
          label: col.label,
          align: col.key === 'action' ? 'right' : 'left',

          render: (row: RowDataKey) => {
            if (col.key === 'action') {
              return (
                <div className="flex  gap-2">
                  <Button
                    size={"sm"}
                    className='h-7 bg-background border hover:bg-foreground/10 border-green-400 text-green-500 px-2 py-0 text-xs rounded-xs'
                    disabled={viewDenied}
                    onClick={() => {
                      route.push(`/wks/tasks/${row.id}`)
                    }}
                  >

                    View
                  </Button>
                </div>
              )
            }

            const value = row[col.key]

            if (col.key === 'task_type') return taskTypeNames[String(value)] || String(value || '-')
            if (col.key === 'assigned_to') return userNames[String(value)] || String(value || '-')
            if (col.key === 'status_id') {
              const taskId = Number(row.id)
              return (
                <Select
                  value={value == null ? undefined : String(value)}
                  disabled={editDenied || updatingTaskIds.has(taskId)}
                  onValueChange={statusId => void updateTaskStatus(row, Number(statusId))}
                >
                  <SelectTrigger size="sm" className="h-7 min-w-32 px-2 text-xs">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(status => (
                      <SelectItem key={status.id} value={String(status.id)}>
                        <span className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            }

            if (!value) return "-"

            return String(value)
          },
        }))}

        data={initialRows}
        compact
        pageSizeOptions={[25, 50, 100]}

      />

    </div>
  )
} 

// app/wks/tasks/Layout.tsx
