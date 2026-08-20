import { db } from "@/lib/Supabase/supabaseClient";
import type { DefaultFarm } from "@/lib/types";
import type { Placement } from "../../placement/new/api";

const HEADER_TABLE = "tbl_brd_dispatch";
const LINE_TABLE = "tbl_brd_dispatch_line";
const REGISTER_VIEW = "brd_dispatch_register";
const HATCHERY_FARM_VIEW = "view_brd_hatchery_farm_lookup";

export type DispatchStatus = "Draft" | "Posted" | "Cancelled";
export type DispatchSourceType = "Population Record" | "Egg Laying";
export const POPULATION_CATEGORIES = [["mc", "MC"], ["culls", "Culls"], ["kitchen", "Kitchen"], ["condemn", "Condemn"]] as const;
export const EGG_CATEGORIES = [["hatching_egg", "Hatching Egg (<54g)"], ["classb", "Class B (<52g - 53g)"], ["table_egg", "Table Egg"], ["crack", "Crack"], ["junior", "Junior (<49g - 51g)"], ["jumbo", "Jumbo"], ["condemn", "Condemn"]] as const;

export type HatcheryFarmLookup = {
  farm_id: number;
  farm_code: string | null;
  farm_name: string;
};

export type BreederDispatchRecord = {
  id: number; document_no: string; dispatch_date: string; farm_id: number; farm_code: string | null;
  farm_name: string; destination: string; hauler_name: string | null; plate_number: string | null;
  truck_seal: string | null; status: DispatchStatus; remarks: string | null; line_count: number;
  population_qty: number; egg_qty: number; total_qty: number; created_at: string;
};

export type BreederDispatchLine = {
  id?: number; dispatch_id?: number; line_no: number; source_type: DispatchSourceType;
  source_record_id: number; source_date: string; category: string; category_label: string;
  placement_id: number | null; placement_date: string | null; building_id: number | null;
  building_name: string; pen_id: number | null; pen_name: string | null; dr_no: string | null;
  source_available: number; dispatch_qty: number; remarks: string | null;
};

export type BreederDispatchDetail = BreederDispatchRecord & { lines: BreederDispatchLine[] };
export type AvailableDispatchItem = Omit<BreederDispatchLine, "id" | "dispatch_id" | "line_no" | "dispatch_qty" | "remarks"> & {
  key: string; farm_id: number; farm_code: string | null; farm_name: string;
};
export type AvailableBreederFlock = Placement & {
  farm_code: string | null; male_available: number; female_available: number;
  avg_body_weight_male: number | null; avg_body_weight_female: number | null;
};
export type BreederDispatchInput = {
  dispatch_date: string; farm_id: number; farm_code: string | null; farm_name: string;
  destination: string; hauler_name: string | null; plate_number: string | null; truck_seal: string | null;
  remarks: string | null; lines: Omit<BreederDispatchLine, "id" | "dispatch_id">[];
};

const count = (value: unknown) => { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; };
export const dispatchItemKey = (type: DispatchSourceType, id: number, category: string) => `${type}:${id}:${category}`;

async function currentUserId() {
  const { data, error } = await db.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Your session has expired. Please sign in again.");
  return data.user.id;
}

