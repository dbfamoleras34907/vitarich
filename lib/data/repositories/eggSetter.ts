import { db } from "@/lib/Supabase/supabaseClient";

export type SetterRefHistory = {
  ref_no: string | null;
  qty_set_egg: number | null;
};

/** Existing Egg Setter history query, optionally limited to exact references. */
export async function listSetterReferenceHistory(
  references?: readonly string[],
): Promise<SetterRefHistory[]> {
  const refs = references && [...new Set(references.map((ref) => ref.trim()).filter(Boolean))];
  if (refs && !refs.length) return [];
  const rows: SetterRefHistory[] = [];
  // Supabase caps responses; read every setter row so large totals are not truncated.
  for (let offset = 0; ; offset += 1000) {
    let query = db.from("setter_incubation_process")
      .select("ref_no, qty_set_egg")
      .not("ref_no", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (refs) query = query.in("ref_no", refs);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as SetterRefHistory[]));
    if ((data?.length ?? 0) < 1000) return rows;
  }
}

export async function getSetterEggTotals(references: readonly string[]) {
  const totals = new Map<string, number>();
  const refs = [...new Set(references.map((ref) => ref.trim()).filter(Boolean))];
  // Bound URL size for the classification register.
  for (let index = 0; index < refs.length; index += 100) {
    const rows = await listSetterReferenceHistory(refs.slice(index, index + 100));
    for (const row of rows) {
      const ref = row.ref_no?.trim() ?? "";
      const quantity = Number(row.qty_set_egg ?? 0);
      totals.set(ref, (totals.get(ref) ?? 0) + (Number.isFinite(quantity) ? quantity : 0));
    }
  }
  return totals;
}
