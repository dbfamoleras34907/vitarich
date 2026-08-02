import { db } from "@/lib/Supabase/supabaseClient";
import { activeApprovedFarmsQuery } from "@/lib/data/repositories/farms";
import { calculateFlockAgeFromStartDate } from "./age";

export type FarmBuildingListRow = {
  key: string;
  id: number | null;
  farmId: number;
  code: string;
  name: string;
  status: string;
  remarks: string | null;
  source: "BUILDING" | "WAREHOUSE";
  warehouseCode?: string | null;
  flockCard?: FlockCardListInfo | null;
};

export type FlockCardFarmInfo = {
  id: number;
  code: string;
  name: string;
  address: string;
  farmType: string;
  contactPerson: string;
};

export type FarmOriginDocDetail = {
  grOrigin?: string;
  receiveDate: string;
  receiveTime: string;
  manufacturingDate: string;
  transferSlip: string;
  averageDocWeight: number;
  totalReceived: number;
  doaCount: number;
  rejectCount: number;
  shortCount: number;
  actualReceived: number;
  shortCountRemarks: string;
  doaCountRemarks: string;
  rejectCountRemarks: string;
};

export type FlockCardListInfo = {
  id: number;
  cardNo: string;
  age: number;
  startDate: string;
  flockCode: string;
  breed: string;
  animalQty: number;
  status: string;
};

export type FarmOriginBatchOption = {
  id: string;
  itemCode: string;
  itemName: string;
  batchNumber: string;
  warehouseCode: string;
  warehouseName: string;
  onHandQty: number;
  batchQuantity: number;
  manufacturingDate: string;
  expiryDate: string;
  grOrigin: string;
  docDetails: FarmOriginDocDetail[];
  mortalityQty: number;
  thinningQty: number;
  batchOnHandQty: number;
};

export type BuildingPlacementInventoryLookup = {
  farmId: number;
  buildingCode?: string | null;
  buildingName?: string | null;
  buildingKey?: string | null;
  buildingWarehouseCode?: string | null;
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
  is_active?: boolean | null;
  farm_id?: string | null;
  farm_code?: string | null;
};

type FlockCardListRow = {
  id: number;
  card_no: string | null;
  building_id: number | null;
  building_whse_id: number | null;
  building_key: string | null;
  building_code: string | null;
  building_name: string | null;
  age: number | null;
  start_date: string | null;
  flock_code: string | null;
  breed: string | null;
  animal_qty: number | null;
  status: string | null;
};

type FlockCardOriginCountRow = {
  fc_id: number | null;
  animal_qty: number | null;
};

type InventoryPostingBatchRow = {
  id: number;
  source_doc_type: string | null;
  source_docentry: number | null;
  item_code: string | null;
  warehouse_code: string | null;
  qty: number | null;
  transfer_type: string | null;
  ref: string | null;
  ref2: string | null;
  batch_number: string | null;
};

type ItemBatchOriginRow = {
  item_code: string;
  batch_number: string;
  manufacturing_date: string | null;
  expiry_date: string | null;
  source_gr_id: number | null;
};

type FlockCardMortalityLineRow = {
  mort_total: number | null;
  thin_am: number | null;
  thin_pm: number | null;
  row_total: number | null;
  extra: Record<string, unknown> | null;
};

type GoodsReceiptDocOriginRow = {
  goods_reciept_id: number;
  line_no: number | null;
  receive_date: string | null;
  receive_time: string | null;
  mnf_date: string | null;
  transfer_slip: string | null;
  average_doc_weight: number | null;
  quantity_received: number | null;
  doa_quantity: number | null;
  reject_count: number | null;
  short_count: number | null;
  actual_received: number | null;
  short_count_remarks: string | null;
  doa_count_remarks: string | null;
  reject_count_remarks: string | null;
};

const originDocDetailKey = (itemCode: string, batchNumber: string) =>
  `${itemCode.trim().toUpperCase()}|${batchNumber.trim().toUpperCase()}`;

const toFarmOriginDocDetail = (detail: GoodsReceiptDocOriginRow): FarmOriginDocDetail => ({
  receiveDate: detail.receive_date ?? "",
  receiveTime: detail.receive_time ?? "",
  manufacturingDate: detail.mnf_date ?? "",
  transferSlip: detail.transfer_slip ?? "",
  averageDocWeight: Number(detail.average_doc_weight ?? 0),
  totalReceived: Number(detail.quantity_received ?? 0),
  doaCount: Number(detail.doa_quantity ?? 0),
  rejectCount: Number(detail.reject_count ?? 0),
  shortCount: Number(detail.short_count ?? Math.max(Number(detail.quantity_received ?? 0) - Number(detail.actual_received ?? 0), 0)),
  actualReceived: Number(detail.actual_received ?? 0),
  shortCountRemarks: detail.short_count_remarks ?? "",
  doaCountRemarks: detail.doa_count_remarks ?? "",
  rejectCountRemarks: detail.reject_count_remarks ?? "",
});

