import { db } from "@/lib/Supabase/supabaseClient";
import { cullingAge } from "@/lib/data/queries/breederCullingAge";
import { cullingBuildingName } from "@/lib/data/queries/cullingBuildingName";
import {
  listAvailableBreederFlocks,
  type AvailableBreederFlock,
} from "@/app/jmb/breederdispatch/new/api";
import {
  getUserInfo,
  listBreederFarms,
  listPlacements,
  listFarmLocationLookup,
  type BreederFarm,
  type FarmLocationLookup,
} from "@/app/jmb/placement/new/api";

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
  cycle_ids?: number[] | null;
  record_scope?: "pen" | "building";
  female_condemn_variance: number;
  male_condemn_variance: number;
  age: number | null;
  date_of_culling: string | null;
  body_weight: string | null;
  buyer_name: string | null;
  hauler_name: string | null;
  hauler_plate_number: string | null;
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  cycle_id: number;
  farm_id: number;
  building_id: number;
  pen_id: number | null;
  female_system_balance: number;
  male_system_balance: number;
  female_cleanup_qty: number;
  male_cleanup_qty: number;
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
  placement_date: string | null;
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
  cycle_ids?: number[];
  record_scope?: "pen" | "building";
  date_of_culling: string | null;
  body_weight: string | null;
  buyer_name: string | null;
  hauler_name: string | null;
  hauler_plate_number: string | null;
  cycle_id: number;
  female_cleanup_qty: number;
  male_cleanup_qty: number;
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
    db.from(TABLE).select("farm_id, building_id, pen_id, cycle_id, cycle_ids, record_scope, female_system_balance, male_system_balance"),
  ]);
  if (cleanupError) throw cleanupError;
  const balances = new Map<string, BreederCleanupPenBalance>();
  const closedBuildingCycles = new Set<number>((cleanupRows ?? []).filter(row => row.record_scope === "building").flatMap(row => row.cycle_ids ?? [row.cycle_id]));
  flocks.forEach((flock) => {
    if (flock.cycle_id != null && closedBuildingCycles.has(flock.cycle_id)) return;
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
    if (row.record_scope === "building") return;
    const key = `${row.farm_id}:${row.building_id}:${row.pen_id}`;
    const current = balances.get(key);
    if (!current) return;
    current.female_system_balance = Math.max(0, current.female_system_balance - count(row.female_system_balance));
    current.male_system_balance = Math.max(0, current.male_system_balance - count(row.male_system_balance));
  });
  return [...balances.values()];
}

