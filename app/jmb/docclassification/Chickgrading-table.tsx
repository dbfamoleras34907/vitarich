"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";
import {
  type ColumnDef,
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

import Breadcrumb from "@/lib/Breadcrumb";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  ClipboardCopy,
  Copy,
  FileSearch,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";

import {
  ChickGradingProcess,
  listChickGradingProcess,
} from "./newv2/api";

import { refreshSessionx } from "@/app/admin/user/RefreshSession";

import {
  ClassificationRefBadge,
  ClassificationTableSection,
} from "@/components/classification/ClassificationTable";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { RowDataKey } from "@/lib/Defaults/DefaultTypes";
import { RowAction } from "@/lib/types";

import { copyRow, copyTable } from "@/lib/tableActions";

import { usePermission } from "@/hooks/usePermission";
import { getErrorMessage } from "@/lib/errorMessage";

import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  FARM_FILTER_KEY,
} from "@/lib/farmFilter";
import HatcheryListParameters, { isWithinHatcheryDateRange, useHatcheryListParameters } from "@/components/hatchery/HatcheryListParameters";

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function buildDefaultFarmColumnFilter(defaultFarmId: unknown): ColumnFiltersState {
  if (!hasValue(defaultFarmId)) return [];

  return [{ id: FARM_FILTER_KEY, value: String(defaultFarmId) }];
}

function withDefaultFarmColumnFilter(
  filters: ColumnFiltersState,
  defaultFarmId: unknown,
): ColumnFiltersState {
  if (!hasValue(defaultFarmId)) {
    return filters.filter((filter) => filter.id !== FARM_FILTER_KEY);
  }

  return [
    ...filters.filter((filter) => filter.id !== FARM_FILTER_KEY),
    { id: FARM_FILTER_KEY, value: String(defaultFarmId) },
  ];
}

function fmtDateTime(
  v: string | null | undefined,
) {
  if (!v) return "-";

  const d = new Date(v);

  if (Number.isNaN(d.getTime())) return "-";

  const pad = (n: number) =>
    String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(
    d.getMonth() + 1,
  )}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

type DocClassificationRow = RowDataKey & {
  id: number;
  egg_ref_no: string;
  batch_code: string;
  grading_datetime: string;
  total_chicks: number;
  good_quality_chicks: number;
  quality_grade_rate: string;
  cull_rate: string;
  grading_personnel: string;
  [FARM_FILTER_KEY]?: string;
};

