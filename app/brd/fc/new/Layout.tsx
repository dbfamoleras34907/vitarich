"use client";

import { useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  ReactNode,
  RefCallback,
} from "react";
import {
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import Help from "./Help";

const rows = Array.from({ length: 40 }, (_, i) => ({ age: i }));

const dataColumnCount = 27;
const ageColumnWidth = 50;
const dataColumnWidth = 80;
const headerRowHeight = 28;
const stripedRow = 5;
const tableMinWidth = ageColumnWidth + dataColumnCount * dataColumnWidth;
const middleHeaderTop = headerRowHeight;
const bottomHeaderTop = headerRowHeight * 2;
const trackingLabelLeft = ageColumnWidth + 16;

const initialGridValues = rows.map(() =>
  Array.from({ length: dataColumnCount }, () => "")
);

const editableColumnIndexes = new Set([
  0, // Mortality AM
  1, // Mortality PM
  3, // Thinning Other AM
  4, // Thinning Other PM
  7, // Feed Intake Daily
  11, // Water Intake Daily
  13, // Body weight Weight
  15, // Temp. Min
  16, // Temp. Max
  17, // Humidity Min
  18, // Humidity Max
  19, // NH3 Max ppm
  20, // Skin color B
  21, // Skin color A
  22, // Skin color L
]);

const editableColumns = [...editableColumnIndexes].sort((a, b) => a - b);

/**
 * Thick divider after every main logical group:
 *
 * Mortality      = 0 - 2
 * Thinning       = 3 - 4
 * Total          = 5 - 6
 * Feed Intake    = 7 - 10
 * Water Intake   = 11 - 12
 * Body Weight    = 13 - 14
 * Climate        = 15 - 19
 * Skin Color     = 20 - 22
 * Spacer         = 23 - 26
 */
const groupEndColumnIndexes = new Set([
  2,
  4,
  6,
  10,
  12,
  14,
  19,
  22,
  26,
]);

const stickyHeaderClass = "sticky z-[60] bg-slate-100";
// const groupHeaderClass = `${stickyHeaderClass} text-left font-semibold`;
// const subHeaderClass = `${stickyHeaderClass} text-center`;
// const leafHeaderClass = `${stickyHeaderClass} min-w-[100px] text-center`;
const groupHeaderClass =
  `${stickyHeaderClass} px-1 py-0 text-left font-semibold leading-none`;

const subHeaderClass =
  `${stickyHeaderClass} px-1 py-0 text-center leading-none`;

const leafHeaderClass =
  `${stickyHeaderClass} px-1 py-0 text-center leading-none`;

const trackingLabelClass = "sticky z-[70] inline-block";

type HeaderCellConfig = {
  label?: string;
  ariaLabel?: string;
  className: string;
  colSpan?: number;
  rowSpan?: number;
  groupEnd?: boolean;
  top?: number;
};

function getRightBorderClass(isGroupEnd: boolean) {
  return isGroupEnd
    ? "border-r-2 border-r-slate-500"
    : "border-r border-r-slate-300";
}

function getHeaderBorderClass(isGroupEnd = false) {
  return `border-b border-b-slate-300 ${getRightBorderClass(isGroupEnd)}`;
}

// function getBodyBorderClass(colIndex: number, isLastRow: boolean) {
//   return `${isLastRow ? "" : ""} ${getRightBorderClass(
//     groupEndColumnIndexes.has(colIndex)
//   )}`.trim();
// }

function getBodyBorderClass(colIndex: number, striped: boolean) {
  const bottomBorderClass = striped
    ? "border-b-2 border-b-slate-400"
    : "border-b border-b-slate-300";

  return `${bottomBorderClass} ${getRightBorderClass(
    groupEndColumnIndexes.has(colIndex)
  )}`;
}

function getFooterBorderClass(colIndex: number) {
  return `border-t border-t-slate-500 ${getRightBorderClass(
    groupEndColumnIndexes.has(colIndex)
  )}`;
}

function isStripedRow(rowIndex: number) {
  return stripedRow > 0 && (rowIndex + 1) % stripedRow === 0;
}

const topHeaderCells: HeaderCellConfig[] = [
  { label: "Mortality", colSpan: 3, groupEnd: true, className: groupHeaderClass, },
  { label: "Thinning", colSpan: 2, groupEnd: true, className: groupHeaderClass, },
  { label: "Total", colSpan: 2, groupEnd: true, className: groupHeaderClass, },
  { label: "Feed Intake", colSpan: 4, groupEnd: true, className: groupHeaderClass, },
  { label: "Water Intake", colSpan: 2, groupEnd: true, className: groupHeaderClass, },
  { label: "Body weight", colSpan: 2, groupEnd: true, className: groupHeaderClass, },
  { label: "Climate", colSpan: 5, groupEnd: true, className: groupHeaderClass, },
  { label: "Skin color", colSpan: 3, groupEnd: true, className: groupHeaderClass, },
  { ariaLabel: "Spacer", colSpan: 4, groupEnd: true, className: groupHeaderClass, },
];

const middleHeaderCells: HeaderCellConfig[] = [
  { label: "Deaths", colSpan: 3, groupEnd: true, top: middleHeaderTop, className: groupHeaderClass, },
  { label: "Other", colSpan: 2, groupEnd: true, top: middleHeaderTop, className: groupHeaderClass, },

  { label: "Total", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
  { label: "Cumulative", rowSpan: 2, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },

  { label: "Daily kg/Flock", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
  { label: "Daily per Bird", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
  { label: "Guideline", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
  { label: "Feeds Batch", rowSpan: 2, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },

  { label: "Daily L/Flock", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
  { label: "Daily per Bird", rowSpan: 2, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },

  { ariaLabel: "Body weight details", colSpan: 2, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },

  { label: "Temp.", colSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
  { label: "Humidity", colSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
  { label: "NH3", colSpan: 1, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },

  { ariaLabel: "Skin color details", colSpan: 3, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },
  { ariaLabel: "Spacer", colSpan: 4, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },
];

const bottomHeaderCells: HeaderCellConfig[] = [
  { label: "AM", top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "PM", top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "Total", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "AM", top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "PM", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "Weight g", top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "Guideline g", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "Min C", top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "Max C", top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "Min %", top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "Max %", top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "Max ppm", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "B (yellow)", top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "A (red)", top: bottomHeaderTop, className: leafHeaderClass, },
  { label: "L (luminosity)", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass, },

  {
    ariaLabel: "Spacer",
    colSpan: 4,
    groupEnd: true,
    top: bottomHeaderTop,
    className: leafHeaderClass,
  },
];

function CellInput({
  id,
  disabled,
  value,
  active,
  inputRef,
  onChange,
  onFocus,
  onKeyDown,
}: {
  id: string;
  disabled: boolean;
  value: string;
  active: boolean;
  inputRef: RefCallback<HTMLInputElement>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFocus: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <Input
      id={id}
      name={id}
      disabled={disabled}
      value={value}
      ref={inputRef}
      onChange={onChange}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      style={{ minWidth: dataColumnWidth }}
      className={`h-8 rounded-none border-0 bg-transparent text-center shadow-none disabled:cursor-not-allowed disabled:bg-slate-100/60 disabled:text-slate-400 ${active ? "font-semibold text-emerald-950 caret-black" : ""
        }`}
    />
  );
}

function HeaderLabel({ children }: { children: ReactNode }) {
  return (
    <span className={trackingLabelClass} style={{ left: trackingLabelLeft }}>
      {children}
    </span>
  );
}

function HeaderCell({ cell }: { cell: HeaderCellConfig }) {
  return (
    <TableHead
      colSpan={cell.colSpan}
      rowSpan={cell.rowSpan}
      aria-label={cell.ariaLabel}
      className={`${cell.className} ${getHeaderBorderClass(cell.groupEnd)}`}
      style={{
        height: headerRowHeight,
        minWidth: dataColumnWidth,
        top: cell.top ?? 0,
      }}
    >
      {cell.label ? <HeaderLabel>{cell.label}</HeaderLabel> : null}
    </TableHead>
  );
}

function HeaderCells({
  cells,
  rowName,
}: {
  cells: HeaderCellConfig[];
  rowName: string;
}) {
  return cells.map((cell, index) => (
    <HeaderCell
      key={`${rowName}-${cell.label ?? cell.ariaLabel}-${index}`}
      cell={cell}
      
    />
  ));
}

export default function StickyTablePage() {
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);

  const [gridValues, setGridValues] = useState(initialGridValues);
  const [numberOfAnimals, setNumberOfAnimals] = useState(21500);

  const [activeCell, setActiveCell] = useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  const computedGridValues = useMemo(() => {
    let cumulativeTotal = 0;

    return gridValues.map((row) => {
      const computedRow = [...row];

      const mortalityTotal =
        getNumericValue(row[0]) + getNumericValue(row[1]);

      const thinningTotal =
        getNumericValue(row[3]) + getNumericValue(row[4]);

      const rowTotal = mortalityTotal + thinningTotal;

      const hasRowTotal = [0, 1, 3, 4].some(
        (colIndex) => row[colIndex].trim() !== ""
      );

      computedRow[2] = formatComputedValue(mortalityTotal);
      computedRow[5] = formatComputedValue(rowTotal);

      if (hasRowTotal) {
        cumulativeTotal += rowTotal;
        computedRow[6] = formatComputedValue(cumulativeTotal);
      } else {
        computedRow[6] = "";
      }

      return computedRow;
    });
  }, [gridValues]);

  const columnTotals = useMemo(
    () =>
      Array.from({ length: dataColumnCount }, (_, colIndex) => {
        if (colIndex === 6) {
          return "";
        }

        let hasValue = false;

        const total = computedGridValues.reduce((sum, row) => {
          const numericValue = Number(row[colIndex].replaceAll(",", ""));

          if (Number.isNaN(numericValue) || row[colIndex].trim() === "") {
            return sum;
          }

          hasValue = true;

          return sum + numericValue;
        }, 0);

        return hasValue ? formatTotal(total) : "";
      }),
    [computedGridValues]
  );

  function handleCellChange(
    rowIndex: number,
    colIndex: number,
    value: string
  ) {
    setGridValues((currentValues) =>
      currentValues.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? row.map((cellValue, currentColIndex) =>
            currentColIndex === colIndex ? value : cellValue
          )
          : row
      )
    );
  }

  function focusCell(rowIndex: number, colIndex: number) {
    const input = inputRefs.current[rowIndex]?.[colIndex];

    if (!input || input.disabled) {
      return;
    }

    input.focus();
    input.select();
  }

  function getHorizontalTarget(
    rowIndex: number,
    colIndex: number,
    step: 1 | -1
  ) {
    const editableIndex = editableColumns.indexOf(colIndex);

    if (editableIndex === -1) {
      return null;
    }

    const nextColumnIndex = editableIndex + step;

    if (
      nextColumnIndex >= 0 &&
      nextColumnIndex < editableColumns.length
    ) {
      return {
        rowIndex,
        colIndex: editableColumns[nextColumnIndex],
      };
    }

    const nextRowIndex = rowIndex + step;

    if (nextRowIndex < 0 || nextRowIndex >= rows.length) {
      return null;
    }

    return {
      rowIndex: nextRowIndex,
      colIndex:
        step === 1
          ? editableColumns[0]
          : editableColumns[editableColumns.length - 1],
    };
  }

  function getVerticalTarget(
    rowIndex: number,
    colIndex: number,
    step: 1 | -1
  ) {
    const nextRowIndex = rowIndex + step;

    if (
      !editableColumnIndexes.has(colIndex) ||
      nextRowIndex < 0 ||
      nextRowIndex >= rows.length
    ) {
      return null;
    }

    return {
      rowIndex: nextRowIndex,
      colIndex,
    };
  }

  function moveFocus(target: { rowIndex: number; colIndex: number } | null) {
    if (target) {
      focusCell(target.rowIndex, target.colIndex);
    }
  }

  function handleCellKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) {
    const keyActions: Record<string, () => void> = {
      ArrowLeft: () =>
        moveFocus(getHorizontalTarget(rowIndex, colIndex, -1)),
      ArrowRight: () =>
        moveFocus(getHorizontalTarget(rowIndex, colIndex, 1)),
      ArrowUp: () =>
        moveFocus(getVerticalTarget(rowIndex, colIndex, -1)),
      ArrowDown: () =>
        moveFocus(getVerticalTarget(rowIndex, colIndex, 1)),
      Enter: () =>
        moveFocus(
          getVerticalTarget(
            rowIndex,
            colIndex,
            event.shiftKey ? -1 : 1
          )
        ),
      Tab: () =>
        moveFocus(
          getHorizontalTarget(
            rowIndex,
            colIndex,
            event.shiftKey ? -1 : 1
          )
        ),
    };

    const action = keyActions[event.key];

    if (!action) {
      return;
    }

    event.preventDefault();
    action();
  }

  return (
    <div className="h-screen w-full bg-slate-100 p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-white">
        <div className="mx-2 flex items-start justify-between gap-3 p-2">
          <label className="relative block w-82.5">
            <span>Number of animals</span>

            <Input
              value={numberOfAnimals}
              onChange={(event) =>
                setNumberOfAnimals(Number(event.target.value))
              }
            />
          </label>

          <Help />
        </div>

        <div className="relative flex-1 overflow-auto">
          <table
            className="table-fixed border-separate border-spacing-0 border-l border-t border-slate-300 caption-bottom text-sm"
            style={{ minWidth: tableMinWidth }}
          >
            <colgroup>
              <col style={{ width: ageColumnWidth }} />

              {Array.from({ length: dataColumnCount }).map((_, index) => (
                <col key={index} style={{ width: dataColumnWidth }} />
              ))}
            </colgroup>

            <TableHeader className="[&_tr]:border-0">
              <TableRow className="border-0" style={{ height: headerRowHeight }}>
                <TableHead
                  rowSpan={3}
                  className="sticky left-0 top-0 z-80 border-b border-b-slate-300 bg-slate-100 text-center shadow-[inset_-2px_0_0_0_#64748b]"
                  style={{ width: ageColumnWidth, minWidth: ageColumnWidth }}
                >
                  Age
                </TableHead>

                <HeaderCells cells={topHeaderCells} rowName="top" />
              </TableRow>

              <TableRow className="border-0" style={{ height: headerRowHeight }}>
                <HeaderCells cells={middleHeaderCells} rowName="middle" />
              </TableRow>

              <TableRow className="border-0" style={{ height: headerRowHeight }}>
                <HeaderCells cells={bottomHeaderCells} rowName="bottom" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((row, rowIndex) => {
                const striped = isStripedRow(rowIndex);

                return (
                  <TableRow key={row.age} className="border-0">
                    <TableCell
                      className={`sticky left-0 z-50 text-center font-semibold shadow-[inset_-2px_0_0_0_#64748b,inset_0_-1px_0_0_#cbd5e1] ${activeCell?.rowIndex === rowIndex
                        ? "bg-emerald-100 text-emerald-950"
                        : "bg-white"
                        }`}
                      style={{ width: ageColumnWidth, minWidth: ageColumnWidth }}
                    >
                      {row.age}
                    </TableCell>

                    {Array.from({ length: dataColumnCount }).map(
                      (_, colIndex) => {
                        const disabled = !editableColumnIndexes.has(colIndex);

                        const active =
                          activeCell?.rowIndex === rowIndex &&
                          activeCell.colIndex === colIndex;

                        return (
                          <TableCell
                            key={colIndex}
                            className={`${getBodyBorderClass(
                              colIndex,
                              striped
                            )} p-0 ${active
                              ? "relative z-20 bg-emerald-50 shadow-[inset_0_0_0_3px_#059669]"
                              : "bg-white"
                              }`}
                          >
                            <CellInput
                              id={`row-${rowIndex}-col-${colIndex}`}
                              disabled={disabled}
                              active={active}
                              value={computedGridValues[rowIndex][colIndex]}
                              inputRef={(element) => {
                                inputRefs.current[rowIndex] ??= [];
                                inputRefs.current[rowIndex][colIndex] = element;
                              }}
                              onChange={(event) =>
                                handleCellChange(
                                  rowIndex,
                                  colIndex,
                                  event.target.value
                                )
                              }
                              onFocus={() =>
                                setActiveCell({ rowIndex, colIndex })
                              }
                              onKeyDown={(event) =>
                                handleCellKeyDown(event, rowIndex, colIndex)
                              }
                            />
                          </TableCell>
                        );
                      }
                    )}
                  </TableRow>
                );
              })}
            </TableBody>

            <TableFooter>
              <TableRow className="border-0">
                <TableCell
                  className="sticky bottom-0 left-0 z-80 border-r-2 border-r-slate-500 border-t border-t-slate-500 bg-slate-900 text-center font-semibold text-white shadow-md"
                  style={{ width: ageColumnWidth, minWidth: ageColumnWidth }}
                >
                  Total
                </TableCell>

                {columnTotals.map((total, colIndex) => (
                  <TableCell
                    key={colIndex}
                    className={`sticky bottom-0   bg-slate-900 text-center font-semibold text-white ${getFooterBorderClass(
                      colIndex
                    )}`}
                  >
                    {total}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatTotal(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(3).replace(/\.?0+$/, "");
}

function getNumericValue(value: string) {
  const numericValue = Number(value.replaceAll(",", ""));

  return Number.isNaN(numericValue) || value.trim() === ""
    ? 0
    : numericValue;
}

function formatComputedValue(value: number) {
  return value === 0 ? "" : formatTotal(value);
}
