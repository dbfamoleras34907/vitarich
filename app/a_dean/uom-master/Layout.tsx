'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import DynamicTable, { Column } from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { usePermission } from '@/hooks/usePermission'
import { getUomMasterData, UomMaster, voidUomMaster } from './api'

export default function UomMasterLayout() {
  const router = useRouter()
  const canEdit = usePermission('/a_dean/uom-master/edit')
  const canVoid = usePermission('/a_dean/uom-master/void')
  const [rows, setRows] = useState<UomMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [voidingId, setVoidingId] = useState<number | null>(null)

  const columns: Column<UomMaster>[] = [
      { key: 'code', label: 'UoM Code' },
      { key: 'name', label: 'UoM Name' },
      { key: 'remarks', label: 'Remarks', render: row => row.remarks || '-' },
      { key: 'created_at', label: 'Created At', type: 'date' },
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
              disabled={canEdit}
              onClick={() => router.push(`/a_dean/uom-master/edit/${row.id}`)}
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              disabled={canVoid || voidingId === row.id}
              onClick={() => handleVoid(row)}
            >
              <Trash2 className="h-4 w-4" />
              {voidingId === row.id ? 'Voiding...' : 'Void'}
            </Button>
          </div>
        ),
      },
    ]

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getUomMasterData())
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to load UoMs'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleVoid = async (row: UomMaster) => {
    if (!row.id || !window.confirm(`Void UoM "${row.code} - ${row.name}"?`)) return

    setVoidingId(row.id)
    try {
      await voidUomMaster(row.id)
      toast('UoM voided successfully')
      await fetchData()
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to void UoM'))
    } finally {
      setVoidingId(null)
    }
  }

  useEffect(() => {
    fetchData()
    router.prefetch('/a_dean/uom-master/new')
    router.prefetch('/a_dean/uom-master/edit')
  }, [fetchData, router])

  return (
    <div>
      <div className="mx-4 mb-4 mt-4 flex items-center justify-between">
        <Breadcrumb FirstPreviewsPageName="Inventory" CurrentPageName="UoM Master" />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button onClick={() => router.push('/a_dean/uom-master/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New UoM
          </Button>
        </div>
      </div>
      <div className="mx-4">
        <DynamicTable
          loading={loading}
          columns={columns}
          data={rows}
          title="Units of Measure"
          description="Reusable unit codes used by inventory and conversion groups."
          emptyMessage="No units of measure found"
          searchPlaceholder="Search UoM code or name..."
        />
      </div>
    </div>
  )
}
