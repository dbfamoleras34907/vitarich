'use client'
import { Button } from '@/components/ui/button'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { HandCoins, Plus, Ticket } from 'lucide-react'
import { useRouter } from 'next/navigation'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner' 
import { getActiveProjects } from './new/api'

export default function Layout() {
    const route = useRouter()
    const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
    const [loading, setLoading] = useState(false)
    const tableColumnsx: ColumnConfig[] = useMemo(
        () => [
            { key: 'id', label: 'Project ID', type: 'text', disabled: true },
            { key: 'name', label: 'Project Name', type: 'text', disabled: true },
            { key: 'status', label: 'Status', type: 'text', disabled: true },
            { key: 'docdate', label: 'Created By', type: 'text', disabled: true },
            { key: 'created_at', label: 'Created At', type: 'text', disabled: true },
            { key: 'remarks', label: 'Remarks', type: 'text', disabled: true },
            { key: 'action', label: 'Action', type: 'button', disabled: false },
        ],
        [initialRows]
    )
// 
    const getInitialData = async () => {
        setLoading(true)

        const getData = await getActiveProjects()
        setinitialRows(getData)

        getData.forEach((p: any) => {
            route.prefetch(`/a_dean/projects/${p.id}/tickets`)
        })

        setLoading(false)
    }
    useEffect(() => {
        route.prefetch("/a_dean/projects/new")
        getInitialData()
    }, [])


    return (
        <div>
            <div className='mx-4 flex items-center justify-between'>
                <Breadcrumb
                    FirstPreviewsPageName='CRM'
                    CurrentPageName='Projects'
                />

                <Button onClick={() => route.push("/a_dean/projects/new")}><Plus /> New Project</Button>
            </div>
            <DynamicTable
                // initialFilters={[
                //     {
                //         id: "",
                //         columnKey: 'status',
                //         operator: 'equals',
                //         value: 'Pending',
                //         joiner: 'and',
                //     },
                // ]}
                columns={tableColumnsx.map((col) => ({
                    key: col.key,
                    label: col.label,
                    align: col.key === 'action' ? 'right' : 'left',

                    render: (row: RowDataKey) => {
                        if (col.key === 'action') {
                            return (
                                <div className="flex justify-end gap-2">
                                    <Button
                                        className='bg-background border hover:bg-foreground/10 border-green-400 text-green-400 p-1 rounded-xs'
                                        onClick={() => {
                                            route.push(`/a_dean/projects/${row.id}/tickets`)
                                        }}
                                    >
                                        <Ticket />
                                        View Tickets
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
    )
}



