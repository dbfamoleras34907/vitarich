import { db } from "@/lib/Supabase/supabaseClient";

export type BrDeliverySettings = {
  id?: number;
  farm_id: number;
  farm_code?: string | null;
  farm_name?: string | null;
  batch_auto_selection: boolean;
  target_delivery_age: number;
  void?: string;
  created_at?: string;
  updated_at?: string | null;
};

export async function getBrDeliverySettings(farmId: number) {
  if (!Number.isFinite(farmId) || farmId <= 0) return null;

  const { data, error } = await db
    .from("brd_dr_settings")
    .select("*")
    .eq("void", "1")
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as BrDeliverySettings | null;
}

export async function saveBrDeliverySettings(payload: BrDeliverySettings) {
  const farmId = Number(payload.farm_id);
  if (!Number.isFinite(farmId) || farmId <= 0) {
    throw new Error("Please select a farm.");
  }
  const targetDeliveryAge = Number(payload.target_delivery_age);
  if (!Number.isInteger(targetDeliveryAge) || targetDeliveryAge < 0) {
    throw new Error("Target Delivery Age must be a whole number of days, zero or greater.");
  }

  const { data: authData } = await db.auth.getUser();
  const existingSettings = await getBrDeliverySettings(farmId);

  const row = {
    farm_id: farmId,
    farm_code: payload.farm_code || null,
    farm_name: payload.farm_name || null,
    batch_auto_selection: payload.batch_auto_selection,
    target_delivery_age: targetDeliveryAge,
    updated_by: authData.user?.id || null,
    updated_at: new Date().toISOString(),
  };

  const result = existingSettings?.id
    ? await db
      .from("brd_dr_settings")
      .update(row)
      .eq("id", existingSettings.id)
      .select()
      .single()
    : await db
      .from("brd_dr_settings")
      .insert({
        ...row,
        created_by: authData.user?.id || null,
        void: "1",
      })
      .select()
      .single();

  if (result.error) throw result.error;
  return result.data as BrDeliverySettings;
}
