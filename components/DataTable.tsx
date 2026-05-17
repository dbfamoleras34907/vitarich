"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

import { DataTableColumn } from "@/lib/types"
import SearchableDropdown from "@/lib/SearchableDropdown"

type RowType = Record<string, any>

type DataTableProps = {
  columns: DataTableColumn[]
  rows: RowType[]
  setRowsAction: React.Dispatch<React.SetStateAction<RowType[]>>
  initialRows?: number
  allowAddRow?: boolean
  isfit?: boolean
}

export default function DataTable({
  columns,
  rows,
  setRowsAction,
  initialRows = 0,
  allowAddRow = false,
  isfit = false,

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
        // <div
        //   className="min-h-8 flex items-center px-2 cursor-text hover:bg-gray-100 "
        //   onClick={() =>
        //     setEditingCell({ row: rowIndex, col: col.code })
        //   }
        // >
        //   {value || "-"}
        // </div>
        <div
          className="
                    h-8
                    flex
                    items-center
                    px-2
                    cursor-text
                    
                    border
                    hover:bg-muted/50
                  "
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
          // <Input
          //   autoFocus
          //   type={col.type === "input" ? "text" : col.type}
          //   value={value ?? ""}
          //   disabled={col.disabled}
          //   onChange={(e) =>
          //     handleChange(rowIndex, col.code, e.target.value)
          //   }
          //   onBlur={exitEdit}
          //   onKeyDown={(e) => {
          //     if (e.key === "Enter") exitEdit()
          //     if (e.key === "Escape") exitEdit()
          //   }}
          // />
          <Input
            autoFocus
            type={col.type === "input" ? "text" : col.type}
            value={value ?? ""}
            disabled={col.disabled}
            className="
              h-8
              min-h-8
              shadow-none
              px-2
              border
              focus-visible:ring-0
              focus-visible:ring-offset-0
            "
            onChange={(e) =>
              handleChange(rowIndex, col.code, e.target.value)
            }
          // onBlur={exitEdit}
          // onKeyDown={(e) => {
          //   if (e.key === "Enter") exitEdit()
          //   if (e.key === "Escape") exitEdit()
          // }}
          />
        )

      case "text":
        return <span>{value || "-"}</span>

      case "checkbox":
        return (
          <div className=" items-center w-fit mx-auto h-5">
            <Checkbox
              checked={!!value}
              disabled={col.disabled}
              className="border-2  border-black/50  w-4 h-4 "
              onCheckedChange={(checked) =>
                handleChange(rowIndex, col.code, checked)
              }
            />
          </div>
        )

      case "search":
        return (
          <SearchableDropdown
            row={row}
            list={col.list || []}
            codeLabel="code"
            nameLabel="name"
            value={value}
            onChange={(val) =>
              handleChange(rowIndex, col.code, val)
            }
          />
          // <SearchableDropdown
          //   list={col.list || []}
          //   codeLabel="code"
          //   nameLabel="name"
          //   value={value}
          //   onChange={(val) =>
          //     handleChange(rowIndex, col.code, val)
          //   }
          // />

        )

      case "button":
        return null

      default:
        return <span>{value}</span>
    }
  }




  // return (
  //   <div className="space-y-2">



  //     <div className="border  overflow-auto">

  //       <table className={`${isfit ? "w-fit" : "w-full"} text-xs`}>

  //         {/* HEADER */}
  //         <thead className="bg-gray-100 sticky top-0">
  //           <tr>
  //             {columns.map((col) => (
  //               <th
  //                 key={col.code}
  //                 className="px-2 py-1 text-left font-semibold border whitespace-nowrap"
  //               >
  //                 {col.name}
  //               </th>
  //             ))}
  //           </tr>
  //         </thead>

  //         {/* BODY */}
  //         <tbody>
  //           {rows.map((row, rowIndex) => (
  //             <tr key={rowIndex} className="border-t hover:bg-gray-50">
  //               {columns.map((col) => (
  //                 <td
  //                   key={col.code}
  //                   className="px-2 py-1 border whitespace-nowrap"
  //                 >
  //                   {renderCell(
  //                     rowIndex,
  //                     col,
  //                     row[col.code]
  //                   )}
  //                 </td>
  //               ))}
  //             </tr>
  //           ))}
  //         </tbody>

  //       </table>
  //       {allowAddRow && (
  //         <div className="flex m-4">
  //           <Button type="button" onClick={addRow}>Add Row</Button>
  //         </div>
  //       )}
  //     </div>
  //   </div>
  // )

  return (
    <div className="space-y-2">

      <div className="overflow-auto -lg border ">

        <table
          className={`
          ${isfit ? "w-fit" : "w-full"}
          text-sm
          border-collapse
        `}
        >

          {/* HEADER */}
          <thead className="bg-muted border-b sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.code}
                  className="
                  px-4 py-2
                  text-left
                  font-medium
                  text-foreground
                  whitespace-nowrap
                "
                >
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="
                border-b
                hover:bg-muted/10
                transition-colors
              "
              >
                {columns.map((col) => (
                  <td
                    key={col.code}
                    className="
                  
                    whitespace-nowrap
                    align-middle
                  "
                  >
                    {col.type === "text" ? (
                      <div className="flex items-center ">

                        {/* <div
                          className="
                          h-8 w-8
                          -md
                          bg-muted
                          flex
                          items-center
                          justify-center
                          text-xs
                          font-medium
                          text-muted-foreground
                          shrink-0
                        "
                        >
                          {String(row[col.code] || "-")
                            ?.charAt(0)
                            ?.toUpperCase()}
                        </div> */}

                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-none truncate">
                            {renderCell(
                              rowIndex,
                              col,
                              row[col.code]
                            )}
                          </p>

                          {row.group && (
                            <p className="text-[11px] text-muted-foreground mt-1 truncate">
                              {row.group}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={
                          col.type === "checkbox"
                            ? "flex justify-center"
                            : ""
                        }
                      >
                        {renderCell(
                          rowIndex,
                          col,
                          row[col.code]
                        )}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

        </table>

        {allowAddRow && (
          <div className="border-t p-3">
            <Button
              size="sm"
              type="button"
              className="-md"
              onClick={addRow}
            >
              Add Row
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}