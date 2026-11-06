import { db } from "@/lib/Supabase/supabaseClient";

export type EggTransferProcess = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  ref_no: string | null;
  farm_source: string | null;
  trans_date_start: string | null;
  trans_date_end: string | null;
  duration: number | null;
  num_bangers: number | null;
  total_egg_transfer: number | null;
};

export type EggTransferInsert = {
  ref_no: string | null;
  farm_source: string | null;
  trans_date_start: string | null;
  trans_date_end: string | null;
  duration: number | null;
  num_bangers: number | null;
  total_egg_transfer: number | null;
};

export type EggTransferUpdate = Partial<EggTransferInsert>;

const TABLE = "egg_transfer_process";
const SETTER_TABLE = "setter_incubation_process";
const LOOKUP_PAGE_SIZE = 500;

export type TransferClassiRefOption = {
  ref_no: string;
  farm_source: string | null;
  total_hatching_egg: number;
};

type EggTransferRefNoViewRow = {
  ref_no: string | null;
};

type SetterInventoryRow = {
  ref_no: string | null;
  farm_source: string | null;
  qty_set_egg: number | null;
};

type TransferHistoryRow = {
  id: number;
  ref_no: string | null;
  total_egg_transfer: number | null;
};

function parseRefNumbers(value: string | null | undefined) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function listSetterInventoryRefs(
  includeRefs: string[] = [],
): Promise<
  TransferClassiRefOption[]
> {
  const refRows: EggTransferRefNoViewRow[] = [];
  // PostgREST caps un-ranged responses. Read every eligible reference so
  // older alphabetical references remain selectable.
  for (let from = 0; ; from += LOOKUP_PAGE_SIZE) {
    const { data, error } = await db
      .from("view_eggtransfer_ref_no")
      .select("ref_no")
      .not("ref_no", "is", null)
      .order("ref_no", { ascending: true })
      .range(from, from + LOOKUP_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as EggTransferRefNoViewRow[];
    refRows.push(...page);
    if (page.length < LOOKUP_PAGE_SIZE) break;
  }

  const refs = Array.from(
    new Set([
      ...refRows
        .map((row) => String(row.ref_no ?? "").trim())
        .filter(Boolean),
      ...includeRefs.map((ref) => ref.trim()).filter(Boolean),
    ]),
  );

  if (!refs.length) return [];

  const allowedRefs = new Set(refs);

  const setterRows: SetterInventoryRow[] = [];
  for (let from = 0; ; from += LOOKUP_PAGE_SIZE) {
    const { data, error } = await db
      .from(SETTER_TABLE)
      .select("ref_no, farm_source, qty_set_egg")
      .order("id", { ascending: false })
      .range(from, from + LOOKUP_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as SetterInventoryRow[];
    setterRows.push(...page);
    if (page.length < LOOKUP_PAGE_SIZE) break;
  }

  const inventoryMap = new Map<string, TransferClassiRefOption>();

  for (const row of setterRows) {
    const qtySetEgg = Number(row.qty_set_egg ?? 0);

    for (const ref of parseRefNumbers(row.ref_no)) {
      if (!allowedRefs.has(ref)) continue;

      const current = inventoryMap.get(ref);

      inventoryMap.set(ref, {
        ref_no: ref,
        farm_source: current?.farm_source ?? row.farm_source ?? "",
        total_hatching_egg:
          (current?.total_hatching_egg ?? 0) +
          (Number.isFinite(qtySetEgg) ? qtySetEgg : 0),
      });
    }
  }

  return refs.map(
    (ref) =>
      inventoryMap.get(ref) ?? {
        ref_no: ref,
        farm_source: "",
        total_hatching_egg: 0,
      },
  );
}

export async function listTransferHistory(): Promise<TransferHistoryRow[]> {
  const rows: TransferHistoryRow[] = [];
  for (let from = 0; ; from += LOOKUP_PAGE_SIZE) {
    const { data, error } = await db
      .from(TABLE)
      .select("id, ref_no, total_egg_transfer")
      .order("id", { ascending: false })
      .range(from, from + LOOKUP_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as TransferHistoryRow[];
    rows.push(...page);
    if (page.length < LOOKUP_PAGE_SIZE) return rows;
  }
}

export async function listEggTransfers(): Promise<EggTransferProcess[]> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as EggTransferProcess[];
}

export async function getEggTransferById(
  id: number,
): Promise<EggTransferProcess> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as EggTransferProcess;
}

export async function createEggTransfer(payload: EggTransferInsert) {
  const { error } = await db.from(TABLE).insert(payload);
  if (error) throw error;
}

export async function createEggTransferBatch(payload: EggTransferInsert[]) {
  const { error } = await db.from(TABLE).insert(payload);
  if (error) throw error;
}

export async function updateEggTransfer(
  id: number,
  payload: EggTransferUpdate,
) {
  const { error } = await db.from(TABLE).update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteEggTransfer(id: number) {
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
