'use client'

import { Button } from '@/components/ui/button'
import Breadcrumb from '@/lib/Breadcrumb'
import { RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { Eraser, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { getActiveProjects } from '../../a_dean/projects/new/api'
import { Label } from '@/components/ui/label'
import ReceivingSysDrep from './ReceivingSysDrep'
import { islandGrouplist, regionList } from '@/lib/Defaults/DefaultValues'
import SearchableDropdown from '@/lib/SearchableDropdown'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover'
import { DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ParamsSysDrep from './ParamsSysDrep'
import TraceabilityDashboard from './ReceivingSysDrep'

export default function Layout() {
    const [region, setregion] = useState<string | undefined>()
    const [islandGroup, setIslandGroup] = useState<string | undefined>()
    const [dateRange, setDateRange] = useState<DateRange | undefined>()
    const [isMobile, setIsMobile] = useState(false)

    

    const route = useRouter()
    const [initialRows, setinitialRows] = useState<RowDataKey[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)

        return () => {
            window.removeEventListener('resize', checkMobile)
        }
    }, [])

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
        route.prefetch('/a_dean/projects/new')
        getInitialData()
    }, [])

    const dateLabel = () => {
        if (!dateRange?.from) return 'Select Date'

        if (dateRange.from && dateRange.to) {
            return `${format(dateRange.from, 'MMM dd, yyyy')} - ${format(
                dateRange.to,
                'MMM dd, yyyy'
            )}`
        }

        return format(dateRange.from, 'MMM dd, yyyy')
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mt-8 mb-4">
                <Breadcrumb
                    FirstPreviewsPageName="Hatchery"
                    SecondPreviewPageName="Reports"
                    CurrentPageName="System Adoption Report"
                />

                <div className=' flex gap-2'>
                    <Button size={"sm"} variant={"secondary"} onClick={() => {
                        setregion(undefined)
                        setIslandGroup(undefined)
                        setDateRange(undefined)
                    }}>
                        <Eraser />
                        Clear
                    </Button>

                    <Button size={"sm"}>
                        <Search />
                        Filter

                    </Button>
                </div>
            </div>
            <Card className=''>

                <div className="px-4  gap-4 grid md:grid-cols-2 grid-cols-1 ">
                    {/* Region */}
                    <div className="grid gap-2 w-full md:max-w-xs">
                        <Label>Region</Label>

                        <SearchableDropdown
                            value={region}
                            onChange={(e) => setregion(e)}
                            list={regionList}
                            codeLabel="code"
                            nameLabel="name"
                            placeholder="Select Region"
                        />
                    </div>

                    {/* Date Range */}
                    <div className="grid gap-2 w-full items-center">
                        <div className='md:w-xs md:ml-auto grid gap-2'>
                            <Label className=''>Date Range</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="w-full text-left bg-white border justify-start font-normal"
                                    >
                                        <div className="truncate">
                                            {dateLabel()}
                                        </div>
                                    </Button>
                                </PopoverTrigger>

                                <PopoverContent
                                    align="center"
                                    className="w-auto p-0 sm:w-auto w-[95vw]"
                                >
                                    <Calendar
                                        mode="range"
                                        selected={dateRange}
                                        onSelect={setDateRange}
                                        numberOfMonths={isMobile ? 1 : 2}
                                        initialFocus
                                        className="w-full"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Archipelago */}
                    <div className="grid gap-2 w-full md:max-w-xs">
                        <Label>Archipelago</Label>

                        <SearchableDropdown
                            value={islandGroup}
                            onChange={(e) => setIslandGroup(e)}
                            list={islandGrouplist}
                            codeLabel="code"
                            nameLabel="name"
                            placeholder="Select Archipelago"
                        />
                    </div>
                </div>
                <Separator />
                {/* Receiving */}


                <div className="px-4">

                    <Tabs defaultValue="dashboard" className="">
                        <TabsList>
                            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                            <TabsTrigger value="parameters">Parameters</TabsTrigger>
                        </TabsList>
                        <TabsContent value="dashboard">
                            <TraceabilityDashboard
                                archipelago={islandGroup}
                                region={region}
                                dateFrom={dateRange?.from ? dateRange.from.toISOString().split('T')[0] : undefined}
                                dateTo={dateRange?.to ? dateRange.to.toISOString().split('T')[0] : undefined}
                            />
                        </TabsContent>
                        <TabsContent value="parameters">
                            <ParamsSysDrep
                                archipelago={islandGroup}
                                region={region}
                                dateFrom={dateRange?.from ? dateRange.from.toISOString().split('T')[0] : undefined}
                                dateTo={dateRange?.to ? dateRange.to.toISOString().split('T')[0] : undefined}
                            />
                        </TabsContent>
                    </Tabs>


                
                </div>
            </Card>
        </div>
    )
}