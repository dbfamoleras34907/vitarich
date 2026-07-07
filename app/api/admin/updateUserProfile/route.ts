export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { admin_db } from "@/lib/Supabase/supabaseAdmin";

type UserProfilePayload = {
  auth_id?: string;
  created_by?: string | null;
  firstname?: string | null;
  middlename?: string | null;
  lastname?: string | null;
  gender?: string | null;
  phone?: string | null;
  mobile?: string | null;
  birthdate?: string | null;
  location?: string | null;
  remarks?: string | null;
  default_farm?: string | null;
  supervisor?: string | null;
  archipelago?: string | null;
  region?: string | null;
};

type RequestBody = {
  userProfileData?: UserProfilePayload;
  defaultFarms?: unknown[];
};

const normalizeText = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const normalizeNumber = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

const uniqueFarmCodes = (values: unknown[]) => Array.from(
  new Set(
    values
      .map((code) => String(code ?? "").trim())
      .filter(Boolean)
  )
);

export async function POST(req: Request) {
  try {
    const body = await req.json() as RequestBody;
    const userProfileData = body.userProfileData;

    if (!userProfileData?.auth_id) {
      return NextResponse.json({ error: "User auth_id is required." }, { status: 400 });
    }

    const assignedFarmCodes = uniqueFarmCodes(body.defaultFarms ?? []);
    const userPayload = {
      firstname: normalizeText(userProfileData.firstname),
      middlename: normalizeText(userProfileData.middlename),
      lastname: normalizeText(userProfileData.lastname),
      gender: normalizeText(userProfileData.gender),
      phone: normalizeText(userProfileData.phone),
      mobile: normalizeText(userProfileData.mobile),
      birthdate: normalizeText(userProfileData.birthdate),
      location: normalizeText(userProfileData.location),
      remarks: normalizeText(userProfileData.remarks),
      default_farm: normalizeText(userProfileData.default_farm),
      supervisor: normalizeNumber(userProfileData.supervisor),
      archipelago: normalizeText(userProfileData.archipelago),
      region: normalizeText(userProfileData.region),
      updated_at: new Date().toISOString(),
      updated_by: userProfileData.created_by,
    };

    const { data: updatedUser, error: userError } = await admin_db
      .from("users")
      .update(userPayload)
      .eq("auth_id", userProfileData.auth_id)
      .select("id")
      .single();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    if (!updatedUser?.id) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const { error: voidFarmsError } = await admin_db
      .from("users_farms")
      .update({ void: "0" })
      .eq("users_id", updatedUser.id);

    if (voidFarmsError) {
      return NextResponse.json({ error: voidFarmsError.message }, { status: 400 });
    }

    if (assignedFarmCodes.length > 0) {
      const { data: farms, error: farmsError } = await admin_db
        .from("farms")
        .select("id, code")
        .in("code", assignedFarmCodes);

      if (farmsError) {
        return NextResponse.json({ error: farmsError.message }, { status: 400 });
      }

      const foundFarmCodes = new Set((farms ?? []).map((farm) => farm.code));
      const missingFarmCodes = assignedFarmCodes.filter((code) => !foundFarmCodes.has(code));

      if (missingFarmCodes.length > 0) {
        return NextResponse.json(
          { error: `Farm code not found: ${missingFarmCodes.join(", ")}` },
          { status: 400 }
        );
      }

      const { data: existingUserFarms, error: existingUserFarmsError } = await admin_db
        .from("users_farms")
        .select("farm_code")
        .eq("users_id", updatedUser.id)
        .in("farm_code", assignedFarmCodes);

      if (existingUserFarmsError) {
        return NextResponse.json({ error: existingUserFarmsError.message }, { status: 400 });
      }

      const existingFarmCodes = new Set(
        (existingUserFarms ?? [])
          .map((row) => String(row.farm_code ?? "").trim())
          .filter(Boolean)
      );

      if (existingFarmCodes.size > 0) {
        const { error: reactivateFarmsError } = await admin_db
          .from("users_farms")
          .update({ void: "1" })
          .eq("users_id", updatedUser.id)
          .in("farm_code", Array.from(existingFarmCodes));

        if (reactivateFarmsError) {
          return NextResponse.json({ error: reactivateFarmsError.message }, { status: 400 });
        }
      }

      const farmRows = (farms ?? [])
        .filter((farm) => !existingFarmCodes.has(farm.code))
        .map((farm) => ({
          users_id: updatedUser.id,
          farm_code: farm.code,
          farm_id: farm.id,
          created_by: userProfileData.created_by,
          void: "1",
        }));

      if (farmRows.length > 0) {
        const { error: insertFarmsError } = await admin_db
          .from("users_farms")
          .insert(farmRows);

        if (insertFarmsError) {
          return NextResponse.json({ error: insertFarmsError.message }, { status: 400 });
        }
      }
    }

    const { data: activeRows, error: activeRowsError } = await admin_db
      .from("users_farms")
      .select("farm_code")
      .eq("users_id", updatedUser.id)
      .eq("void", "1");

    if (activeRowsError) {
      return NextResponse.json({ error: activeRowsError.message }, { status: 400 });
    }

    const activeFarmCodes = uniqueFarmCodes((activeRows ?? []).map((row) => row.farm_code));

    return NextResponse.json({
      userId: updatedUser.id,
      activeFarmCodes,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("Update user profile API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
