import { db } from "@/lib/Supabase/supabaseClient";

export type SetterRefHistory = {
  ref_no: string | null;
  qty_set_egg: number | null;
};

export type EggSetterReferenceOption = {
  classi_ref_no: string;
  good_egg: number | null;
  breeder_ref_no: string;
  dr_no: string;
  document_date_post: string;
};

type SetterRefNoViewRow = {
  egg_ref_no: string | null;
};

type HatchClassificationReferenceRow = {
  classi_ref_no: string | null;
  good_egg: number | null;
  br_no: string | null;
};

type ReceivingItemReferenceRow = {
  docentry: number | null;
  brdr_ref_no: string | null;
};

type ReceivingHeaderReferenceRow = {
  id: number;
  dr_num: string | null;
  doc_date: string | null;
};

/**
 * Lists the Egg Setter-eligible references with the receipt identifiers used
 * by Hatchery users to distinguish similarly named classifications.
 */
export async function listEggSetterReferenceOptions(
  includeRefs: string[] = [],
): Promise<EggSetterReferenceOption[]> {
  const { data, error } = await db
    .from("view_setter_ref_no")
    .select("egg_ref_no")
    .not("egg_ref_no", "is", null)
    .order("egg_ref_no", { ascending: true });

  if (error) throw error;

  const refs = Array.from(
    new Set([
      ...((data ?? []) as SetterRefNoViewRow[])
        .map((row) => String(row.egg_ref_no ?? "").trim())
        .filter(Boolean),
      ...includeRefs.map((ref) => ref.trim()).filter(Boolean),
    ]),
  );

  if (!refs.length) return [];

  const { data: hatchRows, error: hatchError } = await db
    .from("hatch_classification")
    .select("classi_ref_no, good_egg, br_no")
    .in("classi_ref_no", refs);

  if (hatchError) throw hatchError;

  const classifications = (hatchRows ?? []) as HatchClassificationReferenceRow[];
  const classificationByRef = new Map(
    classifications
      .filter((row) => row.classi_ref_no)
      .map((row) => [String(row.classi_ref_no), row]),
  );

  const breederRefs = Array.from(
    new Set(
      classifications
        .map((row) => String(row.br_no ?? "").trim())
        .filter(Boolean),
    ),
  );
  const receivingItems: ReceivingItemReferenceRow[] = [];
  for (let index = 0; index < breederRefs.length; index += 100) {
    const { data, error } = await db
      .from("recieving_items")
      .select("docentry, brdr_ref_no")
      .in("brdr_ref_no", breederRefs.slice(index, index + 100));
    if (error) throw error;
    receivingItems.push(...((data ?? []) as ReceivingItemReferenceRow[]));
  }

  const receivingDocumentIds = Array.from(
    new Set(
      receivingItems
        .map((row) => Number(row.docentry))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
  const receivingHeaders: ReceivingHeaderReferenceRow[] = [];
  for (let index = 0; index < receivingDocumentIds.length; index += 100) {
    const { data, error } = await db
      .from("recieving")
      .select("id, dr_num, doc_date")
      .in("id", receivingDocumentIds.slice(index, index + 100));
    if (error) throw error;
    receivingHeaders.push(...((data ?? []) as ReceivingHeaderReferenceRow[]));
  }

  const headersById = new Map(receivingHeaders.map((row) => [row.id, row]));
  const receiptByBreederRef = new Map<string, ReceivingHeaderReferenceRow>();
  for (const item of receivingItems) {
    const breederRef = String(item.brdr_ref_no ?? "").trim();
    const header = headersById.get(Number(item.docentry));
    if (!breederRef || !header) continue;

    const existing = receiptByBreederRef.get(breederRef);
    if (!existing || String(header.doc_date ?? "") > String(existing.doc_date ?? "")) {
      receiptByBreederRef.set(breederRef, header);
    }
  }

  return refs.map((ref) => {
    const classification = classificationByRef.get(ref);
    const breederRef = String(classification?.br_no ?? "").trim();
    const receipt = receiptByBreederRef.get(breederRef);

    return {
      classi_ref_no: ref,
      good_egg: classification?.good_egg ?? null,
      breeder_ref_no: breederRef,
      dr_no: receipt?.dr_num ?? "",
      document_date_post: receipt?.doc_date ?? "",
    };
  });
}

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
