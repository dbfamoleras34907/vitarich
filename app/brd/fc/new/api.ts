import { db } from "@/lib/Supabase/supabaseClient";
import { activeApprovedFarmsQuery } from "@/lib/data/repositories/farms";
import { actualAdgColumnIndex } from "./flockCardGridConfig";

export type FeedBatchOnHand = {
  id: string;
  itemCode: string;
  itemName: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  warehouseCode: string;
  onHandQty: number;
};

export type FarmBuildingOption = {
  key: string;
  id: number | null;
  farmId: number;
  code: string;
  name: string;
  status: string;
  remarks: string | null;
  source: "BUILDING" | "WAREHOUSE";
  warehouseCode?: string | null;
};

type AssociatedWarehouseRow = {
  id?: number | null;
  whse_code?: string | null;
  whse_name?: string | null;
  is_default_feed?: boolean | null;
  is_default_disposal?: boolean | null;
};

type WarehouseMasterRow = {
  id: number | null;
  whse_code: string | null;
  whse_name: string | null;
  warehouse_type: string | null;
};

export type FlockCardBatchAllocationPayload = {
  lineNo: number;
  itemId?: number | null;
  itemCode: string;
  itemName?: string | null;
  batchNumber: string;
  warehouseId?: number | null;
  warehouseCode: string;
  warehouseName?: string | null;
  allocatedQty: number;
  onHandSnapshot: number;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  source?: "MANUAL" | "FIFO";
};

export type FlockCardMortalityBatchAllocationPayload = {
  lineNo: number;
  itemCode: string;
  itemName?: string | null;
  batchNumber: string;
  warehouseCode: string;
  allocatedQty: number;
  onHandSnapshot: number;
  source?: "MANUAL" | "FIFO";
};

export type FlockCardLinePayload = {
  id?: number | null;
  age: number;
  values: string[];
  allocations: FlockCardBatchAllocationPayload[];
  mortalityAllocations?: FlockCardMortalityBatchAllocationPayload[];
  feedIntakeLocked?: boolean;
  mortalityThinningLocked?: boolean;
};

export type FlockCardPayload = {
  id?: number | null;
  fcNo?: string | null;
  cardNo?: string | null;
  farmId?: number | null;
  farmCode?: string | null;
  farmName?: string | null;
  buildingId?: number | null;
  buildingWarehouseId?: number | null;
  buildingSource?: FarmBuildingOption["source"] | null;
  buildingKey?: string | null;
  buildingCode?: string | null;
  buildingName?: string | null;
  buildingStatus?: string | null;
  feedWarehouseId?: number | null;
  feedWarehouseCode?: string | null;
  feedWarehouseName?: string | null;
  animalQty: number;
  lines: FlockCardLinePayload[];
};

type PlacementCardLinkRow = {
  card_no: string | null;
};

export type SavedFlockCard = {
  id: number;
  fcNo: string;
  savedLines: Array<{
    id: number;
    age: number;
  }>;
};

export type FlockCardSheetLine = {
  id: number;
  age: number;
  values: string[];
  allocations: Array<{
    batchId: string;
    batchNumber: string;
    itemCode: string;
    itemName: string;
    warehouseCode: string;
    manufacturingDate: string;
    expiryDate: string;
    availableQty: number;
    selectedQty: number;
    source: "MANUAL" | "FIFO";
  }>;
  mortalityAllocations: Array<{
    batchId: string;
    batchNumber: string;
    itemCode: string;
    itemName: string;
    warehouseCode: string;
    availableQty: number;
    selectedQty: number;
    source: "MANUAL" | "FIFO";
  }>;
};

export type FlockCardSheet = {
  id: number;
  fcNo: string;
  cardNo: string | null;
  animalQty: number;
  farmId: number | null;
  buildingId: number | null;
  buildingWarehouseId: number | null;
  buildingKey: string | null;
  lines: FlockCardSheetLine[];
};

type InventoryPostingBatchRow = {
  id: number;
  item_code: string | null;
  warehouse_code: string | null;
  qty: number | null;
  transfer_type: string | null;
  ref: string | null;
  ref2: string | null;
};

type ItemBatchRow = {
  item_code: string;
  batch_number: string;
  manufacturing_date: string | null;
  expiry_date: string | null;
};

type FlockOriginBatchRow = {
  item_code: string | null;
  item_name: string | null;
  batch_no: string | null;
  whse_code: string | null;
  animal_qty: number | null;
  onhand_snapshot: number | null;
};

