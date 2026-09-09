import { db } from "@/lib/Supabase/supabaseClient";
import {
  listAvailableBreederFlocks,
  type AvailableBreederFlock,
} from "../../breederdispatch/new/api";
import {
  getUserInfo,
  listBreederFarms,
  listFarmLocationLookup,
  type BreederFarm,
  type FarmLocationLookup,
} from "../../placement/new/api";

const TABLE = "tbl_breeder_cleanup";
const CYCLE_TABLE = "tbl_breeder_cycle";

export { getUserInfo, listBreederFarms, listFarmLocationLookup };
export type { BreederFarm, FarmLocationLookup };

type CycleRow = {
  id: number;
  farm_id: number;
  building_id: number;
  pen_id: number;
  cycle_no: number;
  status: string;
};

type PlacementWithCycle = AvailableBreederFlock & { cycle_id?: number | null };

export type BreederCleanupRow = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  cycle_id: number;
  farm_id: number;
  building_id: number;
  pen_id: number;
  female_system_balance: number;
  male_system_balance: number;
  female_cleanup_qty: number;
  male_cleanup_qty: number;
  reason: string;
  remarks: string | null;
};

export type BreederCleanupRecord = BreederCleanupRow & {
  cycle_no: number | null;
  cycle_status: string | null;
  farm_code: string | null;
  farm_name: string;
  building_name: string;
  pen_name: string;
};

export type BreederCleanupCycle = {
  id: number;
  cycle_no: number;
  status: string;
  farm_id: number;
  farm_code: string | null;
  farm_name: string;
  building_id: number;
  building_name: string;
  pen_id: number;
  pen_name: string;
  female_system_balance: number;
  male_system_balance: number;
};

export type BreederCleanupInput = {
  cycle_id: number;
  female_cleanup_qty: number;
  male_cleanup_qty: number;
  reason: string;
  remarks: string | null;
};

export type BreederCleanupPenBalance = {
  farm_id: number;
  building_id: number;
  pen_id: number;
  female_system_balance: number;
  male_system_balance: number;
};

