import { db } from "@/lib/Supabase/supabaseClient";
import { DefaultFarm } from "@/lib/types";

const TABLE = "tbl_placement";
const GROWING_TABLE = "tbl_growing";
const EGG_LAYING_TABLE = "tbl_egglaying";
const BREEDER_SOURCE_TABLE = "tbl_breeder_source";
const FARM_LOCATION_LOOKUP_VIEW = "view_farm_location_lookup";

export type FarmLocationLookup = {
  pen_id: number;
  pen_code: string | null;
  pen_no: string;
  building_id: number;
  building_code: string | null;
  building_no: string;
  farm_id: number;
  farm_code: string | null;
  farm_name: string;
  farm_address: string | null;
  region: string | null;
  assigned_ta: string | null;
  full_location: string;
};

export type Placement = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  placement_date: string;
  dr_no: string;
  file_attached: string | null;
  farm_id: number | null;
  farm_name: string;
  building_no: string;
  pen_no: string;
  f_source: string | null;
  f_beg: number;
  f_doa: number;
  f_reject: number;
  f_shortcount: number;
  f_endingbalance: number | null;
  m_source: string | null;
  m_beg: number;
  m_doa: number;
  m_reject: number;
  m_shortcount: number;
  m_endingbalance: number | null;
  remarks: string | null;
};

export type PlacementInsert = Omit<
  Placement,
  | "id"
  | "created_at"
  | "created_by"
  | "updated_at"
  | "updated_by"
>;

export type PlacementUpdate = Partial<PlacementInsert>;

export async function listPlacements() {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("id", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Placement[];
}

export async function listPlacementIdsWithGrowingOrLaying() {
  const [growingResult, layingResult] = await Promise.all([
    db
      .from(GROWING_TABLE)
      .select("placement_id")
      .eq("isactive", true)
      .not("placement_id", "is", null),
    db
      .from(EGG_LAYING_TABLE)
      .select("placement_id")
      .eq("is_active", true)
      .not("placement_id", "is", null),
  ]);

  if (growingResult.error) throw growingResult.error;
  if (layingResult.error) throw layingResult.error;

  return Array.from(
    new Set(
      [...(growingResult.data ?? []), ...(layingResult.data ?? [])]
        .map((row) => row.placement_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  );
}

export async function placementHasGrowingOrLaying(id: number) {
  const [growingResult, layingResult] = await Promise.all([
    db
      .from(GROWING_TABLE)
      .select("id")
      .eq("placement_id", id)
      .eq("isactive", true)
      .limit(1),
    db
      .from(EGG_LAYING_TABLE)
      .select("id")
      .eq("placement_id", id)
      .eq("is_active", true)
      .limit(1),
  ]);

  if (growingResult.error) throw growingResult.error;
  if (layingResult.error) throw layingResult.error;

  return Boolean(growingResult.data?.length || layingResult.data?.length);
}

export async function getPlacementById(id: number) {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Placement;
}

export async function createPlacement(payload: PlacementInsert) {
  const { data, error } = await db
    .from(TABLE)
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;
  return data as Placement;
}

export async function createPlacementBatch(payloads: PlacementInsert[]) {
  const { data, error } = await db.from(TABLE).insert(payloads).select("*");

  if (error) throw error;
  return (data ?? []) as Placement[];
}

export async function updatePlacement(id: number, payload: PlacementUpdate) {
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
  return data as Placement;
}

export async function deletePlacement(id: number) {
  const { error } = await db.from(TABLE).delete().eq("id", id);

  if (error) throw error;
  return true;
}

export async function listBreederSources() {
  const { data, error } = await db
    .from(BREEDER_SOURCE_TABLE)
    .select("breeder_source")
    .eq("is_active", true)
    .order("breeder_source", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((row: { breeder_source: string | null }) => row.breeder_source?.trim())
    .filter((source): source is string => Boolean(source));
}

export async function listFarmLocationLookup() {
  const { data, error } = await db
    .from(FARM_LOCATION_LOOKUP_VIEW)
    .select(
      "pen_id, pen_code, pen_no, building_id, building_code, building_no, farm_id, farm_code, farm_name, farm_address, region, assigned_ta, full_location",
    )
    .order("farm_name", { ascending: true })
    .order("building_no", { ascending: true })
    .order("pen_no", { ascending: true });

  if (error) throw error;
  return (data ?? []) as FarmLocationLookup[];
}

export async function getUserInfo() {
  const {
    data: { session },
  } = await db.auth.getSession();

  const { data, error } = await db
    .from("vwdmf_user_default_farm")
    .select("*")
    .eq("auth_id", session?.user.id);

  if (error) throw error;
  return data as DefaultFarm[];
}
