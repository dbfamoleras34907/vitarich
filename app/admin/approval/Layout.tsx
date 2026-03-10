'use client'
import { Button } from '@/components/ui/button'
import Breadcrumb from '@/lib/Breadcrumb'
import React from 'react'

export default function Layout() {
    return (
        <div>
            <div className='px-2'>
                <div className='flex mt-8  justify-between items-center'>
                    <Breadcrumb
                        FirstPreviewsPageLink='Admin'
                        CurrentPageName='Approval'
                    />
                    <div>
                        <Button>
                            Approve
                        </Button>
                    </div>
                </div>
            </div>
            <div className='mt-4 bg-white rounded-2xl'>

            </div>

        </div>
    )
}
