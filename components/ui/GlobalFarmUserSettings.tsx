"use client";

import React, { useEffect } from "react";
import UserFarmSearchCombobox from "@/components/ui/UserFarmSearchCombobox";
import { useGlobalContext } from "@/lib/context/GlobalContext";


type Farm = {
  id: number;
  code: string;
  name: string;
};

/**
 * Reusable function: filter farms allowed for the user
 */
export function getAllowedFarms(farmDB: Farm[], userFarms: string[]): Farm[] {
  if (!farmDB.length || !userFarms.length) return [];

  return farmDB.filter((farm) => userFarms.includes(farm.code));
}

export default function GlobalFarmUserSettings({ onFarmSelected }: { onFarmSelected?: () => void }) {
  const { getValue, setValue } = useGlobalContext();
  const currentDefaultFarmId = getValue("DefaultFarmId");
  const session = getValue("UserInfoAuthSession");
  const sessionDefaultFarmId = session?.[0]?.default_farm;

  useEffect(() => {
    if (!currentDefaultFarmId && sessionDefaultFarmId) {
      setValue("DefaultFarmId", sessionDefaultFarmId);
    }
  }, [currentDefaultFarmId, sessionDefaultFarmId, setValue]);

  return (
    <UserFarmSearchCombobox
      display="buttons"
      value={currentDefaultFarmId ?? sessionDefaultFarmId ?? ""}
      onValueChange={(farmId) => {
        setValue("DefaultFarmId", Number(farmId));
        onFarmSelected?.();
      }}
    />
  );
}
