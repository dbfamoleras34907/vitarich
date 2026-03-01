"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { DataTableColumn } from "@/lib/types"
import SearchableDropdown from "@/lib/SearchableDropdown"

type RowType = Record<string, any>

type DataTableProps = {
  columns: DataTableColumn[]
  rows: RowType[]
  setRowsAction: React.Dispatch<React.SetStateAction<RowType[]>>
  initialRows?: number
  allowAddRow?: boolean
}

export default function DataTable({
  columns,
  rows,
  setRowsAction,
  initialRows = 0,
  allowAddRow = false,
}: DataTableProps) {
  const [editingCell, setEditingCell] = useState<{
    row: number
    col: string
  } | null>(null)

  const createEmptyRow = (): RowType => {
    const row: RowType = {}

    columns.forEach((col) => {
      if (col.type === "checkbox") row[col.code] = false
      else row[col.code] = ""
    })

    return row
  }

  useEffect(() => {
    if (rows.length === 0 && initialRows > 0) {
      setRowsAction(
        Array.from({ length: initialRows }, createEmptyRow)
      )
    }
  }, [rows.length, initialRows, columns, setRowsAction])

  const addRow = () => {
    setRowsAction((prev) => [...prev, createEmptyRow()])
  }

  const handleChange = (
    rowIndex: number,
    code: string,
    value: any
  ) => {
    setRowsAction((prev) => {
      const updated = [...prev]
      updated[rowIndex] = {
        ...updated[rowIndex],
        [code]: value,
      }
      return updated
    })
  }

  const exitEdit = () => setEditingCell(null)

  const renderCell = (
    rowIndex: number,
    col: DataTableColumn,
    value: any
  ) => {
    const row = rows[rowIndex]

    if (col.render) {
      return col.render(row, rowIndex)
    }

    const isEditing =
      editingCell?.row === rowIndex &&
      editingCell?.col === col.code

    const editableTypes = ["input", "number", "date"]

    if (
      !isEditing &&
      editableTypes.includes(col.type) &&
      !col.disabled
    ) {
      return (
        <div
          className="min-h-8 flex items-center px-2 cursor-text hover:bg-muted rounded"
          onClick={() =>
            setEditingCell({ row: rowIndex, col: col.code })
          }
        >
          {value || "-"}
        </div>
      )
    }

    switch (col.type) {
      case "input":
      case "number":
      case "date":
        return (
          <Input
            autoFocus
            type={col.type === "input" ? "text" : col.type}
            value={value ?? ""}
            disabled={col.disabled}
            onChange={(e) =>
              handleChange(rowIndex, col.code, e.target.value)
            }
            onBlur={exitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") exitEdit()
              if (e.key === "Escape") exitEdit()
            }}
          />
        )

      case "text":
        return <span>{value || "-"}</span>

      case "checkbox":
        return (
          <Checkbox
            checked={!!value}
            disabled={col.disabled}
            onCheckedChange={(checked) =>
              handleChange(rowIndex, col.code, checked)
            }
          />
        )

      case "search":
        return (
          <SearchableDropdown
            list={col.list || []}
            codeLabel="code"
            nameLabel="name"
            value={value}
            onChange={(val) =>
              handleChange(rowIndex, col.code, val)
            }
          />
        )

      case "button":
        return null

      default:
        return <span>{value}</span>
    }
  }

  return (
    <div className="space-y-2">
      {allowAddRow && (
        <div className="flex justify-end">
          <Button onClick={addRow}>Add Row</Button>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">

        <Table className="">
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead className="border-x" key={col.code}>
                  {col.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((col) => (
                  <TableCell className="border-x"  key={col.code}>
                    {renderCell(
                      rowIndex,
                      col,
                      row[col.code]
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}