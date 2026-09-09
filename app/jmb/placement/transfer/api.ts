import { db } from "@/lib/Supabase/supabaseClient";

export type TransferPlacement = {
  id: number; placement_date: string; farm_id: number; farm_name: string;
  building_id: number; building_no: string; pen_id: number; pen_no: string;
  cycle_id: number; male_available: number; female_available: number;
};

export type BreederTransfer = {
  id: number; transfer_no: string; transfer_date: string;
  source_placement_id: number; destination_placement_id: number;
  male_qty: number; female_qty: number; reason: string; remarks: string | null;
  status: "Draft" | "Posted" | "Cancelled"; cancellation_reason: string | null;
  source: { farm_id: number; farm_name: string; building_id: number; building_no: string; pen_id: number; pen_no: string } | null;
  destination: { farm_id: number; farm_name: string; building_id: number; building_no: string; pen_id: number; pen_no: string } | null;
};

export type BreederTransferInput = {
  transfer_date: string; source_placement_id: number; destination_placement_id: number;
  male_qty: number; female_qty: number; reason: string; remarks: string | null;
};

async function token() {
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error("Your session expired. Please sign in again.");
  return data.session.access_token;
}

async function request<T>(body?: Record<string, unknown>): Promise<T> {
  const accessToken = await token();
  const response = await fetch("/api/jmb/breeder-transfer", {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "Bird transfer request failed.");
  return result;
}

export function loadBreederTransfers() {
  return request<{ placements: TransferPlacement[]; transfers: BreederTransfer[] }>();
}

export function createBreederTransfer(input: BreederTransferInput, post: boolean) {
  return request<{ id: number }>({ input, post });
}

export function postBreederTransfer(id: number) {
  return request<{ id: number }>({ action: "post", id });
}

export function cancelBreederTransfer(id: number, reason: string) {
  return request<{ id: number }>({ action: "cancel", id, reason });
}
