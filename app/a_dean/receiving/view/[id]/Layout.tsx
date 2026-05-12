'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getReceivingView } from './api'

import {
    Card,
    CardContent,
    CardHeader,
} from '@/components/ui/card'

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

import { Label } from '@/components/ui/label'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import Breadcrumb from '@/lib/Breadcrumb'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function Layout() {
    const params = useParams()
    const router = useRouter()

    const canInsert = usePermission('/a_dean/receiving/view')
    useEffect(() => {
        if (canInsert)
            router.push("/a_dean/receiving/")
    }, [])

    const [loading, setLoading] = useState(true)
    const [header, setHeader] = useState<any>(null)
    const [items, setItems] = useState<any[]>([])

    const loadData = async () => {
        setLoading(true)
        console.log(params.id)
        const data = await getReceivingView(Number(params.id))

        if (data) {
            setHeader(data.header)
            setItems(data.items)
        }

        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [])

    if (loading) {
        return (
            <div className='p-6 mt-8'>
                <div className='max-w-[1240px] mx-auto space-y-4'>

                    {/* Top */}
                    <div className='flex items-center justify-between'>
                        <div className='space-y-2'>
                            <Skeleton className='h-4 w-[220px]' />
                            <Skeleton className='h-8 w-[320px]' />
                        </div>

                        <Skeleton className='h-10 w-[100px]' />
                    </div>

                    {/* Document Info */}
                    <div className='bg-white border rounded-xl overflow-hidden'>
                        <div className='px-5 py-4 border-b'>
                            <Skeleton className='h-4 w-[180px]' />
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4'>
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div
                                    key={i}
                                    className='px-5 py-4 border-b xl:border-b-0 xl:border-r last:border-r-0 space-y-2'
                                >
                                    <Skeleton className='h-3 w-[90px]' />
                                    <Skeleton className='h-5 w-[140px]' />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div className='bg-white border rounded-xl overflow-hidden'>
                        <div className='px-5 py-4 border-b flex items-center justify-between'>
                            <div className='space-y-2'>
                                <Skeleton className='h-4 w-[140px]' />
                                <Skeleton className='h-3 w-[180px]' />
                            </div>

                            <Skeleton className='h-4 w-[70px]' />
                        </div>

                        <div className='overflow-auto'>
                            <table className='w-full'>
                                <thead className='border-b'>
                                    <tr>
                                        {Array.from({ length: 9 }).map((_, i) => (
                                            <th key={i} className='px-4 py-3'>
                                                <Skeleton className='h-4 w-full' />
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody>
                                    {Array.from({ length: 5 }).map((_, row) => (
                                        <tr key={row} className='border-b'>
                                            {Array.from({ length: 9 }).map((_, col) => (
                                                <td key={col} className='px-4 py-3'>
                                                    <Skeleton className='h-4 w-full' />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!header) {
        console.log({ header })
        return (
            <div className='p-10'>
                Record not found
            </div>
        )
    }

    return (
        <div className=' p-6 mt-8'>
            <div className='max-w-[1240px] mx-auto space-y-4'>

                {/* TOP */}
                <div className='flex items-start justify-between'>
                    <div className='flex w-full  items-center justify-between'>
                        <Breadcrumb
                            FirstPreviewsPageName='Receiving'
                            SecondPreviewPageName='Received Items'
                            CurrentPageName={`View #${header.id}`}
                        />


                        <Button
                            variant="outline"
                            onClick={() => router.back()}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                    </div>


                </div>
                <div className='mt-3 flex items-center gap-3'>
                    <h1 className='text-2xl font-semibold tracking-tight text-gray-800'>
                        Breeder Ref No. {header.brdr_ref_no || ''}
                    </h1>

                    {/* <div
                            className={`
                                px-2.5 py-1 rounded-md text-xs font-medium border
                                ${header.status === 'Open'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : header.status === 'Closed'
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : 'bg-gray-50 text-gray-700 border-gray-200'}
                            `}
                        >
                            {header.status}
                        </div> */}
                </div>

                {/* DOCUMENT DETAILS */}
                <div className='bg-white border rounded-xl overflow-hidden'>

                    <div className='px-5 py-4 border-b bg-[#fcfcfd]'>
                        <h2 className='text-sm font-semibold text-gray-700'>
                            Document Information
                        </h2>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4'>

                        {[
                            {
                                label: 'DR No.',
                                value: header.dr_num || '-',
                            },
                            {
                                label: 'Document Date',
                                value: header.doc_date || '-',
                            },
                            {
                                label: 'Breeder Ref No.',
                                value: header.brdr_ref_no || '-',
                            },
                            {
                                label: 'Shipped Via',
                                value: header.shipped_via || '-',
                            },
                            {
                                label: 'Driver',
                                value: header.driver || '-',
                            },
                            {
                                label: 'Plate No.',
                                value: header.plate_no || '-',
                            },
                            {
                                label: 'Serial No.',
                                value: header.serial_no || '-',
                            },
                        ].map((field, index) => (
                            <div
                                key={index}
                                className='px-5 py-4 border-b xl:border-b-0 xl:border-r last:border-r-0'
                            >
                                <div className='text-xs font-medium uppercase tracking-wide text-gray-400'>
                                    {field.label}
                                </div>

                                <div className='mt-1 text-sm font-medium text-gray-800 break-words'>
                                    {field.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* TABLE */}
                <div className='bg-white border rounded-xl overflow-hidden'>

                    <div className='px-5 py-4 border-b bg-[#fcfcfd] flex items-center justify-between'>
                        <div>
                            <h2 className='text-sm font-semibold text-gray-700'>
                                Receiving Lines
                            </h2>

                            <p className='text-xs text-gray-400 mt-0.5'>
                                Inventory receiving details
                            </p>
                        </div>

                        <div className='text-xs text-gray-400'>
                            {items.length} line(s)
                        </div>
                    </div>

                    <div className='overflow-auto'>
                        <table className='w-full text-sm'>
                            <thead className='bg-[#fafafa] border-b'>
                                <tr className='text-left'>
                                    <th className='px-4 py-3 font-medium text-gray-500 w-[70px]'>
                                        #
                                    </th>

                                    <th className='px-4 py-3 font-medium text-gray-500'>
                                        Breeder Ref
                                    </th>

                                    <th className='px-4 py-3 font-medium text-gray-500'>
                                        SKU
                                    </th>

                                    <th className='px-4 py-3 font-medium text-gray-500'>
                                        Lot No.
                                    </th>

                                    <th className='px-4 py-3 font-medium text-gray-500'>
                                        Production Date
                                    </th>

                                    <th className='px-4 py-3 font-medium text-gray-500 text-center'>
                                        Age
                                    </th>

                                    <th className='px-4 py-3 font-medium text-gray-500'>
                                        House No.
                                    </th>

                                    <th className='px-4 py-3 font-medium text-gray-500 text-right'>
                                        Expected
                                    </th>

                                    <th className='px-4 py-3 font-medium text-gray-500 text-right'>
                                        Actual
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {items.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        className='border-b last:border-b-0 hover:bg-[#fafafa]'
                                    >
                                        <td className='px-4 py-3 text-gray-500'>
                                            {index + 1}
                                        </td>

                                        <td className='px-4 py-3 text-gray-700'>
                                            {item.brdr_ref_no}
                                        </td>

                                        <td className='px-4 py-3 font-medium text-gray-800'>
                                            {item.sku}
                                        </td>

                                        <td className='px-4 py-3 text-gray-700'>
                                            {item.lot_no}
                                        </td>

                                        <td className='px-4 py-3 text-gray-700'>
                                            {item.prod_date}
                                        </td>

                                        <td className='px-4 py-3 text-center text-gray-700'>
                                            {item.age}
                                        </td>

                                        <td className='px-4 py-3 text-gray-700'>
                                            {item.house_no}
                                        </td>

                                        <td className='px-4 py-3 text-right font-medium text-gray-800'>
                                            {Number(item.expected_count).toLocaleString()}
                                        </td>

                                        <td className='px-4 py-3 text-right font-semibold text-gray-900'>
                                            {Number(item.actual_count).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}

                                {items.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            className='text-center py-10 text-gray-400'
                                        >
                                            No receiving lines found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}