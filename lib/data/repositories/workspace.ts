import { db } from "@/lib/Supabase/supabaseClient"

export type WorkspaceProject = {
  id: number
  project_name: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  project_manager?: number | null
  project_members?: number[] | null
  project_type?: string | null
  created_at?: string | null
  void?: number | string | null
}

export type WorkspaceTask = {
  id: number
  project_id: number
  subject: string
  issue?: string | null
  priority?: "low" | "mid" | "high" | null
  task_type?: number | null
  parent_task?: number | null
  color?: string | null
  assigned_to?: number | null
  status_id?: number | null
  created_at?: string | null
}

export type WorkspaceTaskStatus = {
  id: number
  code: string
  name: string
  color: string
  sort_order: number
  is_final: boolean
  void: number
  created_at?: string | null
  updated_at?: string | null
}

export type WorkspaceTimesheetSettings = {
  id: number
  default_activity_type_id: number | null
  supervisor_user_id: number | null
  supervisor_email: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type WorkspaceSupervisorUser = {
  id: number
  email: string
  firstname: string | null
  middlename: string | null
  lastname: string | null
  user_type: 1 | 2
}

export type WorkspaceLookup = {
  id: number
  name: string
}

export type WorkspaceTimesheetHeader = {
  id: number
  doc_date: string
  assigned_to: number | null
  status?: string | null
  total_hours?: number | string | null
}

export type WorkspaceTimesheetLine = {
  id?: number | null
  docentry: number
  line_num: number
  activity_type: number | null
  from_time: string
  hrs: string
  project_id: number | null
  task_id: number | null
  remarks: string
}

export async function getWorkspaceProjects() {
  const { data, error } = await db.from("vw_projects_list").select("*")
  if (error) throw error
  return (data ?? []) as WorkspaceProject[]
}

export async function getWorkspaceProjectById(id: number) {
  const { data, error } = await db
    .from("vw_projects_full")
    .select("*")
    .eq("id", id)
    .single()

  if (error) throw error
  return data as WorkspaceProject
}

export async function getWorkspaceTaskTypes() {
  const { data, error } = await db
    .from("task_types")
    .select("id, name")
    .eq("void", 1)
    .order("name")

  if (error) throw error
  return (data ?? []) as WorkspaceLookup[]
}

export async function getWorkspaceActivityTypes() {
  const { data, error } = await db
    .from("activity_types")
    .select("id, name")
    .order("name")

  if (error) throw error
  return (data ?? []) as WorkspaceLookup[]
}

export async function getWorkspaceTimesheetSettings() {
  const { data, error } = await db
    .from("workspace_timesheet_settings")
    .select("id, default_activity_type_id, supervisor_user_id, supervisor_email, created_at, updated_at")
    .eq("id", 1)
    .maybeSingle()

  if (error) throw error
  return (data ?? {
    id: 1,
    default_activity_type_id: null,
    supervisor_user_id: null,
    supervisor_email: null,
  }) as WorkspaceTimesheetSettings
}

export async function getWorkspaceSupervisorUsers() {
  const { data, error } = await db
    .from("users")
    .select("id, email, firstname, middlename, lastname, user_type")
    .in("user_type", [1, 2])
    .eq("isactive", "1")
    .not("email", "is", null)
    .order("firstname")
    .order("lastname")

  if (error) throw error
  return (data ?? []).filter(user => String(user.email ?? "").trim()) as WorkspaceSupervisorUser[]
}

export async function getWorkspaceTasks() {
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as WorkspaceTask[]
}

export async function getWorkspaceTaskById(id: number) {
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single()

  if (error) throw error
  return data as WorkspaceTask
}

export async function getWorkspaceTasksByProject(projectId: number) {
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as WorkspaceTask[]
}

export async function getWorkspaceTasksForUser(userId: number) {
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .eq("assigned_to", userId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as WorkspaceTask[]
}

export async function getWorkspaceTimesheetEntryOptionsForUser(userId: number) {
  const [projects, assignedTasks] = await Promise.all([
    getWorkspaceProjects(),
    getWorkspaceTasksForUser(userId),
  ])

  const assignedProjectIds = new Set(
    assignedTasks.map(task => task.project_id)
  )
  const associatedProjects = projects.filter(project =>
    project.project_manager === userId ||
    project.project_members?.some(memberId => Number(memberId) === userId) ||
    assignedProjectIds.has(project.id)
  )
  const associatedProjectIds = new Set(associatedProjects.map(project => project.id))

  if (associatedProjectIds.size === 0) {
    return { projects: associatedProjects, tasks: [] as WorkspaceTask[] }
  }

  const { data, error } = await db
    .from("tasks")
    .select("*")
    .in("project_id", [...associatedProjectIds])
    .order("created_at", { ascending: false })

  if (error) throw error

  return {
    projects: associatedProjects,
    tasks: (data ?? []) as WorkspaceTask[],
  }
}

export async function getWorkspaceTaskStatuses(options?: { includeInactive?: boolean }) {
  let query = db
    .from("workspace_task_statuses")
    .select("id, code, name, color, sort_order, is_final, void, created_at, updated_at")
    .order("sort_order")
    .order("id")

  if (!options?.includeInactive) query = query.eq("void", 1)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as WorkspaceTaskStatus[]
}

export async function getWorkspaceTimesheets() {
  const { data, error } = await db
    .from("vw_timesheets")
    .select("*")
    .order("doc_date", { ascending: false })

  if (error) throw error
  return (data ?? []) as WorkspaceTimesheetHeader[]
}

export async function getWorkspaceTimesheetById(id: number) {
  const [headerResult, linesResult] = await Promise.all([
    db.from("vw_timesheets").select("*").eq("id", id).single(),
    db.from("vw_timesheet_lines").select("*").eq("docentry", id),
  ])

  if (headerResult.error) throw headerResult.error
  if (linesResult.error) throw linesResult.error

  return {
    header: headerResult.data as WorkspaceTimesheetHeader,
    lines: (linesResult.data ?? []) as WorkspaceTimesheetLine[],
  }
}

export async function getWorkspaceTimesheetReportForUser(userId: number) {
  const { data, error } = await db
    .from("vw_timesheets_report")
    .select("*")
    .eq("assigned_to", userId)

  if (error) throw error
  return data ?? []
}
