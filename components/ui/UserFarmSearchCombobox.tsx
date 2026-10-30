"use client";

import { useEffect, useMemo, useState } from "react";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { listAssignedUserFarmOptions } from "@/lib/data/repositories/farmOptions.client";
import { useDefaultFarmSelection } from "@/lib/farms/useDefaultFarmSelection";

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
  onFarmResolved?: (farm: UserFarm) => void;
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

const FARM_TYPE_QUERY_VALUES = {
  BR: ["BR", "Broiler"],
  BE: ["BE", "Breeder"],
  HA: ["HA", "Hatchery"],
} as const;

function matchesFarmType(farm: UserFarm, farmType?: keyof typeof FARM_TYPE_LABELS) {
  if (!farmType) return true;
  const value = String(farm.farm_type ?? "").trim().toUpperCase();
  return value === farmType || value === FARM_TYPE_LABELS[farmType];
}

export function getFarmsForSelector(
  farms: UserFarm[],
  farmType: keyof typeof FARM_TYPE_LABELS | undefined,
  defaultFarmReference: unknown,
) {
  if (!farmType) return farms;

  const preferred = String(defaultFarmReference ?? "").trim();
  return farms.filter((farm) =>
    matchesFarmType(farm, farmType)
    || (preferred !== "" && (
      String(farm.id) === preferred
      || String(farm.code).trim() === preferred
    )),
  );
}

export default function UserFarmSearchCombobox({
  label = "Default Farm",
  required,
  value,
  onValueChange,
  onFarmResolved,
  className = "w-full",
  farmType,
  display = "combobox",
}: UserFarmSearchComboboxProps) {
  const { getValue } = useGlobalContext();
  const selectDefaultFarm = useDefaultFarmSelection();
  const session = getValue("UserInfoAuthSession");
  const sessionUserId = session?.[0]?.id;
  const rawFarmDB = getValue("getFarmDB");
  const rawUserFarms = session?.[0]?.users_farms;
  const [typedFarms, setTypedFarms] = useState<UserFarm[] | null>(null);
  const [buttonSearch, setButtonSearch] = useState("");
  const defaultFarmReference = getValue("DefaultFarmId")
    ?? getValue("UserInfoAuthSession")?.[0]?.default_farm;

  useEffect(() => {
    if (!farmType) {
      return;
    }

    let cancelled = false;
    listAssignedUserFarmOptions([...FARM_TYPE_QUERY_VALUES[farmType]])
      .then((farms) => {
        if (!cancelled) {
          setTypedFarms(farms);
        }
      })
      .catch((error) => {
        console.error(`Unable to load ${FARM_TYPE_LABELS[farmType]} farms:`, error);
        if (!cancelled) setTypedFarms([]);
      });

    return () => {
      cancelled = true;
    };
  }, [farmType]);

  const allowedFarms = useMemo(
    () => farmType && typedFarms !== null
      ? typedFarms
      : getAllowedUserFarms(
          (rawFarmDB || []) as UserFarm[],
          (rawUserFarms || []) as unknown[]
        ),
    [farmType, rawFarmDB, rawUserFarms, typedFarms]
  );

  const filteredFarms = useMemo(
    () => getFarmsForSelector(allowedFarms, farmType, defaultFarmReference),
    [allowedFarms, defaultFarmReference, farmType]
  );

  const items = useMemo(
    () =>
      filteredFarms.map((farm) => ({
        code: String(farm.id),
        name: farm.code ? `${farm.code} - ${farm.name}` : farm.name,
      })),
    [filteredFarms]
  );

  // Persisted account defaults use farm codes; interactive selections use numeric IDs.
  const reference = value == null ? "" : String(value);
  const selectedFarm = filteredFarms.find(farm => farm.code === reference)
    ?? filteredFarms.find(farm => String(farm.id) === reference);
  const selectedValue = selectedFarm ? String(selectedFarm.id) : reference;

  useEffect(() => {
    if (selectedFarm) onFarmResolved?.(selectedFarm);
  }, [onFarmResolved, selectedFarm]);

  useEffect(() => {
    if (selectedFarm && reference !== String(selectedFarm.id)) {
      onValueChange?.(String(selectedFarm.id), selectedFarm);
      return;
    }
    if (reference || defaultFarmReference == null) return;
    const defaultFarm = filteredFarms.find((farm) =>
      String(farm.id) === String(defaultFarmReference)
      || farm.code === String(defaultFarmReference),
    );
    if (defaultFarm) onValueChange?.(String(defaultFarm.id), defaultFarm);
  }, [defaultFarmReference, filteredFarms, onValueChange, reference, selectedFarm]);

  const visibleButtonFarms = useMemo(() => {
    const query = buttonSearch.trim().toLocaleLowerCase();
    if (!query) return filteredFarms;

    return filteredFarms.filter((farm) =>
      `${farm.code} ${farm.name}`.toLocaleLowerCase().includes(query)
    );
  }, [buttonSearch, filteredFarms]);

  if (display === "buttons") {
    return (
      <div className={className}>
        <div className="relative mb-2">
          
          <Input
            type="search"
            value={buttonSearch}
            onChange={(event) => setButtonSearch(event.target.value)}
            placeholder="Search farms..."
            aria-label={`Search ${label}`}
            className="h-9 pl-9"
          />
        </div>
        <div className="flex w-full flex-wrap gap-2" role="group" aria-label={label}>
          {visibleButtonFarms.map((farm) => {
            const isSelected = String(farm.id) === selectedValue;

            return (
              <Button
                key={farm.id}
                type="button"
                variant={isSelected ? "default" : "outline"}
                aria-pressed={isSelected}
                onClick={() => {
                  onValueChange?.(String(farm.id), farm);
                  void selectDefaultFarm(farm.id).catch(() => undefined);
                }}
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
        {!visibleButtonFarms.length && (
          <p className="text-sm text-muted-foreground">
            {filteredFarms.length ? "No farms match your search" : "No farms available"}
          </p>
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
          void selectDefaultFarm(farmId).catch(() => undefined);
        }}
        className={className}
      />

      {!items.length && (
        <p className="text-sm text-muted-foreground">No farms available</p>
      )}
    </div>
  );
}
