import { db } from "@/lib/Supabase/supabaseClient";
import { ReceivingListRow } from "@/lib/types";
import { HatchClassificationInsert } from "../updatefd/api";

export type HatchClassification = {
  created_at: string;
  daterec: string | null;
  br_no: string | null;
  good_egg: number | null;
  trans_crack: number | null;
  hatc_crack: number | null;
  trans_condemn: number | null;
  hatc_condemn: number | null;
  thin_shell: number | null;
  pee_wee: number | null;
  small: number | null;
  jumbo: number | null;
  d_yolk: number | null;
  ttl_count: number | null;
  is_active: boolean | null;
  classi_ref_no: string | null;
  date_classify: string | null;
  misshapen: number | null;
  leakers: number | null;
  dirties: number | null;
  farm_id: number | null;
  hairline: number | null;
  farm_name: string | null;
};

export type HatchClassificationRow = HatchClassificationInsert & {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

export type HatchClassificationListRow = Pick<
  HatchClassificationRow,
  | "id"
  | "date_classify"
  | "br_no"
  | "farm_id"
  | "farm_code"
  | "good_egg"
  | "trans_crack"
  | "hatc_crack"
  | "trans_condemn"
  | "hatc_condemn"
  | "thin_shell"
  | "pee_wee"
  | "small"
  | "jumbo"
  | "d_yolk"
  | "misshapen"
  | "leakers"
  | "dirties"
  | "hairline"
  | "ttl_count"
>;

export type HatchForClassificationRow = Pick<
  ReceivingListRow,
  | "id"
  | "created_at"
  | "dr_num"
  | "brdr_ref_no"
  | "actual_count"
  | "farm_id"
  | "farm_name"
  | "plate_no"
  | "driver"
  | "voyage_no"
  | "shipped_via"
>;

export type HatchClassificationListOptions = {
  farmIds: readonly number[];
  limit?: number;
};

const PENDING_CLASSIFICATION_LIMIT = 50;
const CLASSIFICATION_LIST_COLUMNS =
  "id,date_classify,br_no,farm_id,farm_code,good_egg,trans_crack,hatc_crack,trans_condemn,hatc_condemn,thin_shell,pee_wee,small,jumbo,d_yolk,misshapen,leakers,dirties,hairline,ttl_count";
const PENDING_CLASSIFICATION_COLUMNS =
  "id,created_at,dr_num,brdr_ref_no,actual_count,farm_id,farm_name,plate_no,driver,voyage_no,shipped_via";

function normalizedFarmIds(farmIds: readonly number[]) {
  return Array.from(
    new Set(farmIds.filter((farmId) => Number.isInteger(farmId) && farmId > 0)),
  );
}

// build
export async function createHatchClassification(
  payload: HatchClassificationInsert,
) {
  const { data, error } = await db
    .from("hatch_classification")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as HatchClassificationRow;
}

export async function getHatchClassificationById(id: number) {
  const { data, error } = await db
    .from("hatch_classification")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as HatchClassificationRow;
}

export async function updateHatchClassification(
  id: number,
  payload: Partial<HatchClassificationInsert>,
) {
  const { data, error } = await db
    .from("hatch_classification")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as HatchClassificationRow;
}

export async function deleteHatchClassification(id: number) {
  const { error } = await db.from("hatch_classification").delete().eq("id", id);

  if (error) throw new Error(error.message);
  return true;
}

export type HatchClassificationUpdate = Partial<
  Omit<HatchClassificationInsert, "created_at">
> & {
  updated_at?: string;
};
export async function listHatchClassification({
  farmIds,
  limit = PENDING_CLASSIFICATION_LIMIT,
}: HatchClassificationListOptions) {
  const authorizedFarmIds = normalizedFarmIds(farmIds);
  if (!authorizedFarmIds.length) return [];

  const safeLimit = Math.min(Math.max(1, limit), PENDING_CLASSIFICATION_LIMIT);
  const { data, error } = await db
    .from("hatch_classification")
    .select(CLASSIFICATION_LIST_COLUMNS)
    .in("farm_id", authorizedFarmIds)
    .order("id", { ascending: false })
    .limit(safeLimit);
  if (error) throw new Error(error.message);
  return (data ?? []) as HatchClassificationListRow[];
}

export async function getReceivingList({
  farmIds,
  limit = PENDING_CLASSIFICATION_LIMIT,
}: HatchClassificationListOptions) {
  const authorizedFarmIds = normalizedFarmIds(farmIds);
  if (!authorizedFarmIds.length) return [];

  const safeLimit = Math.min(Math.max(1, limit), PENDING_CLASSIFICATION_LIMIT);
  const { data, error } = await db
    .from("view_for_classification")
    .select(PENDING_CLASSIFICATION_COLUMNS)
    .in("farm_id", authorizedFarmIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safeLimit);
  if (error) throw error;

  return (data ?? []) as HatchForClassificationRow[];
}
