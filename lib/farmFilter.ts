import { db } from "@/lib/Supabase/supabaseClient";
import type { FilterRule } from "@/components/ui/DataTableV2";
import { getProcessListAttributions, type ProcessListAttribution, type ProcessListAttributionSource } from "@/lib/data/repositories/processListAttribution";

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

/** Add current creator and TA display values for records whose farm comes from hatch classification references. */
export async function attachProcessListAttributionsFromRefs<T extends ProcessListAttributionSource & Record<string, unknown>>(
  rows: T[],
  getRefValue: (row: T) => unknown,
): Promise<Array<T & ProcessListAttribution & { farm_ids: number[]; [FARM_FILTER_KEY]: string }>> {
  const rowRefs = rows.map((row) => extractLifecycleRefs(getRefValue(row)));
  const uniqueRefs = Array.from(new Set(rowRefs.flat().map(ref => ref.toUpperCase())));
  const farmIdsByRef = new Map<string, number[]>();

  for (let offset = 0; offset < uniqueRefs.length; offset += 100) {
    const refs = uniqueRefs.slice(offset, offset + 100);
    const { data, error } = await db
      .from("hatch_classification")
      .select("classi_ref_no, farm_id")
      .in("classi_ref_no", refs);

    if (error) throw error;
    for (const row of (data ?? []) as Array<{ classi_ref_no: string | null; farm_id: number | null }>) {
      const ref = String(row.classi_ref_no ?? "").trim().toUpperCase();
      const farmId = Number(row.farm_id);
      if (!ref || !Number.isSafeInteger(farmId) || farmId <= 0) continue;
      const current = farmIdsByRef.get(ref) ?? [];
      if (!current.includes(farmId)) current.push(farmId);
      farmIdsByRef.set(ref, current);
    }
  }

  const rowsWithFarmIds = rows.map((row, index) => {
    const orderedFarmIds = rowRefs[index].flatMap(ref => farmIdsByRef.get(ref.toUpperCase()) ?? []);
    return {
      ...row,
      farm_ids: [...new Set(orderedFarmIds)],
      [FARM_FILTER_KEY]: String(orderedFarmIds[0] ?? ''),
    };
  });
  const attributions = await getProcessListAttributions(rowsWithFarmIds);
  return rowsWithFarmIds.map(row => ({
    ...row,
    ...(attributions.get(`${[...row.farm_ids].sort((left, right) => left - right).join(',')}:${String(row.created_by ?? '').trim()}`) ?? {
      createdByName: '—',
      assignedTaNames: [],
      assignedTaLabel: 'Farm unavailable',
    }),
  }));
}
