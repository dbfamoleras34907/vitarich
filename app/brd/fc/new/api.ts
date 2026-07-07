import { db } from "@/lib/Supabase/supabaseClient";

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

export type FlockCardLinePayload = {
  age: number;
  values: string[];
  allocations: FlockCardBatchAllocationPayload[];
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
  const queries: Array<Promise<{ data: PlacementCardLinkRow | null; error: unknown }>> = [];

  if (Number.isFinite(buildingWarehouseId) && buildingWarehouseId > 0) {
    queries.push(basePlacementQuery().eq("building_whse_id", buildingWarehouseId).maybeSingle());
  }
  if (Number.isFinite(buildingId) && buildingId > 0) {
    queries.push(basePlacementQuery().eq("building_id", buildingId).maybeSingle());
  }
  if (buildingKey) {
    queries.push(basePlacementQuery().eq("building_key", buildingKey).maybeSingle());
  }
  if (buildingCode) {
    queries.push(basePlacementQuery().eq("building_code", buildingCode).maybeSingle());
  }

  for (const query of queries) {
    const result = await query;
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
    cum_total: parseNumberOrNull(values[6]),
    feed_kg: parseNumberOrNull(values[7]),
    feed_bird: parseNumberOrNull(values[8]),
    feed_guideline: parseNumberOrNull(values[9]),
    feed_batch_text: values[10]?.trim() || null,
    water_l: parseNumberOrNull(values[11]),
    water_bird: parseNumberOrNull(values[12]),
    body_wt: parseNumberOrNull(values[13]),
    body_guideline: parseNumberOrNull(values[14]),
    temp_min: parseNumberOrNull(values[15]),
    temp_max: parseNumberOrNull(values[16]),
    hum_min: parseNumberOrNull(values[17]),
    hum_max: parseNumberOrNull(values[18]),
    nh3_max: parseNumberOrNull(values[19]),
    skin_b: parseNumberOrNull(values[20]),
    skin_a: parseNumberOrNull(values[21]),
    skin_l: parseNumberOrNull(values[22]),
    is_locked: true,
    void: "1",
  };
}

function hasLineData(line: FlockCardLinePayload) {
  return line.values.some((value, index) =>
    index !== 9 && String(value ?? "").trim() !== ""
  ) ||
    line.allocations.length > 0;
}

function allocationPayloadToRow(
  allocation: FlockCardBatchAllocationPayload,
  fcLineId: number,
  userId: string | null,
) {
  return {
    created_by: userId,
    updated_by: userId,
    fc_line_id: fcLineId,
    line_no: allocation.lineNo,
    item_id: allocation.itemId ?? null,
    item_code: allocation.itemCode,
    item_name: allocation.itemName ?? null,
    batch_no: allocation.batchNumber,
    whse_id: allocation.warehouseId ?? null,
    whse_code: allocation.warehouseCode,
    whse_name: allocation.warehouseName ?? null,
    alloc_qty: allocation.allocatedQty,
    onhand_snapshot: allocation.onHandSnapshot,
    mfg_date: allocation.manufacturingDate || null,
    exp_date: allocation.expiryDate || null,
    source: allocation.source ?? "MANUAL",
    void: "1",
  };
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
  const activeAgeResult = await db
    .from("brd_fc_line")
    .select("age")
    .eq("fc_id", fcId)
    .eq("void", "1")
    .in("age", agesToSave);

  if (activeAgeResult.error) throwDbError(activeAgeResult.error, "Unable to check saved flock card lines");

  const activeAges = (activeAgeResult.data ?? []).map(row => Number(row.age));
  if (activeAges.length > 0) {
    throw new Error(`Age ${activeAges.sort((a, b) => a - b).join(", ")} already saved. Reverse the row before editing it.`);
  }

  const lineRows = linesToSave.map(line => linePayloadToRow(line, fcId, userId));
  const savedLinesResult = await db
    .from("brd_fc_line")
    .insert(lineRows)
    .select("id, age");

  if (savedLinesResult.error) throwDbError(savedLinesResult.error, "Unable to save flock card lines");

  const lineIdByAge = new Map(
    (savedLinesResult.data ?? []).map(row => [Number(row.age), Number(row.id)]),
  );

  const allocationRows = linesToSave.flatMap(line => {
    const fcLineId = lineIdByAge.get(line.age);
    if (!fcLineId) return [];

    return line.allocations.map(allocation =>
      allocationPayloadToRow(allocation, fcLineId, userId)
    );
  });

  if (allocationRows.length > 0) {
    const savedAllocationsResult = await db
      .from("brd_fc_ba")
      .insert(allocationRows);

    if (savedAllocationsResult.error) throwDbError(savedAllocationsResult.error, "Unable to save feed batch allocations");
  }

  return {
    id: fcId,
    fcNo: savedHeader.data.fc_no,
    savedLines: (savedLinesResult.data ?? []).map(row => ({
      id: Number(row.id),
      age: Number(row.age),
    })),
  };
}

