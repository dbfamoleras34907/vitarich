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
  type HatchClassificationListRow,
} from "./new/api";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { attachProcessListAttributions } from "@/lib/data/repositories/processListAttribution";
import { formatNumber } from "@/lib/utils/numberFormat";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  listAssignedUserFarmOptions,
  type AssignedFarmOption,
} from "@/lib/data/repositories/farmOptions.client";
import HatcheryListParameters, { useHatcheryListParameters } from "@/components/hatchery/HatcheryListParameters";

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function buildDefaultFarmFilter(columnId: string, defaultFarmId: unknown): ColumnFiltersState {
  if (!hasValue(defaultFarmId)) {
    return [];
  }

  return [{ id: columnId, value: String(defaultFarmId) }];
}

function withAssignedDefaultFarmFilter(
  filters: ColumnFiltersState,
  columnId: string,
  defaultFarmId: unknown,
  assignedFarms: AssignedFarmOption[],
): ColumnFiltersState {
  const otherFilters = filters.filter((filter) => filter.id !== columnId);
  const defaultValue = String(defaultFarmId ?? "");
  const preferredFarmId = assignedFarms.find(
    (farm) => String(farm.id) === defaultValue || farm.code === defaultValue,
  )?.id ?? null;

  if (preferredFarmId === null) return otherFilters;

  return [
    ...otherFilters,
    { id: columnId, value: String(preferredFarmId) },
  ];
}

function numericFarmId(value: unknown) {
  const farmId = Number(value);
  return Number.isInteger(farmId) && farmId > 0 ? farmId : null;
}

function loadErrorMessage(error: unknown, label: string) {
  const message = error instanceof Error ? error.message : "";
  return message ? `Unable to load ${label}: ${message}` : `Unable to load ${label}.`;
}

