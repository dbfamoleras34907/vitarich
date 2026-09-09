'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Breadcrumb from '@/lib/Breadcrumb'
import { getUomMasterById, updateUomMaster } from '../../api'

export default function EditUomMasterLayout() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = Number(params.id)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', remarks: '' })

  useEffect(() => {
    if (!Number.isFinite(id)) {
      router.replace('/a_dean/uom-master')
      return
    }

    getUomMasterById(id)
      .then(data => setForm({
        code: data.code,
        name: data.name,
        remarks: data.remarks || '',
      }))
      .catch(error => {
        toast('Error: ' + (error instanceof Error ? error.message : 'Unable to load UoM'))
        router.replace('/a_dean/uom-master')
      })
      .finally(() => setLoading(false))
  }, [id, router])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.code.trim() || !form.name.trim()) {
      toast('Please fill in the UoM code and name.')
      return
    }

    setSaving(true)
    try {
      await updateUomMaster(id, form)
      toast('UoM updated successfully')
      router.push('/a_dean/uom-master')
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to update UoM'))
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
          CurrentPageName="Edit UoM"
        />
      </div>
      <Card>
        <CardHeader><CardTitle>Edit Unit of Measure</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-stone-500">Loading UoM...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label required>UoM Code</Label>
                  <Input
                    value={form.code}
                    onChange={event => setForm(prev => ({ ...prev, code: event.target.value.toUpperCase() }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label required>UoM Name</Label>
                  <Input
                    value={form.name}
                    onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={form.remarks}
                  onChange={event => setForm(prev => ({ ...prev, remarks: event.target.value }))}
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push('/a_dean/uom-master')}>
                  Back
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
