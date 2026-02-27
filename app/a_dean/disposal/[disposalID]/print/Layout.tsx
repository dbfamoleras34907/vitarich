import { Button } from '@/components/ui/button'
import Breadcrumb from '@/lib/Breadcrumb'
import { Printer } from 'lucide-react'
import React from 'react'

export default function Layout() {
  return (
    <div>
      <div className='flex items-center justify-between px-4'>
        <div className='mt-8'>
          <Breadcrumb
            FirstPreviewsPageName='Harchery'
            SecondPreviewPageName='Disposal'
            CurrentPageName='Print Disposal'
          />
        </div>
        <div>
          <Button><Printer /> Print</Button>
        </div>

      </div>

{/*  */}
      <div>
      {/* <Image src="/assets/images/print.png" alt="Print Layout" width={1200} height={800} className='mx-auto mt-8' />
app/a_dean/disposal/[disposalID]/print/vitarich.png */}
      </div>
    </div>
  )
} 