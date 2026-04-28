// app/wks/tasks/Layout.tsx
'use client'
import { Button } from '@/components/ui/button'
import { ColumnConfig } from '@/components/ui/DataTable'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { NotepadText, Paperclip, Plus, Printer, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { getTimesheets } from './api'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import SearchableCombobox from '@/components/SearchableCombobox'

export default function Layout() {
  const route = useRouter()
  const [loading, setLoading] = useState(false)
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])

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
        <div className='flex gap-2'>

          <Button size="sm" className='bg-black text-white hover:bg-gray-600'
            onClick={() => alert("This report printing is coming soon!")}>
            <Printer /> Print
          </Button>
        </div>
      </div>
      <p className='text-gray-600 mx-4'>Timesheet reports provide a summary of recorded hours and status information.</p>
      <Card className='p-2 mx-4'>
        {/* date parameter */}
        <div>
          <Label htmlFor="date" className='text-sm'>Filter by Date</Label>
          <SearchableCombobox
            items={[{
              code:"jan",
              name:"January"
            }]}
            value={"jan"}
            onValueChange={val =>
              console.log(val)
            }/>
          </div>
      </Card>
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