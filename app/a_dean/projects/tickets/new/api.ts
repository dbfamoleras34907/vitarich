import { db } from "@/lib/Supabase/supabaseClient"

export interface Issue {
  id: number
  project_id: number | null
  title: string
  description: string | null
  status: string
  priority: string
  created_by: string
  created_at: string
}

export async function getProjectsForSelect() {
  const { data, error } = await db
    .from("projects")
    .select("id, name")
    .eq("void", 1)
    .order("name")

  if (error) throw error
  return data
}

export async function createIssue(payload: {
  title: string
  description: string
  project_id: number | null
  priority: string
  assignees: string[]
  userId: string
}) {
  // 1️⃣ Create issue
  const { data: issue, error } = await db
    .from("issues")
    .insert({
      title: payload.title,
      description: payload.description,
      project_id: payload.project_id,
      priority: payload.priority,
      created_by: payload.userId
    })
    .select()
    .single()

  if (error) throw error

  // 2️⃣ Insert assignees
  if (payload.assignees.length > 0) {
    const rows = payload.assignees.map((userId) => ({
      issue_id: issue.id,
      user_id: userId
    }))

    const { error: assignError } = await db
      .from("issue_assignees")
      .insert(rows)

    if (assignError) throw assignError
  }

  return issue as Issue
}


export async function getIssuesList() {
  const { data, error } = await db
    .from("issues")
    .select(`
      id,
      title,
      status,
      priority,
      created_at,
      project:projects(id, name),
      assignees:issue_assignees(
        user:auth.users(id, email)
      )
    `)
    .order("id", { ascending: false })

  if (error) throw error
  return data
}