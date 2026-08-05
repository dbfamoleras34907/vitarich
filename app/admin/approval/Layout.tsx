'use client'

import Breadcrumb from '@/lib/Breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import DynamicTable, { type Column, type FilterRule } from '@/components/ui/DataTableV2'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import TriggerUserPickerDialog from './TriggerUserPickerDialog'
import { usePermission } from '@/hooks/usePermission'
import { getAuthId } from '@/lib/getAuthId'
import { getProfileByAuthId } from '../user/api'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { NavFolders } from '@/lib/Defaults/DefaultValues'
import {
  Check,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ThumbsDown,
  Trash2,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ApprovalRequestRow,
  ApprovalTemplateApproverRow,
  ApprovalTemplateTriggerRow,
  ApprovalTriggerUser,
  ApprovalTemplateRow,
  approveDocumentApproval,
  approveLegacyApprovalRequest,
  createApprovalTemplate,
  getApprovalRequests,
  getApprovalTemplates,
  getApprovalTemplateApprovers,
  getApprovalTemplateTriggers,
  getApprovalUsers,
  rejectApproval,
  rejectDocumentApproval,
  voidApprovalTemplate,
  voidApprovalTemplateApprover,
  voidApprovalTemplateTrigger,
  upsertApprovalTemplateApprover,
  upsertApprovalTemplateTrigger,
} from './api'
import { UserRow } from '@/lib/types'
import { getUsersGroups, UsersGroup } from '../user-group/api'

type ApprovalLayoutMode = 'inbox' | 'management'

type ApprovalRequestTableRow = Record<string, unknown> & ApprovalRequestRow & {
  request_label: string
  document_label: string
  requester_label: string
}

type TemplateForm = {
  name: string
  document_type: string
  description: string
  priority: string
}

type ApprovalDocumentType = {
  label: string
  value: string
}

type TriggerForm = {
  id: number | null
  template_id: string
  name: string
  users: ApprovalTriggerUser[]
}

type ApproverForm = {
  id: number | null
  template_id: string
  name: string
  users: ApprovalTriggerUser[]
  approval_mode: 'any' | 'count'
  required_count: string
}

const emptyTemplateForm: TemplateForm = {
  name: '',
  document_type: '',
  description: '',
  priority: '100',
}

const emptyTriggerForm: TriggerForm = {
  id: null,
  template_id: '',
  name: '',
  users: [],
}

const emptyApproverForm: ApproverForm = {
  id: null,
  template_id: '',
  name: '',
  users: [],
  approval_mode: 'any',
  required_count: '1',
}

const pendingApprovalFilters: FilterRule[] = [
  {
    id: 'status',
    columnKey: 'status',
    operator: 'like',
    value: 'pending',
    joiner: 'and',
  },
]

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function statusVariant(status?: string) {
  if (status === 'approved') return 'default'
  if (status === 'rejected' || status === 'cancelled') return 'destructive'
  return 'secondary'
}

function documentTypeValue(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date)
  nextDate.setMonth(nextDate.getMonth() + months)
  return nextDate
}

