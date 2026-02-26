"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
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
import { Pencil, Plus, RefreshCwIcon, Search, Trash2 } from "lucide-react"

import Breadcrumb from "@/lib/Breadcrumb"
import EditActionButton from "@/components/EditActionButton"
import { listDispatchDocs, softDeleteDispatchDoc } from "../docdispatch/new/api"
// 
type Row = {
  id: number
  doc_date: string
  dr_no: string
  farm_name: string
  hauler_name: string | null
  hauler_plate_no: string | null
  truck_seal_no: string | null
  chick_van_temp_c: number | null
  number_of_fans: number | null
  remarks: string | null
}

export default function DocdispatchTable() {
  const router = useRouter()

  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState("")

  async function load() {
    setLoading(true)
    try {
      const rows = await listDispatchDocs()
      setData(rows as Row[])
    } catch (e) {
      console.error(e)
      alert("Failed to load records.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onDelete(id: number) {
    const ok = confirm("Set this record as inactive?")
    if (!ok) return
    try {
      await softDeleteDispatchDoc(id)
      await load()
    } catch (e) {
      console.error(e)
      alert("Failed to delete.")
    }
  }

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [ 
      {
      accessorKey: "id",
      header: "#",
      cell: ({ row }) => row.index + 1,
      }, 
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => (
          <EditActionButton
            id={row.original?.id}
            href={(id) => `/a_baja/docdispatch/new?id=${id}`}
          />
        ),
      },
      { accessorKey: "doc_date", header: "Date" },
      { accessorKey: "dr_no", header: "Delivery Receipt No." },
      { accessorKey: "farm_name", header: "Farm Name" },
      { accessorKey: "hauler_name", header: "Hauler Name" },
      { accessorKey: "hauler_plate_no", header: "Plate Number" },
      { accessorKey: "truck_seal_no", header: "Truck Seal Number" },
      {
        accessorKey: "chick_van_temp_c",
        header: "Chick Van Temp",
        cell: ({ row }) =>
          row.original.chick_van_temp_c == null ? "" : `${row.original.chick_van_temp_c} °C`,
      },
      { accessorKey: "number_of_fans", header: "Number of Fans" },
      { accessorKey: "remarks", header: "Remarks" },     
    ],
    [router]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue ?? "").toLowerCase()
      if (!q) return true
      const v = [
        row.original.dr_no,
        row.original.farm_name,
        row.original.hauler_name ?? "",
        row.original.hauler_plate_no ?? "",
        row.original.truck_seal_no ?? "",
        row.original.remarks ?? "",
        row.original.doc_date ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return v.includes(q)
    },
  })

  return (
    <div className="rounded-md p-4">
         <Breadcrumb
            SecondPreviewPageName="Hatchery"
            // FirstPreviewsPageName="Egg Transfer"
            CurrentPageName="Doc Dispatch "
          />

      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 w-[320px]"
              placeholder="Search..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>

          <Button type="button" 
            variant="outline" 
            onClick={load} disabled={loading} 
            className="w-full md:w-auto h-full md:h-auto">
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Button 
          type="button"
          className="w-full md:w-auto h-full md:h-auto" 
          onClick={() => router.push("/a_baja/docdispatch/new")}>
          <Plus className="h-4 w-4 mr-2" />
            New Dispatch Doc
        </Button>
      </div>

      <div className="rounded-md border p-4 bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="text-left">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {loading ? "Loading..." : "No results."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prev
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
  )
}