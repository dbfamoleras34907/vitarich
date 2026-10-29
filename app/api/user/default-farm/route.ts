export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { admin_db } from "@/lib/Supabase/supabaseAdmin";
import { activeApprovedFarmsQuery, farmFmsType } from "@/lib/data/repositories/farms";
import { isServiceUnavailableError } from "@/lib/networkError";

type RequestBody = {
  farmId?: unknown;
};

function responseForError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (isServiceUnavailableError(error)) {
    return NextResponse.json(
      { error: "The authentication or database service is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }

  console.error("Update default farm API error:", error);
  return NextResponse.json({ error: "Unable to update the default farm." }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";
    if (!token) throw new Error("UNAUTHENTICATED");

    const { data: authData, error: authError } = await admin_db.auth.getUser(token);
    if (authError) {
      if (isServiceUnavailableError(authError) || !authError.status) throw authError;
      throw new Error("UNAUTHENTICATED");
    }
    if (!authData.user?.id) throw new Error("UNAUTHENTICATED");

    const body = await request.json() as RequestBody;
    const farmId = Number(body.farmId);
    if (!Number.isInteger(farmId) || farmId <= 0) {
      return NextResponse.json({ error: "Select a valid farm." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await admin_db
      .from("users")
      .select("id, auth_id")
      .eq("auth_id", authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.id) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const { data: farm, error: farmError } = await activeApprovedFarmsQuery(
      admin_db.from("farms").select("id, code, name, farm_type"),
    )
      .eq("id", farmId)
      .maybeSingle();
    if (farmError) throw farmError;
    if (!farm) {
      return NextResponse.json({ error: "The selected farm is not active and approved." }, { status: 400 });
    }

    const { data: assignments, error: assignmentError } = await admin_db
      .from("users_farms")
      .select("farm_id, farm_code")
      .eq("users_id", profile.id)
      .eq("void", 1);
    if (assignmentError) throw assignmentError;

    const isAssigned = (assignments ?? []).some((assignment) =>
      Number(assignment.farm_id) === farmId
      || String(assignment.farm_code ?? "").trim() === String(farm.code ?? "").trim(),
    );
    if (!isAssigned) {
      return NextResponse.json({ error: "The selected farm is not assigned to your account." }, { status: 403 });
    }

    const fmsType = farmFmsType(farm.farm_type);
    const { data: updated, error: updateError } = await admin_db
      .from("users")
      .update({
        default_farm: String(farm.code),
        updated_at: new Date().toISOString(),
        updated_by: authData.user.id,
      })
      .eq("id", profile.id)
      .eq("auth_id", authData.user.id)
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated?.id) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    return NextResponse.json({
      farm: {
        id: Number(farm.id),
        code: String(farm.code),
        name: String(farm.name ?? farm.code),
        farmType: String(farm.farm_type ?? ""),
        fmsType,
      },
    });
  } catch (error: unknown) {
    return responseForError(error);
  }
}
