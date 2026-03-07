import { db } from "@/lib/Supabase/supabaseClient"

/** Dropdown option source: hatch_classification.classi_ref_no */
export type HatchClassiRefOption = {
  classi_ref_no: string
}

export async function listHatchClassiRefs(): Promise<HatchClassiRefOption[]> {
  const { data, error } = await db
    .from("hatch_classification")
    .select("classi_ref_no")
    .eq("is_active", true)
    .order("classi_ref_no", { ascending: true })

  if (error) throw error
  return (data ?? []).filter((r) => !!r.classi_ref_no)
}

/** egg_pre_warming types */
export type EggPreWarming = {
  id: number
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null

  egg_ref_no: string | null
  pre_temp: string | null
  egg_temp: string | null
  egg_temp_time_start: string | null
  egg_temp_time_end: string | null
  duration: number | null
  remarks: string | null
  is_active: boolean | null
}

export type EggPreWarmingInsert = {
  egg_ref_no: string | null
  pre_temp: string | null
  egg_temp: string | null
  egg_temp_time_start: string | null
  egg_temp_time_end: string | null
  duration: number | null
  remarks: string | null
  is_active: boolean | null
}

export type EggPreWarmingUpdate = Partial<EggPreWarmingInsert>

export async function listEggPreWarming(): Promise<EggPreWarming[]> {
  const { data, error } = await db
    .from("egg_pre_warming")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as EggPreWarming[]
}

export async function getEggPreWarmingById(id: number): Promise<EggPreWarming | null> {
  const { data, error } = await db
    .from("egg_pre_warming")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as EggPreWarming | null
}

export async function createEggPreWarming(payload: EggPreWarmingInsert): Promise<EggPreWarming> {
  const { data, error } = await db
    .from("egg_pre_warming")
    .insert(payload)
    .select("*")
    .single()

  if (error) throw error
  return data as EggPreWarming
}

export async function updateEggPreWarming(id: number, payload: EggPreWarmingUpdate): Promise<EggPreWarming> {
  const { data, error } = await db
    .from("egg_pre_warming")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single()

  if (error) throw error
  return data as EggPreWarming
}

/** soft-delete pattern */
export async function deleteEggPreWarming(id: number): Promise<void> {
  const { error } = await db
    .from("egg_pre_warming")
    .update({ is_active: false })
    .eq("id", id)

  if (error) throw error
}