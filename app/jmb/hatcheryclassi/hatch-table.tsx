"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, RefreshCw, Tag } from "lucide-react";

import Breadcrumb from "@/lib/Breadcrumb";
import {
  ClassificationRefBadge,
  ClassificationTableSection,
} from "@/components/classification/ClassificationTable";
import {
  getReceivingList,
  listHatchClassification,
  type HatchForClassificationRow,
  type HatchClassificationRow,
} from "./new/api";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { formatNumber } from "@/lib/utils/numberFormat";
import { useGlobalContext } from "@/lib/context/GlobalContext";

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
        enableSorting: false,
        cell: ({ row, table }) =>
          table.getState().pagination.pageIndex *
            table.getState().pagination.pageSize +
          row.index +
          1,
      },
      {
        id: "action",
        header: "Action",
        enableSorting: false,
        cell: ({ row }) => {
          const breederRef = row.original.brdr_ref_no ?? "";

          return (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 rounded-md bg-amber-100 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-200 hover:text-amber-950"
              onClick={() =>
                router.push(
                  `/jmb/hatcheryclassi/new?br_no=${encodeURIComponent(
                    breederRef,
                  )}`,
                )
              }
              disabled={!breederRef}
            >
              <Tag className="size-3.5" />
              Classify
            </Button>
          );
        },
      },
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
            <ClassificationRefBadge value={row.original.brdr_ref_no} />
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
    [router],
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
        enableSorting: false,
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
        cell: ({ row }) => (
          <ClassificationRefBadge value={row.original.br_no} />
        ),
      },
      {
        accessorKey: "good_egg",
        header: "Hatching Eggs",
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
      </div>

      <ClassificationTableSection
        table={tableForClass}
        title="Pending Classification"
        tone="amber"
        isLoading={isLoadingforClass}
        colSpan={columnsForClass.length}
        headerActions={
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
        }
      />

      <ClassificationTableSection
        table={table}
        title="Classified Eggs"
        tone="emerald"
        isLoading={isLoading}
        colSpan={columns.length}
        paginationMode="showing-rows"
        headerActions={
          <Input
            placeholder="Filter Breeder Ref. No."
            className="h-9 w-full rounded-md border-stone-300 bg-white sm:w-72"
            value={(table.getColumn("br_no")?.getFilterValue() as string) ?? ""}
            onChange={(e) =>
              table.getColumn("br_no")?.setFilterValue(e.target.value)
            }
          />
        }
      />
    </div>
  );
}
