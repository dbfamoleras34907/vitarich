"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type Table as TanStackTable,
  type VisibilityState,
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
import { MapPin, Plus, RefreshCw } from "lucide-react";

import Breadcrumb from "@/lib/Breadcrumb";
import {
  getReceivingList,
  listHatchClassification,
  type HatchForClassificationRow,
  type HatchClassificationRow,
} from "./new/api";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { formatNumber } from "@/lib/utils/numberFormat";
import { useGlobalContext } from "@/lib/context/GlobalContext";

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "amber" | "emerald";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-100 text-amber-800 before:bg-amber-500"
      : "bg-emerald-100 text-emerald-800 before:bg-emerald-500";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${toneClass} before:size-1.5 before:rounded-full before:content-['']`}
    >
      {label}
    </span>
  );
}

function BreederRefBadge({ value }: { value?: string | null }) {
  if (!value) return null;

  return (
    <span className="inline-flex max-w-48 rounded bg-sky-100 px-2 py-1 font-mono text-[11px] leading-tight text-sky-800">
      {value}
    </span>
  );
}

function CompactPagination<TData>({
  table,
  label,
}: {
  table: TanStackTable<TData>;
  label: string;
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
        {label === "classified"
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

export default function HatchTable() {
  const router = useRouter();

  const [items, setItems] = useState<HatchClassificationRow[]>([]);
  const [classifiedSorting, setClassifiedSorting] = useState<SortingState>([]);
  const [classifiedColumnFilters, setClassifiedColumnFilters] =
    useState<ColumnFiltersState>([]);
  const [classifiedColumnVisibility, setClassifiedColumnVisibility] =
    useState<VisibilityState>({});
  const [classifiedRowSelection, setClassifiedRowSelection] =
    useState<RowSelectionState>({});
  const [pendingSorting, setPendingSorting] = useState<SortingState>([]);
  const [pendingColumnFilters, setPendingColumnFilters] =
    useState<ColumnFiltersState>([]);
  const [pendingColumnVisibility, setPendingColumnVisibility] =
    useState<VisibilityState>({});
  const [pendingRowSelection, setPendingRowSelection] =
    useState<RowSelectionState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingforClass, setIsLoadingforClass] = useState(false);
  const [itemsForClass, setItemsForClass] = useState<
    HatchForClassificationRow[]
  >([]);
  const { setValue } = useGlobalContext();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listHatchClassification(50);
      // console.log(data);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);
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
    } catch (e) {
      console.error(e);
      setItemsForClass([]);
    } finally {
      setIsLoadingforClass(false);
    }
  }, []);

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);
  useEffect(() => {
    router.prefetch("/jmb/hatcheryclassi/new");
    loadForClassification();
  }, [router, loadForClassification]);

  const refreshTables = useCallback(async () => {
    await Promise.all([load(), loadForClassification()]);
  }, [load, loadForClassification]);

  // For Classification

  const columnsForClass = useMemo<ColumnDef<HatchForClassificationRow>[]>(
    () => [
      {
        id: "row_no",
        header: "#",
        cell: ({ row, table }) =>
          table.getState().pagination.pageIndex *
            table.getState().pagination.pageSize +
          row.index +
          1,
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
        cell: ({ row }) => (
          <span className="font-semibold text-stone-900">
            {row.original.dr_num ?? ""}
          </span>
        ),
      },
      {
        accessorKey: "brdr_ref_no",
        header: "Breeder Ref. No.",
        cell: ({ row }) => (
          <span className="font-semibold">
            <BreederRefBadge value={row.original.brdr_ref_no} />
          </span>
        ),
      },
      {
        accessorKey: "actual_count",
        header: "Eggs Received",
        cell: ({ getValue }) => (
          <span className="font-semibold text-stone-900">
            {formatNumber(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "farm_name",
        header: "Shipped To",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 leading-tight">
            <MapPin className="size-3.5 shrink-0 text-stone-500" />
            {row.original.farm_name ?? ""}
          </span>
        ),
      },
      { accessorKey: "plate_no", header: "Plate No" },
      { accessorKey: "driver", header: "Driver" },
      { accessorKey: "voyage_no", header: "Voyage No" },
      { accessorKey: "shipped_via", header: "Shipped Via" },
    ],
    [],
  );

  const tableForClass = useReactTable({
    data: itemsForClass,
    columns: columnsForClass,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setPendingSorting,
    onColumnFiltersChange: setPendingColumnFilters,
    onColumnVisibilityChange: setPendingColumnVisibility,
    onRowSelectionChange: setPendingRowSelection,
    state: {
      sorting: pendingSorting,
      columnFilters: pendingColumnFilters,
      columnVisibility: pendingColumnVisibility,
      rowSelection: pendingRowSelection,
    },
  });
  // For Classification
  const columns = useMemo<ColumnDef<HatchClassificationRow>[]>(
    () => [
      {
        id: "row_no",
        header: "#",
        cell: ({ row, table }) =>
          table.getState().pagination.pageIndex *
            table.getState().pagination.pageSize +
          row.index +
          1,
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
        header: "Date",
        cell: ({ row }) => row.original.date_classify ?? "",
      },
      {
        accessorKey: "br_no",
        header: "Breeder Ref. No.",
        cell: ({ row }) => <BreederRefBadge value={row.original.br_no} />,
      },
      {
        accessorKey: "good_egg",
        header: "Hatching",
        cell: ({ getValue }) => (
          <span className="font-semibold text-teal-700">
            {formatNumber(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "trans_crack",
        header: "Transport Crack",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
      },
      {
        accessorKey: "hatc_crack",
        header: "Hatch Crack",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
      },
      {
        accessorKey: "trans_condemn",
        header: "Transport Condemn",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
      },
      {
        accessorKey: "hatc_condemn",
        header: "Hatch Condemn",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
      },
      { accessorKey: "thin_shell", header: "Thin Shell" },
      { accessorKey: "pee_wee", header: "Pee Wee" },
      { accessorKey: "small", header: "Small" },
      { accessorKey: "jumbo", header: "Jumbo" },
      { accessorKey: "d_yolk", header: "Double Yolk" },
      { accessorKey: "misshapen", header: "Misshapen" },
      { accessorKey: "leakers", header: "Leakers" },
      { accessorKey: "dirties", header: "Dirties" },
      { accessorKey: "hairline", header: "Hairline" },
      {
        accessorKey: "ttl_count",
        header: "Total Count",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setClassifiedSorting,
    onColumnFiltersChange: setClassifiedColumnFilters,
    onColumnVisibilityChange: setClassifiedColumnVisibility,
    onRowSelectionChange: setClassifiedRowSelection,
    state: {
      sorting: classifiedSorting,
      columnFilters: classifiedColumnFilters,
      columnVisibility: classifiedColumnVisibility,
      rowSelection: classifiedRowSelection,
    },
  });

  useEffect(() => {
    setValue("loading_g", isLoadingforClass || isLoading);
  }, [isLoadingforClass, isLoading, setValue]);

  return (
    <div className="space-y-4 p-4">
      <Breadcrumb
        FirstPreviewsPageName="Hatchery"
        CurrentPageName="Egg Classification"
      />

      {/* Top Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={refreshTables}
          disabled={isLoading || isLoadingforClass}
          className="flex items-center gap-2 rounded-md bg-white"
        >
          <RefreshCw
            className={`size-4 ${
              isLoading || isLoadingforClass ? "animate-spin" : ""
            }`}
          />
          Refresh
        </Button>
        <Button
          type="button"
          onClick={() => router.push("/jmb/hatcheryclassi/new")}
          className="flex items-center gap-2 rounded-md"
        >
          <Plus className="size-4" />
          New Classification
        </Button>
      </div>

      {/* Table 1  Pending for Classification */}
      <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-stone-200 bg-white px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <StatusPill label="Pending Classification" tone="amber" />
            <Input
              placeholder="Filter Breeder Ref. No."
              className="h-9 w-full rounded-md border-stone-300 bg-white sm:w-72"
              value={
                (tableForClass
                  .getColumn("brdr_ref_no")
                  ?.getFilterValue() as string) ?? ""
              }
              onChange={(e) =>
                tableForClass
                  .getColumn("brdr_ref_no")
                  ?.setFilterValue(e.target.value)
              }
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[920px] text-xs">
            <TableHeader className="bg-stone-100">
              {tableForClass.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="border-stone-200">
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-9 whitespace-nowrap px-3 text-left align-middle text-[11px] font-semibold uppercase text-stone-700"
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
                  <TableCell
                    colSpan={columnsForClass.length}
                    className="h-24 text-center"
                  >
                    {isLoadingforClass ? "Loading..." : "No results."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <CompactPagination table={tableForClass} label="pending" />
      </section>

      {/* Table 2  Classified Eggs */}

      <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-stone-200 bg-white px-3 py-3 sm:flex-row sm:items-center">
          <StatusPill label="Classified Eggs" tone="emerald" />
          <Input
            placeholder="Filter Breeder Ref. No."
            className="h-9 w-full rounded-md border-stone-300 bg-white sm:w-72"
            value={(table.getColumn("br_no")?.getFilterValue() as string) ?? ""}
            onChange={(e) =>
              table.getColumn("br_no")?.setFilterValue(e.target.value)
            }
          />
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1120px] text-xs">
            <TableHeader className="bg-stone-100">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="border-stone-200">
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-9 whitespace-nowrap px-3 text-left align-middle text-[11px] font-semibold uppercase text-stone-700"
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
        <CompactPagination table={table} label="classified" />
      </section>
    </div>
  );
}
