export const rows = Array.from({ length: 40 }, (_, i) => ({ age: i }));

export const dataColumnCount = 28;
export const ageColumnWidth = 50;
export const dataColumnWidth = 80;
export const feedBatchMinColumnWidth = 140;
export const feedBatchMaxColumnWidth = 260;
export const mortalityBatchMinColumnWidth = 140;
export const mortalityBatchMaxColumnWidth = 260;
export const headerRowHeight = 28;
const stripedRow = 5;
const middleHeaderTop = headerRowHeight;
const bottomHeaderTop = headerRowHeight * 2;
export const trackingLabelLeft = ageColumnWidth + 16;
export const mortalityBatchColumnIndex = 6;
export const cumulativeTotalColumnIndex = 7;
export const feedDailyKgColumnIndex = 8;
export const feedDailyPerBirdColumnIndex = 9;
export const feedGuidelineColumnIndex = 10;
export const feedBatchColumnIndex = 11;
export const feedIntakeColumnIndexes = new Set([
  feedDailyKgColumnIndex,
  feedDailyPerBirdColumnIndex,
  feedGuidelineColumnIndex,
  feedBatchColumnIndex,
]);

export const columnIndexes = Array.from({ length: dataColumnCount }, (_, i) => i);

export const initialGridValues = rows.map(() =>
  Array.from({ length: dataColumnCount }, () => "")
);

export const editableColumnIndexes = new Set([
  0,
  1,
  3,
  4,
  feedDailyKgColumnIndex,
  feedBatchColumnIndex,
  mortalityBatchColumnIndex,
  12,
  14,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
]);

export const editableColumns = [...editableColumnIndexes].sort((a, b) => a - b);

export const columnDisabledFlags = columnIndexes.map(
  (colIndex) => !editableColumnIndexes.has(colIndex)
);

const groupEndColumnIndexes = new Set([2, 4, 7, 11, 13, 15, 20, 23, 27]);
const emphasizedColumnIndexes = new Set([2, 5, cumulativeTotalColumnIndex]);

const stickyHeaderClass = "fc-grid-header sticky z-30";
const groupHeaderClass =
  `${stickyHeaderClass} fc-grid-header-group px-1 py-0 text-left font-semibold leading-none`;
const subHeaderClass =
  `${stickyHeaderClass} px-1 py-0 text-center leading-none`;
const leafHeaderClass =
  `${stickyHeaderClass} px-1 py-0 text-center leading-none`;

export const trackingLabelClass = "sticky z-40 inline-block";

export type HeaderCellConfig = {
  label?: string;
  ariaLabel?: string;
  className: string;
  colSpan?: number;
  rowSpan?: number;
  groupEnd?: boolean;
  top?: number;
};

export function getZeroInputRow() {
  return Array.from({ length: dataColumnCount }, (_, colIndex) =>
    editableColumnIndexes.has(colIndex) &&
      colIndex !== feedBatchColumnIndex &&
      colIndex !== mortalityBatchColumnIndex
      ? "0"
      : ""
  );
}

export function shouldInitializeRowToZero(
  rowIndex: number,
  gridRow: string[],
  allocations: unknown[] = [],
  currentFlockAge: number | null,
) {
  if (currentFlockAge == null) return false;

  const rowAge = rows[rowIndex]?.age ?? rowIndex;
  if (rowAge > currentFlockAge) return false;

  return !gridRow.some(value => String(value ?? "").trim() !== "") && allocations.length === 0;
}

function getRightBorderClass(isGroupEnd: boolean) {
  return isGroupEnd
    ? "fc-grid-group-divider"
    : "fc-grid-border-r";
}

export function getHeaderBorderClass(isGroupEnd = false) {
  return `fc-grid-header-border ${getRightBorderClass(isGroupEnd)}`;
}

function getBodyBorderClass(colIndex: number, striped: boolean) {
  const bottomBorderClass = striped
    ? "fc-grid-row-divider-strong"
    : "fc-grid-row-divider";

  return `${bottomBorderClass} ${getRightBorderClass(
    groupEndColumnIndexes.has(colIndex)
  )}`;
}

function getFooterBorderClass(colIndex: number) {
  return `fc-grid-footer-border ${getRightBorderClass(
    groupEndColumnIndexes.has(colIndex)
  )}`;
}

export function isStripedRow(rowIndex: number) {
  return stripedRow > 0 && (rowIndex + 1) % stripedRow === 0;
}

