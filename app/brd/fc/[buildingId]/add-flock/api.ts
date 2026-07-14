import { db } from "@/lib/Supabase/supabaseClient";

export type FlockCardOriginPayload = {
  lineNo: number;
  itemId?: number | null;
  itemCode?: string | null;
  itemName?: string | null;
  batchNo: string;
  warehouseId?: number | null;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  grOrigin?: string | null;
  animalQty: number;
  onHandSnapshot?: number | null;
  breed?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  extra?: Record<string, unknown>;
};

export type FlockCardPlacementPayload = {
  id?: number | null;
  cardNo?: string | null;
  farmId?: number | null;
  farmCode?: string | null;
  farmName?: string | null;
  buildingId?: number | null;
  buildingWarehouseId?: number | null;
  buildingSource?: string | null;
  buildingKey?: string | null;
  buildingCode?: string | null;
  buildingName?: string | null;
  age: number;
  startDate: string;
  broilerType?: string | null;
  breed?: string | null;
  guideline?: string | null;
  coccidiostatProgramId?: string | null;
  otherProgramId?: string | null;
  vaccinationProgramId?: string | null;
  flockCode?: string | null;
  trialCode?: string | null;
  cycleNumber?: string | null;
  animalQty: number;
  feedMill?: string | null;
  stockingDensity?: number | null;
  stockingDensityByWeight?: number | null;
  sex?: string | null;
  remarks?: string | null;
  extra?: Record<string, unknown>;
  origins: FlockCardOriginPayload[];
};

export type SavedFlockCardPlacement = {
  id: number;
  cardNo: string;
};

export type FlockCardPlacementRecord = FlockCardPlacementPayload & {
  id: number;
  cardNo: string;
};

export type UsedFlockOriginBatch = {
  id: string;
  itemCode: string;
  batchNo: string;
  warehouseCode: string;
  cardId: number;
  buildingId: number | null;
  buildingWarehouseId: number | null;
  buildingKey: string | null;
  buildingCode: string | null;
};

type FlockCardHeaderRow = {
  id: number;
  card_no: string | null;
  farm_id: number | null;
  farm_code: string | null;
  farm_name: string | null;
  building_id: number | null;
  building_whse_id: number | null;
  building_src: string | null;
  building_key: string | null;
  building_code: string | null;
  building_name: string | null;
  age: number | null;
  start_date: string | null;
  broiler_type: string | null;
  breed: string | null;
  guideline: string | null;
  cocci_prg_id: string | null;
  other_prg_id: string | null;
  vacc_prg_id: string | null;
  flock_code: string | null;
  trial_code: string | null;
  cycle_no: string | null;
  animal_qty: number | null;
  feedmill: string | null;
  stock_density: number | null;
  stock_density_wt: number | null;
  sex: string | null;
  remarks: string | null;
  extra: Record<string, unknown> | null;
};

type FlockCardOriginRow = {
  line_no: number | null;
  item_id: number | null;
  item_code: string | null;
  item_name: string | null;
  batch_no: string | null;
  whse_id: number | null;
  whse_code: string | null;
  whse_name: string | null;
  gr_origin: string | null;
  animal_qty: number | null;
  onhand_snapshot: number | null;
  breed: string | null;
  mfg_date: string | null;
  exp_date: string | null;
  extra: Record<string, unknown> | null;
};

type FlockCardBatchUsageHeaderRow = {
  id: number;
  building_id: number | null;
  building_whse_id: number | null;
  building_key: string | null;
  building_code: string | null;
};

type FlockCardBatchUsageOriginRow = {
  fc_id: number | null;
  item_code: string | null;
  batch_no: string | null;
  whse_code: string | null;
};

type SupabaseErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

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

    // throw new Error(details ? `${context}: ${details}` : context);
  }

  throw new Error(`${context}: ${String(error ?? "Unknown error")}`);
}

