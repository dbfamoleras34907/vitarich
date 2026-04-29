import { db } from "@/lib/Supabase/supabaseClient"

export interface SavetaskPayload {
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

export const savetask = async (
  payload: SavetaskPayload
) => {
  console.log('Saving task with payload:', payload)
  const { data, error } = await db.rpc("rpc_upsert_task", {
    p_id: payload.id ?? null,
    p_project_id: payload.project_id,
    p_subject: payload.subject,
    p_issue: payload.issue ?? null,
    p_priority: payload.priority,
    p_task_type: payload.task_type,
    p_parent_task: payload.parent_task ?? null,
    p_color: payload.color ?? null,
    p_assigned_to: payload.assigned_to
  })

  if (error) throw error

  return data
}


export const getTaskinNewTaskAPi = async (parentID: number) => {
  const { data, error } = await db.from("tasks").select("*").eq("project_id", parentID).order("created_at", { ascending: false })

  if (error) throw error

  return data

}