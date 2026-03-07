"use client";

import { useEffect, useState } from "react";
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
import { Search, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";

import { EggStorageMngt, listEggStorage, deleteEggStorage } from "./new/api";
import Breadcrumb from "@/lib/Breadcrumb";
import EditActionButton from "@/components/EditActionButton";

function fmtDuration(sec: number | null) {
  if (sec == null) return "";
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export default function EggTable() {
  const [items, setItems] = useState<EggStorageMngt[]>([]);
  const [sorting, setSorting] = useState<any>([]);
  const [columnFilters, setColumnFilters] = useState<any>([]);
  const [columnVisibility, setColumnVisibility] = useState<any>({});
  const [rowSelection, setRowSelection] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await listEggStorage();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    router.prefetch("/jmb/eggstorage/new");
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const columns: ColumnDef<EggStorageMngt>[] = [
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
          href={(id) => `/jmb/eggstorage/new?id=${id}`}
        />
      ),
    },
    {
      accessorKey: "classi_ref_no",
      header: "Egg Reference No.",
    },
    {
      accessorKey: "stor_temp",
      header: "Storage Temperature",
    },
    {
      accessorKey: "room_temp",
      header: "Room Temperature",
    },
    {
      accessorKey: "stor_humi",
      header: "Storage Humidity",
    },
    {
      accessorKey: "shell_start",
      header: "Shell Temp Start",
      cell: ({ row }) => {
        const v = row.original.shell_start;
        return v ? new Date(v).toLocaleString() : "";
      },
    },
    {
      accessorKey: "shell_end",
      header: "Shell Temp End",
      cell: ({ row }) => {
        const v = row.original.shell_end;
        return v ? new Date(v).toLocaleString() : "";
      },
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => fmtDuration(row.original.duration),
    },
    {
      accessorKey: "remarks",
      header: "Remarks",
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
        CurrentPageName="Egg Storage Management"
        FirstPreviewsPageName="Hatchery "
      />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Input
              placeholder="Filter Egg Reference No."
              className="pl-10"
              value={
                (table
                  .getColumn("classi_ref_no")
                  ?.getFilterValue() as string) ?? ""
              }
              onChange={(e) =>
                table.getColumn("classi_ref_no")?.setFilterValue(e.target.value)
              }
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="flex items-center gap-2 w-full md:w-auto h-full md:h-auto"
            onClick={fetchItems}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>

        <Button
          type="button"
          onClick={() => router.push("/jmb/eggstorage/new")}
          className="flex items-center gap-2 w-full md:w-auto h-full md:h-auto"
        >
          <Plus className="size-4" /> Egg Storage
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white p-4 overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="whitespace-normal wrap-break-word text-left align-middle"
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2 py-4">
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
  );
}
