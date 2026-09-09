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
  default_priority: "low" | "mid" | "high" | null
  default_task_type_id: number | null
  supervisor_user_id: number | null
  supervisor_email: string | null
  default_cc_user_ids: number[]
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
  status?: WorkspaceTimesheetStatus | null
  total_hours?: number | string | null
}

export type WorkspaceEmailRecipientUser = {
  id: number
  email: string
  firstname: string | null
  middlename: string | null
  lastname: string | null
  user_type: number | null
}

export const WORKSPACE_TIMESHEET_STATUSES = [
  "Draft",
  "Submitted",
  "Approved",
  "Rejected",
] as const

export type WorkspaceTimesheetStatus = typeof WORKSPACE_TIMESHEET_STATUSES[number]

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

export type WorkspaceTimesheetReportRow = {
  id: number
  docentry: number
  doc_date: string
  assigned_to: number
  project_id: number | null
  project_name: string | null
  task_id: number | null
  subject: string | null
  remarks: string
  from_time: string
  hrs: string
}

export async function getWorkspaceProjects() {
  const { data, error } = await db.from("vw_projects_list").select("*")
  if (error) throw error
  return (data ?? []) as WorkspaceProject[]
}

export async function getWorkspaceProjectsForTaskSelection() {
  const listedProjects = await getWorkspaceProjects()
  const { data: directProjects, error } = await db
    .from("projects")
    .select("id, project_name, void")
    .or("void.is.null,void.eq.1")
    .order("project_name")

  if (error) return listedProjects

  const projectsById = new Map<number, WorkspaceProject>()
  listedProjects.forEach(project => projectsById.set(project.id, project))
  ;(directProjects ?? []).forEach(project => {
    const existing = projectsById.get(Number(project.id))
    projectsById.set(Number(project.id), {
      ...existing,
      id: Number(project.id),
      project_name: String(project.project_name ?? existing?.project_name ?? ''),
      void: project.void,
    })
  })

  return [...projectsById.values()]
    .filter(project => project.project_name.trim())
    .sort((left, right) => left.project_name.localeCompare(right.project_name))
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
    .select("id, default_activity_type_id, default_priority, default_task_type_id, supervisor_user_id, supervisor_email, default_cc_user_ids, created_at, updated_at")
    .eq("id", 1)
    .maybeSingle()

  if (error) throw error
  return (data ?? {
    id: 1,
    default_activity_type_id: null,
    default_priority: null,
    default_task_type_id: null,
    supervisor_user_id: null,
    supervisor_email: null,
    default_cc_user_ids: [],
  }) as WorkspaceTimesheetSettings
}

export async function getWorkspaceTimesheetSupervisorEmail() {
  const { data, error } = await db
    .from("workspace_timesheet_settings")
    .select("supervisor_email")
    .eq("id", 1)
    .maybeSingle()

  if (error) throw error
  return data?.supervisor_email?.trim() || null
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
  const [headersResult, entryOptions] = await Promise.all([
    db
      .from("vw_timesheets")
      .select("*")
      .eq("assigned_to", userId)
      .order("doc_date", { ascending: false }),
    getWorkspaceTimesheetEntryOptionsForUser(userId),
  ])

  if (headersResult.error) throw headersResult.error

  const headers = (headersResult.data ?? []) as WorkspaceTimesheetHeader[]
  if (headers.length === 0) return [] as WorkspaceTimesheetReportRow[]

  const { data: lineData, error: lineError } = await db
    .from("vw_timesheet_lines")
    .select("*")
    .in("docentry", headers.map(header => header.id))

  if (lineError) throw lineError

  const headersById = new Map(headers.map(header => [header.id, header]))
  const projectsById = new Map(entryOptions.projects.map(project => [project.id, project]))
  const tasksById = new Map(entryOptions.tasks.map(task => [task.id, task]))

  return ((lineData ?? []) as WorkspaceTimesheetLine[])
    .map(line => {
      const header = headersById.get(line.docentry)
      return {
        id: line.id ?? line.docentry,
        docentry: line.docentry,
        doc_date: header?.doc_date ?? '',
        assigned_to: userId,
        project_id: line.project_id,
        project_name: line.project_id == null
          ? null
          : projectsById.get(line.project_id)?.project_name ?? null,
        task_id: line.task_id,
        subject: line.task_id == null
          ? null
          : tasksById.get(line.task_id)?.subject ?? null,
        remarks: line.remarks,
        from_time: line.from_time,
        hrs: line.hrs,
      }
    })
    .filter(row => row.doc_date)
    .sort((left, right) => {
      const dateOrder = right.doc_date.localeCompare(left.doc_date)
      return dateOrder || left.docentry - right.docentry
    })
}

export async function getWorkspaceEmailRecipientUsers() {
  const { data, error } = await db
    .from("users")
    .select("id, email, firstname, middlename, lastname, user_type")
    .eq("isactive", "1")
    .not("email", "is", null)
    .order("firstname")
    .order("lastname")

  if (error) throw error
  return (data ?? []).filter(user => String(user.email ?? "").trim()) as WorkspaceEmailRecipientUser[]
}