export async function getOriginDocDetailsByBatch(
  origins: Array<{ itemCode: string; batchNumber: string }>,
): Promise<Record<string, FarmOriginDocDetail[]>> {
  const itemCodes = Array.from(new Set(origins.map(origin => origin.itemCode.trim()).filter(Boolean)));
  const batchNumbers = Array.from(new Set(origins.map(origin => origin.batchNumber.trim()).filter(Boolean)));
  if (itemCodes.length === 0 || batchNumbers.length === 0) return {};

  const batchResult = await db
    .from("item_batches")
    .select("item_code, batch_number, source_gr_id")
    .in("item_code", itemCodes)
    .in("batch_number", batchNumbers)
    .eq("void", "1");

  if (batchResult.error) throwDbError(batchResult.error, "Unable to trace DOC receiving batches");

  const receiptIdByBatch = new Map<string, number>();
  for (const batch of (batchResult.data ?? []) as ItemBatchOriginRow[]) {
    const receiptId = Number(batch.source_gr_id ?? 0);
    if (receiptId > 0) receiptIdByBatch.set(originDocDetailKey(batch.item_code, batch.batch_number), receiptId);
  }

  const receiptItemResult = await db
    .from("goods_receipt_items")
    .select("goods_reciept_id, item_code, batch_number")
    .in("item_code", itemCodes)
    .in("batch_number", batchNumbers)
    .eq("void", "1");

  if (receiptItemResult.error) throwDbError(receiptItemResult.error, "Unable to trace DOC receiving lines");

  for (const receiptItem of (receiptItemResult.data ?? []) as GoodsReceiptItemOriginRow[]) {
    const itemCode = String(receiptItem.item_code ?? "").trim();
    const batchNumber = String(receiptItem.batch_number ?? "").trim();
    const receiptId = Number(receiptItem.goods_reciept_id ?? 0);
    const key = originDocDetailKey(itemCode, batchNumber);
    if (!itemCode || !batchNumber || receiptId <= 0 || receiptIdByBatch.has(key)) continue;

    receiptIdByBatch.set(key, receiptId);
  }

  const receiptIds = Array.from(new Set(receiptIdByBatch.values()));
  if (receiptIds.length === 0) return {};

  const detailResult = await db
    .from("goods_receipt_doc")
    .select("goods_reciept_id, line_no, receive_date, receive_time, mnf_date, transfer_slip, average_doc_weight, quantity_received, doa_quantity, reject_count, short_count, actual_received, short_count_remarks, doa_count_remarks, reject_count_remarks")
    .in("goods_reciept_id", receiptIds)
    .eq("void", "1")
    .order("line_no", { ascending: true });

  if (detailResult.error) throwDbError(detailResult.error, "Unable to load DOC details");

  const detailsByReceipt = new Map<number, FarmOriginDocDetail[]>();
  for (const detail of (detailResult.data ?? []) as GoodsReceiptDocOriginRow[]) {
    const receiptId = Number(detail.goods_reciept_id);
    detailsByReceipt.set(receiptId, [...(detailsByReceipt.get(receiptId) ?? []), toFarmOriginDocDetail(detail)]);
  }

  return Object.fromEntries(
    Array.from(receiptIdByBatch.entries()).map(([key, receiptId]) => [key, detailsByReceipt.get(receiptId) ?? []]),
  );
}

type ItemNameRow = {
  id: number | null;
  item_code: string | null;
  item_name: string | null;
  description: string | null;
  item_group: string | null;
  fms_group: string | null;
  group: string | null;
};

type DocReceivingSettingsRow = {
  good_doc: number | null;
};

type GoodsReceiptOriginRow = {
  id: number;
  gr_no: string | null;
};

type GoodsReceiptItemOriginRow = {
  goods_reciept_id: number | null;
  line_no?: number | null;
  doc_line_no?: number | null;
  item_code: string | null;
  batch_number: string | null;
  warehouse_code: string | null;
  base_qty: number | null;
};

function getAssociatedWarehouseCode(warehouse: AssociatedWarehouseRow | string) {
  return typeof warehouse === "string"
    ? warehouse.trim()
    : String(warehouse?.whse_code ?? "").trim();
}

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

export async function getFarmInfoForFlockCard(
  farmId: number,
): Promise<FlockCardFarmInfo | null> {
  if (!Number.isFinite(farmId)) return null;

  const { data, error } = await activeApprovedFarmsQuery(db.from("farms").select("id, code, name, address, farm_type, contact_person"))
    .eq("id", farmId)
    .single();

  if (error) throwDbError(error, "Unable to load farm information");
  if (!data) return null;

  return {
    id: Number(data.id),
    code: String(data.code ?? "").trim(),
    name: String(data.name ?? "").trim(),
    address: String(data.address ?? "").trim(),
    farmType: String(data.farm_type ?? "").trim(),
    contactPerson: String(data.contact_person ?? "").trim(),
  };
}

