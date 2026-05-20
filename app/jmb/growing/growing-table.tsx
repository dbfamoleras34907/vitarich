"use client";

import { useEffect, useState } from "react";
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
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Breadcrumb from "@/lib/Breadcrumb";
import { ClassificationTableSection } from "@/components/classification/ClassificationTable";
import EditActionButton from "@/components/EditActionButton";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { useConfirm, withConfirmProvider } from "@/lib/ConfirmProvider";
import { deleteGrowing, listGrowings, type Growing } from "./new/api";

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-CA");
}

function formatNumber(value?: number | null, decimals = 0) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getLocation(row: Growing) {
  const placement = row.placement;
  return [placement?.farm_name, placement?.building_no, placement?.pen_no]
    .filter(Boolean)
    .join(" / ");
}

function GrowingTableInner() {
  const router = useRouter();
  const confirm = useConfirm();
  const { setValue } = useGlobalContext();

  const [items, setItems] = useState<Growing[]>([]);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  async function fetchData() {
    setLoading(true);
    try {
      const data = await listGrowings();
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
      await fetchData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setValue("loading_g", loading);
  }, [loading, setValue]);

  async function handleDelete(row: Growing) {
    const approved = await confirm({
      title: "Delete growing record?",
      description: `This will remove the ${formatDate(row.daterec)} record for ${
        getLocation(row) || `placement #${row.placement_id ?? row.id}`
      }.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });

    if (!approved) return;

    try {
      await deleteGrowing(row.id);
      await fetchData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete growing.";
      alert(message);
    }
  }

  const columns: ColumnDef<Growing>[] = [
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
          <EditActionButton
            id={row.original.id}
            href={(id) => `/jmb/growing/new?id=${id}`}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleDelete(row.original)}
            className="h-8 border-red-200 bg-red-50 px-3 text-red-600 hover:bg-red-100 hover:text-red-700"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
        </div>
      ),
    },
    {
      accessorKey: "daterec",
      header: "Record Date",
      cell: ({ row }) => formatDate(row.original.daterec),
    },
    {
      id: "farm",
      header: "Farm",
      accessorFn: (row) => row.placement?.farm_name ?? "",
    },
    {
      id: "building",
      header: "Building",
      accessorFn: (row) => row.placement?.building_no ?? "",
    },
    {
      id: "pen",
      header: "Pen",
      accessorFn: (row) => row.placement?.pen_no ?? "",
    },
    {
      accessorKey: "female_mortality",
      header: "Female Mortality",
      cell: ({ row }) => formatNumber(row.original.female_mortality),
    },
    {
      accessorKey: "female_feed_consumption",
      header: "Female Feed",
      cell: ({ row }) => formatNumber(row.original.female_feed_consumption, 2),
    },
    {
      id: "female_feedtype",
      header: "Female Feed Type",
      accessorFn: (row) => row.female_feedtype?.description ?? "",
    },
    {
      accessorKey: "female_body_weight",
      header: "Female Body Weight",
      cell: ({ row }) => formatNumber(row.original.female_body_weight, 2),
    },
    {
      accessorKey: "male_mortality",
      header: "Male Mortality",
      cell: ({ row }) => formatNumber(row.original.male_mortality),
    },
    {
      accessorKey: "male_feed_consumption",
      header: "Male Feed",
      cell: ({ row }) => formatNumber(row.original.male_feed_consumption, 2),
    },
    {
      id: "male_feedtype",
      header: "Male Feed Type",
      accessorFn: (row) => row.male_feedtype?.description ?? "",
    },
    {
      accessorKey: "male_body_weight",
      header: "Male Body Weight",
      cell: ({ row }) => formatNumber(row.original.male_body_weight, 2),
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
    <div className="mt-4 rounded-md p-4">
      <Breadcrumb
        SecondPreviewPageName="Breeder"
        CurrentPageName="Growing List"
      />
      <br />

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
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

        <Button
          type="button"
          onClick={() => router.push("/jmb/growing/new")}
          className="flex h-full w-full items-center gap-2 md:h-auto md:w-auto"
        >
          New Growing
        </Button>
      </div>

      <ClassificationTableSection
        table={table}
        title="Growing Period"
        tone="sky"
        isLoading={loading}
        colSpan={columns.length}
        paginationMode="showing-rows"
        headerActions={
          <Input
            placeholder="Filter Farm Name"
            className="h-9 w-full rounded-md border-stone-300 bg-white sm:w-72"
            value={(table.getColumn("farm")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("farm")?.setFilterValue(event.target.value)
            }
          />
        }
      />
    </div>
  );
}

export default withConfirmProvider(GrowingTableInner);
