/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/Supabase/supabaseClient";

export type BoilerMasterdata = {
  id: number;
  boiler_name: string;
  assigned_ta: string | null;
  region: string | null;
  address: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string | null;
};

export type BoilerMasterdataInsert = {
  boiler_name: string;
  assigned_ta?: string | null;
  region?: string | null;
  address?: string | null;
  is_active?: boolean | null;
};

export type BoilerMasterdataUpdate = BoilerMasterdataInsert;

export async function createBoilerMasterdata(payload: BoilerMasterdataInsert) {
  const { data, error } = await db
    .from("boiler_masterdata")
    .insert([payload])
    .select("*")
    .single();

  if (error) throw error;
  return data as BoilerMasterdata;
}

export async function getBoilerMasterdataById(id: number) {
  const { data, error } = await db
    .from("boiler_masterdata")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as BoilerMasterdata;
}

export async function updateBoilerMasterdata(
  id: number,
  payload: BoilerMasterdataUpdate,
) {
  const { data, error } = await db
    .from("boiler_masterdata")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as BoilerMasterdata;
}

/** Soft delete (recommended for master data) */
export async function deleteBoilerMasterdata(id: number) {
  const { error } = await db
    .from("boiler_masterdata")
    .update({ is_active: false })
    .eq("id", id);

  if (error) throw error;
  return true;
}

export async function listBoilerMasterdata() {
  const { data, error } = await db
    .from("boiler_masterdata")
    .select("*")
    .eq("is_active", true)
    .order("boiler_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as BoilerMasterdata[];
}