export async function getFarmBuildingsForFlockCard(
  farmId: number,
): Promise<FarmBuildingListRow[]> {
  if (!Number.isFinite(farmId)) return [];

  const farmResult = await activeApprovedFarmsQuery(db.from("farms").select("id, code, associated_warehouses"))
    .eq("id", farmId)
    .single();

  if (farmResult.error) throwDbError(farmResult.error, "Unable to load farm warehouse links");

  const farmCode = String(farmResult.data?.code ?? "").trim();
  const associatedWarehouses = Array.isArray(farmResult.data?.associated_warehouses)
    ? farmResult.data.associated_warehouses as Array<AssociatedWarehouseRow | string>
    : [];
  const associatedWarehouseCodes = Array.from(new Set(
    associatedWarehouses
      .map(getAssociatedWarehouseCode)
      .filter(Boolean),
  ));

  const directWarehouseQueries = [
    db
      .from("i_warehouse")
      .select("id, whse_code, whse_name, warehouse_type, is_active, farm_id, farm_code")
      .eq("warehouse_type", "Building")
      .eq("farm_id", String(farmId)),
    farmCode
      ? db
        .from("i_warehouse")
        .select("id, whse_code, whse_name, warehouse_type, is_active, farm_id, farm_code")
        .eq("warehouse_type", "Building")
        .eq("farm_code", farmCode)
      : Promise.resolve({ data: [], error: null }),
    associatedWarehouseCodes.length > 0
      ? db
        .from("i_warehouse")
        .select("id, whse_code, whse_name, warehouse_type, is_active, farm_id, farm_code")
        .eq("warehouse_type", "Building")
        .in("whse_code", associatedWarehouseCodes)
      : Promise.resolve({ data: [], error: null }),
    db
      .from("flock_card")
      .select("id, card_no, building_id, building_whse_id, building_key, building_code, building_name, age, start_date, flock_code, breed, animal_qty, status")
      .eq("farm_id", farmId)
      .eq("void", "1")
      .eq("status", "Saved")
      .order("start_date", { ascending: false })
      .order("id", { ascending: false }),
  ] as const;

  const [
    warehouseByFarmIdResult,
    warehouseByFarmCodeResult,
    associatedWarehouseResult,
    flockCardResult,
  ] = await Promise.all(directWarehouseQueries);

  if (warehouseByFarmIdResult.error) throwDbError(warehouseByFarmIdResult.error, "Unable to load farm buildings");
  if (warehouseByFarmCodeResult.error) throwDbError(warehouseByFarmCodeResult.error, "Unable to load farm buildings");
  if (associatedWarehouseResult.error) throwDbError(associatedWarehouseResult.error, "Unable to load associated farm buildings");
  if (flockCardResult.error) throwDbError(flockCardResult.error, "Unable to load flock cards");

  const warehouseById = new Map<number, WarehouseMasterRow>();
  for (const warehouse of [
    ...((warehouseByFarmIdResult.data ?? []) as WarehouseMasterRow[]),
    ...((warehouseByFarmCodeResult.data ?? []) as WarehouseMasterRow[]),
    ...((associatedWarehouseResult.data ?? []) as WarehouseMasterRow[]),
  ]) {
    const id = Number(warehouse.id ?? 0);
    const code = String(warehouse.whse_code ?? "").trim();
    if (!Number.isFinite(id) || id <= 0 || !code) continue;
    warehouseById.set(id, warehouse);
  }

  const cards = (flockCardResult.data ?? []) as FlockCardListRow[];
  const cardIds = cards
    .map(card => Number(card.id))
    .filter(id => Number.isFinite(id) && id > 0);
  const originCountByCardId = new Map<number, number>();

  if (cardIds.length > 0) {
    const originCountResult = await db
      .from("flock_card_origin")
      .select("fc_id, animal_qty")
      .in("fc_id", cardIds)
      .eq("void", "1");

    if (originCountResult.error) throwDbError(originCountResult.error, "Unable to load flock origin counts");

    for (const origin of (originCountResult.data ?? []) as FlockCardOriginCountRow[]) {
      const fcId = Number(origin.fc_id ?? 0);
      if (!Number.isFinite(fcId) || fcId <= 0) continue;

      originCountByCardId.set(
        fcId,
        (originCountByCardId.get(fcId) ?? 0) + Number(origin.animal_qty ?? 0),
      );
    }
  }

  const flockCardByWarehouseId = new Map<number, FlockCardListInfo>();
  const flockCardByBuildingKey = new Map<string, FlockCardListInfo>();
  const flockCardByBuildingCode = new Map<string, FlockCardListInfo>();
  const cardIdsAttachedToWarehouseRows = new Set<number>();

  const getBuildingFlockKey = (card: FlockCardListRow) => {
    const flockCode = String(card.flock_code ?? "").trim().toUpperCase();
    if (!flockCode) return "";

    const warehouseId = Number(card.building_whse_id ?? 0);
    const buildingKey = String(card.building_key ?? "").trim().toUpperCase();
    const buildingCode = String(card.building_code ?? "").trim().toUpperCase();
    const buildingIdentity = warehouseId > 0
      ? `WAREHOUSE:${warehouseId}`
      : buildingKey
        ? `KEY:${buildingKey}`
        : buildingCode
          ? `CODE:${buildingCode}`
          : "";

    return buildingIdentity ? `${buildingIdentity}|FLOCK:${flockCode}` : "";
  };

  const originCountByBuildingFlock = new Map<string, number>();
  for (const card of cards) {
    const key = getBuildingFlockKey(card);
    if (!key) continue;

    const cardId = Number(card.id);
    const cardOriginCount = originCountByCardId.get(cardId) ?? Number(card.animal_qty ?? 0);
    originCountByBuildingFlock.set(key, (originCountByBuildingFlock.get(key) ?? 0) + cardOriginCount);
  }

  const cardToListInfo = (card: FlockCardListRow): FlockCardListInfo => {
    const cardId = Number(card.id);
    const buildingFlockKey = getBuildingFlockKey(card);
    const startDate = String(card.start_date ?? "").trim();

    return {
      id: cardId,
      cardNo: String(card.card_no ?? "").trim(),
      age: startDate ? calculateFlockAgeFromStartDate(startDate) : Number(card.age ?? 0),
      startDate,
      flockCode: String(card.flock_code ?? "").trim(),
      breed: String(card.breed ?? "").trim(),
      animalQty: buildingFlockKey
        ? originCountByBuildingFlock.get(buildingFlockKey) ?? Number(card.animal_qty ?? 0)
        : originCountByCardId.get(cardId) ?? Number(card.animal_qty ?? 0),
      status: String(card.status ?? "").trim(),
    };
  };

  for (const card of cards) {
    const info = cardToListInfo(card);
    const warehouseId = Number(card.building_whse_id ?? 0);
    const buildingKey = String(card.building_key ?? "").trim();
    const buildingCode = String(card.building_code ?? "").trim().toUpperCase();

    if (warehouseId > 0 && !flockCardByWarehouseId.has(warehouseId)) {
      flockCardByWarehouseId.set(warehouseId, info);
    }
    if (buildingKey && !flockCardByBuildingKey.has(buildingKey)) {
      flockCardByBuildingKey.set(buildingKey, info);
    }
    if (buildingCode && !flockCardByBuildingCode.has(buildingCode)) {
      flockCardByBuildingCode.set(buildingCode, info);
    }
  }

  const getPlacementInventoryAnimalQty = async (warehouseCode: string | null | undefined) => {
    const code = String(warehouseCode ?? "").trim();
    if (!code) return 0;

    const placementRows = await getFarmOriginBatchesForFlockCard(farmId, code);
    return placementRows.reduce(
      (sum, row) => sum + Number(row.batchOnHandQty || row.onHandQty || 0),
      0,
    );
  };

  const warehouseRows = await Promise.all(Array.from(warehouseById.values()).map(async warehouse => {
    const id = Number(warehouse.id);
    const code = String(warehouse.whse_code ?? "").trim();
    const key = `warehouse:${id}`;
    const status = warehouse.is_active === false ? "Inactive" : "Active";
    const flockCard = flockCardByWarehouseId.get(id) ??
      flockCardByBuildingKey.get(key) ??
      flockCardByBuildingCode.get(code.toUpperCase()) ??
      null;
    const placementAnimalQty = await getPlacementInventoryAnimalQty(code);
    const displayedFlockCard = flockCard && placementAnimalQty > 0
      ? { ...flockCard, animalQty: placementAnimalQty }
      : flockCard;

    if (displayedFlockCard) cardIdsAttachedToWarehouseRows.add(displayedFlockCard.id);

    return {
      key,
      id,
      farmId,
      code,
      name: String(warehouse.whse_name ?? "").trim(),
      status,
      remarks: null,
      source: "WAREHOUSE" as const,
      warehouseCode: code,
      flockCard: displayedFlockCard,
    };
  }));

  const flockCardOnlyRows = await Promise.all(cards.flatMap(async card => {
    if (cardIdsAttachedToWarehouseRows.has(Number(card.id))) return [];

    const info = cardToListInfo(card);
    const buildingWarehouseId = Number(card.building_whse_id ?? 0);
    const code = String(card.building_code ?? "").trim();
    const key = card.building_key?.trim() || (buildingWarehouseId > 0 ? `warehouse:${buildingWarehouseId}` : `flock-card:${card.id}`);

    if (!code && !buildingWarehouseId) return [];
    const placementAnimalQty = await getPlacementInventoryAnimalQty(code || null);
    const displayedInfo = placementAnimalQty > 0
      ? { ...info, animalQty: placementAnimalQty }
      : info;

    return [{
      key,
      id: buildingWarehouseId > 0 ? buildingWarehouseId : null,
      farmId,
      code: code || key,
      name: String(card.building_name ?? "").trim(),
      status: "Occupied",
      remarks: null,
      source: "WAREHOUSE" as const,
      warehouseCode: code || null,
      flockCard: displayedInfo,
    }];
  }));

  return [...warehouseRows, ...flockCardOnlyRows.flat()].sort((left, right) =>
    left.code.localeCompare(right.code) || left.name.localeCompare(right.name)
  );
}

