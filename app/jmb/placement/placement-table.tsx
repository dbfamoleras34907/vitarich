"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnFiltersState,
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  RowSelectionState,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Breadcrumb from "@/lib/Breadcrumb";
import {
  ClassificationRefBadge,
  ClassificationTableSection,
} from "@/components/classification/ClassificationTable";
import EditActionButton from "@/components/EditActionButton";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { useConfirm, withConfirmProvider } from "@/lib/ConfirmProvider";
import { deletePlacement, listPlacements, type Placement } from "./new/api";

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-CA");
}

function formatNumber(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return Number(value).toLocaleString();
}

function PlacementTableInner() {
  const router = useRouter();
  const confirm = useConfirm();
  const { setValue } = useGlobalContext();

  const [items, setItems] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  async function fetchData() {
    setLoading(true);
    try {
      const data = await listPlacements();
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
      router.prefetch("/jmb/placement/new");
      await fetchData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setValue("loading_g", loading);
  }, [loading, setValue]);

  async function handleDelete(row: Placement) {
    const approved = await confirm({
      title: "Delete placement record?",
      description: `This will permanently delete DR No. ${row.dr_no} / Pen ${row.pen_no}.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });

    if (!approved) return;

    try {
      await deletePlacement(row.id);
      await fetchData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete placement.";
      alert(message);
    }
  }

  const columns: ColumnDef<Placement>[] = [
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
            href={(id) => `/jmb/placement/new?id=${id}`}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleDelete(row.original)}
            className="h-8 px-3 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
        </div>
      ),
    },
    {
      accessorKey: "placement_date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.placement_date),
    },
    {
      accessorKey: "dr_no",
      header: "DR No.",
      cell: ({ row }) => <ClassificationRefBadge value={row.original.dr_no} />,
    },
    {
      accessorKey: "building_no",
      header: "Building",
    },
    {
      accessorKey: "pen_no",
      header: "Pen",
    },
    {
      accessorKey: "f_beg",
      header: "Female Placement",
      cell: ({ row }) => formatNumber(row.original.f_beg),
    },
    {
      accessorKey: "f_doa",
      header: "Female DOA",
      cell: ({ row }) => formatNumber(row.original.f_doa),
    },
    {
      accessorKey: "f_reject",
      header: "Female Reject",
      cell: ({ row }) => formatNumber(row.original.f_reject),
    },
    {
      accessorKey: "f_shortcount",
      header: "Female Short Count",
      cell: ({ row }) => formatNumber(row.original.f_shortcount),
    },
    {
      accessorKey: "f_endingbalance",
      header: "Female Ending Balance",
      cell: ({ row }) => {
        const beg = row.original.f_beg ?? 0;
        const doa = row.original.f_doa ?? 0;
        const reject = row.original.f_reject ?? 0;
        const shortcount = row.original.f_shortcount ?? 0;
        return formatNumber(beg - (doa + reject + shortcount));
      },
    },
    {
      accessorKey: "m_beg",
      header: "Male Placement",
      cell: ({ row }) => formatNumber(row.original.m_beg),
    },
    {
      accessorKey: "m_doa",
      header: "Male DOA",
      cell: ({ row }) => formatNumber(row.original.m_doa),
    },
    {
      accessorKey: "m_reject",
      header: "Male Reject",
      cell: ({ row }) => formatNumber(row.original.m_reject),
    },
    {
      accessorKey: "m_shortcount",
      header: "Male Short Count",
      cell: ({ row }) => formatNumber(row.original.m_shortcount),
    },
    {
      accessorKey: "m_endingbalance",
      header: "Male Ending Balance",
      cell: ({ row }) => {
        const beg = row.original.m_beg ?? 0;
        const doa = row.original.m_doa ?? 0;
        const reject = row.original.m_reject ?? 0;
        const shortcount = row.original.m_shortcount ?? 0;
        return formatNumber(beg - (doa + reject + shortcount));
      },
    },
    {
      accessorKey: "remarks",
      header: "remarks",
      cell: ({ row }) => row.original.remarks ?? "",
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
    <div className="rounded-md p-4 mt-4">
      <Breadcrumb
        SecondPreviewPageName="Breeder"
        CurrentPageName="Placement List"
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
          onClick={() => router.push("/jmb/placement/new")}
          className="flex h-full w-full items-center gap-2 md:h-auto md:w-auto"
        >
          <Plus className="size-4" />
          New Pleasement
        </Button>
      </div>

      <ClassificationTableSection
        table={table}
        title="Placement"
        tone="sky"
        isLoading={loading}
        colSpan={columns.length}
        paginationMode="showing-rows"
        headerActions={
          <Input
            placeholder="Filter DR Number"
            className="h-9 w-full rounded-md border-stone-300 bg-white sm:w-72"
            value={(table.getColumn("dr_no")?.getFilterValue() as string) ?? ""}
            onChange={(e) =>
              table.getColumn("dr_no")?.setFilterValue(e.target.value)
            }
          />
        }
      />
    </div>
  );
}

export default withConfirmProvider(PlacementTableInner);