function documentNo() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `BRD-DR-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function getDefaultFarm() {
  const { data: auth } = await db.auth.getSession();
  if (!auth.session?.user.id) return null;
  const { data, error } = await db.from("vwdmf_user_default_farm").select("*").eq("auth_id", auth.session.user.id).limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as DefaultFarm | undefined) ?? null;
}

export async function listHatcheryFarms() {
  const { data, error } = await db
    .from(HATCHERY_FARM_VIEW)
    .select("farm_id, farm_code, farm_name")
    .order("farm_name");
  if (error) throw error;
  return (data ?? []) as HatcheryFarmLookup[];
}

export async function listBreederDispatches() {
  const { data, error } = await db.from(REGISTER_VIEW).select("*").order("dispatch_date", { ascending: false }).order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BreederDispatchRecord[];
}

// Retained as the shared live-bird balance provider used by Breeder Cleanup.
export async function listAvailableBreederFlocks(dispatchDate: string, farmId?: number) {
  let placementQuery = db.from("tbl_placement").select("*").lte("placement_date", dispatchDate);
  if (farmId) placementQuery = placementQuery.eq("farm_id", farmId);
  const [{ data: placements, error: placementError }, { data: farms, error: farmError }] = await Promise.all([
    placementQuery.order("building_no").order("pen_no"), db.from("view_breeder_farm").select("id, code"),
  ]);
  if (placementError) throw placementError;
  if (farmError) throw farmError;
  const placementIds = (placements ?? []).map((row) => row.id);
  let dailyRows: Record<string, unknown>[] = [];
  if (placementIds.length) {
    const { data, error } = await db.from("tbl_breeder_daily_performance").select("placement_id, daterec, inv_male, inv_female, mc_male, mc_female, cull_male, cull_female, trans_in_male, trans_in_female, trans_out_male, trans_out_female, kitchen_male, kitchen_female, condem_male, condem_female, avg_body_weight_male, avg_body_weight_female").in("placement_id", placementIds).eq("isactive", true).lte("daterec", dispatchDate).order("daterec");
    if (error) throw error;
    dailyRows = data ?? [];
  }
  const byPlacement = new Map<number, Record<string, unknown>[]>();
  dailyRows.forEach((row) => { const id = Number(row.placement_id); byPlacement.set(id, [...(byPlacement.get(id) ?? []), row]); });
  const farmCode = new Map((farms ?? []).map((row) => [Number(row.id), row.code as string | null]));
  return ((placements ?? []) as Placement[]).map((placement): AvailableBreederFlock => {
    const rows = byPlacement.get(placement.id) ?? [];
    let male = count(placement.m_endingbalance ?? placement.m_beg - placement.m_doa - placement.m_reject - placement.m_shortcount);
    let female = count(placement.f_endingbalance ?? placement.f_beg - placement.f_doa - placement.f_reject - placement.f_shortcount);
    rows.forEach((row) => {
      male += count(row.trans_in_male) - count(row.mc_male) - count(row.cull_male) - count(row.trans_out_male) - count(row.kitchen_male) - count(row.condem_male);
      female += count(row.trans_in_female) - count(row.mc_female) - count(row.cull_female) - count(row.trans_out_female) - count(row.kitchen_female) - count(row.condem_female);
    });
    const latest = rows.at(-1);
    return { ...placement, farm_code: farmCode.get(placement.farm_id) ?? null, male_available: Math.max(0, male), female_available: Math.max(0, female), avg_body_weight_male: count(latest?.avg_body_weight_male) || placement.m_avg_bodyw || placement.avg_bodyw, avg_body_weight_female: count(latest?.avg_body_weight_female) || placement.f_avg_bodyw || placement.avg_bodyw };
  }).filter((row) => row.male_available > 0 || row.female_available > 0);
}

export async function listAvailableDispatchItems(dispatchDate: string, farmId?: number) {
  let placementQuery = db.from("tbl_placement").select("id, placement_date, dr_no, farm_id, farm_name, building_id, building_no, pen_id, pen_no").lte("placement_date", dispatchDate);
  if (farmId) placementQuery = placementQuery.eq("farm_id", farmId);
  const [{ data: placements, error: placementError }, { data: farms, error: farmError }] = await Promise.all([
    placementQuery, db.from("view_breeder_farm").select("id, code"),
  ]);
  if (placementError) throw placementError;
  if (farmError) throw farmError;
  const placementById = new Map((placements ?? []).map((row) => [Number(row.id), row]));
  const placementIds = [...placementById.keys()];
  const farmCodeById = new Map((farms ?? []).map((row) => [Number(row.id), row.code as string | null]));
  if (!placementIds.length) return [] as AvailableDispatchItem[];

  const [{ data: population, error: populationError }, { data: eggs, error: eggError }, { data: posted, error: postedError }] = await Promise.all([
    db.from("tbl_breeder_daily_performance").select("id, placement_id, daterec, mc_male, mc_female, cull_male, cull_female, kitchen_male, kitchen_female, condem_male, condem_female").in("placement_id", placementIds).eq("isactive", true).lte("daterec", dispatchDate),
    db.from("tbl_egglaying").select("id, placement_id, date_laying, farm_id, farm_name, building_id, building, hatching_egg, classb, table_egg, crack, junior, jumbo, condemn").in("placement_id", placementIds).eq("is_active", true).lte("date_laying", dispatchDate),
    db.from(HEADER_TABLE).select("id").eq("status", "Posted"),
  ]);
  if (populationError) throw populationError;
  if (eggError) throw eggError;
  if (postedError) throw postedError;

  const allocated = new Map<string, number>();
  const postedIds = (posted ?? []).map((row) => row.id);
  if (postedIds.length) {
    const { data, error } = await db.from(LINE_TABLE).select("source_type, source_record_id, category, dispatch_qty").in("dispatch_id", postedIds);
    if (error) throw error;
    (data ?? []).forEach((line) => {
      const key = dispatchItemKey(line.source_type as DispatchSourceType, Number(line.source_record_id), line.category);
      allocated.set(key, (allocated.get(key) ?? 0) + count(line.dispatch_qty));
    });
  }

  const items: AvailableDispatchItem[] = [];
  for (const row of population ?? []) {
    const placement = placementById.get(Number(row.placement_id));
    if (!placement) continue;
    const values: Record<string, number> = { mc: count(row.mc_male) + count(row.mc_female), culls: count(row.cull_male) + count(row.cull_female), kitchen: count(row.kitchen_male) + count(row.kitchen_female), condemn: count(row.condem_male) + count(row.condem_female) };
    for (const [category, label] of POPULATION_CATEGORIES) {
      const key = dispatchItemKey("Population Record", Number(row.id), category);
      const available = Math.max(0, values[category] - (allocated.get(key) ?? 0));
      if (!available) continue;
      items.push({ key, source_type: "Population Record", source_record_id: Number(row.id), source_date: row.daterec, category, category_label: label, placement_id: Number(placement.id), placement_date: placement.placement_date, building_id: placement.building_id, building_name: placement.building_no ?? "-", pen_id: placement.pen_id, pen_name: placement.pen_no, dr_no: placement.dr_no, source_available: available, farm_id: Number(placement.farm_id), farm_code: farmCodeById.get(Number(placement.farm_id)) ?? null, farm_name: placement.farm_name ?? "-" });
    }
  }
  for (const row of eggs ?? []) {
    const placement = placementById.get(Number(row.placement_id));
    if (!placement) continue;
    for (const [category, label] of EGG_CATEGORIES) {
      const key = dispatchItemKey("Egg Laying", Number(row.id), category);
      const available = Math.max(0, count(row[category]) - (allocated.get(key) ?? 0));
      if (!available) continue;
      items.push({ key, source_type: "Egg Laying", source_record_id: Number(row.id), source_date: row.date_laying, category, category_label: label, placement_id: Number(placement.id), placement_date: placement.placement_date, building_id: row.building_id ?? placement.building_id, building_name: row.building ?? placement.building_no ?? "-", pen_id: placement.pen_id, pen_name: placement.pen_no, dr_no: placement.dr_no, source_available: available, farm_id: Number(row.farm_id ?? placement.farm_id), farm_code: farmCodeById.get(Number(row.farm_id ?? placement.farm_id)) ?? null, farm_name: row.farm_name ?? placement.farm_name ?? "-" });
    }
  }
  return items.sort((a, b) => b.source_date.localeCompare(a.source_date) || a.building_name.localeCompare(b.building_name) || a.category_label.localeCompare(b.category_label));
}

export async function getBreederDispatchById(id: number) {
  const [{ data: header, error: headerError }, { data: lines, error: lineError }] = await Promise.all([
    db.from(REGISTER_VIEW).select("*").eq("id", id).single(), db.from(LINE_TABLE).select("*").eq("dispatch_id", id).order("line_no"),
  ]);
  if (headerError) throw headerError;
  if (lineError) throw lineError;
  return { ...header, lines: lines ?? [] } as BreederDispatchDetail;
}

async function validateInput(input: BreederDispatchInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dispatch_date)) throw new Error("Dispatch date is required.");
  if (!Number.isInteger(input.farm_id) || input.farm_id <= 0) throw new Error("Breeder farm is required.");
  if (!input.destination.trim()) throw new Error("Destination is required.");
  if (!input.lines.length) throw new Error("Add at least one dispatch category.");
  const keys = input.lines.map((line) => dispatchItemKey(line.source_type, line.source_record_id, line.category));
  if (new Set(keys).size !== keys.length) throw new Error("A source category can only appear once.");
  const availableByKey = new Map((await listAvailableDispatchItems(input.dispatch_date, input.farm_id)).map((row) => [row.key, row]));
  for (const line of input.lines) {
    const item = availableByKey.get(dispatchItemKey(line.source_type, line.source_record_id, line.category));
    if (!item) throw new Error(`${line.category_label} is no longer available from the selected source record.`);
    if (!Number.isInteger(Number(line.dispatch_qty)) || Number(line.dispatch_qty) <= 0) throw new Error("Dispatch quantities must be positive whole numbers.");
    if (Number(line.dispatch_qty) > item.source_available) throw new Error(`${line.category_label} exceeds the available quantity for ${line.building_name}.`);
  }
}

async function replaceLines(id: number, lines: BreederDispatchInput["lines"], userId: string) {
  const { error: deleteError } = await db.from(LINE_TABLE).delete().eq("dispatch_id", id);
  if (deleteError) throw deleteError;
  const { error } = await db.from(LINE_TABLE).insert(lines.map((line, index) => ({ ...line, dispatch_id: id, line_no: index + 1, created_by: userId })));
  if (error) throw error;
}

export async function createBreederDispatch(input: BreederDispatchInput, post = false) {
  await validateInput(input); const userId = await currentUserId(); const { lines, ...header } = input;
  const { data, error } = await db.from(HEADER_TABLE).insert({ ...header, document_no: documentNo(), created_by: userId, status: "Draft" }).select("id").single();
  if (error) throw error;
  try { await replaceLines(data.id, lines, userId); if (post) await postBreederDispatch(data.id); return getBreederDispatchById(data.id); }
  catch (saveError) { await db.from(HEADER_TABLE).delete().eq("id", data.id).eq("status", "Draft"); throw saveError; }
}

export async function updateBreederDispatch(id: number, input: BreederDispatchInput, post = false) {
  await validateInput(input); const userId = await currentUserId(); const { lines, ...header } = input;
  const { error } = await db.from(HEADER_TABLE).update({ ...header, updated_by: userId }).eq("id", id).eq("status", "Draft");
  if (error) throw error;
  await replaceLines(id, lines, userId); if (post) await postBreederDispatch(id); return getBreederDispatchById(id);
}

export async function postBreederDispatch(id: number) {
  const userId = await currentUserId();
  const { data, error } = await db.from(HEADER_TABLE).update({ status: "Posted", updated_by: userId }).eq("id", id).eq("status", "Draft").select("id").single();
  if (error) throw error; return data;
}

export async function cancelBreederDispatch(id: number, reason: string) {
  if (!reason.trim()) throw new Error("Cancellation reason is required.");
  const userId = await currentUserId();
  const { data, error } = await db.from(HEADER_TABLE).update({ status: "Cancelled", cancellation_reason: reason.trim(), cancelled_by: userId, cancelled_at: new Date().toISOString(), updated_by: userId }).eq("id", id).eq("status", "Posted").select("id").single();
  if (error) throw error; return data;
}

export async function deleteBreederDispatchDraft(id: number) {
  const { error } = await db.from(HEADER_TABLE).delete().eq("id", id).eq("status", "Draft");
  if (error) throw error;
}
