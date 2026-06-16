'use client'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Plus, RefreshCw } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import Breadcrumb from '@/lib/Breadcrumb'
import { GetLocks, insertLock, toggleLock } from './api'
import DynamicTable from '@/components/ui/DataTableV2'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

type LockRow = {
  id: number
  week: number
  year: number
  locked_by: string | null
  locked_at: string | null
  status: string
}

export default function Layout() {
  const { setValue } = useGlobalContext()
  const [data, setData] = useState<RowDataKey[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<string>('')

  const tableColumnsx: ColumnConfig[] = useMemo(() => [
    { key: 'week', label: 'Week', type: 'text' },
    { key: 'year', label: 'Year', type: 'text' },
    { key: 'locked_by', label: 'Lock By', type: 'text' },
    { key: 'locked_at', label: 'Lock Date', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'actions', label: 'Actions', type: 'button' },
  ], [])

  async function load() {
    setLoading(true)
    try {
      const res = await GetLocks()
      setData(res || [])
    } catch (err) {
      console.error('GetLocks error', err)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function parseWeekValue(value: string) {
    if (!value) return null
    const parts = value.split('-W')
    if (parts.length !== 2) return null
    return { year: Number(parts[0]), week: Number(parts[1]) }
  }

  async function handleAdd() {
    const parsed = parseWeekValue(selectedWeek)
    if (!parsed) return alert('Please select a week')
    try {
      await insertLock(parsed)
      setSelectedWeek('')
      await load()
    } catch (err: any) {
      alert(err.message || 'Error adding lock')
    }
  }

  async function handleToggle(id: number, status: string) {
    try {
      await toggleLock(id, status === 'Locked' ? 'unlock' : 'lock')
      await load()
    } catch (err: any) {
      alert(err.message || 'Error updating lock')
    }
  }

  return (
    <div>
      <div className='px-4 mt-2 flex justify-between items-center'>
        <Breadcrumb
          SecondPreviewPageName='Admin'
          CurrentPageName='Lock'
        />

        <div className='flex gap-2'>
          <Button variant='secondary' onClick={load}>
            <RefreshCw className='h-4 w-4' />
          </Button>
          <div className='flex items-end gap-2'>
            <Input type='week' value={selectedWeek} onChange={(e: any) => setSelectedWeek(e.target.value)} />
            <Button onClick={handleAdd}>
              <Plus className='h-4 w-4 mr-1' />
              Add Lock Week
            </Button>
          </div>
        </div>
      </div>

      <div className='px-4 mt-2'>
        <DynamicTable
          loading={loading}
          initialFilters={[]}
          columns={tableColumnsx.map((col) => ({
            key: col.key,
            label: col.label,
            align: 'left',
            render: (row: any) => {
              if (col.key === 'actions') {
                return (
                  <Button size='xs' variant='outline' onClick={() => handleToggle(row.id, row.status)}>
                    {row.status === 'Locked' ? 'Unlock' : 'Lock'}
                  </Button>
                )
              }
              const value = row[col.key]
              if (value === null || value === undefined || value === '') return '-'
              return String(value)
            },
          }))}
          data={data}
        />
      </div>
    </div>
  )
}
