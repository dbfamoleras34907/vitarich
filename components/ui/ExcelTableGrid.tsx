'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown, Plus, Trash2 } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'

export type ExcelCellChange<T> = {
  row: T
  columnKey: string
  value: unknown
}

type ExcelColumn<T> = {
  key: keyof T | string
  label: string
  align?: 'left' | 'right' | 'center'
  type?: 'text' | 'number' | 'currency' | 'date' | 'button' | string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
  editable?: boolean | ((row: T) => boolean)
  editor?: 'text' | 'number' | 'date' | 'checkbox'
  parseValue?: (value: string, row: T) => unknown
  width?: number
  minWidth?: number
  maxWidth?: number
  frozen?: boolean
}

type CellPosition = {
  row: number
  column: number
}

type SortState = {
  key: string | null
  direction: 'asc' | 'desc'
}

type Props<T extends Record<string, unknown>> = {
  columns: ExcelColumn<T>[]
  rows: T[]
  allRows: T[]
  loading: boolean
  sort: SortState
  firstRowNumber: number
  frozenColumns: number
  getRowId: (row: T) => string
  renderCell: (row: T, column: ExcelColumn<T>) => React.ReactNode
  onSort: (key: string, sortable?: boolean) => void
  onCellsChange: (changes: ExcelCellChange<T>[]) => void
  onAddRow: () => void
  onDeleteRows: (rows: T[]) => void
  enableRowActions: boolean
}

const ROW_HEADER_WIDTH = 38
const DEFAULT_COLUMN_WIDTH = 120
const MIN_COLUMN_WIDTH = 64
const MAX_COLUMN_WIDTH = 480

const clamp = (value: number, minimum: number, maximum: number) => {
  return Math.min(Math.max(value, minimum), maximum)
}

const getEditorType = <T extends Record<string, unknown>>(column: ExcelColumn<T>) => {
  if (column.editor) return column.editor
  if (column.type === 'number' || column.type === 'currency') return 'number'
  if (column.type === 'date') return 'date'
  return 'text'
}

const isColumnEditable = <T extends Record<string, unknown>>(column: ExcelColumn<T>, row: T) => {
  if (typeof column.editable === 'function') return column.editable(row)
  if (typeof column.editable === 'boolean') return column.editable
  return column.type !== 'button' && !column.render
}

const parseCellValue = <T extends Record<string, unknown>>(
  column: ExcelColumn<T>,
  value: string,
  row: T
) => {
  if (column.parseValue) return column.parseValue(value, row)

  const editorType = getEditorType(column)
  if (editorType === 'number') {
    if (value.trim() === '') return ''
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? numberValue : value
  }
  if (editorType === 'checkbox') return value === 'true' || value === '1'
  return value
}

const getCellText = <T extends Record<string, unknown>>(row: T, column: ExcelColumn<T>) => {
  const value = row[column.key as keyof T]
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value ?? '')
}

