'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit, Plus, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import DynamicTable, { Column } from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { usePermission } from '@/hooks/usePermission'
import { getUsersGroups, UsersGroup } from './api'

export default function UserGroupLayout() {
  const router = useRouter()
  const cannotInsert = usePermission('/admin/user-group/insert')
  const cannotEdit = usePermission('/admin/user-group/edit')
  const [rows, setRows] = useState<UsersGroup[]>([])
  const [loading, setLoading] = useState(true)

  const columns: Column<UsersGroup>[] = [
    { key: 'code', label: 'Code' },
    { key: 'group_name', label: 'Group Name' },
    {
      key: 'action',
      label: 'Action',
      type: 'button',
      align: 'right',
      sortable: false,
      searchable: false,
      render: row => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={cannotEdit}
            onClick={() => router.push(`/admin/user-group/edit/${row.id}`)}
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        </div>
      ),
    },
  ]

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getUsersGroups())
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to load user groups'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    router.prefetch('/admin/user-group/new')
    router.prefetch('/admin/user-group/edit')
  }, [fetchData, router])

  return (
    <div>
      <div className="mx-4 mb-4 mt-4 flex items-center justify-between">
        <Breadcrumb SecondPreviewPageName="Admin" CurrentPageName="User Group" />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button onClick={() => router.push('/admin/user-group/new')} disabled={cannotInsert}>
            <Plus className="mr-2 h-4 w-4" />
            New Group
          </Button>
        </div>
      </div>
      <div className="mx-4">
        <DynamicTable
          loading={loading}
          columns={columns}
          data={rows}
          title="User Groups"
          description="Permission groups for user access defaults."
          emptyMessage="No user groups found"
          searchPlaceholder="Search code or group name..."
        />
      </div>
    </div>
  )
}
