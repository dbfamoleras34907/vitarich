'use client'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/DataTable'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { getReceivingDraftPending, getReceivingList, getReceivingListByUser } from './api'
import TableSkeleton from '@/components/ui/TableSkeleton'
import { sleep } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { toast } from 'sonner'
import ScannerModal from '@/components/ScannerModal'
import Breadcrumb from '@/lib/Breadcrumb'
import DataTableV2 from '@/components/ui/DataTableV2'
import DynamicTable from '@/components/ui/DataTableV2'
import { EditIcon, HandCoins, Map, Plus, QrCode, RefreshCcw, Smartphone } from 'lucide-react'
import { db } from '@/lib/Supabase/supabaseClient'
import { refreshSessionx } from '@/app/admin/user/RefreshSession'
import { getAuthId } from '@/lib/getAuthId'
import { checkUserActive } from '@/lib/CheckUserIfActive'
import { getDefaultFarm } from './manual/api'
import { Farms } from '@/lib/types'



export default function Layout() {
    const get = async () => {
        await new Promise(resolve => setTimeout(resolve, 3000))

    }


    const [receivedRows, setReceivedRows] = useState<RowDataKey[]>([])
    const [loadingReceived, setLoadingReceived] = useState(true)
    const [farms, setfarms] = useState<Farms[]>([])


    const { setValue, getValue } = useGlobalContext()
    const [isScanning, setIsScanning] = useState(false);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const handleScanSuccess = (text: string) => {
        setScannedData(text);
        setIsScanning(false);

        const matchedRow = initialRows.find((row) => String(row.dr_num) === text);

        if (!matchedRow) {
            toast.error(`No record found with DR #: ${text}`);
            return;
        }

        if (matchedRow.status === "Approved") {
            toast.warning("Only pending documents are allowed to be edited on this module");
            return;
        }

        // console.log("Found match via scan:", matchedRow);

        setValue("forApproval", { row: matchedRow });
        route.push("/a_dean/receiving/approval");

    };
    const route = useRouter()

    const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
    const [loading, setLoading] = useState(true)
    const tableColumnsx: ColumnConfig[] = useMemo(
        () => [
            { key: 'action', label: 'Action', type: 'button', disabled: false },
            // { key: 'id', label: 'Approval ID', type: 'text', disabled: true },
            { key: 'dr', label: 'Dr #', type: 'text', disabled: true },
            { key: 'ts', label: 'ts #', type: 'text', disabled: true },
            { key: 'remarks', label: 'Remarks', type: 'text', disabled: true },
            { key: 'created_at', label: 'Created At', type: 'text', disabled: true },
        ],
        [initialRows]
    )

    const receivedColumns: ColumnConfig[] = [
        { key: 'action', label: 'Trace', type: 'button', disabled: true },
        { key: 'id', label: 'ID', type: 'text', disabled: true },
        { key: 'brdr_ref_no', label: 'Breeder Ref No.', type: 'text', disabled: true },
        { key: 'sku', label: 'Item', type: 'text', disabled: true },
        { key: 'actual_count', label: 'Total', type: 'text', disabled: true },
        { key: 'dr_num', label: 'DR #', type: 'text', disabled: true },
        { key: 'plate_no', label: 'Plate No.', type: 'text', disabled: true },
        { key: 'driver', label: 'Driver', type: 'text', disabled: true },

    ]


    // For Receiving Items api 
    const getData = async () => {
        setLoading(true)

        try {
            const res = await fetch('/api/dispatch')

            if (!res.ok) {
                throw new Error('Failed to fetch dispatch data')
            }

            const json = await res.json()

            const rows = Array.isArray(json)
                ? json
                : Array.isArray(json.data)
                    ? json.data
                    : []

            // collect valid destination refs from farms
            const validRefs = farms
                .map(f => f.ref)
                .filter(ref => ref !== null && ref !== undefined)
                .map(ref => String(ref))

            const filtered = rows
                .map((item: any) => {
                    let parsedDispatchBody: any[] = []
                    let parsedModifiedDispatchBody: any[] = []

                    try {
                        if (typeof item.dispatchbody === "string") {
                            parsedDispatchBody = JSON.parse(item.dispatchbody)
                        } else if (Array.isArray(item.dispatchbody)) {
                            parsedDispatchBody = item.dispatchbody
                        }
                    } catch {
                        parsedDispatchBody = []
                    }

                    try {
                        if (typeof item.modified_dispatchbody === "string") {
                            parsedModifiedDispatchBody = JSON.parse(item.modified_dispatchbody)
                        } else if (Array.isArray(item.modified_dispatchbody)) {
                            parsedModifiedDispatchBody = item.modified_dispatchbody
                        }
                    } catch {
                        parsedModifiedDispatchBody = []
                    }

                    return {
                        ...item,
                        dispatchbody: parsedDispatchBody,
                        modified_dispatchbody: parsedModifiedDispatchBody
                    }
                })
                .filter((item: any) => {
                    if (item.dispatchbody.length === 0) return false

                    // if farms has refs, filter by destinationid
                    if (validRefs.length > 0) {
                        return validRefs.includes(String(item.destinationid))
                    }

                    return true
                })

            console.log({ filtered })

            setinitialRows(filtered)

        } catch (err) {
            toast("Unable to load Receiving Items. Please check your internet connection and try again.")
            setinitialRows([])
        }

        setLoading(false)
    }
    const getReceivedData = async () => {
        setLoadingReceived(true)

        const data = await getReceivingList()
        // // console.log({ data })
        setReceivedRows(data)
        setLoadingReceived(false)
    }

    const getFarms = async () => {
        const user = getValue('UserInfoAuthSession')
        console.log({ user })
        if (!user) {
            toast.error("User information is not available. Please log in again.")
            return
        }
        if (user[0].id === undefined) return

        const farms = await getDefaultFarm(user[0].id)
        console.log({ farms })
        setfarms(farms)
    }

    useEffect(() => {
        getFarms()
    }, [getValue])

    useEffect(() => {
        refreshSessionx(route);
    }, [])


    useEffect(() => {
        if (farms.length === 0) return

        get()
        getData()
        getReceivedData()

        route.prefetch("/a_dean/receiving/approval")
        route.prefetch("/a_dean/receiving/manual")

    }, [farms.length])

    useEffect(() => {
        get()
        getData()
        getReceivedData()

        route.prefetch("/a_dean/receiving/approval")
        route.prefetch("/a_dean/receiving/manual")
    }, [])

    useEffect(() => {
        setValue("loading_g", loading)
    }, [loading])


    return (
        <div>
            {isScanning && (
                <ScannerModal
                    onResult={handleScanSuccess}
                    onClose={() => setIsScanning(false)}
                />
            )}
            <div className='mx-4 flex justify-between items-center mb-4 mt-4'>

                <Breadcrumb
                    FirstPreviewsPageName='Hatchery'
                    CurrentPageName='Receiving List'
                />
                <div className='flex gap-4'>

                    <Button
                        // onClick={() => setIsScanning(true)}
                        // size={"sm"}
                        onClick={async () => {
                            const isHasSuperVisor = await getReceivingListByUser()
                            if (isHasSuperVisor == '') {
                                toast.error("Your account is not yet assigned to a supervisor. Please contact your administrator.")
                                return
                            }
                            route.push("/a_dean/receiving/manual")

                        }
                        }
                    ><Plus /> Receive Manually</Button>'
                
                </div>
            </div>
            <div className='my-4'></div>

            {
                loading && (
                    <RefreshCcw className='animate-spin clasm  mx-auto' />
                )
            }
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold mx-4">For Receiving Items</h2>
            </div>
            {
                !loading && (
                    <DynamicTable
                        loading={loading}
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
                                                className='bg-background border hover:bg-foreground/10 border-green-400 text-green-400 p-1 rounded-xs   '

                                                onClick={() => {
                                                    if (row.status === "Approved") {
                                                        toast.warning(
                                                            "Only pending documents are allowed to be edited on this module"
                                                        )
                                                        return
                                                    }
                                                    console.log({ row })
                                                    setValue("forApproval", { row })
                                                    // route.push("/a_dean/receiving/manual")
                                                }}
                                            >
                                                <HandCoins />
                                                Receive
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
                )
            }


            <div className="mt-10">

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold mx-4">Received Items</h2>
                </div>

                {loadingReceived && (
                    <RefreshCcw className='animate-spin mx-auto' />
                )}

                {!loadingReceived && (
                    <DynamicTable
                        loading={loadingReceived}
                        initialFilters={[]} // show all records
                        columns={receivedColumns.map((col) => ({
                            key: col.key,
                            label: col.label,
                            align: 'left',

                            render: (row: RowDataKey) => {

                                if (col.key === 'action') {
                                    return (
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                className=' border hover:bg-foreground/10 bg-white border-green-400 text-green-400 p-1 rounded-xs   '

                                                onClick={() => {
                                                    if (row.status === "Approved") {
                                                        toast.warning(
                                                            "Only pending documents are allowed to be edited on this module"
                                                        )
                                                        return
                                                    }
                                                    // // console.log({})
                                                    // setValue("forApproval", { row })
                                                    setValue("traceBreederRef", row.brdr_ref_no)
                                                    route.push("/a_dean/trace/")
                                                }}
                                            >
                                                <Map />
                                                Trace
                                            </Button>
                                        </div>
                                    )
                                } else {

                                    const value = row[col.key]

                                    if (value === null || value === undefined || value === '') return '-'

                                    return String(value)
                                }
                            },
                        }))}

                        data={receivedRows}
                    />
                )}
            </div>

        </div >
    )
}
