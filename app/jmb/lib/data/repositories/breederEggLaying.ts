import { db } from "@/lib/Supabase/supabaseClient";

export type EggLaying = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  placement_id: number | null;
  date_laying: string;
  farm_id: number | null;
  farm_name: string | null;
  building: string | null;
  age: number | null;
  tep_collection: number | null;
  hatching_egg: number | null;
  classb: number | null;
  table_egg_dirty: number | null;
  table_egg_misshapen: number | null;
  table_egg_off_size: number | null;
  table_egg_thin_shell: number | null;
  crack: number | null;
  junior: number | null;
  jumbo: number | null;
  condemn: number | null;
  is_active: boolean;
  building_id: number | null;
};

export type BreederEggLayingFilter = {
  placementIds?: number[];
  farmId?: number;
  /** Legacy history lookup only; dashboard filtering always uses numeric farm IDs. */
  farmName?: string;
  from?: string;
  to?: string;
  ascending?: boolean;
};

/** Shared, RLS-preserving, paginated read for Egg Laying and breeder reporting. */
export async function listBreederEggLayings(filter: BreederEggLayingFilter = {}): Promise<EggLaying[]> {
  const ids = filter.placementIds == null ? null : [...new Set(filter.placementIds.filter(id => Number.isInteger(id) && id > 0))];
  if (ids?.length === 0) return [];
  const chunks = ids == null ? [null] : Array.from({ length: Math.ceil(ids.length / 300) }, (_, index) => ids.slice(index * 300, index * 300 + 300));
  const rows: EggLaying[] = [];
  const ascending = filter.ascending ?? false;
  for (const chunk of chunks) {
    for (let page = 0; ; page++) {
      let query = db.from("tbl_egglaying").select("*").eq("is_active", true)
        .order("date_laying", { ascending }).order("id", { ascending })
        .range(page * 1000, page * 1000 + 999);
      if (chunk) query = query.in("placement_id", chunk);
      if (filter.farmId) query = query.eq("farm_id", filter.farmId);
      else if (filter.farmName) query = query.eq("farm_name", filter.farmName);
      if (filter.from) query = query.gte("date_laying", filter.from);
      if (filter.to) query = query.lte("date_laying", filter.to);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data ?? []) as EggLaying[]);
      if ((data?.length ?? 0) < 1000) break;
    }
  }
  return rows.sort((a, b) => (a.date_laying.localeCompare(b.date_laying) || a.id - b.id) * (ascending ? 1 : -1));
}
