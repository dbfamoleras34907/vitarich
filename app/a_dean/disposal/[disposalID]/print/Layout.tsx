'use client'
import { Button } from '@/components/ui/button'
import Breadcrumb from '@/lib/Breadcrumb'
import { Printer } from 'lucide-react'
import { useParams } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { getDisposalPrint } from './api'
import { DisposalPrintRow } from '@/lib/types'
import { getDateOnly } from '@/lib/DefaultFunctions'

export default function Layout() {
  const [data, setdata] = useState<DisposalPrintRow[]>([])
  const { disposalID } = useParams()
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'My Report',
  })

  const getData = async () => {
    const data = await getDisposalPrint(Number(disposalID))
    setdata(data || [])
  }

  // ✅ Full name
  const fullName = `${data[0]?.firstname || ''} ${data[0]?.middlename || ''} ${data[0]?.lastname || ''}`.trim()

  // ✅ Always produce exactly 10 rows
  const lineItems = useMemo(() => {
    const rows = data ?? []
    const padded = [...rows]

    while (padded.length < 10) {
      padded.push({
        sku: '',
        description: '',
        qty: '',
        unit: '',
      } as any)
    }

    return padded.slice(0, 10)
  }, [data])

  useEffect(() => {
   getData()
  }, [disposalID])
  
  return (
    <div>
      <div className='flex items-center justify-between px-4'>
        <div className='my-8'>
          <Breadcrumb
            FirstPreviewsPageName='Harchery'
            SecondPreviewPageName='Disposal'
            CurrentPageName='Print Disposal'
          />
        </div>

        <div>
          {/* <Button onClick={getData}>Check</Button> */}
          <Button onClick={handlePrint}><Printer /> Print</Button>
        </div>
      </div>

      <div className='max-h-[calc(100vh-13rem)] overflow-y-auto '>
        <div className=' bg-white mx-4 rounded-2xl shadow w-fit'>
          <div ref={printRef} className="a4-page">

            {/* Header Information */}
            <div className='flex gap-4 '>

              {/* LOGO */}
              <div className='w-fit mt-2 '>
                <div className='flex flex-col items-center'>
                  <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 688 677">
                    <g>
                      <path d="M 550.89 60.90 ... Z" fill="rgb(134,114,42)" />
                    </g>
                  </svg>

                  <div className='italic items-center'>
                    <div className='flex gap-2 italic font-bold leading-[1.2] mx-auto w-fit'>
                      <p>V</p><p>I</p><p>T</p><p>A</p><p>R</p><p>I</p><p>C</p><p>H</p>
                    </div>
                    <div className='text-xs mx-auto w-fit'>
                      Rich in History. Rich in Experience
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <div className='font-bold text-xl mt-1'>VITARICH</div>
                <div className='-mt-1 text-sm'>Address: <span>Marilao-San Jose Road, Sta. Rosa 1, Marilao Bulacan</span></div>
                <div className='-mt-1 text-sm'>Tel No.: <span>843-3033 Loc 129</span></div>
                <div className='-mt-1 text-sm'>Fax No.: <span>843-3033 Loc 400</span></div>
                <div className='-mt-1 text-sm'>VAT REG: <span>000-234-398-000</span></div>
              </div>

              {/* Doc Info */}
              <div>
                <div className='font-bold whitespace-nowrap'>TRANSFER SLIP</div>

                <div className='flex whitespace-nowrap'>
                  <div>DOC NO.</div>
                  <div className='border-b-2 border-black w-full'>
                    {data[0]?.ds_no || ""}
                  </div>
                </div>

                <div className='flex whitespace-nowrap'>
                  <div>DATE</div>
                  <div className='border-b-2 border-black w-full'>
                    <span className='mx-1'>
                      {getDateOnly(data[0]?.created_at || "")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Header 2 */}
            <div className='mt-8'>
              <div className='flex'>
                <div className='w-45 font-bold'>DELIVERED TO : </div>
                <div className='w-full border-b-2 border-black px-2'>
                  {data[0]?.cardname || ""}
                </div>
              </div>

              <div className='flex'>
                <div className='w-45 font-bold'>ADDRESS :</div>
                <div className='w-full border-b-2 border-black px-2'>
                  {data[0]?.customer_address || ""}
                </div>
              </div>

              <div className='flex mt-5'>
                <div className='w-45 font-bold'>FROM : </div>
                <div className='w-full border-b-2 border-black px-2'>
                  {data[0]?.ifrom || ""}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className='mt-8'>
              <div>Transferred the following material and supplies in good condition.</div>

              <table>
                <thead className='bg-gray-300'>
                  <tr>
                    <th className='whitespace-nowrap border-2 border-black px-4'>PROD CODE</th>
                    <th className='whitespace-nowrap border-2 border-black w-full'>DESCRIPTION</th>
                    <th className='whitespace-nowrap border-2 border-black px-4'>QUANTITY</th>
                    <th className='whitespace-nowrap border-2 border-black px-4'>UNIT</th>
                  </tr>
                </thead>

                <tbody>
                  {lineItems.map((item, i) => (
                    <tr key={i}>
                      <td className='whitespace-nowrap border-2 border-black px-4'>
                        {item.sku || ""}
                      </td>

                      <td className='whitespace-nowrap border-2 border-black w-full'>
                        {item.description || ""}
                      </td>

                      <td className='whitespace-nowrap border-2 border-black px-4 text-right'>
                        {item.qty || ""}
                      </td>

                      <td className='whitespace-nowrap border-2 border-black px-4'>
                        {item.unit || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className='text-sm'>
                NOTE: The authorized courier shall be responsible for any loss or damage to the materials and supplies while in transit. Such liability shall be extinguished only upon the authorized transferee’s acknowledgment of receipt of the materials and supplies in the same condition as specified above.
              </p>

              {/* Signatures */}
              <div className='grid-cols-2 grid gap-2'>

                <div>
                  <div className=''>ISSUED BY :</div>
                  <div className='border-b-2 border-black text-center'>
                    {fullName || ""}
                  </div>
                <div className='mx-auto w-fit'>   {"(Transferor)"}</div>
                </div>

                
                <div>
                  <div className=''>RECEIVED BY :</div>
                  <div className='border-b-2 border-black text-center'>
                   -
                  </div>
                <div className='mx-auto w-fit'>   {"(Transferee)"}</div>
                </div>

                <div>
                  <div className='pb-4'>DATE :</div>
                  <div className='border-t-2 border-black'></div>
                </div>

                <div>
                  <div className='pb-4'>DATE :</div>
                  <div className='border-t-2 border-black'></div>
                </div>

                <div>
                  <div className='pb-4'>RECEIVED BY :</div>
                  <div className='border-t-2 border-black text-center'>(Authorized Courier)</div>
                </div>

                <div>
                  <div className='-mt-1'>Original - desctribution / transferee</div>
                  <div className='-mt-1'>Pink - Transferor</div>
                  <div className='-mt-1'>Yellow - Accounting</div>
                  <div className='-mt-1'>Blue - transferee</div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}