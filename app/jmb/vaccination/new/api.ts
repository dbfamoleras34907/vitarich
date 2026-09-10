import { db } from "@/lib/Supabase/supabaseClient";
import type { DefaultFarm } from "@/lib/types";

const TABLE = "tbl_brd_vaccination";
const TARGET_TABLE = "tbl_brd_vaccination_target";
const REGISTER_VIEW = "brd_vaccination_register";
const LOCATION_VIEW = "view_farm_new_lookup";

export type VaccinationChoices = { vaccineTypes: string[]; dosages: number[] };

export async function listVaccinationChoices(): Promise<VaccinationChoices> {
  const [types, dosages] = await Promise.all([
    db.from("tbl_brd_vaccine_type").select("name").eq("is_active", true).order("sort_order").order("name"),
    db.from("tbl_brd_vaccine_dosage").select("dosage").eq("is_active", true).order("dosage"),
  ]);
  if (types.error || dosages.error) throw new Error("Unable to load vaccination choices. Please contact your administrator.");
  const choices = {
    vaccineTypes: (types.data ?? []).map((row) => String(row.name)),
    dosages: (dosages.data ?? []).map((row) => Number(row.dosage)),
  };
  return choices;
}

async function validateVaccinationChoices(input: VaccinationInput) {
  if (input.started_at && !Number.isFinite(Date.parse(input.started_at))) throw new Error("Date/Time Started is invalid.");
  if (input.ended_at && (!input.started_at || !Number.isFinite(Date.parse(input.ended_at)) || Date.parse(input.ended_at) < Date.parse(input.started_at))) throw new Error("Date/Time Ended must be on or after Date/Time Started.");
  const choices = await listVaccinationChoices();
  if (!choices.vaccineTypes.includes(input.vaccine_type)) throw new Error("Select a valid vaccine type.");
  if (!choices.dosages.includes(input.dosage)) throw new Error("Select a valid dosage.");
}

export const VACCINATION_ROUTES = ["Water", "Spray of bird", "Injection-SC", "Injection-IM", "Wing web", "Eye drop", "Spray of feed", "In-Ovo", "Other"] as const;
export type VaccinationScope = "Farm" | "Building" | "Selected Pens" | "All Pens";

export type FarmLocation = {
  farm_id: number; farm_code: string | null; farm_name: string;
  building_id: number; building_code: string | null; building_name: string;
  pen_id: number; pen_code: string | null; pen_name: string;
};

export type VaccinationRecord = {
  id: number; document_no: string; vaccination_date: string;
  scheduled_vaccination_date: string | null; date_variance_days: number | null;
  farm_id: number; farm_code: string | null; farm_name: string; scope: VaccinationScope;
  building_id: number | null; building_code: string | null; building_name: string | null;
  vaccine_brand: string; vaccine_type: string; disease_target: string;
  dosage: number; route: string;
  batch_number: string; expiry_date: string;
  birds_before: number | null; birds_vaccinated: number | null; birds_missed: number | null;
  started_at: string | null; ended_at: string | null;
  administered_by: string | null; supervised_by: string | null;
  cold_chain_verified: boolean; label_verified: boolean; expiry_verified: boolean;
  status: "Posted" | "Cancelled"; remarks: string | null; target_count?: number; target_names?: string | null;
  created_at: string;
};

export type VaccinationInput = Omit<VaccinationRecord, "id" | "document_no" | "status" | "created_at" | "target_count" | "target_names" | "date_variance_days" | "birds_before" | "birds_vaccinated" | "birds_missed"> & {
  targets: Array<Pick<FarmLocation, "building_id" | "building_code" | "building_name" | "pen_id" | "pen_code" | "pen_name">>;
};
export type VaccinationTarget = VaccinationInput["targets"][number];
export type VaccinationEditRecord = VaccinationRecord & { targets: VaccinationTarget[] };

async function currentUserId() {
  const { data, error } = await db.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Your session has expired. Please sign in again.");
  return data.user.id;
}

