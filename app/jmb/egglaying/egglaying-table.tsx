"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Breadcrumb from "@/lib/Breadcrumb";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { listLayingPlacements, type LayingPlacement } from "./new/api";

type LayingPlacementGroup = {
  id: number;
  placement_date: string;
  dr_no: string;
  farm_id: number | null;
  farm_name: string;
  building_id: number | null;
  building_no: string;
  net_placement: number;
  age_days: number;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
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
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
  );
  return Math.max(0, Math.floor((endUtc - startUtc) / 86_400_000));
}

function formatAgeWeeks(days: number) {
  const weeks = Math.floor(days / 7);
  const weekDay = days % 7;
  return `${weeks}.7/${weekDay}`;
}

function getPlacementNet(row: LayingPlacement) {
  return Number(row.f_endingbalance ?? 0) + Number(row.m_endingbalance ?? 0);
}

function groupPlacementsByFarmBuilding(rows: LayingPlacement[]) {
  const groups = new Map<string, LayingPlacementGroup>();

  for (const row of rows) {
    const key = [
      row.farm_id ?? row.farm_name,
      row.building_id ?? row.building_no,
    ].join("|");
    const existing = groups.get(key);
    const rowAgeDays = getAgeInDays(row.placement_date);

    if (!existing) {
      groups.set(key, {
        id: row.id,
        placement_date: row.placement_date,
        dr_no: row.dr_no,
        farm_id: row.farm_id ?? null,
        farm_name: row.farm_name,
        building_id: row.building_id ?? null,
        building_no: row.building_no,
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

export default function EggLayingTable() {
  const router = useRouter();
  const { setValue } = useGlobalContext();

  const [items, setItems] = useState<LayingPlacement[]>([]);
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
      const data = await listLayingPlacements();
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
      router.prefetch("/jmb/egglaying/new");
      await fetchData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setValue("loading_g", loading);
  }, [loading, setValue]);

  const columns: ColumnDef<LayingPlacementGroup>[] = [
    {
      id: "row_no",
      header: "#",
      cell: ({ row }) => formatNumber(row.index + 1),
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => {
        const isLaying = row.original.age_days >= 26 * 7;

        return (
          <Button
            type="button"
            size="sm"
            disabled={!isLaying}
            onClick={() =>
              router.push(
                `/jmb/egglaying/new?placementId=${row.original.id}&netPlacement=${row.original.net_placement}`,
              )
            }
            className="h-8 bg-green-600 px-3 text-white hover:bg-green-700 disabled:bg-slate-100 disabled:text-slate-400"
          >
            Egg Collection
          </Button>
        );
      },
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
    <div className="rounded-md p-4 mt-4">
      <Breadcrumb
        SecondPreviewPageName="Breeder"
        CurrentPageName="Egg Laying List"
      />
      <br />

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Input
              placeholder="Filter Farm Name"
              className="pl-10"
              value={
                (table.getColumn("farm_name")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("farm_name")?.setFilterValue(event.target.value)
              }
            />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

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
        <div />
      </div>

      <div className="rounded-2xl bg-white p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="whitespace-normal text-left align-middle"
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
      </div>

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
