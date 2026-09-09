import { db } from "@/lib/Supabase/supabaseClient";

export type FlockCardReportLine = {
  id: number;
  age: number;
  mortalityAm: number;
  mortalityPm: number;
  mortalityTotal: number;
  thinningAm: number;
  thinningPm: number;
  thinningTotal: number;
  depletionTotal: number;
  cumulativeDepletion: number;
  feedKg: number;
  feedBird: number;
  feedGuideline: number;
  waterL: number;
  waterBird: number;
  bodyWeight: number;
  bodyGuideline: number;
  tempMin: number;
  tempMax: number;
  humidityMin: number;
  humidityMax: number;
  nh3Max: number;
};

export type FlockCardReport = {
  id: number | null;
  fcNo: string;
  cardNo: string;
  farmName: string;
  farmCode: string;
  houseName: string;
  houseCode: string;
  breed: string;
  placementDate: string;
  startingPopulation: number;
  currentAge: number;
  currentLiveBirds: number;
  reportFrom: string;
  reportTo: string;
  status: string;
  standardDepletionRate: number;
  lines: FlockCardReportLine[];
};

export type FlockCardReportCardOption = {
  code: string;
  name: string;
  startDate: string;
  flockCode: string;
  breed: string;
  animalQty: number;
};

type ReportParams = {
  fcId?: number | null;
  cardNo?: string | null;
  ageFrom?: number | null;
  ageTo?: number | null;
};

type SupabaseErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

type DailyHeaderRow = {
  id: number;
  fc_no: string | null;
  card_no: string | null;
  farm_id: number | null;
  farm_code: string | null;
  farm_name: string | null;
  building_code: string | null;
  building_name: string | null;
  animal_qty: number | null;
  status: string | null;
};

type PlacementHeaderRow = {
  id: number;
  card_no: string | null;
  farm_code: string | null;
  farm_name: string | null;
  building_code: string | null;
  building_name: string | null;
  start_date: string | null;
  breed: string | null;
  animal_qty: number | null;
  status: string | null;
};

type OriginCountRow = {
  animal_qty: number | null;
};

type PlacementCardOptionRow = {
  card_no: string | null;
  flock_code: string | null;
  start_date: string | null;
  breed: string | null;
  animal_qty: number | null;
};

type DailyLineRow = {
  id: number;
  age: number | null;
  mort_am: number | null;
  mort_pm: number | null;
  mort_total: number | null;
  thin_am: number | null;
  thin_pm: number | null;
  row_total: number | null;
  cum_total: number | null;
  feed_kg: number | null;
  feed_bird: number | null;
  feed_guideline: number | null;
  water_l: number | null;
  water_bird: number | null;
  body_wt: number | null;
  body_guideline: number | null;
  temp_min: number | null;
  temp_max: number | null;
  hum_min: number | null;
  hum_max: number | null;
  nh3_max: number | null;
};

const STANDARD_DEPLETION_RATE = 1.05;

function throwDbError(error: unknown, context: string): never {
  if (error instanceof Error) {
    throw new Error(`${context}: ${error.message}`);
  }

  if (error && typeof error === "object") {
    const dbError = error as SupabaseErrorLike;
    const details = [
      dbError.message,
      dbError.details,
      dbError.hint,
      dbError.code ? `code: ${dbError.code}` : "",
    ].filter(Boolean).join(" ");

    throw new Error(details ? `${context}: ${details}` : context);
  }

  throw new Error(`${context}: ${String(error ?? "Unknown error")}`);
}