function documentNo() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `VAC-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function listVaccinationLocations() {
  const { data, error } = await db.from(LOCATION_VIEW)
    .select("farm_id, farm_code, farm_name, building_id, building_code, building_name, pen_id, pen_code, pen_name")
    .order("farm_name").order("building_name").order("pen_name");
  if (error) throw error;
  return (data ?? []) as FarmLocation[];
}

export async function getDefaultFarm() {
  const { data: auth } = await db.auth.getSession();
  if (!auth.session?.user.id) return null;
  const { data, error } = await db.from("vwdmf_user_default_farm").select("*").eq("auth_id", auth.session.user.id).limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as DefaultFarm | undefined) ?? null;
}

export async function listVaccinations() {
  const { data, error } = await db.from(REGISTER_VIEW).select("*")
    .order("vaccination_date", { ascending: false }).order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VaccinationRecord[];
}

export async function getVaccinationById(id: number) {
  const [{ data: record, error: recordError }, { data: targets, error: targetError }] = await Promise.all([
    db.from(REGISTER_VIEW).select("*").eq("id", id).single(),
    db.from(TARGET_TABLE)
      .select("building_id, building_code, building_name, pen_id, pen_code, pen_name")
      .eq("vaccination_id", id)
      .order("line_no"),
  ]);
  if (recordError) throw recordError;
  if (targetError) throw targetError;
  return { ...record, targets: targets ?? [] } as VaccinationEditRecord;
}

export async function createVaccination(input: VaccinationInput) {
  const userId = await currentUserId();
  await validateVaccinationChoices(input);
  if ((input.scope === "Selected Pens" || input.scope === "All Pens") && input.targets.length === 0) {
    throw new Error(input.scope === "All Pens" ? "The selected building has no pens." : "Select at least one pen.");
  }
  const { targets, ...header } = input;
  const { data, error } = await db.from(TABLE)
    .insert({ ...header, document_no: documentNo(), created_by: userId, status: "Posted" })
    .select("*").single();
  if (error) throw error;
  if (targets.length) {
    const { error: targetError } = await db.from(TARGET_TABLE).insert(targets.map((target, index) => ({
      vaccination_id: data.id, line_no: index + 1, created_by: userId, ...target,
    })));
    if (targetError) {
      await db.from(TABLE).delete().eq("id", data.id);
      throw targetError;
    }
  }
  return data as VaccinationRecord;
}

export async function updateVaccination(id: number, input: VaccinationInput) {
  const userId = await currentUserId();
  await validateVaccinationChoices(input);
  if ((input.scope === "Selected Pens" || input.scope === "All Pens") && input.targets.length === 0) {
    throw new Error(input.scope === "All Pens" ? "The selected building has no pens." : "Select at least one pen.");
  }
  const { targets, ...header } = input;
  const { data, error } = await db.from(TABLE)
    .update({ ...header, updated_by: userId })
    .eq("id", id).eq("status", "Posted").select("*").single();
  if (error) throw error;

  const { error: deleteError } = await db.from(TARGET_TABLE).delete().eq("vaccination_id", id);
  if (deleteError) throw deleteError;
  if (targets.length) {
    const { error: targetError } = await db.from(TARGET_TABLE).insert(targets.map((target, index) => ({
      vaccination_id: id, line_no: index + 1, created_by: userId, ...target,
    })));
    if (targetError) throw targetError;
  }
  return data as VaccinationRecord;
}

export async function cancelVaccination(id: number, reason: string) {
  const userId = await currentUserId();
  if (!reason.trim()) throw new Error("Cancellation reason is required.");
  const { data, error } = await db.from(TABLE).update({
    status: "Cancelled", cancelled_by: userId, cancelled_at: new Date().toISOString(),
    cancellation_reason: reason.trim(), updated_by: userId,
  }).eq("id", id).eq("status", "Posted").select("*").single();
  if (error) throw error;
  return data as VaccinationRecord;
}
