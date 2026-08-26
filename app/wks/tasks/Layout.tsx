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

export default function Layout() {
  const route = useRouter()
  const { getValue } = useGlobalContext()
  const [loading, setLoading] = useState(false)
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
  const insertDenied = usePermission('/wks/tasks/insert')
  const viewDenied = usePermission('/wks/tasks/view')
  const [taskTypeNames, setTaskTypeNames] = useState<Record<string, string>>({})
  const [userNames, setUserNames] = useState<Record<string, string>>({})

  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'action', label: 'Action', type: 'button' },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'task_type', label: 'Type', type: 'text' },
      { key: 'assigned_to', label: 'Assigned To', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'text' },
    ],
    []
  )
  useEffect(() => {
    route.prefetch("/wks/tasks/new")
  }, [])



  useEffect(() => {
    const loadtasks = async () => {
      setLoading(true)

      try {
        const [data, taskTypes] = await Promise.all([getTask(), getTaskType()])
        setinitialRows(data)
        setTaskTypeNames(Object.fromEntries(taskTypes.map(type => [String(type.id), type.name])))
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
                    className='my-1 bg-background border hover:bg-foreground/10 border-green-400 text-green-400 p-1 rounded-xs   '
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

            if (!value) return "-"

            return String(value)
          },
        }))}

        data={initialRows}

      />

    </div>
  )
} 

// app/wks/tasks/Layout.tsx
