"use client";

import {
  type Header,
  type Table as TanStackTable,
  flexRender,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StatusTone = "amber" | "emerald" | "sky" | "stone";
type PaginationMode = "page-records" | "showing-rows";

function toneClasses(tone: StatusTone) {
  switch (tone) {
    case "amber":
      return "bg-amber-100 text-amber-800 before:bg-amber-500";
    case "emerald":
      return "bg-emerald-100 text-emerald-800 before:bg-emerald-500";
    case "sky":
      return "bg-sky-100 text-sky-800 before:bg-sky-500";
    default:
      return "bg-stone-100 text-stone-800 before:bg-stone-500";
  }
}

export function ClassificationStatusPill({
  label,
  tone,
}: {
  label: string;
  tone: StatusTone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${toneClasses(
        tone,
      )} before:size-1.5 before:rounded-full before:content-['']`}
    >
      {label}
    </span>
  );
}

export function ClassificationRefBadge({
  value,
}: {
  value?: string | null;
}) {
  if (!value) return null;

  return (
    <span className="inline-flex max-w-48 rounded bg-sky-100 px-2 py-1 font-mono text-[11px] leading-tight text-sky-800">
      {value}
    </span>
  );
}

function SortableHeader<TData>({ header }: { header: Header<TData, unknown> }) {
  if (header.isPlaceholder) return null;

  const content = flexRender(
    header.column.columnDef.header,
    header.getContext(),
  );

  if (!header.column.getCanSort()) return content;

  const sorted = header.column.getIsSorted();

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-left font-semibold uppercase text-stone-700 hover:text-stone-950"
      onClick={header.column.getToggleSortingHandler()}
    >
      <span>{content}</span>
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ChevronsUpDown className="size-3.5 text-stone-400" />
      )}
    </button>
  );
}

function ClassificationPagination<TData>({
  table,
  mode,
}: {
  table: TanStackTable<TData>;
  mode: PaginationMode;
}) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = Math.max(table.getPageCount(), 1);
  const pageSize = table.getState().pagination.pageSize;
  const totalRows = table.getFilteredRowModel().rows.length;
  const startRow = totalRows ? pageIndex * pageSize + 1 : 0;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div className="flex flex-col gap-3 border-t border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-700 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {mode === "showing-rows"
          ? `Showing rows ${startRow}-${endRow}`
          : `Page ${pageIndex + 1} of ${pageCount} : ${totalRows} records`}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="h-9 rounded-md bg-white px-4"
        >
          Prev
        </Button>
        {Array.from({ length: Math.min(pageCount, 5) }, (_, index) => (
          <Button
            key={index}
            type="button"
            variant={pageIndex === index ? "default" : "outline"}
            size="sm"
            onClick={() => table.setPageIndex(index)}
            className={`h-9 min-w-10 rounded-md px-3 ${
              pageIndex === index
                ? "bg-stone-900 text-white hover:bg-stone-800"
                : "bg-white text-stone-900"
            }`}
          >
            {index + 1}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="h-9 rounded-md bg-white px-4"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function ClassificationTableSection<TData>({
  table,
  title,
  tone,
  isLoading,
  colSpan,
  headerActions,
  minWidthClassName = "min-w-230",
  paginationMode = "page-records",
}: {
  table: TanStackTable<TData>;
  title: string;
  tone: StatusTone;
  isLoading?: boolean;
  colSpan: number;
  headerActions?: ReactNode;
  minWidthClassName?: string;
  paginationMode?: PaginationMode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-stone-200 bg-white px-3 py-3 sm:flex-row sm:items-center">
        <ClassificationStatusPill label={title} tone={tone} />
        {headerActions}
      </div>
      <div className="overflow-x-auto">
        <Table className={`${minWidthClassName} text-xs`}>
          <TableHeader className="bg-stone-100">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-stone-200">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-9 whitespace-nowrap px-3 text-left align-middle text-[11px] font-semibold uppercase text-stone-700"
                  >
                    <SortableHeader header={header} />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-stone-200 odd:bg-white even:bg-stone-50/70"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-3 py-3 align-middle text-stone-800"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={colSpan} className="h-24 text-center">
                  {isLoading ? "Loading..." : "No results."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <ClassificationPagination table={table} mode={paginationMode} />
    </section>
  );
}
