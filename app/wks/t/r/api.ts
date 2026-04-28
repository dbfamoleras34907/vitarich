import { db } from "@/lib/Supabase/supabaseClient"

export const getTask = async () => {
  const { data, error } = await db
    .from("tasks")
    .select("*")

  if (error) {
    console.error(error)
    throw error
  }

  return data ?? []
}

export const getTaskType = async () => {
  const { data, error } = await db
    .from("task_types")
    .select("*")
    .eq("void", 1)

  if (error) {
    console.error(error)
    throw error
  }

  return data ?? []
}