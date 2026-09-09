'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
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
import { addItemGroup } from '../api'

export default function NewItemGroupLayout() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    code: '',
    name: '',
    remarks: '',
  })

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

    setLoading(true)

    try {
      await addItemGroup({
        code: form.code.trim(),
        name: form.name.trim(),
        remarks: form.remarks.trim(),
      })
      toast('Item group created successfully')
      router.push('/a_dean/itemgroups')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save item group'
      toast('Error: ' + message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    router.prefetch('/a_dean/itemgroups')
  }, [router])

  return (
    <div className="mx-auto p-6">
      <div className="mb-4 flex justify-between items-center">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          SecondPreviewPageName="Item Groups"
          SecondPreviewPageLink="/a_dean/itemgroups"
          CurrentPageName="New Item Group"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Item Group</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label required>Code</Label>
                <Input
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  required
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
              <Button type="submit" disabled={loading}>
                <Plus className="mr-2 h-4 w-4" />
                {loading ? 'Saving...' : 'Save'}
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
