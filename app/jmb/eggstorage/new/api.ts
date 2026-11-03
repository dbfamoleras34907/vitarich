import { db } from "@/lib/Supabase/supabaseClient";

const TABLE = "egg_storage_mngt"; // ✅ CHANGE THIS if your real table name is different
const CLASSIFICATION_REFERENCE_PAGE_SIZE = 500;

export type EggStorageClassificationReference = {
  classi_ref_no: string;
  date_classify: string | null;
};

/**
 * Lists every Classification reference that can be selected for Egg Storage.
 *
 * PostgREST caps un-ranged responses, so the lookup is paged to keep older
 * eligible classifications available in the form.
 */
export async function listEggStorageClassificationReferences(): Promise<
  EggStorageClassificationReference[]
> {
  const references: EggStorageClassificationReference[] = [];

  for (let from = 0; ; from += CLASSIFICATION_REFERENCE_PAGE_SIZE) {
    const { data, error } = await db
      .from("view_eggclassi_for_eggstorage")
      .select("classi_ref_no,date_classify")
      .order("date_classify", { ascending: false })
      .order("classi_ref_no", { ascending: false })
      .range(from, from + CLASSIFICATION_REFERENCE_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as EggStorageClassificationReference[];
    references.push(...page);

    if (page.length < CLASSIFICATION_REFERENCE_PAGE_SIZE) break;
  }

  return references;
}

// Insert payload (what the form sends)
export type EggStorageInsert = {
  classi_ref_no: string | null;
  stor_temp: string | null;
  room_temp: string | null;
  stor_humi: string | null;
  shell_start: string | null; // ISO string
  shell_end: string | null; // ISO string
  duration: number | null; // seconds
  remarks: string | null;
};

// Row shape for table/listing
export type EggStorageMngt = {
  id: number;
  created_at: string | null;
  created_by?: string | null;
  updated_at: string | null;

  classi_ref_no: string | null;
  stor_temp: string | null;
  room_temp: string | null;
  stor_humi: string | null;
  shell_start: string | null;
  shell_end: string | null;
  duration: number | null;
  remarks: string | null;
};

// export async function createEggStorage(payload: EggStorageInsert) {
//   const { data, error } = await db
//     .from(TABLE)
//     .insert(payload)
//     .select("*")
//     .single()

//   if (error) throw error
//   return data as EggStorageMngt
// }

export async function createEggStorage(
  payload: EggStorageInsert | EggStorageInsert[],
) {
  const isArray = Array.isArray(payload);

  const query = db.from(TABLE).insert(payload).select("*");

  const { data, error } = isArray ? await query : await query.single();

  if (error) throw error;

  return data as EggStorageMngt | EggStorageMngt[];
}

export async function listEggStorage() {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("id", { ascending: false });

  if (error) throw error;
  return (data ?? []) as EggStorageMngt[];
}

export async function getEggStorageById(id: number) {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as EggStorageMngt;
}

export async function updateEggStorage(id: number, payload: EggStorageInsert) {
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
  return data as EggStorageMngt;
}

export async function deleteEggStorage(id: number) {
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) throw error;
  return true;
}
