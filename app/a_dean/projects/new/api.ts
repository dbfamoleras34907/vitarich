import { db } from "@/lib/Supabase/supabaseClient"

export interface Project {
  id: number
  name: string
  description: string | null
  void: number
  created_by: string
  created_at: string
  updated_at: string
}

export async function getActiveProjects() {
  const { data, error } = await db
    .from("projects")
    .select("*")
    .eq("void", 1)
    .order("id", { ascending: false })

  if (error) throw error
  return data as Project[]
}

export async function createProject(
  name: string,
  description: string,
  userId: string
) {
  const { data, error } = await db
    .from("projects")
    .insert({
      name,
      description,
      created_by: userId
    })
    .select()
    .single()

  if (error) throw error
  return data as Project
}

export async function updateProject(
  id: number,
  name: string,
  description: string
) {
  const { data, error } = await db
    .from("projects")
    .update({
      name,
      description,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as Project
}

export async function voidProject(id: number) {
  const { error } = await db
    .from("projects")
    .update({ void: 0 })
    .eq("id", id)

  if (error) throw error
}