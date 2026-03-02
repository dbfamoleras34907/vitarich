import { db } from "@/lib/Supabase/supabaseClient";

export type ChickGradingProcess = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;

  batch_code: string;
  egg_ref_no: string | null;

  class_a: number | null;
  class_b: number | null;
  class_a_junior: number | null;
  class_c: number | null;
  cull_chicks: number | null;
  dead_chicks: number | null;
  infertile: number | null;
  dead_germ: number | null;
  live_pip: number | null;
  dead_pip: number | null;
  unhatched: number | null;
  rotten: number | null;

  chick_room_temperature: number | null;
  grading_personnel: string | null;
  grading_datetime: string; // timestamptz

  // GENERATED columns (read-only)
  total_chicks: number | null;
  good_quality_chicks: number | null;
  quality_grade_rate: number | null;
  cull_rate: number | null;
};

const TABLE = "chick_grading_process";

export async function listChickGradingProcess() {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ChickGradingProcess[];
}

export async function getChickGradingProcessById(id: number) {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as ChickGradingProcess;
}

export type ChickGradingProcessCreate = Omit<
  ChickGradingProcess,
  | "id"
  | "created_at"
  | "created_by"
  | "updated_at"
  | "updated_by"
  | "total_chicks"
  | "good_quality_chicks"
  | "quality_grade_rate"
  | "cull_rate"
>;

export async function createChickGradingProcess(
  payload: ChickGradingProcessCreate,
) {
  const { data, error } = await db
    .from(TABLE)
    .insert([payload])
    .select("*")
    .single();
  if (error) throw error;
  return data as ChickGradingProcess;
}

export type ChickGradingProcessUpdate = Partial<ChickGradingProcessCreate>;

export async function updateChickGradingProcess(
  id: number,
  payload: ChickGradingProcessUpdate,
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
  return data as ChickGradingProcess;
}

export async function deleteChickGradingProcess(id: number) {
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) throw error;
  return true;
}

/** Egg reference dropdown source */
export async function listEggReferences() {
  const { data, error } = await db
    .from("chick_pullout_process")
    .select("egg_ref_no")
    .order("egg_ref_no", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r: any) => r.egg_ref_no).filter(Boolean) as string[];
}

// -------------------------------
// ✅ Batch Code Generator
// Format: EggRefNo-BMMDDYY-0001
// Autoincrement per MMDDYY based on latest batch saved that day.
// -------------------------------

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function mmddyyFromDate(d: Date) {
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}`;
}
function pad4(n: number) {
  return String(n).padStart(4, "0");
}

/**
 * Get next batch code for a given egg_ref_no.
 * Sequence is per MMDDYY across ALL transactions.
 */
export async function generateNextBatchCode(
  eggRefNo: string,
  when: Date = new Date(),
) {
  const egg = (eggRefNo ?? "").trim();
  if (!egg) return "";

  const mmddyy = mmddyyFromDate(when);
  const needle = `-B${mmddyy}-`;

  // get latest batch_code for this day (ends with -0001, -0002, etc)
  const { data, error } = await db
    .from(TABLE)
    .select("batch_code")
    .ilike("batch_code", `%${needle}%`)
    .order("batch_code", { ascending: false }) // lexicographic works with fixed 4-digit suffix
    .limit(1);

  if (error) throw error;

  let nextSeq = 1;
  const last = (data?.[0] as any)?.batch_code as string | undefined;
  if (last && last.includes(needle)) {
    const lastPart = last.split("-").pop(); // "0007"
    const lastNum = Number(lastPart);
    if (Number.isFinite(lastNum) && lastNum >= 1) nextSeq = lastNum + 1;
  }

  return `${egg}-B${mmddyy}-${pad4(nextSeq)}`;
}
export async function getChicksHatchedByEggRef(eggRefNo: string) {
  const egg = (eggRefNo ?? "").trim();
  if (!egg) return 0;

  const { data, error } = await db
    .from("chick_pullout_process")
    .select("chicks_hatched")
    .eq("egg_ref_no", egg)
    .order("id", { ascending: false })
    .limit(1);

  if (error) throw error;

  const v = (data?.[0] as any)?.chicks_hatched;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
