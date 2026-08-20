import { db } from "@/lib/Supabase/supabaseClient";
import { DefaultFarm } from "@/lib/types";

const TABLE = "tbl_placement";
const GROWING_TABLE = "tbl_growing";
const EGG_LAYING_TABLE = "tbl_egglaying";
const BREEDER_SOURCE_TABLE = "tbl_breeder_source";
const BREEDER_FARM_VIEW = "view_breeder_farm";
const FARM_LOCATION_LOOKUP_VIEW = "view_farm_new_lookup";
const FARM_PEN_TABLE = "i_warehouse";
const BREEDER_CYCLE_TABLE = "tbl_breeder_cycle";

export type FarmLocationLookup = {
  farm_id: number;
  farm_code: string | null;
  farm_name: string;
  farm_type: string | null;
  building_id: number;
  building_type: string | null;
  building_code: string | null;
  building_name: string;
  building_capacity: number | null;
  pen_id: number;
  pen_code: string | null;
  pen_name: string;
  pen_type: string | null;
  pen_capacity: number | null;
  warehouse_type: string | null;
  /** Compatibility alias used by tbl_placement and the existing placement form. */
  pen_no: string;
  /** Compatibility alias used by tbl_placement and the existing placement form. */
  building_no: string;
};

export type BreederFarm = {
  id: number;
  code: string;
  name: string;
};

