// app/a_dean/farm/FarmMasterPage.tsx

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import Breadcrumb from '@/lib/Breadcrumb'
import { useEffect, useMemo, useState } from 'react'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { toast } from 'sonner'
import { Edit, Plus, RefreshCcw } from 'lucide-react'
import DynamicTable from '@/components/ui/DataTableV2'
import { useRouter } from 'next/navigation'
import { getFarms } from './api'
import { useGlobalContext } from '@/lib/context/GlobalContext'

type Field = {
  label: string
  name: string
  type?: 'text' | 'textarea'
}

type Section = {
  id: string
  title: string
  fields?: Field[]
  render?: () => React.ReactNode
}

export default function FarmMasterPage() {
  const { setValue, getValue } = useGlobalContext()

  const router = useRouter()
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
  const [loading, setLoading] = useState(false)
  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'id', label: 'ID', type: 'text', disabled: true },
      { key: 'code', label: 'Code', type: 'text', disabled: true },
      { key: 'name', label: 'Name', type: 'text', disabled: true },
      { key: 'farm_type', label: 'Type', type: 'text', disabled: true },
      { key: 'remarks', label: 'Remarks', type: 'text', disabled: true },
      { key: 'action', label: 'Action', type: 'button', disabled: false },
    ],
    [initialRows]
  )


  const getData = async () => {
    setLoading(true)
    const data = await getFarms()
    console.log({ data })
    setinitialRows(data ?? [])  
    setLoading(false)

  }

  useEffect(() => {
    router.prefetch("/a_dean/farm/new")
    getData()
  }, [])

  useEffect(() => {
    setValue("loading_g", loading)
  }, [loading])
  return (
    <div>
      <div className='mt-5 mx-4 flex justify-between items-center'>
        <Breadcrumb
          FirstPreviewsPageName='Settings'
          CurrentPageName='Farm Management'
        />
        <div className='flex gap-2'>
          <Button onClick={getData}><RefreshCcw /></Button>
          <Button onClick={() => router.push("/a_dean/farm/new")}><Plus /> New Farm</Button>
        </div>
      </div>

      {!loading ? (
        <DynamicTable
          loading={loading}
          columns={tableColumnsx.map((col) => ({
            key: col.key,
            label: col.label,
            align: col.key === 'action' ? 'right' : 'left',

            render: (row: RowDataKey) => {
              if (col.key === 'action') {
                return (
                  <div className="flex  gap-2">
                    <Button
                      className='bg-background border hover:bg-foreground/10 border-green-400 text-green-400 p-1 rounded-xs   '

                      onClick={() => {
                        router.push(`/a_dean/farm/${row.id}/edit`)
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
      ) :
        <>
          <div className='w-fit mx-auto flex gap-2 mt-2'><span><RefreshCcw className='animate-spin' /></span>Loading...</div>
        </>
      }
    </div>
  )
}