function toNumber(value: number | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function addDays(dateText: string, days: number) {
  if (!dateText) return "";

  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function calculateAge(startDate: string) {
  if (!startDate) return 0;

  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;

  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = localToday.getTime() - start.getTime();

  return Math.min(Math.max(0, Math.floor(diffMs / 86400000)), 45);
}

async function getDailyHeader(params: ReportParams) {
  const fcId = Number(params.fcId ?? 0);
  const cardNo = params.cardNo?.trim() ?? "";

  if (Number.isFinite(fcId) && fcId > 0) {
    const result = await db
      .from("brd_fc")
      .select("id, fc_no, card_no, farm_id, farm_code, farm_name, building_code, building_name, animal_qty, status")
      .eq("id", fcId)
      .eq("void", "1")
      .maybeSingle();

    if (result.error) throwDbError(result.error, "Unable to load flock card report header");
    return result.data as DailyHeaderRow | null;
  }

  if (!cardNo) return null;

  const result = await db
    .from("brd_fc")
    .select("id, fc_no, card_no, farm_id, farm_code, farm_name, building_code, building_name, animal_qty, status")
    .eq("card_no", cardNo)
    .eq("void", "1")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throwDbError(result.error, "Unable to load flock card report header");
  return result.data as DailyHeaderRow | null;
}

async function getPlacementHeader(cardNo: string) {
  if (!cardNo) return null;

  const result = await db
    .from("flock_card")
    .select("id, card_no, farm_code, farm_name, building_code, building_name, start_date, breed, animal_qty, status")
    .eq("card_no", cardNo)
    .eq("void", "1")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throwDbError(result.error, "Unable to load placement information");
  return result.data as PlacementHeaderRow | null;
}

async function getPlacementOriginCount(placementId: number) {
  if (!Number.isFinite(placementId) || placementId <= 0) return 0;

  const result = await db
    .from("flock_card_origin")
    .select("animal_qty")
    .eq("fc_id", placementId)
    .eq("void", "1");

  if (result.error) throwDbError(result.error, "Unable to load placement origin population");

  return ((result.data ?? []) as OriginCountRow[]).reduce(
    (sum, row) => sum + toNumber(row.animal_qty),
    0,
  );
}

export async function getFlockCardReportCardOptions(params: {
  farmId?: number | null;
  buildingKey?: string | null;
  buildingId?: number | null;
  buildingCode?: string | null;
}): Promise<FlockCardReportCardOption[]> {
  const farmId = Number(params.farmId ?? 0);
  if (!Number.isFinite(farmId) || farmId <= 0) return [];

  const buildingKey = String(params.buildingKey ?? "").trim();
  const buildingId = Number(params.buildingId ?? 0);
  const buildingCode = String(params.buildingCode ?? "").trim();

  let query = db
    .from("flock_card")
    .select("card_no, flock_code, start_date, breed, animal_qty")
    .eq("farm_id", farmId)
    .eq("void", "1")
    .eq("status", "Saved")
    .not("card_no", "is", null);

  if (buildingKey.startsWith("warehouse:")) {
    const warehouseId = Number(buildingKey.split(":")[1] ?? 0);
    if (Number.isFinite(warehouseId) && warehouseId > 0) {
      query = query.eq("building_whse_id", warehouseId);
    }
  } else if (buildingKey.startsWith("building:")) {
    const farmBuildingId = Number(buildingKey.split(":")[1] ?? 0);
    if (Number.isFinite(farmBuildingId) && farmBuildingId > 0) {
      query = query.eq("building_id", farmBuildingId);
    }
  } else if (buildingKey) {
    query = query.eq("building_key", buildingKey);
  } else if (Number.isFinite(buildingId) && buildingId > 0) {
    query = query.eq("building_id", buildingId);
  } else if (buildingCode) {
    query = query.eq("building_code", buildingCode);
  }

  const result = await query
    .order("start_date", { ascending: false })
    .order("card_no", { ascending: true });

  if (result.error) throwDbError(result.error, "Unable to load flock card report options");

  const seen = new Set<string>();

  return ((result.data ?? []) as PlacementCardOptionRow[]).flatMap(row => {
    const cardNo = String(row.card_no ?? "").trim();
    if (!cardNo || seen.has(cardNo)) return [];
    seen.add(cardNo);

    const startDate = String(row.start_date ?? "").trim();
    const flockCode = String(row.flock_code ?? "").trim();
    const breed = String(row.breed ?? "").trim();
    const population = toNumber(row.animal_qty);
    const labelParts = [
      flockCode && flockCode !== cardNo ? flockCode : "",
      startDate,
      breed,
      population > 0 ? population.toLocaleString("en-PH") : "",
    ].filter(Boolean);

    return [{
      code: cardNo,
      name: labelParts.length > 0 ? `${cardNo} - ${labelParts.join(" | ")}` : cardNo,
      startDate,
      flockCode,
      breed,
      animalQty: population,
    }];
  });
}

async function getDailyLines(fcId: number, ageFrom?: number | null, ageTo?: number | null) {
  if (!Number.isFinite(fcId) || fcId <= 0) return [];

  let query = db
    .from("brd_fc_line")
    .select("id, age, mort_am, mort_pm, mort_total, thin_am, thin_pm, row_total, cum_total, feed_kg, feed_bird, feed_guideline, water_l, water_bird, body_wt, body_guideline, temp_min, temp_max, hum_min, hum_max, nh3_max")
    .eq("fc_id", fcId)
    .eq("void", "1")
    .lte("age", 45);

  if (Number.isFinite(Number(ageFrom))) {
    query = query.gte("age", Number(ageFrom));
  }

  if (Number.isFinite(Number(ageTo))) {
    query = query.lte("age", Number(ageTo));
  }

  const result = await query.order("age", { ascending: true });

  if (result.error) throwDbError(result.error, "Unable to load flock card report lines");

  return ((result.data ?? []) as DailyLineRow[]).map(line => {
    const mortalityTotal = toNumber(line.mort_total) || toNumber(line.mort_am) + toNumber(line.mort_pm);
    const thinningTotal = toNumber(line.thin_am) + toNumber(line.thin_pm);
    const depletionTotal = toNumber(line.row_total) || mortalityTotal + thinningTotal;

    return {
      id: Number(line.id),
      age: Number(line.age ?? 0),
      mortalityAm: toNumber(line.mort_am),
      mortalityPm: toNumber(line.mort_pm),
      mortalityTotal,
      thinningAm: toNumber(line.thin_am),
      thinningPm: toNumber(line.thin_pm),
      thinningTotal,
      depletionTotal,
      cumulativeDepletion: toNumber(line.cum_total),
      feedKg: toNumber(line.feed_kg),
      feedBird: toNumber(line.feed_bird),
      feedGuideline: toNumber(line.feed_guideline),
      waterL: toNumber(line.water_l),
      waterBird: toNumber(line.water_bird),
      bodyWeight: toNumber(line.body_wt),
      bodyGuideline: toNumber(line.body_guideline),
      tempMin: toNumber(line.temp_min),
      tempMax: toNumber(line.temp_max),
      humidityMin: toNumber(line.hum_min),
      humidityMax: toNumber(line.hum_max),
      nh3Max: toNumber(line.nh3_max),
    };
  });
}

async function getLatestDailyLineAge(fcId: number) {
  if (!Number.isFinite(fcId) || fcId <= 0) return null;

  const result = await db
    .from("brd_fc_line")
    .select("age")
    .eq("fc_id", fcId)
    .eq("void", "1")
    .order("age", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throwDbError(result.error, "Unable to load latest flock card age");

  const age = Number(result.data?.age);
  return Number.isFinite(age) ? age : null;
}

export async function getFlockCardReport(params: ReportParams): Promise<FlockCardReport | null> {
  const dailyHeader = await getDailyHeader(params);
  const cardNo = String(dailyHeader?.card_no ?? params.cardNo ?? "").trim();
  const placement = await getPlacementHeader(cardNo);

  if (!dailyHeader && !placement) return null;

  const lines = dailyHeader
    ? await getDailyLines(Number(dailyHeader.id), params.ageFrom, params.ageTo)
    : [];
  const latestSavedAge = dailyHeader
    ? await getLatestDailyLineAge(Number(dailyHeader.id))
    : null;
  const originCount = placement ? await getPlacementOriginCount(Number(placement.id)) : 0;
  const startingPopulation = originCount || toNumber(dailyHeader?.animal_qty) || toNumber(placement?.animal_qty);
  const totalDepletion = lines.reduce((sum, line) => sum + line.depletionTotal, 0);
  const latestAge = Math.min(latestSavedAge ?? calculateAge(String(placement?.start_date ?? "")), 45);
  const reportFromAge = lines[0]?.age ?? 0;
  const reportToAge = lines[lines.length - 1]?.age ?? latestAge;
  const placementDate = String(placement?.start_date ?? "");

  return {
    id: dailyHeader ? Number(dailyHeader.id) : null,
    fcNo: String(dailyHeader?.fc_no ?? ""),
    cardNo,
    farmName: String(dailyHeader?.farm_name ?? placement?.farm_name ?? ""),
    farmCode: String(dailyHeader?.farm_code ?? placement?.farm_code ?? ""),
    houseName: String(dailyHeader?.building_name ?? placement?.building_name ?? ""),
    houseCode: String(dailyHeader?.building_code ?? placement?.building_code ?? ""),
    breed: String(placement?.breed ?? ""),
    placementDate,
    startingPopulation,
    currentAge: latestAge,
    currentLiveBirds: Math.max(0, startingPopulation - totalDepletion),
    reportFrom: addDays(placementDate, reportFromAge),
    reportTo: addDays(placementDate, reportToAge),
    status: String(dailyHeader?.status ?? placement?.status ?? ""),
    standardDepletionRate: STANDARD_DEPLETION_RATE,
    lines,
  };
}