export type BreederCycle = {
  id: number;
  farm_id: number;
  building_id: number;
  pen_id: number;
  cycle_no: number;
  status: string;
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
  f_avg_bodyw: number | null;
  m_avg_bodyw: number | null;
  remarks: string | null;
  cycle_id?: number | null;
  cycle_no?: number | null;
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
  | "f_avg_bodyw"
  | "m_avg_bodyw"
  | "remarks"
  | "cycle_id"
>;

export type PlacementUpdate = Partial<PlacementInsert>;

export type BuildingHistoryRow = {
  key: string;
  farm_id: number;
  building_id: number;
  building_name: string;
  placement_date: string;
  cycle_no: number | null;
  total_placement: number;
  doa: number;
  rejects: number;
  short_count: number;
  total_birds: number;
  total_egg_production: number;
  total_mortality: number;
  culls: number;
  kitchen: number;
  condem: number;
  total_cleanup: number;
};

async function withCycleNumbers(placements: Placement[]) {
  const cycleIds = Array.from(
    new Set(
      placements
        .map((placement) => Number(placement.cycle_id ?? 0))
        .filter((cycleId) => cycleId > 0),
    ),
  );
  if (!cycleIds.length) return placements;

  const { data, error } = await db
    .from(BREEDER_CYCLE_TABLE)
    .select("id, cycle_no")
    .in("id", cycleIds);
  if (error) throw error;

  const cycleNumberById = new Map(
    (data ?? []).map((cycle) => [Number(cycle.id), Number(cycle.cycle_no)]),
  );
  return placements.map((placement) => ({
    ...placement,
    cycle_no: placement.cycle_id
      ? cycleNumberById.get(Number(placement.cycle_id)) ?? null
      : null,
  }));
}

export async function listPlacements() {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("id", { ascending: false });
  if (error) throw error;
  return withCycleNumbers((data ?? []) as Placement[]);
}

export async function listBreederCycles() {
  const { data, error } = await db
    .from(BREEDER_CYCLE_TABLE)
    .select("id, farm_id, building_id, pen_id, cycle_no, status")
    .order("cycle_no", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BreederCycle[];
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function placementBirds(placement: Placement) {
  const female =
    placement.f_endingbalance ??
    placement.f_beg - placement.f_doa - placement.f_reject - placement.f_shortcount;
  const male =
    placement.m_endingbalance ??
    placement.m_beg - placement.m_doa - placement.m_reject - placement.m_shortcount;
  return numeric(female) + numeric(male);
}

export async function listBuildingHistory(placements: Placement[]) {
  const placementIds = placements.map((placement) => placement.id);
  const cycleIds = Array.from(
    new Set(
      placements
        .map((placement) => Number(placement.cycle_id ?? 0))
        .filter((cycleId) => cycleId > 0),
    ),
  );

  const emptyResult = Promise.resolve({ data: [], error: null });
  const [performanceResult, eggResult, cleanupResult] = await Promise.all([
    placementIds.length
      ? db
          .from("tbl_breeder_daily_performance")
          .select(
            "placement_id, mc_male, mc_female, cull_male, cull_female, kitchen_male, kitchen_female, condem_male, condem_female",
          )
          .in("placement_id", placementIds)
          .eq("isactive", true)
      : emptyResult,
    placementIds.length
      ? db
          .from(EGG_LAYING_TABLE)
          .select("placement_id, tep_collection")
          .in("placement_id", placementIds)
          .eq("is_active", true)
      : emptyResult,
    cycleIds.length
      ? db
          .from("tbl_breeder_cleanup")
          .select("cycle_id, female_cleanup_qty, male_cleanup_qty")
          .in("cycle_id", cycleIds)
      : emptyResult,
  ]);

  if (performanceResult.error) throw performanceResult.error;
  if (eggResult.error) throw eggResult.error;
  if (cleanupResult.error) throw cleanupResult.error;

  const history = new Map<string, BuildingHistoryRow>();
  const groupKeyByPlacementId = new Map<number, string>();
  const groupKeyByCycleId = new Map<number, string>();

  placements.forEach((placement) => {
    const key =
      placement.cycle_no == null
        ? `${placement.farm_id}:${placement.building_id}:none:${placement.placement_date}`
        : `${placement.farm_id}:${placement.building_id}:cycle:${placement.cycle_no}`;
    const row = history.get(key) ?? {
      key,
      farm_id: placement.farm_id,
      building_id: placement.building_id,
      building_name: placement.building_no,
      placement_date: placement.placement_date,
      cycle_no: placement.cycle_no ?? null,
      total_placement: 0,
      doa: 0,
      rejects: 0,
      short_count: 0,
      total_birds: 0,
      total_egg_production: 0,
      total_mortality: 0,
      culls: 0,
      kitchen: 0,
      condem: 0,
      total_cleanup: 0,
    };
    if (placement.placement_date < row.placement_date) {
      row.placement_date = placement.placement_date;
    }
    row.total_placement += numeric(placement.f_beg) + numeric(placement.m_beg);
    row.doa += numeric(placement.f_doa) + numeric(placement.m_doa);
    row.rejects += numeric(placement.f_reject) + numeric(placement.m_reject);
    row.short_count += numeric(placement.f_shortcount) + numeric(placement.m_shortcount);
    row.total_birds += placementBirds(placement);
    history.set(key, row);
    groupKeyByPlacementId.set(placement.id, key);
    if (placement.cycle_id) {
      groupKeyByCycleId.set(Number(placement.cycle_id), key);
    }
  });

  (performanceResult.data ?? []).forEach((record) => {
    const key = groupKeyByPlacementId.get(Number(record.placement_id));
    const row = key ? history.get(key) : undefined;
    if (!row) return;
    row.total_mortality += numeric(record.mc_male) + numeric(record.mc_female);
    row.culls += numeric(record.cull_male) + numeric(record.cull_female);
    row.kitchen += numeric(record.kitchen_male) + numeric(record.kitchen_female);
    row.condem += numeric(record.condem_male) + numeric(record.condem_female);
  });

  (eggResult.data ?? []).forEach((record) => {
    const key = groupKeyByPlacementId.get(Number(record.placement_id));
    const row = key ? history.get(key) : undefined;
    if (row) row.total_egg_production += numeric(record.tep_collection);
  });

  (cleanupResult.data ?? []).forEach((record) => {
    const key = groupKeyByCycleId.get(Number(record.cycle_id));
    const row = key ? history.get(key) : undefined;
    if (row) {
      row.total_cleanup +=
        numeric(record.female_cleanup_qty) + numeric(record.male_cleanup_qty);
    }
  });

  return Array.from(history.values()).sort(
    (left, right) =>
      right.placement_date.localeCompare(left.placement_date) ||
      left.building_name.localeCompare(right.building_name, undefined, {
        numeric: true,
      }) ||
      numeric(right.cycle_no) - numeric(left.cycle_no),
  );
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
  return withCycleNumbers((data ?? []) as Placement[]);
}

export async function ensureBreederCycles(input: {
  farmId: number;
  buildingId: number;
  penIds: number[];
  cycleNumber: number;
}) {
  const penIds = Array.from(new Set(input.penIds));
  const { data: existing, error: existingError } = await db
    .from(BREEDER_CYCLE_TABLE)
    .select("id, pen_id")
    .eq("farm_id", input.farmId)
    .eq("building_id", input.buildingId)
    .eq("cycle_no", input.cycleNumber)
    .in("pen_id", penIds);
  if (existingError) throw existingError;

  const cycleIdByPenId = new Map(
    (existing ?? []).map((cycle) => [Number(cycle.pen_id), Number(cycle.id)]),
  );
  const missingPenIds = penIds.filter((penId) => !cycleIdByPenId.has(penId));
  if (missingPenIds.length) {
    const { data: created, error: createError } = await db
      .from(BREEDER_CYCLE_TABLE)
      .insert(
        missingPenIds.map((penId) => ({
          farm_id: input.farmId,
          building_id: input.buildingId,
          pen_id: penId,
          cycle_no: input.cycleNumber,
          status: "Active",
        })),
      )
      .select("id, pen_id");
    if (createError) throw createError;
    (created ?? []).forEach((cycle) =>
      cycleIdByPenId.set(Number(cycle.pen_id), Number(cycle.id)),
    );
  }

  return cycleIdByPenId;
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
  const [placement] = await withCycleNumbers([data as Placement]);
  return placement;
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
      "farm_id, farm_code, farm_name, farm_type, building_id, building_type, building_code, building_name, building_capacity, pen_id, pen_type, pen_code, pen_name, pen_capacity, warehouse_type",
    )
    .order("farm_name", { ascending: true })
    .order("building_name", { ascending: true })
    .order("pen_name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    // tbl_placement still stores these values as building_no and pen_no.
    building_no: row.building_name ?? "",
    pen_no: row.pen_name ?? "",
  })) as FarmLocationLookup[];
}

