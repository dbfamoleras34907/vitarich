/* eslint-disable @typescript-eslint/no-explicit-any */

'use client'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Customer, usersColumn } from '@/lib/types'
import { ClipboardSignature, Plus, RefreshCw } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { GETAuthUsers, GetUserList, GetUsers, insertUser } from './api'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { NewUser } from './NewUser'
import { DataTable } from '@/components/ui/DataTable'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'

export default function Layout() {
  const { setValue, getValue } = useGlobalContext()

  const [data, setData] = useState<RowDataKey[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const route = useRouter()
  const [initialRows, setinitialRows] = useState<RowDataKey[]>([])


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


  const [form, setForm] = useState<Partial<Customer>>({
    firstname: '',
    middlename: '',
    lastname: '',
    email: '',
  })

  const handleChange = (key: keyof Customer, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }


  const handleReset = async () => {
    console.log("xx")
    setForm({
      firstname: '',
      middlename: '',
      lastname: '',
      email: '',
    })
    setLoading(true)
    try {
      const res = await GetUserList()
      console.log("xx")
      console.log({ res })
      setData(res)
      setTotalCount(res.length)
    } finally {
      setLoading(false)
    }
  }


  const getAuthUsersList = async () => {
    setLoading(true)
    try {
      const res = await GETAuthUsers()
      console.log({ res })
      // setData(res)
      // setTotalCount(res.length)
    } finally {
      setLoading(false)
    }
  }
  const getUsers = async () => {
    try {
      const res = await fetch('/api/admin/getUser', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()
      console.log({ data })

      setData(data.user)
      setTotalCount(data.user.length)
    } catch (error) {

    }

  }

  useEffect(() => {
    handleReset()
    // getUsers()
    route.prefetch('/admin/user/new')
  }, [])


  useEffect(() => {
    setValue("loading_g", loading)
  }, [loading,])

  return (
    <div>
      {/* Header */}
      <div className='px-4 mt-2 flex justify-between items-center'>
        {/* <p className='font-semibold text-xl'>Users</p> */}
        <Breadcrumb
          SecondPreviewPageName='Admin'
          // SecondPreviewPageLink='./'
          CurrentPageName='Users'
        />

        <div className='flex gap-2'>
          <Button variant='secondary' onClick={handleReset}>
            <RefreshCw className='h-4 w-4' />
          </Button>
          <NewUser />
        </div>
      </div>

      {/* <Separator className='my-2' /> */}

      <div className='flex flex-wrap gap-4 mt-4 items-end'>

      </div>

      {/* Table */}
      {/* <div className='px-4'>
        <DataTable
          columns={tableColumnsx}
          rows={data}
          DisableAddLine
          rowOnClick={(e) => {
            console.log({ e })
            setValue("selectedUser", e.row)
            route.push(`/admin/user/new`)
          }}
        />
      </div> */}
      <div className="px-4">
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
                    size="sm"
                    variant="outline"
                    className='border-2  '
                    onClick={() => {
                      setValue("selectedUser", row)
                      route.push(`/admin/user/new`)
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
