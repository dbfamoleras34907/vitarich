import { db } from "@/lib/Supabase/supabaseClient"
import { UserRow } from "@/lib/types"

export type ApprovalRequestRow = {
  id: number
  created_at: string
  template_id: number | null
  current_stage_id: number | null
  document_type: string | null
  document_id: number | null
  document_no: string | null
  requested_by_user_id: number | null
  requested_by_auth_id: string | null
  user_email: string | null
  request_type: string | null
  status: string
  remarks: string | null
  approved_by: number | null
  approved_at: string | null
  rejected_by: number | null
  rejected_at: string | null
  void: string
}

export type ApprovalTemplateRow = {
  id: number
  name: string
  document_type: string
  description: string | null
  is_active: boolean
  priority: number
  rule_json: Record<string, unknown>
  void: string
}

export type ApprovalStageRow = {
  id: number
  template_id: number
  stage_no: number
  name: string
  approval_mode: "any" | "all"
  is_active: boolean
  void: string
}

export type ApprovalStageApproverRow = {
  id: number
  stage_id: number
  approver_user_id: number | null
  approver_auth_id: string | null
  approver_type: "user" | "supervisor" | "role"
  is_active: boolean
  void: string
}

export type ApprovalTriggerUser = {
  user_id: number
  auth_id: string | null
  fullname: string
  email: string | null
  users_group_id: string | number | null
  isactive: string | null
  issuper: string | null
}

export type ApprovalTemplateTriggerRow = {
  id: number
  template_id: number
  name: string
  users: ApprovalTriggerUser[]
  is_active: boolean
  void: string
}

export type ApprovalTemplateApproverRow = {
  id: number
  template_id: number
  name: string
  users: ApprovalTriggerUser[]
  approval_mode: "any" | "count"
  required_count: number
  is_active: boolean
  void: string
}

export async function getApprovalRequests(params?: {
  dateFrom?: string
  dateTo?: string
}) {
  let query = db
    .from("approval_requests")
    .select("*")
    .eq("void", "1")

  if (params?.dateFrom) {
    query = query.gte("created_at", `${params.dateFrom}T00:00:00`)
  }

  if (params?.dateTo) {
    query = query.lte("created_at", `${params.dateTo}T23:59:59.999`)
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })

  if (error) throw error
  return ((data ?? []) as ApprovalRequestRow[]).filter(
    (request) => request.request_type !== "user_activation"
  )
}