function nextCardNo() {
  const now = new Date();
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");

  return [
    "FLOCK",
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    pad(now.getMilliseconds(), 3),
  ].join("");
}

async function getSessionUserId() {
  const { data, error } = await db.auth.getSession();
  if (error) throwDbError(error, "Unable to read current session");

  return data.session?.user.id ?? null;
}

function toNumberOrNull(value: number | string | null | undefined) {
  if (value == null) return null;

  const numericValue = Number(String(value).replaceAll(",", "").trim());
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toDateOrNull(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text || null;
}

function placementPayloadToRow(
  payload: FlockCardPlacementPayload,
  userId: string | null,
  cardNo: string,
) {
  return {
    updated_by: userId,
    card_no: cardNo,
    farm_id: payload.farmId ?? null,
    farm_code: payload.farmCode?.trim() || null,
    farm_name: payload.farmName?.trim() || null,
    building_id: payload.buildingId ?? null,
    building_whse_id: payload.buildingWarehouseId ?? null,
    building_src: payload.buildingSource?.trim() || null,
    building_key: payload.buildingKey?.trim() || null,
    building_code: payload.buildingCode?.trim() || null,
    building_name: payload.buildingName?.trim() || null,
    age: toNumberOrNull(payload.age) ?? 0,
    start_date: payload.startDate,
    broiler_type: payload.broilerType?.trim() || null,
    breed: payload.breed?.trim() || null,
    guideline: payload.guideline?.trim() || null,
    cocci_prg_id: payload.coccidiostatProgramId?.trim() || null,
    other_prg_id: payload.otherProgramId?.trim() || null,
    vacc_prg_id: payload.vaccinationProgramId?.trim() || null,
    flock_code: payload.flockCode?.trim() || null,
    trial_code: payload.trialCode?.trim() || null,
    cycle_no: payload.cycleNumber?.trim() || null,
    animal_qty: toNumberOrNull(payload.animalQty) ?? 0,
    feedmill: payload.feedMill?.trim() || null,
    stock_density: toNumberOrNull(payload.stockingDensity),
    stock_density_wt: toNumberOrNull(payload.stockingDensityByWeight),
    sex: payload.sex?.trim() || null,
    remarks: payload.remarks?.trim() || null,
    extra: payload.extra ?? {},
    void: "1",
  };
}

function originPayloadToRow(
  origin: FlockCardOriginPayload,
  fcId: number,
  userId: string | null,
) {
  return {
    created_by: userId,
    updated_by: userId,
    fc_id: fcId,
    line_no: origin.lineNo,
    item_id: origin.itemId ?? null,
    item_code: origin.itemCode?.trim() || null,
    item_name: origin.itemName?.trim() || null,
    batch_no: origin.batchNo.trim(),
    whse_id: origin.warehouseId ?? null,
    whse_code: origin.warehouseCode?.trim() || null,
    whse_name: origin.warehouseName?.trim() || null,
    gr_origin: origin.grOrigin?.trim() || null,
    animal_qty: toNumberOrNull(origin.animalQty) ?? 0,
    onhand_snapshot: toNumberOrNull(origin.onHandSnapshot ?? origin.animalQty) ?? 0,
    breed: origin.breed?.trim() || null,
    mfg_date: toDateOrNull(origin.manufacturingDate),
    exp_date: toDateOrNull(origin.expiryDate),
    extra: origin.extra ?? {},
    void: "1",
  };
}

function hasOriginData(origin: FlockCardOriginPayload) {
  return origin.batchNo.trim() !== "" && (toNumberOrNull(origin.animalQty) ?? 0) > 0;
}

function makeBatchUsageId(itemCode: string, batchNo: string) {
  return [
    itemCode.trim().toUpperCase(),
    batchNo.trim().toUpperCase(),
  ].join("|");
}

export async function getUsedFlockOriginBatches(
  farmId: number,
  currentCardId?: number | null,
): Promise<UsedFlockOriginBatch[]> {
  if (!Number.isFinite(farmId) || farmId <= 0) return [];

  let cardQuery = db
    .from("flock_card")
    .select("id, building_id, building_whse_id, building_key, building_code")
    .eq("farm_id", farmId)
    .eq("void", "1")
    .eq("status", "Saved");

  const currentId = Number(currentCardId ?? 0);
  if (Number.isFinite(currentId) && currentId > 0) {
    cardQuery = cardQuery.neq("id", currentId);
  }

  const cardResult = await cardQuery;

  if (cardResult.error) throwDbError(cardResult.error, "Unable to load used flock cards");

  const cards = (cardResult.data ?? []) as FlockCardBatchUsageHeaderRow[];
  const cardsById = new Map(
    cards
      .map(card => [Number(card.id), card] as const)
      .filter(([id]) => Number.isFinite(id) && id > 0),
  );
  const cardIds = Array.from(cardsById.keys());

  if (cardIds.length === 0) return [];

  const originResult = await db
    .from("flock_card_origin")
    .select("fc_id, item_code, batch_no, whse_code")
    .in("fc_id", cardIds)
    .eq("void", "1");

  if (originResult.error) throwDbError(originResult.error, "Unable to load used flock origins");

  return ((originResult.data ?? []) as FlockCardBatchUsageOriginRow[]).flatMap(origin => {
    const cardId = Number(origin.fc_id ?? 0);
    const card = cardsById.get(cardId);
    const itemCode = String(origin.item_code ?? "").trim();
    const batchNo = String(origin.batch_no ?? "").trim();
    const warehouseCode = String(origin.whse_code ?? "").trim();

    if (!card || !itemCode || !batchNo || !warehouseCode) return [];

    return [{
      id: makeBatchUsageId(itemCode, batchNo),
      itemCode,
      batchNo,
      warehouseCode,
      cardId,
      buildingId: card.building_id,
      buildingWarehouseId: card.building_whse_id,
      buildingKey: card.building_key,
      buildingCode: card.building_code,
    }];
  });
}

export async function getFlockCardPlacement(
  id: number,
): Promise<FlockCardPlacementRecord | null> {
  if (!Number.isFinite(id) || id <= 0) return null;

  const [headerResult, originResult] = await Promise.all([
    db
      .from("flock_card")
      .select("id, card_no, farm_id, farm_code, farm_name, building_id, building_whse_id, building_src, building_key, building_code, building_name, age, start_date, broiler_type, breed, guideline, cocci_prg_id, other_prg_id, vacc_prg_id, flock_code, trial_code, cycle_no, animal_qty, feedmill, stock_density, stock_density_wt, sex, remarks, extra")
      .eq("id", id)
      .eq("void", "1")
      .single(),
    db
      .from("flock_card_origin")
      .select("line_no, item_id, item_code, item_name, batch_no, whse_id, whse_code, whse_name, gr_origin, animal_qty, onhand_snapshot, breed, mfg_date, exp_date, extra")
      .eq("fc_id", id)
      .eq("void", "1")
      .order("line_no", { ascending: true }),
  ]);

  if (headerResult.error) throwDbError(headerResult.error, "Unable to load flock card");
  if (originResult.error) throwDbError(originResult.error, "Unable to load flock origins");
  if (!headerResult.data) return null;

  const header = headerResult.data as FlockCardHeaderRow;
  const origins = ((originResult.data ?? []) as FlockCardOriginRow[]).map(origin => ({
    lineNo: Number(origin.line_no ?? 0),
    itemId: origin.item_id,
    itemCode: origin.item_code,
    itemName: origin.item_name,
    batchNo: String(origin.batch_no ?? ""),
    warehouseId: origin.whse_id,
    warehouseCode: origin.whse_code,
    warehouseName: origin.whse_name,
    grOrigin: origin.gr_origin,
    animalQty: Number(origin.animal_qty ?? 0),
    onHandSnapshot: Number(origin.onhand_snapshot ?? 0),
    breed: origin.breed,
    manufacturingDate: origin.mfg_date,
    expiryDate: origin.exp_date,
    extra: origin.extra ?? {},
  }));

  return {
    id: Number(header.id),
    cardNo: String(header.card_no ?? ""),
    farmId: header.farm_id,
    farmCode: header.farm_code,
    farmName: header.farm_name,
    buildingId: header.building_id,
    buildingWarehouseId: header.building_whse_id,
    buildingSource: header.building_src,
    buildingKey: header.building_key,
    buildingCode: header.building_code,
    buildingName: header.building_name,
    age: Number(header.age ?? 0),
    startDate: String(header.start_date ?? ""),
    broilerType: header.broiler_type,
    breed: header.breed,
    guideline: header.guideline,
    coccidiostatProgramId: header.cocci_prg_id,
    otherProgramId: header.other_prg_id,
    vaccinationProgramId: header.vacc_prg_id,
    flockCode: header.flock_code,
    trialCode: header.trial_code,
    cycleNumber: header.cycle_no,
    animalQty: Number(header.animal_qty ?? 0),
    feedMill: header.feedmill,
    stockingDensity: header.stock_density,
    stockingDensityByWeight: header.stock_density_wt,
    sex: header.sex,
    remarks: header.remarks,
    extra: header.extra ?? {},
    origins,
  };
}

export async function saveFlockCardPlacement(
  payload: FlockCardPlacementPayload,
): Promise<SavedFlockCardPlacement> {
  const userId = await getSessionUserId();
  const cardNo = payload.cardNo?.trim() || nextCardNo();
  const headerPayload = placementPayloadToRow(payload, userId, cardNo);

  let fcId = Number(payload.id ?? 0);
  let savedCardNo = cardNo;

  if (payload.id) {
    const updateHeaderResult = await db
      .from("flock_card")
      .update(headerPayload)
      .eq("id", payload.id)
      .select("id, card_no")
      .maybeSingle();

    if (updateHeaderResult.error) throwDbError(updateHeaderResult.error, "Unable to save flock card");

    if (updateHeaderResult.data) {
      fcId = Number(updateHeaderResult.data.id);
      savedCardNo = String(updateHeaderResult.data.card_no ?? cardNo);
    } else {
      const insertedHeader = await db
        .from("flock_card")
        .insert({ ...headerPayload, created_by: userId })
        .select("id, card_no")
        .single();

      if (insertedHeader.error) throwDbError(insertedHeader.error, "Unable to save flock card");

      fcId = Number(insertedHeader.data.id);
      savedCardNo = String(insertedHeader.data.card_no ?? cardNo);
    }
  } else {
    const savedHeader = await db
      .from("flock_card")
      .insert({ ...headerPayload, created_by: userId })
      .select("id, card_no")
      .single();

    if (savedHeader.error) throwDbError(savedHeader.error, "Unable to save flock card");

    fcId = Number(savedHeader.data.id);
    savedCardNo = String(savedHeader.data.card_no ?? cardNo);
  }

  if (!Number.isFinite(fcId) || fcId <= 0) {
    throw new Error("Unable to save flock card: missing flock card id");
  }

  const hideOriginsResult = await db
    .from("flock_card_origin")
    .update({ void: "0", updated_by: userId })
    .eq("fc_id", fcId)
    .eq("void", "1");

  if (hideOriginsResult.error) throwDbError(hideOriginsResult.error, "Unable to hide old flock origins");

  const originsToSave = payload.origins.filter(hasOriginData);
  if (originsToSave.length > 0) {
    const originRows = originsToSave.map(origin => originPayloadToRow(origin, fcId, userId));
    const savedOriginsResult = await db
      .from("flock_card_origin")
      .insert(originRows);

    if (savedOriginsResult.error) throwDbError(savedOriginsResult.error, "Unable to save flock origins");
  }

  return {
    id: fcId,
    cardNo: savedCardNo,
  };
}
