"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, RefreshCw, Search } from "lucide-react";

import { listEggHatcheryProcess, type EggHatcheryProcess } from "./newv2/api";
import Breadcrumb from "@/lib/Breadcrumb";
import EditActionButton from "@/components/EditActionButton";

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function fmtNumber(v: number | null | undefined) {
  if (v == null) return "";
  return new Intl.NumberFormat("en-PH").format(v);
}

export default function EggHatchTable() {
  const router = useRouter();
  const [items, setItems] = useState<EggHatcheryProcess[]>([]);
  const [loading, setLoading] = useState(false);

  const [sorting, setSorting] = useState<any>([]);
  const [columnFilters, setColumnFilters] = useState<any>([]);
  const [columnVisibility, setColumnVisibility] = useState<any>({});
  const [rowSelection, setRowSelection] = useState({});

  function fmtDurationHHMM(mins: number | string | null | undefined) {
    if (mins == null || mins === "") return "";

    const n = typeof mins === "string" ? Number(mins) : mins;
    if (!Number.isFinite(n) || n < 0) return "";

    const totalMins = Math.round(n);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;

    // HH:MM (pads minutes to 2 digits; hours can be 1+ digits)
    // return `${h}:${String(m).padStart(2, "0")}`
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  async function load() {
    setLoading(true);
    try {
      const data = await listEggHatcheryProcess();
      setItems(data);
    } catch (e: any) {
      alert(e?.message ?? "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const columns = useMemo<ColumnDef<EggHatcheryProcess>[]>(
    () => [
      {
        accessorKey: "id",
        header: "#",
        cell: ({ row }) => row.index + 1,
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => (
          <EditActionButton
            id={row.original?.id}
            href={(id) => `/jmb/egghatcherv2/newv2?id=${id}`}
          />
        ),
      },
      {
        accessorKey: "egg_ref",
        header: "Egg Reference No.",
        cell: ({ row }) => row.original.egg_ref ?? "",
      },
      {
        accessorKey: "farm_source",
        header: "Farm Source",
        cell: ({ row }) => row.original.farm_source ?? "",
      },
      {
        accessorKey: "daterec",
        header: "Date Rec",
        cell: ({ row }) => row.original.daterec ?? "",
      },
      {
        accessorKey: "machine_no",
        header: "Machine No",
        cell: ({ row }) => row.original.machine_no ?? "",
      },
      {
        accessorKey: "hatch_time_start",
        header: "Start",
        cell: ({ row }) => fmtDateTime(row.original.hatch_time_start),
      },
      {
        accessorKey: "hatch_time_end",
        header: "End",
        cell: ({ row }) => fmtDateTime(row.original.hatch_time_end),
      },
      {
        accessorKey: "duration",
        header: "Duration",
        cell: ({ row }) => fmtDurationHHMM(row.original.duration),
      },
      {
        accessorKey: "hatch_window",
        header: "Hatch Window",
        cell: ({ row }) => fmtNumber(row.original.hatch_window),
      },
      {
        accessorKey: "total_egg",
        header: "Total Egg",
        cell: ({ row }) => fmtNumber(row.original.total_egg),
      },
    ],
    [router],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="rounded-md p-4 mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        // FirstPreviewsPageName="Egg Transfer"
        CurrentPageName="Egg Hatchery"
      />
      <div className="flex flex-col md:flex-row md:items-center gap-2 justify-between">
        <div className="flex items-center gap-4 py-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 w-70"
              placeholder="Search Egg Reference No."
              value={
                (table.getColumn("egg_ref")?.getFilterValue() as string) ?? ""
              }
              onChange={(e) =>
                table.getColumn("egg_ref")?.setFilterValue(e.target.value)
              }
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={loading}
            className="w-full md:w-auto h-full md:h-auto"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <Button
          type="button"
          className="w-full md:w-auto h-full md:h-auto"
          onClick={() => router.push("/jmb/egghatcherv2/newv2")}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Egg Hatch
        </Button>
      </div>

      <div className="  border bg-white p-4 rounded-2xl">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-normal">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
