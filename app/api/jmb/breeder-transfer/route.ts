import { NextResponse } from "next/server";
import { admin_db } from "@/lib/Supabase/supabaseAdmin";

export const runtime = "nodejs";

type TransferInput = {
  transfer_date?: unknown;
  source_placement_id?: unknown;
  destination_placement_id?: unknown;
  male_qty?: unknown;
  female_qty?: unknown;
  reason?: unknown;
  remarks?: unknown;
};

function tokenFrom(req: Request) {
  const [scheme, token] = (req.headers.get("authorization") ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : "";
}

function message(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message ?? "Request failed.");
  return "Request failed.";
}

function businessDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function authenticatedUser(req: Request) {
  const token = tokenFrom(req);
  if (!token) throw new Error("Missing authorization token.");
  const { data: { user }, error } = await admin_db.auth.getUser(token);
  if (error) throw error;
  if (!user) throw new Error("Invalid authorization token.");
  return user;
}

function netPlacement(placement: Record<string, unknown>, sex: "male" | "female") {
  const prefix = sex === "male" ? "m" : "f";
  const ending = placement[`${prefix}_endingbalance`];
  if (ending !== null && ending !== undefined) return Number(ending);
  return Number(placement[`${prefix}_beg`] ?? 0)
    - Number(placement[`${prefix}_doa`] ?? 0)
    - Number(placement[`${prefix}_reject`] ?? 0)
    - Number(placement[`${prefix}_shortcount`] ?? 0);
}