async function getAssociatedWarehouseRows(farmId: number) {
  if (!Number.isFinite(farmId)) return [];

  const { data, error } = await activeApprovedFarmsQuery(db.from("farms").select("associated_warehouses"))
    .eq("id", farmId)
    .single();

  if (error) throwDbError(error, "Unable to load farm warehouse links");

  return Array.isArray(data?.associated_warehouses)
    ? data.associated_warehouses as AssociatedWarehouseRow[]
    : [];
}

function signedPostingQty(row: InventoryPostingBatchRow) {
  const qty = Number(row.qty ?? 0);
  return row.transfer_type === "OUT" ? -qty : qty;
}

function addFarmPostingQuantities(
  rows: InventoryPostingBatchRow[],
  farmWarehouseCodes: Set<string>,
  quantityByItemBatch: Map<string, FarmOriginBatchOption>,
  receiptIdsByPostingBatch: Map<string, number[]>,
  originalBatchesByConsolidatedBatch: Map<string, Array<{ batchNumber: string; receiptId: number }>>,
) {
  const seenPostingIds = new Set<number>();

  for (const row of rows) {
    if (seenPostingIds.has(row.id)) continue;
    seenPostingIds.add(row.id);

    const itemCode = String(row.item_code ?? "").trim();
    const warehouseCode = String(row.warehouse_code ?? "").trim();
    const batchNumber = String(row.batch_number || row.ref || "").trim();

    if (!itemCode || !farmWarehouseCodes.has(warehouseCode.toUpperCase()) || !batchNumber) continue;

    const key = [itemCode.toUpperCase(), batchNumber.toUpperCase(), warehouseCode.toUpperCase()].join("|");
    const current = quantityByItemBatch.get(key);
    const sourceDocType = String(row.source_doc_type ?? "").trim().toUpperCase();
    const sourceDocEntry = Number(row.source_docentry ?? 0);
    const consolidatedBatchNumber = String(row.ref2 ?? "").trim();

    if (
      (sourceDocType === "DOC_RECEIVING_CONSOLIDATION" || sourceDocType === "GOODS_RECEIPT") &&
      Number.isFinite(sourceDocEntry) &&
      sourceDocEntry > 0
    ) {
      const receiptIds = receiptIdsByPostingBatch.get(key) ?? [];
      if (!receiptIds.includes(sourceDocEntry)) {
        receiptIds.push(sourceDocEntry);
        receiptIdsByPostingBatch.set(key, receiptIds);
      }
    }

    if (
      sourceDocType === "DOC_RECEIVING_CONSOLIDATION" &&
      row.transfer_type === "OUT" &&
      consolidatedBatchNumber
    ) {
      const consolidatedKey = [
        itemCode.toUpperCase(),
        consolidatedBatchNumber.toUpperCase(),
        warehouseCode.toUpperCase(),
      ].join("|");
      const originalBatches = originalBatchesByConsolidatedBatch.get(consolidatedKey) ?? [];
      if (!originalBatches.some(value =>
        value.receiptId === sourceDocEntry &&
        value.batchNumber.toUpperCase() === batchNumber.toUpperCase()
      )) {
        originalBatches.push({ batchNumber, receiptId: sourceDocEntry });
        originalBatchesByConsolidatedBatch.set(consolidatedKey, originalBatches);
      }
    }

    quantityByItemBatch.set(key, {
      id: key,
      itemCode,
      itemName: current?.itemName ?? "",
      batchNumber,
      warehouseCode: current?.warehouseCode || warehouseCode,
      warehouseName: current?.warehouseName ?? "",
      onHandQty: (current?.onHandQty ?? 0) + signedPostingQty(row),
      batchQuantity: (current?.batchQuantity ?? 0) +
        (row.transfer_type === "OUT" ? 0 : Number(row.qty ?? 0)),
      manufacturingDate: current?.manufacturingDate ?? "",
      expiryDate: current?.expiryDate ?? "",
      grOrigin: current?.grOrigin ?? "",
      docDetails: current?.docDetails ?? [],
      mortalityQty: current?.mortalityQty ?? 0,
      thinningQty: current?.thinningQty ?? 0,
      batchOnHandQty: current?.batchOnHandQty ?? 0,
    });
  }
}

