import { db } from "@/lib/Supabase/supabaseClient";

export type BrCleanupSettings = {
  id?: number;
  farm_id: number;
  farm_code?: string | null;
  farm_name?: string | null;
  batch_auto_selection: boolean;
  target_cleanup_age: number;
  void?: string;
  created_at?: string;
  updated_at?: string | null;
};

export async function getBrCleanupSettings(
  farmId: number,
  options: { usePreviousFarmDefaults?: boolean } = {},
) {
  if (!Number.isFinite(farmId) || farmId <= 0) return null;

  const { data, error } = await db
    .from("brd_cu_settings")
    .select("*")
    .eq("void", "1")
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data || !options.usePreviousFarmDefaults) {
    return data as BrCleanupSettings | null;
  }

  const { data: previous, error: previousError } = await db
    .from("brd_cu_settings")
    .select("*")
    .eq("void", "1")
    .lt("farm_id", farmId)
    .order("farm_id", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousError) throw previousError;
  if (!previous) return null;

  return {
    ...(previous as BrCleanupSettings),
    id: undefined,
    farm_id: farmId,
    farm_code: null,
    farm_name: null,
    created_at: undefined,
    updated_at: undefined,
  };
}

export async function saveBrCleanupSettings(payload: BrCleanupSettings) {
  const farmId = Number(payload.farm_id);
  if (!Number.isFinite(farmId) || farmId <= 0) throw new Error("Please select a farm.");

  const targetCleanupAge = Number(payload.target_cleanup_age);
  if (!Number.isInteger(targetCleanupAge) || targetCleanupAge < 0) {
    throw new Error("Target Clean-up Age must be a whole number of days, zero or greater.");
  }

  const { data: authData } = await db.auth.getUser();
  const existingSettings = await getBrCleanupSettings(farmId);
  const row = {
    farm_id: farmId,
    farm_code: payload.farm_code || null,
    farm_name: payload.farm_name || null,
    batch_auto_selection: payload.batch_auto_selection,
    target_cleanup_age: targetCleanupAge,
    updated_by: authData.user?.id || null,
    updated_at: new Date().toISOString(),
  };

  const result = existingSettings?.id
    ? await db.from("brd_cu_settings").update(row).eq("id", existingSettings.id).select().single()
    : await db.from("brd_cu_settings").insert({
        ...row,
        created_by: authData.user?.id || null,
        void: "1",
      }).select().single();

  if (result.error) throw result.error;
  return result.data as BrCleanupSettings;
}
