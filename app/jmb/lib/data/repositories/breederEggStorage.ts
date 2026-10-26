import { EGG_DISPATCH_CATEGORIES, eggDispatchQuantity, type EggDispatchCategory } from "@/app/jmb/lib/breederEggCategories";
import { db } from "@/lib/Supabase/supabaseClient";
import { listBreederEggLayings } from "./breederEggLaying";

const DISPATCH_HEADER_TABLE = "tbl_brd_dispatch";
const DISPATCH_LINE_TABLE = "tbl_brd_dispatch_line";
const PAGE_SIZE = 1000;
const DISPATCH_ID_CHUNK_SIZE = 300;

/** Eggs at or above this storage age are surfaced as an overstay warning. */
export const OVERSTAY_EGG_STORAGE_DAYS = 4;
/** Eggs at or above this storage age are surfaced as a critical overstay. */
export const CRITICAL_OVERSTAY_EGG_STORAGE_DAYS = 8;

export type BreederEggStorageRow = {
  sourceRecordId: number;
  sourceDate: string;
  farmId: number | null;
  buildingId: number | null;
  buildingName: string;
  category: EggDispatchCategory;
  categoryLabel: string;
  sourceQuantity: number;
  dispatchedQuantity: number;
  remainingQuantity: number;
  ageDays: number;
};

export type BreederEggStorageSummary = {
  asOf: string;
  overstayAgeDays: number;
  totalRemainingQuantity: number;
  overstayQuantity: number;
  warningQuantity: number;
  criticalQuantity: number;
  criticalAgeDays: number;
  oldestAgeDays: number | null;
  overstaySourceDays: number;
  overstayBuildingCount: number;
  rows: BreederEggStorageRow[];
};

type PostedEggDispatchLine = {
  source_record_id: number;
  category: EggDispatchCategory;
  dispatch_qty: number | null;
};

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function storageAgeDays(sourceDate: string, asOf: string) {
  const toMilliseconds = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const source = toMilliseconds(sourceDate);
  const end = toMilliseconds(asOf);
  if (!Number.isFinite(source) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - source) / 86_400_000));
}

function sourceKey(sourceRecordId: number, category: EggDispatchCategory) {
  return `${sourceRecordId}:${category}`;
}

async function listPostedEggDispatchAllocations(farmId: number | undefined, asOf: string) {
  const dispatchIds: number[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = db
      .from(DISPATCH_HEADER_TABLE)
      .select("id")
      .eq("status", "Posted")
      .lte("dispatch_date", asOf)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (farmId) query = query.eq("farm_id", farmId);
    const { data, error } = await query;
    if (error) throw error;
    dispatchIds.push(...(data ?? []).map((row) => Number(row.id)).filter(Number.isInteger));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }

  const allocations = new Map<string, number>();
  for (let start = 0; start < dispatchIds.length; start += DISPATCH_ID_CHUNK_SIZE) {
    const ids = dispatchIds.slice(start, start + DISPATCH_ID_CHUNK_SIZE);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await db
        .from(DISPATCH_LINE_TABLE)
        .select("source_record_id, category, dispatch_qty")
        .in("dispatch_id", ids)
        .eq("source_type", "Egg Laying")
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      for (const row of (data ?? []) as PostedEggDispatchLine[]) {
        const key = sourceKey(Number(row.source_record_id), row.category);
        allocations.set(key, (allocations.get(key) ?? 0) + numeric(row.dispatch_qty));
      }
      if ((data?.length ?? 0) < PAGE_SIZE) break;
    }
  }
  return allocations;
}

/**
 * Returns remaining Egg Laying inventory and its age as of a calendar date.
 * Only Posted dispatches on or before that date consume the source quantity.
 */
export async function getBreederEggStorageSummary(input: {
  asOf: string;
  farmId?: number;
  overstayAgeDays?: number;
}): Promise<BreederEggStorageSummary> {
  const overstayAgeDays = input.overstayAgeDays ?? OVERSTAY_EGG_STORAGE_DAYS;
  const [eggs, allocations] = await Promise.all([
    listBreederEggLayings({ farmId: input.farmId, to: input.asOf, ascending: true }),
    listPostedEggDispatchAllocations(input.farmId, input.asOf),
  ]);
  const rows: BreederEggStorageRow[] = [];

  for (const egg of eggs) {
    for (const [category, categoryLabel] of EGG_DISPATCH_CATEGORIES) {
      const sourceQuantity = eggDispatchQuantity(egg, category);
      const dispatchedQuantity = numeric(allocations.get(sourceKey(Number(egg.id), category)));
      const remainingQuantity = Math.max(0, sourceQuantity - dispatchedQuantity);
      if (!remainingQuantity) continue;
      rows.push({
        sourceRecordId: Number(egg.id),
        sourceDate: egg.date_laying.slice(0, 10),
        farmId: egg.farm_id,
        buildingId: egg.building_id,
        buildingName: egg.building?.trim() || "Unspecified building",
        category,
        categoryLabel,
        sourceQuantity,
        dispatchedQuantity,
        remainingQuantity,
        ageDays: storageAgeDays(egg.date_laying, input.asOf),
      });
    }
  }

  const overstayRows = rows.filter((row) => row.ageDays >= overstayAgeDays);
  const warningRows = rows.filter((row) => row.ageDays >= overstayAgeDays && row.ageDays < CRITICAL_OVERSTAY_EGG_STORAGE_DAYS);
  const criticalRows = rows.filter((row) => row.ageDays >= CRITICAL_OVERSTAY_EGG_STORAGE_DAYS);
  return {
    asOf: input.asOf,
    overstayAgeDays,
    totalRemainingQuantity: rows.reduce((total, row) => total + row.remainingQuantity, 0),
    overstayQuantity: overstayRows.reduce((total, row) => total + row.remainingQuantity, 0),
    warningQuantity: warningRows.reduce((total, row) => total + row.remainingQuantity, 0),
    criticalQuantity: criticalRows.reduce((total, row) => total + row.remainingQuantity, 0),
    criticalAgeDays: CRITICAL_OVERSTAY_EGG_STORAGE_DAYS,
    oldestAgeDays: rows.length ? Math.max(...rows.map((row) => row.ageDays)) : null,
    overstaySourceDays: new Set(overstayRows.map((row) => row.sourceDate)).size,
    overstayBuildingCount: new Set(overstayRows.map((row) => `${row.buildingId ?? row.buildingName}`)).size,
    rows: rows.sort((left, right) => right.sourceDate.localeCompare(left.sourceDate)
      || left.buildingName.localeCompare(right.buildingName)
      || left.categoryLabel.localeCompare(right.categoryLabel)),
  };
}
