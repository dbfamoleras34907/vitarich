'use client'
import { Button } from '@/components/ui/button'
import DynamicTable from '@/components/ui/DataTableV2'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Breadcrumb from '@/lib/Breadcrumb'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import SearchableDropdown from '@/lib/SearchableDropdown'
import { Edit } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

export default function Layout() {
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
  const [loading, setLoading] = useState(true)
  const headerFields = [
    { code: "", label: 'Date', type: 'date', },
    { code: "", label: 'Delivery Reciept No.', type: 'date', },
    { code: "", label: 'Customer Name', type: 'text', },
    { code: "", label: 'Contact No.', type: 'text', },
    { code: "", label: 'Customer Address', type: 'text', },
    {
      code: "", label: 'Mode Of Release', type: 'search', codeLabel: 'code', nameLabel: 'name', list: [
        { code: '1', name: 'Pick-up' },
        { code: '2', name: 'Delivery' },
      ]
    },
  ]


  return (
    <div>
      <div className='mt-8 flex justify-between items-center'>
        <Breadcrumb
          SecondPreviewPageName='Harchery'
          FirstPreviewsPageName='Disposal'
          CurrentPageName='New Disposal'
        />
        <div>
          <Button
            onClick={() => { }}
          >
            <Edit className='' />
            New Disposal
          </Button>
        </div>
      </div>
      <div className='px-4 mt-4 max-w-7xl bg-white py-4 rounded-md shadow-sm'>
        <div className='grid gap-2 grid-cols-2 gap-y-3'>
          {headerFields.map((e, i) => (
            <div key={i}>

              <Label className='text-sm font-medium text-gray-700 mb-1'>
                {e.label}
              </Label>
              {e.type === 'search' ?
                <SearchableDropdown
                  list={e.list || []}
                  codeLabel='code'
                  nameLabel="name"
                  value={""}
                  onChange={(val) => { }
                    // setHeader(h => h ? { ...h, soldTo: val } : h)
                  }
                /> :
                <Input type={e.type} />
              }



            </div>
          ))}

        </div>
      </div>

    </div >
  )
}
