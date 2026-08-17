import { db } from "@/lib/Supabase/supabaseClient";
import type { DefaultFarm } from "@/lib/types";
import type { Placement } from "../../placement/new/api";

const HEADER_TABLE = "tbl_brd_dispatch";
const LINE_TABLE = "tbl_brd_dispatch_line";
const REGISTER_VIEW = "brd_dispatch_register";

export type DispatchStatus = "Draft" | "Posted" | "Cancelled";

export type BreederDispatchRecord = {
  id: number;
  document_no: string;
  dispatch_date: string;
  farm_id: number;
  farm_code: string | null;
  farm_name: string;
  destination: string;
  hauler_name: string | null;
  plate_number: string | null;
  truck_seal: string | null;
  status: DispatchStatus;
  remarks: string | null;
  line_count: number;
  male_qty: number;
  female_qty: number;
  total_qty: number;
  created_at: string;
};

export type BreederDispatchLine = {
  id?: number;
  dispatch_id?: number;
  line_no: number;
  placement_id: number;
  placement_date: string;
  building_id: number;
  building_name: string;
  pen_id: number;
  pen_name: string;
  dr_no: string | null;
  male_available: number;
  female_available: number;
  male_qty: number;
  female_qty: number;
  avg_body_weight_male: number | null;
  avg_body_weight_female: number | null;
  remarks: string | null;
};

export type BreederDispatchDetail = BreederDispatchRecord & {
  lines: BreederDispatchLine[];
};

export type AvailableBreederFlock = Placement & {
  farm_code: string | null;
  male_available: number;
  female_available: number;
  avg_body_weight_male: number | null;
  avg_body_weight_female: number | null;
};

export type BreederDispatchInput = {
  dispatch_date: string;
  farm_id: number;
  farm_code: string | null;
  farm_name: string;
  destination: string;
  hauler_name: string | null;
  plate_number: string | null;
  truck_seal: string | null;
  remarks: string | null;
  lines: Omit<BreederDispatchLine, "id" | "dispatch_id">[];
};

type DailyPerformance = {
  placement_id: number;
  daterec: string;
  inv_male: number;
  inv_female: number;
  mc_male: number;
  mc_female: number;
  cull_male: number;
  cull_female: number;
  trans_in_male: number;
  trans_in_female: number;
  trans_out_male: number;
  trans_out_female: number;
  avg_body_weight_male: number;
  avg_body_weight_female: number;
};

function count(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function placementBalance(placement: Placement, sex: "male" | "female") {
  if (sex === "male") {
    return count(
      placement.m_endingbalance ??
        placement.m_beg - placement.m_doa - placement.m_reject - placement.m_shortcount,
    );
  }
  return count(
    placement.f_endingbalance ??
      placement.f_beg - placement.f_doa - placement.f_reject - placement.f_shortcount,
  );
}

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
  const { data, error } = await db
    .from("vwdmf_user_default_farm")
    .select("*")
    .eq("auth_id", auth.session.user.id)
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as DefaultFarm | undefined) ?? null;
}

