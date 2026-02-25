// app/a_baja/chickpullout/chickpullout-table.tsx
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, RefreshCw, Search } from "lucide-react"

import Breadcrumb from "@/lib/Breadcrumb"
import EditActionButton from "@/components/EditActionButton"
import {
  ChickPulloutProcess,
  listChickPulloutProcess,
  deleteChickPulloutProcess,
} from "./new/api"

export default function ChickPulloutTable() {
  const router = useRouter()

  const [items, setItems] = useState<ChickPulloutProcess[]>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>("")

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await listChickPulloutProcess()
      setItems(Array.isArray(data) ? data : [])
      setLastUpdated(new Date().toLocaleString())
    } catch (e) {
      console.error(e)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    router.prefetch("/a_baja/chickpullout/new")
    load()
  }, [router, load])

  const columns = useMemo<ColumnDef<ChickPulloutProcess>[]>(
    () => [
      {
        id: "row_no",
        header: "#",
        cell: ({ row }) => row.index + 1,
      },
            {
        id: "action",
        header: "Action",
        cell: ({ row }) => ( 
            <EditActionButton
              id={row.original?.id}
              href={(id) => `/a_baja/chickpullout/new?id=${id}`}
            /> 
          
        ),
      },
      {
        accessorKey: "egg_ref_no",
        header: "Egg Reference No.",
      },
      {
        accessorKey: "chick_hatch_ref_no",
        header: "Chick Hatch Ref. No.",
      },
      {
        accessorKey: "farm_source",
        header: "Farm Source",
      },
      {
        accessorKey: "machine_no",
        header: "Machine",
      },
      {
        accessorKey: "hatch_date",
        header: "Hatch Date",
      },
      {
        accessorKey: "chicks_hatched",
        header: "Chicks Hatched",
        cell: ({ row }) => row.original.chicks_hatched ?? "",
      },
      {
        accessorKey: "dead_in_shell",
        header: "Dead-in-shell",
      },
      {
        accessorKey: "hatch_fertile",
        header: "Hatch of Fertile (%)",
      },
      {
        accessorKey: "mortality_rate",
        header: "Mortality Rate (%)",
      },
      {
        accessorKey: "hatch_window",
        header: "Hatch Window",
      },
    ],
    []
  )

  const table = useReactTable({
    data: items,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _colId, filterValue) => {
      const v = String(filterValue ?? "").toLowerCase()
      const hay = [
        row.original.egg_ref_no,
        row.original.chick_hatch_ref_no,
        row.original.farm_source,
        row.original.machine_no,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(v)
    },
  })

  return (
    <div className="rounded-md p-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        CurrentPageName="Chick Pullout"
      />
      <br />

      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Input
              placeholder="Search Egg Reference No."
              className="pl-10"
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-2 w-full md:w-auto h-full md:h-auto" 
          >
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
 
        </div>

        <Button
          type="button"
          onClick={() => router.push("/a_baja/chickpullout/new")}
          className="flex items-center gap-2 w-full md:w-auto h-full md:h-auto"
        >
          <Plus className="size-4" />
          New Chick Pullout
        </Button>
      </div>

      <div className="rounded-2xl p-4 bg-white shadow">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className="whitespace-normal wrap-break-word text-left align-middle"
                  >
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((r) => (
                <TableRow key={r.id}>
                  {r.getVisibleCells().map((c) => (
                    <TableCell key={c.id}>
                      {c.column.columnDef.cell
                        ? flexRender(c.column.columnDef.cell, c.getContext())
                        : String(c.getValue() ?? "")}
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

      <div className="flex items-center justify-end gap-2 mt-4">
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
  )
}