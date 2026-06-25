import { db } from "@/lib/Supabase/supabaseClient";

const GRADING_TABLE = "tbl_grading";
const PLACEMENT_TABLE = "tbl_placement";

function throwSupabaseError(error: { message?: string } | null) {
  if (error) throw new Error(error.message ?? "Supabase request failed.");
}

export type Grading = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  placement_id: number | null;
  daterec: string | null;
  male_qty_old: number | null;
  female_qty_old: number | null;
  male_qty_new: number | null;
  female_qty_new: number | null;
  remarks: string | null;
  isactive: boolean;
  placement?: GradingPlacement | null;
};

export type GradingInsert = Omit<
  Grading,
  "id" | "created_at" | "created_by" | "updated_at" | "updated_by" | "placement"
>;

export type GradingUpdate = Partial<GradingInsert>;

export type GradingPlacement = {
  id: number;
  placement_date: string;
  dr_no: string | null;
  farm_id?: number | null;
  farm_name: string | null;
  building_no: string | null;
  pen_no: string | null;
  f_endingbalance?: number | null;
  m_endingbalance?: number | null;
};

export type GradingFarmHistory = {
  id: number;
  record_date: string | null;
  farm: string | null;
  building: string | null;
  pen: string | null;
  age: number | null;
  week_no: string | null;
  female_qty_old: number | null;
  female_qty_new: number | null;
  male_qty_old: number | null;
  male_qty_new: number | null;
  remarks: string | null;
};

export async function getGradingById(id: number) {
  const { data, error } = await db
    .from(GRADING_TABLE)
    .select("*")
    .eq("id", id)
    .single();

  throwSupabaseError(error);
  const row = data as Grading;

  if (!row.placement_id) return row;

  try {
    row.placement = await getGradingPlacementById(row.placement_id);
  } catch {
    row.placement = null;
  }

  return row;
}

export async function createGrading(payload: GradingInsert) {
  const { data, error } = await db
    .from(GRADING_TABLE)
    .insert(payload)
    .select("*")
    .single();

  throwSupabaseError(error);
  return data as Grading;
}

export async function createGradingBatch(payloads: GradingInsert[]) {
  const { data, error } = await db
    .from(GRADING_TABLE)
    .insert(payloads)
    .select("*");

  throwSupabaseError(error);
  return (data ?? []) as Grading[];
}

export async function updateGrading(id: number, payload: GradingUpdate) {
  const { data, error } = await db
    .from(GRADING_TABLE)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  throwSupabaseError(error);
  return data as Grading;
}

export async function listGradingPlacements() {
  const { data, error } = await db
    .from(PLACEMENT_TABLE)
    .select(
      "id, placement_date, dr_no, farm_id, farm_name, building_no, pen_no, f_endingbalance, m_endingbalance",
    )
    .not("farm_name", "is", null)
    .not("building_no", "is", null)
    .order("farm_name", { ascending: true })
    .order("building_no", { ascending: true })
    .order("pen_no", { ascending: true })
    .order("placement_date", { ascending: false })
    .order("id", { ascending: false });

  throwSupabaseError(error);
  return (data ?? []) as GradingPlacement[];
}

export async function listGradingHistoryByFarm(params: {
  farmId?: number | null;
  farmName?: string | null;
  buildingNo?: string | null;
}) {
  let placementQuery = db
    .from(PLACEMENT_TABLE)
    .select(
      "id, placement_date, dr_no, farm_id, farm_name, building_no, pen_no, f_endingbalance, m_endingbalance",
    );

  if (params.farmId != null) {
    placementQuery = placementQuery.eq("farm_id", params.farmId);
  } else if (params.farmName?.trim()) {
    placementQuery = placementQuery.eq("farm_name", params.farmName.trim());
  }

  if (params.buildingNo?.trim()) {
    placementQuery = placementQuery.eq("building_no", params.buildingNo.trim());
  }

  const { data: placements, error: placementError } = await placementQuery;
  throwSupabaseError(placementError);

  const placementRows = (placements ?? []) as GradingPlacement[];
  const placementIds = placementRows.map((placement) => placement.id);
  if (!placementIds.length) return [];

  const { data, error } = await db
    .from(GRADING_TABLE)
    .select(
      "id, placement_id, daterec, female_qty_old, female_qty_new, male_qty_old, male_qty_new, remarks",
    )
    .eq("isactive", true)
    .in("placement_id", placementIds)
    .order("daterec", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);

  throwSupabaseError(error);

  const placementById = new Map(
    placementRows.map((placement) => [placement.id, placement]),
  );

  return ((data ?? []) as Grading[]).map((row) => {
    const placement = row.placement_id
      ? placementById.get(row.placement_id)
      : undefined;
    const age = getAgeInDays(placement?.placement_date, row.daterec ?? "");

    return {
      id: row.id,
      record_date: row.daterec,
      farm: placement?.farm_name ?? null,
      building: placement?.building_no ?? null,
      pen: placement?.pen_no ?? null,
      age,
      week_no: formatWeeksDays(age),
      female_qty_old: row.female_qty_old,
      female_qty_new: row.female_qty_new,
      male_qty_old: row.male_qty_old,
      male_qty_new: row.male_qty_new,
      remarks: row.remarks,
    };
  }) as GradingFarmHistory[];
}

export async function getGradingPlacementById(id: number) {
  const { data, error } = await db
    .from(PLACEMENT_TABLE)
    .select(
      "id, placement_date, dr_no, farm_id, farm_name, building_no, pen_no, f_endingbalance, m_endingbalance",
    )
    .eq("id", id)
    .single();

  throwSupabaseError(error);
  return data as GradingPlacement;
}

function getAgeInDays(placementDate?: string | null, endDateValue?: string) {
  if (!placementDate || !endDateValue) return 0;
  const start = new Date(`${placementDate}T00:00:00`);
  const end = new Date(`${endDateValue}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const elapsedDays = Math.floor(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86_400_000,
  );

  return elapsedDays < 0 ? 0 : elapsedDays + 1;
}

function formatWeeksDays(days: number) {
  if (days <= 0) return "0.0";
  return `${Math.floor(days / 7)}.${days % 7}`;
}
