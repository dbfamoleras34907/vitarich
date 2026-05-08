'use client'

import { formatDateTime } from '@/lib/formatDate'
import { MoveDown, MoveUp, Search } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { Skeleton } from './skeleton'

export type Column<T> = {
  key: keyof T | string
  label: string
  align?: 'left' | 'right' | 'center'
  type?: 'text' | 'date' | 'button' | string
  render?: (row: T) => React.ReactNode
}

type Operator = 'equals' | 'like'
type Joiner = 'and' | 'or'

export type FilterRule = {
  id: string
  columnKey: string
  operator: Operator
  value: string
  joiner: Joiner
}

type Props<T> = {
  columns: Column<T>[]
  data: T[]
  loading: boolean
  initialFilters?: FilterRule[]
}

type SortState = {
  key: string | null
  direction: 'asc' | 'desc'
}

export default function DynamicTable<T extends Record<string, any>>({
  columns,
  data,
  loading,
  initialFilters,
}: Props<T>) {

  const [sort, setSort] = useState<SortState>({ key: null, direction: 'asc' })
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const [draftFilters, setDraftFilters] = useState<FilterRule[]>(initialFilters ?? [])
  const [appliedFilters, setAppliedFilters] = useState<FilterRule[]>(initialFilters ?? [])
  const [showFilter, setShowFilter] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [appliedFilters])

  const activeFilterCount = useMemo(() => {
    return appliedFilters.filter(f => f.columnKey && f.value).length
  }, [appliedFilters])

  const handleSort = (key: string) => {
    setSort(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  const rowMatchesFilters = (row: T) => {
    if (appliedFilters.length === 0) return true

    let result: boolean | null = null

    for (const f of appliedFilters) {

      if (!f.columnKey || !f.value) continue

      const cell = String(row[f.columnKey as keyof T] ?? '').toLowerCase()
      const value = f.value.toLowerCase()

      let condition = false

      if (f.operator === 'equals') condition = cell === value
      if (f.operator === 'like') condition = cell.includes(value)

      if (result === null) result = condition
      else result = f.joiner === 'and'
        ? result && condition
        : result || condition
    }

    return result ?? true
  }

  const filteredData = useMemo(() => {

    let result = data.filter(rowMatchesFilters)

    if (search) {
      const lower = search.toLowerCase()

      result = result.filter(row =>
        columns.some(col =>
          String(row[col.key as keyof T] ?? '')
            .toLowerCase()
            .includes(lower)
        )
      )
    }

    return result

  }, [data, appliedFilters, search, columns])

  const sortedData = useMemo(() => {
    if (!sort.key) return filteredData

    return [...filteredData].sort((a, b) => {
      const aVal = a[sort.key as keyof T]
      const bVal = b[sort.key as keyof T]

      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
      return 0
    })
  }, [filteredData, sort])

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, page, pageSize])

  const totalPages = Math.ceil(sortedData.length / pageSize)

  return (
    <div className="rounded-xl border bg-white shadow-sm space-y-2">

      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-2 px-4 pt-3">

        {/* ENTRIES */}
        <div className="text-xs text-muted-foreground">
          Show
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="mx-1 rounded border px-1 py-0.5 text-xs"
          >
            {[10, 25, 50, 100].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          entries
        </div>

        {/* FILTER + SEARCH */}
        <div className="flex items-center gap-2">

          {/* FILTER */}
          <button
            onClick={() => setShowFilter(v => !v)}
            className="relative rounded border px-2 py-1 text-xs hover:bg-muted"
          >
            Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] px-1.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* SEARCH */}
          <div className="flex items-center gap-1 border rounded px-2 py-0.5">
            <Search size={13} />
            <input
              type="search"
              placeholder="Search..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="outline-none text-xs w-32"
            />
          </div>

        </div>
      </div>

      {/* FILTER MODAL */}
      {showFilter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowFilter(false)}
        >
          <div
            className="w-120 max-w-[90vw] bg-white rounded-lg shadow-lg p-3 space-y-2"
            onClick={e => e.stopPropagation()}
          >

            {draftFilters.map(f => (
              <div key={f.id} className="flex flex-wrap gap-1">

                <select
                  value={f.columnKey}
                  onChange={e =>
                    setDraftFilters(prev =>
                      prev.map(x =>
                        x.id === f.id
                          ? { ...x, columnKey: e.target.value }
                          : x
                      )
                    )
                  }
                  className="border rounded px-1 py-0.5 text-xs"
                >
                  <option value="">Column</option>
                  {columns.map(c => (
                    <option key={String(c.key)} value={String(c.key)}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <select
                  value={f.operator}
                  onChange={e =>
                    setDraftFilters(prev =>
                      prev.map(x =>
                        x.id === f.id
                          ? { ...x, operator: e.target.value as Operator }
                          : x
                      )
                    )
                  }
                  className="border rounded px-1 py-0.5 text-xs"
                >
                  <option value="like">Like</option>
                  <option value="equals">Equals</option>
                </select>

                <input
                  value={f.value}
                  onChange={e =>
                    setDraftFilters(prev =>
                      prev.map(x =>
                        x.id === f.id
                          ? { ...x, value: e.target.value }
                          : x
                      )
                    )
                  }
                  className="border rounded px-1 py-0.5 text-xs flex-1"
                />

                <select
                  value={f.joiner}
                  onChange={e =>
                    setDraftFilters(prev =>
                      prev.map(x =>
                        x.id === f.id
                          ? { ...x, joiner: e.target.value as Joiner }
                          : x
                      )
                    )
                  }
                  className="border rounded px-1 py-0.5 text-xs"
                >
                  <option value="and">AND</option>
                  <option value="or">OR</option>
                </select>

                <button
                  onClick={() =>
                    setDraftFilters(prev =>
                      prev.filter(x => x.id !== f.id)
                    )
                  }
                  className="text-red-500 text-xs"
                >
                  ✕
                </button>

              </div>
            ))}

            <div className="flex justify-between pt-1 border-t">

              <button
                onClick={() =>
                  setDraftFilters(prev => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      columnKey: '',
                      operator: 'like',
                      value: '',
                      joiner: 'and',
                    },
                  ])
                }
                className="text-xs text-blue-600"
              >
                + Add Filter
              </button>

              <div className="flex gap-1">

                <button
                  onClick={() => {
                    setDraftFilters([])
                    setAppliedFilters([])
                  }}
                  className="border rounded px-2 py-0.5 text-xs"
                >
                  Clear
                </button>

                <button
                  onClick={() => {
                    setAppliedFilters(draftFilters)
                    setShowFilter(false)
                  }}
                  className="rounded px-2 py-0.5 text-xs bg-muted"
                >
                  Apply
                </button>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-auto border rounded mx-3">
        <table className="w-full text-xs">

          <thead className="bg-muted sticky top-0">
            <tr>
              {columns.map(col => {
                const isSorted = sort.key === col.key
                return (
                  <th
                    key={String(col.key)}
                    onClick={() => handleSort(String(col.key))}
                    className="px-2 py-1 font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {isSorted
                        ? sort.direction === 'asc'
                          ? <MoveUp size={12} />
                          : <MoveDown size={12} />
                        : (
                          <div className="opacity-30 flex">
                            <MoveUp size={12} />
                            <MoveDown size={12} className="-ml-1" />
                          </div>
                        )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>

            {loading &&
              Array.from({ length: 4 }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((_, colIndex) => (
                    <td key={colIndex} className="p-2">
                      <Skeleton className="h-3 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              paginatedData.map((row, i) => (
                <tr key={i} className="border-t hover:bg-muted/40">
                  {columns.map((col, i) => (
                    <td key={i} className="px-2 py-1  whitespace-nowrap">
                      {(() => {
                        const value = row[col.key as keyof T]

                        if (col.type === "date" && value)
                          return formatDateTime(String(value))

                        if (col.render)
                          return col.render(row)

                        return String(value ?? "")
                      })()}
                    </td>
                  ))}
                </tr>
              ))}

          </tbody>

        </table>
      </div>

      {/* FOOTER */}
      {data.length > 0 &&
        <div className="flex justify-between items-center px-4 pb-2 text-xs text-muted-foreground">

          <div>
            {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, sortedData.length)}
            of {sortedData.length}
          </div>

          <div className="flex gap-1">

            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="border px-2 py-0.5 rounded disabled:opacity-40"
            >
              Prev
            </button>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="border px-2 py-0.5 rounded disabled:opacity-40"
            >
              Next
            </button>

          </div>

        </div>
      }

      {data.length === 0 && (
        <div className="text-center text-muted-foreground py-4 text-xs">
          No data available
        </div>
      )}

    </div>
  )
}