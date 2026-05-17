'use client'
import { Button } from '@/components/ui/button'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { Plus, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

export default function Layout() {
  const { setValue, getValue } = useGlobalContext()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<RowDataKey[]>([])
  const route = useRouter()
  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'button', label: '', type: 'text', disabled: true },
      { key: 'code', label: 'Code', type: 'text', disabled: true },
      { key: 'section', label: 'Section', type: 'text', disabled: true },
      { key: 'itemtype', label: 'Item Type', type: 'text', disabled: true },
      { key: 'itemcode', label: 'Item', type: 'text', disabled: true },
      { key: 'whscode', label: 'Warehouse', type: 'button', disabled: false },
      { key: 'type', label: 'Transfer Type', type: 'button', disabled: false },
    ],
    [/*sourceList, itemListSource*/]
  )


  const handleReset = async () => {

  }
  const NewMap = async () => {
    setValue("loading_g", true)
    route.push("/inv/gr/new")
  }

  useEffect(() => {
    route.prefetch("/inv/gr/new")
    setValue("loading_g", false)
  }, [])


  return (
    <div>
      <div className='px-4 mt-2 flex justify-between items-center'>
        <Breadcrumb
          SecondPreviewPageName='Inventory '
          CurrentPageName='Goods Issue'
        />
        <div className='flex gap-2'>
          <Button variant='secondary' onClick={handleReset}>
            <RefreshCw className='h-4 w-4' />
          </Button>
          <Button onClick={NewMap}>
            <Plus className='h-4 w-4' /> New Map
          </Button>

        </div>
      </div>
      <div className="px-4 mt-2">
        <DynamicTable
          loading={loading}
          initialFilters={[]} // show all records
          columns={tableColumnsx.map((col) => ({
            key: col.key,
            label: col.label,
            align: 'left',

            render: (row: RowDataKey) => {
              if (col.key === 'button') {
                return (
                  <Button
                    size="xs"
                    variant="outline"
                    className='border-2  '
                    onClick={() => {
                    }}
                  >
                    Update
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
    </div >
  )
}
