'use client'

import { formatDateTime } from '@/lib/formatDate'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Skeleton } from './skeleton'

export type Column<T> = {
  key: keyof T | string
  label: string
  align?: 'left' | 'right' | 'center'
  type?: 'text' | 'date' | 'button' | string
  sortable?: boolean
  searchable?: boolean
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
  title?: string
  description?: string
  searchPlaceholder?: string
  emptyMessage?: string
  noResultsMessage?: string
  pageSizeOptions?: number[]
  rowKey?: keyof T | ((row: T, index: number) => React.Key)
  enableSearch?: boolean
  enableFilters?: boolean
  enablePagination?: boolean
  onRowClick?: (row: T) => void
  getRowClassName?: (row: T, index: number) => string
}

type SortState = {
  key: string | null
  direction: 'asc' | 'desc'
}

const alignClass = {
  left: 'text-left justify-start',
  center: 'text-center justify-center',
  right: 'text-right justify-end',
}

const normalizeFilterText = (value: unknown) => String(value ?? '').toLowerCase().trim()

const escapeDelimitedValue = (value: unknown) => {
  return String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim()
}

const escapeHtml = (value: unknown) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const copyToClipboard = async (content: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content)
    return
  }

  const textarea = document.createElement('textarea')

  textarea.value = content
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    const copied = document.execCommand('copy')
    if (!copied) throw new Error('Copy command failed')
  } finally {
    document.body.removeChild(textarea)
  }
}

const matchesFilter = (cellValue: unknown, filter: FilterRule) => {
  const filterValue = normalizeFilterText(filter.value)
  const cellText = normalizeFilterText(cellValue)

  if (filter.operator === 'equals') {
    const filterNumber = Number(filterValue)

    if (typeof cellValue === 'number' && Number.isFinite(filterNumber)) {
      return cellValue === filterNumber
    }

    return cellText === filterValue
  }

  return cellText.includes(filterValue)
}

