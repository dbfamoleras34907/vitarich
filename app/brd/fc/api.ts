import { db } from "@/lib/Supabase/supabaseClient";

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
  manufacturingDate: string;
  expiryDate: string;
  grOrigin: string;
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
  item_code: string | null;
  warehouse_code: string | null;
  qty: number | null;
  transfer_type: string | null;
  ref: string | null;
  ref2: string | null;
};

type ItemBatchOriginRow = {
  item_code: string;
  batch_number: string;
  manufacturing_date: string | null;
  expiry_date: string | null;
  source_gr_id: number | null;
};

type ItemNameRow = {
  item_code: string | null;
  item_name: string | null;
  description: string | null;
  item_group: string | null;
  fms_group: string | null;
  group: string | null;
};

type GoodsReceiptOriginRow = {
  id: number;
  gr_no: string | null;
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

  const { data, error } = await db
    .from("farms")
    .select("id, code, name, address, farm_type, contact_person")
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

  const farmResult = await db
    .from("farms")
    .select("id, code, associated_warehouses")
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

    return {
      id: cardId,
      cardNo: String(card.card_no ?? "").trim(),
      age: Number(card.age ?? 0),
      startDate: String(card.start_date ?? "").trim(),
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

  const warehouseRows = Array.from(warehouseById.values()).map(warehouse => {
    const id = Number(warehouse.id);
    const code = String(warehouse.whse_code ?? "").trim();
    const key = `warehouse:${id}`;
    const status = warehouse.is_active === false ? "Inactive" : "Active";
    const flockCard = flockCardByWarehouseId.get(id) ??
      flockCardByBuildingKey.get(key) ??
      flockCardByBuildingCode.get(code.toUpperCase()) ??
      null;

    if (flockCard) cardIdsAttachedToWarehouseRows.add(flockCard.id);

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
      flockCard,
    };
  });

  const flockCardOnlyRows = cards.flatMap(card => {
    if (cardIdsAttachedToWarehouseRows.has(Number(card.id))) return [];

    const info = cardToListInfo(card);
    const buildingWarehouseId = Number(card.building_whse_id ?? 0);
    const code = String(card.building_code ?? "").trim();
    const key = card.building_key?.trim() || (buildingWarehouseId > 0 ? `warehouse:${buildingWarehouseId}` : `flock-card:${card.id}`);

    if (!code && !buildingWarehouseId) return [];

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
      flockCard: info,
    }];
  });

  return [...warehouseRows, ...flockCardOnlyRows].sort((left, right) =>
    left.code.localeCompare(right.code) || left.name.localeCompare(right.name)
  );
}

async function getAssociatedWarehouseRows(farmId: number) {
  if (!Number.isFinite(farmId)) return [];

  const { data, error } = await db
    .from("farms")
    .select("associated_warehouses")
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
) {
  const seenPostingIds = new Set<number>();

  for (const row of rows) {
    if (seenPostingIds.has(row.id)) continue;
    seenPostingIds.add(row.id);

    const itemCode = String(row.item_code ?? "").trim();
    const warehouseCode = String(row.warehouse_code ?? "").trim();
    const ref = String(row.ref ?? "").trim();
    const ref2 = String(row.ref2 ?? "").trim();
    const batchNumbers = Array.from(new Set([ref, ref2].filter(Boolean)));

    if (!itemCode || !farmWarehouseCodes.has(warehouseCode.toUpperCase()) || batchNumbers.length === 0) continue;

    for (const batchNumber of batchNumbers) {
      const key = [itemCode.toUpperCase(), batchNumber.toUpperCase(), warehouseCode.toUpperCase()].join("|");
      const current = quantityByItemBatch.get(key);

      quantityByItemBatch.set(key, {
        id: key,
        itemCode,
        itemName: current?.itemName ?? "",
        batchNumber,
        warehouseCode: current?.warehouseCode || warehouseCode,
        warehouseName: current?.warehouseName ?? "",
        onHandQty: (current?.onHandQty ?? 0) + signedPostingQty(row),
        manufacturingDate: current?.manufacturingDate ?? "",
        expiryDate: current?.expiryDate ?? "",
        grOrigin: current?.grOrigin ?? "",
      });
    }
  }
}

function isDocItem(item: ItemNameRow) {
  const tokens = [
    item.item_code,
    item.item_group,
    item.fms_group,
    item.group,
  ].map(value => String(value ?? "").trim().toUpperCase());

  return tokens.some(token => token === "DOC" || token.startsWith("DOC"));
}

