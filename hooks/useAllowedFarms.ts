"use client";

import { useMemo } from "react";
import { useGlobalContext } from "@/lib/context/GlobalContext";

type Farm = {
  id: number;
  code: string;
  name: string;
};

/**
 * Reusable pure function
 */
export function getAllowedFarms(
  farmDB: Farm[],
  userFarms: string[]
): Farm[] {
  if (!farmDB?.length || !userFarms?.length) return [];

  return farmDB.filter((farm) =>
    userFarms.includes(farm.code)
  );
}

/**
 * Dynamic hook
 * Gets farms from global context automatically
 */
export function useAllowedFarms() {
  const { getValue } = useGlobalContext();

  const allowedFarms = useMemo(() => {
    const session = getValue("UserInfoAuthSession");
    const farmDB = getValue("getFarmDB") || [];

    const userFarms =
      session?.[0]?.users_farms || [];

    return getAllowedFarms(
      farmDB,
      userFarms
    );
  }, [getValue]);

  return allowedFarms;
}