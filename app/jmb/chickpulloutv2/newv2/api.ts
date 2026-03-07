import { db } from "@/lib/Supabase/supabaseClient"

export type ChickPulloutProcess = {
  id: number
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null

  egg_ref_no: string | null
  chick_hatch_ref_no: string | null
  farm_source: string | null
  machine_no: string | null
  hatch_date: string | null // date: "YYYY-MM-DD"

  chicks_hatched: number | null // bigint -> number
  dead_in_shell: number | null // bigint -> number

  hatch_fertile: number | null // bigint/numeric -> number
  mortality_rate: number | null // bigint/numeric -> number
  hatch_window: number | null // bigint -> number
}

const TABLE = "chick_pullout_process"

export async function listChickPulloutProcess() {
  const { data, error } = await db.from(TABLE).select("*").order("id", { ascending: false })
  if (error) throw error
  return (data ?? []) as ChickPulloutProcess[]
}

export async function getChickPulloutProcessById(id: number) {
  const { data, error } = await db.from(TABLE).select("*").eq("id", id).single()
  if (error) throw error
  return data as ChickPulloutProcess
}

export type ChickPulloutProcessCreate = Omit<
  ChickPulloutProcess,
  "id" | "created_at" | "created_by" | "updated_at" | "updated_by"
>

export async function createChickPulloutProcess(payload: ChickPulloutProcessCreate) {
  const { data, error } = await db.from(TABLE).insert([payload]).select("*").single()
  if (error) throw error
  return data as ChickPulloutProcess
}

export type ChickPulloutProcessUpdate = Partial<ChickPulloutProcessCreate>

export async function updateChickPulloutProcess(id: number, payload: ChickPulloutProcessUpdate) {
  const { data, error } = await db
    .from(TABLE)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single()

  if (error) throw error
  return data as ChickPulloutProcess
}

export async function deleteChickPulloutProcess(id: number) {
  const { error } = await db.from(TABLE).delete().eq("id", id)
  if (error) throw error
  return true
}

/* -------------------------------------------
   Extra helpers for dropdown + autofill
   (same file, same style)
--------------------------------------------*/

/** Dropdown for EGG REFERENCE (from egg_hatchery_process.egg_ref) */
export async function listEggReferences() {
  const { data, error } = await db
    .from("egg_hatchery_process")
    .select("egg_ref")
    .order("egg_ref", { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => r.egg_ref).filter(Boolean) as string[]
}

/** Auto-fill Farm Source, Machine No, Hatch Window based on egg_ref */
export async function getEggReferenceMeta(eggRef: string) {
  const { data, error } = await db
    .from("egg_hatchery_process")
    .select("egg_ref, farm_source, machine_no, hatch_window")
    .eq("egg_ref", eggRef)
    .maybeSingle()

  if (error) throw error

  return (data ?? null) as
    | {
        egg_ref: string
        farm_source: string | null
        machine_no: string | null
        hatch_window: number | null
      }
    | null
}
