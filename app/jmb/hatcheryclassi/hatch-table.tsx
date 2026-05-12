"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Plus, RefreshCw, Search, Pencil, Map, Copy, View, ClipboardCopy, MoreHorizontal } from "lucide-react";

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
import loading from "@/loading";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { db } from "@/lib/Supabase/supabaseClient";
import { RowDataKey } from "@/lib/Defaults/DefaultTypes";
import DynamicTable from "@/components/ui/DataTableV2";
import { usePermission } from "@/hooks/usePermission";
import { RowAction } from "@/lib/types";
import { toast } from "sonner";
import { copyRow, copyTable } from "@/lib/tableActions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function HatchTable() {
  const params = useParams()
  const router = useRouter()

  const canInsert = usePermission('/jmb/hatcheryclassi/insert')
  const canView = usePermission('/jmb/hatcheryclassi/view')
  // useEffect(() => {
  //   if (canInsert)
  //     router.push("/jmb/hatcheryclassi/")
  // }, [])


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
  const { setValue, getValue } = useGlobalContext();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listHatchClassification(50);
      // console.log(data);
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
        header: "Ttl Egg Received",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
      },
      { accessorKey: "farm_name", header: "Shipped To" },
      { accessorKey: "voyage_no", header: "Voyage No" },
      { accessorKey: "shipped_via", header: "Shipped Via" },
      { accessorKey: "plate_no", header: "Plate No" },
      { accessorKey: "driver", header: "Driver" },
    ],
    [router],
  );

  const getRowActions = (row: RowDataKey): RowAction[] => {
    return [

      {
        label: "View",
        icon: <View className="w-4 h-4" />,
        disabled: canView,
        onClick: () => {
          router.push(`/a_dean/receiving/view/${row.id}`)
        },
      },
      {
        label: "Copy Row",
        icon: <Copy className="w-4 h-4" />,
        onClick: () => {
          copyRow(row)
        },
      },

      {
        label: "Copy Table",
        icon: <ClipboardCopy className="w-4 h-4" />,
        onClick: () => {
          copyTable(itemsForClass as RowDataKey[])
        },
      },


    ]
  }


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

      {
        id: "view",
        header: "View",
        // cell: ({ row }) => row.original.date_classify ?? "",
      },
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
      { accessorKey: "hairline", header: "Hairline" },
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

  useEffect(() => {
    setValue("loading_g", isLoadingforClass || isLoading);
  }, [isLoadingforClass || isLoading]);

  return (
    <div className="rounded-md p-4">
      <br />
      
      <div className="flex  justify-between pb-4">
        <Breadcrumb
          FirstPreviewsPageName="Hatchery"
          CurrentPageName="Egg Classification"
        />


        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={load}
            disabled={isLoading}
          >
            <RefreshCw
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            disabled={canInsert}
            type="button"
            size="sm"
            onClick={() => router.push("/jmb/hatcheryclassi/new")}
          >
            <Plus className="size-4" />
            New Classification
          </Button>
        </div>
      </div>
      {/* Top Controls */}

      {/* Table 1  Pending for Classification */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold   bg-blue-400 text-white px-2 py-1 rounded">
          Pending Classification
        </h1>
      </div>

      <div className="">
        {/* <Table>
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
        </Table> */}
        <DynamicTable
          loading={isLoadingforClass}
          initialFilters={[]}
          columns={columnsForClass.map((col: any) => ({
            key: col.accessorKey || col.id,
            label:
              typeof col.header === "string"
                ? col.header
                : String(col.id ?? ""),
            align: "left",

            render: (row: RowDataKey) => {
              // row number
              if ((col.id || col.accessorKey) === "row_no") {
                return String(
                  itemsForClass.findIndex((x) => x.id === row.id) + 1
                );
              }

              const key = col.accessorKey || col.id;
              const value = row[key];

              if (
                key === "actual_count" &&
                value !== null &&
                value !== undefined
              ) {
                return formatNumber(Number(value));
              }

              if (value === null || value === undefined || value === "") {
                return "-";
              }

              return String(value);
            },
          }))}
          data={itemsForClass as RowDataKey[]}
        />

      </div>
      <div className="flex items-center justify-between mb-2 mt-8">
        <h1 className="text-lg font-semibold  bg-green-400 text-white px-2 py-1 rounded">
          Classified Eggs
        </h1>
      </div>
      <div className="">
        {/* <Table>
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
        </Table> */}

        <DynamicTable
          loading={isLoading}
          initialFilters={[]}
          columns={columns.map((col: any) => ({
            key: col.accessorKey || col.id,
            label:
              typeof col.header === "string"
                ? col.header
                : String(col.id ?? ""),
            align: "left",

            render: (row: RowDataKey) => {
              const key = col.accessorKey || col.id;

              // row number
              if (key === "row_no") {
                return String(items.findIndex((x) => x.id === row.id) + 1);
              }

              // actions dropdown
              if (key === "view") {
                const actions = getRowActions(row);

                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="xs">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      {actions.map((action, index) => (
                        <DropdownMenuItem
                          key={index}
                          disabled={action.disabled}
                          onClick={() => action.onClick(row)}
                          className="cursor-pointer flex items-center gap-2"
                        >
                          {action.icon}
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              const value = row[key];

              if (value === null || value === undefined || value === "") {
                return "-";
              }

              return String(value);
            }
          }))}
          data={items as RowDataKey[]}
        />

      </div>

      {/* Pagination 2  Classified Eggs */}
      <div className="flex items-center justify-between gap-2">
        {/* <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div> */}
        {/* <div className="flex gap-2">
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
        </div> */}
      </div>
    </div>
  );
}
