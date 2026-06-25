'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { RefreshCcw, Save } from 'lucide-react'
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
import { getItemGroupById, updateItemGroup } from '../../api'

type ItemGroupForm = {
  code: string
  name: string
  remarks: string
}

export default function EditItemGroupLayout() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const itemGroupId = Number(params.id)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ItemGroupForm>({
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
        setForm({
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.code.trim() || !form.name.trim()) {
      toast('Please fill in code and name.')
      return
    }

    setSaving(true)

    try {
      await updateItemGroup(itemGroupId, {
        code: form.code.trim(),
        name: form.name.trim(),
        remarks: form.remarks.trim(),
      })
      toast('Item group updated successfully')
      router.push('/a_dean/itemgroups')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update item group'
      toast('Error: ' + message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <RefreshCcw className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto p-6">
      <div className="mb-4 flex justify-between items-center">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          SecondPreviewPageName="Item Groups"
          SecondPreviewPageLink="/a_dean/itemgroups"
          CurrentPageName="Edit Item Group"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Item Group</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label required>Code</Label>
                <Input
                  name="code"
                  value={form.code}
                  readOnly
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label required>Name</Label>
                <Input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                name="remarks"
                value={form.remarks}
                onChange={handleChange}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/a_dean/itemgroups')}
              >
                Back
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
