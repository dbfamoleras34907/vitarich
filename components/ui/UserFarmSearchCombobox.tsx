"use client";

import { useEffect, useMemo, useState } from "react";
import SearchableCombobox from "@/components/SearchableCombobox";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { listBroilerFarmOptions } from "@/lib/data/repositories/farmOptions.client";

export type UserFarm = {
  id: number;
  code: string;
  name: string;
  farm_type?: string | null;
};

type UserFarmSearchComboboxProps = {
  label?: string;
  required?: boolean;
  value?: string | number | null;
  onValueChange?: (farmId: string, farm?: UserFarm) => void;
  className?: string;
  farmType?: "BR" | "BE" | "HA";
};

function normalizeFarmCode(value: unknown) {
  if (typeof value === "object" && value !== null) {
    const farm = value as { code?: unknown; farm_code?: unknown };
    return String(farm.code ?? farm.farm_code ?? "").trim();
  }
  return String(value ?? "").trim();
}

export function getAllowedUserFarms(farmDB: UserFarm[], userFarms: unknown[]) {
  const allowedCodes = new Set(userFarms.map(normalizeFarmCode));

  if (!farmDB.length || !allowedCodes.size) return [];

  return farmDB.filter((farm) => allowedCodes.has(normalizeFarmCode(farm.code)));
}

const FARM_TYPE_LABELS = {
  BR: "BROILER",
  BE: "BREEDER",
  HA: "HATCHERY",
} as const;

function matchesFarmType(farm: UserFarm, farmType?: keyof typeof FARM_TYPE_LABELS) {
  if (!farmType) return true;
  const value = String(farm.farm_type ?? "").trim().toUpperCase();
  return value === farmType || value === FARM_TYPE_LABELS[farmType];
}

export default function UserFarmSearchCombobox({
  label = "Default Farm",
  required,
  value,
  onValueChange,
  className = "w-full",
  farmType,
}: UserFarmSearchComboboxProps) {
  const { getValue } = useGlobalContext();
  const session = getValue("UserInfoAuthSession");
  const rawFarmDB = getValue("getFarmDB");
  const rawUserFarms = session?.[0]?.users_farms;
  const [broilerFarms, setBroilerFarms] = useState<UserFarm[] | null>(null);

  useEffect(() => {
    if (farmType !== "BR") return;

    let cancelled = false;
    listBroilerFarmOptions()
      .then((farms) => {
        if (!cancelled) {
          setBroilerFarms(farms.map((farm) => ({ ...farm, farm_type: "BR" })));
        }
      })
      .catch((error) => {
        console.error("Unable to load Broiler farms:", error);
        if (!cancelled) setBroilerFarms([]);
      });

    return () => {
      cancelled = true;
    };
  }, [farmType]);

  const farmSource = farmType === "BR" && broilerFarms ? broilerFarms : rawFarmDB;

  const allowedFarms = useMemo(
    () =>
      getAllowedUserFarms(
        (farmSource || []) as UserFarm[],
        (rawUserFarms || []) as unknown[]
      ),
    [farmSource, rawUserFarms]
  );

  const filteredFarms = useMemo(
    () => allowedFarms.filter((farm) => matchesFarmType(farm, farmType)),
    [allowedFarms, farmType]
  );

  const items = useMemo(
    () =>
      filteredFarms.map((farm) => ({
        code: String(farm.id),
        name: farm.code ? `${farm.code} - ${farm.name}` : farm.name,
      })),
    [filteredFarms]
  );

  const selectedValue = value == null ? "" : String(value);

  return (
    <div className="space-y-2">
      <SearchableCombobox
        required={required}
        label={label}
        items={items}
        value={selectedValue}
        onValueChange={(farmId) => {
          const farm = filteredFarms.find((item) => String(item.id) === farmId);
          onValueChange?.(farmId, farm);
        }}
        className={className}
      />

      {!items.length && (
        <p className="text-sm text-muted-foreground">No farms available</p>
      )}
    </div>
  );
}
