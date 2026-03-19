"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Plus, RefreshCw, Search, Pencil } from "lucide-react";

import Breadcrumb from "@/lib/Breadcrumb";
import {
  getReceivingList,
  HatchForClassificationRow,
  listHatchClassification,
  type HatchClassificationRow,
} from "./new/api";
import EditActionButton from "@/components/EditActionButton";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { formatNumber } from "@/lib/utils/numberFormat";

export default function HatchTable() {
  const router = useRouter();

  const [items, setItems] = useState<HatchClassificationRow[]>([]);
  const [sorting, setSorting] = useState<any>([]);
  const [columnFilters, setColumnFilters] = useState<any>([]);
  const [columnVisibility, setColumnVisibility] = useState<any>({});
  const [rowSelection, setRowSelection] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingforClass, setIsLoadingforClass] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [lastUpdatedForClass, setLastUpdatedForClass] = useState<string>("");
  const [itemsForClass, setItemsForClass] = useState<
    HatchForClassificationRow[]
  >([]);
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listHatchClassification(50);
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
    refreshSessionx(router);
  }, []);
  useEffect(() => {
    router.prefetch("/jmb/hatcheryclassi/new");
    load();
  }, [router, load]);

  //  load For Classification
  const loadForClassification = useCallback(async () => {
    setIsLoadingforClass(true);
    try {
      const data = await getReceivingList(50);
      setItemsForClass(Array.isArray(data) ? data : []);
      setLastUpdatedForClass(new Date().toLocaleString());
    } catch (e) {
      console.error(e);
      setItemsForClass([]);
    } finally {
      setIsLoadingforClass(false);
    }
  }, []);

  useEffect(() => {
    refreshSessionx(router);
  }, []);
  useEffect(() => {
    router.prefetch("/jmb/hatcheryclassi/new");
    loadForClassification();
  }, [router, loadForClassification]);

  // For Classification

  const columnsForClass = useMemo<ColumnDef<HatchForClassificationRow>[]>(
    () => [
      {
        id: "row_no",
        header: "#",
        cell: ({ row }) => row.index + 1,
      },
      // {
      //   id: "action",
      //   header: "Action",
      //   cell: ({ row }) => (
      //     <div className="flex items-center gap-2">
      //       <EditActionButton
      //         id={row.original?.id}
      //         href={(id) => `/jmb/hatcheryclassi/new?id=${id}`}
      //       />
      //     </div>
      //   ),
      // },
      {
        accessorKey: "dr_num",
        header: "DR #",
        cell: ({ row }) => row.original.dr_num ?? "",
      },
      {
        accessorKey: "brdr_ref_no",
        header: "Breeder Ref. No.",
        cell: ({ row }) => row.original.brdr_ref_no ?? "",
      },
      {
        accessorKey: "actual_count",
        header: "Total Egg",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
      },
      { accessorKey: "soldTo", header: "Sold To" },
      { accessorKey: "voyage_no", header: "Voyage No" },
      { accessorKey: "shipped_via", header: "Shipped Via" },
      { accessorKey: "plate_no", header: "Plate No" },
      { accessorKey: "driver", header: "Driver" },
    ],
    [router],
  );

  const tableForClass = useReactTable({
    data: itemsForClass,
    columns: columnsForClass,
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
  // For Classification
  const columns = useMemo<ColumnDef<HatchClassificationRow>[]>(
    () => [
      {
        id: "row_no",
        header: "#",
        cell: ({ row }) => row.index + 1,
      },
      // {
      //   id: "action",
      //   header: "Action",
      //   cell: ({ row }) => (
      //     <div className="flex items-center gap-2">
      //       <EditActionButton
      //         id={row.original?.id}
      //         href={(id) => `/jmb/hatcheryclassi/new?id=${id}`}
      //       />
      //     </div>
      //   ),
      // },
      {
        accessorKey: "date_classify",
        header: "Date Classified",
        cell: ({ row }) => row.original.date_classify ?? "",
      },
      {
        accessorKey: "br_no",
        header: "Breeder Ref. No.",
        cell: ({ row }) => row.original.br_no ?? "",
      },
      {
        accessorKey: "good_egg",
        header: "Hatching Egg",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
      },
      { accessorKey: "trans_crack", header: "Transport Crack" },
      { accessorKey: "hatc_crack", header: "Hatch Crack" },
      { accessorKey: "trans_condemn", header: "Transport Condemn" },
      { accessorKey: "hatc_condemn", header: "Hatch Condemn" },
      { accessorKey: "thin_shell", header: "Thin Shell" },
      { accessorKey: "pee_wee", header: "Pee Wee" },
      { accessorKey: "small", header: "Small" },
      { accessorKey: "jumbo", header: "Jumbo" },
      { accessorKey: "d_yolk", header: "Double Yolk" },
      { accessorKey: "misshapen", header: "Misshapen" },
      { accessorKey: "leakers", header: "Leakers" },
      { accessorKey: "dirties", header: "Dirties" },
      {
        accessorKey: "ttl_count",
        header: "Total Count",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
      },
    ],
    [router],
  );

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
    <div className="rounded-md p-4">
      <br />
      <Breadcrumb
        FirstPreviewsPageName="Hatchery"
        CurrentPageName="Egg Classification"
      />

      {/* Top Controls */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Input
              placeholder="Filter Breeder Ref. No."
              className="pl-10"
              value={
                (table.getColumn("br_no")?.getFilterValue() as string) ?? ""
              }
              onChange={(e) =>
                table.getColumn("br_no")?.setFilterValue(e.target.value)
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
          onClick={() => router.push("/jmb/hatcheryclassi/new")}
          className="flex items-center gap-2 w-full md:w-auto h-full md:h-auto"
        >
          <Plus className="size-4" />
          New Classification
        </Button>
      </div>

      {/* Table 1  Pending for Classification */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold mx-4  bg-blue-400 text-white px-2 py-1 rounded">
          Pending Classification
        </h2>
      </div>

      <div className="rounded-md border p-4 bg-white">
        <Table>
          <TableHeader>
            {tableForClass.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="whitespace-nowrap text-left align-middle"
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
            {tableForClass.getRowModel().rows.length ? (
              tableForClass.getRowModel().rows.map((row) => (
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
                  {isLoadingforClass ? "Loading..." : "No results."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination 1 Pending for Classification  */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Page {tableForClass.getState().pagination.pageIndex + 1} of{" "}
          {tableForClass.getPageCount()}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => tableForClass.previousPage()}
            disabled={!tableForClass.getCanPreviousPage()}
          >
            Previous
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => tableForClass.nextPage()}
            disabled={!tableForClass.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Table 2  Classified Eggs */}

      <div className="flex items-center justify-between mb-2 mt-2">
        <h2 className="text-lg font-semibold mx-4 bg-green-400 text-white px-2 py-1 rounded">
          Classified Eggs
        </h2>
      </div>
      <div className="rounded-md border p-4 bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="whitespace-nowrap text-left align-middle"
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
                  {isLoading ? "Loading..." : "No results."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination 2  Classified Eggs */}
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
            Previous
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
