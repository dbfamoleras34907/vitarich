'use client'

import { FormEvent, ReactNode, useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePermission } from '@/hooks/usePermission'
import { addUsersGroup } from '../api'

type NewUserGroupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => Promise<void>
  children: ReactNode
}

export default function NewUserGroupDialog({ open, onOpenChange, onCreated, children }: NewUserGroupDialogProps) {
  const cannotInsert = usePermission('/admin/user-group/insert')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    group_name: '',
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (saving) return
    setForm({ group_name: '' })
    onOpenChange(nextOpen)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || cannotInsert) return
    if (!form.group_name.trim()) {
      toast('Please fill in the group name.')
      return
    }

    setSaving(true)
    try {
      await addUsersGroup(form)
      toast('User group created successfully')
      setForm({ group_name: '' })
      onOpenChange(false)
      await onCreated()
    } catch (error) {
      toast('Error: ' + (error instanceof Error ? error.message : 'Unable to save user group'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent aria-describedby={undefined} showCloseButton={!saving}>
        <DialogHeader><DialogTitle>New User Group</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value="Auto generated" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-group-name" required>Group Name</Label>
                <Input
                  id="new-user-group-name"
                  disabled={saving}
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
              <Button type="button" variant="outline" disabled={saving} onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </form>
      </DialogContent>
    </Dialog>
  )
}
