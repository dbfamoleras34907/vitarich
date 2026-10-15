"use client";

import { useCallback, useId, useState, type ReactNode } from "react";
import { addDays, format } from "date-fns";

import UserFarmSearchCombobox, { type UserFarm } from "@/components/ui/UserFarmSearchCombobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { cn } from "@/lib/utils";

export type FarmDateRangeParameterState = {
  farmId: string;
  farmCode: string;
  setFarmId: (value: string, farm?: UserFarm) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
};

type FarmDateRangeOptions = {
  defaultDays?: number;
};

export function useFarmDateRangeParameters(
  options: FarmDateRangeOptions = {},
): FarmDateRangeParameterState {
  const { getValue } = useGlobalContext();
  const defaultDays = options.defaultDays ?? 30;
  const defaultFarmReference = getValue("DefaultFarmId")
    ?? getValue("UserInfoAuthSession")?.[0]?.default_farm;
  const defaultFarmValue = String(defaultFarmReference ?? "");
  const [selection, setSelection] = useState<{
    base: string;
    farmId: string;
    farmCode: string;
  } | null>(null);
  const hasCurrentSelection = selection?.base === defaultFarmValue;
  const farmId = hasCurrentSelection ? selection.farmId : defaultFarmValue;
  const farmCode = hasCurrentSelection
    ? selection.farmCode
    : (/^\d+$/.test(defaultFarmValue) ? "" : defaultFarmValue);
  const setFarmId = useCallback(
    (value: string, farm?: UserFarm) => setSelection({
      base: defaultFarmValue,
      farmId: value,
      farmCode: farm?.code ?? "",
    }),
    [defaultFarmValue],
  );
  const [dateFrom, setDateFrom] = useState(() =>
    format(addDays(new Date(), -defaultDays), "yyyy-MM-dd"),
  );
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));

  return { farmId, farmCode, setFarmId, dateFrom, setDateFrom, dateTo, setDateTo };
}

export default function FarmDateRangeParameters({
  farmId,
  setFarmId,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  farmType,
  children,
  className,
}: FarmDateRangeParameterState & {
  farmType?: "BR" | "BE" | "HA";
  children?: ReactNode;
  className?: string;
}) {
  const fieldId = useId();
  const handleFarmResolved = useCallback(
    (farm: UserFarm) => setFarmId(String(farm.id), farm),
    [setFarmId],
  );

  return (
    <div className={cn("grid gap-2 sm:grid-cols-3 lg:flex lg:flex-nowrap lg:items-end", className)}>
      <div className="min-w-0 lg:w-72 lg:shrink-0">
        <UserFarmSearchCombobox
          label="Farm"
          farmType={farmType}
          value={farmId}
          onValueChange={setFarmId}
          onFarmResolved={handleFarmResolved}
        />
      </div>

      <div className="space-y-2 lg:w-44 lg:shrink-0">
        <Label htmlFor={`${fieldId}-from`}>From Date</Label>
        <Input
          id={`${fieldId}-from`}
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(event) => setDateFrom(event.target.value)}
        />
      </div>

      <div className="space-y-2 lg:w-44 lg:shrink-0">
        <Label htmlFor={`${fieldId}-to`}>To Date</Label>
        <Input
          id={`${fieldId}-to`}
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(event) => setDateTo(event.target.value)}
        />
      </div>

      {children}
    </div>
  );
}
