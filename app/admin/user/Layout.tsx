'use client'

import { Button } from '@/components/ui/button'
import { PageHeader, PageHeaderActions, PageShell } from '@/components/ui/page-layout'
import { RefreshCw } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { GetUserList } from './api'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { NewUser } from './NewUser'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'

export default function Layout() {
  const { setValue } = useGlobalContext()

  const [data, setData] = useState<RowDataKey[]>([])
  const [loading, setLoading] = useState(false)
  const route = useRouter()


  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'id', label: 'ID', type: 'text', disabled: true },
      { key: 'email', label: 'Email', type: 'text', disabled: true },
      { key: 'firstname', label: 'First name', type: 'text', disabled: true },
      { key: 'lastname', label: 'Last name', type: 'text', disabled: true },
      { key: 'user_type', label: 'User Type', type: 'text', disabled: true },
      { key: 'fms_type', label: 'FMS Type', type: 'text', disabled: true },
      { key: 'update', label: 'Update', type: 'button', disabled: false },
    ],
    [/*sourceList, itemListSource*/]
  )


  const handleReset = async () => {
    setLoading(true)
    try {
      const res = await GetUserList()
      setData(res)
    } catch (error) {
      toast.error(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message : 'Unable to load users. Please try again.')
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    handleReset()
    route.prefetch('/admin/user/new')
  }, [route])


  useEffect(() => {
    setValue("loading_g", loading)
  }, [loading, setValue])

  return (
    <PageShell>
      <PageHeader>
        <Breadcrumb
          SecondPreviewPageName='Admin'
          CurrentPageName='Users'
        />
        <PageHeaderActions>
          <Button size="icon-sm" variant='secondary' onClick={handleReset} aria-label="Refresh users">
            <RefreshCw className='h-4 w-4' />
          </Button>
          <NewUser />
        </PageHeaderActions>
      </PageHeader>
      <DynamicTable
          actionsFirst
          loading={loading}
          initialFilters={[]} // show all records
          columns={tableColumnsx.map((col) => ({
            key: col.key,
            label: col.label,
            align: 'left',

            render: (row: RowDataKey) => {
              if (col.key === 'update') {
                return (
                  <Button
                    size="xs"
                    variant="outline"
                    className='border-2  '
                    onClick={() => {
                      setValue("selectedUser", row)
                      route.push(`/admin/user/new`)
                    }}
                  >
                    Update
                  </Button>
                )
              }

              const value = row[col.key]

              if (col.key === 'user_type') {
                return ({ 1: 'Super Admin', 2: 'Admin / Supervisor', 3: 'User' } as Record<number, string>)[Number(value ?? 3)] || 'User'
              }

              if (col.key === 'issuper') {
                return value === '1' ? 'Yes' : 'No'
              }

              if (value === null || value === undefined || value === '') return '-'

              return String(value)
            },
          }))}

        data={data}
      />
    </PageShell>
  )
}