export async function listBreederDispatches() {
  const { data, error } = await db
    .from(REGISTER_VIEW)
    .select("*")
    .order("dispatch_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BreederDispatchRecord[];
}

export async function listAvailableBreederFlocks(dispatchDate: string, farmId?: number) {
  let placementQuery = db.from("tbl_placement").select("*").lte("placement_date", dispatchDate);
  if (farmId) placementQuery = placementQuery.eq("farm_id", farmId);

  const [{ data: placements, error: placementError }, { data: farmRows, error: farmError }] =
    await Promise.all([
      placementQuery.order("building_no").order("pen_no"),
      db.from("view_breeder_farm").select("id, code"),
    ]);
  if (placementError) throw placementError;
  if (farmError) throw farmError;

  const placementIds = (placements ?? []).map((row) => row.id);
  let performanceRows: DailyPerformance[] = [];
  if (placementIds.length) {
    const { data, error } = await db
      .from("tbl_breeder_daily_performance")
      .select(
        "placement_id, daterec, inv_male, inv_female, mc_male, mc_female, cull_male, cull_female, trans_in_male, trans_in_female, trans_out_male, trans_out_female, avg_body_weight_male, avg_body_weight_female",
      )
      .in("placement_id", placementIds)
      .eq("isactive", true)
      .lte("daterec", dispatchDate)
      .order("daterec", { ascending: true });
    if (error) throw error;
    performanceRows = (data ?? []) as DailyPerformance[];
  }

  const rowsByPlacement = new Map<number, DailyPerformance[]>();
  performanceRows.forEach((row) => {
    const rows = rowsByPlacement.get(row.placement_id) ?? [];
    rows.push(row);
    rowsByPlacement.set(row.placement_id, rows);
  });
  const farmCodeById = new Map((farmRows ?? []).map((farm) => [farm.id, farm.code]));

  return ((placements ?? []) as Placement[])
    .map((placement): AvailableBreederFlock => {
      const rows = rowsByPlacement.get(placement.id) ?? [];
      let male = placementBalance(placement, "male");
      let female = placementBalance(placement, "female");
      rows.forEach((row) => {
        male += count(row.trans_in_male) - count(row.mc_male) - count(row.cull_male) - count(row.trans_out_male);
        female += count(row.trans_in_female) - count(row.mc_female) - count(row.cull_female) - count(row.trans_out_female);
      });
      const latest = rows.at(-1);
      return {
        ...placement,
        farm_code: farmCodeById.get(placement.farm_id) ?? null,
        male_available: Math.max(0, male),
        female_available: Math.max(0, female),
        avg_body_weight_male: latest?.avg_body_weight_male ?? placement.avg_bodyw ?? null,
        avg_body_weight_female: latest?.avg_body_weight_female ?? placement.avg_bodyw ?? null,
      };
    })
    .filter((placement) => placement.male_available > 0 || placement.female_available > 0);
}

export async function getBreederDispatchById(id: number) {
  const [{ data: header, error: headerError }, { data: lines, error: lineError }] =
    await Promise.all([
      db.from(REGISTER_VIEW).select("*").eq("id", id).single(),
      db.from(LINE_TABLE).select("*").eq("dispatch_id", id).order("line_no"),
    ]);
  if (headerError) throw headerError;
  if (lineError) throw lineError;
  return { ...header, lines: lines ?? [] } as BreederDispatchDetail;
}

async function validateInput(input: BreederDispatchInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dispatch_date)) throw new Error("Dispatch date is required.");
  if (!Number.isInteger(input.farm_id) || input.farm_id <= 0) throw new Error("Breeder farm is required.");
  if (!input.destination.trim()) throw new Error("Destination is required.");
  if (!input.lines.length) throw new Error("Add at least one flock-card line.");
  if (new Set(input.lines.map((line) => line.placement_id)).size !== input.lines.length) {
    throw new Error("A flock-card placement can only appear once.");
  }

  const available = await listAvailableBreederFlocks(input.dispatch_date, input.farm_id);
  const availableById = new Map(available.map((row) => [row.id, row]));
  input.lines.forEach((line) => {
    const flock = availableById.get(line.placement_id);
    if (!flock) throw new Error(`Placement ${line.placement_id} is not available on the dispatch date.`);
    const male = Number(line.male_qty);
    const female = Number(line.female_qty);
    if (![male, female].every((value) => Number.isInteger(value) && value >= 0)) {
      throw new Error("Dispatch quantities must be non-negative whole numbers.");
    }
    if (male + female <= 0) throw new Error(`Enter a quantity for ${line.building_name} / ${line.pen_name}.`);
    if (male > flock.male_available || female > flock.female_available) {
      throw new Error(`Dispatch quantity exceeds the available flock in ${line.building_name} / ${line.pen_name}.`);
    }
  });
}

async function replaceLines(dispatchId: number, lines: BreederDispatchInput["lines"], userId: string) {
  const { error: deleteError } = await db.from(LINE_TABLE).delete().eq("dispatch_id", dispatchId);
  if (deleteError) throw deleteError;
  const { error } = await db.from(LINE_TABLE).insert(
    lines.map((line, index) => ({
      ...line,
      dispatch_id: dispatchId,
      line_no: index + 1,
      created_by: userId,
    })),
  );
  if (error) throw error;
}

export async function createBreederDispatch(input: BreederDispatchInput, post = false) {
  await validateInput(input);
  const userId = await currentUserId();
  const { lines, ...header } = input;
  const { data, error } = await db
    .from(HEADER_TABLE)
    .insert({ ...header, document_no: documentNo(), created_by: userId, status: "Draft" })
    .select("id")
    .single();
  if (error) throw error;
  try {
    await replaceLines(data.id, lines, userId);
    if (post) await postBreederDispatch(data.id);
    return getBreederDispatchById(data.id);
  } catch (saveError) {
    await db.from(HEADER_TABLE).delete().eq("id", data.id).eq("status", "Draft");
    throw saveError;
  }
}

export async function updateBreederDispatch(id: number, input: BreederDispatchInput, post = false) {
  await validateInput(input);
  const userId = await currentUserId();
  const { lines, ...header } = input;
  const { error } = await db
    .from(HEADER_TABLE)
    .update({ ...header, updated_by: userId })
    .eq("id", id)
    .eq("status", "Draft");
  if (error) throw error;
  await replaceLines(id, lines, userId);
  if (post) await postBreederDispatch(id);
  return getBreederDispatchById(id);
}

export async function postBreederDispatch(id: number) {
  const userId = await currentUserId();
  const { data, error } = await db
    .from(HEADER_TABLE)
    .update({ status: "Posted", updated_by: userId })
    .eq("id", id)
    .eq("status", "Draft")
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function cancelBreederDispatch(id: number, reason: string) {
  if (!reason.trim()) throw new Error("Cancellation reason is required.");
  const userId = await currentUserId();
  const { data, error } = await db
    .from(HEADER_TABLE)
    .update({
      status: "Cancelled",
      cancellation_reason: reason.trim(),
      cancelled_by: userId,
      cancelled_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", id)
    .eq("status", "Posted")
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBreederDispatchDraft(id: number) {
  const { error } = await db.from(HEADER_TABLE).delete().eq("id", id).eq("status", "Draft");
  if (error) throw error;
}
