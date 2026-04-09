'use client'

import { formatDateTime } from '@/lib/formatDate'
import { MoveDown, MoveUp, Search } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { Skeleton } from './skeleton'

// export type Column<T> = {
//   key: keyof T | string
//   label: string
//   align?: 'left' | 'right' | 'center'
//   type?: 'text' | 'date' | 'button' | string  
//   render?: (row: T) => React.ReactNode
// }

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

  // 🔥 RESET PAGE WHEN FILTERS CHANGE
  useEffect(() => {
    setPage(1)
  }, [appliedFilters])

  // 🔢 COUNT ACTIVE FILTERS
  const activeFilterCount = useMemo(() => {
    return appliedFilters.filter(f => f.columnKey && f.value).length
  }, [appliedFilters])

  // 🔥 SORT CLICK
  const handleSort = (key: string) => {
    setSort(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  // 🟢 APPLY FILTERS WITH AND / OR
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
      else result = f.joiner === 'and' ? result && condition : result || condition
    }

    return result ?? true
  }

  // 🔍 FILTER + SEARCH
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

  // 🔥 SORT
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

  // 🔥 PAGINATION
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, page, pageSize])

  const totalPages = Math.ceil(sortedData.length / pageSize)

  return (
    <div className="space-y-3 bg-white rounded-2xl m-4">

      {/* CONTROLS */}
      <div className="flex justify-between items-center">

        <div className="flex items-center gap-3 m-4">

          {/* SHOW ENTRIES */}
          <div className="text-sm font-semibold">
            Show{' '}
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="border rounded px-2 py-0.5 text-sm mx-1"
            >
              {[10, 25, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>{' '}
            entries
          </div>

        </div>

        <div className='flex gap-4'>

          {/* FILTER BUTTON WITH BADGE */}
          <button
            type='button'
            onClick={() => setShowFilter(v => !v)}
            className="relative border px-3 py-1 rounded text-sm bg-muted"
          >
            Filter

            {activeFilterCount > 0 && (
              <span className="
                absolute -top-2 -right-2
                bg-blue-600 text-white text-xs
                rounded-full px-1.5 py-0.5
                min-w-4.5 text-center
              ">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* SEARCH */}
          <div className="border rounded flex items-center mr-4">
            <Search className="text-foreground/80 size-4 ml-2" />
            <input
              type="search"
              placeholder="Search"
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="rounded px-3 py-1 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 🔥 FILTER MODAL */}
      {showFilter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowFilter(false)}
        >
          <div
            className="w-[min(520px,90vw)] max-h-[70vh] overflow-auto bg-white rounded-xl shadow-xl p-4 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            {draftFilters.map(f => (
              <div key={f.id} className="flex flex-wrap gap-2 items-center">

                <select
                  value={f.columnKey}
                  onChange={e =>
                    setDraftFilters(prev =>
                      prev.map(x =>
                        x.id === f.id ? { ...x, columnKey: e.target.value } : x
                      )
                    )
                  }
                  className="border rounded px-2 py-1 text-sm"
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
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="like">Like (%)</option>
                  <option value="equals">Equals</option>
                </select>

                <input
                  value={f.value}
                  onChange={e =>
                    setDraftFilters(prev =>
                      prev.map(x =>
                        x.id === f.id ? { ...x, value: e.target.value } : x
                      )
                    )
                  }
                  className="border rounded px-2 py-1 text-sm flex-1 min-w-30"
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
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="and">AND</option>
                  <option value="or">OR</option>
                </select>

                <button
                  onClick={() =>
                    setDraftFilters(prev => prev.filter(x => x.id !== f.id))
                  }
                  className="text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}

            <div className="flex justify-between pt-2 border-t">

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
                className="text-sm"
              >
                + Add a Filter
              </button>

              <div className="flex gap-2">

                <button
                  onClick={() => {
                    setDraftFilters([])
                    setAppliedFilters([])
                  }}
                  className="text-sm border px-2 py-1 rounded"
                >
                  Clear Filters
                </button>

                <button
                  onClick={() => {
                    setAppliedFilters(draftFilters)
                    setShowFilter(false)
                  }}
                  className="text-sm border px-2 py-1 rounded bg-muted"
                >
                  Apply Filters
                </button>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-auto border rounded">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map(col => {
                const isSorted = sort.key === col.key
                return (
                  <th
                    key={String(col.key)}
                    onClick={() => handleSort(String(col.key))}
                    className={`whitespace-nowrap p-3 text-sm font-semibold cursor-pointer bg-muted ${col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                      }`}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {isSorted
                        ? sort.direction === 'asc'
                          ? <div className="flex">
                            <MoveUp className="size-4 text-" />
                            <MoveDown className="size-4 -ml-2 text-foreground/30" />  </div>
                          : <div className="flex">
                            <MoveUp className="size-4 text-foreground/30" />
                            <MoveDown className="size-4 -ml-2 text-" />   </div>
                        : (
                          <div className="flex">
                            <MoveUp className="size-4 text-foreground/30" />
                            <MoveDown className="size-4 -ml-2 text-foreground/30" />
                          </div>
                        )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>




          {/* <tbody>
            {paginatedData.map((row, i) => (
              <tr key={i} className="border-t hover:bg-background">
                {columns.map((col, i) => (
                  <td key={i} className="p-3 whitespace-nowrap">
                    {(() => {
                      const value = row[col.key as keyof T]
                      if (col.type === 'date' && value) {
                        return formatDateTime(String(value))
                      }

                      if (col.render) {
                        return col.render(row)
                      }
                      return String(value ?? '')
                    })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody> */}

          <tbody>

            {/* LOADING STATE */}
            {loading &&
              Array.from({ length: 4 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-t">
                  {columns.map((_, colIndex) => (
                    <td key={colIndex} className="p-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            }

            {/* DATA ROWS */}
            {!loading &&
              paginatedData.map((row, i) => (
                <tr key={i} className="border-t hover:bg-background">
                  {columns.map((col, i) => (
                    <td key={i} className="px-2 whitespace-nowrap">
                      {(() => {
                        const value = row[col.key as keyof T]

                        if (col.type === "date" && value) {
                          return formatDateTime(String(value))
                        }

                        if (col.render) {
                          return col.render(row)
                        }

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
        <div className="flex justify-between items-center text-sm">
          <div className='mx-4'>
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, sortedData.length)} of{' '}
            {sortedData.length} entries
          </div>

          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="border px-3 py-1 rounded disabled:opacity-50"
            >
              Previous
            </button>

            <span>Page {page} / {totalPages || 1}</span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="border px-3 py-1 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>}

      <div className='mx-auto w-fit py-2'> {data.length === 0 && " No data available"}</div>
    </div>
  )
}
