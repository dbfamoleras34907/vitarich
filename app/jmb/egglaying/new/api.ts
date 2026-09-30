import { db } from "@/lib/Supabase/supabaseClient";
import { listBreederEggLayings, type EggLaying } from "@/app/jmb/lib/data/repositories/breederEggLaying";
import {
  saveBreederEggLayings,
  voidBreederEggLaying,
} from "@/app/jmb/lib/data/mutations/breederEggLaying";
export type { EggLaying } from "@/app/jmb/lib/data/repositories/breederEggLaying";

const EGG_LAYING_TABLE = "tbl_egglaying";
const PLACEMENT_TABLE = "tbl_placement";
const BREEDER_CYCLE_TABLE = "tbl_breeder_cycle";

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
  return listBreederEggLayings();
}

export async function listEggLayingHistoryByFarm(params: {
  farmId?: number | null;
  farmName?: string | null;
}) {
  const rows = await listBreederEggLayings({
    farmId: params.farmId ?? undefined,
    farmName: params.farmName ?? undefined,
  });
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
  const rows = await saveBreederEggLayings([
    { ...payload, age: normalizeAge(payload.age) },
  ]);
  return rows[0];
}

export async function listEggLayingsByPlacement(placementId: number) {
  return listBreederEggLayings({ placementIds: [placementId], ascending: true });
}

export async function listEggLayingsByPlacements(placementIds: number[]) {
  return listBreederEggLayings({ placementIds, ascending: true });
}

export async function createEggLayingBatch(payloads: EggLayingInsert[]) {
  payloads.forEach((payload) => validateDateLaying(payload.date_laying));
  return saveBreederEggLayings(
    payloads.map((payload) => ({ ...payload, age: normalizeAge(payload.age) })),
  );
}

export async function updateEggLaying(id: number, payload: EggLayingUpdate) {
  if (payload.date_laying !== undefined) validateDateLaying(payload.date_laying);
  const existing = await getEggLayingById(id);
  const rows = await saveBreederEggLayings([{
    ...existing,
    ...payload,
    id,
    age: payload.age !== undefined ? normalizeAge(payload.age) : existing.age,
  }]);
  return rows[0];
}

export async function voidEggLaying(id: number, reason: string) {
  return voidBreederEggLaying(id, reason);
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
