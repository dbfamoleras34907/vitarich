import { db } from "@/lib/Supabase/supabaseClient";
import type { EggLaying } from "../repositories/breederEggLaying";

export type BreederEggLayingMutation = Pick<
  EggLaying,
  | "placement_id"
  | "date_laying"
  | "farm_id"
  | "farm_name"
  | "building"
  | "building_id"
  | "age"
  | "tep_collection"
  | "hatching_egg"
  | "classb"
  | "table_egg_dirty"
  | "table_egg_misshapen"
  | "table_egg_off_size"
  | "table_egg_thin_shell"
  | "crack"
  | "junior"
  | "jumbo"
  | "condemn"
> & { id?: number };

function requireRows(data: unknown): EggLaying[] {
  if (!Array.isArray(data) || !data.length) {
    throw new Error("Egg Laying was not saved.");
  }
  return data as EggLaying[];
}

/**
 * The deployed RPC validates farm scope, duplicate dates, TEP totals, and
 * posted dispatch allocations in the same transaction as the save.
 */
export async function saveBreederEggLayings(rows: BreederEggLayingMutation[]) {
  const { data, error } = await db.rpc("save_breeder_egg_layings", {
    p_rows: rows,
  });
  if (error) throw error;
  return requireRows(data);
}

/** Voids an active source record only when no Posted dispatch line uses it. */
export async function voidBreederEggLaying(id: number, reason: string) {
  const { data, error } = await db.rpc("void_breeder_egg_laying", {
    p_id: id,
    p_reason: reason,
  });
  if (error) throw error;
  return data as EggLaying;
}
