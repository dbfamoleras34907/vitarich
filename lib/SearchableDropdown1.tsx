"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Search } from "lucide-react";

type Props<T> = {
  list: T[];
  codeLabel: string;
  nameLabel?: string;
  value: string[];
  onChange: (val: string[]) => void;
  multiple?: boolean;
  showNameOnly?: boolean;
  placeholder?: string;
  width?: number;
  disabled?: boolean;
};

export default function SearchableDropdown<T extends Record<string, any>>({
  list,
  codeLabel,
  nameLabel,
  value = [],
  placeholder = "Select Egg Reference No...",
  showNameOnly = false,
  width = 400,
  disabled = false,
  onChange,
  multiple = false,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // ✅ DISPLAY TEXT (multi-aware)
  const displayText = useMemo(() => {
    if (!value || value.length === 0) return placeholder;

    const selectedItems = list.filter((i) =>
      value.includes(String(i[codeLabel])),
    );

    if (selectedItems.length === 0) return placeholder;

    const labels = selectedItems.map((item) =>
      nameLabel
        ? showNameOnly
          ? String(item[nameLabel])
          : `${item[codeLabel]}`
        : String(item[codeLabel]),
    );

    if (!multiple) {
      return labels[0];
    }

    // ✅ Show up to 3, then summarize
    if (labels.length <= 3) {
      return labels.join(", ");
    }

    return `${labels.slice(0, 3).join(", ")} +${labels.length - 3} more`;
  }, [value, list, codeLabel, nameLabel, showNameOnly, multiple, placeholder]);
  // ✅ FILTER
  const filtered = useMemo(() => {
    if (!search) return list;

    const q = search.toLowerCase();

    return list.filter((item) => {
      const code = String(item[codeLabel]).toLowerCase();
      const name = nameLabel ? String(item[nameLabel]).toLowerCase() : "";

      return code.includes(q) || name.includes(q);
    });
  }, [list, search, codeLabel, nameLabel]);

  // ✅ SELECT / TOGGLE
  const selectItem = (item: T) => {
    const val = String(item[codeLabel]);

    if (!multiple) {
      onChange([val]);
      setOpen(false);
      setSearch("");
      return;
    }

    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" && filtered.length > 0) {
      selectItem(filtered[0]);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              disabled={disabled}
              className="bg-background text-foreground hover:bg-white/50 h-8 w-full justify-start overflow-hidden whitespace-nowrap border border-primary disabled:opacity-50"
            >
              <span className="truncate flex items-center gap-2">
                {!value || value.length === 0 ? (
                  <>
                    <Search size={16} /> {placeholder}
                  </>
                ) : (
                  displayText
                )}
              </span>
            </Button>
          </TooltipTrigger>
        </PopoverTrigger>

        <TooltipContent>{displayText}</TooltipContent>
      </Tooltip>

      <PopoverContent className="p-0 max-h-[50vh]" style={{ width }}>
        <Command onKeyDown={handleKeyDown}>
          <CommandInput
            placeholder="Search..."
            value={search}
            onValueChange={setSearch}
          />

          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup>
            {filtered.map((item, idx) => {
              const val = String(item[codeLabel]);
              const isSelected = value.includes(val);

              return (
                <CommandItem
                  key={idx}
                  onSelect={() => selectItem(item)}
                  className="flex justify-between items-center px-4"
                >
                  <span>
                    {nameLabel
                      ? showNameOnly
                        ? String(item[nameLabel])
                        : `${item[codeLabel]} — ${item[nameLabel]}`
                      : String(item[codeLabel])}
                  </span>

                  {isSelected && <Check size={16} />}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
