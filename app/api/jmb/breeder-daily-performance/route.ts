import { NextResponse } from "next/server";
import { admin_db } from "@/lib/Supabase/supabaseAdmin";

export const runtime = "nodejs";

const TABLE = "tbl_breeder_daily_performance";
const numericFields = [
  "inv_male", "inv_female", "mc_male", "mc_female", "cull_male", "cull_female",
  "trans_in_male", "trans_in_female", "trans_out_male", "trans_out_female",
  "avg_body_weight_male", "avg_body_weight_female", "feed_consumption_male",
  "feed_consumption_female",
] as const;

function tokenFrom(req: Request) {
  const [scheme, token] = (req.headers.get("authorization") ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : "";
}

function message(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Request failed.");
  }
  return "Request failed.";
}

export async function POST(req: Request) {
  try {
    const token = tokenFrom(req);
    if (!token) throw new Error("Missing authorization token.");
    const { data: { user }, error: authError } = await admin_db.auth.getUser(token);
    if (authError) throw authError;
    if (!user) throw new Error("Invalid authorization token.");

    const body = (await req.json()) as { payload?: Record<string, unknown> };
    const input = body.payload ?? {};
    const placementId = Number(input.placement_id);
    const daterec = String(input.daterec ?? "");
    if (!Number.isInteger(placementId) || placementId <= 0) throw new Error("A valid placement is required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(daterec)) throw new Error("A valid record date is required.");

    const { data: placement, error: placementError } = await admin_db
      .from("tbl_placement")
      .select("placement_date")
      .eq("id", placementId)
      .single();
    if (placementError) throw placementError;
    if (placement.placement_date && daterec < String(placement.placement_date)) {
      throw new Error("Record date cannot be earlier than the placement date.");
    }

    const payload: Record<string, unknown> = {
      placement_id: placementId,
      daterec,
      male_feedtype_id: input.male_feedtype_id == null ? null : Number(input.male_feedtype_id),
      female_feedtype_id: input.female_feedtype_id == null ? null : Number(input.female_feedtype_id),
      isactive: input.isactive !== false,
    };
    numericFields.forEach((field) => {
      const value = Number(input[field] ?? 0);
      if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be zero or greater.`);
      payload[field] = value;
    });

    const { data: existing, error: findError } = await admin_db
      .from(TABLE)
      .select("id")
      .eq("placement_id", placementId)
      .eq("daterec", daterec)
      .eq("isactive", true)
      .maybeSingle();
    if (findError) throw findError;

    const query = existing
      ? admin_db.from(TABLE).update({ ...payload, updated_at: new Date().toISOString(), updated_by: user.id }).eq("id", existing.id)
      : admin_db.from(TABLE).insert({ ...payload, created_by: user.id });
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}
