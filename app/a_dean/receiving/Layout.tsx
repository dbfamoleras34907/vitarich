'use client'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/DataTable'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import React, { useEffect, useMemo, useState } from 'react'
import { getReceivingDraftPending, getReceivingList } from './api'
import TableSkeleton from '@/components/ui/TableSkeleton'
import { sleep } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { toast } from 'sonner'
import ScannerModal from '@/components/ScannerModal'
import Breadcrumb from '@/lib/Breadcrumb'
import DataTableV2 from '@/components/ui/DataTableV2'
import DynamicTable from '@/components/ui/DataTableV2'
import { EditIcon, HandCoins, Plus, QrCode, RefreshCcw } from 'lucide-react'



export default function Layout() {
    const get = async () => {
        await new Promise(resolve => setTimeout(resolve, 3000))

    }

    const [receivedRows, setReceivedRows] = useState<RowDataKey[]>([])
    const [loadingReceived, setLoadingReceived] = useState(true)


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

        console.log("Found match via scan:", matchedRow);

        setValue("forApproval", { row: matchedRow });
        route.push("/a_dean/receiving/approval");


    };
    const route = useRouter()

    const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
    const [loading, setLoading] = useState(true)
    const tableColumnsx: ColumnConfig[] = useMemo(
        () => [
            { key: 'id', label: 'Approval ID', type: 'text', disabled: true },
            { key: 'dr_num', label: 'Dr #', type: 'text', disabled: true },
            { key: 'status', label: 'Status', type: 'text', disabled: true },
            { key: 'decided_by_email', label: 'Decided By', type: 'text', disabled: true },
            { key: 'decided_at', label: 'Decision Date', type: 'text', disabled: true },
            { key: 'remarks', label: 'Remarks', type: 'text', disabled: true },
            { key: 'created_at', label: 'Created At', type: 'text', disabled: true },
            { key: 'action', label: 'Action', type: 'button', disabled: false },
        ],
        [initialRows]
    )

    const receivedColumns: ColumnConfig[] = [
        { key: 'id', label: 'ID', type: 'text', disabled: true },
        { key: 'doc_date', label: 'Doc Date', type: 'text', disabled: true },
        { key: 'dr_num', label: 'DR #', type: 'text', disabled: true },
        // { key: 'status', label: 'Status', type: 'text', disabled: true },
        { key: 'soldTo', label: 'Sold To', type: 'text', disabled: true },
        { key: 'po_no', label: 'PO No.', type: 'text', disabled: true },
        { key: 'voyage_no', label: 'Voyage No.', type: 'text', disabled: true },
        { key: 'shipped_via', label: 'Shipped Via', type: 'text', disabled: true },
        { key: 'plate_no', label: 'Plate No.', type: 'text', disabled: true },
        { key: 'driver', label: 'Driver', type: 'text', disabled: true },
        { key: 'temperature', label: 'Temp', type: 'text', disabled: true },
        { key: 'humidity', label: 'Humidity', type: 'text', disabled: true },
    ]



    const getData = async () => {
        setLoading(true)
        const date = await getReceivingDraftPending()
        console.log({ date })
        setinitialRows(date)
        setLoading(!true)

    }
    const getReceivedData = async () => {
        setLoadingReceived(true)

        const data = await getReceivingList()

        setReceivedRows(data)
        setLoadingReceived(false)
    }

    useEffect(() => {
        get()
        getData()
        route.prefetch("/a_dean/receiving/approval")
        route.prefetch("/a_dean/receiving/manual")
    }, [])


    useEffect(() => {
        get()
        getData()
        getReceivedData()

        route.prefetch("/a_dean/receiving/approval")
        route.prefetch("/a_dean/receiving/manual")
    }, [])



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
                        onClick={() => setIsScanning(true)}
                    ><QrCode />Scan Search</Button>

                    <Button
                        // onClick={() => setIsScanning(true)}
                        onClick={() => route.push("/a_dean/receiving/manual")}
                    ><Plus /> Recieve Manually</Button>
                </div>
            </div>
            <div className='my-4'></div>

            {loading && (
                <RefreshCcw className='animate-spin clasm  mx-auto' />
            )}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold mx-4">For Receiving Items</h2>
            </div>
            {!loading && (
                <DynamicTable  
                    initialFilters={[
                        {
                            id: "",
                            columnKey: 'status',
                            operator: 'equals',
                            value: 'Pending',
                            joiner: 'and',
                        }, 
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
                                                setValue("forApproval", { row })
                                                route.push("/a_dean/receiving/approval")
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
            )}


            <div className="mt-10">

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold mx-4">Received Items</h2>
                </div>

                {loadingReceived && (
                    <RefreshCcw className='animate-spin mx-auto' />
                )}

                {!loadingReceived && (
                    <DynamicTable
                        initialFilters={[]} // show all records
                        columns={receivedColumns.map((col) => ({
                            key: col.key,
                            label: col.label,
                            align: 'left',

                            render: (row: RowDataKey) => {
                                const value = row[col.key]

                                if (value === null || value === undefined || value === '') return '-'

                                return String(value)
                            },
                        }))}

                        data={receivedRows}
                    />
                )}
            </div>

            {/* <Button onClick={() => console.log({ initialRows })}>check initialRows</Button> */}
        </div>
    )
}
