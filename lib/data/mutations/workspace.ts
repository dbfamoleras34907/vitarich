import { format } from "date-fns"
import { db } from "@/lib/Supabase/supabaseClient"
import type { WorkspaceTaskStatus } from "@/lib/data/repositories/workspace"

export type SaveWorkspaceProjectPayload = {
  id?: number | null
  project_name: string
  description?: string
  start_date: Date
  end_date: Date
  project_manager?: number | null
  project_type: string
  project_members?: number[]
}

export type SaveWorkspaceTaskPayload = {
  id?: number | null
  project_id: number
  subject: string
  issue?: string
  priority: "low" | "mid" | "high"
  task_type: number
  parent_task?: number | null
  color?: string | null
  assigned_to: number | null
}

export type SaveWorkspaceTimesheetPayload = {
  header: {
    id: number | null
    doc_date: string
    assigned_to: number | null
    status?: "Draft" | "Submitted"
  }
  lines: Array<{
    id: number | null
    line_num: number
    activity_type: number | string | null
    from_time: string
    hrs: string
    project_id: number | string | null
    task_id: number | string | null
    remarks: string
  }>
}

export async function saveWorkspaceProject(payload: SaveWorkspaceProjectPayload) {
  const { data, error } = await db.rpc("rpc_upsert_project", {
    p_id: payload.id ?? null,
    p_project_name: payload.project_name,
    p_description: payload.description ?? null,
    p_start_date: format(payload.start_date, "yyyy-MM-dd"),
    p_end_date: format(payload.end_date, "yyyy-MM-dd"),
    p_project_manager: payload.project_manager ?? null,
    p_project_type: payload.project_type,
    p_members: payload.project_members ?? [],
  })

  if (error) throw error
  return Number(data)
}

export async function saveWorkspaceTask(payload: SaveWorkspaceTaskPayload) {
  const { data, error } = await db.rpc("rpc_upsert_task", {
    p_id: payload.id ?? null,
    p_project_id: payload.project_id,
    p_subject: payload.subject,
    p_issue: payload.issue ?? null,
    p_priority: payload.priority,
    p_task_type: payload.task_type,
    p_parent_task: payload.parent_task ?? null,
    p_color: payload.color ?? null,
    p_assigned_to: payload.assigned_to,
  })

  if (error) throw error
  return Number(data)
}

export async function saveWorkspaceTimesheet(payload: SaveWorkspaceTimesheetPayload) {
  const { data, error } = await db.rpc("rpc_upsert_timesheet_full", { payload })
  if (error) throw error
  return Number(data)
}

export async function moveWorkspaceTask(taskId: number, statusId: number) {
  const { error } = await db
    .from("tasks")
    .update({ status_id: statusId })
    .eq("id", taskId)

  if (error) throw error
}

export async function saveWorkspaceTaskStatus(payload: {
  id?: number
  code: string
  name: string
  color: string
  sort_order: number
  is_final: boolean
}) {
  const values = {
    code: payload.code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
    name: payload.name.trim(),
    color: payload.color,
    sort_order: payload.sort_order,
    is_final: payload.is_final,
    void: 1,
    updated_at: new Date().toISOString(),
  }

  const query = payload.id
    ? db.from("workspace_task_statuses").update(values).eq("id", payload.id)
    : db.from("workspace_task_statuses").insert(values)

  const { data, error } = await query
    .select("id, code, name, color, sort_order, is_final, void, created_at, updated_at")
    .single()

  if (error) throw error
  return data as WorkspaceTaskStatus
}

export async function saveWorkspaceTimesheetSettings(payload: {
  default_activity_type_id: number | null
  default_priority: "low" | "mid" | "high"
  default_task_type_id: number | null
  supervisor_user_id: number | null
}) {
  const values = {
    id: 1,
    default_activity_type_id: payload.default_activity_type_id,
    default_priority: payload.default_priority,
    default_task_type_id: payload.default_task_type_id,
    supervisor_user_id: payload.supervisor_user_id,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await db
    .from("workspace_timesheet_settings")
    .upsert(values, { onConflict: "id" })
    .select("id, default_activity_type_id, default_priority, default_task_type_id, supervisor_user_id, supervisor_email, created_at, updated_at")
    .single()

  if (error) throw error
  return data
}