export default function HatchTable() {
  const router = useRouter();
  const { getValue, setValue } = useGlobalContext();
  const sessionUserId = getValue("UserInfoAuthSession")?.[0]?.id ?? null;
  const parameters = useHatcheryListParameters();
  const defaultFarmId = parameters.farmId;
  const [items, setItems] = useState<HatchClassificationListRow[]>([]);
  const [classifiedSorting, setClassifiedSorting] = useState<SortingState>([]);
  const [assignedFarms, setAssignedFarms] = useState<AssignedFarmOption[]>([]);
  const [assignedFarmsLoading, setAssignedFarmsLoading] = useState(true);
  const [classifiedColumnFilters, setClassifiedColumnFilters] =
    useState<ColumnFiltersState>(() =>
      buildDefaultFarmFilter("farm_id", defaultFarmId),
    );
  const [classifiedColumnVisibility, setClassifiedColumnVisibility] =
    useState<VisibilityState>({ farm_id: false });
  const [classifiedRowSelection, setClassifiedRowSelection] =
    useState<RowSelectionState>({});
  const [classifiedSectionOpen, setClassifiedSectionOpen] = useState(true);
  const [pendingSorting, setPendingSorting] = useState<SortingState>([]);
  const [pendingColumnFilters, setPendingColumnFilters] =
    useState<ColumnFiltersState>(() =>
      buildDefaultFarmFilter("farm_id", defaultFarmId),
    );
  const [pendingColumnVisibility, setPendingColumnVisibility] =
    useState<VisibilityState>({ farm_id: false });
  const [pendingRowSelection, setPendingRowSelection] =
    useState<RowSelectionState>({});
  const [pendingSectionOpen, setPendingSectionOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingforClass, setIsLoadingforClass] = useState(false);
  const [classifiedLoadError, setClassifiedLoadError] = useState<string | null>(null);
  const [pendingLoadError, setPendingLoadError] = useState<string | null>(null);
  const [itemsForClass, setItemsForClass] = useState<
    HatchForClassificationRow[]
  >([]);

  const assignedFarmIds = useMemo(
    () => assignedFarms.map((farm) => farm.id),
    [assignedFarms],
  );

  const effectivePendingColumnFilters = useMemo(
    () =>
      withAssignedDefaultFarmFilter(
        pendingColumnFilters,
        "farm_id",
        defaultFarmId,
        assignedFarms,
      ),
    [assignedFarms, defaultFarmId, pendingColumnFilters],
  );

  const pendingFarmIdsForQuery = useMemo(() => {
    const selectedFarmId = numericFarmId(
      effectivePendingColumnFilters.find((filter) => filter.id === "farm_id")
        ?.value,
    );
    if (selectedFarmId !== null && assignedFarmIds.includes(selectedFarmId)) {
      return [selectedFarmId];
    }
    return assignedFarmIds;
  }, [assignedFarmIds, effectivePendingColumnFilters]);

  const effectiveClassifiedColumnFilters = useMemo(
    () =>
      withAssignedDefaultFarmFilter(
        classifiedColumnFilters,
        "farm_id",
        defaultFarmId,
        assignedFarms,
      ),
    [assignedFarms, classifiedColumnFilters, defaultFarmId],
  );

  const classifiedFarmIdsForQuery = useMemo(() => {
    const selectedFarmId = numericFarmId(
      effectiveClassifiedColumnFilters.find((filter) => filter.id === "farm_id")
        ?.value,
    );
    if (selectedFarmId !== null && assignedFarmIds.includes(selectedFarmId)) {
      return [selectedFarmId];
    }
    return assignedFarmIds;
  }, [assignedFarmIds, effectiveClassifiedColumnFilters]);

  const load = useCallback(async () => {
    if (assignedFarmsLoading || !classifiedFarmIdsForQuery.length) {
      setItems([]);
      setClassifiedLoadError(null);
      setIsLoading(assignedFarmsLoading);
      return;
    }

    setIsLoading(true);
    setClassifiedLoadError(null);
    try {
      const data = await listHatchClassification({
        farmIds: classifiedFarmIdsForQuery,
        limit: 50,
        dateFrom: parameters.dateFrom,
        dateTo: parameters.dateTo,
      });
      setItems(Array.isArray(data) ? await attachProcessListAttributions(data) : []);
    } catch (e) {
      console.error(e);
      setItems([]);
      setClassifiedLoadError(loadErrorMessage(e, "classified eggs"));
    } finally {
      setIsLoading(false);
    }
  }, [assignedFarmsLoading, classifiedFarmIdsForQuery, parameters.dateFrom, parameters.dateTo]);

  useEffect(() => {
    let cancelled = false;
    setAssignedFarmsLoading(true);

    void listAssignedUserFarmOptions(["HA", "Hatchery"])
      .then((farms) => {
        if (cancelled) return;
        setAssignedFarms(farms);
      })
      .catch((error) => {
        console.error("Unable to load assigned farms:", error);
        if (!cancelled) setAssignedFarms([]);
      })
      .finally(() => {
        if (!cancelled) setAssignedFarmsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);
  useEffect(() => {
    router.prefetch("/jmb/hatcheryclassi/new");
    load();
  }, [router, load]);

  //  load For Classification
  const loadForClassification = useCallback(async () => {
    if (assignedFarmsLoading || !pendingFarmIdsForQuery.length) {
      setItemsForClass([]);
      setPendingLoadError(null);
      setIsLoadingforClass(assignedFarmsLoading);
      return;
    }

    setIsLoadingforClass(true);
    setPendingLoadError(null);
    try {
      const data = await getReceivingList({
        farmIds: pendingFarmIdsForQuery,
        limit: 50,
        dateFrom: parameters.dateFrom,
        dateTo: parameters.dateTo,
      });
      setItemsForClass(Array.isArray(data) ? await attachProcessListAttributions(data) : []);
    } catch (e) {
      console.error(e);
      setItemsForClass([]);
      setPendingLoadError(loadErrorMessage(e, "pending classification records"));
    } finally {
      setIsLoadingforClass(false);
    }
  }, [assignedFarmsLoading, parameters.dateFrom, parameters.dateTo, pendingFarmIdsForQuery]);

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

      // {
      //   accessorKey: "farm_id",
      //   header: "Delivered To - Code",
      //   cell: ({ row }) => (
      //     <span>{row.original.farm_id ?? ""}</span>
      //   ),
      // },

      {
        accessorKey: "farm_name",
        header: "Delivered To",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 leading-tight">
            <MapPin className="size-3.5 shrink-0 text-stone-500" />
            {row.original.farm_id ?? ""} -  {row.original.farm_name ?? ""}
          </span>
        ),
      },
      {
        accessorKey: "farm_id",
        header: "Farm ID",
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue) return true;
          return String(row.getValue(columnId) ?? "") === String(filterValue);
        },
      },
      { accessorKey: "plate_no", header: "Plate No" },
      { accessorKey: "driver", header: "Driver" },
      { accessorKey: "voyage_no", header: "Voyage No" },
      { accessorKey: "shipped_via", header: "Shipped Via" },
      { accessorKey: "createdByName", header: "Created by" },
      { accessorKey: "assignedTaLabel", header: "Assigned TA", cell: ({ row }) => <span className="block max-w-40 truncate" title={row.original.assignedTaLabel}>{row.original.assignedTaLabel}</span> },
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
      columnFilters: effectivePendingColumnFilters,
      columnVisibility: pendingColumnVisibility,
      rowSelection: pendingRowSelection,
    },
  });
  // For Classification
  const columns = useMemo<ColumnDef<HatchClassificationListRow>[]>(
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
        accessorKey: "farm_id",
        header: "Farm ID",
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue) return true;
          return String(row.getValue(columnId) ?? "") === String(filterValue);
        },
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
      { accessorKey: "createdByName", header: "Created by" },
      { accessorKey: "assignedTaLabel", header: "Assigned TA", cell: ({ row }) => <span className="block max-w-40 truncate" title={row.original.assignedTaLabel}>{row.original.assignedTaLabel}</span> },
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
      columnFilters: effectiveClassifiedColumnFilters,
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
            className={`size-4 ${isLoading || isLoadingforClass ? "animate-spin" : ""
              }`}
          />
          Refresh
        </Button>
        {/* <Button onClick={() => console.log({ items })}>check items</Button> */}
      </div>

      <HatcheryListParameters {...parameters} />

      <ClassificationTableSection
        table={tableForClass}
        title="Pending Classification"
        tone="amber"
        isLoading={isLoadingforClass}
        error={pendingLoadError}
        colSpan={columnsForClass.length}
        contentOpen={pendingSectionOpen}
        onContentOpenChange={setPendingSectionOpen}
        headerActions={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
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
        }
      />

      <ClassificationTableSection
        table={table}
        title="Classified Eggs"
        tone="emerald"
        isLoading={isLoading}
        error={classifiedLoadError}
        colSpan={columns.length}
        paginationMode="showing-rows"
        contentOpen={classifiedSectionOpen}
        onContentOpenChange={setClassifiedSectionOpen}
        headerActions={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <Input
              placeholder="Filter Breeder Ref. No."
              className="h-9 w-full rounded-md border-stone-300 bg-white sm:w-72"
              value={(table.getColumn("br_no")?.getFilterValue() as string) ?? ""}
              onChange={(e) =>
                table.getColumn("br_no")?.setFilterValue(e.target.value)
              }
            />

          </div>
        }
      />
    </div>
  );
}
