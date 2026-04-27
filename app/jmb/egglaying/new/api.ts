import { db } from "@/lib/Supabase/supabaseClient";

const EGG_LAYING_TABLE = "tbl_egglaying";
const PLACEMENT_TABLE = "tbl_placement";

export type EggLaying = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  placement_id: number | null;
  date_laying: string;
  farm_id: number | null;
  farm_name: string | null;
  building: string | null;
  age: number | null;
  tep_collection: number | null;
  hatching_egg: number | null;
  table_egg: number | null;
  crack: number | null;
  junior: number | null;
  jumbo: number | null;
  condemn: number | null;
  is_active: boolean;
  building_id: number | null;
};

export type EggLayingInsert = Omit<
  EggLaying,
  "id" | "created_at" | "created_by" | "updated_at" | "updated_by"
>;

export type EggLayingUpdate = Partial<EggLayingInsert>;

export type LayingPlacement = {
  id: number;
  placement_date: string;
  dr_no: string;
  farm_id?: number | null;
  farm_name: string;
  building_id?: number | null;
  building_no: string;
  f_endingbalance: number | null;
  m_endingbalance: number | null;
};

export async function listEggLayings() {
  const { data, error } = await db
    .from(EGG_LAYING_TABLE)
    .select("*")
    .eq("is_active", true)
    .order("date_laying", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw error;
  return (data ?? []) as EggLaying[];
}

export async function listEggLayingHistoryByFarm(params: {
  farmId?: number | null;
  farmName?: string | null;
}) {
  let query = db
    .from(EGG_LAYING_TABLE)
    .select("*")
    .eq("is_active", true)
    .order("date_laying", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);

  if (params.farmId) {
    query = query.eq("farm_id", params.farmId);
  } else if (params.farmName) {
    query = query.eq("farm_name", params.farmName);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as EggLaying[];
}

export async function getEggLayingById(id: number) {
  const { data, error } = await db
    .from(EGG_LAYING_TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as EggLaying;
}

export async function createEggLaying(payload: EggLayingInsert) {
  const { data, error } = await db
    .from(EGG_LAYING_TABLE)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as EggLaying;
}

export async function updateEggLaying(id: number, payload: EggLayingUpdate) {
  const { data, error } = await db
    .from(EGG_LAYING_TABLE)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as EggLaying;
}

export async function deleteEggLaying(id: number) {
  const { error } = await db
    .from(EGG_LAYING_TABLE)
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
  return true;
}

export async function listLayingPlacements() {
  const { data, error } = await db
    .from(PLACEMENT_TABLE)
    .select("*")
    .order("placement_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw error;
  return (data ?? []) as LayingPlacement[];
}

export async function getLayingPlacementById(id: number) {
  const { data, error } = await db
    .from(PLACEMENT_TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as LayingPlacement;
}
