'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Breadcrumb from '@/lib/Breadcrumb'
import { getItemGroupById } from '../../api'

type ItemGroupView = {
  code: string
  name: string
  remarks: string
}

export default function ViewItemGroupLayout() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const itemGroupId = Number(params.id)

  const [loading, setLoading] = useState(true)
  const [itemGroup, setItemGroup] = useState<ItemGroupView>({
    code: '',
    name: '',
    remarks: '',
  })

  useEffect(() => {
    router.prefetch('/a_dean/itemgroups')

    if (!Number.isInteger(itemGroupId) || itemGroupId <= 0) {
      toast('Invalid item group ID.')
      router.replace('/a_dean/itemgroups')
      return
    }

    const loadItemGroup = async () => {
      try {
        const data = await getItemGroupById(itemGroupId)
        setItemGroup({
          code: data.code || '',
          name: data.name || '',
          remarks: data.remarks || '',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load item group'
        toast('Error: ' + message)
        router.replace('/a_dean/itemgroups')
      } finally {
        setLoading(false)
      }
    }

    loadItemGroup()
  }, [itemGroupId, router])

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <RefreshCcw className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto p-6">
      <div className="mb-4">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          SecondPreviewPageName="Item Groups"
          SecondPreviewPageLink="/a_dean/itemgroups"
          CurrentPageName="View Item Group"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Item Group Details</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={itemGroup.code} readOnly className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={itemGroup.name} readOnly className="bg-muted" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea value={itemGroup.remarks} readOnly className="bg-muted" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/a_dean/itemgroups')}
          >
            Back
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
