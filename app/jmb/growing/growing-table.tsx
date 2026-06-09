"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Breadcrumb from "@/lib/Breadcrumb";
import { ClassificationTableSection } from "@/components/classification/ClassificationTable";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { listGrowingPlacements, type GrowingPlacement } from "./new/api";

type PopulationRecord = {
  id: number;
  placement_date: string;
  dr_no: string | null;
  farm_id: number | null;
  farm_name: string;
  building_no: string;
  net_placement: number;
  age_days: number;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-CA");
}

function formatNumber(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return Number(value).toLocaleString("en-US");
}

function getAgeInDays(placementDate?: string | null, endDate = new Date()) {
  if (!placementDate) return 0;
  const start = new Date(`${placementDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;

  const elapsedDays = Math.floor(
    (Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86_400_000,
  );

  return elapsedDays < 0 ? 0 : elapsedDays + 1;
}

function formatAgeWeeks(days: number) {
  if (days <= 0) return "";
  const elapsedDays = days - 1;
  const weeks = Math.floor(elapsedDays / 7);
  const weekDay = elapsedDays % 7;
  return `${weeks}.7/${weekDay}`;
}

function getPlacementNet(row: GrowingPlacement) {
  return Number(row.f_endingbalance ?? 0) + Number(row.m_endingbalance ?? 0);
}

function groupPlacementsByFarmBuilding(rows: GrowingPlacement[]) {
  const groups = new Map<string, PopulationRecord>();

  for (const row of rows) {
    const farmName = row.farm_name ?? "";
    const buildingNo = row.building_no ?? "";
    const key = [row.farm_id ?? farmName, buildingNo].join("|");
    const rowAgeDays = getAgeInDays(row.placement_date);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        id: row.id,
        placement_date: row.placement_date,
        dr_no: row.dr_no,
        farm_id: row.farm_id ?? null,
        farm_name: farmName,
        building_no: buildingNo,
        net_placement: getPlacementNet(row),
        age_days: rowAgeDays,
      });
      continue;
    }

    const existingDate = new Date(`${existing.placement_date}T00:00:00`);
    const rowDate = new Date(`${row.placement_date}T00:00:00`);
    const useOlderPlacement =
      !Number.isNaN(rowDate.getTime()) &&
      (Number.isNaN(existingDate.getTime()) || rowDate < existingDate);

    groups.set(key, {
      ...existing,
      id: useOlderPlacement ? row.id : existing.id,
      placement_date: useOlderPlacement
        ? row.placement_date
        : existing.placement_date,
      dr_no: useOlderPlacement ? row.dr_no : existing.dr_no,
      net_placement: existing.net_placement + getPlacementNet(row),
      age_days: Math.max(existing.age_days, rowAgeDays),
    });
  }

  return Array.from(groups.values()).sort(
    (a, b) =>
      a.farm_name.localeCompare(b.farm_name) ||
      a.building_no.localeCompare(b.building_no),
  );
}

export default function GrowingTable() {
  const router = useRouter();
  const { setValue } = useGlobalContext();

  const [items, setItems] = useState<GrowingPlacement[]>([]);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const groupedItems = useMemo(
    () => groupPlacementsByFarmBuilding(items),
    [items],
  );

  async function fetchData() {
    setLoading(true);
    try {
      const data = await listGrowingPlacements();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    (async () => {
      router.prefetch("/jmb/growing/new");
      router.prefetch("/jmb/growing/grading");
      await fetchData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setValue("loading_g", loading);
  }, [loading, setValue]);

  const columns: ColumnDef<PopulationRecord>[] = [
    {
      id: "row_no",
      header: "#",
      enableSorting: false,
      cell: ({ row }) => formatNumber(row.index + 1),
    },
    {
      id: "action",
      header: "Action",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() =>
              router.push(`/jmb/growing/new?placementId=${row.original.id}`)
            }
            className="h-8 bg-green-600 px-3 text-white hover:bg-green-700"
          >
            Growing
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              router.push(`/jmb/growing/grading?placementId=${row.original.id}`)
            }
            className="h-8 bg-sky-600 px-3 text-white hover:bg-sky-700"
          >
            Grading
          </Button>
        </div>
      ),
    },
    {
      accessorKey: "placement_date",
      header: "Placement Date",
      cell: ({ row }) => formatDate(row.original.placement_date),
    },
    {
      accessorKey: "dr_no",
      header: "DR No.",
    },
    {
      accessorKey: "farm_name",
      header: "Farm Name",
    },
    {
      accessorKey: "building_no",
      header: "Building",
    },
    {
      id: "age",
      header: "Age",
      cell: ({ row }) => formatAgeWeeks(row.original.age_days),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const isLaying = row.original.age_days >= 26 * 7;
        return (
          <span
            className={
              isLaying
                ? "inline-flex rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
                : "inline-flex rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700"
            }
          >
            {isLaying ? "Laying" : "Growing"}
          </span>
        );
      },
    },
    {
      id: "net_placement",
      header: "Net of Placement",
      cell: ({ row }) => formatNumber(row.original.net_placement),
    },
  ];

  const table = useReactTable({
    data: groupedItems,
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
    <div className="mt-4 rounded-md p-4">
      <Breadcrumb
        SecondPreviewPageName="Breeder"
        CurrentPageName="Population Record"
      />
      <br />

      <div className="mb-4 flex items-center justify-between gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={fetchData}
          disabled={loading}
          className="flex h-full w-full items-center gap-2 md:h-auto md:w-auto"
        >
          <RefreshCw className="size-4" />
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <ClassificationTableSection
        table={table}
        title="Population Record"
        tone="sky"
        isLoading={loading}
        colSpan={columns.length}
        paginationMode="showing-rows"
        headerActions={
          <Input
            placeholder="Filter Farm Name"
            className="h-9 w-full rounded-md border-stone-300 bg-white sm:w-72"
            value={
              (table.getColumn("farm_name")?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table.getColumn("farm_name")?.setFilterValue(event.target.value)
            }
          />
        }
      />
    </div>
  );
}
