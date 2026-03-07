"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Search } from "lucide-react";

import {
  ChickGradingProcess,
  deleteChickGradingProcess,
  listChickGradingProcess,
} from "./new/api";

import Breadcrumb from "@/lib/Breadcrumb";
import EditActionButton from "@/components/EditActionButton";

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ChickgradingTable() {
  const router = useRouter();

  const [items, setItems] = useState<ChickGradingProcess[]>([]);
  const [columnFilters, setColumnFilters] = useState<any>([]);
  const [sorting, setSorting] = useState<any>([]);
  const [columnVisibility, setColumnVisibility] = useState<any>({});
  const [rowSelection, setRowSelection] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listChickGradingProcess();
      setItems(Array.isArray(data) ? data : []);
      setLastUpdated(new Date().toLocaleString());
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    router.prefetch("/jmb/chickgrading/new");
    load();
  }, [router, load]);

  async function onDelete(id: number) {
    if (!confirm("Delete this record?")) return;
    await deleteChickGradingProcess(id);
    await load();
    router.refresh();
  }

  const columns = useMemo<ColumnDef<ChickGradingProcess>[]>(
    () => [
      {
        id: "row_no",
        header: "#",
        cell: ({ row }) => row.index + 1,
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <EditActionButton
              id={row.original?.id}
              href={(id) => `/jmb/chickgrading/new?id=${id}`}
            />
          </div>
        ),
      },
      { accessorKey: "egg_ref_no", header: "Egg Reference No." },
      { accessorKey: "batch_code", header: "Batch code" },
      {
        accessorKey: "grading_datetime",
        header: "Grading date & time",
        cell: ({ row }) => fmtDateTime(row.original.grading_datetime),
      },
      {
        accessorKey: "total_chicks",
        header: "Total chicks",
        cell: ({ row }) => {
          const value = row.original.total_chicks ?? 0;
          return Number(value).toLocaleString();
        },
      },
      {
        accessorKey: "good_quality_chicks",
        header: "Good quality chicks",
        cell: ({ row }) => {
          const value = row.original.good_quality_chicks ?? 0;
          return Number(value).toLocaleString();
        },
      },
      { accessorKey: "quality_grade_rate", header: "Quality grade rate %" },
      { accessorKey: "cull_rate", header: "Cull rate %" },
      { accessorKey: "grading_personnel", header: "Grading personnel" },
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      columnFilters,
      sorting,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="rounded-md p-4 mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        CurrentPageName="Doc Classification"
      />

      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Input
              placeholder="Filter Egg Reference No."
              className="pl-10"
              value={
                (table.getColumn("egg_ref_no")?.getFilterValue() as string) ??
                ""
              }
              onChange={(e) =>
                table.getColumn("egg_ref_no")?.setFilterValue(e.target.value)
              }
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-2 w-full md:w-auto h-full md:h-auto"
          >
            <RefreshCw
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <Button
          type="button"
          onClick={() => router.push("/jmb/chickgrading/new")}
          className="flex items-center gap-2 w-full md:w-auto h-full md:h-auto"
        >
          <Plus className="size-4" />
          New DOC Classification
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="whitespace-nowrap">
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((r) => (
                <TableRow key={r.id}>
                  {r.getVisibleCells().map((c) => (
                    <TableCell key={c.id}>
                      {c.column.columnDef.cell
                        ? flexRender(c.column.columnDef.cell, c.getContext())
                        : String(c.getValue() ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {isLoading ? "Loading..." : "No results."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