export async function getApprovalTemplates() {
  const { data, error } = await db
    .from("approval_templates")
    .select("*")
    .eq("void", "1")
    .order("priority", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw error
  return (data ?? []) as ApprovalTemplateRow[]
}

export async function getApprovalStages() {
  const { data, error } = await db
    .from("approval_stages")
    .select("*")
    .eq("void", "1")
    .order("template_id", { ascending: true })
    .order("stage_no", { ascending: true })

  if (error) throw error
  return (data ?? []) as ApprovalStageRow[]
}

export async function getApprovalStageApprovers() {
  const { data, error } = await db
    .from("approval_stage_approvers")
    .select("*")
    .eq("void", "1")
    .order("stage_id", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw error
  return (data ?? []) as ApprovalStageApproverRow[]
}

export async function getApprovalTemplateTriggers() {
  const { data, error } = await db
    .from("approval_template_triggers")
    .select("*")
    .eq("void", "1")
    .order("template_id", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw error
  return (data ?? []) as ApprovalTemplateTriggerRow[]
}

export async function getApprovalTemplateApprovers() {
  const { data, error } = await db
    .from("approval_template_approvers")
    .select("*")
    .eq("void", "1")
    .order("template_id", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw error
  return (data ?? []) as ApprovalTemplateApproverRow[]
}

export async function getApprovalUsers() {
  const { data, error } = await db
    .from("users")
    .select("id, email, firstname, middlename, lastname, auth_id, issuper, supervisor, isactive, users_group_id")
    .order("email", { ascending: true })

  if (error) throw error
  return (data ?? []) as UserRow[]
}

export async function upsertApprovalTemplateTrigger(payload: {
  id?: number | null
  template_id: number
  name: string
  users: ApprovalTriggerUser[]
}) {
  const { data: sessionData } = await db.auth.getSession()
  const row = {
    updated_by: sessionData.session?.user.id ?? null,
    template_id: payload.template_id,
    name: payload.name,
    users: payload.users,
    is_active: true,
    void: "1",
  }

  const query = payload.id
    ? db
        .from("approval_template_triggers")
        .update(row)
        .eq("id", payload.id)
    : db.from("approval_template_triggers").insert({
        ...row,
        created_by: sessionData.session?.user.id ?? null,
      })

  const { error } = await query

  if (error) throw error
}

export async function upsertApprovalTemplateApprover(payload: {
  id?: number | null
  template_id: number
  name: string
  users: ApprovalTriggerUser[]
  approval_mode: "any" | "count"
  required_count: number
}) {
  const { data: sessionData } = await db.auth.getSession()
  const row = {
    updated_by: sessionData.session?.user.id ?? null,
    template_id: payload.template_id,
    name: payload.name,
    users: payload.users,
    approval_mode: payload.approval_mode,
    required_count: payload.approval_mode === "count" ? payload.required_count : 1,
    is_active: true,
    void: "1",
  }

  const query = payload.id
    ? db
        .from("approval_template_approvers")
        .update(row)
        .eq("id", payload.id)
    : db.from("approval_template_approvers").insert({
        ...row,
        created_by: sessionData.session?.user.id ?? null,
      })

  const { error } = await query

  if (error) throw error
}

export async function createApprovalTemplate(payload: {
  name: string
  document_type: string
  description?: string
  priority: number
}) {
  const { data: sessionData } = await db.auth.getSession()
  const { error } = await db.from("approval_templates").insert({
    created_by: sessionData.session?.user.id ?? null,
    name: payload.name,
    document_type: payload.document_type,
    description: payload.description || null,
    priority: payload.priority,
    rule_json: { enabled: true },
    is_active: true,
    void: "1",
  })

  if (error) throw error
}

export async function createApprovalStage(payload: {
  template_id: number
  stage_no: number
  name: string
  approval_mode: "any" | "all"
}) {
  const { data: sessionData } = await db.auth.getSession()
  const { error } = await db.from("approval_stages").insert({
    created_by: sessionData.session?.user.id ?? null,
    template_id: payload.template_id,
    stage_no: payload.stage_no,
    name: payload.name,
    approval_mode: payload.approval_mode,
    is_active: true,
    void: "1",
  })

  if (error) throw error
}

export async function createApprovalStageApprover(payload: {
  stage_id: number
  approver_type: "user" | "supervisor"
  approver_user_id?: number | null
  approver_auth_id?: string | null
}) {
  const { data: sessionData } = await db.auth.getSession()
  const { error } = await db.from("approval_stage_approvers").insert({
    created_by: sessionData.session?.user.id ?? null,
    stage_id: payload.stage_id,
    approver_type: payload.approver_type,
    approver_user_id: payload.approver_type === "user" ? payload.approver_user_id : null,
    approver_auth_id: payload.approver_type === "user" ? payload.approver_auth_id : null,
    is_active: true,
    void: "1",
  })

  if (error) throw error
}

export async function voidApprovalTemplate(id: number) {
  const { error } = await db.from("approval_templates").update({ void: "0" }).eq("id", id)
  if (error) throw error
}

export async function voidApprovalStage(id: number) {
  const { error } = await db.from("approval_stages").update({ void: "0" }).eq("id", id)
  if (error) throw error
}

export async function voidApprovalStageApprover(id: number) {
  const { error } = await db.from("approval_stage_approvers").update({ void: "0" }).eq("id", id)
  if (error) throw error
}

export async function voidApprovalTemplateTrigger(id: number) {
  const { error } = await db.from("approval_template_triggers").update({ void: "0" }).eq("id", id)
  if (error) throw error
}

export async function voidApprovalTemplateApprover(id: number) {
  const { error } = await db.from("approval_template_approvers").update({ void: "0" }).eq("id", id)
  if (error) throw error
}

export async function approveDocumentApproval(requestId: number, remarks?: string) {
  const { data, error } = await db.rpc("approve_approval_request", {
    p_request_id: requestId,
    p_remarks: remarks || null,
  })

  if (error) throw error
  return data
}

export async function rejectDocumentApproval(requestId: number, remarks?: string) {
  const { data, error } = await db.rpc("reject_approval_request", {
    p_request_id: requestId,
    p_remarks: remarks || null,
  })

  if (error) throw error
  return data
}

export async function approveLegacyApprovalRequest(requestId: number, approvedBy: number) {
  const response = await fetch("/api/approval/approve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId,
      approvedBy,
    }),
  })

  if (!response.ok) {
    throw new Error("Unable to approve legacy approval request.")
  }
}

export async function rejectApproval(requestId: number, approvedBy: number) {
  const { error } = await db
    .from("approval_requests")
    .update({
      status: "rejected",
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq("id", requestId)

  if (error) throw error
}
