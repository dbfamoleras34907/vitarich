'use client'

import { Button } from '@/components/ui/button'
import DynamicTable, { Column } from '@/components/ui/DataTableV2'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import Breadcrumb from '@/lib/Breadcrumb'
import { RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { Edit, Plus, RefreshCcw, WandSparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getFarms } from './api'

const farmTypeLabels: Record<string, string> = {
  BE: 'Breeder Farm',
  HA: 'Hatcher',
  BR: 'Broiler',
}

export default function FarmMasterPage() {
  const { setValue } = useGlobalContext()
  const router = useRouter()
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
  const [loading, setLoading] = useState(false)

  const getData = useCallback(async () => {
    setLoading(true)

    try {
      const data = await getFarms()
      setinitialRows((data ?? []) as RowDataKey[])
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to load farms'))
      setinitialRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  const tableColumns: Column<RowDataKey>[] = useMemo(
    () => [
      {
        key: 'id',
        label: 'ID',
        searchable: false,
        render: row => (
          <span className="font-mono text-xs text-stone-600">
            {String(row.id)}
          </span>
        ),
      },
      {
        key: 'code',
        label: 'Farm Code',
        render: row => (
          <span className="font-medium text-stone-950">
            {String(row.code || '-')}
          </span>
        ),
      },
      { key: 'name', label: 'Farm Name' },
      {
        key: 'farm_type',
        label: 'Type',
        render: row => {
          const value = String(row.farm_type || '')
          const label = farmTypeLabels[value] ?? value

          if (!label) return '-'

          return (
            <span className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-700">
              {label}
            </span>
          )
        },
      },
      { key: 'contact_person', label: 'Contact Person', render: row => row.contact_person || '-' },
      { key: 'contact_number', label: 'Contact No.', render: row => row.contact_number || '-' },
      { key: 'remarks', label: 'Remarks', render: row => row.remarks || '-' },
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
              size="sm"
              onClick={() => router.push(`/a_dean/farm/${row.id}/edit`)}
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [router]
  )

  useEffect(() => {
    router.prefetch('/a_dean/farm/new')
    router.prefetch('/a_dean/farm/setup')
    getData()
  }, [getData, router])

  useEffect(() => {
    setValue('loading_g', loading)
  }, [loading, setValue])

  return (
    <div>
      <div className="mx-4 mb-4 mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Breadcrumb FirstPreviewsPageName="Settings" CurrentPageName="Farm Management" />
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="secondary" onClick={getData} disabled={loading}>
            <RefreshCcw className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="outline" onClick={() => router.push('/a_dean/farm/setup')}>
            <WandSparkles className="h-4 w-4" />
            Setup Wizard
          </Button>
          <Button onClick={() => router.push('/a_dean/farm/new')}>
            <Plus className="h-4 w-4" />
            New Farm
          </Button>
        </div>
      </div>

      <div className="mx-4">
        <DynamicTable
          loading={loading}
          columns={tableColumns}
          data={initialRows}
          title="Farm Directory"
          description="Maintain farm codes, classifications, contacts, and remarks."
          emptyMessage="No farms found"
          searchPlaceholder="Search farms..."
          rowKey="id"
        />
      </div>
    </div>
  )
}