export const footerBorderClasses = columnIndexes.map((colIndex) => getFooterBorderClass(colIndex));
export const bodyBorderClassesStriped = columnIndexes.map((colIndex) => getBodyBorderClass(colIndex, true));
export const bodyBorderClassesPlain = columnIndexes.map((colIndex) => getBodyBorderClass(colIndex, false));
export const bodyEmphasisClasses = columnIndexes.map((colIndex) =>
  emphasizedColumnIndexes.has(colIndex) ? "fc-grid-cell-emphasis" : ""
);

export const topHeaderCells: HeaderCellConfig[] = [
  { label: "Mortality", colSpan: 3, groupEnd: true, className: groupHeaderClass },
  { label: "Thinning", colSpan: 2, groupEnd: true, className: groupHeaderClass },
  { label: "Total", colSpan: 3, groupEnd: true, className: groupHeaderClass },
  { label: "Feed Intake", colSpan: 4, groupEnd: true, className: groupHeaderClass },
  { label: "Water Intake", colSpan: 2, groupEnd: true, className: groupHeaderClass },
  { label: "Body weight", colSpan: 2, groupEnd: true, className: groupHeaderClass },
  { label: "Climate", colSpan: 5, groupEnd: true, className: groupHeaderClass },
  { label: "Skin color", colSpan: 3, groupEnd: true, className: groupHeaderClass },
  { ariaLabel: "Spacer", colSpan: 4, groupEnd: true, className: groupHeaderClass },
];

export const middleHeaderCells: HeaderCellConfig[] = [
  { label: "Deaths", colSpan: 3, groupEnd: true, top: middleHeaderTop, className: groupHeaderClass },
  { label: "Other", colSpan: 2, groupEnd: true, top: middleHeaderTop, className: groupHeaderClass },
  { label: "Total", rowSpan: 2, top: middleHeaderTop, className: `${subHeaderClass} font-semibold` },
  { label: "DOC Batch", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass },
  { label: "Cumulative", rowSpan: 2, groupEnd: true, top: middleHeaderTop, className: `${subHeaderClass} font-semibold` },
  { label: "Daily kg/Flock", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass },
  { label: "Daily per Bird g/b", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass },
  { label: "Guideline g/b/d", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass },
  { label: "Feeds Batch", rowSpan: 2, groupEnd: true, top: middleHeaderTop, className: subHeaderClass },
  { label: "Daily L/Flock", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass },
  { label: "Daily per Bird", rowSpan: 2, groupEnd: true, top: middleHeaderTop, className: subHeaderClass },
  { ariaLabel: "Body weight details", colSpan: 2, groupEnd: true, top: middleHeaderTop, className: subHeaderClass },
  { label: "Temp.", colSpan: 2, top: middleHeaderTop, className: subHeaderClass },
  { label: "Humidity", colSpan: 2, top: middleHeaderTop, className: subHeaderClass },
  { label: "NH3", colSpan: 1, groupEnd: true, top: middleHeaderTop, className: subHeaderClass },
  { ariaLabel: "Skin color details", colSpan: 3, groupEnd: true, top: middleHeaderTop, className: subHeaderClass },
  { ariaLabel: "Spacer", colSpan: 4, groupEnd: true, top: middleHeaderTop, className: subHeaderClass },
];

export const bottomHeaderCells: HeaderCellConfig[] = [
  { label: "AM", top: bottomHeaderTop, className: leafHeaderClass },
  { label: "PM", top: bottomHeaderTop, className: leafHeaderClass },
  { label: "Total", groupEnd: true, top: bottomHeaderTop, className: `${leafHeaderClass} font-semibold` },
  { label: "AM", top: bottomHeaderTop, className: leafHeaderClass },
  { label: "PM", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass },
  { label: "Weight g", top: bottomHeaderTop, className: leafHeaderClass },
  { label: "Guideline g", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass },
  { label: "Min C", top: bottomHeaderTop, className: leafHeaderClass },
  { label: "Max C", top: bottomHeaderTop, className: leafHeaderClass },
  { label: "Min %", top: bottomHeaderTop, className: leafHeaderClass },
  { label: "Max %", top: bottomHeaderTop, className: leafHeaderClass },
  { label: "Max ppm", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass },
  { label: "B (yellow)", top: bottomHeaderTop, className: leafHeaderClass },
  { label: "A (red)", top: bottomHeaderTop, className: leafHeaderClass },
  { label: "L (luminosity)", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass },
  {
    ariaLabel: "Spacer",
    colSpan: 4,
    groupEnd: true,
    top: bottomHeaderTop,
    className: leafHeaderClass,
  },
];