function mortalityAllocationKey(itemCode: string, batchNumber: string, warehouseCode: string) {
  return [
    itemCode.trim().toUpperCase(),
    batchNumber.trim().toUpperCase(),
    warehouseCode.trim().toUpperCase(),
  ].join("|");
}

async function getMortalityThinningByBatch(
  rows: FarmOriginBatchOption[],
): Promise<Map<string, { mortalityQty: number; thinningQty: number }>> {
  const itemCodes = Array.from(new Set(rows.map(row => row.itemCode.trim()).filter(Boolean)));
  const batchNumbers = Array.from(new Set(rows.map(row => row.batchNumber.trim()).filter(Boolean)));
  const warehouseCodes = Array.from(new Set(rows.map(row => row.warehouseCode.trim()).filter(Boolean)));
  if (itemCodes.length === 0 || batchNumbers.length === 0 || warehouseCodes.length === 0) return new Map();

  const lineResult = await db
    .from("brd_fc_line")
    .select("mort_total, thin_am, thin_pm, row_total, extra")
    .eq("void", "1")
    .not("extra", "is", null);

  if (lineResult.error) throwDbError(lineResult.error, "Unable to load flock mortality/thinning totals");

  const itemCodeSet = new Set(itemCodes.map(value => value.toUpperCase()));
  const batchNumberSet = new Set(batchNumbers.map(value => value.toUpperCase()));
  const warehouseCodeSet = new Set(warehouseCodes.map(value => value.toUpperCase()));
  const totalsByBatch = new Map<string, { mortalityQty: number; thinningQty: number }>();

  for (const line of (lineResult.data ?? []) as FlockCardMortalityLineRow[]) {
    const extra = line.extra && typeof line.extra === "object" ? line.extra : {};
    const allocations = Array.isArray(extra.mortalityBatchAllocations)
      ? extra.mortalityBatchAllocations
      : [];
    const mortalityTotal = Number(line.mort_total ?? 0);
    const thinningTotal = Number(line.thin_am ?? 0) + Number(line.thin_pm ?? 0);
    const depletionTotal = Number(line.row_total ?? 0) || mortalityTotal + thinningTotal;

    for (const allocation of allocations) {
      if (!allocation || typeof allocation !== "object") continue;

      const row = allocation as Record<string, unknown>;
      const itemCode = String(row.itemCode ?? "").trim();
      const batchNumber = String(row.batchNumber ?? "").trim();
      const warehouseCode = String(row.warehouseCode ?? "").trim();
      const qty = Number(row.allocatedQty ?? 0);

      if (
        !itemCodeSet.has(itemCode.toUpperCase()) ||
        !batchNumberSet.has(batchNumber.toUpperCase()) ||
        !warehouseCodeSet.has(warehouseCode.toUpperCase()) ||
        !Number.isFinite(qty) ||
        qty <= 0
      ) {
        continue;
      }

      const key = mortalityAllocationKey(itemCode, batchNumber, warehouseCode);
      const mortalityQty = depletionTotal > 0 ? qty * (mortalityTotal / depletionTotal) : qty;
      const thinningQty = depletionTotal > 0 ? qty * (thinningTotal / depletionTotal) : 0;
      const current = totalsByBatch.get(key) ?? { mortalityQty: 0, thinningQty: 0 };

      totalsByBatch.set(key, {
        mortalityQty: current.mortalityQty + mortalityQty,
        thinningQty: current.thinningQty + thinningQty,
      });
    }
  }

  return new Map(
    Array.from(totalsByBatch.entries()).map(([key, totals]) => [
      key,
      {
        mortalityQty: Math.round(totals.mortalityQty),
        thinningQty: Math.round(totals.thinningQty),
      },
    ]),
  );
}

