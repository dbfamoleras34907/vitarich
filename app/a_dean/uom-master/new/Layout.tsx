'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Breadcrumb from '@/lib/Breadcrumb'
import { addUomMaster } from '../api'

export default function NewUomMasterLayout() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', remarks: '' })

  useEffect(() => {
    router.prefetch('/a_dean/uom-master')
  }, [router])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.code.trim() || !form.name.trim()) {
      toast('Please fill in the UoM code and name.')
      return
    }

    setSaving(true)
    try {
      await addUomMaster(form)
      toast('UoM created successfully')
      router.push('/a_dean/uom-master')
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to save UoM'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto p-6">
      <div className="mb-4">
        <Breadcrumb
          FirstPreviewsPageName="Inventory"
          SecondPreviewPageName="UoM Master"
          SecondPreviewPageLink="/a_dean/uom-master"
          CurrentPageName="New UoM"
        />
      </div>
      <Card>
        <CardHeader><CardTitle>New Unit of Measure</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label required>UoM Code</Label>
                <Input
                  value={form.code}
                  onChange={event => setForm(prev => ({ ...prev, code: event.target.value.toUpperCase() }))}
                  placeholder="PCS"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label required>UoM Name</Label>
                <Input
                  value={form.name}
                  onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                  placeholder="Piece"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={event => setForm(prev => ({ ...prev, remarks: event.target.value }))}
                placeholder="Optional notes"
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save UoM'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/a_dean/uom-master')}>
                Back
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