type FlockOriginCardRow = {
  id: number;
  building_code: string | null;
  building_whse_id: number | null;
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

    throw new Error(details ? `${context}: ${details}` : context);
  }

  throw new Error(`${context}: ${String(error ?? "Unknown error")}`);
}

function parseNumberOrNull(value: string | number | null | undefined) {
  if (value == null) return null;

  const text = String(value).replaceAll(",", "").trim();
  if (!text) return null;

  const numericValue = Number(text);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatDbValue(value: string | number | null | undefined) {
  if (value == null) return "";

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value);

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(6).replace(/\.?0+$/, "");
}

function getFeedBatchAllocationId(itemCode: string, batchNumber: string, warehouseCode: string) {
  return [
    itemCode.trim().toUpperCase(),
    batchNumber.trim().toUpperCase(),
    warehouseCode.trim().toUpperCase(),
  ].join("|");
}

function getMortalityBatchAllocationId(itemCode: string, batchNumber: string, warehouseCode: string) {
  return getFeedBatchAllocationId(itemCode, batchNumber, warehouseCode);
}

function normalizeMortalityAllocations(line: FlockCardLinePayload) {
  return (line.mortalityAllocations ?? []).filter(allocation => Number(allocation.allocatedQty || 0) > 0);
}

function getLineExtra(line: FlockCardLinePayload) {
  const mortalityAllocations = normalizeMortalityAllocations(line);
  const actualAdg = line.values[actualAdgColumnIndex]?.trim() || null;

  return {
    ...(mortalityAllocations.length > 0
      ? {
      mortalityBatchAllocations: mortalityAllocations.map(allocation => ({
        lineNo: allocation.lineNo,
        itemCode: allocation.itemCode,
        itemName: allocation.itemName ?? null,
        batchNumber: allocation.batchNumber,
        warehouseCode: allocation.warehouseCode,
        allocatedQty: allocation.allocatedQty,
        onHandSnapshot: allocation.onHandSnapshot,
        source: allocation.source ?? "MANUAL",
      })),
      }
      : {}),
    ...(actualAdg ? { actualAdg } : {}),
  };
}

