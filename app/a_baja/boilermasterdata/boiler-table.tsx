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
import { Search, Plus, RefreshCw } from "lucide-react";

import Breadcrumb from "@/lib/Breadcrumb";
import EditActionButton from "@/components/EditActionButton";

import { BoilerMasterdata, listBoilerMasterdata } from "./new/api";

export default function BoilerTable() {
  const [items, setItems] = useState<BoilerMasterdata[]>([]);
  const [sorting, setSorting] = useState<any>([]);
  const [columnFilters, setColumnFilters] = useState<any>([]);
  const [columnVisibility, setColumnVisibility] = useState<any>({});
  const [rowSelection, setRowSelection] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await listBoilerMasterdata();
      setItems((Array.isArray(data) ? data : []) as BoilerMasterdata[]);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      router.prefetch("/a_baja/boilermasterdata/new");
      await fetchData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: ColumnDef<BoilerMasterdata>[] = [
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
          href={(id) => `/a_baja/boilermasterdata/new?id=${id}`}
        />
      ),
    },
    {
      accessorKey: "boiler_name",
      header: "Boiler Name",
    },
    {
      accessorKey: "assigned_ta",
      header: "Assigned TA",
      cell: ({ row }) => row.original.assigned_ta ?? "",
    },
    {
      accessorKey: "region",
      header: "Region",
      cell: ({ row }) => row.original.region ?? "",
    },
    {
      accessorKey: "address",
      header: "Address",
      cell: ({ row }) => row.original.address ?? "",
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
    initialState: {
      pagination: { pageSize: 15 },
    },
  });

  return (
    <div className="rounded-md p-4 mt-4">
      {/* Top Controls */}
      <Breadcrumb
        SecondPreviewPageName="Master Data"
        CurrentPageName="Boiler List"
      />
      <br />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Input
              placeholder="Filter Boiler Name"
              className="pl-10"
              value={
                (table.getColumn("boiler_name")?.getFilterValue() as string) ??
                ""
              }
              onChange={(e) =>
                table.getColumn("boiler_name")?.setFilterValue(e.target.value)
              }
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 w-full md:w-auto h-full md:h-auto"
          >
            <RefreshCw className="size-4" />
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <Button
          type="button"
          onClick={() => router.push("/a_baja/boilermasterdata/new")}
          className="flex items-center gap-2 w-full md:w-auto h-full md:h-auto"
        >
          <Plus className="size-4" />
          New Record
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl p-4 bg-white">
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
