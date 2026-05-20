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
  address: string | null;
  hauler_name: string | null;
  hauler_plate_no: string | null;
  truck_seal_no: string | null;

  chick_van_temp_c: number | null;
  number_of_fans: number | null;

  remarks: string | null;
  is_active: boolean;
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
  address: string | null;
  hauler_name: string | null;
  hauler_plate_no: string | null;
  truck_seal_no: string | null;
  chick_van_temp_c: number | null;
  number_of_fans: number | null;
  remarks: string | null;
  items: DispatchDocItemInsert[];
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
  method: "POST" | "PUT" | "DELETE",
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

export async function listDispatchDocs() {
  const { data, error } = await db
    .from("dispatch_doc")
    .select(
      "id, doc_date, dr_no, farm_name, hauler_name, hauler_plate_no, truck_seal_no, chick_van_temp_c, number_of_fans, remarks, is_active, created_at",
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Partial<DispatchDoc>[];
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

export async function createDispatchDoc(payload: DispatchDocUpsertPayload) {
  const { id } = await requestDocDispatchWrite<{ id: number }>(
    "POST",
    payload,
  );

  return id;
}

export async function updateDispatchDoc(
  id: number,
  payload: DispatchDocUpsertPayload,
) {
  await requestDocDispatchWrite("PUT", { id, payload });
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
export async function listDocBatchCodes(): Promise<string[]> {
  const { data, error } = await db
    .from("chick_grading_process")
    .select("batch_code")
    .order("batch_code", { ascending: false });

  if (error) throw error;

  const set = new Set<string>();
  for (const r of data ?? []) {
    if (r?.batch_code) set.add(r.batch_code);
  }
  return Array.from(set);
}

export type ChickGradingQtyRow = {
  batch_code: string;
  class_a: number | null;
  class_b: number | null;
  class_a_junior: number | null;
  class_c: number | null;
  cull_chicks: number | null;
  dead_chicks: number | null;
  infertile: number | null;
  dead_germ: number | null;
  live_pip: number | null;
  dead_pip: number | null;
  unhatched: number | null;
  rotten: number | null;
  exploder: number | null;
  unhatched_good: number | null;
  unhatched_bad: number | null;
  infertile_good: number | null;
  infertile_bad: number | null;
};

export async function getChickGradingQtyByBatchCode(batch_code: string) {
  const { data, error } = await db
    .from("chick_grading_process")
    .select(
      `
      batch_code,
      class_a, class_b, class_a_junior, class_c,
      cull_chicks, dead_chicks, infertile, dead_germ,
      live_pip, dead_pip, unhatched, rotten , exploder, unhatched_good ,unhatched_bad, infertile_good, infertile_bad

    `,
    )
    .eq("batch_code", batch_code)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ChickGradingQtyRow | null;
}
export type BoilerFarmOption = {
  boiler_name: string;
  address: string | null;
};

export async function listBoilerFarmOptions(): Promise<BoilerFarmOption[]> {
  const { data, error } = await db
    .from("boiler_masterdata")
    .select("boiler_name, address")
    .eq("is_active", true)
    .order("boiler_name", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as BoilerFarmOption[]).map((row) => ({
    boiler_name: row.boiler_name ?? "",
    address: row.address ?? "",
  }));
}