function nextFlockCardNo() {
  const now = new Date();
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");

  return [
    "FC",
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

async function findLinkedPlacementCardNo(payload: FlockCardPayload) {
  const providedCardNo = payload.cardNo?.trim();
  if (providedCardNo) return providedCardNo;

  if (payload.id) {
    const existingResult = await db
      .from("brd_fc")
      .select("card_no")
      .eq("id", payload.id)
      .maybeSingle();

    if (existingResult.error) throwDbError(existingResult.error, "Unable to load existing flock card link");

    const existingCardNo = String(existingResult.data?.card_no ?? "").trim();
    if (existingCardNo) return existingCardNo;
  }

  const farmId = Number(payload.farmId ?? 0);
  if (!Number.isFinite(farmId) || farmId <= 0) return null;

  const basePlacementQuery = () => db
    .from("flock_card")
    .select("card_no")
    .eq("farm_id", farmId)
    .eq("void", "1")
    .eq("status", "Saved")
    .order("start_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  const buildingWarehouseId = Number(payload.buildingWarehouseId ?? 0);
  const buildingId = Number(payload.buildingId ?? 0);
  const buildingKey = payload.buildingKey?.trim();
  const buildingCode = payload.buildingCode?.trim();
  const queries: Array<() => PromiseLike<{ data: PlacementCardLinkRow | null; error: unknown }>> = [];

  if (Number.isFinite(buildingWarehouseId) && buildingWarehouseId > 0) {
    queries.push(() => basePlacementQuery().eq("building_whse_id", buildingWarehouseId).maybeSingle());
  }
  if (Number.isFinite(buildingId) && buildingId > 0) {
    queries.push(() => basePlacementQuery().eq("building_id", buildingId).maybeSingle());
  }
  if (buildingKey) {
    queries.push(() => basePlacementQuery().eq("building_key", buildingKey).maybeSingle());
  }
  if (buildingCode) {
    queries.push(() => basePlacementQuery().eq("building_code", buildingCode).maybeSingle());
  }

  for (const runQuery of queries) {
    const result = await runQuery();
    if (result.error) throwDbError(result.error, "Unable to load linked placement card");

    const cardNo = String(result.data?.card_no ?? "").trim();
    if (cardNo) return cardNo;
  }

  return null;
}

function linePayloadToRow(line: FlockCardLinePayload, fcId: number, userId: string | null) {
  const values = line.values;

  return {
    created_by: userId,
    updated_by: userId,
    fc_id: fcId,
    age: line.age,
    mort_am: parseNumberOrNull(values[0]),
    mort_pm: parseNumberOrNull(values[1]),
    mort_total: parseNumberOrNull(values[2]),
    thin_am: parseNumberOrNull(values[3]),
    thin_pm: parseNumberOrNull(values[4]),
    row_total: parseNumberOrNull(values[5]),
    cum_total: parseNumberOrNull(values[7]),
    feed_kg: parseNumberOrNull(values[8]),
    feed_bird: parseNumberOrNull(values[9]),
    feed_guideline: parseNumberOrNull(values[10]),
    feed_batch_text: values[11]?.trim() || null,
    water_l: parseNumberOrNull(values[12]),
    water_bird: parseNumberOrNull(values[13]),
    body_wt: parseNumberOrNull(values[14]),
    body_guideline: parseNumberOrNull(values[15]),
    temp_min: parseNumberOrNull(values[16]),
    temp_max: parseNumberOrNull(values[17]),
    hum_min: parseNumberOrNull(values[18]),
    hum_max: parseNumberOrNull(values[19]),
    nh3_max: parseNumberOrNull(values[20]),
    skin_b: parseNumberOrNull(values[21]),
    skin_a: parseNumberOrNull(values[22]),
    skin_l: parseNumberOrNull(values[23]),
    extra: getLineExtra(line),
    is_locked: true,
    void: "1",
  };
}

function linePayloadToUpdateRow(line: FlockCardLinePayload, userId: string | null) {
  const {
    created_by: _createdBy,
    fc_id: _fcId,
    age: _age,
    void: _void,
    ...row
  } = linePayloadToRow(line, 0, userId);

  void _createdBy;
  void _fcId;
  void _age;
  void _void;

  return row;
}

function lineNeedsFeedIntakeRpc(line: FlockCardLinePayload) {
  return !line.feedIntakeLocked && line.allocations.length > 0;
}

function lineHasMortalityThinningAllocations(line: FlockCardLinePayload) {
  return normalizeMortalityAllocations(line).length > 0;
}

function omitFeedIntakeColumns<T extends Record<string, unknown>>(row: T) {
  const {
    feed_kg,
    feed_bird,
    feed_guideline,
    feed_batch_text,
    is_locked,
    ...nonFeedRow
  } = row;

  void feed_kg;
  void feed_bird;
  void feed_guideline;
  void feed_batch_text;
  void is_locked;

  return nonFeedRow;
}

function omitMortalityThinningColumns<T extends Record<string, unknown>>(row: T) {
  const {
    mort_am,
    mort_pm,
    mort_total,
    thin_am,
    thin_pm,
    row_total,
    cum_total,
    extra,
    ...nonMortalityRow
  } = row;

  void mort_am;
  void mort_pm;
  void mort_total;
  void thin_am;
  void thin_pm;
  void row_total;
  void cum_total;
  void extra;

  return nonMortalityRow;
}

function linePayloadToBaseInsertRow(line: FlockCardLinePayload, fcId: number, userId: string | null) {
  const row = linePayloadToRow(line, fcId, userId);

  return lineNeedsFeedIntakeRpc(line)
    ? { ...omitFeedIntakeColumns(row), is_locked: false }
    : row;
}

function linePayloadToBaseUpdateRow(line: FlockCardLinePayload, userId: string | null) {
  let row: Record<string, unknown> = linePayloadToUpdateRow(line, userId);

  if (line.mortalityThinningLocked) {
    row = omitMortalityThinningColumns(row);
  }

  return line.feedIntakeLocked || lineNeedsFeedIntakeRpc(line)
    ? omitFeedIntakeColumns(row)
    : row;
}

function hasLineData(line: FlockCardLinePayload) {
  return line.values.some((value, index) =>
    index !== 10 && String(value ?? "").trim() !== ""
  ) ||
    line.allocations.length > 0 ||
    lineHasMortalityThinningAllocations(line);
}

async function saveFlockCardLineFeedIntake(lineId: number, line: FlockCardLinePayload) {
  const result = await db.rpc("save_brd_fc_feed_intake", {
    p_line_id: lineId,
    p_feed_kg: parseNumberOrNull(line.values[8]),
    p_feed_bird: parseNumberOrNull(line.values[9]),
    p_feed_guideline: parseNumberOrNull(line.values[10]),
    p_feed_batch_text: line.values[11]?.trim() || null,
    p_allocations: line.allocations.map(allocation => ({
      itemId: allocation.itemId ?? null,
      itemCode: allocation.itemCode,
      itemName: allocation.itemName ?? null,
      batchNumber: allocation.batchNumber,
      warehouseId: allocation.warehouseId ?? null,
      warehouseCode: allocation.warehouseCode,
      warehouseName: allocation.warehouseName ?? null,
      allocatedQty: allocation.allocatedQty,
      onHandSnapshot: allocation.onHandSnapshot,
      manufacturingDate: allocation.manufacturingDate || null,
      expiryDate: allocation.expiryDate || null,
      source: allocation.source ?? "MANUAL",
    })),
  });

  if (result.error) throwDbError(result.error, "Unable to save feed intake");
}

export async function saveFlockCard(
  payload: FlockCardPayload,
): Promise<SavedFlockCard> {
  const userId = await getSessionUserId();
  const fcNo = payload.fcNo?.trim() || nextFlockCardNo();
  const cardNo = await findLinkedPlacementCardNo(payload);

  const headerPayload = {
    updated_by: userId,
    fc_no: fcNo,
    card_no: cardNo,
    fc_date: new Date().toISOString().slice(0, 10),
    farm_id: payload.farmId ?? null,
    farm_code: payload.farmCode ?? null,
    farm_name: payload.farmName ?? null,
    building_id: payload.buildingId ?? null,
    building_whse_id: payload.buildingWarehouseId ?? null,
    building_src: payload.buildingSource ?? null,
    building_key: payload.buildingKey ?? null,
    building_code: payload.buildingCode ?? null,
    building_name: payload.buildingName ?? null,
    building_status: payload.buildingStatus ?? null,
    feed_whse_id: payload.feedWarehouseId ?? null,
    feed_whse_code: payload.feedWarehouseCode ?? null,
    feed_whse_name: payload.feedWarehouseName ?? null,
    animal_qty: payload.animalQty,
    void: "1",
  };

  const savedHeader = payload.id
    ? await db
      .from("brd_fc")
      .update(headerPayload)
      .eq("id", payload.id)
      .select("id, fc_no")
      .single()
    : await db
      .from("brd_fc")
      .insert({ ...headerPayload, created_by: userId })
      .select("id, fc_no")
      .single();

  if (savedHeader.error) throwDbError(savedHeader.error, "Unable to save flock card header");

  const fcId = Number(savedHeader.data.id);
  const linesToSave = payload.lines.filter(hasLineData);
  if (linesToSave.length === 0) {
    return { id: fcId, fcNo: savedHeader.data.fc_no, savedLines: [] };
  }

  const agesToSave = linesToSave.map(line => line.age);
  const activeLineResult = await db
    .from("brd_fc_line")
    .select("id, age")
    .eq("fc_id", fcId)
    .eq("void", "1")
    .in("age", agesToSave);

  if (activeLineResult.error) throwDbError(activeLineResult.error, "Unable to check saved flock card lines");

  const activeLineIdByAge = new Map(
    (activeLineResult.data ?? []).map(row => [Number(row.age), Number(row.id)]),
  );
  const linesToInsert = linesToSave.filter(line => !activeLineIdByAge.has(line.age));
  const linesToUpdate = linesToSave.filter(line => activeLineIdByAge.has(line.age));

  for (const line of linesToUpdate) {
    const lineId = activeLineIdByAge.get(line.age);
    if (!lineId) continue;

    const updatePayload = linePayloadToBaseUpdateRow(line, userId);

    const lineResult = await db
      .from("brd_fc_line")
      .update(updatePayload)
      .eq("id", lineId)
      .eq("void", "1")
      .select("id, age")
      .single();

    if (lineResult.error) throwDbError(lineResult.error, "Unable to update flock card line");

    if (lineNeedsFeedIntakeRpc(line)) {
      await saveFlockCardLineFeedIntake(lineId, line);
    }
  }

  const lineRows = linesToInsert.map(line => linePayloadToBaseInsertRow(line, fcId, userId));
  const savedLinesResult = lineRows.length > 0
    ? await db
      .from("brd_fc_line")
      .insert(lineRows)
      .select("id, age")
    : { data: [], error: null };

  if (savedLinesResult.error) throwDbError(savedLinesResult.error, "Unable to save flock card lines");

  const lineIdByAge = new Map(
    (savedLinesResult.data ?? []).map(row => [Number(row.age), Number(row.id)]),
  );

  for (const line of linesToInsert) {
    const fcLineId = lineIdByAge.get(line.age);
    if (!fcLineId || !lineNeedsFeedIntakeRpc(line)) continue;

    await saveFlockCardLineFeedIntake(fcLineId, line);
  }

  return {
    id: fcId,
    fcNo: savedHeader.data.fc_no,
    savedLines: [
      ...(activeLineResult.data ?? []),
      ...(savedLinesResult.data ?? []),
    ].map(row => ({
      id: Number(row.id),
      age: Number(row.age),
    })),
  };
}

export async function reverseFlockCardFeedIntake(lineId: number, reason?: string | null) {
  const reversalReason = reason?.trim() || null;

  const lineResult = await db.rpc("reverse_brd_fc_feed_intake", {
    p_line_id: lineId,
    p_reason: reversalReason,
  });

  if (lineResult.error) throwDbError(lineResult.error, "Unable to reverse flock card feed intake");
  const reversedLine = Array.isArray(lineResult.data) ? lineResult.data[0] : lineResult.data;

  if (!reversedLine) {
    throw new Error("Unable to reverse flock card feed intake: no line was returned");
  }

  return {
    id: Number(reversedLine.id),
    age: Number(reversedLine.age),
  };
}

export async function reverseFlockCardMortalityThinning(lineId: number, reason?: string | null) {
  const reversalReason = reason?.trim() || null;

  const lineResult = await db.rpc("reverse_brd_fc_mortality_thinning", {
    p_line_id: lineId,
    p_reason: reversalReason,
  });

  if (lineResult.error) throwDbError(lineResult.error, "Unable to reverse flock card mortality/thinning");
  const reversedLine = Array.isArray(lineResult.data) ? lineResult.data[0] : lineResult.data;

  if (!reversedLine) {
    throw new Error("Unable to reverse mortality/thinning: no line was returned");
  }

  return {
    id: Number(reversedLine.id),
    age: Number(reversedLine.age),
  };
}

export async function getFlockCardSheet(params: { id?: number | null; cardNo?: string | null }): Promise<FlockCardSheet | null> {
  const id = Number(params.id ?? 0);
  const cardNo = params.cardNo?.trim() ?? "";

  if ((!Number.isFinite(id) || id <= 0) && !cardNo) return null;

  let headerQuery = db
    .from("brd_fc")
    .select("id, fc_no, card_no, farm_id, building_id, building_whse_id, building_key, animal_qty")
    .eq("void", "1")
    .order("id", { ascending: false })
    .limit(1);

  headerQuery = Number.isFinite(id) && id > 0
    ? headerQuery.eq("id", id)
    : headerQuery.eq("card_no", cardNo);

  const headerResult = await headerQuery.maybeSingle();

  if (headerResult.error) throwDbError(headerResult.error, "Unable to load flock card header");
  if (!headerResult.data) return null;

  const headerId = Number(headerResult.data.id);
  const lineResult = await db
    .from("brd_fc_line")
    .select("id, age, mort_am, mort_pm, mort_total, thin_am, thin_pm, row_total, cum_total, feed_kg, feed_bird, feed_guideline, feed_batch_text, water_l, water_bird, body_wt, body_guideline, temp_min, temp_max, hum_min, hum_max, nh3_max, skin_b, skin_a, skin_l, extra")
    .eq("fc_id", headerId)
    .eq("void", "1")
    .order("age", { ascending: true });

  if (lineResult.error) throwDbError(lineResult.error, "Unable to load flock card lines");

  const lines = lineResult.data ?? [];
  const lineIds = lines.map(line => Number(line.id)).filter(lineId => Number.isFinite(lineId));

  const allocationResult = lineIds.length > 0
    ? await db
      .from("brd_fc_ba")
      .select("fc_line_id, line_no, item_code, item_name, batch_no, whse_code, alloc_qty, onhand_snapshot, mfg_date, exp_date, source")
      .in("fc_line_id", lineIds)
      .eq("void", "1")
      .order("line_no", { ascending: true })
    : { data: [], error: null };

  if (allocationResult.error) throwDbError(allocationResult.error, "Unable to load flock card feed batches");

  const allocationsByLineId = new Map<number, FlockCardSheetLine["allocations"]>();

  for (const allocation of allocationResult.data ?? []) {
    const lineId = Number(allocation.fc_line_id);
    const itemCode = String(allocation.item_code ?? "").trim();
    const batchNumber = String(allocation.batch_no ?? "").trim();
    const warehouseCode = String(allocation.whse_code ?? "").trim();
    const lineAllocations = allocationsByLineId.get(lineId) ?? [];

    lineAllocations.push({
      batchId: getFeedBatchAllocationId(itemCode, batchNumber, warehouseCode),
      batchNumber,
      itemCode,
      itemName: String(allocation.item_name ?? "").trim(),
      warehouseCode,
      manufacturingDate: String(allocation.mfg_date ?? ""),
      expiryDate: String(allocation.exp_date ?? ""),
      availableQty: Number(allocation.onhand_snapshot ?? 0),
      selectedQty: Number(allocation.alloc_qty ?? 0),
      source: allocation.source === "FIFO" ? "FIFO" : "MANUAL",
    });

    allocationsByLineId.set(lineId, lineAllocations);
  }

  return {
    id: headerId,
    fcNo: String(headerResult.data.fc_no ?? ""),
    cardNo: headerResult.data.card_no ?? null,
    animalQty: Number(headerResult.data.animal_qty ?? 0),
    farmId: headerResult.data.farm_id == null ? null : Number(headerResult.data.farm_id),
    buildingId: headerResult.data.building_id == null ? null : Number(headerResult.data.building_id),
    buildingWarehouseId: headerResult.data.building_whse_id == null ? null : Number(headerResult.data.building_whse_id),
    buildingKey: headerResult.data.building_key ?? null,
    lines: lines.map(line => {
      const lineId = Number(line.id);

      const rawExtra = line.extra && typeof line.extra === "object" ? line.extra as Record<string, unknown> : {};
      const rawMortalityAllocations = Array.isArray(rawExtra.mortalityBatchAllocations)
        ? rawExtra.mortalityBatchAllocations
        : [];

      return {
        id: lineId,
        age: Number(line.age),
        values: [
          line.mort_am,
          line.mort_pm,
          line.mort_total,
          line.thin_am,
          line.thin_pm,
          line.row_total,
          null,
          line.cum_total,
          line.feed_kg,
          line.feed_bird,
          line.feed_guideline,
          line.feed_batch_text,
          line.water_l,
          line.water_bird,
          line.body_wt,
          line.body_guideline,
          line.temp_min,
          line.temp_max,
          line.hum_min,
          line.hum_max,
          line.nh3_max,
          line.skin_b,
          line.skin_a,
          line.skin_l,
          String(rawExtra.actualAdg ?? rawExtra.addAlw ?? ""),
          null,
          null,
          null,
        ].map((value, columnIndex) =>
          columnIndex === actualAdgColumnIndex
            ? String(value ?? "")
            : formatDbValue(value)
        ),
        allocations: allocationsByLineId.get(lineId) ?? [],
        mortalityAllocations: rawMortalityAllocations.flatMap((allocation) => {
          if (!allocation || typeof allocation !== "object") return [];

          const row = allocation as Record<string, unknown>;
          const itemCode = String(row.itemCode ?? "").trim();
          const batchNumber = String(row.batchNumber ?? "").trim();
          const warehouseCode = String(row.warehouseCode ?? "").trim();
          const selectedQty = Number(row.allocatedQty ?? 0);
          if (!itemCode || !batchNumber || !warehouseCode || selectedQty <= 0) return [];

          return [{
            batchId: getMortalityBatchAllocationId(itemCode, batchNumber, warehouseCode),
            batchNumber,
            itemCode,
            itemName: String(row.itemName ?? "").trim(),
            warehouseCode,
            availableQty: Number(row.onHandSnapshot ?? selectedQty),
            selectedQty,
            source: row.source === "FIFO" ? "FIFO" as const : "MANUAL" as const,
          }];
        }),
      };
    }),
  };
}

export async function getFlockOriginBatchesByCardNo(cardNo: string): Promise<FeedBatchOnHand[]> {
  const normalizedCardNo = cardNo.trim();
  if (!normalizedCardNo) return [];

  const cardResult = await db
    .from("flock_card")
    .select("id, building_code, building_whse_id")
    .eq("card_no", normalizedCardNo)
    .eq("void", "1")
    .eq("status", "Saved")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cardResult.error) throwDbError(cardResult.error, "Unable to load linked placement card");
  const card = cardResult.data as FlockOriginCardRow | null;
  const placementId = Number(card?.id ?? 0);
  if (!Number.isFinite(placementId) || placementId <= 0) return [];

  let destinationWarehouseCode = String(card?.building_code ?? "").trim();
  const buildingWarehouseId = Number(card?.building_whse_id ?? 0);

  if (!destinationWarehouseCode && Number.isFinite(buildingWarehouseId) && buildingWarehouseId > 0) {
    const warehouseResult = await db
      .from("i_warehouse")
      .select("whse_code")
      .eq("id", buildingWarehouseId)
      .maybeSingle();

    if (warehouseResult.error) throwDbError(warehouseResult.error, "Unable to load building warehouse");
    destinationWarehouseCode = String(warehouseResult.data?.whse_code ?? "").trim();
  }

  const originResult = await db
    .from("flock_card_origin")
    .select("item_code, item_name, batch_no, whse_code, animal_qty, onhand_snapshot")
    .eq("fc_id", placementId)
    .eq("void", "1")
    .order("line_no", { ascending: true });

  if (originResult.error) throwDbError(originResult.error, "Unable to load flock origin batches");

  return ((originResult.data ?? []) as FlockOriginBatchRow[]).flatMap(row => {
    const itemCode = String(row.item_code ?? "").trim();
    const batchNumber = String(row.batch_no ?? "").trim();
    const sourceWarehouseCode = String(row.whse_code ?? "").trim();
    const warehouseCode = destinationWarehouseCode || sourceWarehouseCode;
    const onHandQty = Number(row.animal_qty ?? row.onhand_snapshot ?? 0);
    if (!itemCode || !batchNumber || !warehouseCode || onHandQty <= 0) return [];

    return [{
      id: getMortalityBatchAllocationId(itemCode, batchNumber, warehouseCode),
      itemCode,
      itemName: String(row.item_name ?? "").trim(),
      batchNumber,
      manufacturingDate: "",
      expiryDate: "",
      warehouseCode,
      onHandQty,
    }];
  });
}

export async function getFarmBuildings(farmId: number): Promise<FarmBuildingOption[]> {
  if (!Number.isFinite(farmId)) return [];

  const [buildingResult, farmResult] = await Promise.all([
    db
      .from("farm_buildings")
      .select("id, farm_id, code, name, status, remarks")
      .eq("farm_id", farmId)
      .order("code", { ascending: true }),
    activeApprovedFarmsQuery(db.from("farms").select("associated_warehouses"))
      .eq("id", farmId)
      .single(),
  ]);

  if (buildingResult.error) throwDbError(buildingResult.error, "Unable to load farm buildings");
  if (farmResult.error) throwDbError(farmResult.error, "Unable to load farm warehouse links");

  const buildingRows = (buildingResult.data ?? []).map(row => ({
    key: `building:${row.id}`,
    id: Number(row.id),
    farmId: Number(row.farm_id),
    code: String(row.code ?? "").trim(),
    name: String(row.name ?? "").trim(),
    status: String(row.status ?? "").trim(),
    remarks: row.remarks ?? null,
    source: "BUILDING" as const,
  }));

  const buildingCodes = new Set(buildingRows.map(row => row.code.toUpperCase()).filter(Boolean));
  const associatedWarehouses = Array.isArray(farmResult.data?.associated_warehouses)
    ? farmResult.data.associated_warehouses as AssociatedWarehouseRow[]
    : [];
  const associatedWarehouseCodes = associatedWarehouses
    .map(warehouse => String(warehouse?.whse_code ?? "").trim())
    .filter(Boolean);

  const warehouseResult = associatedWarehouseCodes.length > 0
    ? await db
      .from("i_warehouse")
      .select("id, whse_code, whse_name, warehouse_type")
      .in("whse_code", associatedWarehouseCodes)
    : { data: [], error: null };

  if (warehouseResult.error) throwDbError(warehouseResult.error, "Unable to load associated warehouse types");

  const warehouseByCode = new Map(
    ((warehouseResult.data ?? []) as WarehouseMasterRow[]).map(warehouse => [
      String(warehouse.whse_code ?? "").trim().toUpperCase(),
      warehouse,
    ]),
  );

  const warehouseRows = associatedWarehouses.flatMap(warehouse => {
    const code = String(warehouse?.whse_code ?? "").trim();
    if (!code || buildingCodes.has(code.toUpperCase())) return [];

    const warehouseMaster = warehouseByCode.get(code.toUpperCase());
    if (String(warehouseMaster?.warehouse_type ?? "").trim() !== "Building") return [];

    return [{
      key: `warehouse:${code}`,
      id: Number(warehouseMaster?.id ?? 0) || null,
      farmId,
      code,
      name: String(warehouseMaster?.whse_name ?? warehouse?.whse_name ?? "").trim(),
      status: warehouse?.is_default_feed ? "Default Feed Warehouse" : "Associated Warehouse",
      remarks: null,
      source: "WAREHOUSE" as const,
      warehouseCode: code,
    }];
  });

  return [...buildingRows, ...warehouseRows].sort((left, right) =>
    left.code.localeCompare(right.code) || left.name.localeCompare(right.name)
  );
}

function signedPostingQty(row: InventoryPostingBatchRow) {
  const qty = Number(row.qty ?? 0);
  return row.transfer_type === "OUT" ? -qty : qty;
}

function addPostingQuantities(
  rows: InventoryPostingBatchRow[],
  feedItemCodes: Set<string>,
  quantityByItemBatch: Map<string, FeedBatchOnHand>,
) {
  const seenPostingIds = new Set<number>();

  for (const row of rows) {
    if (seenPostingIds.has(row.id)) continue;
    seenPostingIds.add(row.id);

    const itemCode = String(row.item_code ?? "").trim();
    const itemKey = itemCode.toUpperCase();
    const warehouseCode = String(row.warehouse_code ?? "").trim();
    const batchNumber = String(row.ref ?? "").trim();

    if (!itemCode || !feedItemCodes.has(itemKey) || !batchNumber) continue;

    const key = [itemKey, batchNumber.toUpperCase(), warehouseCode.toUpperCase()].join("|");
    const current = quantityByItemBatch.get(key);

    quantityByItemBatch.set(key, {
      id: key,
      itemCode,
      itemName: current?.itemName ?? "",
      batchNumber,
      manufacturingDate: current?.manufacturingDate ?? "",
      expiryDate: current?.expiryDate ?? "",
      warehouseCode: current?.warehouseCode || warehouseCode,
      onHandQty: (current?.onHandQty ?? 0) + signedPostingQty(row),
    });
  }
}

export async function getFeedBatchOnHandByWarehouse(
  itemCodes: string[],
  warehouseCode: string,
): Promise<FeedBatchOnHand[]> {
  const normalizedWarehouseCode = warehouseCode.trim();
  const normalizedItemCodes = Array.from(new Set(
    itemCodes.map(code => code.trim()).filter(Boolean),
  ));

  if (!normalizedWarehouseCode || normalizedItemCodes.length === 0) return [];

  const postingSelect = "id, item_code, warehouse_code, qty, transfer_type, ref, ref2";
  const postingsResult = await db
    .from("inventory_postings")
    .select(postingSelect)
    .eq("warehouse_code", normalizedWarehouseCode)
    .in("item_code", normalizedItemCodes)
    .not("ref", "is", null);

  if (postingsResult.error) throw postingsResult.error;

  const feedItemCodeSet = new Set(normalizedItemCodes.map(code => code.toUpperCase()));
  const quantityByItemBatch = new Map<string, FeedBatchOnHand>();

  addPostingQuantities(
    (postingsResult.data ?? []) as InventoryPostingBatchRow[],
    feedItemCodeSet,
    quantityByItemBatch,
  );

  const rows = Array.from(quantityByItemBatch.values())
    .filter(row => row.onHandQty > 0);

  if (rows.length === 0) return [];

  const batchNumbers = Array.from(new Set(rows.map(row => row.batchNumber)));

  const { data: batchRows, error: batchError } = await db
    .from("item_batches")
    .select("item_code, batch_number, manufacturing_date, expiry_date")
    .in("item_code", normalizedItemCodes)
    .in("batch_number", batchNumbers)
    .eq("void", "1");

  if (batchError) throw batchError;

  const batchByKey = new Map(
    ((batchRows ?? []) as ItemBatchRow[]).map(row => [
      [row.item_code.toUpperCase(), row.batch_number.toUpperCase()].join("|"),
      row,
    ]),
  );

  return rows
    .flatMap(row => {
      const batch = batchByKey.get([row.itemCode.toUpperCase(), row.batchNumber.toUpperCase()].join("|"));
      if (!batch) return [];

      return [{
        ...row,
        manufacturingDate: batch?.manufacturing_date ?? "",
        expiryDate: batch?.expiry_date ?? "",
      }];
    })
    .sort((left, right) => {
      const leftDate = left.expiryDate || "9999-12-31";
      const rightDate = right.expiryDate || "9999-12-31";
      return leftDate.localeCompare(rightDate) ||
        left.itemCode.localeCompare(right.itemCode) ||
        left.batchNumber.localeCompare(right.batchNumber);
    });
}
