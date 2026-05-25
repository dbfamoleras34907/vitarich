import { db } from "@/lib/Supabase/supabaseClient";

const GROWING_TABLE = "tbl_growing";
const FEEDTYPE_TABLE = "tbl_feedtype";
const PLACEMENT_TABLE = "tbl_placement";

export type FeedType = {
  id: number;
  description: string | null;
  uom: string | null;
  isactive: boolean;
};

export type Growing = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  placement_id: number | null;
  daterec: string | null;
  male_mortality: number | null;
  male_feedtype_id: number | null;
  male_feed_consumption: number | null;
  male_body_weight: number | null;
  female_mortality: number | null;
  female_feedtype_id: number | null;
  female_feed_consumption: number | null;
  female_body_weight: number | null;
  isactive: boolean;
  placement?: GrowingPlacement | null;
  male_feedtype?: Pick<FeedType, "description" | "uom"> | null;
  female_feedtype?: Pick<FeedType, "description" | "uom"> | null;
};

export type GrowingInsert = Omit<
  Growing,
  | "id"
  | "created_at"
  | "created_by"
  | "updated_at"
  | "updated_by"
  | "placement"
  | "male_feedtype"
  | "female_feedtype"
>;

export type GrowingUpdate = Partial<GrowingInsert>;

export type GrowingPlacement = {
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

const growingSelect = `
  *,
  placement:tbl_placement!fk_tbl_growing_placement(
    id,
    placement_date,
    dr_no,
    farm_id,
    farm_name,
    building_no,
    pen_no,
    f_endingbalance,
    m_endingbalance
  ),
  male_feedtype:tbl_feedtype!fk_tbl_growing_male_feedtype(description,uom),
  female_feedtype:tbl_feedtype!fk_tbl_growing_female_feedtype(description,uom)
`;

const growingHistorySelect = `
  *,
  placement:tbl_placement!fk_tbl_growing_placement!inner(
    id,
    placement_date,
    dr_no,
    farm_id,
    farm_name,
    building_no,
    pen_no,
    f_endingbalance,
    m_endingbalance
  ),
  male_feedtype:tbl_feedtype!fk_tbl_growing_male_feedtype(description,uom),
  female_feedtype:tbl_feedtype!fk_tbl_growing_female_feedtype(description,uom)
`;

export async function listGrowings() {
  const { data, error } = await db
    .from(GROWING_TABLE)
    .select(growingSelect)
    .eq("isactive", true)
    .order("daterec", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Growing[];
}

export async function listGrowingHistoryByFarm(params: {
  farmId?: number | null;
  farmName?: string | null;
}) {
  let query = db
    .from(GROWING_TABLE)
    .select(growingHistorySelect)
    .eq("isactive", true)
    .order("daterec", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);

  if (params.farmId) {
    query = query.eq("placement.farm_id", params.farmId);
  } else if (params.farmName) {
    query = query.eq("placement.farm_name", params.farmName);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Growing[];
}

export async function getGrowingById(id: number) {
  const { data, error } = await db
    .from(GROWING_TABLE)
    .select(growingSelect)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Growing;
}

export async function createGrowing(payload: GrowingInsert) {
  const { data, error } = await db
    .from(GROWING_TABLE)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as Growing;
}

export async function updateGrowing(id: number, payload: GrowingUpdate) {
  const { data, error } = await db
    .from(GROWING_TABLE)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Growing;
}

export async function deleteGrowing(id: number) {
  const { error } = await db
    .from(GROWING_TABLE)
    .update({
      isactive: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
  return true;
}

export async function listFeedTypes() {
  const { data, error } = await db
    .from(FEEDTYPE_TABLE)
    .select("id, description, uom, isactive")
    .eq("isactive", true)
    .order("description", { ascending: true });

  if (error) throw error;
  return (data ?? []) as FeedType[];
}

export async function listGrowingPlacements() {
  const { data, error } = await db
    .from(PLACEMENT_TABLE)
    .select(
      "id, placement_date, dr_no, farm_id, farm_name, building_no, pen_no, f_endingbalance, m_endingbalance",
    )
    .order("placement_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw error;
  return (data ?? []) as GrowingPlacement[];
}

export async function getGrowingPlacementById(id: number) {
  const { data, error } = await db
    .from(PLACEMENT_TABLE)
    .select(
      "id, placement_date, dr_no, farm_id, farm_name, building_no, pen_no, f_endingbalance, m_endingbalance",
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as GrowingPlacement;
}
