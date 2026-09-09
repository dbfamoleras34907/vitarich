'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Breadcrumb from '@/lib/Breadcrumb'
import { usePermission } from '@/hooks/usePermission'
import { addUsersGroup } from '../api'

export default function NewUserGroupLayout() {
  const router = useRouter()
  const cannotInsert = usePermission('/admin/user-group/insert')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    group_name: '',
  })

  useEffect(() => {
    router.prefetch('/admin/user-group')
  }, [router])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.group_name.trim()) {
      toast('Please fill in the group name.')
      return
    }

    setSaving(true)
    try {
      await addUsersGroup(form)
      toast('User group created successfully')
      router.push('/admin/user-group')
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to save user group'))
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
          CurrentPageName="New User Group"
        />
      </div>
      <Card>
        <CardHeader><CardTitle>New User Group</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value="Auto generated" disabled />
              </div>
              <div className="space-y-2">
                <Label required>Group Name</Label>
                <Input
                  value={form.group_name}
                  onChange={event => setForm(prev => ({ ...prev, group_name: event.target.value }))}
                  placeholder="Administrator"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving || cannotInsert}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Group'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/admin/user-group')}>
                Back
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
