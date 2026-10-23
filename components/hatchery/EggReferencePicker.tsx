"use client";

import { useMemo, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type EggReferencePickerOption = {
  eggReferenceNo: string;
  breederReferenceNo: string;
  drNo: string;
  documentDatePost: string;
  totalEggs: number;
};

type FilterState = {
  eggReferenceNo: string;
  breederReferenceNo: string;
  drNo: string;
  documentDateFrom: string;
  documentDateTo: string;
};

const EMPTY_FILTERS: FilterState = {
  eggReferenceNo: "",
  breederReferenceNo: "",
  drNo: "",
  documentDateFrom: "",
  documentDateTo: "",
};

function displayDate(value: string) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function EggReferencePicker({
  options,
  value,
  onApply,
  disabled = false,
}: {
  options: EggReferencePickerOption[];
  value: string[];
  onApply: (references: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [pendingSelection, setPendingSelection] = useState<string[]>(value);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setPendingSelection(value);
    setOpen(nextOpen);
  };

  const rows = useMemo(() => {
    const includes = (value: string, query: string) =>
      !query || value.toLowerCase().includes(query.trim().toLowerCase());

    return options.filter((option) => {
      if (!includes(option.eggReferenceNo, filters.eggReferenceNo)) return false;
      if (!includes(option.breederReferenceNo, filters.breederReferenceNo)) {
        return false;
      }
      if (!includes(option.drNo, filters.drNo)) return false;
      if (
        filters.documentDateFrom &&
        (!option.documentDatePost ||
          option.documentDatePost < filters.documentDateFrom)
      ) {
        return false;
      }
      if (
        filters.documentDateTo &&
        (!option.documentDatePost || option.documentDatePost > filters.documentDateTo)
      ) {
        return false;
      }
      return true;
    });
  }, [filters, options]);

  const toggle = (reference: string) => {
    setPendingSelection((current) =>
      current.includes(reference)
        ? current.filter((item) => item !== reference)
        : [...current, reference],
    );
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 shrink-0"
        disabled={disabled}
        onClick={() => handleOpenChange(true)}
      >
        <Filter className="size-3.5" />
        Find Egg References
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Find Egg Reference Numbers</DialogTitle>
            <DialogDescription>
              Filter the available Egg Reference Numbers, select one or more,
              then apply them to this Egg Setter record.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="egg-reference-search" className="text-xs font-medium">
                Egg Reference No.
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="egg-reference-search"
                  value={filters.eggReferenceNo}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      eggReferenceNo: event.target.value,
                    }))
                  }
                  className="h-8 pl-8"
                  placeholder="Search Egg Ref#"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="breeder-reference-search" className="text-xs font-medium">
                Breeder Ref#
              </label>
              <Input
                id="breeder-reference-search"
                value={filters.breederReferenceNo}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    breederReferenceNo: event.target.value,
                  }))
                }
                className="h-8"
                placeholder="Filter Breeder Ref#"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="dr-number-search" className="text-xs font-medium">
                DR#
              </label>
              <Input
                id="dr-number-search"
                value={filters.drNo}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, drNo: event.target.value }))
                }
                className="h-8"
                placeholder="Filter DR#"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="document-date-from" className="text-xs font-medium">
                Document Date Post From
              </label>
              <Input
                id="document-date-from"
                type="date"
                value={filters.documentDateFrom}
                max={filters.documentDateTo || undefined}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    documentDateFrom: event.target.value,
                  }))
                }
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="document-date-to" className="text-xs font-medium">
                Document Date Post To
              </label>
              <Input
                id="document-date-to"
                type="date"
                value={filters.documentDateTo}
                min={filters.documentDateFrom || undefined}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    documentDateTo: event.target.value,
                  }))
                }
                className="h-8"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => setFilters(EMPTY_FILTERS)}
              >
                <X className="size-3.5" />
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="max-h-[40vh] overflow-auto rounded-md border">
            <table className="w-full min-w-190 text-sm">
              <thead className="sticky top-0 z-10 bg-muted/95 shadow-sm">
                <tr className="border-b">
                  <th className="w-10 px-3 py-2 text-left">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Egg Reference No.</th>
                  <th className="px-3 py-2 text-left font-medium">Breeder Ref#</th>
                  <th className="px-3 py-2 text-left font-medium">DR#</th>
                  <th className="px-3 py-2 text-left font-medium">Document Date Post</th>
                  <th className="px-3 py-2 text-right font-medium">Total Hatching Egg</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((option) => {
                    const selected = pendingSelection.includes(option.eggReferenceNo);
                    return (
                      <tr key={option.eggReferenceNo} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggle(option.eggReferenceNo)}
                            aria-label={`Select ${option.eggReferenceNo}`}
                            className="size-4 accent-primary"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{option.eggReferenceNo}</td>
                        <td className="px-3 py-2">{option.breederReferenceNo || "-"}</td>
                        <td className="px-3 py-2">{option.drNo || "-"}</td>
                        <td className="px-3 py-2">{displayDate(option.documentDatePost)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {option.totalEggs.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="h-28 px-3 text-center text-muted-foreground">
                      No Egg Reference Numbers match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <div className="mr-auto self-center text-xs text-muted-foreground">
              {rows.length} matching · {pendingSelection.length} selected
            </div>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                onApply(pendingSelection);
                setOpen(false);
              }}
            >
              Apply Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
