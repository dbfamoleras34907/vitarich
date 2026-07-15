'use client'

import Breadcrumb from '@/lib/Breadcrumb'
import { Button } from '@/components/ui/button'
import DynamicTable, { type Column } from '@/components/ui/DataTableV2'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { usePermission } from '@/hooks/usePermission'
import { getAuthId } from '@/lib/getAuthId'
import { getProfileByAuthId } from '../user/api'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import {
  Check,
  Layers3,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ThumbsDown,
  Trash2,
  UserCheck,
  Workflow,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ApprovalRequestRow,
  ApprovalStageApproverRow,
  ApprovalStageRow,
  ApprovalTemplateRow,
  approveDocumentApproval,
  approveLegacyApprovalRequest,
  createApprovalStage,
  createApprovalStageApprover,
  createApprovalTemplate,
  getApprovalRequests,
  getApprovalStageApprovers,
  getApprovalStages,
  getApprovalTemplates,
  getApprovalUsers,
  rejectApproval,
  rejectDocumentApproval,
  voidApprovalStage,
  voidApprovalStageApprover,
  voidApprovalTemplate,
} from './api'
import { UserRow } from '@/lib/types'

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

type StageForm = {
  template_id: string
  stage_no: string
  name: string
  approval_mode: 'any' | 'all'
}

type ApproverForm = {
  stage_id: string
  approver_type: 'supervisor' | 'user'
  user_id: string
}

const emptyTemplateForm: TemplateForm = {
  name: '',
  document_type: '',
  description: '',
  priority: '100',
}

const emptyStageForm: StageForm = {
  template_id: '',
  stage_no: '1',
  name: '',
  approval_mode: 'any',
}

