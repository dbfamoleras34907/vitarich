import { db } from "@/lib/Supabase/supabaseClient";
import { ReceivingListRow } from "@/lib/types";

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

export type HatchClassificationInsert = {
  created_at?: string;
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
};

export type HatchClassificationRow = HatchClassificationInsert & {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

export type HatchForClassificationRow = ReceivingListRow & {
  id: number;
};

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
export async function listHatchClassification(limit = 50) {
  const { data, error } = await db
    .from("hatch_classification")
    .select("*")
    .order("id", { ascending: false })
    .limit(limit);

  console.log("hatch_classification =>", { data, error });
  if (error) throw new Error(error.message);
  return (data ?? []) as HatchClassificationRow[];
}
export async function getReceivingList(limit = 100) {
  const { data, error } = await db
    .from("view_for_classification")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  console.log("view_for_classification =>", { data, error });
  if (error) throw error;

  return data as ReceivingListRow[];
}
