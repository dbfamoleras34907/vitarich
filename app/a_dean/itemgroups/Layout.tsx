'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit, Eye, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { usePermission } from '@/hooks/usePermission'
import { getItemGroups, voidItemGroup } from './api'

export default function ItemGroupsLayout() {
  const router = useRouter()
  const canView = usePermission('/a_dean/itemgroups/view')
  const canVoid = usePermission('/a_dean/itemgroups/void')
  const canEdit = usePermission('/a_dean/itemgroups/edit')

  const [rows, setRows] = useState<RowDataKey[]>([])
  const [loading, setLoading] = useState(false)
  const [voidingId, setVoidingId] = useState<number | null>(null)

  const columns: ColumnConfig[] = useMemo(
    () => [
      { key: 'id', label: 'ID', type: 'text', disabled: true },
      { key: 'code', label: 'Code', type: 'text', disabled: true },
      { key: 'name', label: 'Name', type: 'text', disabled: true },
      { key: 'remarks', label: 'Remarks', type: 'text', disabled: true },
      { key: 'created_at', label: 'Created At', type: 'text', disabled: true },
      { key: 'action', label: 'Action', type: 'button', disabled: false },
    ],
    []
  )

  const fetchData = async () => {
    setLoading(true)

    try {
      const data = await getItemGroups()
      setRows((data || []) as RowDataKey[])
    } catch (error) {
      console.error('Error fetching item groups:', error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    router.prefetch('/a_dean/itemgroups/new')
    router.prefetch('/a_dean/itemgroups/view')
    router.prefetch('/a_dean/itemgroups/edit')
  }, [router])

  const handleVoid = async (row: RowDataKey) => {
    const confirmed = window.confirm(
      `Void item group "${String(row.code)} - ${String(row.name)}"?`
    )

    if (!confirmed) return

    setVoidingId(row.id)

    try {
      await voidItemGroup(row.id)
      toast('Item group voided successfully')
      await fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to void item group'
      toast('Error: ' + message)
    } finally {
      setVoidingId(null)
    }
  }

  return (
    <div>
      <div className="mx-4 flex justify-between items-center mb-4 mt-4">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          CurrentPageName="Item Groups"
        />

        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button onClick={() => router.push('/a_dean/itemgroups/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Item Group
          </Button>
        </div>
      </div>

      {loading && (
        <RefreshCcw className="animate-spin mx-auto mt-10" />
      )}

      {!loading && (
        <DynamicTable
          loading={loading}
          columns={columns.map((col) => ({
            key: col.key,
            label: col.label,
            align: col.key === 'action' ? 'right' : 'left',
            render: (row: RowDataKey) => {
              if (col.key === 'action') {
                return (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={canView}
                      onClick={() => router.push(`/a_dean/itemgroups/view/${row.id}`)}
                    >
                      <Eye />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      disabled={canEdit}
                      onClick={() => router.push(`/a_dean/itemgroups/edit/${row.id}`)}
                    >
                      <Edit />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={canVoid || voidingId === row.id}
                      onClick={() => handleVoid(row)}
                    >
                      <Trash2 />
                      {voidingId === row.id ? 'Voiding...' : 'Void'}
                    </Button>
                  </div>
                )
              }

              const value = row[col.key]

              if (!value) return '-'

              return String(value)
            },
          }))}
          data={rows}
        />
      )}
    </div>
  )
}