export default function Layout({ mode = 'inbox' }: { mode?: ApprovalLayoutMode }) {
  const [requests, setRequests] = useState<ApprovalRequestRow[]>([])
  const [templates, setTemplates] = useState<ApprovalTemplateRow[]>([])
  const [triggers, setTriggers] = useState<ApprovalTemplateTriggerRow[]>([])
  const [approvers, setApprovers] = useState<ApprovalTemplateApproverRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [userGroups, setUserGroups] = useState<UsersGroup[]>([])
  const [dateFrom, setDateFrom] = useState(() => toDateInputValue(addMonths(new Date(), -1)))
  const [dateTo, setDateTo] = useState(() => toDateInputValue(new Date()))
  const [loading, setLoading] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [templateForm, setTemplateForm] = useState<TemplateForm>(emptyTemplateForm)
  const [triggerForm, setTriggerForm] = useState<TriggerForm>(emptyTriggerForm)
  const [approverForm, setApproverForm] = useState<ApproverForm>(emptyApproverForm)
  const [userPickerOpen, setUserPickerOpen] = useState(false)
  const [approverPickerOpen, setApproverPickerOpen] = useState(false)
  const { setValue } = useGlobalContext()
  const permissionBase = mode === 'management' ? '/admin/approval/management' : '/admin/approval'
  const canView = !usePermission(`${permissionBase}/view`)
  const canEdit = !usePermission(`${permissionBase}/edit`)
  const canUpdate = canEdit

  const templateById = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates]
  )

  const approvalDocumentTypes = useMemo<ApprovalDocumentType[]>(
    () =>
      NavFolders.flatMap((folder) =>
        folder.items?.flatMap((group) =>
          group.children
            .filter((child) => child.approval)
            .map((child) => ({
              label: child.title,
              value: documentTypeValue(child.title),
            }))
        ) ?? []
      ),
    []
  )

  const triggerByTemplateId = useMemo(
    () => new Map(triggers.map((trigger) => [trigger.template_id, trigger])),
    [triggers]
  )

  const approverByTemplateId = useMemo(
    () => new Map(approvers.map((approver) => [approver.template_id, approver])),
    [approvers]
  )

  const userGroupById = useMemo(
    () => new Map(userGroups.map((group) => [String(group.id), group])),
    [userGroups]
  )

  const approvalRequestRows = useMemo<ApprovalRequestTableRow[]>(
    () =>
      requests.map((request) => ({
        ...request,
        request_label: request.request_type || request.document_type || 'approval',
        document_label: request.document_no || String(request.document_id ?? '-'),
        requester_label: request.user_email || '-',
      })),
    [requests]
  )

  const loadModule = useCallback(async () => {
    setLoading(true)
    try {
      const [requestRows, templateRows, triggerRows, approverRows, userRows, groupRows] =
        await Promise.all([
          getApprovalRequests({
            dateFrom,
            dateTo,
          }),
          getApprovalTemplates(),
          getApprovalTemplateTriggers(),
          getApprovalTemplateApprovers(),
          getApprovalUsers(),
          getUsersGroups(),
        ])

      setRequests(requestRows)
      setTemplates(templateRows)
      setTriggers(triggerRows)
      setApprovers(approverRows)
      setUsers(userRows)
      setUserGroups(groupRows)
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Unable to load approval module'))
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    loadModule()
  }, [loadModule])

  useEffect(() => {
    setValue('loading_g', loading)
  }, [loading, setValue])

  async function handleApprove(request: ApprovalRequestRow) {
    setLoading(true)
    try {
      if (request.request_type === 'password_reset') {
        await approveLegacyApprovalRequest(request.id)
      } else {
        await approveDocumentApproval(request.id, remarks)
      }

      toast.success('Approval request approved')
      setRemarks('')
      await loadModule()
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Unable to approve request'))
    } finally {
      setLoading(false)
    }
  }

  async function handleReject(request: ApprovalRequestRow) {
    setLoading(true)
    try {
      if (request.request_type === 'password_reset') {
        const authId = await getAuthId()
        if (!authId) throw new Error('Session error')

        const user = await getProfileByAuthId(authId)
        if (!user?.id) throw new Error('User profile not found')

        await rejectApproval(request.id, user.id)
      } else {
        await rejectDocumentApproval(request.id, remarks || 'Rejected')
      }

      toast.success('Approval request rejected')
      setRemarks('')
      await loadModule()
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Unable to reject request'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateTemplate(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      await createApprovalTemplate({
        name: templateForm.name.trim(),
        document_type: templateForm.document_type.trim(),
        description: templateForm.description.trim(),
        priority: Number(templateForm.priority) || 100,
      })
      setTemplateForm(emptyTemplateForm)
      toast.success('Approval template created')
      await loadModule()
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Unable to create template'))
    } finally {
      setLoading(false)
    }
  }

  function handleTriggerTemplateChange(templateId: string) {
    const template = templateById.get(Number(templateId))
    const existingTrigger = triggerByTemplateId.get(Number(templateId))

    setTriggerForm({
      id: existingTrigger?.id ?? null,
      template_id: templateId,
      name: existingTrigger?.name ?? `${template?.name ?? 'Approval'} Trigger`,
      users: existingTrigger?.users ?? [],
    })
  }

  function handleApproverTemplateChange(templateId: string) {
    const template = templateById.get(Number(templateId))
    const existingApprover = approverByTemplateId.get(Number(templateId))

    setApproverForm({
      id: existingApprover?.id ?? null,
      template_id: templateId,
      name: existingApprover?.name ?? `${template?.name ?? 'Approval'} Approvers`,
      users: existingApprover?.users ?? [],
      approval_mode: existingApprover?.approval_mode ?? 'any',
      required_count: String(existingApprover?.required_count ?? 1),
    })
  }

  async function handleSaveTrigger(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      await upsertApprovalTemplateTrigger({
        id: triggerForm.id,
        template_id: Number(triggerForm.template_id),
        name: triggerForm.name.trim(),
        users: triggerForm.users,
      })
      setTriggerForm(emptyTriggerForm)
      toast.success('Approval trigger saved')
      await loadModule()
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Unable to save trigger'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveApprover(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      const requiredCount = Math.min(
        Math.max(Number(approverForm.required_count) || 1, 1),
        Math.max(approverForm.users.length, 1)
      )

      await upsertApprovalTemplateApprover({
        id: approverForm.id,
        template_id: Number(approverForm.template_id),
        name: approverForm.name.trim(),
        users: approverForm.users,
        approval_mode: approverForm.approval_mode,
        required_count: requiredCount,
      })
      setApproverForm(emptyApproverForm)
      toast.success('Approval approver setup saved')
      await loadModule()
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Unable to save approver setup'))
    } finally {
      setLoading(false)
    }
  }

  async function softVoid(
    action: () => Promise<void>,
    successMessage: string
  ) {
    setLoading(true)
    try {
      await action()
      toast.success(successMessage)
      await loadModule()
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Unable to void record'))
    } finally {
      setLoading(false)
    }
  }

  const approvalRequestColumns: Column<ApprovalRequestTableRow>[] = [
      {
        key: 'request_label',
        label: 'Request',
        render: (request) => (
          <div>
            <div className="font-medium">
              {request.request_type || request.document_type || 'approval'}
            </div>
            <div className="text-xs text-muted-foreground">#{request.id}</div>
          </div>
        ),
      },
      {
        key: 'document_label',
        label: 'Document',
        render: (request) => (
          <div>
            <div>{request.document_type || '-'}</div>
            <div className="text-xs text-muted-foreground">
              {request.document_no || request.document_id || '-'}
            </div>
          </div>
        ),
      },
      {
        key: 'requester_label',
        label: 'Requester',
      },
      {
        key: 'status',
        label: 'Status',
        render: (request) => (
          <Badge variant={statusVariant(request.status)}>
            {request.status}
          </Badge>
        ),
      },
      {
        key: 'created_at',
        label: 'Created',
        type: 'date',
      },
      {
        key: 'actions',
        label: 'Actions',
        type: 'button',
        align: 'right',
        sortable: false,
        searchable: false,
        render: (request) => (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              onClick={() => handleApprove(request)}
              disabled={loading || !canUpdate || request.status !== 'pending'}
            >
              <Check /> Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleReject(request)}
              disabled={loading || !canUpdate || request.status !== 'pending'}
            >
              <ThumbsDown /> Reject
            </Button>
          </div>
        ),
      },
    ]

  if (!canView) {
    return (
      <div className="p-4">
        <Breadcrumb
          FirstPreviewsPageName="Admin"
          CurrentPageName={mode === 'management' ? 'Approval Management' : 'Approval'}
        />
        <div className="mt-6 rounded-md border bg-white p-6 text-sm text-muted-foreground">
          You do not have permission to view this approval module.
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 overflow-x-hidden">
      <div className="mx-4 mt-8 flex items-center justify-between gap-3">
        <Breadcrumb
          FirstPreviewsPageName="Admin"
          CurrentPageName={mode === 'management' ? 'Approval Management' : 'Approval'}
        />
        <Button variant="outline" onClick={loadModule} disabled={loading}>
          <RefreshCcw /> Refresh
        </Button>
      </div>

      <Separator className="my-2" />

      <div className="mx-4 max-w-full overflow-hidden rounded-lg bg-white p-4">
      <Tabs defaultValue={mode === 'management' ? 'templates' : 'inbox'} className="w-full min-w-0">
        <TabsList className="bg-muted">
          {mode === 'inbox' && (
            <TabsTrigger value="inbox">
              <ShieldCheck className="h-4 w-4" /> Inbox
            </TabsTrigger>
          )}
          {mode === 'management' && (
            <>
              <TabsTrigger value="templates">
                <Workflow className="h-4 w-4" /> Templates
              </TabsTrigger>
              <TabsTrigger value="triggers">
                <Zap className="h-4 w-4" /> Triggers
              </TabsTrigger>
              <TabsTrigger value="approvers">
                <Users className="h-4 w-4" /> Approvers
              </TabsTrigger>
              <TabsTrigger value="flow">
                <Workflow className="h-4 w-4" /> Flow
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {mode === 'inbox' && (
        <TabsContent value="inbox" className="mt-4 min-w-0">
          <section className="min-w-0">
            <div className="mb-4 grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 xl:grid-cols-[1fr_360px_320px]">
              <div>
                <h2 className="text-base font-semibold text-stone-950">Approval Requests</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Pending requests, document approvals, and legacy admin approvals.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="approval-date-from">From</Label>
                  <Input
                    id="approval-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="approval-date-to">To</Label>
                  <Input
                    id="approval-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>
              <Textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Decision remarks"
                className="min-h-10"
              />
            </div>

            <DynamicTable
              title="Approval Requests"
              description="Review pending document approvals and legacy admin approvals."
              columns={approvalRequestColumns}
              data={approvalRequestRows}
              loading={loading}
              initialFilters={pendingApprovalFilters}
              rowKey="id"
              searchPlaceholder="Search approval requests..."
              emptyMessage="No approval requests found."
              noResultsMessage="No matching approval requests found."
            />
          </section>
        </TabsContent>
        )}

        {mode === 'management' && (
        <>
        <TabsContent value="templates" className="mt-4 min-w-0">
          <section className="grid min-w-0 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <form onSubmit={handleCreateTemplate} className="min-w-0 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="border-b border-stone-200 pb-3">
                <h1 className="text-base font-semibold text-stone-950">New Template</h1>
                <p className="mt-1 text-sm text-stone-500">
                  Templates define which approval flow applies to a document type.
                </p>
              </div>
              <div className="mt-4 grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="approval-template-name">Name</Label>
                  <Input
                    id="approval-template-name"
                    required
                    value={templateForm.name}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Receiving Approval"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select
                    value={templateForm.document_type}
                    onValueChange={(value) =>
                      setTemplateForm((current) => ({
                        ...current,
                        document_type: value,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvalDocumentTypes.map((documentType) => (
                        <SelectItem key={documentType.value} value={documentType.value}>
                          {documentType.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approval-template-priority">Priority</Label>
                  <Input
                    id="approval-template-priority"
                    type="number"
                    value={templateForm.priority}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approval-template-description">Description</Label>
                  <Textarea
                    id="approval-template-description"
                    value={templateForm.description}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={loading || !canEdit || !templateForm.document_type}>
                    <Plus className="h-4 w-4" /> Create Template
                  </Button>
                </div>
              </div>
            </form>

            <SetupTable
              title="Templates"
              headers={['Name', 'Document Type', 'Priority', 'Status', '']}
              empty="No approval templates found."
              rows={templates.map((template) => ({
                id: template.id,
                cells: [
                  template.name,
                  template.document_type,
                  String(template.priority),
                  template.is_active ? 'Active' : 'Inactive',
                ],
                onVoid: () =>
                  softVoid(
                    () => voidApprovalTemplate(template.id),
                    'Approval template voided'
                  ),
              }))}
              canUpdate={canUpdate}
            />
          </section>
        </TabsContent>

        <TabsContent value="triggers" className="mt-4 min-w-0">
          <section className="grid min-w-0 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <form onSubmit={handleSaveTrigger} className="min-w-0 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="border-b border-stone-200 pb-3">
                <h1 className="text-base font-semibold text-stone-950">Template Trigger</h1>
                <p className="mt-1 text-sm text-stone-500">
                  Choose which users can trigger approval for this template.
                </p>
              </div>
              <div className="mt-4 grid gap-4">
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select
                    required
                    value={triggerForm.template_id}
                    onValueChange={handleTriggerTemplateChange}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={String(template.id)}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approval-trigger-name">Name</Label>
                  <Input
                    id="approval-trigger-name"
                    required
                    value={triggerForm.name}
                    onChange={(event) =>
                      setTriggerForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Receiving Trigger"
                  />
                </div>
                <div className="rounded-md border border-stone-200 bg-white p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-900">Trigger Users</p>
                      <p className="text-xs text-stone-500">
                        {triggerForm.users.length} selected user{triggerForm.users.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setUserPickerOpen(true)}
                      disabled={!triggerForm.template_id}
                    >
                      <Users className="h-4 w-4" /> Select Users
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {triggerForm.users.slice(0, 8).map((user) => (
                      <span key={user.user_id} className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-700">
                        {user.fullname}
                      </span>
                    ))}
                    {triggerForm.users.length > 8 && (
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-700">
                        +{triggerForm.users.length - 8} more
                      </span>
                    )}
                    {triggerForm.users.length === 0 && (
                      <span className="text-sm text-muted-foreground">No trigger users selected.</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={
                      loading ||
                      !canEdit ||
                      templates.length === 0 ||
                      !triggerForm.template_id ||
                      !triggerForm.name ||
                      triggerForm.users.length === 0
                    }
                  >
                    <Plus className="h-4 w-4" /> Save Trigger
                  </Button>
                </div>
              </div>
            </form>

            <SetupTable
              title="Triggers"
              empty="No approval triggers found."
              description="Configured users who can trigger each approval template."
              rows={[]}
              canUpdate={canUpdate}
              customContent={
                <TriggerList
                  triggers={triggers}
                  templateById={templateById}
                  userGroupById={userGroupById}
                  canUpdate={canUpdate}
                  onEdit={(trigger) =>
                    setTriggerForm({
                      id: trigger.id,
                      template_id: String(trigger.template_id),
                      name: trigger.name,
                      users: trigger.users ?? [],
                    })
                  }
                  onVoid={(trigger) =>
                    softVoid(
                      () => voidApprovalTemplateTrigger(trigger.id),
                      'Approval trigger voided'
                    )
                  }
                  empty="No approval triggers found."
                />
              }
            />
          </section>
        </TabsContent>

        <TabsContent value="approvers" className="mt-4 min-w-0">
          <section className="grid min-w-0 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <form onSubmit={handleSaveApprover} className="min-w-0 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="border-b border-stone-200 pb-3">
                <h1 className="text-base font-semibold text-stone-950">Template Approvers</h1>
                <p className="mt-1 text-sm text-stone-500">
                  Choose who can approve this template and how many approvals are required.
                </p>
              </div>
              <div className="mt-4 grid gap-4">
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select
                    required
                    value={approverForm.template_id}
                    onValueChange={handleApproverTemplateChange}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={String(template.id)}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approval-approver-name">Name</Label>
                  <Input
                    id="approval-approver-name"
                    required
                    value={approverForm.name}
                    onChange={(event) =>
                      setApproverForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Receiving Approvers"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <div className="space-y-2">
                    <Label>Approval Rule</Label>
                    <Select
                      value={approverForm.approval_mode}
                      onValueChange={(value: 'any' | 'count') =>
                        setApproverForm((current) => ({ ...current, approval_mode: value }))
                      }
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any approver</SelectItem>
                        <SelectItem value="count">Count of approver</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {approverForm.approval_mode === 'count' && (
                    <div className="space-y-2">
                      <Label htmlFor="approval-required-count">Count</Label>
                      <Input
                        id="approval-required-count"
                        type="number"
                        min={1}
                        max={Math.max(approverForm.users.length, 1)}
                        value={approverForm.required_count}
                        onChange={(event) =>
                          setApproverForm((current) => ({
                            ...current,
                            required_count: event.target.value,
                          }))
                        }
                        className="bg-white"
                      />
                    </div>
                  )}
                </div>
                <div className="rounded-md border border-stone-200 bg-white p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-900">Approvers</p>
                      <p className="text-xs text-stone-500">
                        {approverForm.users.length} selected user{approverForm.users.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setApproverPickerOpen(true)}
                      disabled={!approverForm.template_id}
                    >
                      <Users className="h-4 w-4" /> Select Approvers
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {approverForm.users.slice(0, 8).map((user) => (
                      <span key={user.user_id} className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-700">
                        {user.fullname}
                      </span>
                    ))}
                    {approverForm.users.length > 8 && (
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-700">
                        +{approverForm.users.length - 8} more
                      </span>
                    )}
                    {approverForm.users.length === 0 && (
                      <span className="text-sm text-muted-foreground">No approvers selected.</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={
                      loading ||
                      !canEdit ||
                      templates.length === 0 ||
                      !approverForm.template_id ||
                      !approverForm.name ||
                      approverForm.users.length === 0 ||
                      (approverForm.approval_mode === 'count' &&
                        (Number(approverForm.required_count) < 1 ||
                          Number(approverForm.required_count) > approverForm.users.length))
                    }
                  >
                    <Plus className="h-4 w-4" /> Save Approvers
                  </Button>
                </div>
              </div>
            </form>

            <SetupTable
              title="Approvers"
              empty="No approval approvers found."
              description="Configured users who can approve each template."
              rows={[]}
              canUpdate={canUpdate}
              customContent={
                <ApproverList
                  approvers={approvers}
                  templateById={templateById}
                  userGroupById={userGroupById}
                  canUpdate={canUpdate}
                  onEdit={(approver) =>
                    setApproverForm({
                      id: approver.id,
                      template_id: String(approver.template_id),
                      name: approver.name,
                      users: approver.users ?? [],
                      approval_mode: approver.approval_mode,
                      required_count: String(approver.required_count ?? 1),
                    })
                  }
                  onVoid={(approver) =>
                    softVoid(
                      () => voidApprovalTemplateApprover(approver.id),
                      'Approval approver setup voided'
                    )
                  }
                  empty="No approval approvers found."
                />
              }
            />
          </section>
        </TabsContent>

        <TabsContent value="flow" className="mt-4 min-w-0">
          <ApprovalSetupFlow />
        </TabsContent>
        </>
        )}
      </Tabs>
      </div>
      <TriggerUserPickerDialog
        open={userPickerOpen}
        onOpenChange={setUserPickerOpen}
        users={users}
        userGroups={userGroups}
        selectedUsers={triggerForm.users}
        onSelectedUsersChange={(selectedUsers) =>
          setTriggerForm((current) => ({ ...current, users: selectedUsers }))
        }
      />
      <TriggerUserPickerDialog
        open={approverPickerOpen}
        onOpenChange={setApproverPickerOpen}
        title="Select Approvers"
        description="Choose the users who can approve this template."
        users={users}
        userGroups={userGroups}
        selectedUsers={approverForm.users}
        onSelectedUsersChange={(selectedUsers) =>
          setApproverForm((current) => ({ ...current, users: selectedUsers }))
        }
      />
    </div>
  )
}

function SetupTable({
  title,
  rows,
  empty,
  canUpdate,
  description = 'Configured approval records',
  headers = [],
  customContent,
}: {
  title: string
  headers?: string[]
  empty: string
  canUpdate: boolean
  description?: string
  customContent?: ReactNode
  rows: {
    id: number
    cells: string[]
    onVoid: () => void
  }[]
}) {
  return (
    <section className="min-w-0 rounded-lg border border-stone-200 bg-white p-4">
      <div className="mb-4 border-b border-stone-200 pb-3">
        <h2 className="text-base font-semibold text-stone-950">{title}</h2>
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </div>
      {customContent ? customContent : (
      <div className="overflow-x-auto rounded-md border border-stone-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-stone-50 text-left">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-medium text-stone-700">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-stone-200 hover:bg-stone-50/70">
                {row.cells.map((cell, index) => (
                  <td key={`${row.id}-${index}`} className="px-3 py-2 text-stone-700">
                    {index === row.cells.length - 1 && (cell === 'Active' || cell === 'Inactive')
                      ? <StatusBadge active={cell === 'Active'} label={cell} />
                      : cell || '-'}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={row.onVoid}
                    disabled={!canUpdate}
                    title="Void record"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Void</span>
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="px-3 py-8 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </section>
  )
}

function TriggerList({
  triggers,
  templateById,
  userGroupById,
  canUpdate,
  onEdit,
  onVoid,
  empty,
}: {
  triggers: ApprovalTemplateTriggerRow[]
  templateById: Map<number, ApprovalTemplateRow>
  userGroupById: Map<string, UsersGroup>
  canUpdate: boolean
  onEdit: (trigger: ApprovalTemplateTriggerRow) => void
  onVoid: (trigger: ApprovalTemplateTriggerRow) => void
  empty: string
}) {
  const sortedTriggers = [...triggers].sort((first, second) => {
    const firstTemplate = templateById.get(first.template_id)?.name || ''
    const secondTemplate = templateById.get(second.template_id)?.name || ''
    return firstTemplate.localeCompare(secondTemplate) || first.id - second.id
  })

  if (sortedTriggers.length === 0) {
    return (
      <div className="rounded-md border border-stone-200 px-3 py-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {sortedTriggers.map((trigger) => {
        const templateName = templateById.get(trigger.template_id)?.name || String(trigger.template_id)

        return (
          <div key={trigger.id} className="rounded-md border border-stone-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-stone-200 bg-stone-50 p-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Zap className="h-4 w-4 text-stone-500" />
                  <h3 className="text-sm font-semibold text-stone-950">{trigger.name}</h3>
                  <StatusBadge active={trigger.is_active} label={trigger.is_active ? 'Active' : 'Inactive'} />
                </div>
                <p className="mt-1 text-xs text-stone-500">{templateName}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="rounded-full border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700">
                  {trigger.users?.length ?? 0} trigger user{trigger.users?.length === 1 ? '' : 's'}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(trigger)}
                  disabled={!canUpdate}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onVoid(trigger)}
                  disabled={!canUpdate}
                  title="Void trigger"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Void trigger</span>
                </Button>
              </div>
            </div>
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase text-stone-500">Users who can trigger this template</p>
              </div>
              {trigger.users?.length > 0 ? (
                <div className="grid gap-2">
                  {trigger.users.map((user) => {
                    const group = user.users_group_id
                      ? userGroupById.get(String(user.users_group_id))?.group_name
                      : ''

                    return (
                    <div
                      key={user.user_id}
                      className="flex flex-col gap-2 rounded-md border border-stone-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-800">
                          {user.fullname}
                        </p>
                        <p className="text-xs text-stone-500">
                          {user.email || '-'}{group ? ` | ${group}` : ''}
                        </p>
                      </div>
                      <StatusBadge
                        active={String(user.isactive ?? '').trim() === '1'}
                        label={String(user.isactive ?? '').trim() === '1' ? 'Active' : 'Inactive'}
                      />
                    </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-stone-300 px-3 py-4 text-sm text-muted-foreground">
                  No trigger users selected.
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ApproverList({
  approvers,
  templateById,
  userGroupById,
  canUpdate,
  onEdit,
  onVoid,
  empty,
}: {
  approvers: ApprovalTemplateApproverRow[]
  templateById: Map<number, ApprovalTemplateRow>
  userGroupById: Map<string, UsersGroup>
  canUpdate: boolean
  onEdit: (approver: ApprovalTemplateApproverRow) => void
  onVoid: (approver: ApprovalTemplateApproverRow) => void
  empty: string
}) {
  const sortedApprovers = [...approvers].sort((first, second) => {
    const firstTemplate = templateById.get(first.template_id)?.name || ''
    const secondTemplate = templateById.get(second.template_id)?.name || ''
    return firstTemplate.localeCompare(secondTemplate) || first.id - second.id
  })

  if (sortedApprovers.length === 0) {
    return (
      <div className="rounded-md border border-stone-200 px-3 py-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {sortedApprovers.map((approver) => {
        const templateName = templateById.get(approver.template_id)?.name || String(approver.template_id)
        const ruleLabel =
          approver.approval_mode === 'count'
            ? `${approver.required_count} approval${approver.required_count === 1 ? '' : 's'} required`
            : 'Any approver'

        return (
          <div key={approver.id} className="rounded-md border border-stone-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-stone-200 bg-stone-50 p-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Users className="h-4 w-4 text-stone-500" />
                  <h3 className="text-sm font-semibold text-stone-950">{approver.name}</h3>
                  <StatusBadge active={approver.is_active} label={approver.is_active ? 'Active' : 'Inactive'} />
                </div>
                <p className="mt-1 text-xs text-stone-500">{templateName}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="rounded-full border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700">
                  {ruleLabel}
                </span>
                <span className="rounded-full border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700">
                  {approver.users?.length ?? 0} approver{approver.users?.length === 1 ? '' : 's'}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(approver)}
                  disabled={!canUpdate}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onVoid(approver)}
                  disabled={!canUpdate}
                  title="Void approver setup"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Void approver setup</span>
                </Button>
              </div>
            </div>
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase text-stone-500">Users who can approve this template</p>
              </div>
              {approver.users?.length > 0 ? (
                <div className="grid gap-2">
                  {approver.users.map((user) => {
                    const group = user.users_group_id
                      ? userGroupById.get(String(user.users_group_id))?.group_name
                      : ''

                    return (
                      <div
                        key={user.user_id}
                        className="flex flex-col gap-2 rounded-md border border-stone-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-800">
                            {user.fullname}
                          </p>
                          <p className="text-xs text-stone-500">
                            {user.email || '-'}{group ? ` | ${group}` : ''}
                          </p>
                        </div>
                        <StatusBadge
                          active={String(user.isactive ?? '').trim() === '1'}
                          label={String(user.isactive ?? '').trim() === '1' ? 'Active' : 'Inactive'}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-stone-300 px-3 py-4 text-sm text-muted-foreground">
                  No approvers selected.
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ApprovalSetupFlow() {
  const steps = [
    {
      number: '1',
      title: 'Template',
      text: 'Connects one document type to an approval setup. This is the header the trigger belongs to.',
      examples: ['Receiving Approval for receiving documents', 'Farm Setup Wizard Approval for farm setup requests'],
    },
    {
      number: '2',
      title: 'Trigger',
      text: 'Defines which users can activate approval for the selected template when they create a document.',
      examples: ['Deanmark can trigger Receiving Approval', 'Warehouse users can trigger inventory approval'],
    },
    {
      number: '3',
      title: 'Approvers',
      text: 'Defines who can approve and whether one approval is enough or a required count must be reached.',
      examples: ['Any approver can approve', 'Two of five approvers are required'],
    },
    {
      number: '4',
      title: 'Approval',
      text: 'If the requester is in the trigger list, the system creates an approval request. If not, it skips approval.',
      examples: ['Included user creates a pending request', 'Excluded user saves the document without approval'],
    },
  ]
  const scenarios = [
    {
      title: 'Receiving has an approval flow',
      submit: 'A user creates and saves a receiving document.',
      check: 'The system checks Approval Management for an active Receiving template, then checks if the requester is listed in that template trigger.',
      result: 'If the requester is included, the receiving is submitted for approval and appears in the approval inbox. This happens because the trigger list says that user must pass through approval.',
    },
    {
      title: 'Receiving user is not in trigger',
      submit: 'A user creates a receiving document, but that user is not selected in the Receiving trigger.',
      check: 'The system still finds the Receiving template, but the requester does not match any user in the trigger JSON.',
      result: 'The system skips approval and continues saving normally. This happens because the template exists, but this specific user is not required to trigger it.',
    },
    {
      title: 'Document has no approval flow',
      submit: 'A user creates a document for a module that has no active approval template.',
      check: 'The system checks Approval Management and does not find an active template for that document type.',
      result: 'The document continues without creating an approval request. This happens because the module has no configured approval template or trigger.',
    },
  ]

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent>
        <div className="grid gap-4 xl:grid-cols-4">
          {steps.map((step) => (
            <div key={step.title} className="min-w-0 space-y-2">
              <div className="flex items-center gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold text-muted-foreground">
                  {step.number}
                </span>
                <Label className="text-sm font-medium">{step.title}</Label>
              </div>
              <p className="pl-8 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </p>
              <div className="pl-8">
                <p className="text-xs font-medium uppercase text-stone-500">Examples</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {step.examples.map((example) => (
                    <li key={example} className="leading-relaxed">
                      {example}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 border-t border-stone-200 pt-6">
          <Label className="text-sm font-medium">Scenarios</Label>
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            {scenarios.map((scenario, index) => (
              <div key={scenario.title} className="rounded-md border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border bg-white text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium text-stone-900">{scenario.title}</p>
                </div>
                <div className="mt-3 space-y-3 pl-8 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    <span className="font-medium text-stone-700">Submit: </span>
                    {scenario.submit}
                  </p>
                  <p>
                    <span className="font-medium text-stone-700">System Check: </span>
                    {scenario.check}
                  </p>
                  <p>
                    <span className="font-medium text-stone-700">Result: </span>
                    {scenario.result}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        active
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-stone-100 text-stone-600'
      }`}
    >
      {label}
    </span>
  )
}