export async function listBreederFarms() {
  const { data, error } = await db
    .from(BREEDER_FARM_VIEW)
    .select("id, code, name")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as BreederFarm[];
}

export async function createFarmPen({ buildingId, penNo }: CreateFarmPenInput) {
  const normalizedPenNo = String(Number(penNo));
  const { data: existingPens, error: existingPensError } = await db
    .from(FARM_PEN_TABLE)
    .select("whse_name")
    .eq("warehouse_type", "Pen")
    .eq("father_id", buildingId);

  if (existingPensError) throw existingPensError;

  const duplicate = (existingPens ?? []).some((pen) => {
    const existingPenNo = String(pen.whse_name ?? "").trim();
    return /^\d+$/.test(existingPenNo)
      ? String(Number(existingPenNo)) === normalizedPenNo
      : existingPenNo === normalizedPenNo;
  });

  if (duplicate) {
    throw new Error(`Pen ${normalizedPenNo} already exists for this building.`);
  }

  const { data, error } = await db
    .from(FARM_PEN_TABLE)
    .insert({
      father_id: buildingId,
      whse_name: normalizedPenNo,
      fms_type: "Breeder",
      warehouse_type: "Pen",
      is_active: true,
    })
    .select("id, father_id, whse_code, whse_name, fms_type, warehouse_type, is_active")
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
