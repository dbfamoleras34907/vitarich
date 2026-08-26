// app/wks/tasks/Layout.tsx
'use client'
import { Button } from '@/components/ui/button'
import { ColumnConfig } from '@/components/ui/DataTable'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { NotepadText, Paperclip, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { getTimesheets } from './api'
import { usePermission } from '@/hooks/usePermission'

export default function Layout() {
  const route = useRouter()
  const [loading, setLoading] = useState(false)
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
  const insertDenied = usePermission('/wks/timelines/insert')
  const viewDenied = usePermission('/wks/timelines/view')

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
  }, [])

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
  }, [initialRows])

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
                <div className="flex  gap-2">
                  <Button
                    size={"sm"}
                    className='my-1 bg-background border hover:bg-foreground/10 border-green-400 text-green-400 p-1 rounded-md   '
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
              const status = row[col.key]
              const statusColors: Record<string, string> = {
                "Draft": "bg-gray-300 text-gray-800",
                "Submitted": "bg-blue-100 text-blue-800",
                "Approved": "bg-green-100 text-green-800",
                "Rejected": "bg-red-100 text-red-800",
              }
              const colorClass = statusColors[status] || "bg-gray-100 text-gray-800"
              return (
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${colorClass}`}>
                  {status}
                </span>
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
