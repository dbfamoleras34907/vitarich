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

export type TransferClassiRefOption = {
  ref_no: string;
  farm_source: string | null;
  total_hatching_egg: number;
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

export async function listSetterInventoryRefs(): Promise<TransferClassiRefOption[]> {
  const { data, error } = await db
    .from(SETTER_TABLE)
    .select("ref_no, farm_source, qty_set_egg")
    .order("id", { ascending: false });

  if (error) throw error;

  const inventoryMap = new Map<string, TransferClassiRefOption>();

  for (const row of (data ?? []) as SetterInventoryRow[]) {
    const qtySetEgg = Number(row.qty_set_egg ?? 0);

    for (const ref of parseRefNumbers(row.ref_no)) {
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

  return Array.from(inventoryMap.values()).sort((a, b) =>
    b.ref_no.localeCompare(a.ref_no),
  );
}

export async function listTransferHistory(): Promise<TransferHistoryRow[]> {
  const { data, error } = await db
    .from(TABLE)
    .select("id, ref_no, total_egg_transfer")
    .order("id", { ascending: false });

  if (error) throw error;

  return (data ?? []) as TransferHistoryRow[];
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
