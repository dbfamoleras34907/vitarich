'use client'
import { Button } from '@/components/ui/button'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { Edit } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { db } from '@/lib/Supabase/supabaseClient'
import { useGlobalContext } from '@/lib/context/GlobalContext'

export default function Layout() {
  const route = useRouter()
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
  const [loading, setLoading] = useState(true)
  const { setValue, getValue } = useGlobalContext()

  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'action', label: 'Action', type: 'button', disabled: false },
      { key: 'dr_num', label: 'Dr #', type: 'text', disabled: true },
      { key: 'batch_code', label: 'DOC Batch Code Used', type: 'text', disabled: true },
      { key: 'cardname', label: 'Customer', type: 'text', disabled: true },
      { key: 'remarks', label: 'Remarks', type: 'text', disabled: true },
      { key: 'created_at', label: 'Created At', type: 'text', disabled: true },
    ],
    []
  )

  const loadData = async () => {
    setLoading(true)

    const { data, error } = await db
      .from("disposal")
      .select("*")
      .eq("void", false)
      .eq("farm_id", getValue("DefaultFarmId") || "")
      .order("id", { ascending: false })

    if (!error && data) {
      const mapped = data.map((d) => ({
        id: d.id,
        dr_num: d.ds_no || "-",
        batch_code: d.batch_code,
        cardname: d.cardname,
        remarks: "-",
        created_at: new Date(d.created_at).toLocaleString(),
      }))

      setinitialRows(mapped)
    }

    setLoading(false)
  }

  useEffect(() => {
    route.prefetch("/a_dean/disposal/new")
    loadData()
  }, [])


  useEffect(() => {
    setValue("loading_g", loading)
  }, [loading])

  return (
    <div>
      <div className='mt-8 flex justify-between items-center mx-4'>
        <Breadcrumb
          FirstPreviewsPageName='Harchery'
          CurrentPageName='Disposal'
        />
        <div>
          <Button onClick={() => {
            setLoading(true)
            route.push("/a_dean/disposal/new")

          }
          }>
            <Edit />
            New Disposal
          </Button>
        </div>
      </div>

      <div className='mt-4'>
        <DynamicTable
          loading={loading}
          initialFilters={[]}
          columns={tableColumnsx.map((col) => ({
            key: col.key,
            label: col.label,
            align: col.key === 'action' ? 'right' : 'left',
            render: (row: RowDataKey) => {
              if (col.key === 'action') {
                const printUrl = `/a_dean/disposal/${row.id}/print`

                return (
                  <div>
                    <Button
                      onMouseEnter={() => route.prefetch(printUrl)}
                      onFocus={() => route.prefetch(printUrl)}
                      // onClick={() => route.push(printUrl)}
                      onClick={() => window.open(printUrl, '_blank')}
                      className='border border-green-500 bg-white text-black'
                      size="sm"
                    >
                      <Edit />
                      Print
                    </Button>
                  </div>
                )
              }

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