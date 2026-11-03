import { NextResponse } from "next/server";
import { admin_db } from "@/lib/Supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InventoryCorrectionHistoryRow = {
  id: number;
  correction_no: string;
  created_at: string;
  male_previous_qty: number | null;
  male_corrected_qty: number | null;
  female_previous_qty: number;
  female_corrected_qty: number;
  reason: string;
  remarks: string | null;
  status: string;
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Request failed.");
  }
  return "Request failed.";
}

async function authenticatedUser(request: Request) {
  const [scheme, token] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new Error("Missing authorization token.");
  }
  const { data, error } = await admin_db.auth.getUser(token);
  if (error) throw error;
  if (!data.user) throw new Error("Invalid authorization token.");
  return data.user;
}

export async function GET(request: Request) {
  try {
    await authenticatedUser(request);
    const placementId = Number(new URL(request.url).searchParams.get("placementId"));
    if (!Number.isInteger(placementId) || placementId <= 0) {
      throw new Error("A valid placement is required.");
    }
    const select = "id, correction_no, created_at, male_previous_qty, male_corrected_qty, female_previous_qty, female_corrected_qty, reason, remarks, status";
    const result = await admin_db
      .from("tbl_breeder_inventory_correction")
      .select(select)
      .eq("placement_id", placementId)
      .order("created_at", { ascending: false });
    let rows: InventoryCorrectionHistoryRow[] = [];
    if (result.error?.code === "PGRST204") {
      const legacy = await admin_db
        .from("tbl_breeder_inventory_correction")
        .select("id, correction_no, created_at, female_previous_qty, female_corrected_qty, reason, remarks, status")
        .eq("placement_id", placementId)
        .order("created_at", { ascending: false });
      if (legacy.error) throw legacy.error;
      rows = (legacy.data ?? []).map((row) => ({
          ...row,
          male_previous_qty: null,
          male_corrected_qty: null,
        })) as InventoryCorrectionHistoryRow[];
    } else if (result.error) {
      throw result.error;
    } else {
      rows = (result.data ?? []) as InventoryCorrectionHistoryRow[];
    }
    return NextResponse.json(
      { data: rows },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticatedUser(request);
    const body = (await request.json()) as Record<string, unknown>;
    const placementId = Number(body.placementId);
    const maleCorrectedQty = Number(body.maleCorrectedQty);
    const femaleCorrectedQty = Number(body.femaleCorrectedQty);
    const reason = String(body.reason ?? "").trim();
    const remarks = String(body.remarks ?? "").trim();

    if (!Number.isInteger(placementId) || placementId <= 0) {
      throw new Error("A valid placement is required.");
    }
    if (!Number.isInteger(maleCorrectedQty) || maleCorrectedQty < 0 || !Number.isInteger(femaleCorrectedQty) || femaleCorrectedQty < 0) {
      throw new Error("Male and female corrected quantities must be non-negative whole numbers.");
    }
    if (!reason) throw new Error("A correction reason is required.");

    const { data, error } = await admin_db.rpc("post_breeder_inventory_correction", {
      p_placement_id: placementId,
      p_male_corrected_qty: maleCorrectedQty,
      p_female_corrected_qty: femaleCorrectedQty,
      p_reason: reason,
      p_remarks: remarks || null,
      p_user_id: user.id,
    });
    if (error) throw error;
    const correctionId = Number(data);
    if (!Number.isInteger(correctionId) || correctionId <= 0) {
      throw new Error("The inventory correction was not posted.");
    }
    return NextResponse.json({ id: correctionId });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
