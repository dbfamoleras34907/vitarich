import { db } from "@/lib/Supabase/supabaseClient";

const GRADING_TABLE = "tbl_grading";
const PLACEMENT_TABLE = "tbl_placement";

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

export async function getGradingById(id: number) {
  const { data, error } = await db
    .from(GRADING_TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
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

  if (error) throw error;
  return data as Grading;
}

export async function createGradingBatch(payloads: GradingInsert[]) {
  const { data, error } = await db
    .from(GRADING_TABLE)
    .insert(payloads)
    .select("*");

  if (error) throw error;
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

  if (error) throw error;
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

  if (error) throw error;
  return (data ?? []) as GradingPlacement[];
}

export async function getGradingPlacementById(id: number) {
  const { data, error } = await db
    .from(PLACEMENT_TABLE)
    .select(
      "id, placement_date, dr_no, farm_id, farm_name, building_no, pen_no, f_endingbalance, m_endingbalance",
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as GradingPlacement;
}
