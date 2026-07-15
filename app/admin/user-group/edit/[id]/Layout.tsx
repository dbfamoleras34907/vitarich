'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Breadcrumb from '@/lib/Breadcrumb'
import { usePermission } from '@/hooks/usePermission'
import { getUsersGroupById, updateUsersGroup } from '../../api'

export default function EditUserGroupLayout() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = Number(params.id)
  const cannotEdit = usePermission('/admin/user-group/edit')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: '',
    group_name: '',
  })

  useEffect(() => {
    if (!Number.isFinite(id)) {
      router.replace('/admin/user-group')
      return
    }

    getUsersGroupById(id)
      .then(data => setForm({
        code: data.code,
        group_name: data.group_name,
      }))
      .catch(error => {
        toast('Error: ' + (error instanceof Error ? error.message : 'Unable to load user group'))
        router.replace('/admin/user-group')
      })
      .finally(() => setLoading(false))
  }, [id, router])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.group_name.trim()) {
      toast('Please fill in the group name.')
      return
    }

    setSaving(true)
    try {
      await updateUsersGroup(id, form)
      toast('User group updated successfully')
      router.push('/admin/user-group')
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to update user group'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto p-6">
      <div className="mb-4">
        <Breadcrumb
          SecondPreviewPageName="Admin"
          SecondPreviewPageLink="/admin"
          FirstPreviewsPageName="User Group"
          FirstPreviewsPageLink="/admin/user-group"
          CurrentPageName="Edit User Group"
        />
      </div>
      <Card>
        <CardHeader><CardTitle>Edit User Group</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-stone-500">Loading user group...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={form.code} disabled />
                </div>
                <div className="space-y-2">
                  <Label required>Group Name</Label>
                  <Input
                    value={form.group_name}
                    onChange={event => setForm(prev => ({ ...prev, group_name: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={saving || cannotEdit}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push('/admin/user-group')}>
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