export async function listBreederCleanupCycles(includeCycleId?: number | number[]) {
  const [{ data: cyclesData, error: cycleError }, { data: existingData, error: existingError }, flocks, placements] =
    await Promise.all([
      db.from(CYCLE_TABLE).select("id, farm_id, building_id, pen_id, cycle_no, status").order("cycle_no", { ascending: false }),
      db.from(TABLE).select("cycle_id, cycle_ids, record_scope, female_system_balance, male_system_balance"),
      listAvailableBreederFlocks(localDate()),
      listPlacements(),
    ]);
  if (cycleError) throw cycleError;
  if (existingError) throw existingError;

  const cycles = (cyclesData ?? []) as CycleRow[];
  const closedBuildingCycles = new Set<number>();
  const priorCleanup = new Map<number, { female: number; male: number }>();
  (existingData ?? []).forEach((row) => {
    const cycleId = Number(row.cycle_id);
    if (row.record_scope === "building") {
      for (const id of row.cycle_ids ?? [cycleId]) closedBuildingCycles.add(Number(id));
      return;
    }
    const current = priorCleanup.get(cycleId) ?? { female: 0, male: 0 };
    current.female += count(row.female_system_balance);
    current.male += count(row.male_system_balance);
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
    .filter((cycle) => (Array.isArray(includeCycleId) ? includeCycleId.includes(cycle.id) : cycle.id === includeCycleId) || cycle.status.toLowerCase() === "active")
    .map((cycle): BreederCleanupCycle => {
      const farm = farms.get(cycle.farm_id);
      const balance = balances.get(cycle.id) ?? { female: 0, male: 0 };
      const cleaned = priorCleanup.get(cycle.id) ?? { female: 0, male: 0 };
      return {
        id: cycle.id,
        placement_date: placements.filter(placement => placement.cycle_id === cycle.id && placement.farm_id === cycle.farm_id && placement.building_id === cycle.building_id && placement.pen_id === cycle.pen_id).map(placement => placement.placement_date.slice(0, 10)).sort()[0] ?? null,
        cycle_no: cycle.cycle_no,
        status: cycle.status,
        farm_id: cycle.farm_id,
        farm_code: farm?.code ?? null,
        farm_name: farm?.name || farm?.code || `Farm ${cycle.farm_id}`,
        building_id: cycle.building_id,
        building_name: cullingBuildingName(warehouses.get(cycle.building_id)?.whse_name, warehouses.get(cycle.building_id)?.whse_code),
        pen_id: cycle.pen_id,
        pen_name: warehouseLabel(warehouses.get(cycle.pen_id)),
        female_system_balance: closedBuildingCycles.has(cycle.id) ? 0 : Math.max(0, balance.female - cleaned.female),
        male_system_balance: closedBuildingCycles.has(cycle.id) ? 0 : Math.max(0, balance.male - cleaned.male),
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
      building_name: cullingBuildingName(warehouses.get(row.building_id)?.whse_name, warehouses.get(row.building_id)?.whse_code),
      pen_name: warehouseLabel(row.pen_id == null ? undefined : warehouses.get(row.pen_id)),
    };
  });
}

export async function getBreederCleanupById(id: number) {
  const { data, error } = await db.from(TABLE).select("*").eq("id", id).single();
  if (error) throw error;
  return data as BreederCleanupRow;
}

async function validatedPayload(input: BreederCleanupInput, recordId?: number) {
  if (input.date_of_culling !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(input.date_of_culling) || !Number.isFinite(Date.parse(input.date_of_culling)) || new Date(input.date_of_culling).toISOString().slice(0, 10) !== input.date_of_culling)) throw new Error("Date of Culling must be a valid date.");
  if (!Number.isInteger(input.cycle_id) || input.cycle_id <= 0) throw new Error("Breeder cycle is required.");
  if (![input.female_cleanup_qty, input.male_cleanup_qty].every((value) => Number.isInteger(value) && value >= 0)) {
    throw new Error("Terminal Culling quantities must be non-negative whole numbers.");
  }
  if (input.female_cleanup_qty + input.male_cleanup_qty <= 0) throw new Error("Enter at least one Terminal Culling quantity.");

  const existingRecord = recordId ? await getBreederCleanupById(recordId) : null;
  if (existingRecord && existingRecord.cycle_id !== input.cycle_id) {
    throw new Error("The breeder cycle cannot be changed after the Terminal Culling is created.");
  }
  const memberIds = existingRecord?.cycle_ids ?? input.cycle_ids ?? [input.cycle_id];
  const cycles = await listBreederCleanupCycles(memberIds);
  const members = cycles.filter(cycle => memberIds.includes(cycle.id));
  const cycle = members.find(item => item.id === input.cycle_id);
  if (members.length !== memberIds.length || new Set(memberIds).size !== memberIds.length) throw new Error("One or more building cycles are unavailable.");
  if (cycle && members.some(item => item.farm_id !== cycle.farm_id || item.building_id !== cycle.building_id || item.cycle_no !== cycle.cycle_no)) throw new Error("Select cycles from the same building and cycle number.");
  if (!cycle) throw new Error("The selected breeder cycle is unavailable.");
  if (!existingRecord && input.record_scope === "building") {
    const expected = cycles.filter(item => item.farm_id === cycle.farm_id && item.building_id === cycle.building_id && item.cycle_no === cycle.cycle_no && item.status.toLowerCase() === "active" && item.placement_date);
    if (expected.length !== memberIds.length || expected.some(item => !memberIds.includes(item.id))) throw new Error("Refresh the building cycles before saving.");
  }
  const placementDate = members.map(item => item.placement_date).filter((date): date is string => !!date).sort()[0] ?? null;
  if (input.date_of_culling && cullingAge(placementDate, input.date_of_culling) === null) {
    throw new Error(placementDate ? "Date of Culling cannot be before the placement date." : "A placement date is required to calculate culling age.");
  }
  const femaleSystemBalance = existingRecord?.female_system_balance ?? members.reduce((sum, item) => sum + item.female_system_balance, 0);
  const maleSystemBalance = existingRecord?.male_system_balance ?? members.reduce((sum, item) => sum + item.male_system_balance, 0);
  // The remaining signed balance is Condemn Variance; culling may exceed inventory.
  return {
    cycle_id: existingRecord?.cycle_id ?? cycle.id,
    cycle_ids: memberIds,
    record_scope: existingRecord?.record_scope ?? input.record_scope ?? "pen",
    farm_id: existingRecord?.farm_id ?? cycle.farm_id,
    building_id: existingRecord?.building_id ?? cycle.building_id,
    pen_id: (existingRecord?.record_scope ?? input.record_scope) === "building" ? null : existingRecord?.pen_id ?? cycle.pen_id,
    female_system_balance: femaleSystemBalance,
    male_system_balance: maleSystemBalance,
    female_cleanup_qty: input.female_cleanup_qty,
    male_cleanup_qty: input.male_cleanup_qty,
    remarks: input.remarks?.trim() || null,
    date_of_culling: input.date_of_culling,
    body_weight: input.body_weight?.trim() || null,
    buyer_name: input.buyer_name?.trim() || null,
    hauler_name: input.hauler_name?.trim() || null,
    hauler_plate_number: input.hauler_plate_number?.trim() || null,
  };
}

export async function createBreederCleanup(input: BreederCleanupInput) {
  const [record] = await createBreederCleanups([input]);
  return record;
}

// A request key identifies one user save, including retries after a lost response.
export async function createBreederCleanups(inputs: BreederCleanupInput[], requestKey: string = crypto.randomUUID()) {
  if (!inputs.length) throw new Error("Enter a Terminal Culling quantity for at least one building.");
  if (new Set(inputs.map(input => input.cycle_id)).size !== inputs.length) throw new Error("A breeder cycle can only appear once in a Terminal Culling batch.");
  const { data: prior, error: priorError } = await db.from(TABLE).select("*").eq("request_key", requestKey);
  if (priorError) throw priorError;
  if (prior?.length) return prior as BreederCleanupRow[];
  const payloads = await Promise.all(inputs.map(input => validatedPayload(input)));
  const { data, error } = await db.rpc("save_breeder_cleanup", { p_inputs: payloads, p_id: null, p_request_key: requestKey });
  if (error) throw error;
  return data as BreederCleanupRow[];
}

export async function updateBreederCleanup(id: number, input: BreederCleanupInput) {
  const payload = await validatedPayload(input, id);
  const { data, error } = await db.rpc("save_breeder_cleanup", { p_inputs: [payload], p_id: id, p_request_key: null });
  if (error) throw error;
  return (data as BreederCleanupRow[])[0];
}

export async function deleteBreederCleanup(id: number) {
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
