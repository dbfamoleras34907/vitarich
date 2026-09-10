"use client";

import { useEffect, useMemo, useState } from "react";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  display?: "combobox" | "buttons";
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
  display = "combobox",
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

  if (display === "buttons") {
    return (
      <div className={className} role="group" aria-label={label}>
        <div className="flex w-full flex-wrap gap-2">
          {filteredFarms.map((farm) => {
            const isSelected = String(farm.id) === selectedValue;

            return (
              <Button
                key={farm.id}
                type="button"
                variant={isSelected ? "default" : "outline"}
                aria-pressed={isSelected}
                onClick={() => onValueChange?.(String(farm.id), farm)}
                className="h-auto min-h-14 min-w-0 max-w-full flex-[1_1_10rem] justify-start whitespace-normal px-3 py-2 text-left"
              >
                <span className="min-w-0 flex-1 break-words">
                  <span className="block text-xs font-normal opacity-75">{farm.code}</span>
                  <span className="block">{farm.name}</span>
                </span>
                {isSelected && <Check className="size-4" aria-hidden="true" />}
              </Button>
            );
          })}
        </div>
        {!filteredFarms.length && (
          <p className="text-sm text-muted-foreground">No farms available</p>
        )}
      </div>
    );
  }

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