export async function getFarmOriginBatchesForFlockCard(
  farmId: number,
): Promise<FarmOriginBatchOption[]> {
  if (!Number.isFinite(farmId)) return [];

  const associatedWarehouses = await getAssociatedWarehouseRows(farmId);
  const warehouseCodes = Array.from(new Set(
    associatedWarehouses
      .map(warehouse => String(warehouse?.whse_code ?? "").trim())
      .filter(Boolean),
  ));

  if (warehouseCodes.length === 0) return [];

  const warehouseResult = await db
    .from("i_warehouse")
    .select("id, whse_code, whse_name, warehouse_type")
    .in("whse_code", warehouseCodes);

  if (warehouseResult.error) throwDbError(warehouseResult.error, "Unable to load farm warehouses");

  const warehouseByCode = new Map(
    ((warehouseResult.data ?? []) as WarehouseMasterRow[]).map(warehouse => [
      String(warehouse.whse_code ?? "").trim().toUpperCase(),
      String(warehouse.whse_name ?? "").trim(),
    ]),
  );

  const postingSelect = "id, item_code, warehouse_code, qty, transfer_type, ref, ref2";
  const [refPostingsResult, ref2PostingsResult] = await Promise.all([
    db
      .from("inventory_postings")
      .select(postingSelect)
      .in("warehouse_code", warehouseCodes)
      .not("ref", "is", null),
    db
      .from("inventory_postings")
      .select(postingSelect)
      .in("warehouse_code", warehouseCodes)
      .not("ref2", "is", null),
  ]);

  if (refPostingsResult.error) throwDbError(refPostingsResult.error, "Unable to load farm batch quantities");
  if (ref2PostingsResult.error) throwDbError(ref2PostingsResult.error, "Unable to load farm batch quantities");

  const quantityByItemBatch = new Map<string, FarmOriginBatchOption>();
  addFarmPostingQuantities(
    [
      ...((refPostingsResult.data ?? []) as InventoryPostingBatchRow[]),
      ...((ref2PostingsResult.data ?? []) as InventoryPostingBatchRow[]),
    ],
    new Set(warehouseCodes.map(code => code.toUpperCase())),
    quantityByItemBatch,
  );

  const rows = Array.from(quantityByItemBatch.values())
    .filter(row => row.onHandQty > 0);

  if (rows.length === 0) return [];

  const itemCodes = Array.from(new Set(rows.map(row => row.itemCode).filter(Boolean)));
  const batchNumbers = Array.from(new Set(rows.map(row => row.batchNumber).filter(Boolean)));

  const [batchResult, itemResult] = await Promise.all([
    db
      .from("item_batches")
      .select("item_code, batch_number, manufacturing_date, expiry_date, source_gr_id")
      .in("item_code", itemCodes)
      .in("batch_number", batchNumbers)
      .eq("void", "1"),
    db
      .from("items")
      .select("item_code, item_name, description, item_group, fms_group, group")
      .in("item_code", itemCodes),
  ]);

  if (batchResult.error) throwDbError(batchResult.error, "Unable to load batch details");
  if (itemResult.error) throwDbError(itemResult.error, "Unable to load batch item names");

  const batchRows = (batchResult.data ?? []) as ItemBatchOriginRow[];
  const batchByKey = new Map(
    batchRows.map(row => [
      [row.item_code.toUpperCase(), row.batch_number.toUpperCase()].join("|"),
      row,
    ]),
  );
  const docItems = ((itemResult.data ?? []) as ItemNameRow[]).filter(isDocItem);
  const docItemCodeSet = new Set(
    docItems
      .map(item => String(item.item_code ?? "").trim().toUpperCase())
      .filter(Boolean),
  );
  const itemNameByCode = new Map(
    docItems.map(item => [
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

  if (sourceGrIds.length > 0) {
    const { data: receiptRows, error: receiptError } = await db
      .from("goods_receipt")
      .select("id, gr_no")
      .in("id", sourceGrIds);

    if (receiptError) throwDbError(receiptError, "Unable to load GR origins");

    for (const receipt of (receiptRows ?? []) as GoodsReceiptOriginRow[]) {
      grNoById.set(receipt.id, String(receipt.gr_no ?? "").trim());
    }
  }

  return rows
    .flatMap(row => {
      if (!docItemCodeSet.has(row.itemCode.toUpperCase())) return [];

      const batch = batchByKey.get([row.itemCode.toUpperCase(), row.batchNumber.toUpperCase()].join("|"));
      if (!batch) return [];

      return [{
        ...row,
        itemName: itemNameByCode.get(row.itemCode.toUpperCase()) ?? row.itemName,
        warehouseName: warehouseByCode.get(row.warehouseCode.toUpperCase()) ?? row.warehouseName,
        manufacturingDate: batch.manufacturing_date ?? "",
        expiryDate: batch.expiry_date ?? "",
        grOrigin: batch.source_gr_id ? grNoById.get(batch.source_gr_id) ?? "" : "",
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
