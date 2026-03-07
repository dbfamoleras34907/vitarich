import { db } from "@/lib/Supabase/supabaseClient"

export type EggTransferProcess = {
  id: number
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null

  ref_no: string | null
  farm_source: string | null
  trans_date_start: string | null
  trans_date_end: string | null
  duration: number | null
  num_bangers: number | null
  total_egg_transfer: number | null
}

export type EggTransferInsert = {
  ref_no: string | null
  farm_source: string | null
  trans_date_start: string | null
  trans_date_end: string | null
  duration: number | null
  num_bangers: number | null
  total_egg_transfer: number | null
}

export type EggTransferUpdate = Partial<EggTransferInsert>

const TABLE = "egg_transfer_process" // ✅ IMPORTANT: use the REAL table name
const HATCH_CLASSI_TABLE = "hatch_classification"

export async function listClassiRefNos(): Promise<string[]> {
  const { data, error } = await db
    .from(HATCH_CLASSI_TABLE)
    .select("classi_ref_no")
    .order("created_at", { ascending: false })

  if (error) throw error

  const vals = (data ?? [])
    .map((r: any) => String(r.classi_ref_no ?? "").trim())
    .filter(Boolean)

  return Array.from(new Set(vals))
}

export async function listEggTransfers(): Promise<EggTransferProcess[]> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as EggTransferProcess[]
}

export async function getEggTransferById(id: number): Promise<EggTransferProcess> {
  const { data, error } = await db.from(TABLE).select("*").eq("id", id).single()
  if (error) throw error
  return data as EggTransferProcess
}

export async function createEggTransfer(payload: EggTransferInsert) {
  const { error } = await db.from(TABLE).insert(payload)
  if (error) throw error
}

export async function updateEggTransfer(id: number, payload: EggTransferUpdate) {
  const { error } = await db.from(TABLE).update(payload).eq("id", id)
  if (error) throw error
}

export async function deleteEggTransfer(id: number) {
  const { error } = await db.from(TABLE).delete().eq("id", id)
  if (error) throw error
}