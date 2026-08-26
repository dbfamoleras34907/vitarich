import { db } from "@/lib/Supabase/supabaseClient";
import type { Placement } from "../new/api";

const TABLE = "tbl_breeder_daily_performance";

export type FeedType = {
  id: number;
  description: string | null;
  uom: string | null;
};

export type BreederDailyPerformance = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  placement_id: number;
  daterec: string;
  inv_male: number;
  inv_female: number;
  mc_male: number;
  mc_female: number;
  cull_male: number;
  cull_female: number;
  trans_in_male: number;
  trans_in_female: number;
  trans_out_male: number;
  trans_out_female: number;
  kitchen_male: number;
  kitchen_female: number;
  condem_male: number;
  condem_female: number;
  avg_body_weight_male: number;
  avg_body_weight_female: number;
  feed_consumption_male: number;
  feed_consumption_female: number;
  male_feedtype_id: number | null;
  female_feedtype_id: number | null;
  isactive: boolean;
};

export type BreederDailyPerformancePayload = Omit<
  BreederDailyPerformance,
  "id" | "created_at" | "created_by" | "updated_at" | "updated_by"
>;

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Database request failed.");
  }
  return "Database request failed.";
}

async function accessToken() {
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error("Your session expired. Please log in again.");
  return data.session.access_token;
}

export async function getPlacement(placementId: number) {
  const { data, error } = await db
    .from("tbl_placement")
    .select("*")
    .eq("id", placementId)
    .single();
  if (error) throw new Error(errorMessage(error));

  const placement = data as Placement;
  if (!placement.cycle_id) return placement;

  const { data: cycle, error: cycleError } = await db
    .from("tbl_breeder_cycle")
    .select("cycle_no")
    .eq("id", placement.cycle_id)
    .maybeSingle();
  if (cycleError) throw new Error(errorMessage(cycleError));
  return {
    ...placement,
    cycle_no: cycle?.cycle_no == null ? null : Number(cycle.cycle_no),
  };
}

export async function listPlacementPens(placement: Placement) {
  let query = db
    .from("tbl_placement")
    .select("*")
    .eq("farm_id", placement.farm_id)
    .eq("building_id", placement.building_id)
    .eq("placement_date", placement.placement_date)
    .order("pen_no", { ascending: true })
    .order("id", { ascending: true });

  if (placement.dr_no?.trim()) query = query.eq("dr_no", placement.dr_no.trim());

  const { data, error } = await query;
  if (error) throw new Error(errorMessage(error));
  return (data ?? []) as Placement[];
}

export async function listFeedTypes() {
  const { data, error } = await db
    .from("tbl_feedtype")
    .select("id, description, uom")
    .eq("isactive", true)
    .order("description", { ascending: true });
  if (error) throw new Error(errorMessage(error));
  return (data ?? []) as FeedType[];
}

export async function listDailyPerformance(placementId: number) {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("placement_id", placementId)
    .eq("isactive", true)
    .order("daterec", { ascending: true });
  if (error) throw new Error(errorMessage(error));
  return (data ?? []) as BreederDailyPerformance[];
}

export async function saveDailyPerformance(payload: BreederDailyPerformancePayload) {
  const token = await accessToken();
  const response = await fetch("/api/jmb/breeder-daily-performance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ payload }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    data?: BreederDailyPerformance;
    error?: string;
  };
  if (!response.ok || !result.data) {
    throw new Error(result.error || "Unable to save breeder daily performance.");
  }
  return result.data;
}
