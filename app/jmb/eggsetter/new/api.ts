import { db } from "@/lib/Supabase/supabaseClient";
import { DefaultFarm } from "@/lib/types";
import {
  listEggSetterReferenceOptions,
  type EggSetterReferenceOption,
} from "@/lib/data/repositories/eggSetter";

export type HatchClassiRefOption = EggSetterReferenceOption;

export { listSetterReferenceHistory, type SetterRefHistory } from "@/lib/data/repositories/eggSetter";

export async function listHatchClassiRefs(
  includeRefs: string[] = [],
): Promise<HatchClassiRefOption[]> {
  return listEggSetterReferenceOptions(includeRefs);
}

export type SetterIncubation = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;

  ref_no: string | null;
  setting_date: string | null;
  farm_source: string | null;
  machine_id: string | null;

  total_eggs: number | null;
  setter_temp: number | null;
  setter_humidity: number | null;

  turning_interval: number | null;
  turning_angle: number | null;
  incubation_duration: number | null;

  egg_shell_temp: number | null;
  egg_shell_temp_dt: string | null;
  egg_shell_orientation:
    | "Pointed Up"
    | "Pointed Down"
    | "Pointed Middle"
    | null;
  qty_set_egg: number | null;
};

const TABLE = "setter_incubation_process";

export async function listSetterIncubations() {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("id", { ascending: false });

  if (error) throw error;
  return (data ?? []) as SetterIncubation[];
}

export async function getSetterIncubationById(id: number) {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as SetterIncubation;
}

export type SetterIncubationInsert = Omit<
  SetterIncubation,
  "id" | "created_at" | "created_by" | "updated_at" | "updated_by"
>;

export async function createSetterIncubation(payload: SetterIncubationInsert) {
  const { data, error } = await db
    .from(TABLE)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as SetterIncubation;
}

export async function createSetterIncubationBatch(
  payloads: SetterIncubationInsert[],
) {
  const { data, error } = await db.from(TABLE).insert(payloads).select("*");
  if (error) throw error;
  return (data ?? []) as SetterIncubation[];
}

export async function updateSetterIncubation(
  id: number,
  payload: Partial<SetterIncubationInsert>,
) {
  const { data, error } = await db
    .from(TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as SetterIncubation;
}

export async function deleteSetterIncubation(id: number) {
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) throw error;
  return true;
}


export async function getUserInfo() {
  const {
    data: { session },
  } = await db.auth.getSession();
  // console.log(session?.user.id);
  const { data, error } = await db
    .from("vwdmf_user_default_farm")
    .select("*")
    .eq("auth_id", session?.user.id);

  // console.log({ data, error });
  if (error) {
    throw error;
  }
  return data as DefaultFarm[];
}