export async function reverseFlockCardLine(lineId: number, reason?: string | null) {
  const userId = await getSessionUserId();
  const reversalReason = reason?.trim() || null;

  const allocationResult = await db
    .from("brd_fc_ba")
    .update({
      void: "0",
      updated_by: userId,
      reversed_by: userId,
      reversed_at: new Date().toISOString(),
      reversal_reason: reversalReason,
    })
    .eq("fc_line_id", lineId)
    .eq("void", "1");

  if (allocationResult.error) throwDbError(allocationResult.error, "Unable to reverse feed batch allocations");

  const lineResult = await db
    .from("brd_fc_line")
    .update({
      void: "0",
      is_locked: false,
      updated_by: userId,
      reversed_by: userId,
      reversed_at: new Date().toISOString(),
      reversal_reason: reversalReason,
    })
    .eq("id", lineId)
    .eq("void", "1")
    .select("id, age")
    .single();

  if (lineResult.error) throwDbError(lineResult.error, "Unable to reverse flock card line");

  return {
    id: Number(lineResult.data.id),
    age: Number(lineResult.data.age),
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
    .select("id, age, mort_am, mort_pm, mort_total, thin_am, thin_pm, row_total, cum_total, feed_kg, feed_bird, feed_guideline, feed_batch_text, water_l, water_bird, body_wt, body_guideline, temp_min, temp_max, hum_min, hum_max, nh3_max, skin_b, skin_a, skin_l")
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
          null,
          null,
          null,
          null,
        ].map(formatDbValue),
        allocations: allocationsByLineId.get(lineId) ?? [],
      };
    }),
  };
}

export async function getFarmBuildings(farmId: number): Promise<FarmBuildingOption[]> {
  if (!Number.isFinite(farmId)) return [];

  const [buildingResult, farmResult] = await Promise.all([
    db
      .from("farm_buildings")
      .select("id, farm_id, code, name, status, remarks")
      .eq("farm_id", farmId)
      .order("code", { ascending: true }),
    db
      .from("farms")
      .select("associated_warehouses")
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
    const ref = String(row.ref ?? "").trim();
    const ref2 = String(row.ref2 ?? "").trim();
    const batchNumbers = Array.from(new Set([ref, ref2].filter(Boolean)));

    if (!itemCode || !feedItemCodes.has(itemKey) || batchNumbers.length === 0) continue;

    for (const batchNumber of batchNumbers) {
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
  const [refPostingsResult, ref2PostingsResult] = await Promise.all([
    db
      .from("inventory_postings")
      .select(postingSelect)
      .eq("warehouse_code", normalizedWarehouseCode)
      .in("item_code", normalizedItemCodes)
      .not("ref", "is", null),
    db
      .from("inventory_postings")
      .select(postingSelect)
      .eq("warehouse_code", normalizedWarehouseCode)
      .in("item_code", normalizedItemCodes)
      .not("ref2", "is", null),
  ]);

  if (refPostingsResult.error) throw refPostingsResult.error;
  if (ref2PostingsResult.error) throw ref2PostingsResult.error;

  const feedItemCodeSet = new Set(normalizedItemCodes.map(code => code.toUpperCase()));
  const quantityByItemBatch = new Map<string, FeedBatchOnHand>();

  addPostingQuantities(
    [
      ...((refPostingsResult.data ?? []) as InventoryPostingBatchRow[]),
      ...((ref2PostingsResult.data ?? []) as InventoryPostingBatchRow[]),
    ],
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