export default function ExcelTableGrid<T extends Record<string, unknown>>({
  columns,
  rows,
  allRows,
  loading,
  sort,
  firstRowNumber,
  frozenColumns,
  getRowId,
  renderCell,
  onSort,
  onCellsChange,
  onAddRow,
  onDeleteRows,
  enableRowActions,
}: Props<T>) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const dragSelectingRef = useRef(false)
  const editingCellRef = useRef<CellPosition | null>(null)
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null)
  const [selectionAnchor, setSelectionAnchor] = useState<CellPosition | null>(null)
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null)
  const [editValue, setEditValue] = useState('')
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [columnWidthState, setColumnWidthState] = useState<{
    signature: string
    widths: Record<string, number>
  }>({ signature: '', widths: {} })

  const columnSignature = columns
    .map(column => `${String(column.key)}:${column.width ?? ''}`)
    .join('|')

  const defaultColumnWidths = useMemo(() => {
    const nextWidths: Record<string, number> = {}
    columns.forEach(column => {
      const key = String(column.key)
      const estimatedWidth = Math.max(DEFAULT_COLUMN_WIDTH, column.label.length * 8 + 44)
      nextWidths[key] = clamp(
        column.width ?? estimatedWidth,
        column.minWidth ?? MIN_COLUMN_WIDTH,
        column.maxWidth ?? MAX_COLUMN_WIDTH
      )
    })
    return nextWidths
  }, [columns])
  const columnWidths = columnWidthState.signature === columnSignature
    ? columnWidthState.widths
    : defaultColumnWidths

  useEffect(() => {
    const stopDragSelection = () => {
      dragSelectingRef.current = false
    }
    window.addEventListener('pointerup', stopDragSelection)
    return () => window.removeEventListener('pointerup', stopDragSelection)
  }, [])

  const frozenColumnIndexes = useMemo(() => {
    return new Set(
      columns
        .map((column, index) => (index < frozenColumns || column.frozen ? index : -1))
        .filter(index => index >= 0)
    )
  }, [columns, frozenColumns])

  const getFrozenLeft = (columnIndex: number) => {
    let left = ROW_HEADER_WIDTH
    for (let index = 0; index < columnIndex; index += 1) {
      if (frozenColumnIndexes.has(index)) {
        left += columnWidths[String(columns[index].key)] ?? DEFAULT_COLUMN_WIDTH
      }
    }
    return left
  }

  const selectedRange = useMemo(() => {
    if (!activeCell || !selectionAnchor) return null
    return {
      top: Math.min(activeCell.row, selectionAnchor.row),
      bottom: Math.max(activeCell.row, selectionAnchor.row),
      left: Math.min(activeCell.column, selectionAnchor.column),
      right: Math.max(activeCell.column, selectionAnchor.column),
    }
  }, [activeCell, selectionAnchor])

  const isCellSelected = (row: number, column: number) => {
    if (!selectedRange) return false
    return row >= selectedRange.top
      && row <= selectedRange.bottom
      && column >= selectedRange.left
      && column <= selectedRange.right
  }

  const focusCell = (position: CellPosition, extendSelection = false) => {
    if (rows.length === 0 || columns.length === 0) return
    const next = {
      row: clamp(position.row, 0, rows.length - 1),
      column: clamp(position.column, 0, columns.length - 1),
    }
    setActiveCell(next)
    if (!extendSelection) setSelectionAnchor(next)
    editingCellRef.current = null
    setEditingCell(null)
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-excel-cell="${next.row}:${next.column}"]`)
        ?.focus()
    })
  }

  const beginEditing = (position: CellPosition, initialValue?: string) => {
    const row = rows[position.row]
    const column = columns[position.column]
    if (!row || !column || !isColumnEditable(column, row)) return

    setActiveCell(position)
    setSelectionAnchor(position)
    editingCellRef.current = position
    setEditingCell(position)
    setEditValue(initialValue ?? getCellText(row, column))
    requestAnimationFrame(() => {
      const input = gridRef.current?.querySelector<HTMLInputElement>(
        `[data-excel-editor="${position.row}:${position.column}"]`
      )
      input?.focus()
      if (initialValue === undefined) input?.select()
    })
  }

  const commitEditing = (move?: CellPosition) => {
    const position = editingCellRef.current
    if (!position) return
    editingCellRef.current = null
    const row = rows[position.row]
    const column = columns[position.column]
    if (row && column) {
      onCellsChange([{
        row,
        columnKey: String(column.key),
        value: parseCellValue(column, editValue, row),
      }])
    }
    setEditingCell(null)
    if (move) focusCell(move)
  }

  const clearSelectedCells = () => {
    if (!selectedRange) return
    const changes: ExcelCellChange<T>[] = []
    for (let rowIndex = selectedRange.top; rowIndex <= selectedRange.bottom; rowIndex += 1) {
      for (let columnIndex = selectedRange.left; columnIndex <= selectedRange.right; columnIndex += 1) {
        const row = rows[rowIndex]
        const column = columns[columnIndex]
        if (row && column && isColumnEditable(column, row)) {
          changes.push({ row, columnKey: String(column.key), value: '' })
        }
      }
    }
    if (changes.length > 0) onCellsChange(changes)
  }

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!activeCell || editingCell) return

    const { row, column } = activeCell
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault()
      focusCell({ row: row + 1, column }, event.shiftKey && event.key === 'ArrowDown')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusCell({ row: row - 1, column }, event.shiftKey)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusCell({ row, column: column - 1 }, event.shiftKey)
    } else if (event.key === 'ArrowRight' || event.key === 'Tab') {
      event.preventDefault()
      focusCell(
        { row, column: column + (event.shiftKey ? -1 : 1) },
        event.shiftKey && event.key === 'ArrowRight'
      )
    } else if (event.key === 'F2') {
      event.preventDefault()
      beginEditing(activeCell)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      clearSelectedCells()
    } else if (
      event.key.length === 1
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
    ) {
      event.preventDefault()
      beginEditing(activeCell, event.key)
    }
  }

  const handleCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!selectedRange || editingCell) return
    const copiedRows: string[] = []
    for (let rowIndex = selectedRange.top; rowIndex <= selectedRange.bottom; rowIndex += 1) {
      const values: string[] = []
      for (let columnIndex = selectedRange.left; columnIndex <= selectedRange.right; columnIndex += 1) {
        const row = rows[rowIndex]
        const column = columns[columnIndex]
        values.push(row && column ? getCellText(row, column) : '')
      }
      copiedRows.push(values.join('\t'))
    }
    event.preventDefault()
    event.clipboardData.setData('text/plain', copiedRows.join('\n'))
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!activeCell || editingCell) return
    const clipboardRows = event.clipboardData
      .getData('text/plain')
      .replace(/\r/g, '')
      .split('\n')
    const changes: ExcelCellChange<T>[] = []

    clipboardRows.forEach((clipboardRow, rowOffset) => {
      clipboardRow.split('\t').forEach((value, columnOffset) => {
        const row = rows[activeCell.row + rowOffset]
        const column = columns[activeCell.column + columnOffset]
        if (row && column && isColumnEditable(column, row)) {
          changes.push({
            row,
            columnKey: String(column.key),
            value: parseCellValue(column, value, row),
          })
        }
      })
    })

    if (changes.length > 0) {
      event.preventDefault()
      onCellsChange(changes)
      setSelectionAnchor(activeCell)
      setActiveCell({
        row: Math.min(activeCell.row + clipboardRows.length - 1, rows.length - 1),
        column: Math.min(
          activeCell.column + Math.max(...clipboardRows.map(row => row.split('\t').length)) - 1,
          columns.length - 1
        ),
      })
    }
  }

  const startColumnResize = (
    event: React.PointerEvent<HTMLDivElement>,
    column: ExcelColumn<T>
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const key = String(column.key)
    const startX = event.clientX
    const startWidth = columnWidths[key] ?? DEFAULT_COLUMN_WIDTH
    const minimum = column.minWidth ?? MIN_COLUMN_WIDTH
    const maximum = column.maxWidth ?? MAX_COLUMN_WIDTH

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      setColumnWidthState({
        signature: columnSignature,
        widths: {
          ...columnWidths,
          [key]: clamp(startWidth + pointerEvent.clientX - startX, minimum, maximum),
        },
      })
    }
    const stopResize = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResize)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize)
  }

  const visibleRowIds = rows.map(getRowId)
  const allVisibleRowsSelected = visibleRowIds.length > 0
    && visibleRowIds.every(id => selectedRowIds.has(id))
  const selectedRows = allRows.filter(row => selectedRowIds.has(getRowId(row)))
  const tableWidth = ROW_HEADER_WIDTH + columns.reduce(
    (total, column) => total + (columnWidths[String(column.key)] ?? DEFAULT_COLUMN_WIDTH),
    0
  )

  return (
    <div className="w-full min-w-0 max-w-full">
      <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
        <div
          ref={gridRef}
          className="block w-max min-w-full outline-none"
          role="grid"
          aria-multiselectable="true"
          onKeyDown={handleGridKeyDown}
          onCopy={handleCopy}
          onPaste={handlePaste}
        >
        <table
          className="table-fixed border-collapse text-xs"
          style={{ minWidth: Math.max(640, tableWidth), width: tableWidth }}
          aria-busy={loading}
        >
          <colgroup>
            <col style={{ width: ROW_HEADER_WIDTH }} />
            {columns.map(column => (
              <col
                key={String(column.key)}
                style={{ width: columnWidths[String(column.key)] ?? DEFAULT_COLUMN_WIDTH }}
              />
            ))}
          </colgroup>
          <thead className="bg-secondary">
            <tr>
              <th
                className="sticky left-0 top-0 z-40 h-7 border-b border-r bg-secondary px-1 text-center text-[10px] font-semibold text-muted-foreground"
                scope="col"
              >
                {enableRowActions ? (
                  <input
                    type="checkbox"
                    aria-label="Select all visible rows"
                    checked={allVisibleRowsSelected}
                    onChange={() => {
                      setSelectedRowIds(previous => {
                        const next = new Set(previous)
                        visibleRowIds.forEach(id => {
                          if (allVisibleRowsSelected) next.delete(id)
                          else next.add(id)
                        })
                        return next
                      })
                    }}
                  />
                ) : '#'}
              </th>
              {columns.map((column, columnIndex) => {
                const key = String(column.key)
                const isSorted = sort.key === key
                const sortable = column.sortable !== false
                const frozen = frozenColumnIndexes.has(columnIndex)
                return (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`relative top-0 z-20 h-7 border-b border-r bg-secondary p-0 text-[11px] font-semibold uppercase text-foreground/70 ${frozen ? 'sticky z-30 shadow-[1px_0_0_var(--border)]' : 'sticky'}`}
                    style={frozen ? { left: getFrozenLeft(columnIndex) } : undefined}
                  >
                    <button
                      type="button"
                      disabled={!sortable}
                      onClick={() => onSort(key, sortable)}
                      className={`flex h-full w-full items-center gap-1 overflow-hidden px-2 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring/20 ${column.align === 'right' ? 'justify-end text-right' : column.align === 'center' ? 'justify-center text-center' : 'justify-start text-left'}`}
                    >
                      <span className="truncate">{column.label}</span>
                      {sortable && (isSorted
                        ? sort.direction === 'asc'
                          ? <ArrowUp className="size-3 shrink-0" aria-hidden="true" />
                          : <ArrowDown className="size-3 shrink-0" aria-hidden="true" />
                        : <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />)}
                    </button>
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${column.label} column`}
                      onPointerDown={event => startColumnResize(event, column)}
                      className="absolute inset-y-0 right-0 z-40 w-1 cursor-col-resize touch-none hover:bg-primary/50"
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                <td className="sticky left-0 z-20 h-7 border-b border-r bg-secondary/80" />
                {columns.map((column, columnIndex) => (
                  <td
                    key={String(column.key)}
                    className={`h-7 animate-pulse border-b border-r bg-muted/40 ${frozenColumnIndexes.has(columnIndex) ? 'sticky z-10' : ''}`}
                    style={frozenColumnIndexes.has(columnIndex)
                      ? { left: getFrozenLeft(columnIndex) }
                      : undefined}
                  />
                ))}
              </tr>
            ))}
            {!loading && rows.map((row, rowIndex) => {
              const rowId = getRowId(row)
              const rowSelected = selectedRowIds.has(rowId)
              return (
                <tr key={rowId} className={rowSelected ? 'bg-[var(--starbucks-gold)]/15' : ''}>
                  <th
                    scope="row"
                    className="sticky left-0 z-20 h-7 border-b border-r bg-secondary/90 px-1 text-center text-[10px] font-medium text-muted-foreground"
                  >
                    {enableRowActions ? (
                      <label className="flex cursor-pointer items-center justify-center gap-1">
                        <input
                          type="checkbox"
                          aria-label={`Select row ${firstRowNumber + rowIndex}`}
                          checked={rowSelected}
                          onChange={() => {
                            setSelectedRowIds(previous => {
                              const next = new Set(previous)
                              if (next.has(rowId)) next.delete(rowId)
                              else next.add(rowId)
                              return next
                            })
                          }}
                        />
                        <span>{firstRowNumber + rowIndex}</span>
                      </label>
                    ) : firstRowNumber + rowIndex}
                  </th>
                  {columns.map((column, columnIndex) => {
                    const position = { row: rowIndex, column: columnIndex }
                    const active = activeCell?.row === rowIndex && activeCell.column === columnIndex
                    const editing = editingCell?.row === rowIndex && editingCell.column === columnIndex
                    const selected = isCellSelected(rowIndex, columnIndex)
                    const editable = isColumnEditable(column, row)
                    const frozen = frozenColumnIndexes.has(columnIndex)
                    const editorType = getEditorType(column)

                    return (
                      <td
                        key={String(column.key)}
                        data-excel-cell={`${rowIndex}:${columnIndex}`}
                        role="gridcell"
                        aria-selected={selected}
                        tabIndex={active ? 0 : -1}
                        onPointerDown={event => {
                          if (editing) return
                          event.preventDefault()
                          dragSelectingRef.current = true
                          setActiveCell(position)
                          if (!event.shiftKey || !selectionAnchor) setSelectionAnchor(position)
                          event.currentTarget.focus()
                        }}
                        onPointerEnter={() => {
                          if (dragSelectingRef.current) setActiveCell(position)
                        }}
                        onDoubleClick={() => beginEditing(position)}
                        className={`relative h-7 overflow-hidden border-b border-r p-0 align-middle outline-none ${selected ? 'bg-primary/10' : rowIndex % 2 === 0 ? 'bg-card' : 'bg-secondary/25'} ${active ? 'ring-2 ring-inset ring-primary' : ''} ${frozen ? 'sticky z-10 shadow-[1px_0_0_var(--border)]' : ''}`}
                        style={frozen ? { left: getFrozenLeft(columnIndex) } : undefined}
                      >
                        {editing ? (
                          editorType === 'checkbox' ? (
                            <input
                              data-excel-editor={`${rowIndex}:${columnIndex}`}
                              type="checkbox"
                              checked={editValue === 'true' || editValue === '1'}
                              onChange={event => setEditValue(String(event.target.checked))}
                              onBlur={() => commitEditing()}
                              onKeyDown={event => {
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  editingCellRef.current = null
                                  setEditingCell(null)
                                  focusCell(position)
                                } else if (event.key === 'Enter' || event.key === 'Tab') {
                                  event.preventDefault()
                                  commitEditing({
                                    row: rowIndex + (event.key === 'Enter' ? 1 : 0),
                                    column: columnIndex + (event.key === 'Tab' ? (event.shiftKey ? -1 : 1) : 0),
                                  })
                                }
                              }}
                              className="mx-auto block"
                            />
                          ) : (
                            <input
                              data-excel-editor={`${rowIndex}:${columnIndex}`}
                              type={editorType}
                              inputMode={editorType === 'number' ? 'decimal' : undefined}
                              value={editValue}
                              onChange={event => setEditValue(event.target.value)}
                              onBlur={() => commitEditing()}
                              onKeyDown={event => {
                                event.stopPropagation()
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  editingCellRef.current = null
                                  setEditingCell(null)
                                  focusCell(position)
                                } else if (event.key === 'Enter' || event.key === 'Tab') {
                                  event.preventDefault()
                                  commitEditing({
                                    row: rowIndex + (event.key === 'Enter' ? 1 : 0),
                                    column: columnIndex + (event.key === 'Tab' ? (event.shiftKey ? -1 : 1) : 0),
                                  })
                                }
                              }}
                              className={`h-full w-full border-0 bg-card px-2 text-xs outline-none ${column.align === 'right' || editorType === 'number' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}
                            />
                          )
                        ) : (
                          <div
                            className={`truncate px-2 leading-7 ${editable ? 'cursor-cell' : 'cursor-default text-foreground/70'} ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}
                            title={getCellText(row, column)}
                          >
                            {renderCell(row, column)}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {enableRowActions && <div className="flex min-h-10 flex-wrap items-center gap-2 border-t bg-secondary/40 px-2 py-1.5">
        <button
          type="button"
          disabled={loading}
          onClick={onAddRow}
          className="inline-flex h-7 items-center gap-1 rounded border bg-background px-2 text-xs font-semibold text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add row
        </button>
        <button
          type="button"
          disabled={loading || selectedRows.length === 0}
          onClick={() => {
            onDeleteRows(selectedRows)
            setSelectedRowIds(new Set())
            setActiveCell(null)
            setSelectionAnchor(null)
          }}
          className="inline-flex h-7 items-center gap-1 rounded border border-destructive/40 bg-background px-2 text-xs font-semibold text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Delete selected{selectedRows.length > 0 ? ` (${selectedRows.length})` : ''}
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Double-click or type to edit · Ctrl+C / Ctrl+V to copy and paste
        </span>
      </div>}
    </div>
  )
}