export default function DynamicTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  initialFilters,
  title,
  description,
  searchPlaceholder = 'Search rows...',
  emptyMessage = 'No data available',
  noResultsMessage = 'No matching records found',
  pageSizeOptions = [10, 25, 50, 100],
  rowKey,
  enableSearch = true,
  enableFilters = true,
  enablePagination = true,
  onRowClick,
  getRowClassName,
}: Props<T>) {
  const tableId = useId()
  const [sort, setSort] = useState<SortState>({ key: null, direction: 'asc' })
  const [pageSize, setPageSize] = useState(pageSizeOptions[0] ?? 10)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [draftFilters, setDraftFilters] = useState<FilterRule[]>(initialFilters ?? [])
  const [appliedFilters, setAppliedFilters] = useState<FilterRule[]>(initialFilters ?? [])
  const [showFilter, setShowFilter] = useState(false)

  useEffect(() => {
    if (!showFilter) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowFilter(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [showFilter])

  const activeFilterCount = useMemo(() => {
    return appliedFilters.filter(filter => filter.columnKey && filter.value).length
  }, [appliedFilters])

  const searchableColumns = useMemo(() => {
    return columns.filter(column => column.searchable !== false && column.type !== 'button')
  }, [columns])

  const filterableColumns = useMemo(() => {
    return columns.filter(column => column.type !== 'button')
  }, [columns])

  const exportableColumns = useMemo(() => {
    return columns.filter(column => column.type !== 'button')
  }, [columns])

  const buildColumnFilterRules = useCallback((source: FilterRule[]) => {
    return filterableColumns.map((column, index) => {
      const columnKey = String(column.key)
      const existingFilter = source.find(filter => filter.columnKey === columnKey)

      return {
        id: existingFilter?.id || columnKey,
        columnKey,
        operator: existingFilter?.operator ?? 'like',
        value: existingFilter?.value ?? '',
        joiner: index === 0 ? 'and' : existingFilter?.joiner ?? 'and',
      } satisfies FilterRule
    })
  }, [filterableColumns])

  const handleSort = (key: string, sortable = true) => {
    if (!sortable) return

    setSort(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  const rowMatchesFilters = useCallback((row: T) => {
    const validFilters = appliedFilters.filter(filter => filter.columnKey && filter.value)
    if (validFilters.length === 0) return true

    let result: boolean | null = null

    for (const filter of validFilters) {
      const condition = matchesFilter(row[filter.columnKey as keyof T], filter)

      if (result === null) {
        result = condition
      } else {
        result = filter.joiner === 'and'
          ? result && condition
          : result || condition
      }
    }

    return result ?? true
  }, [appliedFilters])

  const filteredData = useMemo(() => {
    let result = data.filter(rowMatchesFilters)

    if (enableSearch && search) {
      const lower = search.toLowerCase()

      result = result.filter(row =>
        searchableColumns.some(column =>
          String(row[column.key as keyof T] ?? '')
            .toLowerCase()
            .includes(lower)
        )
      )
    }

    return result
  }, [data, rowMatchesFilters, search, searchableColumns, enableSearch])

  const sortedData = useMemo(() => {
    if (!sort.key) return filteredData

    return [...filteredData].sort((a, b) => {
      const aVal = a[sort.key as keyof T]
      const bVal = b[sort.key as keyof T]

      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sort.direction === 'asc' ? -1 : 1
      if (bVal == null) return sort.direction === 'asc' ? 1 : -1

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal
      }

      const comparison = String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
        sensitivity: 'base',
      })

      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [filteredData, sort])

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const safePage = Math.min(page, totalPages)

  const paginatedData = useMemo(() => {
    if (!enablePagination) return sortedData

    const start = (safePage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, safePage, pageSize, enablePagination])

  const firstRow = sortedData.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const lastRow = enablePagination
    ? Math.min(safePage * pageSize, sortedData.length)
    : sortedData.length
  const hasActiveSearchOrFilters = Boolean(search || activeFilterCount > 0)
  const showFooter = enablePagination && (data.length > 0 || sortedData.length > 0)

  const openFilterDialog = () => {
    setDraftFilters(buildColumnFilterRules(appliedFilters))
    setShowFilter(true)
  }

  const applyFilters = () => {
    const visibleColumnKeys = new Set(filterableColumns.map(column => String(column.key)))
    const hiddenFilters = appliedFilters.filter(filter => !visibleColumnKeys.has(filter.columnKey))

    setAppliedFilters([...hiddenFilters, ...draftFilters])
    setPage(1)
    setShowFilter(false)
  }

  const getReactKey = (row: T, index: number) => {
    if (typeof rowKey === 'function') return rowKey(row, index)
    if (rowKey) return row[rowKey] as React.Key

    const fallbackKey = row.id ?? row._id
    return typeof fallbackKey === 'string' || typeof fallbackKey === 'number'
      ? fallbackKey
      : index
  }

  const renderCell = (row: T, column: Column<T>) => {
    const value = row[column.key as keyof T]

    if (column.render) return column.render(row)
    if (column.type === 'date' && value) return formatDateTime(String(value))

    return String(value ?? '')
  }

  const getExportValue = useCallback((row: T, column: Column<T>) => {
    const value = row[column.key as keyof T]

    if (column.type === 'date' && value) return formatDateTime(String(value))
    return value
  }, [])

  const buildExportRows = useCallback(() => {
    return sortedData.map(row =>
      exportableColumns.map(column => getExportValue(row, column))
    )
  }, [exportableColumns, getExportValue, sortedData])

  const getExportFilename = useCallback((extension: string) => {
    const baseName = (title || 'table-export')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'table-export'

    return `${baseName}.${extension}`
  }, [title])

  const exportToTextTab = useCallback(async () => {
    const headers = exportableColumns.map(column => escapeDelimitedValue(column.label)).join('\t')
    const rows = buildExportRows().map(row =>
      row.map(value => escapeDelimitedValue(value)).join('\t')
    )

    try {
      await copyToClipboard([headers, ...rows].join('\n'))
      toast('Data copied to clipboard.')
    } catch {
      toast('Unable to copy data to clipboard.')
    }
  }, [buildExportRows, exportableColumns])

  const exportToExcel = useCallback(() => {
    const headerCells = exportableColumns
      .map(column => `<th>${escapeHtml(column.label)}</th>`)
      .join('')
    const bodyRows = buildExportRows()
      .map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`)
      .join('')
    const worksheet = `<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<table>
<thead><tr>${headerCells}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`

    downloadFile(
      worksheet,
      getExportFilename('xls'),
      'application/vnd.ms-excel;charset=utf-8'
    )
  }, [buildExportRows, exportableColumns, getExportFilename])

  const tableMinWidth = useMemo(() => {
    const estimatedWidth = columns.reduce((total, column) => {
      if (column.type === 'button') return total + 88

      const labelWidth = String(column.label).length * 8 + 48
      return total + Math.min(Math.max(labelWidth, 88), 180)
    }, 0)

    return Math.max(640, estimatedWidth)
  }, [columns])

  return (
    <section
      className="w-full min-w-0 max-w-full overflow-hidden rounded-md border bg-card shadow-[var(--starbucks-card-shadow)] [contain:inline-size]"
      aria-labelledby={title ? `${tableId}-title` : undefined}
    >
      <div
        className="flex min-w-0 flex-col gap-3 border-b bg-card px-3 py-3 lg:flex-row lg:items-center lg:justify-between"
      >
        {loading ? (
          <>
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-44" />
              <Skeleton className="h-9 w-28" />
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0">
              {title && (
                <h2 id={`${tableId}-title`} className="truncate text-base font-semibold text-[var(--starbucks-green)]">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
                {sortedData.length} of {data.length} rows
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">


              {enablePagination && (
                <label className="flex h-10 items-center gap-2 text-sm text-foreground">
                  {/* <span>Rows</span> */}
                  <select
                    value={pageSize}
                    onChange={event => {
                      setPageSize(Number(event.target.value))
                      setPage(1)
                    }}
                    className="h-8 rounded-md border border-input bg-[#fffdfb] px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15 dark:bg-input/30"
                  >
                    {pageSizeOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {enableFilters && (
                <button
                  type="button"
                  onClick={openFilterDialog}
                  className="relative inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-[#fffdfb] px-4 text-sm font-semibold text-foreground transition hover:border-ring hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring/15 dark:bg-input/30"
                  aria-haspopup="dialog"
                  aria-expanded={showFilter}
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  {/* Filter */}
                  {activeFilterCount > 0 && (
                    <span className="ml-1 rounded-md bg-[var(--starbucks-gold)] px-2 py-0.5 text-xs font-semibold text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-[#fffdfb] px-4 text-sm font-semibold text-foreground transition hover:border-ring hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                    disabled={exportableColumns.length === 0}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    {/* Export to
                    <ChevronDown className="size-4" aria-hidden="true" /> */}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={exportToTextTab}>
                    <FileText className="size-4" aria-hidden="true" />
                    To text-tab
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToExcel}>
                    <FileSpreadsheet className="size-4" aria-hidden="true" />
                    To Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {enableSearch && (
                <label className="flex h-10 min-w-0 max-w-full items-center gap-2 rounded-md border border-[#b8b2aa] bg-white px-3 shadow-none transition-[color,box-shadow,border-color] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15 dark:border-input dark:bg-input/30 sm:w-72">
                  <Search className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="sr-only">Search table</span>
                  <input
                    type="search"
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={event => {
                      setSearch(event.target.value)
                      setPage(1)
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        setPage(1)
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                      aria-label="Clear search"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </label>
              )}
            </div>
          </>
        )}
      </div>

      {showFilter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-6"
          onClick={() => setShowFilter(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${tableId}-filter-title`}
            className="w-full max-w-3xl rounded-md bg-card shadow-xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h3 id={`${tableId}-filter-title`} className="text-base font-semibold text-[var(--starbucks-green)]">
                  Table filters
                </h3>
                <p className="text-sm text-muted-foreground">
                  Enter values under any column. Blank filters are ignored.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFilter(false)}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                aria-label="Close filters"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
              {draftFilters.length === 0 && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No filterable columns.
                </div>
              )}

              {draftFilters.map((filter, index) => (
                <div
                  key={filter.columnKey}
                  className="grid gap-2 rounded-md border bg-secondary/60 p-3 md:grid-cols-[96px_minmax(160px,1fr)_120px_minmax(180px,1.5fr)]"
                >
                  <label className="text-sm text-foreground/75">
                    <span className="mb-1 block md:sr-only">Joiner</span>
                    <select
                      value={filter.joiner}
                      disabled={index === 0}
                      onChange={event =>
                        setDraftFilters(prev =>
                          prev.map(item =>
                            item.columnKey === filter.columnKey
                              ? { ...item, joiner: event.target.value as Joiner }
                              : item
                          )
                        )
                      }
                      className="h-9 w-full rounded-md border border-input bg-[#fffdfb] px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50 dark:bg-input/30"
                    >
                      <option value="and">AND</option>
                      <option value="or">OR</option>
                    </select>
                  </label>

                  <div className="flex min-h-9 items-center rounded-md border border-input bg-[#fffdfb] px-3 text-sm font-medium text-foreground dark:bg-input/30">
                    {filterableColumns.find(column => String(column.key) === filter.columnKey)?.label ?? filter.columnKey}
                  </div>

                  <label className="text-sm text-foreground/75">
                    <span className="mb-1 block md:sr-only">Operator</span>
                    <select
                      value={filter.operator}
                      onChange={event =>
                        setDraftFilters(prev =>
                          prev.map(item =>
                            item.columnKey === filter.columnKey
                              ? { ...item, operator: event.target.value as Operator }
                              : item
                          )
                        )
                      }
                      className="h-9 w-full rounded-md border border-input bg-[#fffdfb] px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 dark:bg-input/30"
                    >
                      <option value="like">Contains</option>
                      <option value="equals">Equals</option>
                    </select>
                  </label>

                  <label className="text-sm text-foreground/75">
                    <span className="mb-1 block md:sr-only">Value</span>
                    <input
                      value={filter.value}
                      onChange={event =>
                        setDraftFilters(prev =>
                          prev.map(item =>
                            item.columnKey === filter.columnKey
                              ? { ...item, value: event.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="Value"
                      className="h-9 w-full rounded-md border border-input bg-[#fffdfb] px-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 dark:bg-input/30"
                    />
                  </label>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setDraftFilters([])
                  setAppliedFilters([])
                  setPage(1)
                  setShowFilter(false)
                }}
                className="h-9 rounded-md border bg-background px-3 text-sm font-semibold text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={applyFilters}
                className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="block w-full min-w-0 max-w-full overflow-x-auto">
        <table
          className="w-full table-auto text-sm"
          style={{ minWidth: tableMinWidth }}
          aria-busy={loading}
        >
          <thead className="bg-secondary">
            <tr>
              {columns.map(column => {
                const key = String(column.key)
                const isSorted = sort.key === key
                const sortable = column.sortable !== false
                const alignment = alignClass[column.align ?? 'left']

                return (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={
                      isSorted
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    className={`h-10 whitespace-nowrap px-3 align-middle text-xs font-semibold uppercase text-foreground/70 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(key, sortable)}
                        className={`inline-flex w-full items-center gap-1.5 rounded-sm focus:outline-none focus:ring-2 focus:ring-ring/20 ${alignment}`}
                      >
                        <span>{column.label}</span>
                        {isSorted ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="size-3.5" aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className="sr-only">
                          {isSorted
                            ? `Sorted ${sort.direction === 'asc' ? 'ascending' : 'descending'}`
                            : 'Not sorted'}
                        </span>
                      </button>
                    ) : (
                      <span className={`inline-flex w-full items-center ${alignment}`}>
                        {column.label}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading &&
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column, colIndex) => (
                    <td key={`${String(column.key)}-${colIndex}`} className="p-2">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading &&
              paginatedData.map((row, index) => {
                const clickable = Boolean(onRowClick)
                const rowClassName = getRowClassName?.(row, index) ?? ''

                return (
                  <tr
                    key={getReactKey(row, index)}
                    onClick={clickable ? () => onRowClick?.(row) : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onKeyDown={event => {
                      if (!clickable) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onRowClick?.(row)
                      }
                    }}
                    className={`odd:bg-card even:bg-secondary/40 ${clickable ? 'cursor-pointer hover:bg-accent/45 focus:bg-accent/45 focus:outline-none' : 'hover:bg-accent/30'} ${rowClassName}`}
                  >
                    {columns.map(column => (
                      <td
                        key={String(column.key)}
                        className={`p-2 align-middle text-foreground/85 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'} ${column.type === 'button' ? 'whitespace-nowrap' : 'max-w-[320px]'}`}
                        title={column.type === 'button' ? undefined : String(row[column.key as keyof T] ?? '')}
                      >
                        <div className={column.type === 'button' ? 'flex justify-end' : 'truncate'}>
                          {renderCell(row, column)}
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {!loading && sortedData.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 border-t px-4 py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-accent text-primary">
            {hasActiveSearchOrFilters ? (
              <Filter className="size-5" aria-hidden="true" />
            ) : (
              <Search className="size-5" aria-hidden="true" />
            )}
          </div>
          <p className="text-sm font-medium text-foreground">
            {hasActiveSearchOrFilters ? noResultsMessage : emptyMessage}
          </p>
          {hasActiveSearchOrFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setDraftFilters([])
                setAppliedFilters([])
                setPage(1)
              }}
              className="text-sm font-medium text-primary hover:text-[var(--starbucks-green)] focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              Clear search and filters
            </button>
          )}
        </div>
      )}

      {showFooter && (
        <div className="flex min-w-0 flex-col gap-3 border-t bg-secondary/70 px-3 py-3 text-sm text-foreground/75 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0" aria-live="polite">
            Showing <span className="font-medium text-foreground">{firstRow}</span> to{' '}
            <span className="font-medium text-foreground">{lastRow}</span> of{' '}
            <span className="font-medium text-foreground">{sortedData.length}</span>
          </p>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage(1)}
              className="inline-flex size-9 items-center justify-center rounded-md border bg-background text-foreground/75 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="First page"
            >
              <ChevronFirst className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage(Math.max(1, safePage - 1))}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border bg-background px-3 text-foreground/75 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Prev
            </button>
            <span className="px-2 text-sm text-muted-foreground">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border bg-background px-3 text-foreground/75 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(totalPages)}
              className="inline-flex size-9 items-center justify-center rounded-md border bg-background text-foreground/75 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Last page"
            >
              <ChevronLast className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
