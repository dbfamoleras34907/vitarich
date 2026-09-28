'use client'
import { Button } from '@/components/ui/button'
import { ColumnConfig, RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { useEffect, useMemo, useState } from 'react'
import { getReceivingListByUser } from './api'
import { useRouter } from 'next/navigation'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { toast } from 'sonner'
import ScannerModal from '@/components/ScannerModal'
import Breadcrumb from '@/lib/Breadcrumb'
import DynamicTable from '@/components/ui/DataTableV2'
import { ClipboardCopy, Copy, HandCoins, Map, Plus, View } from 'lucide-react'
import { refreshSessionx } from '@/app/admin/user/RefreshSession'
import SearchableCombobox from '@/components/SearchableCombobox'
import { listAssignedUserFarmOptions, type AssignedFarmOption } from '@/lib/data/repositories/farmOptions.client'
import { getReceivingList, getPendingReceivingDispatches } from '@/lib/data/repositories/receivingLists'
import { usePermission } from '@/hooks/usePermission'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { MoreHorizontal } from "lucide-react"
import { copyRow, copyTable } from '@/lib/tableActions'


export default function Layout() {
    const canView = usePermission('/a_dean/receiving/view')
    const canInsert = usePermission('/a_dean/receiving/insert')

    const [receivedRows, setReceivedRows] = useState<RowDataKey[]>([])
    const [loadingReceived, setLoadingReceived] = useState(true)
    const [farms, setFarms] = useState<AssignedFarmOption[]>([])
    const [loadingFarms, setLoadingFarms] = useState(true)
    const [selectedFarmId, setSelectedFarmId] = useState('')
    const [loadedFarmId, setLoadedFarmId] = useState<number | null>(null)


    const { setValue, getValue } = useGlobalContext()
    const [isScanning, setIsScanning] = useState(false);
    const [, setScannedData] = useState<string | null>(null);
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

        // // console.loglog("Found match via scan:", matchedRow);

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
        []
    )
    const receivedColumns: ColumnConfig[] = [
        { key: 'actions', label: 'Actions', type: 'button', disabled: true },

        { key: 'id', label: 'ID', type: 'text', disabled: true },
        { key: 'brdr_ref_no', label: 'Breeder Ref No.', type: 'text', disabled: true },
        { key: 'soldto', label: 'Delivered From', type: 'text', disabled: true },
        { key: 'deliverted_to_id', label: 'Delivered To ID', type: 'text', disabled: true },
        { key: 'delivered_to', label: 'Delivered To', type: 'text', disabled: true },
        // { key: 'sku', label: 'Item', type: 'text', disabled: true },
        { key: 'actual_count', label: 'Total', type: 'text', disabled: true },
        { key: 'dr_num', label: 'DR #', type: 'text', disabled: true },
        { key: 'name', label: 'Received By', type: 'text', disabled: true },
        { key: 'plate_no', label: 'Plate No.', type: 'text', disabled: true },
        { key: 'driver', label: 'Driver', type: 'text', disabled: true },
    ]




    type RowAction = {
        label: string
        icon?: React.ReactNode
        disabled?: boolean
        onClick: (row: RowDataKey) => void
    }
    const getRowActions = (row: RowDataKey): RowAction[] => {
        return [
            {
                label: "Trace",
                icon: <Map className="w-4 h-4" />,
                onClick: () => {
                    if (row.status === "Approved") {
                        toast.warning(
                            "Only pending documents are allowed to be edited on this module"
                        )
                        return
                    }

                    setValue("traceBreederRef", row.brdr_ref_no)
                    route.push("/a_dean/trace/")
                },
            },

            {
                label: "View",
                icon: <View className="w-4 h-4" />,
                disabled: canView,
                onClick: () => {
                    route.push(`/a_dean/receiving/view/${row.id}`)
                },
            },
            {
                label: "Copy Row",
                icon: <Copy className="w-4 h-4" />,
                onClick: () => {
                    copyRow(row)
                },
            },

            {
                label: "Copy Table",
                icon: <ClipboardCopy className="w-4 h-4" />,
                onClick: () => {
                    copyTable(rowsAreCurrent ? receivedRows : [])
                },
            },


        ]
    }
    const userId = getValue('UserInfoAuthSession')?.[0]?.id
    const defaultFarmId = String(getValue('DefaultFarmId') ?? '')
    const selectedFarm = farms.find(farm => String(farm.id) === selectedFarmId)
    const currentFarmId = selectedFarm?.id ?? null
    const currentFarmRef = selectedFarm?.ref ?? null
    const rowsAreCurrent = currentFarmId !== null && loadedFarmId === currentFarmId

    useEffect(() => {
        let cancelled = false
        const loadFarms = async () => {
            setLoadingFarms(true)
            setFarms([])
            setSelectedFarmId('')
            await listAssignedUserFarmOptions(['HA'])
                .then(options => {
                    if (cancelled) return
                    setFarms(options)
                    const preferred = options.find(farm => String(farm.id) === defaultFarmId)
                    setSelectedFarmId(String((preferred ?? options[0])?.id ?? ''))
                })
                .catch(error => {
                    if (!cancelled) toast.error(error instanceof Error ? error.message : 'Unable to load farms.')
                })
                .finally(() => { if (!cancelled) setLoadingFarms(false) })
        }
        void loadFarms()
        return () => { cancelled = true }
    }, [userId, defaultFarmId])

    useEffect(() => {
        refreshSessionx(route)
        route.prefetch('/a_dean/receiving/approval')
        route.prefetch('/a_dean/receiving/manual')
    }, [route])

    useEffect(() => {
        let cancelled = false
        const loadRows = async () => {
            setinitialRows([])
            setReceivedRows([])
            setLoadedFarmId(null)
            setLoading(currentFarmId !== null)
            setLoadingReceived(currentFarmId !== null)
            if (currentFarmId === null) return

            await Promise.allSettled([
                getPendingReceivingDispatches(currentFarmRef),
                getReceivingList(currentFarmId),
            ]).then(([pending, received]) => {
                if (cancelled) return
                if (pending.status === 'fulfilled') setinitialRows(pending.value)
                else toast.error('Unable to load items for receiving.')
                if (received.status === 'fulfilled') setReceivedRows(received.value)
                else toast.error('Unable to load received items.')
                setLoadedFarmId(currentFarmId)
                setLoading(false)
                setLoadingReceived(false)
            })
        }
        void loadRows()
        return () => { cancelled = true }
    }, [currentFarmId, currentFarmRef])

    useEffect(() => {
        setValue("loading_g", loading)
    }, [loading, setValue])


    return (
        <div>
            {isScanning && (
                <ScannerModal
                    onResult={handleScanSuccess}
                    onClose={() => setIsScanning(false)}
                />
            )}
            <div className='mx-4 flex justify-between items-center mb-4 mt-8'>

                <Breadcrumb
                    FirstPreviewsPageName='Hatchery'
                    CurrentPageName='Receiving List'
                />
                <div className='flex gap-4'>

                    <Button
                        // onClick={() => setIsScanning(true)}
                        // size={"sm"}
                        disabled={canInsert}
                        onClick={async () => {
                            const isHasSuperVisor = await getReceivingListByUser()
                            if (isHasSuperVisor == '') {
                                toast.error("Your account is not yet assigned to a supervisor. Please contact your administrator.")
                                return
                            }
                            route.push("/a_dean/receiving/manual")

                        }
                        }
                    ><Plus /> Receive Manually</Button>
                    
                    {/* <Button onClick={() => console.log(getValue("DefaultFarmId"))}>Check getValue("defaultFarmId")</Button> */}
                </div>
            </div>
            <div className="mx-4 mb-4 max-w-md space-y-2">
                <SearchableCombobox
                    label="Farm"
                    required
                    items={farms.map(farm => ({ code: String(farm.id), name: `${farm.code} - ${farm.name}` }))}
                    value={selectedFarmId}
                    onValueChange={setSelectedFarmId}
                    disabled={loadingFarms}
                    placeholder={loadingFarms ? 'Loading farms...' : 'Select farm'}
                />
                {!loadingFarms && farms.length === 0 && (
                    <p className="text-sm text-muted-foreground">No active Hatchery farms are associated with your account.</p>
                )}
            </div>

            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold mx-4">For Receiving Items</h2>
            </div>
            {
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
                                            size={"sm"}
                                            className='my-1 bg-background border hover:bg-foreground/10 border-green-400 text-green-400 p-1 rounded-xs   '
                                            onClick={() => {
                                                setValue("forApproval", row)
                                                setValue("scanning", "on")
                                                route.push("/a_dean/receiving/manual")
                                            }}
                                        >
                                            <HandCoins />
                                            Receive
                                        </Button>
                                    </div>
                                )
                            }

                            const value = row[col.key]

                            if (!value) return "-"

                            return String(value)
                        },
                    }))}

                    data={rowsAreCurrent ? initialRows : []}

                />
            }

            <div className="mt-10">

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold mx-4">Received Items</h2>
                </div>
                <DynamicTable
                    loading={loadingReceived}
                    columns={receivedColumns.map((col) => ({
                        key: col.key,
                        label: col.label,
                        align: 'left',
                        render: (row: RowDataKey) => {
                            if (col.key === 'actions') {
                                const actions = getRowActions(row)
                                return (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                size="xs"

                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>

                                        <DropdownMenuContent align="end">

                                            {actions.map((action, index) => (
                                                <DropdownMenuItem
                                                    key={index}
                                                    disabled={action.disabled}
                                                    onClick={() => action.onClick(row)}
                                                    className="cursor-pointer flex items-center gap-2"
                                                >
                                                    {action.icon}
                                                    {action.label}
                                                </DropdownMenuItem>
                                            ))}

                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )
                            } else if (col.key === 'brdr_ref_no') {
                                return <span className="bg-blue-200/80 text-blue-900  px-2 rounded-2xl font-bold  w-full">{row[col.key]}</span>
                            }

                            const value = row[col.key]

                            if (value === null || value === undefined || value === '') {
                                return '-'
                            }

                            return String(value)
                        }
                    }))}

                    data={rowsAreCurrent ? receivedRows : []}
                />
            </div>

        </div >
    )
}
