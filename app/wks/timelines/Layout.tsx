// app/wks/tasks/Layout.tsx
'use client'
import { Button } from '@/components/ui/button'
import { ColumnConfig } from '@/components/ui/DataTable'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { NotepadText, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { getTimesheets } from './api'
import { usePermission } from '@/hooks/usePermission'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateWorkspaceTimesheetStatus } from '@/lib/data/mutations/workspace'
import {
  WORKSPACE_TIMESHEET_STATUSES,
  type WorkspaceTimesheetStatus,
} from '@/lib/data/repositories/workspace'
import { toast } from 'sonner'

const statusColors: Record<WorkspaceTimesheetStatus, string> = {
  Draft: 'bg-gray-300 text-gray-800',
  Submitted: 'bg-blue-100 text-blue-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
}

export default function Layout() {
  const route = useRouter()
  const [loading, setLoading] = useState(false)
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
  const insertDenied = usePermission('/wks/timelines/insert')
  const viewDenied = usePermission('/wks/timelines/view')
  const editDenied = usePermission('/wks/timelines/edit')
  const [updatingTimesheetIds, setUpdatingTimesheetIds] = useState<Set<number>>(new Set())

  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'action', label: 'Action', type: 'button' },
      { key: 'status', label: 'Status', type: 'button' },
      { key: 'doc_date', label: 'Date', type: 'text' },
      { key: 'total_hours', label: 'Total Hours', type: 'text' },
    ],
    []
  )

  useEffect(() => {
    route.prefetch("/wks/timelines/new")
  }, [route])

  useEffect(() => {
    const loadtasks = async () => {
      setLoading(true)

      try {
        const data = await getTimesheets()
        setinitialRows(data)
      } catch (err) {
        console.error(err)
      }
      setLoading(false)
    }
    loadtasks()
  }, [])

  useEffect(() => {
    route.prefetch(`/wks/timelines/a`)
    initialRows.forEach((row) => {
      route.prefetch(`/wks/timelines/${row.id}`)
    })
  }, [initialRows, route])

  const updateTimesheetStatus = async (
    row: RowDataKey,
    status: WorkspaceTimesheetStatus
  ) => {
    const timesheetId = Number(row.id)
    const previousStatus = row.status as WorkspaceTimesheetStatus | null | undefined
    if (!timesheetId || previousStatus === status || editDenied) return

    setinitialRows(current => current.map(timesheet =>
      Number(timesheet.id) === timesheetId ? { ...timesheet, status } : timesheet
    ))
    setUpdatingTimesheetIds(current => new Set(current).add(timesheetId))

    try {
      await updateWorkspaceTimesheetStatus(timesheetId, status)
      toast.success(`Timesheet status updated to ${status}`)
    } catch (error) {
      setinitialRows(current => current.map(timesheet =>
        Number(timesheet.id) === timesheetId
          ? { ...timesheet, status: previousStatus }
          : timesheet
      ))
      toast.error(error instanceof Error ? error.message : 'Unable to update timesheet status')
    } finally {
      setUpdatingTimesheetIds(current => {
        const next = new Set(current)
        next.delete(timesheetId)
        return next
      })
    }
  }

  return (
    <div>
      <div className='flex items-center justify-between mt-8 mx-4'>
        <Breadcrumb
          CurrentPageName='Timesheets'
          FirstPreviewsPageName='Workspace'
        />
        <div className='flex gap-2'>
          <Button size="sm" className='bg-white text-black border-2 border-gray-300 hover:bg-gray-100'
            disabled={viewDenied}
            onClick={() => route.push("/wks/timelines/a")}>
            <NotepadText />  Timesheet Report
          </Button>

          <Button size="sm" className='bg-black text-white hover:bg-gray-600'
            disabled={insertDenied}
            onClick={() => route.push("/wks/timelines/new")}>
            <Plus /> New Timesheet
          </Button>
        </div>
      </div>
      <p className='text-gray-600 mx-4'>Manage your timesheets and related timesheets here.</p>
      <DynamicTable
        loading={loading}

        columns={tableColumnsx.map((col) => ({
          key: col.key,
          label: col.label,
          align: col.key === 'action' ? 'right' : 'left',

          render: (row: RowDataKey) => {
            if (col.key === 'action') {
              return (
                <div className="flex  ">
                  <Button
                    size={"xs"}
                    className="h-5"
                    disabled={viewDenied}
                    onClick={() => {
                      route.push(`/wks/timelines/${row.id}`)
                    }}
                  >

                    View
                  </Button>
                </div>
              )
            }

            if (col.key === 'status') {
              const status = row[col.key] as WorkspaceTimesheetStatus | null | undefined
              const timesheetId = Number(row.id)
              return (
                <Select
                  value={status ?? undefined}
                  disabled={editDenied || updatingTimesheetIds.has(timesheetId)}
                  onValueChange={value => void updateTimesheetStatus(
                    row,
                    value as WorkspaceTimesheetStatus
                  )}
                >
                  <SelectTrigger
                    size="xs"
                    className={`h-5 min-w-32 rounded-full border-0 px-3 text-xs font-medium ${
                      statusColors[status as WorkspaceTimesheetStatus] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKSPACE_TIMESHEET_STATUSES.map(option => (
                      <SelectItem key={option} value={option}>
                        <span className={`size-2 rounded-full ${statusColors[option].split(' ')[0]}`} />
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            }

            const value = row[col.key]

            if (!value) return "-"

            return String(value)
          },
        }))}

        data={initialRows}

      />

    </div>
  )
}
