import { db } from "@/lib/Supabase/supabaseClient";
import type { DefaultFarm } from "@/lib/types";

const TABLE = "tbl_brd_medication";
const TARGET_TABLE = "tbl_brd_medication_target";
const REGISTER_VIEW = "brd_medication_register";
const LOCATION_VIEW = "view_farm_new_lookup";

export async function listMedicationTypes(): Promise<string[]> {
  const { data, error } = await db.from("tbl_brd_medication_type")
    .select("name").eq("is_active", true).order("sort_order").order("name");
  if (error) throw new Error("Unable to load medication types. Please contact your administrator.");
  return (data ?? []).map((row) => String(row.name));
}

async function validateMedicationType(name: string) {
  const types = await listMedicationTypes();
  if (!types.includes(name)) throw new Error("Select an active medication type from the list.");
}

export const MEDICATION_ROUTES = [
  "Water",
  "Spray of bird",
  "Injection",
  "Wing",
  "Eye drop",
  "Spray of feed",
  "Oral",
  "Feed",
  "Other",
] as const;

export type MedicationScope = "Farm" | "Building" | "Selected Pens" | "All Pens";

export type FarmLocation = {
  farm_id: number;
  farm_code: string | null;
  farm_name: string;
  building_id: number;
  building_code: string | null;
  building_name: string;
  pen_id: number;
  pen_code: string | null;
  pen_name: string;
};

export type MedicationRecord = {
  id: number;
  document_no: string;
  medication_date: string;
  treatment_end_date?: string | null;
  farm_id: number;
  farm_code: string | null;
  farm_name: string;
  scope: MedicationScope;
  building_id: number | null;
  building_code: string | null;
  building_name: string | null;
  medication_brand: string;
  medication_type: string;
  dosage: number;
  unit: string;
  indication: string;
  treatment_period_days: number;
  route: string;
  prescribed_by: string | null;
  administered_by: string | null;
  status: "Posted" | "Cancelled";
  remarks: string | null;
  target_count?: number;
  target_names?: string | null;
  created_at: string;
};

export type MedicationInput = {
  medication_date: string;
  farm_id: number;
  farm_code: string | null;
  farm_name: string;
  scope: MedicationScope;
  building_id: number | null;
  building_code: string | null;
  building_name: string | null;
  medication_brand: string;
  medication_type: string;
  dosage: number;
  unit: string;
  indication: string;
  treatment_period_days: number;
  route: string;
  prescribed_by: string | null;
  administered_by: string | null;
  remarks: string | null;
  targets: Array<Pick<FarmLocation, "building_id" | "building_code" | "building_name" | "pen_id" | "pen_code" | "pen_name">>;
};

export type MedicationTarget = MedicationInput["targets"][number];
export type MedicationEditRecord = MedicationRecord & { targets: MedicationTarget[] };

async function currentUserId() {
  const { data, error } = await db.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Your session has expired. Please sign in again.");
  return data.user.id;
}

function documentNo() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
  return `MED-${stamp}`;
}

export async function listMedicationLocations() {
  const { data, error } = await db
    .from(LOCATION_VIEW)
    .select("farm_id, farm_code, farm_name, building_id, building_code, building_name, pen_id, pen_code, pen_name")
    .order("farm_name")
    .order("building_name")
    .order("pen_name");
  if (error) throw error;
  return (data ?? []) as FarmLocation[];
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

export async function listMedications() {
  const { data, error } = await db
    .from(REGISTER_VIEW)
    .select("*")
    .order("medication_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MedicationRecord[];
}

export async function getMedicationById(id: number) {
  const [{ data: record, error: recordError }, { data: targets, error: targetError }] = await Promise.all([
    db.from(REGISTER_VIEW).select("*").eq("id", id).single(),
    db
      .from(TARGET_TABLE)
      .select("building_id, building_code, building_name, pen_id, pen_code, pen_name")
      .eq("medication_id", id)
      .order("line_no"),
  ]);
  if (recordError) throw recordError;
  if (targetError) throw targetError;
  return { ...record, targets: targets ?? [] } as MedicationEditRecord;
}

export async function createMedication(input: MedicationInput) {
  await validateMedicationType(input.medication_type);
  const userId = await currentUserId();
  if (input.scope === "Selected Pens" && input.targets.length === 0) {
    throw new Error("Select at least one pen.");
  }
  if (input.scope === "All Pens" && input.targets.length === 0) {
    throw new Error("The selected building has no pens.");
  }

  const { targets, ...header } = input;
  const { data, error } = await db
    .from(TABLE)
    .insert({ ...header, document_no: documentNo(), created_by: userId, status: "Posted" })
    .select("*")
    .single();
  if (error) throw error;

  if (targets.length) {
    const { error: targetError } = await db.from(TARGET_TABLE).insert(
      targets.map((target, index) => ({
        medication_id: data.id,
        line_no: index + 1,
        created_by: userId,
        ...target,
      })),
    );
    if (targetError) {
      // Header deletion is allowed only here, before the caller sees success.
      await db.from(TABLE).delete().eq("id", data.id);
      throw targetError;
    }
  }
  return data as MedicationRecord;
}

export async function updateMedication(id: number, input: MedicationInput) {
  await validateMedicationType(input.medication_type);
  const userId = await currentUserId();
  if (input.scope === "Selected Pens" && input.targets.length === 0) {
    throw new Error("Select at least one pen.");
  }
  if (input.scope === "All Pens" && input.targets.length === 0) {
    throw new Error("The selected building has no pens.");
  }

  const { targets, ...header } = input;
  const { data, error } = await db
    .from(TABLE)
    .update({ ...header, updated_by: userId })
    .eq("id", id)
    .eq("status", "Posted")
    .select("*")
    .single();
  if (error) throw error;

  const { error: deleteError } = await db.from(TARGET_TABLE).delete().eq("medication_id", id);
  if (deleteError) throw deleteError;

  if (targets.length) {
    const { error: targetError } = await db.from(TARGET_TABLE).insert(
      targets.map((target, index) => ({
        medication_id: id,
        line_no: index + 1,
        created_by: userId,
        ...target,
      })),
    );
    if (targetError) throw targetError;
  }
  return data as MedicationRecord;
}

export async function cancelMedication(id: number, reason: string) {
  const userId = await currentUserId();
  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new Error("Cancellation reason is required.");
  const { data, error } = await db
    .from(TABLE)
    .update({
      status: "Cancelled",
      cancelled_by: userId,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: normalizedReason,
      updated_by: userId,
    })
    .eq("id", id)
    .eq("status", "Posted")
    .select("*")
    .single();
  if (error) throw error;
  return data as MedicationRecord;
}