const emptyApproverForm: ApproverForm = {
  stage_id: '',
  approver_type: 'supervisor',
  user_id: '',
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function statusVariant(status?: string) {
  if (status === 'approved') return 'default'
  if (status === 'rejected' || status === 'cancelled') return 'destructive'
  return 'secondary'
}

function userName(user?: UserRow) {
  if (!user) return '-'
  const name = [user.firstname, user.middlename, user.lastname]
    .filter(Boolean)
    .join(' ')
    .trim()
  return name || user.email || `User ${user.id}`
}

export default function Layout({ mode = 'inbox' }: { mode?: ApprovalLayoutMode }) {
  const [requests, setRequests] = useState<ApprovalRequestRow[]>([])
  const [templates, setTemplates] = useState<ApprovalTemplateRow[]>([])
  const [stages, setStages] = useState<ApprovalStageRow[]>([])
  const [approvers, setApprovers] = useState<ApprovalStageApproverRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [templateForm, setTemplateForm] = useState<TemplateForm>(emptyTemplateForm)
  const [stageForm, setStageForm] = useState<StageForm>(emptyStageForm)
  const [approverForm, setApproverForm] = useState<ApproverForm>(emptyApproverForm)
  const { setValue } = useGlobalContext()
  const permissionBase = mode === 'management' ? '/admin/approval/management' : '/admin/approval'
  const canView = !usePermission(`${permissionBase}/view`)
  const canEdit = !usePermission(`${permissionBase}/edit`)
  const canUpdate = canEdit

  const templateById = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates]
  )

  const stageById = useMemo(
    () => new Map(stages.map((stage) => [stage.id, stage])),
    [stages]
  )

  const userById = useMemo(
    () => new Map(users.map((user) => [Number(user.id), user])),
    [users]
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

  async function loadModule() {
    setLoading(true)
    try {
      const [requestRows, templateRows, stageRows, approverRows, userRows] =
        await Promise.all([
          getApprovalRequests(),
          getApprovalTemplates(),
          getApprovalStages(),
          getApprovalStageApprovers(),
          getApprovalUsers(),
        ])

      setRequests(requestRows)
      setTemplates(templateRows)
      setStages(stageRows)
      setApprovers(approverRows)
      setUsers(userRows)
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Unable to load approval module'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadModule()
  }, [])

  useEffect(() => {
    setValue('loading_g', loading)
  }, [loading, setValue])

  async function handleApprove(request: ApprovalRequestRow) {
    setLoading(true)
    try {
      if (request.request_type === 'password_reset') {
        const authId = await getAuthId()
        if (!authId) throw new Error('Session error')

        const user = await getProfileByAuthId(authId)
        if (!user?.id) throw new Error('User profile not found')

        await approveLegacyApprovalRequest(request.id, user.id)
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

  async function handleCreateStage(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      await createApprovalStage({
        template_id: Number(stageForm.template_id),
        stage_no: Number(stageForm.stage_no),
        name: stageForm.name.trim(),
        approval_mode: stageForm.approval_mode,
      })
      setStageForm(emptyStageForm)
      toast.success('Approval stage created')
      await loadModule()
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Unable to create stage'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateApprover(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      const selectedUser = userById.get(Number(approverForm.user_id))
      await createApprovalStageApprover({
        stage_id: Number(approverForm.stage_id),
        approver_type: approverForm.approver_type,
        approver_user_id:
          approverForm.approver_type === 'user' ? Number(approverForm.user_id) : null,
        approver_auth_id:
          approverForm.approver_type === 'user' ? selectedUser?.auth_id || null : null,
      })
      setApproverForm(emptyApproverForm)
      toast.success('Approver assigned')
      await loadModule()
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Unable to assign approver'))
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
    <div className="px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          FirstPreviewsPageName="Admin"
          CurrentPageName={mode === 'management' ? 'Approval Management' : 'Approval'}
        />
        <Button variant="outline" onClick={loadModule} disabled={loading}>
          <RefreshCcw /> Refresh
        </Button>
      </div>

      <Tabs defaultValue={mode === 'management' ? 'templates' : 'inbox'} className="mt-6">
        <TabsList>
          {mode === 'inbox' && (
            <TabsTrigger value="inbox">
              <ShieldCheck /> Inbox
            </TabsTrigger>
          )}
          {mode === 'management' && (
            <>
              <TabsTrigger value="templates">
                <Workflow /> Templates
              </TabsTrigger>
              <TabsTrigger value="stages">
                <Layers3 /> Stages
              </TabsTrigger>
              <TabsTrigger value="approvers">
                <UserCheck /> Approvers
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {mode === 'inbox' && (
        <TabsContent value="inbox" className="mt-4">
          <section className="rounded-md border bg-white p-4">
            <div className="mb-4 grid gap-2 md:grid-cols-[1fr_320px]">
              <div>
                <h2 className="text-lg font-semibold">Approval Requests</h2>
                <p className="text-sm text-muted-foreground">
                  Pending requests, document approvals, and legacy admin approvals.
                </p>
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
        <TabsContent value="templates" className="mt-4">
          <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <form onSubmit={handleCreateTemplate} className="rounded-md border bg-white p-4">
              <h2 className="mb-4 text-lg font-semibold">New Template</h2>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    required
                    value={templateForm.name}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Receiving Approval"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Document Type</Label>
                  <Input
                    required
                    value={templateForm.document_type}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        document_type: event.target.value,
                      }))
                    }
                    placeholder="receiving"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Input
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
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea
                    value={templateForm.description}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>
                <Button type="submit" disabled={loading || !canEdit}>
                  <Plus /> Create Template
                </Button>
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

        <TabsContent value="stages" className="mt-4">
          <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <form onSubmit={handleCreateStage} className="rounded-md border bg-white p-4">
              <h2 className="mb-4 text-lg font-semibold">New Stage</h2>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Template</Label>
                  <Select
                    required
                    value={stageForm.template_id}
                    onValueChange={(value) =>
                      setStageForm((current) => ({ ...current, template_id: value }))
                    }
                  >
                    <SelectTrigger className="w-full">
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
                <div className="grid gap-2">
                  <Label>Stage No.</Label>
                  <Input
                    required
                    type="number"
                    value={stageForm.stage_no}
                    onChange={(event) =>
                      setStageForm((current) => ({ ...current, stage_no: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    required
                    value={stageForm.name}
                    onChange={(event) =>
                      setStageForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Supervisor Approval"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Approval Mode</Label>
                  <Select
                    value={stageForm.approval_mode}
                    onValueChange={(value: 'any' | 'all') =>
                      setStageForm((current) => ({ ...current, approval_mode: value }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any approver</SelectItem>
                      <SelectItem value="all">All approvers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={loading || !canEdit || templates.length === 0}>
                  <Plus /> Create Stage
                </Button>
              </div>
            </form>

            <SetupTable
              title="Stages"
              headers={['Template', 'Stage', 'Mode', 'Status', '']}
              empty="No approval stages found."
              rows={stages.map((stage) => ({
                id: stage.id,
                cells: [
                  templateById.get(stage.template_id)?.name || String(stage.template_id),
                  `${stage.stage_no} - ${stage.name}`,
                  stage.approval_mode,
                  stage.is_active ? 'Active' : 'Inactive',
                ],
                onVoid: () =>
                  softVoid(() => voidApprovalStage(stage.id), 'Approval stage voided'),
              }))}
              canUpdate={canUpdate}
            />
          </section>
        </TabsContent>

        <TabsContent value="approvers" className="mt-4">
          <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <form onSubmit={handleCreateApprover} className="rounded-md border bg-white p-4">
              <h2 className="mb-4 text-lg font-semibold">Assign Approver</h2>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Stage</Label>
                  <Select
                    required
                    value={approverForm.stage_id}
                    onValueChange={(value) =>
                      setApproverForm((current) => ({ ...current, stage_id: value }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={String(stage.id)}>
                          {templateById.get(stage.template_id)?.name || stage.template_id} - {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Approver Type</Label>
                  <Select
                    value={approverForm.approver_type}
                    onValueChange={(value: 'supervisor' | 'user') =>
                      setApproverForm((current) => ({
                        ...current,
                        approver_type: value,
                        user_id: value === 'supervisor' ? '' : current.user_id,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supervisor">Requester supervisor</SelectItem>
                      <SelectItem value="user">Specific user</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {approverForm.approver_type === 'user' && (
                  <div className="grid gap-2">
                    <Label>User</Label>
                    <Select
                      required
                      value={approverForm.user_id}
                      onValueChange={(value) =>
                        setApproverForm((current) => ({ ...current, user_id: value }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={String(user.id)}>
                            {userName(user)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit" disabled={loading || !canEdit || stages.length === 0}>
                  <Plus /> Assign Approver
                </Button>
              </div>
            </form>

            <SetupTable
              title="Approvers"
              headers={['Stage', 'Type', 'Approver', 'Status', '']}
              empty="No approval approvers found."
              rows={approvers.map((approver) => ({
                id: approver.id,
                cells: [
                  stageById.get(approver.stage_id)?.name || String(approver.stage_id),
                  approver.approver_type,
                  approver.approver_type === 'supervisor'
                    ? 'Requester supervisor'
                    : userName(userById.get(Number(approver.approver_user_id))),
                  approver.is_active ? 'Active' : 'Inactive',
                ],
                onVoid: () =>
                  softVoid(
                    () => voidApprovalStageApprover(approver.id),
                    'Approver assignment voided'
                  ),
              }))}
              canUpdate={canUpdate}
            />
          </section>
        </TabsContent>
        </>
        )}
      </Tabs>
    </div>
  )
}

function SetupTable({
  title,
  headers,
  rows,
  empty,
  canUpdate,
}: {
  title: string
  headers: string[]
  empty: string
  canUpdate: boolean
  rows: {
    id: number
    cells: string[]
    onVoid: () => void
  }[]
}) {
  return (
    <section className="rounded-md border bg-white p-4">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                {row.cells.map((cell, index) => (
                  <td key={`${row.id}-${index}`} className="px-3 py-2">
                    {cell || '-'}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={row.onVoid} disabled={!canUpdate}>
                    <Trash2 /> Void
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
    </section>
  )
}
