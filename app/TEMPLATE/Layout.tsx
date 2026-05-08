'use client'
import { Button } from '@/components/ui/button'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { RefreshCw } from 'lucide-react'
import React, { useMemo, useState } from 'react'

export default function Layout() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<RowDataKey[]>([])

  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'id', label: 'ID', type: 'text', disabled: true },
      { key: 'email', label: 'Email', type: 'text', disabled: true },
      { key: 'firstname', label: 'First name', type: 'text', disabled: true },
      { key: 'lastname', label: 'Last name', type: 'text', disabled: true },
      { key: 'update', label: 'Update', type: 'button', disabled: false },
    ],
    [/*sourceList, itemListSource*/]
  )


  const handleReset = async () => {

  }

  return (
    <div>
      <div className='px-4 mt-2 flex justify-between items-center'>
        <Breadcrumb
          SecondPreviewPageName='Admin'
          CurrentPageName='Users'
        />
        <div className='flex gap-2'>
          <Button variant='secondary' onClick={handleReset}>
            <RefreshCw className='h-4 w-4' />
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
              if (col.key === 'update') {
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
