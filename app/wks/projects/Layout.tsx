'use client'
import { Button } from '@/components/ui/button'
import { ColumnConfig } from '@/components/ui/DataTable'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { getProjects } from './api'
import { usePermission } from '@/hooks/usePermission'

export default function Layout() {
  const route = useRouter()
  const [loading, setLoading] = useState(false)
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
  const insertDenied = usePermission('/wks/projects/insert')
  const viewDenied = usePermission('/wks/projects/view')

  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'action', label: 'Action', type: 'button' },
      { key: 'project_name', label: 'Project Name', type: 'text' },
      { key: 'project_type', label: 'Type', type: 'text' },
      { key: 'start_date', label: 'Start Date', type: 'text' },
      { key: 'end_date', label: 'End Date', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'text' },
    ],
    []
  )
  useEffect(() => {
    route.prefetch("/wks/projects/new")
  }, [])



  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true)

      try {
        const data = await getProjects()
        setinitialRows(data)
      } catch (err) {
        console.error(err)
      }

      setLoading(false)
    }

    loadProjects()
  }, [])
  
  useEffect(() => {
    initialRows.forEach((row) => {
      route.prefetch(`/wks/projects/${row.id}`)
    })
  }, [initialRows])

  return (
    <div>
      <div className='flex items-center justify-between mt-8 mx-4'>
        <Breadcrumb
          CurrentPageName='Projects'
          FirstPreviewsPageName='Workspace'
        />
        <div>
          <Button size="sm"

            disabled={insertDenied}
            onClick={() => route.push("/wks/projects/new")}>
            <Plus /> New Project
          </Button>
        </div>
      </div>
      <p className='text-gray-600 mx-4'>Manage your projects and related tasks here.</p>
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
                    disabled={viewDenied}
                    onClick={() => {
                      route.push(`/wks/projects/${row.id}`)
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
