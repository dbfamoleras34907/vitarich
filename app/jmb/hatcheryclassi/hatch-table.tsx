"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Map,
  Copy,
  View,
  ClipboardCopy,
  MoreHorizontal,
  MapPin,
} from "lucide-react";

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
import { db } from "@/lib/Supabase/supabaseClient";
import { RowDataKey } from "@/lib/Defaults/DefaultTypes";
import DynamicTable from "@/components/ui/DataTableV2";
import { usePermission } from "@/hooks/usePermission";
import { RowAction } from "@/lib/types";
import { toast } from "sonner";
import { copyRow, copyTable } from "@/lib/tableActions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const params = useParams();
  const router = useRouter();

  const canInsert = usePermission("/jmb/hatcheryclassi/insert");
  const canView = usePermission("/jmb/hatcheryclassi/view");
  // useEffect(() => {
  //   if (canInsert)
  //     router.push("/jmb/hatcheryclassi/")
  // }, [])

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

  const getRowActions = (row: RowDataKey): RowAction[] => {
    return [
      {
        label: "View",
        icon: <View className="w-4 h-4" />,
        disabled: canView,
        onClick: () => {
          router.push(`/jmb/hatcheryclassi/view/${row.id}`);
        },
      },
      {
        label: "Copy Row",
        icon: <Copy className="w-4 h-4" />,
        onClick: () => {
          copyRow(row);
        },
      },

      {
        label: "Copy Table",
        icon: <ClipboardCopy className="w-4 h-4" />,
        onClick: () => {
          copyTable(itemsForClass as RowDataKey[]);
        },
      },
    ];
  };

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

      {
        id: "view",
        header: "View",
        // cell: ({ row }) => row.original.date_classify ?? "",
      },
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
