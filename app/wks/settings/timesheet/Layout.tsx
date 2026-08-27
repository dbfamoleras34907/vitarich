'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import SearchableCombobox, { type ComboboxItemType } from '@/components/SearchableCombobox'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePermission } from '@/hooks/usePermission'
import Breadcrumb from '@/lib/Breadcrumb'
import {
  getWorkspaceActivityTypes,
  getWorkspaceEmailRecipientUsers,
  getWorkspaceSupervisorUsers,
  getWorkspaceTaskTypes,
  getWorkspaceTimesheetSettings,
} from '@/lib/data/repositories/workspace'
import { saveWorkspaceTimesheetSettings } from '@/lib/data/mutations/workspace'

export default function Layout() {
  const editDenied = usePermission('/wks/settings/timesheet/edit')
  const [activities, setActivities] = useState<ComboboxItemType[]>([])
  const [taskTypes, setTaskTypes] = useState<ComboboxItemType[]>([])
  const [supervisorUsers, setSupervisorUsers] = useState<ComboboxItemType[]>([])
  const [emailRecipientUsers, setEmailRecipientUsers] = useState<ComboboxItemType[]>([])
  const [defaultActivityId, setDefaultActivityId] = useState('')
  const [defaultPriority, setDefaultPriority] = useState('mid')
  const [defaultTaskTypeId, setDefaultTaskTypeId] = useState('')
  const [supervisorUserId, setSupervisorUserId] = useState('')
  const [defaultCcUserIds, setDefaultCcUserIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadSettings = async () => {
      try {
        const [activityRows, taskTypeRows, supervisorRows, emailRecipientRows, settings] = await Promise.all([
          getWorkspaceActivityTypes(),
          getWorkspaceTaskTypes(),
          getWorkspaceSupervisorUsers(),
          getWorkspaceEmailRecipientUsers(),
          getWorkspaceTimesheetSettings(),
        ])
        if (cancelled) return

        setActivities(activityRows.map(activity => ({
          code: String(activity.id),
          name: activity.name,
        })))
        setTaskTypes(taskTypeRows.map(taskType => ({
          code: String(taskType.id),
          name: taskType.name,
        })))
        setSupervisorUsers(supervisorRows.map(user => {
          const fullName = [user.firstname, user.middlename, user.lastname]
            .map(value => String(value ?? '').trim())
            .filter(Boolean)
            .join(' ')
          const tag = user.user_type === 1 ? 'Super Admin' : 'Admin / Supervisor'
          return {
            code: String(user.id),
            name: `${fullName || user.email} - ${user.email} - ${tag}`,
          }
        }))
        setEmailRecipientUsers(emailRecipientRows.map(user => {
          const fullName = [user.firstname, user.middlename, user.lastname]
            .map(value => String(value ?? '').trim())
            .filter(Boolean)
            .join(' ')
          return {
            code: String(user.id),
            name: `${fullName || user.email} - ${user.email}`,
          }
        }))
        setDefaultActivityId(settings.default_activity_type_id
          ? String(settings.default_activity_type_id)
          : '')
        setDefaultPriority(settings.default_priority ?? 'mid')
        setDefaultTaskTypeId(settings.default_task_type_id
          ? String(settings.default_task_type_id)
          : String(taskTypeRows[0]?.id ?? ''))
        setSupervisorUserId(settings.supervisor_user_id
          ? String(settings.supervisor_user_id)
          : '')
        setDefaultCcUserIds((settings.default_cc_user_ids ?? []).map(String))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load timesheet settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadSettings()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (editDenied) {
      toast.error('You do not have permission to edit timesheet settings')
      return
    }
    if (!defaultActivityId) {
      toast.error('Select a default activity')
      return
    }
    if (!defaultPriority) {
      toast.error('Select a default priority')
      return
    }
    if (!defaultTaskTypeId) {
      toast.error('Select a default task type')
      return
    }
    if (!supervisorUserId) {
      toast.error('Select a supervisor')
      return
    }

    setSaving(true)
    try {
      const saved = await saveWorkspaceTimesheetSettings({
        default_activity_type_id: Number(defaultActivityId),
        default_priority: defaultPriority as 'low' | 'mid' | 'high',
        default_task_type_id: Number(defaultTaskTypeId),
        supervisor_user_id: Number(supervisorUserId),
        default_cc_user_ids: defaultCcUserIds.map(Number),
      })
      setSupervisorUserId(String(saved.supervisor_user_id ?? ''))
      setDefaultCcUserIds((saved.default_cc_user_ids ?? []).map(String))
      toast.success('Timesheet settings saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save timesheet settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-3 sm:p-4">
      <div>
        <Breadcrumb FirstPreviewsPageName="Workspace" CurrentPageName="Timesheet Settings" />
        <p className="mt-1 text-sm text-muted-foreground">
          Configure defaults used when recording and emailing timesheets.
        </p>
      </div>

      <Card className="p-4 shadow-none">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <SearchableCombobox
              label="Default Activity"
              required
              items={activities}
              value={defaultActivityId}
              onValueChange={setDefaultActivityId}
              disabled={editDenied || loading || saving}
              className="w-full max-w-none"
              placeholder={loading ? 'Loading activities...' : 'Select activity'}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Automatically selected for new timesheet rows.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <SearchableCombobox
                label="Default Priority"
                required
                items={[
                  { code: 'low', name: 'Low' },
                  { code: 'mid', name: 'Medium' },
                  { code: 'high', name: 'High' },
                ]}
                value={defaultPriority}
                onValueChange={setDefaultPriority}
                disabled={editDenied || loading || saving}
                className="w-full max-w-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used when a task is created from a timesheet.
              </p>
            </div>

            <div>
              <SearchableCombobox
                label="Default Task Type"
                required
                items={taskTypes}
                value={defaultTaskTypeId}
                onValueChange={setDefaultTaskTypeId}
                disabled={editDenied || loading || saving}
                className="w-full max-w-none"
                placeholder={loading ? 'Loading task types...' : 'Select task type'}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used when a task is created from a timesheet.
              </p>
            </div>
          </div>

          <div>
            <SearchableCombobox
              label="Supervisor Email"
              required
              items={supervisorUsers}
              value={supervisorUserId}
              onValueChange={value => {
                setSupervisorUserId(value)
                setDefaultCcUserIds(current => current.filter(userId => userId !== value))
              }}
              className="w-full max-w-none"
              placeholder={loading ? 'Loading supervisors...' : 'Select Admin or Super Admin'}
              disabled={editDenied || loading || saving}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used as the default recipient when sending the Timesheet Report.
            </p>
          </div>

          <div>
            <SearchableCombobox
              multiple
              label="Default CC Recipients"
              items={emailRecipientUsers.filter(user => user.code !== supervisorUserId)}
              value={defaultCcUserIds}
              onValueChange={setDefaultCcUserIds}
              allowSelectAll={false}
              className="w-full max-w-none"
              placeholder={loading ? 'Loading email recipients...' : 'Select users to copy'}
              disabled={editDenied || loading || saving}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              These users are copied automatically when sending the Timesheet Report.
            </p>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={editDenied || loading || saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Save Settings
            </Button>
          </div>
        </form>
      </Card>
    </main>
  )
}
