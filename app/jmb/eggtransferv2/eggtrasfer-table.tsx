"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
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
import { Plus, RefreshCw, Search, Pencil } from "lucide-react";

import { EggTransferProcess, listEggTransfers } from "./newv2/api";
import Breadcrumb from "@/lib/Breadcrumb";
import EditActionButton from "@/components/EditActionButton";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { formatNumber } from "@/lib/utils/numberFormat";

function formatDateTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function EggTransferTable() {
  const [items, setItems] = useState<EggTransferProcess[]>([]);
  const [sorting, setSorting] = useState<any>([]);
  const [columnFilters, setColumnFilters] = useState<any>([]);
  const [columnVisibility, setColumnVisibility] = useState<any>({});
  const [rowSelection, setRowSelection] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const router = useRouter();

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
      const data = await listEggTransfers();

      if (
        (data && !Array.isArray(data)) ||
        (Array.isArray(data) && data.length > 0 && "error" in (data as any)[0])
      ) {
        setItems([]);
      } else {
        setItems((Array.isArray(data) ? data : []) as EggTransferProcess[]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSessionx(router);
  }, []);
  useEffect(() => {
    (async () => {
      router.prefetch("/jmb/eggtransferv2/newv2");
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const columns: ColumnDef<EggTransferProcess>[] = [
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
          href={(id) => `/jmb/eggtransferv2/newv2?id=${id}`}
        />
      ),
    },
    {
      accessorKey: "ref_no",
      header: "Egg Reference No.",
    },
    // {
    //   accessorKey: "farm_source",
    //   header: "Farm Source",
    // },
    {
      accessorKey: "trans_date_start",
      header: "Transfer Start",
      cell: ({ row }) => formatDateTime(row.original.trans_date_start),
    },
    {
      accessorKey: "trans_date_end",
      header: "Transfer End",
      cell: ({ row }) => formatDateTime(row.original.trans_date_end),
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => fmtDurationHHMM(row.original.duration),
    },
    {
      accessorKey: "num_bangers",
      header: "No. of Bangers",
      cell: ({ getValue }) => formatNumber(getValue<number>()),
    },
    {
      accessorKey: "total_egg_transfer",
      header: "Total Egg Transfer",
      cell: ({ getValue }) => formatNumber(getValue<number>()),
    },
  ];

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="rounded-md p-4 mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        CurrentPageName="Egg Transfer"
        // CurrentPageName="New Entry"
      />
      <br />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Input
              placeholder="Filter Egg Reference No."
              className="pl-10"
              value={
                (table.getColumn("ref_no")?.getFilterValue() as string) ?? ""
              }
              onChange={(e) =>
                table.getColumn("ref_no")?.setFilterValue(e.target.value)
              }
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 w-full md:w-auto h-full md:h-auto"
          >
            <RefreshCw className="size-4" />
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <Button
          type="button"
          onClick={() => router.push("/jmb/eggtransferv2/newv2")}
          className="flex items-center gap-2 w-full md:w-auto h-full md:h-auto"
        >
          <Plus className="size-4" /> New Egg Transfer
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl  bg-white p-4">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="whitespace-nowrap wrap-break-word text-left align-middle"
                  >
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
            {table.getRowModel().rows.length ? (
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
                  {loading ? "Loading..." : "No results."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
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
    </div>
  );
}
