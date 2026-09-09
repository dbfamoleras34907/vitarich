import { db } from "@/lib/Supabase/supabaseClient";

const EGG_LAYING_TABLE = "tbl_egglaying";
const PLACEMENT_TABLE = "tbl_placement";
const BREEDER_CYCLE_TABLE = "tbl_breeder_cycle";

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
  classb: number | null;
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

export type EggLayingHistory = EggLaying & {
  cycle_no: number | null;
};

function normalizeAge(age: number | null | undefined) {
  if (age == null) return null;
  const numericAge = Number(age);
  return Number.isFinite(numericAge) ? Math.max(0, Math.floor(numericAge)) : null;
}

function validateDateLaying(dateLaying: string) {
  const today = new Date().toLocaleDateString("en-CA");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateLaying)) throw new Error("Date Laying is required.");
  if (dateLaying > today) throw new Error("Advance recording is not allowed. Date Laying cannot be later than today.");
}

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
    .order("id", { ascending: false });

  if (params.farmId) {
    query = query.eq("farm_id", params.farmId);
  } else if (params.farmName) {
    query = query.eq("farm_name", params.farmName);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as EggLaying[];
  const placementIds = Array.from(new Set(rows
    .map((row) => Number(row.placement_id ?? 0))
    .filter((id) => id > 0)));
  if (!placementIds.length) {
    return rows.map((row) => ({ ...row, cycle_no: null })) as EggLayingHistory[];
  }

  const { data: placements, error: placementError } = await db
    .from(PLACEMENT_TABLE)
    .select("id, cycle_id")
    .in("id", placementIds);
  if (placementError) throw placementError;

  const cycleIds = Array.from(new Set((placements ?? [])
    .map((placement) => Number(placement.cycle_id ?? 0))
    .filter((id) => id > 0)));
  const cycleNumberById = new Map<number, number>();
  if (cycleIds.length) {
    const { data: cycles, error: cycleError } = await db
      .from(BREEDER_CYCLE_TABLE)
      .select("id, cycle_no")
      .in("id", cycleIds);
    if (cycleError) throw cycleError;
    (cycles ?? []).forEach((cycle) => {
      cycleNumberById.set(Number(cycle.id), Number(cycle.cycle_no));
    });
  }

  const cycleIdByPlacementId = new Map((placements ?? []).map((placement) => [
    Number(placement.id),
    Number(placement.cycle_id ?? 0),
  ]));
  return rows.map((row) => ({
    ...row,
    cycle_no: cycleNumberById.get(
      cycleIdByPlacementId.get(Number(row.placement_id ?? 0)) ?? 0,
    ) ?? null,
  })) as EggLayingHistory[];
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
  validateDateLaying(payload.date_laying);
  const { data, error } = await db
    .from(EGG_LAYING_TABLE)
    .insert({ ...payload, age: normalizeAge(payload.age) })
    .select("*")
    .single();

  if (error) throw error;
  return data as EggLaying;
}

export async function listEggLayingsByPlacement(placementId: number) {
  const { data, error } = await db
    .from(EGG_LAYING_TABLE)
    .select("*")
    .eq("placement_id", placementId)
    .eq("is_active", true)
    .order("date_laying", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as EggLaying[];
}

export async function listEggLayingsByPlacements(placementIds: number[]) {
  const validPlacementIds = [...new Set(placementIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!validPlacementIds.length) return [];

  const { data, error } = await db
    .from(EGG_LAYING_TABLE)
    .select("*")
    .in("placement_id", validPlacementIds)
    .eq("is_active", true)
    .order("date_laying", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as EggLaying[];
}

export async function createEggLayingBatch(payloads: EggLayingInsert[]) {
  payloads.forEach((payload) => validateDateLaying(payload.date_laying));
  const { data, error } = await db
    .from(EGG_LAYING_TABLE)
    .insert(payloads.map((payload) => ({ ...payload, age: normalizeAge(payload.age) })))
    .select("*");

  if (error) throw error;
  return (data ?? []) as EggLaying[];
}

export async function updateEggLaying(id: number, payload: EggLayingUpdate) {
  if (payload.date_laying !== undefined) validateDateLaying(payload.date_laying);
  const { data, error } = await db
    .from(EGG_LAYING_TABLE)
    .update({
      ...payload,
      ...(payload.age !== undefined ? { age: normalizeAge(payload.age) } : {}),
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
