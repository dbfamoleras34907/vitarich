import { db } from "@/lib/Supabase/supabaseClient";

export type EggHatcheryProcess = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  egg_ref: string | null;
  farm_source: string | null;
  daterec: string | null; // date: "YYYY-MM-DD"
  machine_no: string | null;
  hatch_temp: string | null;
  hatch_humidity: string | null;
  hatch_time_start: string | null; // timestamp (no tz)
  hatch_time_end: string | null;
  duration: number | null; // bigint -> number
  hatch_window: number | null; // bigint -> number
  total_egg: number | null; // bigint -> number
};

const TABLE = "egg_hatchery_process";
let classiRefNosPromise: Promise<string[]> | null = null;

export async function listEggHatcheryProcess() {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("id", { ascending: false });

  if (error) throw error;
  return (data ?? []) as EggHatcheryProcess[];
}

export async function getEggHatcheryProcessById(id: number) {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as EggHatcheryProcess;
}

export type EggHatcheryProcessCreate = Omit<
  EggHatcheryProcess,
  "id" | "created_at" | "created_by" | "updated_at" | "updated_by"
>;

export async function createEggHatcheryProcess(
  payload: EggHatcheryProcessCreate,
) {
  const { data, error } = await db
    .from(TABLE)
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;
  return data as EggHatcheryProcess;
}

export type EggHatcheryProcessUpdate = Partial<EggHatcheryProcessCreate>;

export async function updateEggHatcheryProcess(
  id: number,
  payload: EggHatcheryProcessUpdate,
) {
  const { data, error } = await db
    .from(TABLE)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as EggHatcheryProcess;
}

export async function deleteEggHatcheryProcess(id: number) {
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) throw error;
  return true;
}
export async function listClassiRefNos(): Promise<string[]> {
  if (classiRefNosPromise) return classiRefNosPromise;

  classiRefNosPromise = (async () => {
    const { data, error } = await db
      .from("view_for_egg_hatcher")
      .select("ref_no")
      .not("ref_no", "is", null)
      .order("ref_no", { ascending: true });

    if (error) throw error;
    const vals = (data ?? [])
      .map((r: { ref_no: string | null }) => String(r.ref_no ?? "").trim())
      .filter(Boolean);

    return Array.from(new Set(vals));
  })().catch((error) => {
    classiRefNosPromise = null;
    throw error;
  });

  return classiRefNosPromise;
}
