import { db } from "@/lib/Supabase/supabaseClient";
import { DefaultFarm } from "@/lib/types";

const TABLE = "tbl_placement";
const GROWING_TABLE = "tbl_growing";
const EGG_LAYING_TABLE = "tbl_egglaying";
const BREEDER_SOURCE_TABLE = "tbl_breeder_source";
const BREEDER_FARM_VIEW = "view_breeder_farm";
const FARM_LOCATION_LOOKUP_VIEW = "view_farm_location_lookup";
const FARM_PEN_TABLE = "farm_pens";
const LAST_PEN_CODE_VIEW = "v_last_pen_code";

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

export type BreederFarm = {
  id: number;
  code: string;
  name: string;
};

export type CreateFarmPenInput = {
  buildingId: number;
  penNo: string;
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
  farm_id: number;
  building_id: number;
  pen_id: number;
  farm_name: string;
  building_no: string;
  pen_no: string;
  f_source: string | null;
  f_beg: number;
  f_doa: number;
  f_reject: number;
  f_shortcount: number;
  f_endingbalance: number | null;
  f_remarks: string | null;
  m_source: string | null;
  m_beg: number;
  m_doa: number;
  m_reject: number;
  m_shortcount: number;
  m_endingbalance: number | null;
  m_remarks: string | null;
  avg_bodyw: number | null;
  remarks: string | null;
};

export type PlacementInsert = Pick<
  Placement,
  | "placement_date"
  | "dr_no"
  | "file_attached"
  | "farm_id"
  | "building_id"
  | "pen_id"
  | "farm_name"
  | "building_no"
  | "pen_no"
  | "f_source"
  | "f_beg"
  | "f_doa"
  | "f_reject"
  | "f_shortcount"
  | "m_source"
  | "m_beg"
  | "m_doa"
  | "m_reject"
  | "m_shortcount"
  | "avg_bodyw"
  | "remarks"
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

export async function listPlacementHistory(params: {
  farmId: number;
  buildingId: number;
}) {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("farm_id", params.farmId)
    .eq("building_id", params.buildingId)
    .order("placement_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Placement[];
}

export async function listPlacementIdsWithGrowingOrLaying() {
  const results = await Promise.allSettled([
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

  for (const result of results) {
    if (result.status === "rejected" || result.value.error) return null;
  }

  const rows = results.flatMap((result) => {
    if (result.status === "rejected") return [];
    return result.value.data ?? [];
  });

  return Array.from(
    new Set(
      rows
        .map((row) => row.placement_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  );
}

export async function placementHasGrowingOrLaying(id: number) {
  const results = await Promise.allSettled([
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

  if (
    results.some(
      (result) => result.status === "rejected" || Boolean(result.value.error),
    )
  ) {
    return true;
  }

  return results.some(
    (result) =>
      result.status === "fulfilled" && Boolean(result.value.data?.length),
  );
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
    .select("breeder_source, is_active")
    .order("breeder_source", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    breeder_source: string | null;
    is_active: boolean | number | string | null;
  }>;
  const activeRows = rows.filter((row) => {
    const status = String(row.is_active ?? "")
      .trim()
      .toLowerCase();
    return row.is_active === true || status === "1" || status === "active";
  });
  const configuredSources = (activeRows.length ? activeRows : rows)
    .map((row) => row.breeder_source?.trim())
    .filter((source): source is string => Boolean(source));

  if (configuredSources.length) {
    return Array.from(new Set(configuredSources));
  }

  const { data: placementSources, error: placementSourcesError } = await db
    .from(TABLE)
    .select("f_source, m_source");

  if (placementSourcesError) throw placementSourcesError;

  return Array.from(
    new Set(
      (placementSources ?? [])
        .flatMap((row) => [row.f_source, row.m_source])
        .map((source) => source?.trim())
        .filter((source): source is string => Boolean(source)),
    ),
  ).sort((left, right) => left.localeCompare(right));
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

export async function listBreederFarms() {
  const { data, error } = await db
    .from(BREEDER_FARM_VIEW)
    .select("id, code, name")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as BreederFarm[];
}

function formatCode(prefix: string, number: number, pad: number = 6) {
  return `${prefix}${number.toString().padStart(pad, "0")}`;
}

async function getLastPenCodeNumber() {
  const { data, error } = await db
    .from(LAST_PEN_CODE_VIEW)
    .select("last_number")
    .single();

  if (error) throw error;
  return Number(data?.last_number ?? 0);
}

export async function createFarmPen({ buildingId, penNo }: CreateFarmPenInput) {
  const normalizedPenNo = String(Number(penNo));
  const { data: existingPens, error: existingPensError } = await db
    .from(FARM_PEN_TABLE)
    .select("name")
    .eq("building_id", buildingId);

  if (existingPensError) throw existingPensError;

  const duplicate = (existingPens ?? []).some((pen) => {
    const existingPenNo = String(pen.name ?? "").trim();
    return /^\d+$/.test(existingPenNo)
      ? String(Number(existingPenNo)) === normalizedPenNo
      : existingPenNo === normalizedPenNo;
  });

  if (duplicate) {
    throw new Error(`Pen ${normalizedPenNo} already exists for this building.`);
  }

  const nextCode = formatCode("PEN", (await getLastPenCodeNumber()) + 1);

  const { data, error } = await db
    .from(FARM_PEN_TABLE)
    .insert({
      building_id: buildingId,
      code: nextCode,
      name: normalizedPenNo,
      status: "Active",
    })
    .select("id, building_id, code, name, status")
    .single();

  if (error) throw error;
  return data;
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
