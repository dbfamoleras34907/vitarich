"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, RefreshCw, Search } from "lucide-react"

import Breadcrumb from "@/lib/Breadcrumb"
import EditActionButton from "@/components/EditActionButton"
import { listEggPreWarming, type EggPreWarming } from "./new/api"

function fmtDuration(mins: number | null) {
  if (mins == null) return ""
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m} min`
  return `${h} hr ${m} min`
}

export default function PrewarmTable() {
  const router = useRouter()

  const [items, setItems] = useState<EggPreWarming[]>([])
  const [sorting, setSorting] = useState<any>([])
  const [columnFilters, setColumnFilters] = useState<any>([])
  const [columnVisibility, setColumnVisibility] = useState<any>({})
  const [rowSelection, setRowSelection] = useState<any>({})
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>("")

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const rows = await listEggPreWarming()
      setItems(Array.isArray(rows) ? rows : [])
      setLastUpdated(new Date().toLocaleString())
    } catch (e) {
      console.error(e)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    router.prefetch("/a_baja/prewarming/new")
    load()
  }, [router, load])

  const columns = useMemo<ColumnDef<EggPreWarming>[]>(
    () => [
      {
        id: "row_no",
        header: "#",
        cell: ({ row }) => row.index + 1,
      },
      {
        accessorKey: "egg_ref_no",
        header: "Egg Reference No.",
        cell: ({ row }) => row.original.egg_ref_no ?? "",
      },
      {
        accessorKey: "pre_temp",
        header: "Pre-Warming Temp",
        cell: ({ row }) => row.original.pre_temp ?? "",
      },
      {
        accessorKey: "egg_temp",
        header: "Egg Shell Temp",
        cell: ({ row }) => row.original.egg_temp ?? "",
      },
      {
        accessorKey: "duration",
        header: "Duration",
        cell: ({ row }) => fmtDuration((row.original.duration as number | null) ?? null),
      },
      {
        accessorKey: "remarks",
        header: "Remarks",
        cell: ({ row }) => row.original.remarks ?? "",
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => (
          <EditActionButton
            id={row.original?.id}
            href={(id) => `/a_baja/prewarming/new?id=${id}`}
          />
        ),
      },
    ],
    []
  )

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
  })

  return (
    <div className="rounded-md p-4">
      <Breadcrumb
        FirstPreviewsPageName="Hatchery"
        CurrentPageName="Pre-Warming"
      />
      <br />

      {/* Top Controls */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Input
              placeholder="Filter Egg Reference No."
              className="pl-10"
              value={
                (table.getColumn("egg_ref_no")?.getFilterValue() as string) ?? ""
              }
              onChange={(e) =>
                table.getColumn("egg_ref_no")?.setFilterValue(e.target.value)
              }
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button> 
        </div>

        <Button
          type="button"
          onClick={() => router.push("/a_baja/prewarming/new")}
          className="flex items-center gap-2"
        >
          <Plus className="size-4" />
          New Pre-Warming
        </Button>
      </div>

      {/* Table */}
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
                          header.getContext()
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
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {isLoading ? "Loading..." : "No results."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2 py-4">
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
  )
}