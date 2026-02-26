'use client'
import { Button } from '@/components/ui/button'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { Edit } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

export default function Layout() {
  const route = useRouter()
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
  const [loading, setLoading] = useState(true)
  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'action', label: 'Action', type: 'button', disabled: false },
      { key: 'id', label: 'Approval ID', type: 'text', disabled: true },
      { key: 'dr_num', label: 'Dr #', type: 'text', disabled: true },
      { key: 'status', label: 'Status', type: 'text', disabled: true },
      { key: 'decided_by_email', label: 'Decided By', type: 'text', disabled: true },
      { key: 'decided_at', label: 'Decision Date', type: 'text', disabled: true },
      { key: 'remarks', label: 'Remarks', type: 'text', disabled: true },
      { key: 'created_at', label: 'Created At', type: 'text', disabled: true },
    ],
    [initialRows]
  )
  useEffect(() => {
    route.prefetch("/a_dean/disposal/new")
  }, [])


  return (
    <div>
      <div className='mt-8 flex justify-between items-center'>
        <Breadcrumb
          FirstPreviewsPageName='Harchery'
          CurrentPageName='Disposal'
        />
        <div>
          <Button
            onClick={() => route.push("/a_dean/disposal/new")
            }
          >
            <Edit className='' />
            New Disposal
          </Button>
        </div>
      </div>
      <div className='px-4 mt-4'>
        <DynamicTable
          initialFilters={[
            // {
            //   id: "",
            //   columnKey: 'status',
            //   operator: 'equals',
            //   value: 'Pending',
            //   joiner: 'and',
            // },
          ]}
          columns={tableColumnsx.map((col) => ({
            key: col.key,
            label: col.label,
            align: col.key === 'action' ? 'right' : 'left',

            render: (row: RowDataKey) => {
              if (col.key === 'action') {
                return (
                  <div className="flex justify-end gap-2">
                    <Button
                      className='bg-background border hover:bg-foreground/10 border-green-400 text-green-400 p-1 rounded-xs   '

                      onClick={() => {
                        if (row.status === "Approved") {
                          toast.warning(
                            "Only pending documents are allowed to be edited on this module"
                          )
                          return
                        }
                        // console.log({})
                        // setValue("forApproval", { row })
                        // route.push("/a_dean/receiving/approval")
                      }}
                    >
                      <Edit />
                      Edit
                    </Button>
                  </div>
                )
              }

              // 📝 Default rendering
              const value = row[col.key]

              if (!value) return "-"

              return String(value)
            },
          }))}

          data={initialRows}
        />
      </div>

    </div>
  )
}
