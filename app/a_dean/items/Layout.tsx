

'use client'

import { Button } from '@/components/ui/button'
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCcw, Plus, Edit } from 'lucide-react'

import { getRecentItems } from './api'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'

export default function Layout() {
  const router = useRouter()

  const [rows, setRows] = useState<RowDataKey[]>([])
  const [loading, setLoading] = useState(true)

  const columns: ColumnConfig[] = useMemo(
    () => [
      { key: 'item_code', label: 'Item Code', type: 'text', disabled: true },
      { key: 'item_name', label: 'Item Name', type: 'text', disabled: true },
      { key: 'barcode', label: 'Barcode', type: 'text', disabled: true },
      { key: 'unit_measure', label: 'UoM', type: 'text', disabled: true },
      { key: 'item_group', label: 'Group', type: 'text', disabled: true },
      { key: 'created_at', label: 'Created At', type: 'text', disabled: true },
      { key: 'action', label: 'Action', type: 'button', disabled: false },
    ],
    []
  )

  const fetchData = async () => {
    setLoading(true)
    const data = await getRecentItems()
    setRows(data as RowDataKey[])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    router.prefetch('/a_dean/items/new')
  }, [])

  return (
    <div>
      {/* 🔹 Header */}
      <div className="mx-4 flex justify-between items-center mb-4 mt-4">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          CurrentPageName="Items"
        />

        <Button
          onClick={() =>
            router.push('/a_dean/items/new')
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          New Item
        </Button>
      </div>

      {/* 🔹 Loading */}
      {loading && (
        <RefreshCcw className="animate-spin mx-auto mt-10" />
      )}

      {/* 🔹 Table */}
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
                  <div className="flex  gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        router.push(
                          `/a_dean/items/edit?id=${row.id}`
                        )
                      }}
                    >
                    <Edit/>  Edit
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
