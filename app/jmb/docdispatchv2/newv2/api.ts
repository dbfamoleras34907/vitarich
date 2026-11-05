import { db } from "@/lib/Supabase/supabaseClient";

export type SkuClassification = "SALEABLE" | "BY_PRODUCT" | "DISPOSAL";
export type UomType = "PCS" | "TRAY" | "BOX" | "CRATE";

export type DispatchDoc = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;

  doc_date: string; // YYYY-MM-DD
  dr_no: string;

  farm_name: string;
  destination_farm_id: number | null;
  destination_farm_code: string | null;
  address: string | null;
  hauler_name: string | null;
  hauler_plate_no: string | null;
  truck_seal_no: string | null;

  chick_van_temp_c: number | null;
  number_of_fans: number | null;

  remarks: string | null;
  is_active: boolean;
  status: "Draft" | "Posted";
  posted_at: string | null;
  posted_by: string | null;
  posting_version: number;
};

export type DispatchDocItem = {
  id: number;
  created_by: string | null;
  updated_by: string | null;
  dispatch_doc_id: number;
  doc_batch_code: string;
  sku_name: string;
  classification: SkuClassification | null;
  uom: UomType | null;
  qty: number;
  created_at: string;
  updated_at: string | null;
};

export type DispatchDocItemInsert = {
  doc_batch_code: string;
  sku_name: string;
  classification: SkuClassification | null;
  uom: UomType | null;
  qty: number;
};

export type DispatchDocUpsertPayload = {
  doc_date: string;
  dr_no: string;
  farm_name: string;
  destination_farm_code: string;
  address: string | null;
  hauler_name: string | null;
  hauler_plate_no: string | null;
  truck_seal_no: string | null;
  chick_van_temp_c: number | null;
  number_of_fans: number | null;
  remarks: string | null;
  items: DispatchDocItemInsert[];
};

export type DispatchDocAvailability = Omit<DispatchDocItemInsert, "qty"> & {
  key: string;
  source_qty: number;
  dispatched_qty: number;
  available_qty: number;
};

async function getRequiredAccessToken() {
  const {
    data: { session },
    error,
  } = await db.auth.getSession();

  if (error || !session?.access_token) {
    throw error ?? new Error("No authenticated session.");
  }

  return session.access_token;
}

async function requestDocDispatchWrite<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
): Promise<T> {
  const token = await getRequiredAccessToken();
  const res = await fetch("/jmb/docdispatchv2/newv2/api", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.error ?? "DOC Dispatch request failed.");
  }

  return json as T;
}

export type DispatchDocListRow = Partial<DispatchDoc> & {
  hatchery_farm_id: number | null;
  hatchery_farm_ids: number[];
};

