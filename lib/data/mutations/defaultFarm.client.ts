import { db } from "@/lib/Supabase/supabaseClient";
import { fetchWithInternetErrorNotice, readJsonResponse } from "@/lib/network/http";

export type SavedDefaultFarm = {
  id: number;
  code: string;
  name: string;
  farmType: string;
  fmsType: "Broiler" | "Breeder" | "Hatchery";
};

let saveQueue: Promise<unknown> = Promise.resolve();

async function saveDefaultFarm(farmId: number): Promise<SavedDefaultFarm> {
  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;

  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Authentication required.");

  const response = await fetchWithInternetErrorNotice("/api/user/default-farm", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ farmId }),
  });
  const result = await readJsonResponse<{ farm: SavedDefaultFarm }>(
    response,
    "Unable to update the default farm.",
  );
  return result.farm;
}

export function updateCurrentUserDefaultFarm(farmId: number): Promise<SavedDefaultFarm> {
  const operation = saveQueue.then(
    () => saveDefaultFarm(farmId),
    () => saveDefaultFarm(farmId),
  );
  saveQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
