import { db } from "@/lib/Supabase/supabaseClient";

export type AutoFeedBatchSelectionMode = "USER_SELECTED" | "FIFO";

export type FlockCardSettings = {
  id?: number;
  farm_id: number;
  farm_code?: string | null;
  farm_name?: string | null;
  allow_advance_posting: boolean;
  auto_feed_batch_selection: boolean;
  auto_feed_batch_selection_mode: AutoFeedBatchSelectionMode;
  auto_mortality_rate_batch_selection: boolean;
  void?: string;
  created_at?: string;
  updated_at?: string | null;
};

export async function getFlockCardSettings(farmId: number) {
  if (!Number.isFinite(farmId) || farmId <= 0) return null;

  const { data, error } = await db
    .from("brd_fc_settings")
    .select("*")
    .eq("void", "1")
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as FlockCardSettings | null;
}

export async function saveFlockCardSettings(payload: FlockCardSettings) {
  const farmId = Number(payload.farm_id);
  if (!Number.isFinite(farmId) || farmId <= 0) {
    throw new Error("Please select a farm.");
  }

  const { data: authData } = await db.auth.getUser();
  const existingSettings = await getFlockCardSettings(farmId);

  const row = {
    farm_id: farmId,
    farm_code: payload.farm_code || null,
    farm_name: payload.farm_name || null,
    allow_advance_posting: payload.allow_advance_posting,
    auto_feed_batch_selection: payload.auto_feed_batch_selection,
    auto_feed_batch_selection_mode: payload.auto_feed_batch_selection_mode,
    auto_mortality_rate_batch_selection: payload.auto_mortality_rate_batch_selection,
    updated_by: authData.user?.id || null,
    updated_at: new Date().toISOString(),
  };

  const result = existingSettings?.id
    ? await db
      .from("brd_fc_settings")
      .update(row)
      .eq("id", existingSettings.id)
      .select()
      .single()
    : await db
      .from("brd_fc_settings")
      .insert({
        ...row,
        created_by: authData.user?.id || null,
        void: "1",
      })
      .select()
      .single();

  if (result.error) throw result.error;
  return result.data as FlockCardSettings;
}
