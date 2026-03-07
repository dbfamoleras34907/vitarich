import { db } from "@/lib/Supabase/supabaseClient";
  
export type HatchClassiRefOption = {
  classi_ref_no: string
  good_egg: number | null
}

export async function listHatchClassiRefs(): Promise<HatchClassiRefOption[]> {
  const { data, error } = await db
    .from("hatch_classification")
    .select("classi_ref_no, good_egg")
    .not("classi_ref_no", "is", null)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as HatchClassiRefOption[]
}

export type SetterIncubation = {
  id: number
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null

  ref_no: string | null
  setting_date: string | null
  farm_source: string | null
  machine_id: string | null

  total_eggs: number | null
  setter_temp: number | null
  setter_humidity: number | null

  turning_interval: number | null
  turning_angle: number | null
  incubation_duration: number | null

  egg_shell_temp: number | null
  egg_shell_temp_dt: string | null
  egg_shell_orientation: "Pointed Up" | "Pointed Down" | "Pointed Middle" | null
}

const TABLE = "setter_incubation_process"

export async function listSetterIncubations() {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("id", { ascending: false })

  if (error) throw error
  return (data ?? []) as SetterIncubation[]
}

export async function getSetterIncubationById(id: number) {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single()

  if (error) throw error
  return data as SetterIncubation
}

export type SetterIncubationInsert = Omit<
  SetterIncubation,
  "id" | "created_at" | "created_by" | "updated_at" | "updated_by"
>

export async function createSetterIncubation(payload: SetterIncubationInsert) {
  const { data, error } = await db.from(TABLE).insert(payload).select("*").single()
  if (error) throw error
  return data as SetterIncubation
}

export async function updateSetterIncubation(id: number, payload: Partial<SetterIncubationInsert>) {
  const { data, error } = await db
    .from(TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single()

  if (error) throw error
  return data as SetterIncubation
}

export async function deleteSetterIncubation(id: number) {
  const { error } = await db.from(TABLE).delete().eq("id", id)
  if (error) throw error
  return true
} 