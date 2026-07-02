'use client'
import { Button } from '@/components/ui/button'
import Breadcrumb from '@/lib/Breadcrumb'
import { List } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

export default function Layout() {
  const router = useRouter()

  return (
    <div>
      <main className="min-h-[calc(100vh-4rem)] bg-stone-50/40 pb-8 text-stone-950">
        <div className="mx-4 mt-4 flex items-center justify-between gap-3">
          <Breadcrumb
            SecondPreviewPageName="Inventory"
            SecondPreviewPageLink="/inv"
            FirstPreviewsPageName="Goods Receive"
            FirstPreviewsPageLink="/inv/gr"
            CurrentPageName={"Flock Card"}
          />
          <Button type="button" onClick={() => router.push('/inv/gr')}>
            New Flock Card
          </Button>
        </div>
      </main>
    </div>
  )
}