export async function listDispatchDocs(): Promise<DispatchDocListRow[]> {
  const { data, error } = await db
    .from("dispatch_doc")
    .select(
      "id, doc_date, dr_no, farm_name, destination_farm_id, destination_farm_code, hauler_name, hauler_plate_no, truck_seal_no, chick_van_temp_c, number_of_fans, remarks, is_active, status, posted_at, posting_version, created_at, created_by",
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const headers = (data ?? []) as Partial<DispatchDoc>[];
  const documentIds = headers.flatMap((row) => Number.isInteger(Number(row.id)) ? [Number(row.id)] : []);
  if (!documentIds.length) return [];

  const { data: itemRows, error: itemError } = await db
    .from("dispatch_doc_item")
    .select("dispatch_doc_id, doc_batch_code")
    .in("dispatch_doc_id", documentIds);
  if (itemError) throw itemError;

  const batchCodes = Array.from(new Set(
    (itemRows ?? []).map((row) => String(row.doc_batch_code ?? "").trim()).filter(Boolean),
  ));
  const { data: gradingRows, error: gradingError } = batchCodes.length
    ? await db.from("chick_grading_process").select("batch_code, farm_id").in("batch_code", batchCodes)
    : { data: [], error: null };
  if (gradingError) throw gradingError;

  const farmIdByBatch = new Map(
    (gradingRows ?? []).map((row) => [String(row.batch_code ?? "").trim(), Number(row.farm_id) || null]),
  );
  const farmIdsByDocument = new Map<number, Set<number>>();
  for (const row of itemRows ?? []) {
    const farmId = farmIdByBatch.get(String(row.doc_batch_code ?? "").trim());
    if (!farmId) continue;
    const documentId = Number(row.dispatch_doc_id);
    const farmIds = farmIdsByDocument.get(documentId) ?? new Set<number>();
    farmIds.add(farmId);
    farmIdsByDocument.set(documentId, farmIds);
  }

  return headers.map((row) => {
    const farmIds = farmIdsByDocument.get(Number(row.id)) ?? new Set<number>();
    const hatcheryFarmIds = [...farmIds].sort((left, right) => left - right);
    return { ...row, hatchery_farm_id: hatcheryFarmIds.length === 1 ? hatcheryFarmIds[0] : null, hatchery_farm_ids: hatcheryFarmIds };
  });
}

export async function getDispatchDocById(id: number) {
  const { data: header, error: hErr } = await db
    .from("dispatch_doc")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (hErr) throw hErr;
  if (!header) return null;

  const { data: items, error: iErr } = await db
    .from("dispatch_doc_item")
    .select("*")
    .eq("dispatch_doc_id", id)
    .order("id", { ascending: true });

  if (iErr) throw iErr;

  return {
    header: header as DispatchDoc,
    items: (items ?? []) as DispatchDocItem[],
  };
}

export async function createDispatchDoc(
  payload: DispatchDocUpsertPayload,
  post = false,
) {
  const { id } = await requestDocDispatchWrite<{ id: number }>(
    "POST",
    { payload, post },
  );

  return id;
}

export async function updateDispatchDoc(
  id: number,
  payload: DispatchDocUpsertPayload,
  post = false,
) {
  await requestDocDispatchWrite("PUT", { id, payload, post });
}

export async function postDispatchDoc(id: number) {
  await requestDocDispatchWrite("PATCH", { id });
}

export async function softDeleteDispatchDoc(id: number) {
  await requestDocDispatchWrite("DELETE", { id });
}

/**
 * Optional helpers for dropdowns (no master tables given).
 * These will pull distinct values from existing saved docs.
 */
export async function listDistinctHaulers() {
  const { data, error } = await db
    .from("dispatch_doc")
    .select("hauler_name")
    .not("hauler_name", "is", null)
    .eq("is_active", true)
    .limit(1000);

  if (error) throw error;
  const set = new Set<string>();
  (data ?? []).forEach((r: Pick<DispatchDoc, "hauler_name">) => {
    if (r?.hauler_name) set.add(String(r.hauler_name));
  });
  return Array.from(set).sort();
}

export async function listDistinctPlates() {
  const { data, error } = await db
    .from("dispatch_doc")
    .select("hauler_plate_no")
    .not("hauler_plate_no", "is", null)
    .eq("is_active", true)
    .limit(1000);

  if (error) throw error;
  const set = new Set<string>();
  (data ?? []).forEach((r: Pick<DispatchDoc, "hauler_plate_no">) => {
    if (r?.hauler_plate_no) set.add(String(r.hauler_plate_no));
  });
  return Array.from(set).sort();
}

// ✅ DR generator via RPC
export async function generateNextDrNo(doc_date_ymd: string): Promise<string> {
  // doc_date_ymd: "YYYY-MM-DD"
  const { data, error } = await db.rpc("next_dr_no", { p_date: doc_date_ymd });
  if (error) throw error;
  return data as string;
}

// ✅ DOC Batch Code dropdown source
const REFERENCE_PAGE_SIZE = 500;

const DOC_SKU_SOURCES: Array<{
  sku_name: string;
  classification: SkuClassification;
  field: string;
}> = [
  { sku_name: "Class A", classification: "SALEABLE", field: "class_a" },
  { sku_name: "Class A Junior", classification: "BY_PRODUCT", field: "class_a_junior" },
  { sku_name: "Class B", classification: "BY_PRODUCT", field: "class_b" },
  { sku_name: "Class C", classification: "BY_PRODUCT", field: "class_c" },
  { sku_name: "Infertile", classification: "BY_PRODUCT", field: "infertile" },
  { sku_name: "Live PIP", classification: "BY_PRODUCT", field: "live_pip" },
  { sku_name: "Dead Chick", classification: "BY_PRODUCT", field: "dead_chicks" },
  { sku_name: "Dead Germ", classification: "BY_PRODUCT", field: "dead_germ" },
];

type GradingRow = { batch_code: string } & Record<string, number | string | null>;

async function listAllGradingRows() {
  const rows: GradingRow[] = [];
  for (let from = 0; ; from += REFERENCE_PAGE_SIZE) {
    const { data, error } = await db
      .from("chick_grading_process")
      .select("batch_code, class_a, class_a_junior, class_b, class_c, infertile, live_pip, dead_chicks, dead_germ")
      .order("batch_code", { ascending: false })
      .range(from, from + REFERENCE_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as GradingRow[];
    rows.push(...page);
    if (page.length < REFERENCE_PAGE_SIZE) return rows;
  }
}

async function listAllPostedDispatchItems() {
  const rows: Array<{ doc_batch_code: string; sku_name: string; qty: number | null }> = [];
  for (let from = 0; ; from += REFERENCE_PAGE_SIZE) {
    const { data, error } = await db
      .from("dispatch_doc_item")
      .select("doc_batch_code, sku_name, qty, dispatch_doc!inner(status, is_active)")
      .eq("dispatch_doc.status", "Posted")
      .eq("dispatch_doc.is_active", true)
      .range(from, from + REFERENCE_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as Array<{ doc_batch_code: string; sku_name: string; qty: number | null }>;
    rows.push(...page);
    if (page.length < REFERENCE_PAGE_SIZE) return rows;
  }
}

/**
 * Read-only availability for the dispatch grid. Final availability is always
 * revalidated by the authoritative server transaction before posting.
 */
export async function listAvailableDispatchDocItems(): Promise<DispatchDocAvailability[]> {
  const [gradingRows, postedItems] = await Promise.all([
    listAllGradingRows(),
    listAllPostedDispatchItems(),
  ]);
  const dispatchedByKey = new Map<string, number>();
  for (const item of postedItems) {
    const key = `${String(item.doc_batch_code).trim()}::${String(item.sku_name).trim()}`;
    dispatchedByKey.set(key, (dispatchedByKey.get(key) ?? 0) + Number(item.qty ?? 0));
  }

  return gradingRows.flatMap((row) => DOC_SKU_SOURCES.flatMap((sku) => {
    const source_qty = Math.max(0, Number(row[sku.field] ?? 0));
    if (!row.batch_code?.trim() || source_qty <= 0) return [];
    const key = `${row.batch_code.trim()}::${sku.sku_name}`;
    const dispatched_qty = Math.max(0, dispatchedByKey.get(key) ?? 0);
    return [{
      key,
      doc_batch_code: row.batch_code.trim(),
      sku_name: sku.sku_name,
      classification: sku.classification,
      uom: "PCS" as UomType,
      source_qty,
      dispatched_qty,
      available_qty: Math.max(0, source_qty - dispatched_qty),
    }];
  }));
}
