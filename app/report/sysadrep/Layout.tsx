'use client'

import { Button } from '@/components/ui/button'
import Breadcrumb from '@/lib/Breadcrumb'
import { RowDataKey } from '@/lib/Defaults/DefaultTypes'
import { Eraser, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ParamsSysDrep from './ParamsSysDrep'
import TraceabilityDashboard from './ReceivingSysDrep'

const ALL_ISLAND_GROUPS = '__all_island_groups__'
const ALL_REGIONS = '__all_regions__'
const REGION_CODES_BY_ISLAND: Record<string, string[]> = {
    l: ['NCR', 'CAR', '01', '02', '03', '04A', '04B', '05'],
    v: ['06', '07', '08'],
    m: ['09', '10', '11', '12', '13', 'BARMM'],
}

type AppliedFilters = {
    islandGroup: string
    region: string
    dateFrom: string
    dateTo: string
}

export default function Layout() {
    const [region, setregion] = useState<string | undefined>()
    const [islandGroup, setIslandGroup] = useState<string | undefined>()
    const [dateRange, setDateRange] = useState<DateRange | undefined>()
    const [appliedFilters, setAppliedFilters] = useState<AppliedFilters | null>(null)
    const [isMobile, setIsMobile] = useState(false)

    const regionOptions = useMemo(() => {
        if (!islandGroup) return []
        if (islandGroup === ALL_ISLAND_GROUPS) {
            return [
                { code: ALL_REGIONS, name: 'All Regions' },
                ...regionList,
            ]
        }
        const regionCodes = REGION_CODES_BY_ISLAND[islandGroup] ?? []
        return [
            { code: ALL_REGIONS, name: 'All Regions' },
            ...regionList.filter(item => item.code && regionCodes.includes(item.code)),
        ]
    }, [islandGroup])

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
                        setAppliedFilters(null)
                    }}>
                        <Eraser />
                        Clear
                    </Button>

                    <Button
                        size={"sm"}
                        disabled={!islandGroup || !region || !dateRange?.from || !dateRange?.to}
                        onClick={() => {
                            if (!islandGroup || !region || !dateRange?.from || !dateRange?.to) return
                            setAppliedFilters({
                                islandGroup,
                                region,
                                dateFrom: format(dateRange.from, 'yyyy-MM-dd'),
                                dateTo: format(dateRange.to, 'yyyy-MM-dd'),
                            })
                        }}
                    >
                        <Search />
                        Filter

                    </Button>
                </div>
            </div>
            <Card className="gap-0 overflow-hidden">
                <CardHeader className="border-b border-border px-4 py-3">
                    <CardTitle className="text-sm">Report filters</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 items-end gap-4 px-4 py-4 md:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_minmax(200px,1fr)_minmax(280px,1.4fr)]">
                    <div className="grid min-w-0 gap-2">
                        <Label>Island Group <span className="text-destructive">*</span></Label>

                        <SearchableDropdown
                            value={islandGroup}
                            onChange={(value) => {
                                setIslandGroup(value)
                                setregion(value ? ALL_REGIONS : undefined)
                                setAppliedFilters(null)
                            }}
                            list={[
                                { code: ALL_ISLAND_GROUPS, name: 'All Island Groups' },
                                ...islandGrouplist,
                            ]}
                            codeLabel="code"
                            nameLabel="name"
                            placeholder="Select Island Group"
                            showNameOnly
                        />
                    </div>

                    <div className="grid min-w-0 gap-2">
                        <Label>Region <span className="text-destructive">*</span></Label>

                        <SearchableDropdown
                            value={region}
                            onChange={(value) => {
                                setregion(value)
                                setAppliedFilters(null)
                            }}
                            list={regionOptions}
                            codeLabel="code"
                            nameLabel="name"
                            placeholder={islandGroup ? 'Select Region' : 'Select Island Group First'}
                            showNameOnly
                            disabled={!islandGroup}
                        />
                        {/* <p className="text-xs text-muted-foreground">
                            Select All Region to include every region in the chosen island group.
                        </p> */}
                    </div>

                    <div className="grid min-w-0 gap-2">
                        <Label>Date Range <span className="text-destructive">*</span></Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-10 w-full justify-start overflow-hidden text-left font-normal"
                                >
                                    <span className="truncate">{dateLabel()}</span>
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent align="start" className="w-auto max-w-[calc(100vw-24px)] p-0">
                                <Calendar
                                    mode="range"
                                    selected={dateRange}
                                    onSelect={(range) => {
                                        setDateRange(range)
                                        setAppliedFilters(null)
                                    }}
                                    numberOfMonths={isMobile ? 1 : 2}
                                    initialFocus
                                    className="w-full"
                                />
                            </PopoverContent>
                        </Popover>
                        {/* <p className="text-xs text-muted-foreground">Choose both a start and end date to run the report.</p> */}
                    </div>
                </CardContent>
                <Separator />

                <div className="px-4 mt-2">

                    <Tabs defaultValue="dashboard" className="">
                        <TabsList>
                            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                            <TabsTrigger value="parameters">Parameters</TabsTrigger>
                        </TabsList>
                        <TabsContent value="dashboard">
                            {appliedFilters ? (
                                <TraceabilityDashboard
                                    archipelago={appliedFilters.islandGroup === ALL_ISLAND_GROUPS ? undefined : appliedFilters.islandGroup}
                                    region={appliedFilters.region === ALL_REGIONS ? undefined : appliedFilters.region}
                                    dateFrom={appliedFilters.dateFrom}
                                    dateTo={appliedFilters.dateTo}
                                />
                            ) : (
                                <div className="my-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                    Select an island group and a complete date range, then choose Filter to view the report.
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="parameters">
                            {appliedFilters ? (
                                <ParamsSysDrep
                                    archipelago={appliedFilters.islandGroup === ALL_ISLAND_GROUPS ? undefined : appliedFilters.islandGroup}
                                    region={appliedFilters.region === ALL_REGIONS ? undefined : appliedFilters.region}
                                    dateFrom={appliedFilters.dateFrom}
                                    dateTo={appliedFilters.dateTo}
                                />
                            ) : (
                                <div className="my-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                    Select an island group and a complete date range, then choose Filter to view the parameters.
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>


                
                </div>
            </Card>
        </div>
    )
}