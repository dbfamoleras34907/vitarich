import { db } from "@/lib/Supabase/supabaseClient";
import type { FilterRule } from "@/components/ui/DataTableV2";

export const FARM_FILTER_KEY = "farm_id_filter";

type FarmSourceRow = {
  classi_ref_no: string | null;
  farm_code?: string | null;
  farm_id?: number | null;
};

type RowWithFarmFilter<T> = T & {
  [FARM_FILTER_KEY]?: string;
};

export function buildDefaultFarmInitialFilters(
  defaultFarmId: unknown,
): FilterRule[] {
  if (defaultFarmId === null || defaultFarmId === undefined || defaultFarmId === "") {
    return [];
  }

  return [
    {
      id: FARM_FILTER_KEY,
      columnKey: FARM_FILTER_KEY,
      operator: "equals",
      value: String(defaultFarmId),
      joiner: "and",
    },
  ];
}

export function extractLifecycleRefs(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return [];

  const refs = new Set<string>();
  const fullClassiRefs = text.match(/\S*CL\d+/gi) ?? [];
  const classiRefs = text.match(/CL\d+/gi) ?? [];

  fullClassiRefs.forEach((ref) => refs.add(ref));
  classiRefs.forEach((ref) => refs.add(ref));
  text
    .split(/[,\s|/]+/)
    .map((ref) => ref.trim())
    .filter(Boolean)
    .forEach((ref) => refs.add(ref.toUpperCase()));

  return Array.from(refs);
}

async function getFarmByClassificationRef(refs: string[]) {
  const uniqueRefs = Array.from(new Set(refs.filter(Boolean)));
  const map = new Map<string, string>();

  if (!uniqueRefs.length) return map;

  const { data, error } = await db
    .from("hatch_classification")
    .select("classi_ref_no, farm_code, farm_id")
    .in("classi_ref_no", uniqueRefs);

  if (error) {
    console.error("Failed to load farm filter map:", error);
    return map;
  }

  (data as FarmSourceRow[] | null)?.forEach((row) => {
    if (!row.classi_ref_no) return;

    const farmValue = row.farm_code ?? row.farm_id;
    if (farmValue === null || farmValue === undefined || farmValue === "") return;

    map.set(row.classi_ref_no.toUpperCase(), String(farmValue));
  });

  return map;
}

export async function attachFarmFilterFromRefs<T extends Record<string, unknown>>(
  rows: T[],
  getRefValue: (row: T) => unknown,
): Promise<Array<RowWithFarmFilter<T>>> {
  const rowRefs = rows.map((row) => extractLifecycleRefs(getRefValue(row)));
  const farmByRef = await getFarmByClassificationRef(rowRefs.flat());

  return rows.map((row, index) => {
    const farmId = rowRefs[index]
      .map((ref) => farmByRef.get(ref.toUpperCase()))
      .find(Boolean);

    return {
      ...row,
      [FARM_FILTER_KEY]: farmId ?? "",
    };
  });
}
