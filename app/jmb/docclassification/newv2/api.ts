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
  exploder: number | null;
  unhatched_good: number | null;
  unhatched_bad: number | null;
  infertile_good: number | null;
  infertile_bad: number | null;

  chick_room_temperature: number | null;
  grading_personnel: string | null;
  grading_datetime: string;

  // computed from view
  total_chicks: number | null;
  good_quality_chicks: number | null;
  quality_grade_rate: number | null;
  cull_rate: number | null;
};

const READ_TABLE = "v_chick_grading_process";
const WRITE_TABLE = "chick_grading_process";

export type ChickGradingProcessCreate = {
  batch_code: string;
  egg_ref_no?: string | null;

  class_a?: number | null;
  class_b?: number | null;
  class_a_junior?: number | null;
  class_c?: number | null;
  cull_chicks?: number | null;
  dead_chicks?: number | null;
  infertile?: number | null;
  dead_germ?: number | null;
  live_pip?: number | null;
  dead_pip?: number | null;
  unhatched?: number | null;
  rotten?: number | null;
  exploder?: number | null;
  unhatched_good?: number | null;
  unhatched_bad?: number | null;
  infertile_good?: number | null;
  infertile_bad?: number | null;

  chick_room_temperature?: number | null;
  grading_personnel?: string | null;
  grading_datetime?: string;
};

export type ChickGradingProcessUpdate = Partial<ChickGradingProcessCreate>;

export async function listChickGradingProcess() {
  const { data, error } = await db
    .from(READ_TABLE)
    .select("*")
    .order("id", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ChickGradingProcess[];
}

export async function getChickGradingProcessById(id: number) {
  const { data, error } = await db
    .from(READ_TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as ChickGradingProcess;
}

export async function createChickGradingProcess(
  payload: ChickGradingProcessCreate,
) {
  const { data, error } = await db
    .from(WRITE_TABLE)
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;

  return await getChickGradingProcessById(data.id);
}

export async function updateChickGradingProcess(
  id: number,
  payload: ChickGradingProcessUpdate,
) {
  const { error } = await db
    .from(WRITE_TABLE)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;

  return await getChickGradingProcessById(id);
}

export async function deleteChickGradingProcess(id: number) {
  const { error } = await db.from(WRITE_TABLE).delete().eq("id", id);
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

  return [
    ...new Set((data ?? []).map((row) => row.egg_ref_no).filter(Boolean)),
  ] as string[];
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

function mmddyyFromDate(d: Date) {
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}`;
}

/**
 * Format: EggRefNo-BMMDDYY-0001
 * Sequence is per MMDDYY across all chick grading rows.
 */
export async function generateNextBatchCode(
  eggRefNo: string,
  when: Date = new Date(),
) {
  const egg = (eggRefNo ?? "").trim();
  if (!egg) return "";

  const mmddyy = mmddyyFromDate(when);
  const needle = `-B${mmddyy}-`;

  const { data, error } = await db
    .from(WRITE_TABLE)
    .select("batch_code")
    .ilike("batch_code", `%${needle}%`)
    .order("batch_code", { ascending: false })
    .limit(1);

  if (error) throw error;

  let nextSeq = 1;
  const last = data?.[0]?.batch_code as string | undefined;

  if (last && last.includes(needle)) {
    const lastNum = Number(last.split("-").pop());
    if (Number.isFinite(lastNum) && lastNum > 0) {
      nextSeq = lastNum + 1;
    }
  }

  return `${egg}-B${mmddyy}-${pad4(nextSeq)}`;
}
export async function getRemainingDocClassificationInventory(eggRefNo: string) {
  const egg = (eggRefNo ?? "").trim();
  if (!egg) return 0;

  const { data, error } = await db.rpc(
    "get_remaining_doc_classification_inventory",
    {
      p_egg_ref_no: egg,
    },
  );

  if (error) throw error;

  const result = Array.isArray(data) ? data[0]?.remaining : data;
  const remaining = Number(result ?? 0);

  return Number.isFinite(remaining) ? remaining : 0;
}
