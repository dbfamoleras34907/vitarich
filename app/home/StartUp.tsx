'use client'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Filter, MoreHorizontal } from 'lucide-react'
import Breadcrumb from '@/lib/Breadcrumb'
import { getAuthId } from '@/lib/getAuthId'
import { checkUserActive } from '@/lib/CheckUserIfActive'
import { useLayoutEffect } from 'react'

export default function StockDashboard() {
    const check = async () => {
        const authId = await getAuthId();

        await checkUserActive(authId || "");
    }
    useLayoutEffect(() => {
        check()
    }, [])

    return (
        <main className="min-h-screen p-6 space-y-6">
            {/* <div className="text-sm text-muted-foreground">
        Dashboard / Stock
      </div> */}
            <Breadcrumb
                FirstPreviewsPageName='Home'
                CurrentPageName='Dashboard'
            />

            <div className='bg-white p-4  rounded-2xl gap-4  space-y-4'>
                <div className="grid gap-4 md:grid-cols-3 ">
                    <Card className="bg-white">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">
                                Total Active Items
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-3xl font-bold">28</CardContent>
                    </Card>

                    <Card className="bg-white">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">
                                Total Warehouses
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-3xl font-bold">9</CardContent>
                    </Card>

                    <Card className="bg-white">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">
                                Total Stock Value
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-3xl font-bold">
                            0.000
                        </CardContent>
                    </Card>
                </div>

                <Card className="bg-white">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Warehouse wise Stock Value</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Last synced just now
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" size="icon">
                                <Filter className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="h-[260px] flex items-center justify-center text-muted-foreground">
                        No Data
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card className="bg-white">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Purchase Receipt Trends</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Last synced
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" size="icon">
                                    <Filter className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm">
                                    Last Year
                                </Button>
                                <Button variant="outline" size="sm">
                                    Monthly
                                </Button>
                                <Button variant="outline" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>

                        <Separator />

                        <CardContent className="h-[260px] flex items-center justify-center text-muted-foreground">
                            No Data
                        </CardContent>
                    </Card>

                    <Card className="bg-white">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Delivery Trends</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Last synced
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" size="icon">
                                    <Filter className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm">
                                    Last Year
                                </Button>
                                <Button variant="outline" size="sm">
                                    Monthly
                                </Button>
                                <Button variant="outline" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>

                        <Separator />

                        <CardContent className="h-[260px] flex items-center justify-center text-muted-foreground">
                            No Data
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    )
}

