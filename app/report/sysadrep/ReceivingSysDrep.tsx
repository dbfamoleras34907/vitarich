import { Card } from '@/components/ui/card'
import React from 'react'

type Props = {
    dateFrom: string | undefined
    dateTo: string | undefined
    region: string | undefined
    archipelago: string | undefined
}
export default function ReceivingSysDrep({ dateFrom, dateTo, region, archipelago }: Props) {
    return (
        <div>
            <Card className=''>
                <div className='text-black/80 text-xs'>Recieved Eggs HE</div>
                <div className='text-4xl font-bold mx-auto'>1,000,000</div>
                {dateFrom}
                {dateTo}
                {region}
                {archipelago}
            </Card>
        </div>
    )
}
