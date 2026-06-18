"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { useGlobalContext } from "@/lib/context/GlobalContext";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Farm = {
  id: number;
  code: string;
  name: string;
};

type ReturnHeader = "id" | "code" | "name";

type FarmDropdownProps = {
  value?: string | number;
  defaultValue?: string | number;
  returnHeader?: ReturnHeader;
  placeholder?: string;
  onChange?: (
    value: string | number,
    farm: Farm
  ) => void;
};

/**
 * Filter farms allowed for user
 */
function getAllowedFarms(farmDB: Farm[], userFarms: string[]): Farm[] {
  if (!farmDB.length || !userFarms.length) return [];
  return farmDB.filter((farm) =>
    userFarms.includes(farm.code)
  );
}

export default function FarmDropdown({
  value,
  defaultValue,
  returnHeader = "id",
  placeholder = "Select farm",
  onChange,
}: FarmDropdownProps) {
  const { getValue } = useGlobalContext();

  const [open, setOpen] = React.useState(false);

  /**
   * Internal state for uncontrolled mode
   */
  const [internalValue, setInternalValue] =
    React.useState<string | number | undefined>(
      defaultValue
    );

  /**
   * Controlled vs uncontrolled
   */
  const selectedValue =
    value ?? internalValue;

  /**
   * Sync defaultValue changes
   */
  React.useEffect(() => {
    if (value === undefined) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue, value]);

  /**
   * Get user farms
   */
  const userFarms = useMemo(() => {
    const session =
      getValue("UserInfoAuthSession");

    return session?.[0]?.users_farms || [];
  }, [getValue]);

  /**
   * Get farm master list
   */
  const farmDB = useMemo(() => {
    return getValue("getFarmDB") || [];
  }, [getValue]);

  /**
   * Allowed farms
   */
  const allowedFarms = useMemo(() => {
    return getAllowedFarms(
      farmDB,
      userFarms
    );
  }, [farmDB, userFarms]);

  /**
   * Return selected value
   */
  const getReturnValue = (
    farm: Farm
  ): string | number => {
    return farm[returnHeader];
  };

  /**
   * Find selected farm
   */
  const selectedFarm =
    allowedFarms.find(
      (farm) =>
        String(getReturnValue(farm)) ===
        String(selectedValue)
    );

  return (
    <div>
       <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedFarm ? (
            `${selectedFarm.code} - ${selectedFarm.name}`
          ) : (
            placeholder
          )}

          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search farm..." />

          <CommandEmpty>
            No farm found.
          </CommandEmpty>

          <CommandGroup className="max-h-64 overflow-auto">
            {allowedFarms.map((farm) => {
              const itemValue =
                getReturnValue(farm);

              const isSelected =
                String(itemValue) ===
                String(selectedValue);

              return (
                <CommandItem
                  key={farm.id}
                  value={`${farm.code} ${farm.name}`}
                  onSelect={() => {
                    /**
                     * Update internal state
                     * only if uncontrolled
                     */
                    if (value === undefined) {
                      setInternalValue(
                        itemValue
                      );
                    }

                    onChange?.(
                      itemValue,
                      farm
                    );

                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isSelected
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />

                  <div className="flex flex-col">
                    <span className="font-medium">
                      {farm.code}
                    </span>

                    <span className="text-muted-foreground text-xs">
                      {farm.name}
                    </span>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
    <Button onClick={() => console.log(allowedFarms)}>check  allowedFarms</Button>
    </div>
   
  );
}