export default function ChickgradingTable() {
  const router = useRouter();

  const [items, setItems] = useState<DocClassificationRow[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const { setValue } = useGlobalContext();
  const parameters = useHatcheryListParameters();
  const defaultFarmId = parameters.farmId;
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() =>
    buildDefaultFarmColumnFilter(defaultFarmId),
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    [FARM_FILTER_KEY]: false,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [isLoading, setIsLoading] =
    useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const effectiveColumnFilters = useMemo(
    () =>
      withDefaultFarmColumnFilter(
        columnFilters,
        defaultFarmId,
      ),
    [columnFilters, defaultFarmId],
  );

  const canView = usePermission(
    "/jmb/docclassification/view",
  );

  const canInsert = usePermission(
    "/jmb/docclassification/insert",
  );

  const canEdit = usePermission(
    "/jmb/docclassification/edit",
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const data =
        await listChickGradingProcess();

      const mapped =
        Array.isArray(data)
          ? data.filter(item => isWithinHatcheryDateRange(item.grading_datetime, parameters.dateFrom, parameters.dateTo)).map(
            (
              item: ChickGradingProcess,
            ) => ({
              id: Number(item.id),

              [FARM_FILTER_KEY]:
                item.farm_id == null
                  ? ""
                  : String(item.farm_id),
                  
              egg_ref_no:
                item.egg_ref_no || "-",

              batch_code:
                item.batch_code || "-",

              grading_datetime:
                fmtDateTime(
                  item.grading_datetime,
                ),

              total_chicks:
                Number(
                  item.total_egg_set || 0,
                ),

              good_quality_chicks:
                Number(
                  item.good_quality_chicks ||
                  0,
                ),

              quality_grade_rate:
                item.quality_grade_rate === null ||
                  item.quality_grade_rate === undefined
                  ? "-"
                  : String(item.quality_grade_rate),

              cull_rate:
                item.cull_rate === null ||
                  item.cull_rate === undefined
                  ? "-"
                  : String(item.cull_rate),

              grading_personnel:
                item.grading_personnel ||
                "-",
            }),
          )
          : [];

      setItems(mapped);
    } catch (e) {
      console.error(e);

      setItems([]);
      setLoadError(getErrorMessage(e, "Unable to load DOC Classification."));
    } finally {
      setIsLoading(false);
    }
  }, [parameters.dateFrom, parameters.dateTo]);

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    router.prefetch(
      "/jmb/docclassification/newv2",
    );

    load();
  }, [router, load]);

  useEffect(() => {
    setValue("loading_g", isLoading);
  }, [isLoading, setValue]);

  const getRowActions = useCallback((
    row: DocClassificationRow,
  ): RowAction[] => {
    return [
      {
        label: "View",

        icon: <FileSearch className="w-4 h-4" />,

        disabled: canView,

        onClick: () => {
          router.push(
            `/jmb/docclassification/view/${row.id}`,
          );
        },
      },

      {
        label: "Edit",

        disabled: canEdit,

        icon: <Pencil className="w-4 h-4" />,

        onClick: () => {
          router.push(
            `/jmb/docclassification/newv2?id=${row.id}`,
          );
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

        icon: (
          <ClipboardCopy className="w-4 h-4" />
        ),

        onClick: () => {
          copyTable(items);
        },
      },
    ];
  }, [canEdit, canView, items, router]);

  const columns = useMemo<ColumnDef<DocClassificationRow>[]>(
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
          const actions = getRowActions(row.original);

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-md bg-white px-2"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                {actions.map((action, index) => (
                  <DropdownMenuItem
                    key={index}
                    disabled={action.disabled}
                    onClick={() => action.onClick(row.original)}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    {action.icon}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
      {
        accessorKey: "egg_ref_no",
        header: "Egg Reference No.",
        cell: ({ row }) => (
          <ClassificationRefBadge value={row.original.egg_ref_no} />
        ),
      },
      {
        accessorKey: FARM_FILTER_KEY,
        header: "Farm",
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue) return true;
          return String(row.getValue(columnId) ?? "") === String(filterValue);
        },
      },
      { accessorKey: "batch_code", header: "Batch Code" },
      { accessorKey: "grading_datetime", header: "Grading Date & Time" },
      {
        accessorKey: "total_chicks",
        header: "Total Egg Set",
        cell: ({ getValue }) =>
          Number(getValue<number>() || 0).toLocaleString(),
      },
      {
        accessorKey: "good_quality_chicks",
        header: "Good Quality Chicks",
        cell: ({ getValue }) => (
          <span className="font-semibold text-teal-700">
            {Number(getValue<number>() || 0).toLocaleString()}
          </span>
        ),
      },
      { accessorKey: "quality_grade_rate", header: "Quality Grade Rate %" },
      { accessorKey: "cull_rate", header: "Cull Rate %" },
      { accessorKey: "grading_personnel", header: "Grading Personnel" },
    ],
    [getRowActions],
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
      columnFilters: effectiveColumnFilters,
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
          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`size-4 ${isLoading
                ? "animate-spin"
                : ""
                }`}
            />

            {isLoading
              ? "Refreshing..."
              : "Refresh"}
          </Button>
        </div>

        <Button
          type="button"
          onClick={() =>
            router.push(
              "/jmb/docclassification/newv2",
            )
          }
          disabled={canInsert}
          className="flex items-center gap-2"
        >
          <Plus className="size-4" />

          New DOC Classification
        </Button>
      </div>

      <HatcheryListParameters {...parameters} />

      <ClassificationTableSection
        table={table}
        title="Doc Classification"
        tone="sky"
        isLoading={isLoading}
        error={loadError}
        colSpan={columns.length}
        paginationMode="showing-rows"
        headerActions={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              placeholder="Filter Egg Reference No."
              className="h-9 w-full rounded-md border-stone-300 bg-white sm:w-72"
              value={
                (table.getColumn("egg_ref_no")?.getFilterValue() as string) ?? ""
              }
              onChange={(e) =>
                table.getColumn("egg_ref_no")?.setFilterValue(e.target.value)
              }
            />

          </div>
        }
      />
    </div>
  );
}
