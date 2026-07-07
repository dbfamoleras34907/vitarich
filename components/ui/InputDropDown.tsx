/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table";
import { X } from "lucide-react";
import { Label } from "@/components/ui/label";

interface DefaultKeyValue<T> {
  [key: string]: T[keyof T];
}

interface InputDropDownProps<T> {
  columns?: ColumnDef<T, any>[];
  data?: T[];
  onClick: (item: T) => void;
  onClear?: () => void;
  label?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  isTransparent?: boolean;
  defaultKeyValue?: DefaultKeyValue<T>[];
  fitWidth?: boolean;
  clearTrigger?: any;
  value?: string;
}

export function InputDropDown<T extends Record<string, any>>({
  columns = [],
  data = [],
  onClick,
  onClear,
  label,
  name,
  placeholder = "Search...",
  disabled = false,
  required = false,
  className = "",
  isTransparent = true,
  defaultKeyValue,
  fitWidth = false,
  clearTrigger,
  value,
}: InputDropDownProps<T>) {
  const [selectedValue, setSelectedValue] =React.useState<string>(value || "");

  React.useEffect(() => {
    if (value) {
      setSelectedValue(value);
    }
  }, [value]);
  
  const [query, setQuery] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [isDisabled, setIsDisabled] = React.useState(disabled);
  const [position, setPosition] = React.useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    inputWidth: number;
  } | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const autoSelectedRef = React.useRef<string | null>(null);

  const getCellValue = React.useCallback(
    (row: T, col: ColumnDef<T, any>): string => {
      if ("accessorKey" in col && col.accessorKey) {
        return String(row[col.accessorKey as keyof T] ?? "");
      }
      if ("accessorFn" in col && typeof col.accessorFn === "function") {
        return String(col.accessorFn(row, 0) ?? "");
      }
      return "";
    },
    []
  );
 


  const filtered = React.useMemo(() => {
    if (!query) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      columns.some((col) =>
        getCellValue(row, col).toLowerCase().includes(q)
      )
    );
  }, [query, data, columns, getCellValue]);

  React.useLayoutEffect(() => {
    if (data.length === 1) {
      const row = data[0];
      const key = JSON.stringify(row);
      if (autoSelectedRef.current !== key) {
        autoSelectedRef.current = key;
        onClick(row);
        setQuery(columns.map((c) => getCellValue(row, c)).join(" - "));
        setIsDisabled(true);
        setIsOpen(false);
      }
    }
  }, [data, columns, getCellValue, onClick]);

  React.useEffect(() => {
    if (!defaultKeyValue || defaultKeyValue.length === 0) return;

    const found = data.find((row) =>
      defaultKeyValue.every((pair) => {
        const [key, value] = Object.entries(pair)[0];
        return row[key] === value;
      })
    );

    if (!found) return;

    const key = JSON.stringify(found);
    if (autoSelectedRef.current === key) return;

    autoSelectedRef.current = key;
    onClick(found);
    setQuery(columns.map((col) => getCellValue(found, col)).join(" - "));
  }, [defaultKeyValue, data, columns, getCellValue, onClick]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" && filtered.length > 0) {
      e.preventDefault();
      const row = filtered[0];
      onClick(row);
      setIsOpen(false);
      setQuery(columns.map((c) => getCellValue(row, c)).join(" - "));
    }
    if (e.key === "Escape") setIsOpen(false);
  };

  const clearInput = () => {
    onClick({} as T);
    setQuery("");
    setIsOpen(false);
    autoSelectedRef.current = null;
    onClear?.();
  };

  const validateInput = () => {
    const exists = data.some(
      (row) =>
        columns
          .map((col) => getCellValue(row, col))
          .join(" - ")
          .toLowerCase() === query.toLowerCase()
    );
    if (!exists) clearInput();
  };

  const updatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      let top = rect.bottom + window.scrollY;
      let maxHeight = Math.min(300, spaceBelow - 10);
      if (spaceBelow < 200 && spaceAbove > spaceBelow) {
        top = rect.top + window.scrollY - Math.min(300, spaceAbove - 10);
        maxHeight = Math.min(300, spaceAbove - 10);
      }
      setPosition({
        top,
        left: rect.left + window.scrollX,
        width: rect.width,
        maxHeight,
        inputWidth: rect.width,
      });
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [isOpen, fitWidth]);

  React.useEffect(() => {
    if (clearTrigger !== undefined) clearInput();
  }, [clearTrigger]);

  return (
    <div className="relative w-full">
      {label && (
        <Label className="mb-1 block text-sm font-medium text-foreground" required={required}>
          {label}
        </Label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          name={name}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          disabled={isDisabled}
          onFocus={() => {
            if (!isDisabled) {
              setIsOpen(true);
              updatePosition();
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              setIsOpen(false);
              validateInput();
            }, 100);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "field-sizing-content file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-10 w-full min-w-0 rounded-md border border-[#b8b2aa] bg-[#fffdfb] px-3 py-2 text-base shadow-none transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#f1efeb] disabled:text-muted-foreground md:text-sm dark:border-input dark:bg-input/30 dark:disabled:bg-input/20",
            "focus-visible:border-ring focus-visible:ring-ring/15 focus-visible:ring-2",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            className
          )}
          required={required}
        />

        {query && !isDisabled && (
          <button
            type="button"
            onClick={clearInput}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} className="bg-background hover:border" />
          </button>
        )}
      </div>

      {isOpen &&
        !isDisabled &&
        filtered.length > 0 &&
        position &&
        createPortal(
          <div
            style={{
              position: "absolute",
              top: position.top,
              left: position.left,
              minWidth: fitWidth ? position.inputWidth : position.width,
              width: fitWidth ? "max-content" : position.width,
              maxHeight: position.maxHeight,
            }}
            className="z-999 rounded-md border bg-background shadow-md overflow-auto"
          >
            {filtered.map((row, idx) => (
              <div
                key={idx}
                className="cursor-pointer px-3 py-2 hover:bg-accent text-sm whitespace-nowrap"
                onMouseDown={() => {
                  onClick(row);
                  setQuery(columns.map((col) => getCellValue(row, col)).join(" - "));
                  setIsOpen(false);
                }}
              >
                {columns.map((col, i) => (
                  <span key={i} className="mr-3">
                    {getCellValue(row, col)}
                  </span>
                ))}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