function count(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function localDate() {
  return new Date().toLocaleDateString("en-CA");
}

async function locationMaps(cycles: CycleRow[]) {
  const farmIds = [...new Set(cycles.map((cycle) => cycle.farm_id))];
  const warehouseIds = [...new Set(cycles.flatMap((cycle) => [cycle.building_id, cycle.pen_id]))];
  const [farmResult, warehouseResult] = await Promise.all([
    farmIds.length
      ? db.from("farms").select("id, code, name").in("id", farmIds)
      : Promise.resolve({ data: [], error: null }),
    warehouseIds.length
      ? db.from("i_warehouse").select("id, whse_code, whse_name").in("id", warehouseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (farmResult.error) throw farmResult.error;
  if (warehouseResult.error) throw warehouseResult.error;
  return {
    farms: new Map((farmResult.data ?? []).map((farm) => [farm.id, farm])),
    warehouses: new Map((warehouseResult.data ?? []).map((warehouse) => [warehouse.id, warehouse])),
  };
}

function warehouseLabel(warehouse?: { whse_code: string | null; whse_name: string | null }) {
  if (!warehouse) return "Unknown location";
  if (warehouse.whse_code && warehouse.whse_name && warehouse.whse_code !== warehouse.whse_name) {
    return `${warehouse.whse_code} - ${warehouse.whse_name}`;
  }
  return warehouse.whse_name || warehouse.whse_code || "Unknown location";
}

export async function listBreederCleanupPenBalances() {
  const [flocks, { data: cleanupRows, error: cleanupError }] = await Promise.all([
    listAvailableBreederFlocks(localDate()),
    db.from(TABLE).select("farm_id, building_id, pen_id, female_cleanup_qty, male_cleanup_qty"),
  ]);
  if (cleanupError) throw cleanupError;
  const balances = new Map<string, BreederCleanupPenBalance>();
  flocks.forEach((flock) => {
    const key = `${flock.farm_id}:${flock.building_id}:${flock.pen_id}`;
    const current = balances.get(key) ?? {
      farm_id: flock.farm_id,
      building_id: flock.building_id,
      pen_id: flock.pen_id,
      female_system_balance: 0,
      male_system_balance: 0,
    };
    current.female_system_balance += count(flock.female_available);
    current.male_system_balance += count(flock.male_available);
    balances.set(key, current);
  });
  (cleanupRows ?? []).forEach((row) => {
    const key = `${row.farm_id}:${row.building_id}:${row.pen_id}`;
    const current = balances.get(key);
    if (!current) return;
    current.female_system_balance = Math.max(0, current.female_system_balance - count(row.female_cleanup_qty));
    current.male_system_balance = Math.max(0, current.male_system_balance - count(row.male_cleanup_qty));
  });
  return [...balances.values()];
}

export async function listBreederCleanupCycles(includeCycleId?: number) {
  const [{ data: cyclesData, error: cycleError }, { data: existingData, error: existingError }, flocks] =
    await Promise.all([
      db.from(CYCLE_TABLE).select("id, farm_id, building_id, pen_id, cycle_no, status").order("cycle_no", { ascending: false }),
      db.from(TABLE).select("cycle_id, female_cleanup_qty, male_cleanup_qty"),
      listAvailableBreederFlocks(localDate()),
    ]);
  if (cycleError) throw cycleError;
  if (existingError) throw existingError;

  const cycles = (cyclesData ?? []) as CycleRow[];
  const priorCleanup = new Map<number, { female: number; male: number }>();
  (existingData ?? []).forEach((row) => {
    const cycleId = Number(row.cycle_id);
    const current = priorCleanup.get(cycleId) ?? { female: 0, male: 0 };
    current.female += count(row.female_cleanup_qty);
    current.male += count(row.male_cleanup_qty);
    priorCleanup.set(cycleId, current);
  });
  const balances = new Map<number, { female: number; male: number }>();
  (flocks as PlacementWithCycle[]).forEach((flock) => {
    const cycleId = Number(flock.cycle_id ?? 0);
    if (!cycleId) return;
    const current = balances.get(cycleId) ?? { female: 0, male: 0 };
    current.female += count(flock.female_available);
    current.male += count(flock.male_available);
    balances.set(cycleId, current);
  });
  const { farms, warehouses } = await locationMaps(cycles);

  return cycles
    .filter((cycle) => cycle.id === includeCycleId || cycle.status.toLowerCase() === "active")
    .map((cycle): BreederCleanupCycle => {
      const farm = farms.get(cycle.farm_id);
      const balance = balances.get(cycle.id) ?? { female: 0, male: 0 };
      const cleaned = priorCleanup.get(cycle.id) ?? { female: 0, male: 0 };
      return {
        id: cycle.id,
        cycle_no: cycle.cycle_no,
        status: cycle.status,
        farm_id: cycle.farm_id,
        farm_code: farm?.code ?? null,
        farm_name: farm?.name || farm?.code || `Farm ${cycle.farm_id}`,
        building_id: cycle.building_id,
        building_name: warehouseLabel(warehouses.get(cycle.building_id)),
        pen_id: cycle.pen_id,
        pen_name: warehouseLabel(warehouses.get(cycle.pen_id)),
        female_system_balance: Math.max(0, balance.female - cleaned.female),
        male_system_balance: Math.max(0, balance.male - cleaned.male),
      };
    });
}

export async function listBreederCleanups() {
  const [{ data, error }, { data: cyclesData, error: cycleError }] = await Promise.all([
    db.from(TABLE).select("*").order("created_at", { ascending: false }).order("id", { ascending: false }),
    db.from(CYCLE_TABLE).select("id, farm_id, building_id, pen_id, cycle_no, status"),
  ]);
  if (error) throw error;
  if (cycleError) throw cycleError;
  const cycles = (cyclesData ?? []) as CycleRow[];
  const cycleById = new Map(cycles.map((cycle) => [cycle.id, cycle]));
  const { farms, warehouses } = await locationMaps(cycles);
  return ((data ?? []) as BreederCleanupRow[]).map((row): BreederCleanupRecord => {
    const cycle = cycleById.get(row.cycle_id);
    const farm = farms.get(row.farm_id);
    return {
      ...row,
      cycle_no: cycle?.cycle_no ?? null,
      cycle_status: cycle?.status ?? null,
      farm_code: farm?.code ?? null,
      farm_name: farm?.name || farm?.code || `Farm ${row.farm_id}`,
      building_name: warehouseLabel(warehouses.get(row.building_id)),
      pen_name: warehouseLabel(warehouses.get(row.pen_id)),
    };
  });
}

export async function getBreederCleanupById(id: number) {
  const { data, error } = await db.from(TABLE).select("*").eq("id", id).single();
  if (error) throw error;
  return data as BreederCleanupRow;
}

async function validatedPayload(input: BreederCleanupInput, recordId?: number) {
  if (!Number.isInteger(input.cycle_id) || input.cycle_id <= 0) throw new Error("Breeder cycle is required.");
  if (!input.reason.trim()) throw new Error("Clean-up reason is required.");
  if (![input.female_cleanup_qty, input.male_cleanup_qty].every((value) => Number.isInteger(value) && value >= 0)) {
    throw new Error("Clean-up quantities must be non-negative whole numbers.");
  }
  if (input.female_cleanup_qty + input.male_cleanup_qty <= 0) throw new Error("Enter at least one clean-up quantity.");

  const existingRecord = recordId ? await getBreederCleanupById(recordId) : null;
  if (existingRecord && existingRecord.cycle_id !== input.cycle_id) {
    throw new Error("The breeder cycle cannot be changed after the clean-up is created.");
  }
  const cycles = await listBreederCleanupCycles(input.cycle_id);
  const cycle = cycles.find((item) => item.id === input.cycle_id);
  if (!cycle) throw new Error("The selected breeder cycle is unavailable.");
  const femaleSystemBalance = existingRecord?.female_system_balance ?? cycle.female_system_balance;
  const maleSystemBalance = existingRecord?.male_system_balance ?? cycle.male_system_balance;
  if (input.female_cleanup_qty > femaleSystemBalance || input.male_cleanup_qty > maleSystemBalance) {
    throw new Error("Clean-up quantity cannot exceed the current system balance.");
  }
  if (femaleSystemBalance - input.female_cleanup_qty !== 0 || maleSystemBalance - input.male_cleanup_qty !== 0) {
    throw new Error("Female and male balances must both be zero before saving the clean-up.");
  }
  return {
    cycle_id: existingRecord?.cycle_id ?? cycle.id,
    farm_id: existingRecord?.farm_id ?? cycle.farm_id,
    building_id: existingRecord?.building_id ?? cycle.building_id,
    pen_id: existingRecord?.pen_id ?? cycle.pen_id,
    female_system_balance: femaleSystemBalance,
    male_system_balance: maleSystemBalance,
    female_cleanup_qty: input.female_cleanup_qty,
    male_cleanup_qty: input.male_cleanup_qty,
    reason: input.reason.trim(),
    remarks: input.remarks?.trim() || null,
  };
}

export async function createBreederCleanup(input: BreederCleanupInput) {
  const [record] = await createBreederCleanups([input]);
  return record;
}

async function closeCyclesAndCreateNext(cycleIds: number[]) {
  const uniqueIds = [...new Set(cycleIds)];
  const { data: currentData, error: currentError } = await db
    .from(CYCLE_TABLE)
    .select("id, farm_id, building_id, pen_id, cycle_no, status")
    .in("id", uniqueIds);
  if (currentError) throw currentError;
  const currentCycles = (currentData ?? []) as CycleRow[];
  if (currentCycles.length !== uniqueIds.length) throw new Error("One or more breeder cycles could not be found.");

  const { data: relatedData, error: relatedError } = await db
    .from(CYCLE_TABLE)
    .select("id, farm_id, building_id, pen_id, cycle_no, status")
    .in("farm_id", [...new Set(currentCycles.map((cycle) => cycle.farm_id))])
    .in("building_id", [...new Set(currentCycles.map((cycle) => cycle.building_id))])
    .in("pen_id", [...new Set(currentCycles.map((cycle) => cycle.pen_id))]);
  if (relatedError) throw relatedError;
  const relatedCycles = (relatedData ?? []) as CycleRow[];
  const nextCycles = currentCycles
    .filter((cycle) => !relatedCycles.some((candidate) =>
      candidate.farm_id === cycle.farm_id
      && candidate.building_id === cycle.building_id
      && candidate.pen_id === cycle.pen_id
      && candidate.cycle_no === cycle.cycle_no + 1))
    .map((cycle) => ({
      farm_id: cycle.farm_id,
      building_id: cycle.building_id,
      pen_id: cycle.pen_id,
      cycle_no: cycle.cycle_no + 1,
      status: "Active",
    }));
  const originalStatuses = new Map(currentCycles.map((cycle) => [cycle.id, cycle.status]));
  const { error: closeError } = await db.from(CYCLE_TABLE).update({ status: "Closed" }).in("id", uniqueIds);
  if (closeError) throw closeError;
  if (!nextCycles.length) return;

  const { error: nextError } = await db.from(CYCLE_TABLE).insert(nextCycles);
  if (!nextError) return;
  await Promise.all([...originalStatuses.entries()].map(([id, status]) =>
    db.from(CYCLE_TABLE).update({ status }).eq("id", id)));
  throw nextError;
}

export async function createBreederCleanups(inputs: BreederCleanupInput[]) {
  if (!inputs.length) throw new Error("Enter a clean-up quantity for at least one pen.");
  if (new Set(inputs.map((input) => input.cycle_id)).size !== inputs.length) {
    throw new Error("A breeder cycle can only appear once in a clean-up batch.");
  }
  const payloads = await Promise.all(inputs.map((input) => validatedPayload(input)));
  const { data, error } = await db.from(TABLE).insert(payloads).select("*");
  if (error) throw error;
  const records = (data ?? []) as BreederCleanupRow[];
  try {
    await closeCyclesAndCreateNext(records.map((record) => record.cycle_id));
    return records;
  } catch (lifecycleError) {
    if (records.length) await db.from(TABLE).delete().in("id", records.map((record) => record.id));
    throw lifecycleError;
  }
}

export async function updateBreederCleanup(id: number, input: BreederCleanupInput) {
  const payload = await validatedPayload(input, id);
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  const { data, error } = await db
    .from(TABLE)
    .update({ ...payload, updated_at: new Date().toISOString(), updated_by: auth.user?.id ?? null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await closeCyclesAndCreateNext([data.cycle_id]);
  return data as BreederCleanupRow;
}

export async function deleteBreederCleanup(id: number) {
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
