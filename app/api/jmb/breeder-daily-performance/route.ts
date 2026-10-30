import { NextResponse } from "next/server";
import { admin_db } from "@/lib/Supabase/supabaseAdmin";

export const runtime = "nodejs";

const TABLE = "tbl_breeder_daily_performance";
const numericFields = [
  "inv_male", "inv_female", "mc_male", "mc_female", "cull_male", "cull_female",
  "kitchen_male", "kitchen_female", "condem_male", "condem_female",
  "avg_body_weight_male", "avg_body_weight_female", "feed_consumption_male",
  "feed_consumption_female",
] as const;
const nullableNumericFields = [
  "m_body_weight",
  "f_body_weight",
  "m_uniformity",
  "f_uniformity",
] as const;

type DailyPerformanceInput = Record<string, unknown>;
type ExistingDailyPerformance = {
  id: number;
  daterec: string;
  trans_in_male: number | null;
  trans_in_female: number | null;
  trans_out_male: number | null;
  trans_out_female: number | null;
};

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

function normalizeInput(input: DailyPerformanceInput) {
  const placementId = Number(input.placement_id);
  const daterec = String(input.daterec ?? "");
  if (!Number.isInteger(placementId) || placementId <= 0) {
    throw new Error("A valid placement is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(daterec)) {
    throw new Error("A valid record date is required.");
  }

  const payload: Record<string, unknown> = {
    placement_id: placementId,
    daterec,
    male_feedtype_id:
      input.male_feedtype_id == null ? null : Number(input.male_feedtype_id),
    female_feedtype_id:
      input.female_feedtype_id == null ? null : Number(input.female_feedtype_id),
    isactive: input.isactive !== false,
  };
  numericFields.forEach((field) => {
    const value = Number(input[field] ?? 0);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${field} must be zero or greater.`);
    }
    payload[field] = value;
  });
  nullableNumericFields.forEach((field) => {
    const raw = input[field];
    const value = raw == null || raw === "" ? null : Number(raw);
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${field} must be zero or greater.`);
    }
    payload[field] = value;
  });
  if (input.remarks != null && typeof input.remarks !== "string") {
    throw new Error("Remarks must be text.");
  }
  payload.remarks = input.remarks == null ? null : String(input.remarks).trim() || null;
  return { placementId, daterec, payload };
}

async function saveDailyPerformanceBatch(
  userId: string,
  inputs: DailyPerformanceInput[],
) {
  if (!inputs.length) throw new Error("At least one record is required.");
  const normalized = inputs.map(normalizeInput);
  const placementIds = new Set(normalized.map((row) => row.placementId));
  if (placementIds.size !== 1) {
    throw new Error("All Population Record rows must belong to one placement.");
  }
  const recordDates = normalized.map((row) => row.daterec);
  if (new Set(recordDates).size !== recordDates.length) {
    throw new Error("Each record date must be unique on this placement card.");
  }

  const placementId = normalized[0].placementId;
  const { data: placement, error: placementError } = await admin_db
    .from("tbl_placement")
    .select("placement_date")
    .eq("id", placementId)
    .single();
  if (placementError) throw placementError;
  normalized.forEach(({ daterec }) => {
    if (placement.placement_date && daterec < String(placement.placement_date)) {
      throw new Error("Record date cannot be earlier than the placement date.");
    }
  });

  const { data: existingRows, error: existingError } = await admin_db
    .from(TABLE)
    .select("id, daterec, trans_in_male, trans_in_female, trans_out_male, trans_out_female")
    .eq("placement_id", placementId)
    .eq("isactive", true)
    .in("daterec", recordDates);
  if (existingError) throw existingError;

  const existingByDate = new Map<string, ExistingDailyPerformance>();
  (existingRows ?? []).forEach((row) => {
    const existing = row as ExistingDailyPerformance;
    if (existingByDate.has(existing.daterec)) {
      throw new Error(`More than one active record exists for ${existing.daterec}.`);
    }
    existingByDate.set(existing.daterec, existing);
  });

  const now = new Date().toISOString();
  const rowsToWrite = normalized.map(({ daterec, payload }) => {
    const existing = existingByDate.get(daterec);
    return {
      ...payload,
      ...(existing
        ? {
            id: existing.id,
            trans_in_male: Number(existing.trans_in_male ?? 0),
            trans_in_female: Number(existing.trans_in_female ?? 0),
            trans_out_male: Number(existing.trans_out_male ?? 0),
            trans_out_female: Number(existing.trans_out_female ?? 0),
            updated_at: now,
            updated_by: userId,
          }
        : {
            trans_in_male: 0,
            trans_in_female: 0,
            trans_out_male: 0,
            trans_out_female: 0,
            created_by: userId,
          }),
    };
  });
  const { data, error } = await admin_db
    .from(TABLE)
    .upsert(rowsToWrite, { onConflict: "id", defaultToNull: false })
    .select("*");
  if (error) throw error;
  return data ?? [];
}

export async function POST(req: Request) {
  try {
    const token = tokenFrom(req);
    if (!token) throw new Error("Missing authorization token.");
    const { data: { user }, error: authError } = await admin_db.auth.getUser(token);
    if (authError) throw authError;
    if (!user) throw new Error("Invalid authorization token.");

    const body = (await req.json()) as {
      payload?: DailyPerformanceInput;
      rows?: DailyPerformanceInput[];
    };
    const isBatch = Array.isArray(body.rows);
    const rows: DailyPerformanceInput[] = Array.isArray(body.rows)
      ? body.rows
      : body.payload
        ? [body.payload]
        : [];
    const data = await saveDailyPerformanceBatch(user.id, rows);
    return NextResponse.json({ data: isBatch ? data : data[0] });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}
