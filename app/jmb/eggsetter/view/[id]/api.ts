// /jmb/eggsetter/api/index.ts

import { db } from "@/lib/Supabase/supabaseClient";

export interface SetterIncubationProcess {
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

  setter_temp: string | null;
  setter_humidity: string | null;

  turning_interval: number | null;
  turning_angle: string | null;

  incubation_duration: number | null;

  egg_shell_temp: string | null;
  egg_shell_temp_dt: string | null;

  egg_shell_orientation: string | null;

  qty_set_egg: number | null;
}

export async function listSetterIncubationProcess(): Promise<
  SetterIncubationProcess[]
> {
  const { data, error } = await db
    .from("setter_incubation_process")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as SetterIncubationProcess[];
}

export async function getSetterIncubationProcessById(
  id: string | number
): Promise<SetterIncubationProcess | null> {
  const { data, error } = await db
    .from("setter_incubation_process")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  return data as SetterIncubationProcess;
}