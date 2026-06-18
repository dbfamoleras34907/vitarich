"use client";

import { useMemo } from "react";
import SearchableCombobox from "@/components/SearchableCombobox";
import { useGlobalContext } from "@/lib/context/GlobalContext";

export type UserFarm = {
  id: number;
  code: string;
  name: string;
};

type UserFarmSearchComboboxProps = {
  label?: string;
  required?: boolean;
  value?: string | number | null;
  onValueChange?: (farmId: string, farm?: UserFarm) => void;
  className?: string;
};

function normalizeFarmCode(value: unknown) {
  return String(value ?? "").trim();
}

export function getAllowedUserFarms(farmDB: UserFarm[], userFarms: unknown[]) {
  const allowedCodes = new Set(userFarms.map(normalizeFarmCode));

  if (!farmDB.length || !allowedCodes.size) return [];

  return farmDB.filter((farm) => allowedCodes.has(normalizeFarmCode(farm.code)));
}

export default function UserFarmSearchCombobox({
  label = "Default Farm",
  required,
  value,
  onValueChange,
  className = "w-full",
}: UserFarmSearchComboboxProps) {
  const { getValue } = useGlobalContext();
  const session = getValue("UserInfoAuthSession");
  const rawFarmDB = getValue("getFarmDB");
  const rawUserFarms = session?.[0]?.users_farms;

  const allowedFarms = useMemo(
    () =>
      getAllowedUserFarms(
        (rawFarmDB || []) as UserFarm[],
        (rawUserFarms || []) as unknown[]
      ),
    [rawFarmDB, rawUserFarms]
  );

  const items = useMemo(
    () =>
      allowedFarms.map((farm) => ({
        code: String(farm.id),
        name: farm.code ? `${farm.code} - ${farm.name}` : farm.name,
      })),
    [allowedFarms]
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
          const farm = allowedFarms.find((item) => String(item.id) === farmId);
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
