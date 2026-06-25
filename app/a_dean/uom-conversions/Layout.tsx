'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import DynamicTable, { Column } from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { usePermission } from '@/hooks/usePermission'
import { getUomConversionRows, UomConversionRow, voidUomGroup } from './api'

export default function UomConversionsLayout() {
  const router = useRouter()
  const canEdit = usePermission('/a_dean/uom-conversions/edit')
  const canVoid = usePermission('/a_dean/uom-conversions/void')
  const [rows, setRows] = useState<UomConversionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [voidingId, setVoidingId] = useState<number | null>(null)

  const columns: Column<UomConversionRow>[] = [
      { key: 'group_code', label: 'Group Code' },
      { key: 'group_name', label: 'Group Name' },
      { key: 'base_uom', label: 'Base UoM' },
      { key: 'uom_code', label: 'UoM Code' },
      { key: 'uom_name', label: 'UoM Name' },
      {
        key: 'base_qty',
        label: 'Base Qty',
        align: 'right',
        render: row => new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(row.base_qty),
      },
      { key: 'meaning', label: 'Meaning' },
      { key: 'remarks', label: 'Remarks', render: row => row.remarks || '-' },
      {
        key: 'action',
        label: 'Action',
        type: 'button',
        align: 'right',
        sortable: false,
        searchable: false,
        render: row => row.meaning === 'Base Unit' ? (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={canEdit}
              onClick={() => router.push(`/a_dean/uom-conversions/edit/${row.group_id}`)}
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              disabled={canVoid || voidingId === row.group_id}
              onClick={() => handleVoid(row)}
            >
              <Trash2 className="h-4 w-4" />
              {voidingId === row.group_id ? 'Voiding...' : 'Void'}
            </Button>
          </div>
        ) : null,
      },
    ]

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getUomConversionRows())
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to load UoM conversions'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleVoid = async (row: UomConversionRow) => {
    if (!window.confirm(`Void conversion group "${row.group_code} - ${row.group_name}"?`)) return

    setVoidingId(row.group_id)
    try {
      await voidUomGroup(row.group_id)
      toast('UoM conversion group voided successfully')
      await fetchData()
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to void conversion group'))
    } finally {
      setVoidingId(null)
    }
  }

  useEffect(() => {
    fetchData()
    router.prefetch('/a_dean/uom-conversions/new')
    router.prefetch('/a_dean/uom-conversions/edit')
  }, [fetchData, router])

  return (
    <div>
      <div className="mx-4 mb-4 mt-4 flex items-center justify-between">
        <Breadcrumb FirstPreviewsPageName="Inventory" CurrentPageName="UoM Conversions" />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button onClick={() => router.push('/a_dean/uom-conversions/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Conversion Group
          </Button>
        </div>
      </div>
      <div className="mx-4">
        <DynamicTable
          loading={loading}
          columns={columns}
          data={rows}
          title="UoM Conversion Table"
          description="Each quantity is expressed in the conversion group's base unit."
          emptyMessage="No UoM conversion groups found"
          searchPlaceholder="Search group or UoM..."
        />
      </div>
    </div>
  )
}
