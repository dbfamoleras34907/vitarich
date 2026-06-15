import { NextResponse } from "next/server";
import { admin_db } from "@/lib/Supabase/supabaseAdmin";

export const runtime = "nodejs";

const GROWING_TABLE = "tbl_growing";
const GROWING_FARM_HISTORY_VIEW = "view_growing_farm_history";
const GROWING_FARM_HISTORY_SELECT =
  "record_date, farm, building, pen, age, week_no, female_mortality, female_feed, female_feed_type, female_body_weight, male_mortality, male_feed, male_feed_type, male_body_weight";

type GrowingWritePayload = {
  placement_id?: number | null;
  daterec?: string | null;
  female_mortality?: number | null;
  female_feedtype_id?: number | null;
  female_feed_consumption?: number | null;
  female_body_weight?: number | null;
  male_mortality?: number | null;
  male_feedtype_id?: number | null;
  male_feed_consumption?: number | null;
  male_body_weight?: number | null;
  isactive?: boolean;
};

function getToken(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  return scheme.toLowerCase() === "bearer" ? token : "";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Request failed.";
}

async function requireUser(req: Request) {
  const token = getToken(req);
  if (!token) throw new Error("Missing authorization token.");

  const {
    data: { user },
    error,
  } = await admin_db.auth.getUser(token);

  if (error) throw error;
  if (!user) throw new Error("Invalid authorization token.");
  return user;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json();

    if (body.action === "create") {
      const payload = body.payload as GrowingWritePayload;
      const { data, error } = await admin_db
        .from(GROWING_TABLE)
        .insert({ ...payload, created_by: user.id })
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (body.action === "createBatch") {
      const payloads = body.payloads as GrowingWritePayload[];
      const { data, error } = await admin_db
        .from(GROWING_TABLE)
        .insert(payloads.map((payload) => ({ ...payload, created_by: user.id })))
        .select("*");

      if (error) throw error;
      return NextResponse.json({ data: data ?? [] });
    }

    if (body.action === "update") {
      const id = Number(body.id);
      if (!Number.isFinite(id)) throw new Error("Invalid growing id.");

      const payload = body.payload as GrowingWritePayload;
      const { data, error } = await admin_db
        .from(GROWING_TABLE)
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function GET(req: Request) {
  try {
    await requireUser(req);

    const url = new URL(req.url);
    const type = url.searchParams.get("type");

    if (type !== "history") {
      return NextResponse.json({ error: "Invalid request type." }, { status: 400 });
    }

    let query = admin_db
      .from(GROWING_FARM_HISTORY_VIEW)
      .select(GROWING_FARM_HISTORY_SELECT)
      .order("record_date", { ascending: false })
      .order("pen", { ascending: true })
      .limit(50);

    const farmName = url.searchParams.get("farmName")?.trim();
    const buildingNo = url.searchParams.get("buildingNo")?.trim();

    if (farmName) query = query.eq("farm", farmName);
    if (buildingNo) query = query.eq("building", buildingNo);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