export async function GET(req: Request) {
  try {
    await authenticatedUser(req);
    const [{ data: cycles, error: cycleError }, { data: transfers, error: transferError }] = await Promise.all([
      admin_db.from("tbl_breeder_cycle").select("id").ilike("status", "active"),
      admin_db.from("tbl_breeder_transfer").select("*").order("transfer_date", { ascending: false }).order("id", { ascending: false }).limit(100),
    ]);
    if (cycleError) throw cycleError;
    if (transferError) throw transferError;

    const activeCycleIds = (cycles ?? []).map((cycle) => Number(cycle.id));
    const historyPlacementIds = [...new Set((transfers ?? []).flatMap((row) => [Number(row.source_placement_id), Number(row.destination_placement_id)]))];
    const activeQuery = activeCycleIds.length
      ? admin_db.from("tbl_placement").select("*").in("cycle_id", activeCycleIds)
      : Promise.resolve({ data: [], error: null });
    const historyQuery = historyPlacementIds.length
      ? admin_db.from("tbl_placement").select("*").in("id", historyPlacementIds)
      : Promise.resolve({ data: [], error: null });
    const [activeResult, historyResult] = await Promise.all([activeQuery, historyQuery]);
    if (activeResult.error) throw activeResult.error;
    if (historyResult.error) throw historyResult.error;

    const activePlacements = (activeResult.data ?? []) as Array<Record<string, unknown>>;
    const activePlacementIds = activePlacements.map((placement) => Number(placement.id));
    const { data: dailyRows, error: dailyError } = activePlacementIds.length
      ? await admin_db.from("tbl_breeder_daily_performance")
          .select("placement_id, daterec, mc_male, mc_female, cull_male, cull_female, trans_in_male, trans_in_female, trans_out_male, trans_out_female, kitchen_male, kitchen_female, condem_male, condem_female")
          .in("placement_id", activePlacementIds).eq("isactive", true).lte("daterec", businessDate())
      : { data: [], error: null };
    if (dailyError) throw dailyError;

    const effects = new Map<number, { male: number; female: number }>();
    (dailyRows ?? []).forEach((row) => {
      const placementId = Number(row.placement_id);
      const current = effects.get(placementId) ?? { male: 0, female: 0 };
      current.male += Number(row.trans_in_male ?? 0) - Number(row.mc_male ?? 0) - Number(row.cull_male ?? 0) - Number(row.trans_out_male ?? 0) - Number(row.kitchen_male ?? 0) - Number(row.condem_male ?? 0);
      current.female += Number(row.trans_in_female ?? 0) - Number(row.mc_female ?? 0) - Number(row.cull_female ?? 0) - Number(row.trans_out_female ?? 0) - Number(row.kitchen_female ?? 0) - Number(row.condem_female ?? 0);
      effects.set(placementId, current);
    });

    const placements = activePlacements.map((placement) => {
      const placementId = Number(placement.id);
      const effect = effects.get(placementId) ?? { male: 0, female: 0 };
      return {
        id: placementId,
        placement_date: String(placement.placement_date ?? ""),
        farm_id: Number(placement.farm_id), farm_name: String(placement.farm_name ?? ""),
        building_id: Number(placement.building_id), building_no: String(placement.building_no ?? ""),
        pen_id: Number(placement.pen_id), pen_no: String(placement.pen_no ?? ""),
        cycle_id: Number(placement.cycle_id),
        male_available: netPlacement(placement, "male") + effect.male,
        female_available: netPlacement(placement, "female") + effect.female,
      };
    });
    const placementLabels = new Map(
      [...activePlacements, ...((historyResult.data ?? []) as Array<Record<string, unknown>>)].map((placement) => [Number(placement.id), {
        farm_id: Number(placement.farm_id), farm_name: String(placement.farm_name ?? ""),
        building_id: Number(placement.building_id), building_no: String(placement.building_no ?? ""),
        pen_id: Number(placement.pen_id), pen_no: String(placement.pen_no ?? ""),
      }]),
    );
    const transferRows = (transfers ?? []).map((transfer) => ({
      ...transfer,
      source: placementLabels.get(Number(transfer.source_placement_id)) ?? null,
      destination: placementLabels.get(Number(transfer.destination_placement_id)) ?? null,
    }));
    return NextResponse.json({ placements, transfers: transferRows });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

export async function POST(req: Request) {
  let createdId: number | null = null;
  try {
    const user = await authenticatedUser(req);
    const body = (await req.json()) as { action?: string; id?: unknown; reason?: unknown; input?: TransferInput; post?: boolean };
    if (body.action === "post") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) throw new Error("A valid bird transfer is required.");
      const { error } = await admin_db.rpc("post_breeder_transfer", { p_transfer_id: id, p_user_id: user.id });
      if (error) throw error;
      return NextResponse.json({ id });
    }
    if (body.action === "cancel") {
      const id = Number(body.id);
      const reason = String(body.reason ?? "").trim();
      if (!Number.isInteger(id) || id <= 0) throw new Error("A valid bird transfer is required.");
      if (!reason) throw new Error("Cancellation reason is required.");
      const { error } = await admin_db.rpc("cancel_breeder_transfer", { p_transfer_id: id, p_reason: reason, p_user_id: user.id });
      if (error) throw error;
      return NextResponse.json({ id });
    }

    const input = body.input ?? {};
    const transferDate = String(input.transfer_date ?? "");
    const sourcePlacementId = Number(input.source_placement_id);
    const destinationPlacementId = Number(input.destination_placement_id);
    const maleQty = Number(input.male_qty ?? 0);
    const femaleQty = Number(input.female_qty ?? 0);
    const reason = String(input.reason ?? "").trim();
    const remarks = String(input.remarks ?? "").trim() || null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transferDate)) throw new Error("Transfer date is required.");
    if (transferDate > businessDate()) throw new Error("Transfer date cannot be later than today.");
    if (!Number.isInteger(sourcePlacementId) || !Number.isInteger(destinationPlacementId) || sourcePlacementId <= 0 || destinationPlacementId <= 0) throw new Error("Source and destination placements are required.");
    if (sourcePlacementId === destinationPlacementId) throw new Error("Source and destination cannot be the same placement.");
    if (!Number.isInteger(maleQty) || !Number.isInteger(femaleQty) || maleQty < 0 || femaleQty < 0 || maleQty + femaleQty <= 0) throw new Error("Enter a positive whole-number male or female quantity.");
    if (!reason) throw new Error("Transfer reason is required.");

    const transferNo = `BTR-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { data, error } = await admin_db.from("tbl_breeder_transfer").insert({
      transfer_no: transferNo, transfer_date: transferDate,
      source_placement_id: sourcePlacementId, destination_placement_id: destinationPlacementId,
      male_qty: maleQty, female_qty: femaleQty, reason, remarks,
      status: "Draft", created_by: user.id,
    }).select("id").single();
    if (error) throw error;
    createdId = Number(data.id);
    if (body.post) {
      const { error: postError } = await admin_db.rpc("post_breeder_transfer", { p_transfer_id: createdId, p_user_id: user.id });
      if (postError) {
        await admin_db.from("tbl_breeder_transfer").delete().eq("id", createdId).eq("status", "Draft");
        throw postError;
      }
    }
    return NextResponse.json({ id: createdId });
  } catch (error) {
    return NextResponse.json({ error: message(error), id: createdId }, { status: 400 });
  }
}
