export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { admin_db } from "@/lib/Supabase/supabaseAdmin";
import { activeApprovedFarmsQuery } from "@/lib/data/repositories/farms";
import { NavFolders } from "@/lib/Defaults/DefaultValues";
import { USER_TYPE, adminAccessError, canManageUser, requireAdminActor } from "@/lib/auth/adminAccess";

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
  issuper?: string | null;
  archipelago?: string | null;
  region?: string | null;
  fms_type?: string | null;
  users_group_id?: string | number | null;
  user_type?: number | null;
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

const FMS_TYPES = new Set(["Broiler", "Breeder", "Hatchery"]);

export async function POST(req: Request) {
  try {
    const actor = await requireAdminActor(req);
    const body = await req.json() as RequestBody;
    const userProfileData = body.userProfileData;

    if (!userProfileData?.auth_id) {
      return NextResponse.json({ error: "User auth_id is required." }, { status: 400 });
    }

    const assignedFarmCodes = uniqueFarmCodes(body.defaultFarms ?? []);
    const { data: current, error: currentError } = await admin_db
      .from("users")
      .select("id, auth_id, email, firstname, lastname, fms_type, user_type, issuper")
      .eq("auth_id", userProfileData.auth_id)
      .single();
    if (currentError || !current) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const target = { ...current, user_type: Number(current.user_type ?? USER_TYPE.USER) };
    if (!canManageUser(actor, target)) throw new Error("FORBIDDEN");

    const isSuperAdmin = actor.user_type === USER_TYPE.SUPER_ADMIN;
    const userType = isSuperAdmin ? Number(userProfileData.user_type ?? target.user_type) : target.user_type;
    const fmsType = isSuperAdmin ? normalizeText(userProfileData.fms_type) : target.fms_type;

    if (![1, 2, 3].includes(userType)) {
      return NextResponse.json({ error: "Invalid user type." }, { status: 400 });
    }

    if (fmsType && !FMS_TYPES.has(fmsType)) {
      return NextResponse.json({ error: "Invalid FMS type." }, { status: 400 });
    }
    if (userType !== USER_TYPE.SUPER_ADMIN && !fmsType) {
      return NextResponse.json({ error: "FMS type is required for Admin and User accounts." }, { status: 400 });
    }

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
      issuper: userType === USER_TYPE.USER ? "0" : "1",
      archipelago: normalizeText(userProfileData.archipelago),
      region: normalizeText(userProfileData.region),
      fms_type: fmsType,
      users_group_id: normalizeNumber(userProfileData.users_group_id),
      user_type: userType,
      updated_at: new Date().toISOString(),
      updated_by: actor.auth_id,
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

    if (isSuperAdmin && target.fms_type !== fmsType && fmsType) {
      const allowed = new Set<string>();
      NavFolders
        .filter(folder => !folder.fmsTypes?.length || folder.fmsTypes.includes(fmsType as "Broiler" | "Breeder" | "Hatchery"))
        .forEach(folder => folder.items?.forEach(group => group.children.forEach(child => {
          allowed.add(`${group.group}|${child.title}`);
          (["view", "insert", "edit", "void", "approval"] as const).forEach(action => {
            if (child[action]) allowed.add(`${group.group}|${child.title}/${action}`);
          });
        })));

      const { data: permissionRows, error: permissionError } = await admin_db
        .from("user_permissions")
        .select("group_name, title")
        .eq("user_id", userProfileData.auth_id)
        .eq("is_visible", true);
      if (permissionError) throw permissionError;

      for (const permission of permissionRows ?? []) {
        if (allowed.has(`${permission.group_name}|${permission.title}`)) continue;
        const { error } = await admin_db.from("user_permissions")
          .update({ is_visible: false, updated_by: actor.auth_id, updated_at: new Date().toISOString() })
          .eq("user_id", userProfileData.auth_id)
          .eq("group_name", permission.group_name)
          .eq("title", permission.title);
        if (error) throw error;
      }
    }

    const { error: voidFarmsError } = await admin_db
      .from("users_farms")
      .update({ void: "0" })
      .eq("users_id", updatedUser.id);

    if (voidFarmsError) {
      return NextResponse.json({ error: voidFarmsError.message }, { status: 400 });
    }

    if (assignedFarmCodes.length > 0) {
      const { data: farms, error: farmsError } = await activeApprovedFarmsQuery(admin_db.from("farms").select("id, code"))
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
          created_by: actor.auth_id,
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
    console.error("Update user profile API error:", error);
    const response = adminAccessError(error);
    return NextResponse.json({ error: response.status === 500 && error instanceof Error ? error.message : response.message }, { status: response.status });
  }
}
