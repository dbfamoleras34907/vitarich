"use client";

import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { updateCurrentUserDefaultFarm, type SavedDefaultFarm } from "@/lib/data/mutations/defaultFarm.client";
import { useGlobalContext } from "@/lib/context/GlobalContext";

type FarmReference = {
  id?: string | number | null;
  code?: string | null;
  farm_code?: string | null;
};

let latestRequestedFarmId: number | null = null;
let lastConfirmedFarmId: string | number | null | undefined;
let pendingWrites = 0;

function withSavedDefaultFarm(session: unknown, farm: SavedDefaultFarm) {
  if (!Array.isArray(session) || !session.length) return session;
  return session.map((profile, index) => index === 0 && profile && typeof profile === "object"
    ? { ...profile, default_farm: farm.code }
    : profile);
}

export function useDefaultFarmSelection() {
  const { getValue, setValue } = useGlobalContext();

  return useCallback(async (value: string | number | null | undefined) => {
    const farmId = Number(value);
    if (!Number.isInteger(farmId) || farmId <= 0) return null;

    const previousFarmId = getValue("DefaultFarmId");
    if (String(previousFarmId ?? "") === String(farmId)) return null;

    if (pendingWrites === 0) lastConfirmedFarmId = previousFarmId;
    pendingWrites += 1;
    latestRequestedFarmId = farmId;
    setValue("DefaultFarmId", farmId);

    try {
      const farm = await updateCurrentUserDefaultFarm(farmId);
      if (latestRequestedFarmId === farmId) {
        setValue("DefaultFarmId", farm.id);
        setValue("UserInfoAuthSession", withSavedDefaultFarm(getValue("UserInfoAuthSession"), farm));
      }
      lastConfirmedFarmId = farm.id;
      return farm;
    } catch (error) {
      if (latestRequestedFarmId === farmId) {
        setValue("DefaultFarmId", lastConfirmedFarmId);
        toast.error(error instanceof Error ? error.message : "Unable to update the default farm.");
      }
      throw error;
    } finally {
      pendingWrites = Math.max(0, pendingWrites - 1);
    }
  }, [getValue, setValue]);
}

export function useSyncDefaultFarm(
  value: string | number | null | undefined,
  enabled = true,
) {
  const selectDefaultFarm = useDefaultFarmSelection();

  useEffect(() => {
    if (!enabled || value == null || String(value).trim() === "") return;
    void selectDefaultFarm(value).catch(() => undefined);
  }, [enabled, selectDefaultFarm, value]);
}

export function resolveFarmId(farms: FarmReference[], reference: unknown) {
  const normalized = String(reference ?? "").trim();
  if (!normalized) return null;
  const farm = farms.find((candidate) =>
    String(candidate.id ?? "") === normalized
    || String(candidate.code ?? candidate.farm_code ?? "").trim() === normalized,
  );
  const farmId = Number(farm?.id);
  return Number.isInteger(farmId) && farmId > 0 ? farmId : null;
}