export async function getFarmOriginBatchesForFlockCard(
  farmId: number,
  buildingWarehouseCode?: string | null,
): Promise<FarmOriginBatchOption[]> {
  if (!Number.isFinite(farmId)) return [];

  const selectedBuildingCode = String(buildingWarehouseCode ?? "").trim();
  const associatedWarehouses = selectedBuildingCode
    ? []
    : await getAssociatedWarehouseRows(farmId);
  const warehouseCodes = selectedBuildingCode
    ? [selectedBuildingCode]
    : Array.from(new Set(
      associatedWarehouses
        .map(getAssociatedWarehouseCode)
        .filter(Boolean),
    ));

  if (warehouseCodes.length === 0) return [];

  const warehouseResult = await db
    .from("i_warehouse")
    .select("id, whse_code, whse_name, warehouse_type")
    .in("whse_code", warehouseCodes);

  if (warehouseResult.error) throwDbError(warehouseResult.error, "Unable to load farm warehouses");

  const originWarehouseRows = ((warehouseResult.data ?? []) as WarehouseMasterRow[])
    .filter(warehouse =>
      selectedBuildingCode ||
      String(warehouse.warehouse_type ?? "").trim() === "Warehouse"
    );
  const originWarehouseCodes = Array.from(new Set(
    originWarehouseRows
      .map(warehouse => String(warehouse.whse_code ?? "").trim())
      .filter(Boolean),
  ));

  if (originWarehouseCodes.length === 0) return [];

  const warehouseByCode = new Map(
    originWarehouseRows.map(warehouse => [
      String(warehouse.whse_code ?? "").trim().toUpperCase(),
      String(warehouse.whse_name ?? "").trim(),
    ]),
  );

  const postingSelect = "id, source_doc_type, source_docentry, item_code, warehouse_code, qty, transfer_type, ref, ref2, batch_number";
  const refPostingsResult = await db
    .from("inventory_postings")
    .select(postingSelect)
    .in("warehouse_code", originWarehouseCodes)
    .not("ref", "is", null);

  if (refPostingsResult.error) throwDbError(refPostingsResult.error, "Unable to load farm batch quantities");

  const quantityByItemBatch = new Map<string, FarmOriginBatchOption>();
  const receiptIdsByPostingBatch = new Map<string, number[]>();
  const originalBatchesByConsolidatedBatch = new Map<
    string,
    Array<{ batchNumber: string; receiptId: number }>
  >();
  addFarmPostingQuantities(
    (refPostingsResult.data ?? []) as InventoryPostingBatchRow[],
    new Set(originWarehouseCodes.map(code => code.toUpperCase())),
    quantityByItemBatch,
    receiptIdsByPostingBatch,
    originalBatchesByConsolidatedBatch,
  );

  const rows = Array.from(quantityByItemBatch.values())
    .filter(row => row.onHandQty > 0);

  if (rows.length === 0) return [];

  const mortalityThinningByBatch = await getMortalityThinningByBatch(rows);

  const itemCodes = Array.from(new Set(rows.map(row => row.itemCode).filter(Boolean)));
  const batchNumbers = Array.from(new Set([
    ...rows.map(row => row.batchNumber),
    ...Array.from(originalBatchesByConsolidatedBatch.values()).flat().map(value => value.batchNumber),
  ].filter(Boolean)));

  const [batchResult, itemResult, docSettingsResult] = await Promise.all([
    db
      .from("item_batches")
      .select("item_code, batch_number, manufacturing_date, expiry_date, source_gr_id")
      .in("item_code", itemCodes)
      .in("batch_number", batchNumbers)
      .eq("void", "1"),
    db
      .from("items")
      .select("id, item_code, item_name, description, item_group, fms_group, group")
      .in("item_code", itemCodes),
    db
      .from("doc_rec_settings")
      .select("good_doc")
      .eq("void", "1")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (batchResult.error) throwDbError(batchResult.error, "Unable to load batch details");
  if (itemResult.error) throwDbError(itemResult.error, "Unable to load batch item names");
  if (docSettingsResult.error) throwDbError(docSettingsResult.error, "Unable to load DOC receiving settings");

  const batchRows = (batchResult.data ?? []) as ItemBatchOriginRow[];
  const batchByKey = new Map(
    batchRows.map(row => [
      [row.item_code.toUpperCase(), row.batch_number.toUpperCase()].join("|"),
      row,
    ]),
  );
  const goodDocItemId = Number((docSettingsResult.data as DocReceivingSettingsRow | null)?.good_doc ?? 0);
  if (!Number.isFinite(goodDocItemId) || goodDocItemId <= 0) return [];

  const goodDocItems = ((itemResult.data ?? []) as ItemNameRow[])
    .filter(item => Number(item.id ?? 0) === goodDocItemId);
  const goodDocItemCodeSet = new Set(
    goodDocItems.map(item => String(item.item_code ?? "").trim().toUpperCase()).filter(Boolean),
  );

  if (goodDocItemCodeSet.size === 0) return [];

  const itemNameByCode = new Map(
    goodDocItems.map(item => [
      String(item.item_code ?? "").trim().toUpperCase(),
      String(item.item_name || item.description || "").trim(),
    ]),
  );
  const sourceGrIds = Array.from(new Set(
    batchRows
      .map(batch => Number(batch.source_gr_id ?? 0))
      .filter(id => Number.isFinite(id) && id > 0),
  ));
  const grNoById = new Map<number, string>();
  const receiptIdByItemBatch = new Map<string, number>();
  const receiptLineNoByItemBatch = new Map<string, number>();
  const receiptLineNoByExactBatch = new Map<string, number>();
  const docDetailsByReceiptId = new Map<number, FarmOriginDocDetail[]>();
  const docDetailByReceiptLine = new Map<string, FarmOriginDocDetail>();

  const receiptItemResult = await db
    .from("goods_receipt_items")
    .select("goods_reciept_id, line_no, doc_line_no, item_code, batch_number, warehouse_code")
    .in("item_code", itemCodes)
    .in("batch_number", batchNumbers)
    .eq("void", "1");

  if (receiptItemResult.error) throwDbError(receiptItemResult.error, "Unable to load GR batch quantities");

  for (const receiptItem of (receiptItemResult.data ?? []) as GoodsReceiptItemOriginRow[]) {
    const grId = Number(receiptItem.goods_reciept_id ?? 0);
    const lineNo = Number(receiptItem.doc_line_no ?? receiptItem.line_no ?? 0);
    const itemCode = String(receiptItem.item_code ?? "").trim().toUpperCase();
    const batchNumber = String(receiptItem.batch_number ?? "").trim().toUpperCase();
    const warehouseCode = String(receiptItem.warehouse_code ?? "").trim().toUpperCase();
    if (!Number.isFinite(grId) || grId <= 0 || !itemCode || !batchNumber) continue;

    const batchKey = [itemCode, batchNumber].join("|");
    if (!receiptIdByItemBatch.has(batchKey)) receiptIdByItemBatch.set(batchKey, grId);
    if (!receiptLineNoByItemBatch.has(batchKey) && Number.isFinite(lineNo) && lineNo > 0) {
      receiptLineNoByItemBatch.set(batchKey, lineNo);
    }
    if (warehouseCode && Number.isFinite(lineNo) && lineNo > 0) {
      receiptLineNoByExactBatch.set([grId, itemCode, batchNumber, warehouseCode].join("|"), lineNo);
    }

  }

  const receiptIds = Array.from(new Set([
    ...sourceGrIds,
    ...Array.from(receiptIdsByPostingBatch.values()).flat(),
    ...receiptIdByItemBatch.values(),
  ]));

  if (receiptIds.length > 0) {
    const [receiptResult, receiptItemResult, receiptDocResult] = await Promise.all([
      db
        .from("goods_receipt")
        .select("id, gr_no")
        .in("id", receiptIds),
      db
        .from("goods_receipt_items")
        .select("goods_reciept_id, line_no, doc_line_no, item_code, batch_number, warehouse_code")
        .in("goods_reciept_id", receiptIds)
        .eq("void", "1"),
      db
        .from("goods_receipt_doc")
        .select("goods_reciept_id, line_no, receive_date, receive_time, mnf_date, transfer_slip, average_doc_weight, quantity_received, doa_quantity, reject_count, short_count, actual_received, short_count_remarks, doa_count_remarks, reject_count_remarks")
        .in("goods_reciept_id", receiptIds)
        .eq("void", "1")
        .order("line_no", { ascending: true }),
    ]);

    if (receiptResult.error) throwDbError(receiptResult.error, "Unable to load GR origins");
    if (receiptItemResult.error) throwDbError(receiptItemResult.error, "Unable to load GR batch quantities");
    if (receiptDocResult.error) throwDbError(receiptDocResult.error, "Unable to load DOC details");

    for (const receipt of (receiptResult.data ?? []) as GoodsReceiptOriginRow[]) {
      grNoById.set(receipt.id, String(receipt.gr_no ?? "").trim());
    }

    for (const receiptItem of (receiptItemResult.data ?? []) as GoodsReceiptItemOriginRow[]) {
      const grId = Number(receiptItem.goods_reciept_id ?? 0);
      const lineNo = Number(receiptItem.doc_line_no ?? receiptItem.line_no ?? 0);
      const itemCode = String(receiptItem.item_code ?? "").trim().toUpperCase();
      const batchNumber = String(receiptItem.batch_number ?? "").trim().toUpperCase();
      const warehouseCode = String(receiptItem.warehouse_code ?? "").trim().toUpperCase();
      if (!Number.isFinite(grId) || grId <= 0 || !itemCode || !batchNumber) continue;

      const batchKey = [itemCode, batchNumber].join("|");
      if (!receiptLineNoByItemBatch.has(batchKey) && Number.isFinite(lineNo) && lineNo > 0) {
        receiptLineNoByItemBatch.set(batchKey, lineNo);
      }
      if (warehouseCode && Number.isFinite(lineNo) && lineNo > 0) {
        receiptLineNoByExactBatch.set([grId, itemCode, batchNumber, warehouseCode].join("|"), lineNo);
      }

    }

    for (const detail of (receiptDocResult.data ?? []) as GoodsReceiptDocOriginRow[]) {
      const receiptId = Number(detail.goods_reciept_id);
      if (!Number.isFinite(receiptId) || receiptId <= 0) continue;

      const docDetail = toFarmOriginDocDetail(detail);
      const rows = docDetailsByReceiptId.get(receiptId) ?? [];
      rows.push(docDetail);
      docDetailsByReceiptId.set(receiptId, rows);

      const lineNo = Number(detail.line_no ?? 0);
      if (Number.isFinite(lineNo) && lineNo > 0) {
        docDetailByReceiptLine.set([receiptId, lineNo].join("|"), docDetail);
      }
    }
  }

  return rows
    .flatMap(row => {
      if (!goodDocItemCodeSet.has(row.itemCode.toUpperCase())) return [];

      const itemCodeKey = row.itemCode.toUpperCase();
      const batchNumberKey = row.batchNumber.toUpperCase();
      const warehouseCodeKey = row.warehouseCode.toUpperCase();
      const postingBatchKey = [itemCodeKey, batchNumberKey, warehouseCodeKey].join("|");
      const batch = batchByKey.get([itemCodeKey, batchNumberKey].join("|"));
      const sourceGrId = Number(batch?.source_gr_id ?? 0);
      const postingReceiptIds = receiptIdsByPostingBatch.get(postingBatchKey) ?? [];
      const receiptId = sourceGrId > 0
        ? sourceGrId
        : postingReceiptIds[0] ??
          receiptIdByItemBatch.get([itemCodeKey, batchNumberKey].join("|")) ??
          0;
      const receiptLineNo =
        receiptLineNoByExactBatch.get([receiptId, itemCodeKey, batchNumberKey, warehouseCodeKey].join("|")) ??
        receiptLineNoByItemBatch.get([itemCodeKey, batchNumberKey].join("|")) ??
        0;
      const batchQuantity = row.batchQuantity;
      const depletion = mortalityThinningByBatch.get(mortalityAllocationKey(row.itemCode, row.batchNumber, row.warehouseCode)) ??
        { mortalityQty: 0, thinningQty: 0 };
      const batchOnHandQty = Math.max(row.onHandQty - depletion.mortalityQty - depletion.thinningQty, 0);
      const receiptDocDetails = receiptId > 0 ? docDetailsByReceiptId.get(receiptId) ?? [] : [];
      const linkedOriginalBatches = [
        ...(originalBatchesByConsolidatedBatch.get(postingBatchKey) ?? []),
      ].sort((left, right) =>
        left.receiptId - right.receiptId ||
        left.batchNumber.localeCompare(right.batchNumber)
      );
      const linkedDocDetailsByKey = new Map<string, FarmOriginDocDetail>();
      for (const originalBatch of linkedOriginalBatches) {
        const originalBatchKey = originalBatch.batchNumber.trim().toUpperCase();
        const lineNo =
          receiptLineNoByExactBatch.get([
            originalBatch.receiptId,
            itemCodeKey,
            originalBatchKey,
            warehouseCodeKey,
          ].join("|")) ??
          receiptLineNoByItemBatch.get([itemCodeKey, originalBatchKey].join("|")) ??
          0;
        const detail = lineNo > 0
          ? docDetailByReceiptLine.get([originalBatch.receiptId, lineNo].join("|"))
          : undefined;
        if (detail) {
          linkedDocDetailsByKey.set([originalBatch.receiptId, lineNo].join("|"), {
            ...detail,
            grOrigin: grNoById.get(originalBatch.receiptId) ?? "",
          });
        }
      }
      const linkedDocDetails = Array.from(linkedDocDetailsByKey.values());
      const matchedDocDetail = receiptId > 0 && receiptLineNo > 0
        ? docDetailByReceiptLine.get([receiptId, receiptLineNo].join("|"))
        : undefined;
      const quantityMatchedDocDetail = receiptDocDetails.find(detail =>
        Math.abs(Number(detail.actualReceived ?? 0) - Number(row.onHandQty ?? 0)) < 0.000001 ||
        Math.abs(Number(detail.actualReceived ?? 0) - Number(batchQuantity ?? 0)) < 0.000001
      );
      const docDetails = linkedDocDetails.length > 0
        ? linkedDocDetails
        : matchedDocDetail
        ? [matchedDocDetail]
        : quantityMatchedDocDetail ? [quantityMatchedDocDetail] : receiptDocDetails;
      const baseRow = {
        ...row,
        itemName: itemNameByCode.get(row.itemCode.toUpperCase()) ?? row.itemName,
        warehouseName: warehouseByCode.get(row.warehouseCode.toUpperCase()) ?? row.warehouseName,
        batchQuantity,
        manufacturingDate: batch?.manufacturing_date ?? "",
        expiryDate: batch?.expiry_date ?? "",
        grOrigin: receiptId > 0 ? grNoById.get(receiptId) ?? "" : "",
        mortalityQty: depletion.mortalityQty,
        thinningQty: depletion.thinningQty,
        batchOnHandQty,
      };

      return [{
        ...baseRow,
        onHandQty: batchOnHandQty,
        docDetails,
      }];
    })
    .sort((left, right) => {
      const leftDate = left.expiryDate || "9999-12-31";
      const rightDate = right.expiryDate || "9999-12-31";
      return leftDate.localeCompare(rightDate) ||
        left.warehouseCode.localeCompare(right.warehouseCode) ||
        left.itemCode.localeCompare(right.itemCode) ||
        left.batchNumber.localeCompare(right.batchNumber);
    });
}

export async function getBuildingPlacementInventory(
  lookup: BuildingPlacementInventoryLookup,
): Promise<FarmOriginBatchOption[]> {
  const farmId = Number(lookup.farmId ?? 0);
  if (!Number.isFinite(farmId) || farmId <= 0) return [];

  const directWarehouseCode = String(lookup.buildingWarehouseCode ?? "").trim();
  if (directWarehouseCode) return getFarmOriginBatchesForFlockCard(farmId, directWarehouseCode);

  const buildingCode = String(lookup.buildingCode ?? "").trim();
  const buildingName = String(lookup.buildingName ?? "").trim();
  const buildingKey = String(lookup.buildingKey ?? "").trim();

  if (!buildingCode && !buildingName && !buildingKey) return [];

  const buildings = await getFarmBuildingsForFlockCard(farmId);
  const normalizedCode = buildingCode.toUpperCase();
  const normalizedName = buildingName.toUpperCase();

  const building = buildings.find(row =>
    (buildingKey && row.key === buildingKey) ||
    (normalizedCode && row.code.trim().toUpperCase() === normalizedCode) ||
    (normalizedName && row.name.trim().toUpperCase() === normalizedName)
  );

  const warehouseCode = building?.warehouseCode || building?.code || buildingCode;
  return warehouseCode ? getFarmOriginBatchesForFlockCard(farmId, warehouseCode) : [];
}
