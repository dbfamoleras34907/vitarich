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
import { getTimesheets } from './api'

export default function Layout() {
  const route = useRouter()
  const [loading, setLoading] = useState(false)
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])

  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'action', label: 'Action', type: 'button' },
      { key: 'date', label: 'Date', type: 'text' },
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

        console.log("Fetched Timesheets:", data)
        setinitialRows(data)
      } catch (err) {
        console.error(err)
      }

      setLoading(false)
    }

    loadtasks()
  }, [])

  useEffect(() => {
    initialRows.forEach((row) => {
      route.prefetch(`/wks/tasks/${row.id}`)
    })
  }, [initialRows])

  return (
    <div>
      <div className='flex items-center justify-between mt-8 mx-4'>
        <Breadcrumb
          CurrentPageName='Timesheets'
          FirstPreviewsPageName='Workspace'
        />
        <div>
          <Button size="sm"

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
                    className='my-1 bg-background border hover:bg-foreground/10 border-green-400 text-green-400 p-1 rounded-xs   '
                    onClick={() => {
                      route.push(`/wks/timelines/${row.id}`)
                    }}
                  >

                    View
                  </Button>
                </div>
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