"use client";

import type {
  ClipboardEvent,
  FocusEvent,
  KeyboardEvent,
  ReactNode,
  RefCallback,
} from "react";
import { Input } from "@/components/ui/input";
import { TableHead } from "@/components/ui/table";
import {
  dataColumnWidth,
  getHeaderBorderClass,
  headerRowHeight,
  trackingLabelClass,
  trackingLabelLeft,
  type HeaderCellConfig,
} from "./flockCardGridConfig";

export function CellInput({
  id,
  disabled,
  value,
  inputRef,
  onCommit,
  onBlur,
  onFocus,
  onKeyDown,
  onPaste,
}: {
  id: string;
  disabled: boolean;
  value: string;
  inputRef: RefCallback<HTMLInputElement>;
  onCommit: (value: string) => void;
  onBlur: (value: string) => void;
  onFocus: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <Input
      key={`${id}-${value}`}
      id={id}
      name={id}
      disabled={disabled}
      defaultValue={value}
      ref={inputRef}
      onBlur={(event) => {
        const nextValue = event.currentTarget.value;

        window.setTimeout(() => {
          onCommit(nextValue);
          onBlur(nextValue);
        }, 0);
      }}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      style={{ minWidth: dataColumnWidth }}
      className="h-8 rounded-none border-0 bg-transparent text-center shadow-none transition-none focus:font-semibold focus:text-emerald-950 focus-visible:border-transparent focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[#7c766c] dark:focus:text-emerald-100 dark:disabled:bg-transparent dark:disabled:text-muted-foreground"
    />
  );
}

function HeaderLabel({ children }: { children: ReactNode }) {
  return (
    <span className={trackingLabelClass} style={{ left: trackingLabelLeft }}>
      {children}
    </span>
  );
}

function HeaderCell({ cell }: { cell: HeaderCellConfig }) {
  return (
    <TableHead
      colSpan={cell.colSpan}
      rowSpan={cell.rowSpan}
      aria-label={cell.ariaLabel}
      className={`${cell.className} ${getHeaderBorderClass(cell.groupEnd)}`}
      style={{
        height: headerRowHeight,
        minWidth: dataColumnWidth,
        top: cell.top ?? 0,
      }}
    >
      {cell.label ? <HeaderLabel>{cell.label}</HeaderLabel> : null}
    </TableHead>
  );
}

export function HeaderCells({
  cells,
  rowName,
}: {
  cells: HeaderCellConfig[];
  rowName: string;
}) {
  return cells.map((cell, index) => (
    <HeaderCell
      key={`${rowName}-${cell.label ?? cell.ariaLabel}-${index}`}
      cell={cell}
    />
  ));
}
