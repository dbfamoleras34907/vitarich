// "use client";

// import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
// import { useSearchParams } from "next/navigation";
// import type {
//   FocusEvent,
//   KeyboardEvent,
//   ReactNode,
//   RefCallback,
//   UIEvent,
// } from "react";
// import {
//   TableBody,
//   TableCell,
//   TableFooter,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
// import { toast } from "sonner";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import SearchableCombobox from "@/components/SearchableCombobox";
// import { useGlobalContext } from "@/lib/context/GlobalContext";
// import type { Items, WarehouseData } from "@/lib/types";
// import { getUserFarms } from "@/app/admin/user/new/api";
// import { ArrowRightCircle, Building2, Loader2, MousePointerClick, PackageCheck, Save, X } from "lucide-react";
// import {
//   getBatchTransactionTrail,
//   type BatchTransactionTrail,
// } from "@/app/inv/btch/api";
// import {
//   getFeedBatchOnHandByWarehouse,
//   getFarmBuildings,
//   saveFlockCard,
//   type FeedBatchOnHand,
//   type FarmBuildingOption,
//   type FlockCardLinePayload,
// } from "./api";
// import {
//   computeColumnTotals,
//   computeGridValues,
//   formatTotal,
//   getNumericValue,
// } from "./gridMath";
// import Help from "./Help";

// const rows = Array.from({ length: 40 }, (_, i) => ({ age: i }));

// const dataColumnCount = 27;
// const ageColumnWidth = 50;
// const dataColumnWidth = 80;
// const feedBatchMinColumnWidth = 140;
// const feedBatchMaxColumnWidth = 260;
// const headerRowHeight = 28;
// const stripedRow = 5;
// const middleHeaderTop = headerRowHeight;
// const bottomHeaderTop = headerRowHeight * 2;
// const trackingLabelLeft = ageColumnWidth + 16;
// const feedDailyKgColumnIndex = 7;
// const feedDailyPerBirdColumnIndex = 8;
// const feedBatchColumnIndex = 10;

// const initialGridValues = rows.map(() =>
//   Array.from({ length: dataColumnCount }, () => "")
// );

// const editableColumnIndexes = new Set([
//   0, // Mortality AM
//   1, // Mortality PM
//   3, // Thinning Other AM
//   4, // Thinning Other PM
//   feedDailyKgColumnIndex, // Feed Intake Daily
//   feedBatchColumnIndex, // Feed Intake Feeds Batch
//   11, // Water Intake Daily
//   13, // Body weight Weight
//   15, // Temp. Min
//   16, // Temp. Max
//   17, // Humidity Min
//   18, // Humidity Max
//   19, // NH3 Max ppm
//   20, // Skin color B
//   21, // Skin color A
//   22, // Skin color L
// ]);

// const editableColumns = [...editableColumnIndexes].sort((a, b) => a - b);

// /**
//  * Thick divider after every main logical group:
//  *
//  * Mortality      = 0 - 2
//  * Thinning       = 3 - 4
//  * Total          = 5 - 6
//  * Feed Intake    = 7 - 10
//  * Water Intake   = 11 - 12
//  * Body Weight    = 13 - 14
//  * Climate        = 15 - 19
//  * Skin Color     = 20 - 22
//  * Spacer         = 23 - 26
//  */
// const groupEndColumnIndexes = new Set([
//   2,
//   4,
//   6,
//   10,
//   12,
//   14,
//   19,
//   22,
//   26,
// ]);

// const stickyHeaderClass = "fc-grid-header sticky z-30";
// // const groupHeaderClass = `${stickyHeaderClass} text-left font-semibold`;
// // const subHeaderClass = `${stickyHeaderClass} text-center`;
// // const leafHeaderClass = `${stickyHeaderClass} min-w-[100px] text-center`;
// const groupHeaderClass =
//   `${stickyHeaderClass} fc-grid-header-group px-1 py-0 text-left font-semibold leading-none`;

// const subHeaderClass =
//   `${stickyHeaderClass} px-1 py-0 text-center leading-none`;

// const leafHeaderClass =
//   `${stickyHeaderClass} px-1 py-0 text-center leading-none`;

// const trackingLabelClass = "sticky z-40 inline-block";

// type HeaderCellConfig = {
//   label?: string;
//   ariaLabel?: string;
//   className: string;
//   colSpan?: number;
//   rowSpan?: number;
//   groupEnd?: boolean;
//   top?: number;
// };

// type FeedWarehouseAssociation = {
//   id?: number | null;
//   whse_code?: string | null;
//   whse_name?: string | null;
//   is_default_feed?: boolean | null;
// };

// type FlockCardNavigationContext = {
//   farmId?: number | string | null;
//   buildingKey?: string | null;
//   buildingId?: number | string | null;
//   animalQty?: number | string | null;
// };

// type FeedFarm = {
//   id: number;
//   code: string;
//   name: string | null;
//   associated_warehouses?: FeedWarehouseAssociation[] | string[] | null;
//   farm_id?: number | null;
//   farm_code?: string | null;
//   farm_name?: string | null;
// };

// type FeedBatchDialogMode = "onHand" | "cell";

// type FeedBatchAllocation = {
//   batchId: string;
//   batchNumber: string;
//   itemCode: string;
//   itemName: string;
//   warehouseCode: string;
//   manufacturingDate: string;
//   expiryDate: string;
//   availableQty: number;
//   selectedQty: number;
//   source: "MANUAL" | "FIFO";
// };

// const asArray = <T,>(value: unknown): T[] =>
//   Array.isArray(value) ? value as T[] : [];

// function normalizeFarmCode(value: unknown) {
//   return String(value ?? "").trim();
// }

// function normalizeFarm(farm: FeedFarm, masterFarms: FeedFarm[] = []): FeedFarm | null {
//   const code = normalizeFarmCode(farm.code ?? farm.farm_code);
//   if (!code) return null;

//   const masterFarm = masterFarms.find(candidate => normalizeFarmCode(candidate.code) === code);
//   const id = farm.id ?? farm.farm_id ?? masterFarm?.id ?? null;

//   if (id == null) return null;

//   return {
//     ...masterFarm,
//     ...farm,
//     id,
//     code,
//     name: farm.name ?? farm.farm_name ?? masterFarm?.name ?? code,
//     associated_warehouses: farm.associated_warehouses ?? masterFarm?.associated_warehouses ?? null,
//   };
// }

// const getCachedWarehouses = (value: unknown): WarehouseData[] => {
//   if (Array.isArray(value)) return value as WarehouseData[];
//   if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
//     return (value as { data: WarehouseData[] }).data;
//   }

//   return [];
// };

// function getAssociatedWarehouseCode(warehouse: FeedWarehouseAssociation | string) {
//   if (typeof warehouse === "string") return warehouse.trim();
//   return String(warehouse.whse_code ?? "").trim();
// }

// function getDefaultFeedWarehouseCode(farm?: FeedFarm | null) {
//   const associations = farm?.associated_warehouses;
//   if (!Array.isArray(associations)) return "";

//   const defaultWarehouse = associations.find(warehouse =>
//     typeof warehouse === "object" && Boolean(warehouse?.is_default_feed)
//   );

//   return defaultWarehouse ? getAssociatedWarehouseCode(defaultWarehouse) : "";
// }

// function isFeedItem(item: Items) {
//   const groupTokens = [
//     item.group,
//     item.item_group,
//   ].map(value => String(value ?? "").trim().toUpperCase());

//   if (groupTokens.includes("F") || groupTokens.includes("FEED") || groupTokens.includes("FEEDS")) {
//     return true;
//   }

//   return `${item.item_code ?? ""} ${item.item_name ?? ""} ${item.description ?? ""}`
//     .toLowerCase()
//     .includes("feed");
// }

// function formatQuantity(value: number) {
//   return Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 6 });
// }

// function formatDateValue(value: string) {
//   return value || "-";
// }

// function formatDateTime(value: string) {
//   if (!value) return "-";

//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return value;

//   return date.toLocaleString("en-PH", {
//     year: "numeric",
//     month: "short",
//     day: "2-digit",
//     hour: "2-digit",
//     minute: "2-digit",
//   });
// }

// function getBuildingStatusClass(status: string) {
//   const value = status.trim().toLowerCase();

//   if (["active", "occupied", "in use", "growing"].includes(value)) {
//     return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
//   }

//   if (["inactive", "closed", "maintenance"].includes(value)) {
//     return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
//   }

//   return "border-slate-200 bg-slate-50 text-slate-700 dark:border-border dark:bg-background dark:text-muted-foreground";
// }

// function getRightBorderClass(isGroupEnd: boolean) {
//   return isGroupEnd
//     ? "fc-grid-group-divider"
//     : "fc-grid-border-r";
// }

// function getHeaderBorderClass(isGroupEnd = false) {
//   return `fc-grid-header-border ${getRightBorderClass(isGroupEnd)}`;
// }

// // function getBodyBorderClass(colIndex: number, isLastRow: boolean) {
// //   return `${isLastRow ? "" : ""} ${getRightBorderClass(
// //     groupEndColumnIndexes.has(colIndex)
// //   )}`.trim();
// // }

// function getBodyBorderClass(colIndex: number, striped: boolean) {
//   const bottomBorderClass = striped
//     ? "fc-grid-row-divider-strong"
//     : "fc-grid-row-divider";

//   return `${bottomBorderClass} ${getRightBorderClass(
//     groupEndColumnIndexes.has(colIndex)
//   )}`;
// }

// function getFooterBorderClass(colIndex: number) {
//   return `fc-grid-footer-border ${getRightBorderClass(
//     groupEndColumnIndexes.has(colIndex)
//   )}`;
// }

// function isStripedRow(rowIndex: number) {
//   return stripedRow > 0 && (rowIndex + 1) % stripedRow === 0;
// }

// const topHeaderCells: HeaderCellConfig[] = [
//   { label: "Mortality", colSpan: 3, groupEnd: true, className: groupHeaderClass, },
//   { label: "Thinning", colSpan: 2, groupEnd: true, className: groupHeaderClass, },
//   { label: "Total", colSpan: 2, groupEnd: true, className: groupHeaderClass, },
//   { label: "Feed Intake", colSpan: 4, groupEnd: true, className: groupHeaderClass, },
//   { label: "Water Intake", colSpan: 2, groupEnd: true, className: groupHeaderClass, },
//   { label: "Body weight", colSpan: 2, groupEnd: true, className: groupHeaderClass, },
//   { label: "Climate", colSpan: 5, groupEnd: true, className: groupHeaderClass, },
//   { label: "Skin color", colSpan: 3, groupEnd: true, className: groupHeaderClass, },
//   { ariaLabel: "Spacer", colSpan: 4, groupEnd: true, className: groupHeaderClass, },
// ];

// const middleHeaderCells: HeaderCellConfig[] = [
//   { label: "Deaths", colSpan: 3, groupEnd: true, top: middleHeaderTop, className: groupHeaderClass, },
//   { label: "Other", colSpan: 2, groupEnd: true, top: middleHeaderTop, className: groupHeaderClass, },

//   { label: "Total", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
//   { label: "Cumulative", rowSpan: 2, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },

//   { label: "Daily kg/Flock", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
//   { label: "Daily per Bird", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
//   { label: "Guideline", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
//   { label: "Feeds Batch", rowSpan: 2, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },

//   { label: "Daily L/Flock", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
//   { label: "Daily per Bird", rowSpan: 2, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },

//   { ariaLabel: "Body weight details", colSpan: 2, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },

//   { label: "Temp.", colSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
//   { label: "Humidity", colSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
//   { label: "NH3", colSpan: 1, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },

//   { ariaLabel: "Skin color details", colSpan: 3, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },
//   { ariaLabel: "Spacer", colSpan: 4, groupEnd: true, top: middleHeaderTop, className: subHeaderClass, },
// ];

// const bottomHeaderCells: HeaderCellConfig[] = [
//   { label: "AM", top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "PM", top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "Total", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "AM", top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "PM", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "Weight g", top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "Guideline g", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "Min C", top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "Max C", top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "Min %", top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "Max %", top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "Max ppm", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "B (yellow)", top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "A (red)", top: bottomHeaderTop, className: leafHeaderClass, },
//   { label: "L (luminosity)", groupEnd: true, top: bottomHeaderTop, className: leafHeaderClass, },

//   {
//     ariaLabel: "Spacer",
//     colSpan: 4,
//     groupEnd: true,
//     top: bottomHeaderTop,
//     className: leafHeaderClass,
//   },
// ];

// function CellInput({
//   id,
//   disabled,
//   value,
//   inputRef,
//   onCommit,
//   onBlur,
//   onFocus,
//   onKeyDown,
// }: {
//   id: string;
//   disabled: boolean;
//   value: string;
//   inputRef: RefCallback<HTMLInputElement>;
//   onCommit: (value: string) => void;
//   onBlur: (value: string) => void;
//   onFocus: (event: FocusEvent<HTMLInputElement>) => void;
//   onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
// }) {
//   return (
//     <Input
//       key={`${id}-${value}`}
//       id={id}
//       name={id}
//       disabled={disabled}
//       defaultValue={value}
//       ref={inputRef}
//       onBlur={(event) => {
//         const nextValue = event.currentTarget.value;

//         window.setTimeout(() => {
//           onCommit(nextValue);
//           onBlur(nextValue);
//         }, 0);
//       }}
//       onFocus={onFocus}
//       onKeyDown={onKeyDown}
//       style={{ minWidth: dataColumnWidth }}
//       className="h-8 rounded-none border-0 bg-transparent text-center shadow-none transition-none focus:font-semibold focus:text-emerald-950 focus-visible:border-transparent focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[#7c766c] dark:focus:text-emerald-100 dark:disabled:bg-transparent dark:disabled:text-muted-foreground"
//     />
//   );
// }

// function HeaderLabel({ children }: { children: ReactNode }) {
//   return (
//     <span className={trackingLabelClass} style={{ left: trackingLabelLeft }}>
//       {children}
//     </span>
//   );
// }

// function HeaderCell({ cell }: { cell: HeaderCellConfig }) {
//   return (
//     <TableHead
//       colSpan={cell.colSpan}
//       rowSpan={cell.rowSpan}
//       aria-label={cell.ariaLabel}
//       className={`${cell.className} ${getHeaderBorderClass(cell.groupEnd)}`}
//       style={{
//         height: headerRowHeight,
//         minWidth: dataColumnWidth,
//         top: cell.top ?? 0,
//       }}
//     >
//       {cell.label ? <HeaderLabel>{cell.label}</HeaderLabel> : null}
//     </TableHead>
//   );
// }

// function HeaderCells({
//   cells,
//   rowName,
// }: {
//   cells: HeaderCellConfig[];
//   rowName: string;
// }) {
//   return cells.map((cell, index) => (
//     <HeaderCell
//       key={`${rowName}-${cell.label ?? cell.ariaLabel}-${index}`}
//       cell={cell}

//     />
//   ));
// }

// export default function StickyTablePage() {
//   const searchParams = useSearchParams();
//   const { getValue } = useGlobalContext();
//   const flockCardNavigationContext = getValue("brdFcNewContext") as FlockCardNavigationContext | undefined;
//   const inputRefs = useRef<(HTMLElement | null)[][]>([]);
//   const focusedCellStartValueRef = useRef("");
//   const suppressFeedBatchAutoOpenRef = useRef(false);
//   const autoSelectFeedBatchRef = useRef<() => void>(() => undefined);

//   const [gridValues, setGridValues] = useState(initialGridValues);
//   const [, startGridTransition] = useTransition();
//   const deferredGridValues = useDeferredValue(gridValues);
//   const [numberOfAnimals, setNumberOfAnimals] = useState(21500);
//   const [flockCardId, setFlockCardId] = useState<number | null>(null);
//   const [flockCardNo, setFlockCardNo] = useState("");
//   const [saving, setSaving] = useState(false);
//   const [selectedFarmId, setSelectedFarmId] = useState("");
//   const [selectedBuildingId, setSelectedBuildingId] = useState("");
//   const [selectedWarehouseCode, setSelectedWarehouseCode] = useState("");
//   const [fallbackAssignedFarms, setFallbackAssignedFarms] = useState<FeedFarm[]>([]);
//   const [farmBuildings, setFarmBuildings] = useState<FarmBuildingOption[]>([]);
//   const [loadingFarmBuildings, setLoadingFarmBuildings] = useState(false);
//   const [farmBuildingError, setFarmBuildingError] = useState("");
//   const [feedBatchRows, setFeedBatchRows] = useState<FeedBatchOnHand[]>([]);
//   const [loadingFeedBatches, setLoadingFeedBatches] = useState(false);
//   const [feedBatchError, setFeedBatchError] = useState("");
//   const [feedBatchDialogOpen, setFeedBatchDialogOpen] = useState(false);
//   const [feedBatchDialogMode, setFeedBatchDialogMode] = useState<FeedBatchDialogMode>("onHand");
//   const [feedBatchSelectionRowIndex, setFeedBatchSelectionRowIndex] = useState<number | null>(null);
//   const [feedBatchAllocationsByRow, setFeedBatchAllocationsByRow] = useState<Record<number, FeedBatchAllocation[]>>({});
//   const [reviewFeedBatch, setReviewFeedBatch] = useState<FeedBatchOnHand | null>(null);
//   const [feedBatchTraceRows, setFeedBatchTraceRows] = useState<BatchTransactionTrail[]>([]);
//   const [loadingFeedBatchTrace, setLoadingFeedBatchTrace] = useState(false);
//   const [feedBatchTraceError, setFeedBatchTraceError] = useState("");
//   const [headerOpen, setHeaderOpen] = useState(true);
//   const headerOpenRef = useRef(true);

//   const requestedFarmId = String(flockCardNavigationContext?.farmId ?? searchParams.get("farmId") ?? "");
//   const requestedBuildingKey = String(flockCardNavigationContext?.buildingKey ?? searchParams.get("buildingKey") ?? "");
//   const requestedBuildingId = String(flockCardNavigationContext?.buildingId ?? searchParams.get("buildingId") ?? "");
//   const hasLockedFlockContext = Boolean(flockCardNavigationContext?.buildingKey);

//   const farmMaster = useMemo(() => {
//     const goodsReceiptReferences = getValue("goodsReceiptReferences") as
//       | { farms?: FeedFarm[] }
//       | undefined;

//     const referenceFarms = asArray<FeedFarm>(goodsReceiptReferences?.farms);
//     return referenceFarms.length
//       ? referenceFarms
//       : asArray<FeedFarm>(getValue("getFarmDB"));
//   }, [getValue]);

//   const sessionUser = getValue("UserInfoAuthSession")?.[0] as
//     | { id?: number | string; users_farms?: unknown[] }
//     | undefined;

//   const assignedFarmCodes = useMemo(
//     () => asArray<unknown>(sessionUser?.users_farms).map(normalizeFarmCode).filter(Boolean),
//     [sessionUser?.users_farms]
//   );

//   const farms = useMemo(() => {
//     const normalizedMasterFarms = farmMaster
//       .map(farm => normalizeFarm(farm, farmMaster))
//       .filter((farm): farm is FeedFarm => Boolean(farm));

//     if (assignedFarmCodes.length > 0) {
//       const assignedCodeSet = new Set(assignedFarmCodes);
//       return normalizedMasterFarms.filter(farm => assignedCodeSet.has(farm.code));
//     }

//     return fallbackAssignedFarms
//       .map(farm => normalizeFarm(farm, farmMaster))
//       .filter((farm): farm is FeedFarm => Boolean(farm));
//   }, [assignedFarmCodes, fallbackAssignedFarms, farmMaster]);

//   const warehouses = useMemo(
//     () => getCachedWarehouses(getValue("warehouses")),
//     [getValue]
//   );

//   const feedItems = useMemo(
//     () => asArray<Items>(getValue("itemmaster"))
//       .filter(item => item.void === 1 || item.void == null)
//       .filter(isFeedItem),
//     [getValue]
//   );

//   const feedItemCodes = useMemo(
//     () => feedItems
//       .map(item => String(item.item_code ?? "").trim())
//       .filter(Boolean),
//     [feedItems]
//   );

//   const feedItemNameByCode = useMemo(() => {
//     const map = new Map<string, string>();

//     feedItems.forEach(item => {
//       const code = String(item.item_code ?? "").trim().toUpperCase();
//       if (!code) return;
//       map.set(code, item.item_name || item.description || code);
//     });

//     return map;
//   }, [feedItems]);

//   const feedItemByCode = useMemo(() => {
//     const map = new Map<string, Items>();

//     feedItems.forEach(item => {
//       const code = String(item.item_code ?? "").trim().toUpperCase();
//       if (code) map.set(code, item);
//     });

//     return map;
//   }, [feedItems]);

//   const warehouseByCode = useMemo(() => {
//     const map = new Map<string, WarehouseData>();

//     warehouses.forEach(warehouse => {
//       const code = String(warehouse.whse_code ?? "").trim().toUpperCase();
//       if (code) map.set(code, warehouse);
//     });

//     return map;
//   }, [warehouses]);

//   const selectedFarm = useMemo(
//     () => farms.find(farm => String(farm.id) === selectedFarmId) ?? null,
//     [farms, selectedFarmId]
//   );

//   const selectedBuilding = useMemo(
//     () => farmBuildings.find(building => building.key === selectedBuildingId) ?? null,
//     [farmBuildings, selectedBuildingId]
//   );

//   const farmOptions = useMemo(
//     () => farms.map(farm => ({
//       code: String(farm.id),
//       name: farm.code ? `${farm.code} - ${farm.name ?? ""}` : farm.name ?? String(farm.id),
//     })),
//     [farms]
//   );

//   const selectedWarehouse = useMemo(
//     () => warehouses.find(warehouse =>
//       String(warehouse.whse_code ?? "").trim() === selectedWarehouseCode
//     ) ?? null,
//     [warehouses, selectedWarehouseCode]
//   );

//   const selectedWarehouseLabel = selectedWarehouse
//     ? selectedWarehouse.whse_name
//       ? `${selectedWarehouse.whse_code} - ${selectedWarehouse.whse_name}`
//       : String(selectedWarehouse.whse_code ?? "")
//     : selectedWarehouseCode;

//   const totalFeedOnHand = useMemo(
//     () => feedBatchRows.reduce((total, row) => total + Number(row.onHandQty || 0), 0),
//     [feedBatchRows]
//   );

//   const fifoFeedBatchRows = useMemo(
//     () => [...feedBatchRows].sort((left, right) => {
//       const leftDate = left.manufacturingDate || left.expiryDate || "9999-12-31";
//       const rightDate = right.manufacturingDate || right.expiryDate || "9999-12-31";

//       return leftDate.localeCompare(rightDate) ||
//         left.itemCode.localeCompare(right.itemCode) ||
//         left.batchNumber.localeCompare(right.batchNumber);
//     }),
//     [feedBatchRows]
//   );

//   const feedBatchSelectionAge = feedBatchSelectionRowIndex == null
//     ? null
//     : rows[feedBatchSelectionRowIndex]?.age ?? null;

//   const feedBatchColumnWidth = useMemo(() => {
//     const longestBatchLength = gridValues.reduce((longest, row) => {
//       return Math.max(longest, row[feedBatchColumnIndex]?.trim().length ?? 0);
//     }, 0);

//     if (longestBatchLength === 0) return feedBatchMinColumnWidth;

//     return Math.min(
//       feedBatchMaxColumnWidth,
//       Math.max(feedBatchMinColumnWidth, longestBatchLength * 9 + 40)
//     );
//   }, [gridValues]);

//   const columnWidths = useMemo(
//     () => Array.from({ length: dataColumnCount }, (_, colIndex) =>
//       colIndex === feedBatchColumnIndex ? feedBatchColumnWidth : dataColumnWidth
//     ),
//     [feedBatchColumnWidth]
//   );

//   const tableMinWidth = useMemo(
//     () => ageColumnWidth + columnWidths.reduce((total, width) => total + width, 0),
//     [columnWidths]
//   );

//   const activeFeedBatchAllocations = useMemo(
//     () => feedBatchSelectionRowIndex == null
//       ? []
//       : feedBatchAllocationsByRow[feedBatchSelectionRowIndex] ?? [],
//     [feedBatchAllocationsByRow, feedBatchSelectionRowIndex]
//   );

//   const activeFeedRequiredQty = feedBatchSelectionRowIndex == null
//     ? 0
//     : getNumericValue(gridValues[feedBatchSelectionRowIndex]?.[feedDailyKgColumnIndex] ?? "");

//   const activeFeedAllocatedQty = activeFeedBatchAllocations.reduce(
//     (total, allocation) => total + Number(allocation.selectedQty || 0),
//     0
//   );

//   const activeFeedRemainingQty = Math.max(activeFeedRequiredQty - activeFeedAllocatedQty, 0);

//   const activeAvailableFeedBatches = useMemo(
//     () => fifoFeedBatchRows.map(row => {
//       const selectedQty = activeFeedBatchAllocations
//         .filter(allocation => allocation.batchId === row.id)
//         .reduce((total, allocation) => total + Number(allocation.selectedQty || 0), 0);

//       return {
//         ...row,
//         allocatedQty: selectedQty,
//         availableToSelect: Math.max(Number(row.onHandQty || 0) - selectedQty, 0),
//       };
//     }),
//     [activeFeedBatchAllocations, fifoFeedBatchRows]
//   );

//   useEffect(() => {
//     if (assignedFarmCodes.length > 0 || !sessionUser?.id) return;

//     let cancelled = false;

//     getUserFarms(Number(sessionUser.id))
//       .then(farms => {
//         if (cancelled) return;
//         setFallbackAssignedFarms(Array.isArray(farms) ? farms as FeedFarm[] : []);
//       })
//       .catch(error => {
//         console.error(error);
//         if (!cancelled) setFallbackAssignedFarms([]);
//       });

//     return () => {
//       cancelled = true;
//     };
//   }, [assignedFarmCodes.length, sessionUser?.id]);

//   useEffect(() => {
//     const animalQty = Number(flockCardNavigationContext?.animalQty ?? 0);
//     if (Number.isFinite(animalQty) && animalQty > 0) {
//       setNumberOfAnimals(animalQty);
//     }
//   }, [flockCardNavigationContext?.animalQty]);

//   useEffect(() => {
//     if (selectedFarmId || farms.length === 0) return;

//     const requestedFarm = farms.find(farm => String(farm.id) === requestedFarmId);
//     const defaultFarmId = getValue("DefaultFarmId");
//     const defaultFarm = farms.find(farm => String(farm.id) === String(defaultFarmId));
//     const nextFarm = requestedFarm ?? defaultFarm ?? farms[0];

//     if (nextFarm) setSelectedFarmId(String(nextFarm.id));
//   }, [farms, getValue, requestedFarmId, selectedFarmId]);

//   useEffect(() => {
//     if (!selectedFarm) {
//       setFarmBuildings([]);
//       setSelectedBuildingId("");
//       setFarmBuildingError("");
//       setLoadingFarmBuildings(false);
//       return;
//     }

//     let cancelled = false;
//     setLoadingFarmBuildings(true);
//     setFarmBuildingError("");

//     getFarmBuildings(selectedFarm.id)
//       .then(buildings => {
//         if (cancelled) return;

//         setFarmBuildings(buildings);
//         setSelectedBuildingId(current => {
//           if (current && buildings.some(building => building.key === current)) {
//             return current;
//           }

//           const requestedBuilding = buildings.find(building =>
//             building.key === requestedBuildingKey ||
//             (requestedBuildingId && String(building.id) === requestedBuildingId)
//           );
//           if (requestedBuilding) return requestedBuilding.key;

//           return buildings[0]?.key ?? "";
//         });
//       })
//       .catch(error => {
//         console.error(error);
//         if (!cancelled) {
//           setFarmBuildings([]);
//           setSelectedBuildingId("");
//           setFarmBuildingError("Unable to load farm buildings.");
//         }
//       })
//       .finally(() => {
//         if (!cancelled) setLoadingFarmBuildings(false);
//       });

//     return () => {
//       cancelled = true;
//     };
//   }, [requestedBuildingId, requestedBuildingKey, selectedFarm]);

//   useEffect(() => {
//     if (!selectedFarm) {
//       if (selectedWarehouseCode) setSelectedWarehouseCode("");
//       return;
//     }

//     const defaultFeedWarehouseCode = getDefaultFeedWarehouseCode(selectedFarm);
//     if (selectedWarehouseCode === defaultFeedWarehouseCode) return;

//     setSelectedWarehouseCode(defaultFeedWarehouseCode);
//   }, [selectedFarm, selectedWarehouseCode]);

//   useEffect(() => {
//     if (!selectedWarehouseCode || feedItemCodes.length === 0) {
//       setFeedBatchRows([]);
//       setFeedBatchError("");
//       setLoadingFeedBatches(false);
//       return;
//     }

//     let cancelled = false;
//     setLoadingFeedBatches(true);
//     setFeedBatchError("");

//     getFeedBatchOnHandByWarehouse(feedItemCodes, selectedWarehouseCode)
//       .then(rows => {
//         if (cancelled) return;

//         setFeedBatchRows(rows.map(row => ({
//           ...row,
//           itemName: feedItemNameByCode.get(row.itemCode.toUpperCase()) ?? row.itemName,
//         })));
//       })
//       .catch(error => {
//         console.error(error);
//         if (!cancelled) {
//           setFeedBatchRows([]);
//           setFeedBatchError("Unable to load feed batch on-hand.");
//         }
//       })
//       .finally(() => {
//         if (!cancelled) setLoadingFeedBatches(false);
//       });

//     return () => {
//       cancelled = true;
//     };
//   }, [feedItemCodes, feedItemNameByCode, selectedWarehouseCode]);

//   useEffect(() => {
//     if (!reviewFeedBatch) {
//       setFeedBatchTraceRows([]);
//       setFeedBatchTraceError("");
//       setLoadingFeedBatchTrace(false);
//       return;
//     }

//     let cancelled = false;
//     setFeedBatchTraceRows([]);
//     setFeedBatchTraceError("");
//     setLoadingFeedBatchTrace(true);

//     getBatchTransactionTrail(
//       reviewFeedBatch.itemCode,
//       reviewFeedBatch.batchNumber,
//     )
//       .then(rows => {
//         if (!cancelled) setFeedBatchTraceRows(rows);
//       })
//       .catch(error => {
//         console.error(error);
//         if (!cancelled) setFeedBatchTraceError("Unable to load batch transaction trail.");
//       })
//       .finally(() => {
//         if (!cancelled) setLoadingFeedBatchTrace(false);
//       });

//     return () => {
//       cancelled = true;
//     };
//   }, [reviewFeedBatch]);

//   const computedGridValues = useMemo(
//     () =>
//       computeGridValues({
//         gridValues: deferredGridValues,
//         numberOfAnimals,
//         feedDailyKgColumnIndex,
//         feedDailyPerBirdColumnIndex,
//       }),
//     [deferredGridValues, numberOfAnimals]
//   );

//   const columnTotals = useMemo(
//     () => computeColumnTotals({ computedGridValues, dataColumnCount }),
//     [computedGridValues]
//   );

//   const latestComputedGridValues = useMemo(
//     () =>
//       computeGridValues({
//         gridValues,
//         numberOfAnimals,
//         feedDailyKgColumnIndex,
//         feedDailyPerBirdColumnIndex,
//       }),
//     [gridValues, numberOfAnimals]
//   );

//   function handleCellChange(
//     rowIndex: number,
//     colIndex: number,
//     value: string
//   ) {
//     startGridTransition(() => {
//       setGridValues((currentValues) => {
//         if (currentValues[rowIndex]?.[colIndex] === value) {
//           return currentValues;
//         }

//         return currentValues.map((row, currentRowIndex) =>
//           currentRowIndex === rowIndex
//             ? row.map((cellValue, currentColIndex) =>
//               currentColIndex === colIndex ? value : cellValue
//             )
//             : row
//         );
//       });
//     });

//     if (colIndex === feedDailyKgColumnIndex && getNumericValue(value) <= 0) {
//       setFeedBatchAllocationsByRow(current => ({
//         ...current,
//         [rowIndex]: [],
//       }));
//       startGridTransition(() => {
//         setGridValues(currentValues =>
//           currentValues.map((row, currentRowIndex) =>
//             currentRowIndex === rowIndex
//               ? row.map((cellValue, currentColIndex) =>
//                 currentColIndex === feedBatchColumnIndex ? "" : cellValue
//               )
//               : row
//           )
//         );
//       });
//     }
//   }

//   function rowHasFeedQuantity(rowIndex: number) {
//     return getNumericValue(gridValues[rowIndex]?.[feedDailyKgColumnIndex] ?? "") > 0;
//   }

//   function formatFeedBatchAllocationCell(allocations: FeedBatchAllocation[]) {
//     return allocations
//       .filter(allocation => allocation.selectedQty > 0)
//       .map(allocation => `${allocation.batchNumber} (${formatTotal(allocation.selectedQty)})`)
//       .join(", ");
//   }

//   function commitFeedBatchAllocations(rowIndex: number, allocations: FeedBatchAllocation[]) {
//     const normalizedAllocations = allocations.filter(allocation => allocation.selectedQty > 0);

//     setFeedBatchAllocationsByRow(current => ({
//       ...current,
//       [rowIndex]: normalizedAllocations,
//     }));
//     handleCellChange(rowIndex, feedBatchColumnIndex, formatFeedBatchAllocationCell(normalizedAllocations));
//   }

//   function toFeedBatchAllocation(
//     batch: FeedBatchOnHand,
//     selectedQty: number,
//     source: "MANUAL" | "FIFO" = "MANUAL"
//   ): FeedBatchAllocation {
//     return {
//       batchId: batch.id,
//       batchNumber: batch.batchNumber,
//       itemCode: batch.itemCode,
//       itemName: batch.itemName || feedItemNameByCode.get(batch.itemCode.toUpperCase()) || batch.itemCode,
//       warehouseCode: batch.warehouseCode,
//       manufacturingDate: batch.manufacturingDate,
//       expiryDate: batch.expiryDate,
//       availableQty: Number(batch.onHandQty || 0),
//       selectedQty,
//       source,
//     };
//   }

//   function addFeedBatchAllocation(batch: FeedBatchOnHand) {
//     if (feedBatchSelectionRowIndex == null) return;

//     const existingAllocations = feedBatchAllocationsByRow[feedBatchSelectionRowIndex] ?? [];
//     const selectedForBatch = existingAllocations
//       .filter(allocation => allocation.batchId === batch.id)
//       .reduce((total, allocation) => total + Number(allocation.selectedQty || 0), 0);
//     const availableToSelect = Math.max(Number(batch.onHandQty || 0) - selectedForBatch, 0);
//     const qtyToSelect = Math.min(activeFeedRemainingQty, availableToSelect);

//     if (qtyToSelect <= 0) return;

//     const nextAllocations = existingAllocations.some(allocation => allocation.batchId === batch.id)
//       ? existingAllocations.map(allocation =>
//         allocation.batchId === batch.id
//           ? { ...allocation, selectedQty: allocation.selectedQty + qtyToSelect }
//           : allocation
//       )
//       : [...existingAllocations, toFeedBatchAllocation(batch, qtyToSelect)];

//     commitFeedBatchAllocations(feedBatchSelectionRowIndex, nextAllocations);
//   }

//   function updateFeedBatchAllocationQty(batchId: string, value: string) {
//     if (feedBatchSelectionRowIndex == null) return;

//     const requestedQty = Math.max(getNumericValue(value), 0);
//     const currentAllocations = feedBatchAllocationsByRow[feedBatchSelectionRowIndex] ?? [];

//     const otherAllocatedQty = currentAllocations
//       .filter(allocation => allocation.batchId !== batchId)
//       .reduce((total, allocation) => total + Number(allocation.selectedQty || 0), 0);

//     const nextAllocations = currentAllocations.map(allocation => {
//       if (allocation.batchId !== batchId) return allocation;

//       const maxForRow = Math.max(activeFeedRequiredQty - otherAllocatedQty, 0);
//       return {
//         ...allocation,
//         selectedQty: Math.min(requestedQty, allocation.availableQty, maxForRow),
//       };
//     });

//     commitFeedBatchAllocations(feedBatchSelectionRowIndex, nextAllocations);
//   }

//   function removeFeedBatchAllocation(batchId: string) {
//     if (feedBatchSelectionRowIndex == null) return;

//     commitFeedBatchAllocations(
//       feedBatchSelectionRowIndex,
//       (feedBatchAllocationsByRow[feedBatchSelectionRowIndex] ?? []).filter(
//         allocation => allocation.batchId !== batchId
//       )
//     );
//   }

//   function finishFeedBatchAllocation() {
//     if (feedBatchSelectionRowIndex == null) return;

//     setFeedBatchSelectionRowIndex(null);
//     setFeedBatchDialogOpen(false);
//     focusCell(feedBatchSelectionRowIndex, feedBatchColumnIndex);
//   }

//   function autoSelectFeedBatch() {
//     if (feedBatchSelectionRowIndex == null || fifoFeedBatchRows.length === 0) return;

//     let remainingQty = activeFeedRequiredQty;
//     const allocations: FeedBatchAllocation[] = [];

//     for (const batch of fifoFeedBatchRows) {
//       if (remainingQty <= 0) break;

//       const selectedQty = Math.min(remainingQty, Number(batch.onHandQty || 0));
//       if (selectedQty <= 0) continue;

//       allocations.push(toFeedBatchAllocation(batch, selectedQty, "FIFO"));
//       remainingQty -= selectedQty;
//     }

//     commitFeedBatchAllocations(feedBatchSelectionRowIndex, allocations);
//   }

//   autoSelectFeedBatchRef.current = autoSelectFeedBatch;

//   useEffect(() => {
//     const canAutoSelect =
//       feedBatchDialogOpen &&
//       feedBatchDialogMode === "cell" &&
//       feedBatchSelectionRowIndex != null &&
//       !loadingFeedBatches &&
//       activeFeedRequiredQty > 0 &&
//       fifoFeedBatchRows.length > 0;

//     if (!canAutoSelect) return;

//     const handleKeyDown = (event: globalThis.KeyboardEvent) => {
//       if (!event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase() !== "a") {
//         return;
//       }

//       event.preventDefault();
//       autoSelectFeedBatchRef.current();
//     };

//     window.addEventListener("keydown", handleKeyDown);

//     return () => {
//       window.removeEventListener("keydown", handleKeyDown);
//     };
//   }, [
//     feedBatchDialogOpen,
//     feedBatchDialogMode,
//     feedBatchSelectionRowIndex,
//     loadingFeedBatches,
//     activeFeedRequiredQty,
//     fifoFeedBatchRows,
//   ]);

//   function openFeedBatchSelection(rowIndex: number) {
//     if (!rowHasFeedQuantity(rowIndex)) return;

//     setFeedBatchDialogMode("cell");
//     setFeedBatchSelectionRowIndex(rowIndex);
//     setReviewFeedBatch(null);
//     setFeedBatchDialogOpen(true);
//   }

//   function findFeedBatchByNumber(batchNumber: string) {
//     const normalizedBatchNumber = batchNumber.trim().toUpperCase();
//     if (!normalizedBatchNumber) return null;

//     return fifoFeedBatchRows.find(row => row.batchNumber.toUpperCase() === normalizedBatchNumber) ?? null;
//   }

//   function openFeedBatchReview(rowIndex: number) {
//     if (!rowHasFeedQuantity(rowIndex)) return;

//     if ((feedBatchAllocationsByRow[rowIndex] ?? []).length > 0) {
//       openFeedBatchSelection(rowIndex);
//       return;
//     }

//     const batchNumber = gridValues[rowIndex]?.[feedBatchColumnIndex]?.trim() ?? "";
//     const batch = findFeedBatchByNumber(batchNumber);

//     if (!batch) {
//       openFeedBatchSelection(rowIndex);
//       return;
//     }

//     setFeedBatchDialogMode("cell");
//     setFeedBatchSelectionRowIndex(null);
//     setReviewFeedBatch(batch);
//     setFeedBatchDialogOpen(true);
//   }

//   function clearFeedBatch(rowIndex: number) {
//     setFeedBatchAllocationsByRow(current => ({
//       ...current,
//       [rowIndex]: [],
//     }));
//     handleCellChange(rowIndex, feedBatchColumnIndex, "");
//     setReviewFeedBatch(null);
//   }

//   function buildFlockCardLines(): FlockCardLinePayload[] {
//     return rows.map((row, rowIndex) => ({
//       age: row.age,
//       values: latestComputedGridValues[rowIndex],
//       allocations: (feedBatchAllocationsByRow[rowIndex] ?? []).map((allocation, allocationIndex) => {
//         const item = feedItemByCode.get(allocation.itemCode.toUpperCase());
//         const warehouse = warehouseByCode.get(allocation.warehouseCode.toUpperCase());

//         return {
//           lineNo: allocationIndex + 1,
//           itemId: item?.id ?? null,
//           itemCode: allocation.itemCode,
//           itemName: allocation.itemName || item?.item_name || item?.description || null,
//           batchNumber: allocation.batchNumber,
//           warehouseId: warehouse?.id ?? null,
//           warehouseCode: allocation.warehouseCode,
//           warehouseName: warehouse?.whse_name ?? null,
//           allocatedQty: allocation.selectedQty,
//           onHandSnapshot: allocation.availableQty,
//           manufacturingDate: allocation.manufacturingDate || null,
//           expiryDate: allocation.expiryDate || null,
//           source: allocation.source,
//         };
//       }),
//     }));
//   }

//   async function handleSave() {
//     if (saving) return;

//     if (!selectedFarm) {
//       toast("Please select a farm.");
//       return;
//     }

//     if (!selectedBuilding) {
//       toast("Please select a building.");
//       return;
//     }

//     if (!selectedWarehouseCode) {
//       toast("Please select a farm with a default feed warehouse.");
//       return;
//     }

//     setSaving(true);

//     try {
//       const savedCard = await saveFlockCard({
//         id: flockCardId,
//         fcNo: flockCardNo,
//         farmId: selectedFarm.id,
//         farmCode: selectedFarm.code,
//         farmName: selectedFarm.name,
//         buildingId: selectedBuilding.id ?? null,
//         buildingCode: selectedBuilding.code,
//         buildingName: selectedBuilding.name,
//         buildingStatus: selectedBuilding.status,
//         feedWarehouseId: selectedWarehouse?.id ?? null,
//         feedWarehouseCode: selectedWarehouseCode,
//         feedWarehouseName: selectedWarehouse?.whse_name ?? null,
//         animalQty: numberOfAnimals,
//         lines: buildFlockCardLines(),
//       });

//       setFlockCardId(savedCard.id);
//       setFlockCardNo(savedCard.fcNo);
//       toast(`Flock card saved: ${savedCard.fcNo}`);
//     } catch (error) {
//       console.error(error);
//       toast(`Unable to save flock card: ${error instanceof Error ? error.message : "Unknown error"}`);
//     } finally {
//       setSaving(false);
//     }
//   }

//   function openFeedOnHandSummary() {
//     setFeedBatchDialogMode("onHand");
//     setFeedBatchSelectionRowIndex(null);
//     setReviewFeedBatch(null);
//     setFeedBatchDialogOpen(true);
//   }

//   function handleCellBlur(rowIndex: number, colIndex: number, value: string) {
//     if (colIndex !== feedDailyKgColumnIndex) return;

//     if (suppressFeedBatchAutoOpenRef.current) {
//       suppressFeedBatchAutoOpenRef.current = false;
//       return;
//     }

//     const previousValue = focusedCellStartValueRef.current.trim();
//     const nextValue = value.trim();

//     if (getNumericValue(nextValue) <= 0 || nextValue === previousValue) return;

//     openFeedBatchSelection(rowIndex);
//   }

//   function focusCell(rowIndex: number, colIndex: number) {
//     const input = inputRefs.current[rowIndex]?.[colIndex];

//     if (!input || input.getAttribute("disabled") != null) {
//       return false;
//     }

//     input.focus();
//     if (input instanceof HTMLInputElement) input.select();
//     return true;
//   }

//   function getHorizontalTarget(
//     rowIndex: number,
//     colIndex: number,
//     step: 1 | -1
//   ) {
//     const editableIndex = editableColumns.indexOf(colIndex);

//     if (editableIndex === -1) {
//       return null;
//     }

//     const nextColumnIndex = editableIndex + step;

//     if (
//       nextColumnIndex >= 0 &&
//       nextColumnIndex < editableColumns.length
//     ) {
//       return {
//         rowIndex,
//         colIndex: editableColumns[nextColumnIndex],
//       };
//     }

//     const nextRowIndex = rowIndex + step;

//     if (nextRowIndex < 0 || nextRowIndex >= rows.length) {
//       return null;
//     }

//     return {
//       rowIndex: nextRowIndex,
//       colIndex:
//         step === 1
//           ? editableColumns[0]
//           : editableColumns[editableColumns.length - 1],
//     };
//   }

//   function getNextFocusableHorizontalTarget(
//     rowIndex: number,
//     colIndex: number,
//     step: 1 | -1
//   ) {
//     let target = getHorizontalTarget(rowIndex, colIndex, step);

//     while (target) {
//       const input = inputRefs.current[target.rowIndex]?.[target.colIndex];

//       if (input && input.getAttribute("disabled") == null) {
//         return target;
//       }

//       target = getHorizontalTarget(target.rowIndex, target.colIndex, step);
//     }

//     return null;
//   }

//   function getVerticalTarget(
//     rowIndex: number,
//     colIndex: number,
//     step: 1 | -1
//   ) {
//     const nextRowIndex = rowIndex + step;

//     if (
//       !editableColumnIndexes.has(colIndex) ||
//       nextRowIndex < 0 ||
//       nextRowIndex >= rows.length
//     ) {
//       return null;
//     }

//     return {
//       rowIndex: nextRowIndex,
//       colIndex,
//     };
//   }

//   function moveFocus(target: { rowIndex: number; colIndex: number } | null) {
//     if (target) {
//       focusCell(target.rowIndex, target.colIndex);
//     }
//   }

//   function handleCellKeyDown(
//     event: KeyboardEvent<HTMLElement>,
//     rowIndex: number,
//     colIndex: number
//   ) {
//     const keyActions: Record<string, () => void> = {
//       ArrowLeft: () =>
//         moveFocus(getNextFocusableHorizontalTarget(rowIndex, colIndex, -1)),
//       ArrowRight: () =>
//         moveFocus(getNextFocusableHorizontalTarget(rowIndex, colIndex, 1)),
//       ArrowUp: () =>
//         moveFocus(getVerticalTarget(rowIndex, colIndex, -1)),
//       ArrowDown: () =>
//         moveFocus(getVerticalTarget(rowIndex, colIndex, 1)),
//       Enter: () =>
//         moveFocus(
//           getVerticalTarget(
//             rowIndex,
//             colIndex,
//             event.shiftKey ? -1 : 1
//           )
//         ),
//       Tab: () =>
//         moveFocus(
//           getNextFocusableHorizontalTarget(
//             rowIndex,
//             colIndex,
//             event.shiftKey ? -1 : 1
//           )
//         ),
//     };

//     const action = keyActions[event.key];

//     if (!action) {
//       return;
//     }

//     event.preventDefault();
//     if (colIndex === feedDailyKgColumnIndex) {
//       suppressFeedBatchAutoOpenRef.current = true;
//     }
//     action();
//   }

//   function handleTableScroll(event: UIEvent<HTMLDivElement>) {
//     const shouldOpen = event.currentTarget.scrollTop <= 0;
//     const shouldClose = event.currentTarget.scrollTop > 16;

//     if (shouldOpen && !headerOpenRef.current) {
//       headerOpenRef.current = true;
//       setHeaderOpen(true);
//       return;
//     }

//     if (shouldClose && headerOpenRef.current) {
//       headerOpenRef.current = false;
//       setHeaderOpen(false);
//     }
//   }

//   return (
//     <div className="h-screen w-full bg-slate-100 p-4 dark:bg-background">
//       <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
//         <Collapsible open={headerOpen} onOpenChange={setHeaderOpen}>
//           <CollapsibleContent>
//             <div className="mx-2 flex items-start justify-between gap-3 p-2">
//               <div className="flex min-w-0 flex-1 flex-col gap-2">
//                 <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,320px)_minmax(220px,320px)_180px_180px]">
//                   <SearchableCombobox
//                     label="Farm"
//                     items={farmOptions}
//                     value={selectedFarmId}
//                     onValueChange={(value) => {
//                       if (hasLockedFlockContext) return;
//                       setSelectedFarmId(value);
//                       setSelectedBuildingId("");
//                       setSelectedWarehouseCode("");
//                     }}
//                     placeholder="Select farm..."
//                     showCode
//                     className="w-full"
//                   />

//                   <label className="relative block min-w-0">
//                     <span className="text-sm font-medium">Default Feed Warehouse</span>

//                     <Input
//                       value={selectedWarehouseLabel}
//                       readOnly
//                       disabled
//                       placeholder={selectedFarmId ? "No default feed warehouse" : "Select farm first..."}
//                       className="bg-slate-50 text-slate-700 disabled:cursor-not-allowed disabled:opacity-100 dark:bg-background/60 dark:text-foreground"
//                     />
//                   </label>

//                   <label className="relative block min-w-0">
//                     <span className="text-sm font-medium">Number of animals</span>

//                     <Input
//                       value={numberOfAnimals}
//                       onChange={(event) =>
//                         setNumberOfAnimals(Number(event.target.value))
//                       }
//                     />
//                   </label>

//                   <div className="relative block min-w-0">
//                     <span className="text-sm font-medium">Feed On-hand</span>

//                     <Button
//                       type="button"
//                       variant="outline"
//                       size="default"
//                       disabled={!selectedWarehouseCode}
//                       onClick={openFeedOnHandSummary}
//                       className="h-9 w-full justify-start border-input bg-[#fffdfb] px-3 text-foreground hover:border-ring hover:bg-accent hover:text-accent-foreground disabled:opacity-100 dark:bg-input/30"
//                     >
//                       {loadingFeedBatches ? (
//                         <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
//                       ) : (
//                         <PackageCheck className="size-4 shrink-0 text-muted-foreground" />
//                       )}
//                       <span className="min-w-0 flex-1 truncate text-left">
//                         {loadingFeedBatches ? "Loading..." : formatQuantity(totalFeedOnHand)}
//                       </span>
//                       <span className="rounded border bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
//                         {feedBatchRows.length}
//                       </span>
//                       <MousePointerClick className="size-4 shrink-0 text-primary" />
//                     </Button>

//                     {feedBatchError ? (
//                       <div className="mt-1 truncate text-xs text-amber-700 dark:text-amber-400">
//                         {feedBatchError}
//                       </div>
//                     ) : null}
//                   </div>
//                 </div>

//                 <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2 dark:border-border dark:bg-background/40">
//                   <div className="mb-2 flex items-center justify-between gap-2">
//                     <div className="flex min-w-0 items-center gap-2">
//                       <Building2 className="size-4 shrink-0 text-muted-foreground" />
//                       <span className="truncate text-sm font-semibold text-foreground">Building</span>
//                     </div>

//                     {!hasLockedFlockContext && selectedBuilding ? (
//                       <span className="truncate text-xs text-muted-foreground">
//                         Selected: {selectedBuilding.code || selectedBuilding.name}
//                       </span>
//                     ) : null}
//                   </div>

//                   {hasLockedFlockContext ? (
//                     <label className="block min-w-0">
//                       <span className="text-sm font-medium">Building</span>
//                       <Input
//                         value={selectedBuilding
//                           ? `${selectedBuilding.code}${selectedBuilding.name ? ` - ${selectedBuilding.name}` : ""}`
//                           : String(flockCardNavigationContext?.buildingKey ?? "")}
//                         readOnly
//                         className="mt-1 bg-white dark:bg-card"
//                       />
//                     </label>
//                   ) : loadingFarmBuildings ? (
//                     <div className="flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm text-muted-foreground dark:bg-card">
//                       <Loader2 className="size-4 animate-spin" />
//                       Loading buildings...
//                     </div>
//                   ) : farmBuildingError ? (
//                     <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
//                       {farmBuildingError}
//                     </div>
//                   ) : farmBuildings.length === 0 ? (
//                     <div className="rounded border bg-white px-3 py-2 text-sm text-muted-foreground dark:bg-card">
//                       No buildings found for this farm.
//                     </div>
//                   ) : (
//                     <div className="flex gap-2 overflow-x-auto pb-1">
//                       {farmBuildings.map((building,i) => {
//                         const selected = building.key === selectedBuildingId;

//                         return (
//                           <button
//                             key={i}
//                             type="button"
//                             disabled={hasLockedFlockContext}
//                             onClick={() => {
//                               if (hasLockedFlockContext) return;
//                               setSelectedBuildingId(building.key);
//                             }}
//                             className={`min-w-[190px] max-w-[240px] rounded-md border bg-white px-3 py-2 text-left transition dark:bg-card ${hasLockedFlockContext ? "cursor-not-allowed opacity-80" : "hover:border-primary/60 hover:bg-accent"} ${selected ? "border-primary shadow-[inset_0_0_0_1px_hsl(var(--primary))]" : "border-slate-200 dark:border-border"}`}
//                           >
//                             <div className="flex items-start justify-between gap-2">
//                               <div className="min-w-0">
//                                 <div className="truncate text-sm font-semibold text-foreground">
//                                   {building.code || "No code"}
//                                 </div>
//                                 <div className="truncate text-xs text-muted-foreground">
//                                   {building.name || "Unnamed building"}
//                                 </div>
//                               </div>
//                               <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${getBuildingStatusClass(building.status)}`}>
//                                 {building.status || "No status"}
//                               </span>
//                             </div>

//                             <div className="mt-1 text-[11px] font-semibold uppercase text-muted-foreground">
//                               {building.source === "WAREHOUSE" ? "Warehouse link" : "Building master"}
//                             </div>

//                             {building.remarks ? (
//                               <div className="mt-1 truncate text-xs text-muted-foreground">
//                                 {building.remarks}
//                               </div>
//                             ) : null}
//                           </button>
//                         );
//                       })}
//                     </div>
//                   )}
//                 </div>

//                 <div className="flex flex-wrap items-center gap-2">
//                   <Button
//                     type="button"
//                     size="sm"
//                     onClick={handleSave}
//                     disabled={saving}
//                   >
//                     {saving ? (
//                       <Loader2 className="size-4 animate-spin" />
//                     ) : (
//                       <Save className="size-4" />
//                     )}
//                     Save
//                   </Button>

//                   {flockCardNo ? (
//                     <span className="rounded border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
//                       {flockCardNo}
//                     </span>
//                   ) : null}
//                 </div>
//               </div>

//               <Help />
//             </div>
//           </CollapsibleContent>
//         </Collapsible>

//         <Dialog
//           open={feedBatchDialogOpen}
//           onOpenChange={(open) => {
//             setFeedBatchDialogOpen(open);
//             if (!open) {
//               setFeedBatchDialogMode("onHand");
//               setFeedBatchSelectionRowIndex(null);
//               setReviewFeedBatch(null);
//             }
//           }}
//         >
//           <DialogContent
//             className={`max-h-[90vh] overflow-y-auto ${
//               feedBatchDialogMode === "cell" ? "sm:max-w-6xl xl:max-w-7xl" : "sm:max-w-4xl"
//             }`}
//           >
//             <DialogHeader>
//               <DialogTitle>
//                 {feedBatchDialogMode === "onHand"
//                   ? "Feed On-hand Quantity"
//                   : reviewFeedBatch
//                     ? "Feed Batch Details"
//                     : feedBatchSelectionRowIndex == null ? "Feed Batch Information" : "Select Feed Batch"}
//               </DialogTitle>
//               <DialogDescription>
//                 {feedBatchDialogMode === "onHand"
//                   ? `Current on-hand feed quantity in ${selectedWarehouseLabel || "the default feed warehouse"}.`
//                   : reviewFeedBatch
//                     ? `${reviewFeedBatch.batchNumber} information and movement history.`
//                     : feedBatchSelectionRowIndex == null
//                       ? `On-hand feed batches in ${selectedWarehouseLabel || "the default feed warehouse"}.`
//                       : `Choose the feed used on age ${feedBatchSelectionAge ?? ""}. Auto select follows FIFO.`}
//               </DialogDescription>
//             </DialogHeader>

//             {feedBatchDialogMode === "cell" && feedBatchSelectionRowIndex != null ? (
//               <div className="rounded-md border bg-muted/30 p-3">
//                 <div className="grid gap-2 text-sm sm:grid-cols-5">
//                   <div>
//                     <div className="text-xs font-medium uppercase text-muted-foreground">Age</div>
//                     <div className="font-semibold text-foreground">{feedBatchSelectionAge ?? "-"}</div>
//                   </div>
//                   <div>
//                     <div className="text-xs font-medium uppercase text-muted-foreground">Daily kg/Flock</div>
//                     <div className="font-semibold tabular-nums text-foreground">{formatQuantity(activeFeedRequiredQty)}</div>
//                   </div>
//                   <div>
//                     <div className="text-xs font-medium uppercase text-muted-foreground">Allocated</div>
//                     <div className="font-semibold tabular-nums text-foreground">{formatQuantity(activeFeedAllocatedQty)}</div>
//                   </div>
//                   <div>
//                     <div className="text-xs font-medium uppercase text-muted-foreground">Remaining</div>
//                     <div className={`font-semibold tabular-nums ${activeFeedRemainingQty > 0 ? "text-amber-700" : "text-emerald-700"}`}>
//                       {formatQuantity(activeFeedRemainingQty)}
//                     </div>
//                   </div>
//                   <div>
//                     <div className="text-xs font-medium uppercase text-muted-foreground">Direction</div>
//                     <div className="font-semibold text-foreground">Out</div>
//                   </div>
//                 </div>

//                 <div className="mt-3 flex flex-wrap gap-2">
//                   <Button
//                     type="button"
//                     size="sm"
//                     disabled={loadingFeedBatches || fifoFeedBatchRows.length === 0 || activeFeedRequiredQty <= 0}
//                     onClick={autoSelectFeedBatch}
//                   >
//                     <PackageCheck className="size-4" />
//                     Auto select FIFO (Alt + A)
//                   </Button>
//                   <Button
//                     type="button"
//                     size="sm"
//                     variant="outline"
//                     disabled={activeFeedBatchAllocations.length === 0}
//                     onClick={() => {
//                       if (feedBatchSelectionRowIndex != null) commitFeedBatchAllocations(feedBatchSelectionRowIndex, []);
//                     }}
//                   >
//                     Clear selected
//                   </Button>
//                   <Button
//                     type="button"
//                     size="sm"
//                     variant="outline"
//                     onClick={finishFeedBatchAllocation}
//                   >
//                     Done
//                   </Button>
//                 </div>
//               </div>
//             ) : null}

//             <div className="grid gap-2 sm:grid-cols-3">
//               <div className="rounded-md border bg-muted/40 px-3 py-2">
//                 <div className="text-xs font-medium uppercase text-muted-foreground">
//                   Total on hand
//                 </div>
//                 <div className="mt-1 text-lg font-semibold tabular-nums">
//                   {loadingFeedBatches ? "Loading..." : formatQuantity(totalFeedOnHand)}
//                 </div>
//               </div>

//               <div className="rounded-md border bg-muted/40 px-3 py-2">
//                 <div className="text-xs font-medium uppercase text-muted-foreground">
//                   Batch count
//                 </div>
//                 <div className="mt-1 text-lg font-semibold tabular-nums">
//                   {feedBatchRows.length}
//                 </div>
//               </div>

//               <div className="rounded-md border bg-muted/40 px-3 py-2">
//                 <div className="text-xs font-medium uppercase text-muted-foreground">
//                   Warehouse
//                 </div>
//                 <div className="mt-1 truncate text-sm font-semibold">
//                   {selectedWarehouseLabel || "No default warehouse"}
//                 </div>
//               </div>
//             </div>

//             {feedBatchDialogMode === "onHand" ? (
//               loadingFeedBatches ? (
//                 <div className="flex items-center justify-center gap-2 rounded-md border bg-muted/40 px-3 py-8 text-sm text-muted-foreground">
//                   <Loader2 className="size-4 animate-spin" />
//                   Loading feed on-hand quantity...
//                 </div>
//               ) : feedBatchError ? (
//                 <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
//                   {feedBatchError}
//                 </div>
//               ) : feedBatchRows.length === 0 ? (
//                 <div className="rounded-md border bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
//                   No feed on-hand quantity was found in this warehouse.
//                 </div>
//               ) : (
//                 <div className="overflow-x-auto rounded-md border">
//                   <div className="min-w-[620px]">
//                     <div className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.5fr)_110px_100px_100px] gap-3 bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
//                       <div>Batch</div>
//                       <div>Consists of</div>
//                       <div className="text-right">On hand</div>
//                       <div>MFG</div>
//                       <div>EXP</div>
//                     </div>

//                     <div className="max-h-[48vh] overflow-y-auto">
//                       {fifoFeedBatchRows.map(row => (
//                         <div
//                           key={row.id}
//                           className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.5fr)_110px_100px_100px] gap-3 border-t px-3 py-2 text-sm"
//                         >
//                           <div className="min-w-0">
//                             <div className="truncate font-semibold text-foreground">
//                               {row.batchNumber}
//                             </div>
//                             <div className="truncate text-xs text-muted-foreground">
//                               {row.warehouseCode}
//                             </div>
//                           </div>

//                           <div className="min-w-0">
//                             <div className="truncate font-medium">
//                               {row.itemName || feedItemNameByCode.get(row.itemCode.toUpperCase()) || row.itemCode}
//                             </div>
//                             <div className="truncate text-xs text-muted-foreground">
//                               {row.itemCode}
//                             </div>
//                           </div>

//                           <div className="text-right font-semibold tabular-nums text-foreground">
//                             {formatQuantity(row.onHandQty)}
//                           </div>
//                           <div className="text-muted-foreground">
//                             {formatDateValue(row.manufacturingDate)}
//                           </div>
//                           <div className="text-muted-foreground">
//                             {formatDateValue(row.expiryDate)}
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 </div>
//               )
//             ) : reviewFeedBatch ? (
//               <Tabs defaultValue="details" className="space-y-4">
//                 <TabsList>
//                   <TabsTrigger value="details">Details</TabsTrigger>
//                   <TabsTrigger value="trace">Trace</TabsTrigger>
//                   <TabsTrigger value="batches">Batches</TabsTrigger>
//                 </TabsList>

//                 <TabsContent value="details" className="space-y-4">
//                   <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
//                     <div>
//                       <div className="text-xs font-medium uppercase text-muted-foreground">Batch</div>
//                       <div className="mt-1 break-words font-semibold text-foreground">{reviewFeedBatch.batchNumber}</div>
//                     </div>
//                     <div>
//                       <div className="text-xs font-medium uppercase text-muted-foreground">Item</div>
//                       <div className="mt-1 font-semibold text-foreground">
//                         {reviewFeedBatch.itemName || feedItemNameByCode.get(reviewFeedBatch.itemCode.toUpperCase()) || reviewFeedBatch.itemCode}
//                       </div>
//                       <div className="text-xs text-muted-foreground">{reviewFeedBatch.itemCode}</div>
//                     </div>
//                     <div>
//                       <div className="text-xs font-medium uppercase text-muted-foreground">Warehouse</div>
//                       <div className="mt-1 font-semibold text-foreground">{reviewFeedBatch.warehouseCode || "-"}</div>
//                     </div>
//                     <div>
//                       <div className="text-xs font-medium uppercase text-muted-foreground">On hand</div>
//                       <div className="mt-1 font-semibold tabular-nums text-foreground">{formatQuantity(reviewFeedBatch.onHandQty)}</div>
//                     </div>
//                     <div>
//                       <div className="text-xs font-medium uppercase text-muted-foreground">Manufacturing Date</div>
//                       <div className="mt-1 font-semibold text-foreground">{formatDateValue(reviewFeedBatch.manufacturingDate)}</div>
//                     </div>
//                     <div>
//                       <div className="text-xs font-medium uppercase text-muted-foreground">Expiry Date</div>
//                       <div className="mt-1 font-semibold text-foreground">{formatDateValue(reviewFeedBatch.expiryDate)}</div>
//                     </div>
//                   </div>

//                   {feedBatchSelectionRowIndex != null ? (
//                     <Button
//                       type="button"
//                       onClick={() => addFeedBatchAllocation(reviewFeedBatch)}
//                       disabled={activeFeedRemainingQty <= 0}
//                     >
//                       <PackageCheck className="size-4" />
//                       Allocate this batch
//                     </Button>
//                   ) : null}
//                 </TabsContent>

//                 <TabsContent value="trace" className="space-y-3">
//                   {loadingFeedBatchTrace ? (
//                     <div className="flex min-h-32 items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground">
//                       <Loader2 className="size-4 animate-spin" />
//                       Loading transaction trail...
//                     </div>
//                   ) : feedBatchTraceError ? (
//                     <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
//                       {feedBatchTraceError}
//                     </div>
//                   ) : feedBatchTraceRows.length === 0 ? (
//                     <div className="rounded-md border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
//                       No inventory postings were found for this batch.
//                     </div>
//                   ) : (
//                     <div className="relative space-y-3 pl-5">
//                       <div className="absolute left-[11px] top-2 h-[calc(100%-1rem)] w-px bg-amber-200" />
//                       {feedBatchTraceRows.map(row => {
//                         const isOut = row.signedQty < 0;
//                         const movementLabel = isOut ? "OUT" : "IN";

//                         return (
//                           <div key={row.id} className="relative rounded-md border bg-card p-3 shadow-sm">
//                             <div className={`absolute -left-[17px] top-4 flex size-7 items-center justify-center rounded-full border bg-card ${isOut ? "border-red-200 text-red-600" : "border-emerald-200 text-emerald-700"}`}>
//                               <ArrowRightCircle className={`size-4 ${isOut ? "rotate-180" : ""}`} />
//                             </div>

//                             <div className="flex flex-wrap items-start justify-between gap-3">
//                               <div className="min-w-0">
//                                 <div className="flex flex-wrap items-center gap-2">
//                                   <span className={`rounded-full px-2 py-1 text-xs font-semibold ${isOut ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
//                                     {movementLabel}
//                                   </span>
//                                   <span className="font-semibold text-foreground">{row.documentLabel}</span>
//                                   <span className="text-xs text-muted-foreground">{row.sourceDocType || "-"}</span>
//                                 </div>
//                                 <div className="mt-1 text-xs text-muted-foreground">
//                                   {formatDateTime(row.createdAt)}
//                                 </div>
//                               </div>

//                               <div className="text-right">
//                                 <div className={`text-sm font-semibold tabular-nums ${isOut ? "text-red-700" : "text-emerald-700"}`}>
//                                   {isOut ? "-" : "+"}{formatQuantity(Math.abs(row.signedQty))}
//                                 </div>
//                                 <div className="text-xs text-muted-foreground">Movement</div>
//                               </div>
//                             </div>

//                             <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-5">
//                               <div className="rounded-md bg-amber-50 px-2 py-1">
//                                 <span className="block font-medium text-amber-700">Running Balance</span>
//                                 <span className="font-semibold tabular-nums text-amber-900">{formatQuantity(row.runningQty)}</span>
//                               </div>
//                               <div className="rounded-md bg-muted/40 px-2 py-1">
//                                 <span className="block font-medium">Warehouse</span>
//                                 <span className="text-foreground">{row.warehouseCode || "-"}</span>
//                               </div>
//                               <div className="rounded-md bg-muted/40 px-2 py-1">
//                                 <span className="block font-medium">Bin</span>
//                                 <span className="text-foreground">{row.binCode || "-"}</span>
//                               </div>
//                               <div className="rounded-md bg-muted/40 px-2 py-1">
//                                 <span className="block font-medium">Reference</span>
//                                 <span className="text-foreground">{row.ref || row.ref2 || "-"}</span>
//                               </div>
//                               <div className="rounded-md bg-muted/40 px-2 py-1">
//                                 <span className="block font-medium">Posting ID</span>
//                                 <span className="text-foreground">#{row.id}</span>
//                               </div>
//                             </div>
//                           </div>
//                         );
//                       })}
//                     </div>
//                   )}
//                 </TabsContent>

//                 <TabsContent value="batches">
//                   <div className="overflow-x-auto rounded-md border">
//                     <div className="min-w-[720px]">
//                       <div className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.5fr)_110px_100px_100px_90px] gap-3 bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
//                         <div>Batch</div>
//                         <div>Consists of</div>
//                         <div className="text-right">On hand</div>
//                         <div>MFG</div>
//                         <div>EXP</div>
//                         <div className="text-right">Action</div>
//                       </div>

//                       <div className="max-h-[42vh] overflow-y-auto">
//                         {fifoFeedBatchRows.map(row => (
//                           <div
//                             key={row.id}
//                             className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.5fr)_110px_100px_100px_90px] gap-3 border-t px-3 py-2 text-sm"
//                           >
//                             <button
//                               type="button"
//                               className="min-w-0 text-left"
//                               onClick={() => setReviewFeedBatch(row)}
//                             >
//                               <div className="truncate font-semibold text-foreground">{row.batchNumber}</div>
//                               <div className="truncate text-xs text-muted-foreground">{row.warehouseCode}</div>
//                             </button>

//                             <div className="min-w-0">
//                               <div className="truncate font-medium">
//                                 {row.itemName || feedItemNameByCode.get(row.itemCode.toUpperCase()) || row.itemCode}
//                               </div>
//                               <div className="truncate text-xs text-muted-foreground">{row.itemCode}</div>
//                             </div>

//                             <div className="text-right font-semibold tabular-nums text-foreground">{formatQuantity(row.onHandQty)}</div>
//                             <div className="text-muted-foreground">{formatDateValue(row.manufacturingDate)}</div>
//                             <div className="text-muted-foreground">{formatDateValue(row.expiryDate)}</div>
//                             <div className="text-right">
//                               <Button
//                                 type="button"
//                                 size="sm"
//                                 variant="outline"
//                                 onClick={() => setReviewFeedBatch(row)}
//                               >
//                                 View
//                               </Button>
//                             </div>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   </div>
//                 </TabsContent>
//               </Tabs>
//             ) : feedBatchDialogMode === "cell" && feedBatchSelectionRowIndex != null ? (
//               loadingFeedBatches ? (
//                 <div className="flex items-center justify-center gap-2 rounded-md border bg-muted/40 px-3 py-8 text-sm text-muted-foreground">
//                   <Loader2 className="size-4 animate-spin" />
//                   Loading feed batches...
//                 </div>
//               ) : feedBatchError ? (
//                 <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
//                   {feedBatchError}
//                 </div>
//               ) : activeFeedRequiredQty <= 0 ? (
//                 <div className="rounded-md border bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
//                   Enter Daily kg/Flock before allocating feed batches.
//                 </div>
//               ) : (
//                 <div className="grid gap-4 lg:grid-cols-2">
//                   <div className="min-w-0 rounded-md border">
//                     <div className="border-b bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
//                       Available Batches
//                     </div>
//                     <div className="grid grid-cols-[36px_minmax(100px,1fr)_90px_90px_84px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
//                       <div>#</div>
//                       <div>Batch</div>
//                       <div className="text-right">Available</div>
//                       <div>Expiration</div>
//                       <div className="text-right">Allocate</div>
//                     </div>
//                     <div className="max-h-[38vh] overflow-y-auto">
//                       {activeAvailableFeedBatches.length === 0 ? (
//                         <div className="px-3 py-8 text-center text-sm text-muted-foreground">
//                           No available feed batches found.
//                         </div>
//                       ) : (
//                         activeAvailableFeedBatches.map((batch, index) => {
//                           const canAllocate = activeFeedRemainingQty > 0 && batch.availableToSelect > 0;

//                           return (
//                             <div
//                               key={batch.id}
//                               className="grid grid-cols-[36px_minmax(100px,1fr)_90px_90px_84px] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
//                             >
//                               <div className="text-muted-foreground">{index + 1}</div>
//                               <button
//                                 type="button"
//                                 className="min-w-0 text-left"
//                                 onClick={() => setReviewFeedBatch(batch)}
//                               >
//                                 <div className="truncate font-semibold text-foreground">{batch.batchNumber}</div>
//                                 <div className="truncate text-xs text-muted-foreground">{batch.itemName || batch.itemCode}</div>
//                               </button>
//                               <div className="text-right font-semibold tabular-nums text-foreground">
//                                 {formatQuantity(batch.availableToSelect)}
//                               </div>
//                               <div className="text-muted-foreground">
//                                 {formatDateValue(batch.expiryDate)}
//                               </div>
//                               <div className="text-right">
//                                 <Button
//                                   type="button"
//                                   size="xs"
//                                   variant="outline"
//                                   disabled={!canAllocate}
//                                   onClick={() => addFeedBatchAllocation(batch)}
//                                 >
//                                   &gt;
//                                 </Button>
//                               </div>
//                             </div>
//                           );
//                         })
//                       )}
//                     </div>
//                   </div>

//                   <div className="min-w-0 rounded-md border">
//                     <div className="border-b bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
//                       Selected Batches
//                     </div>
//                     <div className="grid grid-cols-[36px_minmax(100px,1fr)_110px_80px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
//                       <div>#</div>
//                       <div>Batch</div>
//                       <div className="text-right">Selected Qty</div>
//                       <div className="text-right">Remove</div>
//                     </div>
//                     <div className="max-h-[38vh] overflow-y-auto">
//                       {activeFeedBatchAllocations.length === 0 ? (
//                         <div className="px-3 py-8 text-center text-sm text-muted-foreground">
//                           No batches selected yet.
//                         </div>
//                       ) : (
//                         activeFeedBatchAllocations.map((allocation, index) => (
//                           <div
//                             key={allocation.batchId}
//                             className="grid grid-cols-[36px_minmax(100px,1fr)_110px_80px] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
//                           >
//                             <div className="text-muted-foreground">{index + 1}</div>
//                             <button
//                               type="button"
//                               className="min-w-0 text-left"
//                               onClick={() => {
//                                 const batch = fifoFeedBatchRows.find(row => row.id === allocation.batchId);
//                                 if (batch) setReviewFeedBatch(batch);
//                               }}
//                             >
//                               <div className="truncate font-semibold text-foreground">{allocation.batchNumber}</div>
//                               <div className="truncate text-xs text-muted-foreground">{allocation.itemName || allocation.itemCode}</div>
//                             </button>
//                             <Input
//                               value={formatTotal(allocation.selectedQty)}
//                               onChange={(event) => updateFeedBatchAllocationQty(allocation.batchId, event.target.value)}
//                               className="h-8 text-right tabular-nums"
//                             />
//                             <div className="text-right">
//                               <Button
//                                 type="button"
//                                 size="icon-xs"
//                                 variant="outline"
//                                 onClick={() => removeFeedBatchAllocation(allocation.batchId)}
//                                 aria-label={`Remove ${allocation.batchNumber}`}
//                               >
//                                 <X className="size-3.5" />
//                               </Button>
//                             </div>
//                           </div>
//                         ))
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               )
//             ) : loadingFeedBatches ? (
//               <div className="flex items-center justify-center gap-2 rounded-md border bg-muted/40 px-3 py-8 text-sm text-muted-foreground">
//                 <Loader2 className="size-4 animate-spin" />
//                 Loading feed batches...
//               </div>
//             ) : feedBatchError ? (
//               <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
//                 {feedBatchError}
//               </div>
//             ) : feedBatchRows.length === 0 ? (
//               <div className="rounded-md border bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
//                 No feed batches with on-hand balance in this warehouse.
//               </div>
//             ) : (
//               <div className="overflow-x-auto rounded-md border">
//                 <div className="min-w-[720px]">
//                   <div className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.5fr)_110px_100px_100px_90px] gap-3 bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
//                     <div>Batch</div>
//                     <div>Consists of</div>
//                     <div className="text-right">On hand</div>
//                     <div>MFG</div>
//                     <div>EXP</div>
//                     <div className="text-right">Action</div>
//                   </div>

//                   <div className="max-h-[48vh] overflow-y-auto">
//                     {fifoFeedBatchRows.map(row => (
//                       <div
//                         key={row.id}
//                         className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.5fr)_110px_100px_100px_90px] gap-3 border-t px-3 py-2 text-sm"
//                       >
//                         <button
//                           type="button"
//                           className="min-w-0 text-left"
//                           onClick={() => {
//                             if (feedBatchSelectionRowIndex == null) {
//                               setReviewFeedBatch(row);
//                               return;
//                             }

//                             addFeedBatchAllocation(row);
//                           }}
//                         >
//                           <div className="truncate font-semibold text-foreground">
//                             {row.batchNumber}
//                           </div>
//                           <div className="truncate text-xs text-muted-foreground">
//                             {row.warehouseCode}
//                           </div>
//                         </button>

//                         <div className="min-w-0">
//                           <div className="truncate font-medium">
//                             {row.itemName || feedItemNameByCode.get(row.itemCode.toUpperCase()) || row.itemCode}
//                           </div>
//                           <div className="truncate text-xs text-muted-foreground">
//                             {row.itemCode}
//                           </div>
//                         </div>

//                         <div className="text-right font-semibold tabular-nums text-foreground">
//                           {formatQuantity(row.onHandQty)}
//                         </div>
//                         <div className="text-muted-foreground">
//                           {formatDateValue(row.manufacturingDate)}
//                         </div>
//                         <div className="text-muted-foreground">
//                           {formatDateValue(row.expiryDate)}
//                         </div>
//                         <div className="text-right">
//                           <Button
//                             type="button"
//                             size="sm"
//                             variant="outline"
//                             onClick={() => {
//                               if (feedBatchSelectionRowIndex == null) {
//                                 setReviewFeedBatch(row);
//                                 return;
//                               }

//                               addFeedBatchAllocation(row);
//                             }}
//                           >
//                             {feedBatchSelectionRowIndex == null ? "View" : "Add"}
//                           </Button>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             )}
//           </DialogContent>
//         </Dialog>

//         <div className="relative flex-1 overflow-auto" onScroll={handleTableScroll}>
//           <table
//             className="fc-grid-table table-fixed border-separate border-spacing-0 caption-bottom text-sm"
//             style={{ minWidth: tableMinWidth }}
//           >
//             <colgroup>
//               <col style={{ width: ageColumnWidth }} />

//               {columnWidths.map((width, index) => (
//                 <col key={index} style={{ width }} />
//               ))}
//             </colgroup>

//             <TableHeader className="[&_tr]:border-0">
//               <TableRow className="border-0" style={{ height: headerRowHeight }}>
//                 <TableHead
//                   rowSpan={3}
//                   className="fc-grid-header fc-grid-age-header sticky left-0 top-0 z-40 text-center"
//                   style={{ width: ageColumnWidth, minWidth: ageColumnWidth }}
//                 >
//                   Age
//                 </TableHead>

//                 <HeaderCells cells={topHeaderCells} rowName="top" />
//               </TableRow>

//               <TableRow className="border-0" style={{ height: headerRowHeight }}>
//                 <HeaderCells cells={middleHeaderCells} rowName="middle" />
//               </TableRow>

//               <TableRow className="border-0" style={{ height: headerRowHeight }}>
//                 <HeaderCells cells={bottomHeaderCells} rowName="bottom" />
//               </TableRow>
//             </TableHeader>

//             <TableBody>
//               {rows.map((row, rowIndex) => {
//                 const striped = isStripedRow(rowIndex);

//                 return (
//                   <TableRow key={row.age} className="fc-grid-row border-0">
//                     <TableCell
//                       className="fc-grid-age sticky left-0 z-20 text-center font-semibold"
//                       style={{ width: ageColumnWidth, minWidth: ageColumnWidth }}
//                     >
//                       {row.age}
//                     </TableCell>

//                     {Array.from({ length: dataColumnCount }).map(
//                       (_, colIndex) => {
//                         const disabled = !editableColumnIndexes.has(colIndex);
//                         const hasFeedQuantity = rowHasFeedQuantity(rowIndex);

//                         return (
//                           <TableCell
//                             key={colIndex}
//                             className={`fc-grid-cell ${disabled ? "fc-grid-cell-readonly" : "fc-grid-cell-editable"} p-0 ${getBodyBorderClass(
//                               colIndex,
//                               striped
//                             )}`}
//                           >
//                             {colIndex === feedBatchColumnIndex ? (
//                               <div className="flex min-h-8 w-full items-stretch" style={{ minWidth: feedBatchColumnWidth }}>
//                                 <button
//                                   type="button"
//                                   data-fc-cell="true"
//                                   ref={(element) => {
//                                     inputRefs.current[rowIndex] ??= [];
//                                     inputRefs.current[rowIndex][colIndex] = element;
//                                   }}
//                                   disabled={!hasFeedQuantity || (!gridValues[rowIndex]?.[feedBatchColumnIndex]?.trim() && !selectedWarehouseCode)}
//                                   onClick={() => openFeedBatchReview(rowIndex)}
//                                   onKeyDown={(event) => handleCellKeyDown(event, rowIndex, colIndex)}
//                                   className="flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-normal break-words px-1.5 py-1 text-center text-xs leading-tight text-[#4f4a43] shadow-none transition-none focus:font-semibold focus:text-emerald-950 focus:outline-none disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[#7c766c] dark:text-foreground dark:focus:text-emerald-100 dark:disabled:bg-transparent dark:disabled:text-muted-foreground"
//                                   title={
//                                     !hasFeedQuantity
//                                       ? "Enter Daily kg/Flock before selecting a feed batch"
//                                       : gridValues[rowIndex]?.[feedBatchColumnIndex] || "Select feed batch"
//                                   }
//                                 >
//                                   <span className="min-w-0 break-words">
//                                     {gridValues[rowIndex]?.[feedBatchColumnIndex]?.trim() || "Select"}
//                                   </span>
//                                   <MousePointerClick className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
//                                 </button>

//                                 {gridValues[rowIndex]?.[feedBatchColumnIndex]?.trim() ? (
//                                   <button
//                                     type="button"
//                                     onClick={() => clearFeedBatch(rowIndex)}
//                                     className="flex w-7 shrink-0 items-center justify-center border-l border-[#ded8ce] text-muted-foreground hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-ring/20 dark:border-border"
//                                     title="Clear feed batch"
//                                     aria-label="Clear feed batch"
//                                   >
//                                     <X className="size-3.5" aria-hidden="true" />
//                                   </button>
//                                 ) : null}
//                               </div>
//                             ) : (
//                               <CellInput
//                                 id={`row-${rowIndex}-col-${colIndex}`}
//                                 disabled={disabled}
//                                 value={computedGridValues[rowIndex][colIndex]}
//                                 inputRef={(element) => {
//                                   inputRefs.current[rowIndex] ??= [];
//                                   inputRefs.current[rowIndex][colIndex] = element;
//                                 }}
//                                 onCommit={(value) =>
//                                   handleCellChange(
//                                     rowIndex,
//                                     colIndex,
//                                     value
//                                   )
//                                 }
//                                 onBlur={(value) => handleCellBlur(rowIndex, colIndex, value)}
//                                 onFocus={() => {
//                                   focusedCellStartValueRef.current = gridValues[rowIndex]?.[colIndex] ?? "";
//                                 }}
//                                 onKeyDown={(event) =>
//                                   handleCellKeyDown(event, rowIndex, colIndex)
//                                 }
//                               />
//                             )}
//                           </TableCell>
//                         );
//                       }
//                     )}
//                   </TableRow>
//                 );
//               })}
//             </TableBody>

//             <TableFooter>
//               <TableRow className="border-0">
//                 <TableCell
//                   className="fc-grid-footer-cell fc-grid-footer-age sticky bottom-0 left-0 z-40 text-center font-semibold shadow-md"
//                   style={{ width: ageColumnWidth, minWidth: ageColumnWidth }}
//                 >
//                   Total
//                 </TableCell>

//                 {columnTotals.map((total, colIndex) => (
//                   <TableCell
//                     key={colIndex}
//                     className={`fc-grid-footer-cell sticky bottom-0 text-center font-semibold ${getFooterBorderClass(
//                       colIndex
//                     )}`}
//                   >
//                     {total}
//                   </TableCell>
//                 ))}
//               </TableRow>
//             </TableFooter>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }
"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import type {
  FocusEvent,
  KeyboardEvent,
  ReactNode,
  RefCallback,
  UIEvent,
} from "react";
import {
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SearchableCombobox from "@/components/SearchableCombobox";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import type { Items, WarehouseData } from "@/lib/types";
import { getUserFarms } from "@/app/admin/user/new/api";
import { ArrowRightCircle, Copy, Eraser, Loader2, MousePointerClick, PackageCheck, RotateCcw, Save, X } from "lucide-react";
import {
  getBatchTransactionTrail,
  type BatchTransactionTrail,
} from "@/app/inv/btch/api";
import {
  getFlockCardSheet,
  getFeedBatchOnHandByWarehouse,
  getFarmBuildings,
  reverseFlockCardFeedIntake,
  saveFlockCard,
  type FeedBatchOnHand,
  type FarmBuildingOption,
  type FlockCardLinePayload,
} from "./api";
import {
  computeColumnTotals,
  computeGridValues,
  formatTotal,
  getNumericValue,
} from "./gridMath";
import Help from "./Help";

const rows = Array.from({ length: 40 }, (_, i) => ({ age: i }));

const dataColumnCount = 27;
const ageColumnWidth = 50;
const dataColumnWidth = 80;
const feedBatchMinColumnWidth = 140;
const feedBatchMaxColumnWidth = 260;
const headerRowHeight = 28;
const stripedRow = 5;
const middleHeaderTop = headerRowHeight;
const bottomHeaderTop = headerRowHeight * 2;
const trackingLabelLeft = ageColumnWidth + 16;
const feedDailyKgColumnIndex = 7;
const feedDailyPerBirdColumnIndex = 8;
const feedGuidelineColumnIndex = 9;
const feedBatchColumnIndex = 10;
const feedIntakeColumnIndexes = new Set([
  feedDailyKgColumnIndex,
  feedDailyPerBirdColumnIndex,
  feedGuidelineColumnIndex,
  feedBatchColumnIndex,
]);

// Static list of column indexes, reused every render instead of allocating
// a fresh array for every row.
const columnIndexes = Array.from({ length: dataColumnCount }, (_, i) => i);

const initialGridValues = rows.map(() =>
  Array.from({ length: dataColumnCount }, () => "")
);

const editableColumnIndexes = new Set([
  0, // Mortality AM
  1, // Mortality PM
  3, // Thinning Other AM
  4, // Thinning Other PM
  feedDailyKgColumnIndex, // Feed Intake Daily
  feedBatchColumnIndex, // Feed Intake Feeds Batch
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

// Precomputed once — whether a column is disabled never changes at runtime,
// so there's no reason to hit the Set on every cell of every render.
const columnDisabledFlags = columnIndexes.map(
  (colIndex) => !editableColumnIndexes.has(colIndex)
);

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

const emphasizedColumnIndexes = new Set([2, 5, 6]);

const stickyHeaderClass = "fc-grid-header sticky z-30";
const groupHeaderClass =
  `${stickyHeaderClass} fc-grid-header-group px-1 py-0 text-left font-semibold leading-none`;

const subHeaderClass =
  `${stickyHeaderClass} px-1 py-0 text-center leading-none`;

const leafHeaderClass =
  `${stickyHeaderClass} px-1 py-0 text-center leading-none`;

const trackingLabelClass = "sticky z-40 inline-block";

type HeaderCellConfig = {
  label?: string;
  ariaLabel?: string;
  className: string;
  colSpan?: number;
  rowSpan?: number;
  groupEnd?: boolean;
  top?: number;
};

type FeedWarehouseAssociation = {
  id?: number | null;
  whse_code?: string | null;
  whse_name?: string | null;
  is_default_feed?: boolean | null;
};

type FlockCardNavigationContext = {
  farmId?: number | string | null;
  buildingKey?: string | null;
  buildingId?: number | string | null;
  brdFcId?: number | string | null;
  dailyFlockCardId?: number | string | null;
  flockCardId?: number | string | null;
  cardNo?: string | null;
  flockCode?: string | null;
  animalQty?: number | string | null;
  breed?: string | null;
};

type FeedFarm = {
  id: number;
  code: string;
  name: string | null;
  associated_warehouses?: FeedWarehouseAssociation[] | string[] | null;
  farm_id?: number | null;
  farm_code?: string | null;
  farm_name?: string | null;
};

type FeedBatchDialogMode = "onHand" | "cell";

type FeedBatchAllocation = {
  batchId: string;
  batchNumber: string;
  itemCode: string;
  itemName: string;
  warehouseCode: string;
  manufacturingDate: string;
  expiryDate: string;
  availableQty: number;
  selectedQty: number;
  source: "MANUAL" | "FIFO";
};

const asArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? value as T[] : [];

function normalizeFarmCode(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeFarm(farm: FeedFarm, masterFarms: FeedFarm[] = []): FeedFarm | null {
  const code = normalizeFarmCode(farm.code ?? farm.farm_code);
  if (!code) return null;

  const masterFarm = masterFarms.find(candidate => normalizeFarmCode(candidate.code) === code);
  const id = farm.id ?? farm.farm_id ?? masterFarm?.id ?? null;

  if (id == null) return null;

  return {
    ...masterFarm,
    ...farm,
    id,
    code,
    name: farm.name ?? farm.farm_name ?? masterFarm?.name ?? code,
    associated_warehouses: farm.associated_warehouses ?? masterFarm?.associated_warehouses ?? null,
  };
}

const getCachedWarehouses = (value: unknown): WarehouseData[] => {
  if (Array.isArray(value)) return value as WarehouseData[];
  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: WarehouseData[] }).data;
  }

  return [];
};

function getAssociatedWarehouseCode(warehouse: FeedWarehouseAssociation | string) {
  if (typeof warehouse === "string") return warehouse.trim();
  return String(warehouse.whse_code ?? "").trim();
}

function getDefaultFeedWarehouseCode(farm?: FeedFarm | null) {
  const associations = farm?.associated_warehouses;
  if (!Array.isArray(associations)) return "";

  const defaultWarehouse = associations.find(warehouse =>
    typeof warehouse === "object" && Boolean(warehouse?.is_default_feed)
  );

  return defaultWarehouse ? getAssociatedWarehouseCode(defaultWarehouse) : "";
}

function isFeedItem(item: Items) {
  const groupTokens = [
    item.group,
    item.item_group,
  ].map(value => String(value ?? "").trim().toUpperCase());

  if (groupTokens.includes("F") || groupTokens.includes("FEED") || groupTokens.includes("FEEDS")) {
    return true;
  }

  return `${item.item_code ?? ""} ${item.item_name ?? ""} ${item.description ?? ""}`
    .toLowerCase()
    .includes("feed");
}

function formatQuantity(value: number) {
  return Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 6 });
}

function formatDateValue(value: string) {
  return value || "-";
}

function formatDateTime(value: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRightBorderClass(isGroupEnd: boolean) {
  return isGroupEnd
    ? "fc-grid-group-divider"
    : "fc-grid-border-r";
}

function getHeaderBorderClass(isGroupEnd = false) {
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

function isStripedRow(rowIndex: number) {
  return stripedRow > 0 && (rowIndex + 1) % stripedRow === 0;
}

// Precomputed per-column class strings. Column grouping/striping is fully
// static, so these were being re-derived via template-literal concatenation
// for every one of the 1000+ body cells (and 27 footer cells) on every
// render. Now it's a plain array lookup.
const footerBorderClasses = columnIndexes.map((colIndex) => getFooterBorderClass(colIndex));
const bodyBorderClassesStriped = columnIndexes.map((colIndex) => getBodyBorderClass(colIndex, true));
const bodyBorderClassesPlain = columnIndexes.map((colIndex) => getBodyBorderClass(colIndex, false));
const bodyEmphasisClasses = columnIndexes.map((colIndex) =>
  emphasizedColumnIndexes.has(colIndex) ? "fc-grid-cell-emphasis" : ""
);

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

  { label: "Total", rowSpan: 2, top: middleHeaderTop, className: `${subHeaderClass} font-semibold`, },
  { label: "Cumulative", rowSpan: 2, groupEnd: true, top: middleHeaderTop, className: `${subHeaderClass} font-semibold`, },

  { label: "Daily kg/Flock", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
  { label: "Daily per Bird g/b", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
  { label: "Guideline g/b/d", rowSpan: 2, top: middleHeaderTop, className: subHeaderClass, },
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
  { label: "Total", groupEnd: true, top: bottomHeaderTop, className: `${leafHeaderClass} font-semibold`, },
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
  inputRef,
  onCommit,
  onBlur,
  onFocus,
  onKeyDown,
}: {
  id: string;
  disabled: boolean;
  value: string;
  inputRef: RefCallback<HTMLInputElement>;
  onCommit: (value: string) => void;
  onBlur: (value: string) => void;
  onFocus: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <Input
      key={`${id}-${value}`}
      id={id}
      name={id}
      disabled={disabled}
      defaultValue={value}
      ref={inputRef}
      onBlur={(event) => {
        const nextValue = event.currentTarget.value;

        window.setTimeout(() => {
          onCommit(nextValue);
          onBlur(nextValue);
        }, 0);
      }}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      style={{ minWidth: dataColumnWidth }}
      className="h-8 rounded-none border-0 bg-transparent text-center shadow-none transition-none focus:font-semibold focus:text-emerald-950 focus-visible:border-transparent focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[#7c766c] dark:focus:text-emerald-100 dark:disabled:bg-transparent dark:disabled:text-muted-foreground"
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
  const searchParams = useSearchParams();
  const { getValue, setValue } = useGlobalContext();
  const flockCardNavigationContext = getValue("brdFcNewContext") as FlockCardNavigationContext | undefined;
  const inputRefs = useRef<(HTMLElement | null)[][]>([]);
  const autoSelectFeedBatchRef = useRef<() => void>(() => undefined);
  const finishFeedBatchAllocationRef = useRef<() => void>(() => undefined);
  const autoSelectedFeedBatchFromShortcutRef = useRef(false);

  const [gridValues, setGridValues] = useState(initialGridValues);
  const [activeCell, setActiveCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [savedLineByRowIndex, setSavedLineByRowIndex] = useState<Record<number, { id: number; age: number }>>({});
  const [, startGridTransition] = useTransition();
  const deferredGridValues = useDeferredValue(gridValues);
  const [numberOfAnimals, setNumberOfAnimals] = useState(21500);
  const [flockCardId, setFlockCardId] = useState<number | null>(null);
  const [flockCardNo, setFlockCardNo] = useState("");
  const [flockCardCardNo, setFlockCardCardNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedWarehouseCode, setSelectedWarehouseCode] = useState("");
  const [fallbackAssignedFarms, setFallbackAssignedFarms] = useState<FeedFarm[]>([]);
  const [farmBuildings, setFarmBuildings] = useState<FarmBuildingOption[]>([]);
  const [loadingFarmBuildings, setLoadingFarmBuildings] = useState(false);
  const [farmBuildingError, setFarmBuildingError] = useState("");
  const [feedBatchRows, setFeedBatchRows] = useState<FeedBatchOnHand[]>([]);
  const [loadingFeedBatches, setLoadingFeedBatches] = useState(false);
  const [feedBatchError, setFeedBatchError] = useState("");
  const [feedBatchDialogOpen, setFeedBatchDialogOpen] = useState(false);
  const [feedBatchDialogMode, setFeedBatchDialogMode] = useState<FeedBatchDialogMode>("onHand");
  const [feedBatchSelectionRowIndex, setFeedBatchSelectionRowIndex] = useState<number | null>(null);
  const [feedBatchAllocationsByRow, setFeedBatchAllocationsByRow] = useState<Record<number, FeedBatchAllocation[]>>({});
  const [hydratedSavedFeedBatchRows, setHydratedSavedFeedBatchRows] = useState<Record<number, true>>({});
  const [reviewFeedBatch, setReviewFeedBatch] = useState<FeedBatchOnHand | null>(null);
  const [feedBatchTraceRows, setFeedBatchTraceRows] = useState<BatchTransactionTrail[]>([]);
  const [loadingFeedBatchTrace, setLoadingFeedBatchTrace] = useState(false);
  const [feedBatchTraceError, setFeedBatchTraceError] = useState("");
  const [headerOpen, setHeaderOpen] = useState(true);
  const headerOpenRef = useRef(true);

  const requestedFarmId = String(flockCardNavigationContext?.farmId ?? searchParams.get("farmId") ?? "");
  const requestedBuildingKey = String(flockCardNavigationContext?.buildingKey ?? searchParams.get("buildingKey") ?? "");
  const requestedBuildingId = String(flockCardNavigationContext?.buildingId ?? searchParams.get("buildingId") ?? "");
  const requestedFlockCardId = String(
    flockCardNavigationContext?.brdFcId ??
    flockCardNavigationContext?.dailyFlockCardId ??
    searchParams.get("brdFcId") ??
    searchParams.get("dailyFlockCardId") ??
    ""
  );
  const requestedCardNo = String(flockCardNavigationContext?.cardNo ?? searchParams.get("cardNo") ?? "").trim();
  const requestedFlockCode = String(flockCardNavigationContext?.flockCode ?? searchParams.get("flockCode") ?? "").trim();
  const linkedCardNo = requestedCardNo || flockCardCardNo;
  const displayFlockCode = requestedFlockCode || linkedCardNo || "-";
  const selectedBreed = String(flockCardNavigationContext?.breed ?? "").trim();
  const hasLockedFlockContext = Boolean(flockCardNavigationContext?.buildingKey);

  const farmMaster = useMemo(() => {
    const goodsReceiptReferences = getValue("goodsReceiptReferences") as
      | { farms?: FeedFarm[] }
      | undefined;

    const referenceFarms = asArray<FeedFarm>(goodsReceiptReferences?.farms);
    return referenceFarms.length
      ? referenceFarms
      : asArray<FeedFarm>(getValue("getFarmDB"));
  }, [getValue]);

  const sessionUser = getValue("UserInfoAuthSession")?.[0] as
    | { id?: number | string; users_farms?: unknown[] }
    | undefined;

  const assignedFarmCodes = useMemo(
    () => asArray<unknown>(sessionUser?.users_farms).map(normalizeFarmCode).filter(Boolean),
    [sessionUser?.users_farms]
  );

  const farms = useMemo(() => {
    const normalizedMasterFarms = farmMaster
      .map(farm => normalizeFarm(farm, farmMaster))
      .filter((farm): farm is FeedFarm => Boolean(farm));

    if (assignedFarmCodes.length > 0) {
      const assignedCodeSet = new Set(assignedFarmCodes);
      return normalizedMasterFarms.filter(farm => assignedCodeSet.has(farm.code));
    }

    return fallbackAssignedFarms
      .map(farm => normalizeFarm(farm, farmMaster))
      .filter((farm): farm is FeedFarm => Boolean(farm));
  }, [assignedFarmCodes, fallbackAssignedFarms, farmMaster]);

  const warehouses = useMemo(
    () => getCachedWarehouses(getValue("warehouses")),
    [getValue]
  );

  const feedItems = useMemo(
    () => asArray<Items>(getValue("itemmaster"))
      .filter(item => item.void === 1 || item.void == null)
      .filter(isFeedItem),
    [getValue]
  );

  const feedItemCodes = useMemo(
    () => feedItems
      .map(item => String(item.item_code ?? "").trim())
      .filter(Boolean),
    [feedItems]
  );

  const feedItemNameByCode = useMemo(() => {
    const map = new Map<string, string>();

    feedItems.forEach(item => {
      const code = String(item.item_code ?? "").trim().toUpperCase();
      if (!code) return;
      map.set(code, item.item_name || item.description || code);
    });

    return map;
  }, [feedItems]);

  const feedItemByCode = useMemo(() => {
    const map = new Map<string, Items>();

    feedItems.forEach(item => {
      const code = String(item.item_code ?? "").trim().toUpperCase();
      if (code) map.set(code, item);
    });

    return map;
  }, [feedItems]);

  const warehouseByCode = useMemo(() => {
    const map = new Map<string, WarehouseData>();

    warehouses.forEach(warehouse => {
      const code = String(warehouse.whse_code ?? "").trim().toUpperCase();
      if (code) map.set(code, warehouse);
    });

    return map;
  }, [warehouses]);

  const selectedFarm = useMemo(
    () => farms.find(farm => String(farm.id) === selectedFarmId) ?? null,
    [farms, selectedFarmId]
  );

  const selectedBuilding = useMemo(
    () => farmBuildings.find(building => building.key === selectedBuildingId) ?? null,
    [farmBuildings, selectedBuildingId]
  );

  const farmOptions = useMemo(
    () => farms.map(farm => ({
      code: String(farm.id),
      name: farm.code ? `${farm.code} - ${farm.name ?? ""}` : farm.name ?? String(farm.id),
    })),
    [farms]
  );

  const buildingOptions = useMemo(
    () => farmBuildings.map(building => ({
      code: building.key,
      name: building.code
        ? `${building.code} - ${building.name || "Unnamed building"}`
        : building.name || "Unnamed building",
    })),
    [farmBuildings]
  );

  const selectedWarehouse = useMemo(
    () => warehouses.find(warehouse =>
      String(warehouse.whse_code ?? "").trim() === selectedWarehouseCode
    ) ?? null,
    [warehouses, selectedWarehouseCode]
  );

  const selectedWarehouseLabel = selectedWarehouse
    ? selectedWarehouse.whse_name
      ? `${selectedWarehouse.whse_code} - ${selectedWarehouse.whse_name}`
      : String(selectedWarehouse.whse_code ?? "")
    : selectedWarehouseCode;

  const fifoFeedBatchRows = useMemo(
    () => [...feedBatchRows].sort((left, right) => {
      const leftDate = left.manufacturingDate || left.expiryDate || "9999-12-31";
      const rightDate = right.manufacturingDate || right.expiryDate || "9999-12-31";

      return leftDate.localeCompare(rightDate) ||
        left.itemCode.localeCompare(right.itemCode) ||
        left.batchNumber.localeCompare(right.batchNumber);
    }),
    [feedBatchRows]
  );

  const feedBatchAllocatedQtyByBatchId = useMemo(() => {
    const allocatedQtyByBatchId = new Map<string, number>();

    Object.entries(feedBatchAllocationsByRow).forEach(([rowIndex, allocations]) => {
      if (hydratedSavedFeedBatchRows[Number(rowIndex)]) return;

      allocations.forEach(allocation => {
        allocatedQtyByBatchId.set(
          allocation.batchId,
          (allocatedQtyByBatchId.get(allocation.batchId) ?? 0) + Number(allocation.selectedQty || 0)
        );
      });
    });

    return allocatedQtyByBatchId;
  }, [feedBatchAllocationsByRow, hydratedSavedFeedBatchRows]);

  const availableFeedBatchRows = useMemo(
    () => {
      const rowsById = new Map(fifoFeedBatchRows.map(row => [row.id, row]));

      Object.entries(feedBatchAllocationsByRow).forEach(([rowIndex, allocations]) => {
        if (!hydratedSavedFeedBatchRows[Number(rowIndex)]) return;

        allocations.forEach(allocation => {
          if (rowsById.has(allocation.batchId)) return;

          rowsById.set(allocation.batchId, {
            id: allocation.batchId,
            itemCode: allocation.itemCode,
            itemName: allocation.itemName,
            batchNumber: allocation.batchNumber,
            manufacturingDate: allocation.manufacturingDate,
            expiryDate: allocation.expiryDate,
            warehouseCode: allocation.warehouseCode,
            onHandQty: 0,
          });
        });
      });

      return Array.from(rowsById.values()).map(row => {
        const allocatedQty = feedBatchAllocatedQtyByBatchId.get(row.id) ?? 0;
        const onHandQty = Number(row.onHandQty || 0);

        return {
          ...row,
          onHandQty,
          allocatedQty,
          availableOnHandQty: Math.max(onHandQty - allocatedQty, 0),
        };
      });
    },
    [feedBatchAllocatedQtyByBatchId, feedBatchAllocationsByRow, fifoFeedBatchRows, hydratedSavedFeedBatchRows]
  );

  const positiveAvailableFeedBatchRows = useMemo(
    () => availableFeedBatchRows.filter(row => row.availableOnHandQty > 0),
    [availableFeedBatchRows]
  );

  const totalFeedOnHand = useMemo(
    () => positiveAvailableFeedBatchRows.reduce((total, row) => total + row.availableOnHandQty, 0),
    [positiveAvailableFeedBatchRows]
  );

  const feedBatchSelectionAge = feedBatchSelectionRowIndex == null
    ? null
    : rows[feedBatchSelectionRowIndex]?.age ?? null;

  const feedBatchColumnWidth = useMemo(() => {
    const longestBatchLength = gridValues.reduce((longest, row) => {
      return Math.max(longest, row[feedBatchColumnIndex]?.trim().length ?? 0);
    }, 0);

    if (longestBatchLength === 0) return feedBatchMinColumnWidth;

    return Math.min(
      feedBatchMaxColumnWidth,
      Math.max(feedBatchMinColumnWidth, longestBatchLength * 9 + 40)
    );
  }, [gridValues]);

  const columnWidths = useMemo(
    () => columnIndexes.map((colIndex) =>
      colIndex === feedBatchColumnIndex ? feedBatchColumnWidth : dataColumnWidth
    ),
    [feedBatchColumnWidth]
  );

  const tableMinWidth = useMemo(
    () => ageColumnWidth + columnWidths.reduce((total, width) => total + width, 0),
    [columnWidths]
  );

  const activeFeedBatchAllocations = useMemo(
    () => feedBatchSelectionRowIndex == null
      ? []
      : feedBatchAllocationsByRow[feedBatchSelectionRowIndex] ?? [],
    [feedBatchAllocationsByRow, feedBatchSelectionRowIndex]
  );
  const activeFeedBatchRowLocked =
    feedBatchSelectionRowIndex != null &&
    Boolean(savedLineByRowIndex[feedBatchSelectionRowIndex]);

  const activeFeedRequiredQty = feedBatchSelectionRowIndex == null
    ? 0
    : getNumericValue(gridValues[feedBatchSelectionRowIndex]?.[feedDailyKgColumnIndex] ?? "");

  const activeFeedAllocatedQty = activeFeedBatchAllocations.reduce(
    (total, allocation) => total + Number(allocation.selectedQty || 0),
    0
  );

  const activeFeedRemainingQty = Math.max(activeFeedRequiredQty - activeFeedAllocatedQty, 0);

  const activeAvailableFeedBatches = useMemo(
    () => positiveAvailableFeedBatchRows.map(row => ({
      ...row,
      availableToSelect: row.availableOnHandQty,
    })),
    [positiveAvailableFeedBatchRows]
  );

  useEffect(() => {
    if (assignedFarmCodes.length > 0 || !sessionUser?.id) return;

    let cancelled = false;

    getUserFarms(Number(sessionUser.id))
      .then(farms => {
        if (cancelled) return;
        setFallbackAssignedFarms(Array.isArray(farms) ? farms as FeedFarm[] : []);
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) setFallbackAssignedFarms([]);
      });

    return () => {
      cancelled = true;
    };
  }, [assignedFarmCodes.length, sessionUser?.id]);

  useEffect(() => {
    const animalQty = Number(flockCardNavigationContext?.animalQty ?? 0);
    if (Number.isFinite(animalQty) && animalQty > 0) {
      setNumberOfAnimals(animalQty);
    }
  }, [flockCardNavigationContext?.animalQty]);

  useEffect(() => {
    const cardId = Number(requestedFlockCardId);
    if ((!Number.isFinite(cardId) || cardId <= 0) && !requestedCardNo) return;

    let cancelled = false;
    setHydratedSavedFeedBatchRows({});

    getFlockCardSheet({ id: cardId, cardNo: requestedCardNo })
      .then(card => {
        if (cancelled || !card) return;

        setFlockCardId(card.id);
        setFlockCardNo(card.fcNo);
        setFlockCardCardNo(card.cardNo ?? "");
        if (card.animalQty > 0) setNumberOfAnimals(card.animalQty);
        if (card.farmId != null) setSelectedFarmId(String(card.farmId));

        const nextGridValues = initialGridValues.map(row => [...row]);
        const nextSavedLineByRowIndex: Record<number, { id: number; age: number }> = {};
        const nextAllocationsByRow: Record<number, FeedBatchAllocation[]> = {};
        const nextHydratedSavedFeedBatchRows: Record<number, true> = {};

        for (const line of card.lines) {
          const rowIndex = rows.findIndex(row => row.age === line.age);
          if (rowIndex < 0) continue;

          nextGridValues[rowIndex] = line.values.slice(0, dataColumnCount);
          const hasSavedFeedIntake =
            getNumericValue(line.values[feedDailyKgColumnIndex] ?? "") > 0 ||
            String(line.values[feedBatchColumnIndex] ?? "").trim() !== "" ||
            line.allocations.length > 0;

          if (hasSavedFeedIntake) {
            nextSavedLineByRowIndex[rowIndex] = { id: line.id, age: line.age };
          }
          if (line.allocations.length > 0) {
            nextAllocationsByRow[rowIndex] = line.allocations;
            nextHydratedSavedFeedBatchRows[rowIndex] = true;
          }
        }

        setGridValues(nextGridValues);
        setSavedLineByRowIndex(nextSavedLineByRowIndex);
        setFeedBatchAllocationsByRow(nextAllocationsByRow);
        setHydratedSavedFeedBatchRows(nextHydratedSavedFeedBatchRows);
      })
      .catch(error => {
        console.error(error);
        toast(`Unable to load flock card: ${error instanceof Error ? error.message : "Unknown error"}`);
      });

    return () => {
      cancelled = true;
    };
  }, [requestedCardNo, requestedFlockCardId]);

  useEffect(() => {
    if (selectedFarmId || farms.length === 0) return;

    const requestedFarm = farms.find(farm => String(farm.id) === requestedFarmId);
    const defaultFarmId = getValue("DefaultFarmId");
    const defaultFarm = farms.find(farm => String(farm.id) === String(defaultFarmId));
    const nextFarm = requestedFarm ?? defaultFarm ?? farms[0];

    if (nextFarm) setSelectedFarmId(String(nextFarm.id));
  }, [farms, getValue, requestedFarmId, selectedFarmId]);

  useEffect(() => {
    if (!selectedFarm) {
      setFarmBuildings([]);
      setSelectedBuildingId("");
      setFarmBuildingError("");
      setLoadingFarmBuildings(false);
      return;
    }

    let cancelled = false;
    setLoadingFarmBuildings(true);
    setFarmBuildingError("");

    getFarmBuildings(selectedFarm.id)
      .then(buildings => {
        if (cancelled) return;

        setFarmBuildings(buildings);
        setSelectedBuildingId(current => {
          if (current && buildings.some(building => building.key === current)) {
            return current;
          }

          const requestedBuilding = buildings.find(building =>
            building.key === requestedBuildingKey ||
            (requestedBuildingId && String(building.id) === requestedBuildingId)
          );
          if (requestedBuilding) return requestedBuilding.key;

          return buildings[0]?.key ?? "";
        });
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) {
          setFarmBuildings([]);
          setSelectedBuildingId("");
          setFarmBuildingError("Unable to load farm buildings.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFarmBuildings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestedBuildingId, requestedBuildingKey, selectedFarm]);

  useEffect(() => {
    if (!selectedFarm) {
      if (selectedWarehouseCode) setSelectedWarehouseCode("");
      return;
    }

    const defaultFeedWarehouseCode = getDefaultFeedWarehouseCode(selectedFarm);
    if (selectedWarehouseCode === defaultFeedWarehouseCode) return;

    setSelectedWarehouseCode(defaultFeedWarehouseCode);
  }, [selectedFarm, selectedWarehouseCode]);

  useEffect(() => {
    if (!selectedWarehouseCode || feedItemCodes.length === 0) {
      setFeedBatchRows([]);
      setFeedBatchError("");
      setLoadingFeedBatches(false);
      return;
    }

    let cancelled = false;
    setLoadingFeedBatches(true);
    setFeedBatchError("");

    getFeedBatchOnHandByWarehouse(feedItemCodes, selectedWarehouseCode)
      .then(rows => {
        if (cancelled) return;

        setFeedBatchRows(rows.map(row => ({
          ...row,
          itemName: feedItemNameByCode.get(row.itemCode.toUpperCase()) ?? row.itemName,
        })));
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) {
          setFeedBatchRows([]);
          setFeedBatchError("Unable to load feed batch on-hand.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFeedBatches(false);
      });

    return () => {
      cancelled = true;
    };
  }, [feedItemCodes, feedItemNameByCode, selectedWarehouseCode]);

  useEffect(() => {
    if (!reviewFeedBatch) {
      setFeedBatchTraceRows([]);
      setFeedBatchTraceError("");
      setLoadingFeedBatchTrace(false);
      return;
    }

    let cancelled = false;
    setFeedBatchTraceRows([]);
    setFeedBatchTraceError("");
    setLoadingFeedBatchTrace(true);

    getBatchTransactionTrail(
      reviewFeedBatch.itemCode,
      reviewFeedBatch.batchNumber,
    )
      .then(rows => {
        if (!cancelled) setFeedBatchTraceRows(rows);
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) setFeedBatchTraceError("Unable to load batch transaction trail.");
      })
      .finally(() => {
        if (!cancelled) setLoadingFeedBatchTrace(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reviewFeedBatch]);

  const computedGridValues = useMemo(
    () =>
      computeGridValues({
        gridValues: deferredGridValues,
        numberOfAnimals,
        feedDailyKgColumnIndex,
        feedDailyPerBirdColumnIndex,
        feedGuidelineColumnIndex,
        breed: selectedBreed,
      }),
    [deferredGridValues, numberOfAnimals, selectedBreed]
  );

  const columnTotals = useMemo(
    () => computeColumnTotals({
      computedGridValues,
      dataColumnCount,
      excludedColumnIndexes: [feedGuidelineColumnIndex],
    }),
    [computedGridValues]
  );

  // NOTE: previously this also maintained a `latestComputedGridValues` memo
  // (identical computation, just against non-deferred `gridValues`) purely so
  // save-time could read the freshest formula results. That doubled the cost
  // of computeGridValues on every single keystroke, even though the result
  // was only ever consumed once, at save time. It's now computed on demand
  // inside buildFlockCardLines instead.

  function handleCellChange(
    rowIndex: number,
    colIndex: number,
    value: string
  ) {
    if (savedLineByRowIndex[rowIndex] && feedIntakeColumnIndexes.has(colIndex)) return;

    const shouldClearFeedBatch =
      colIndex === feedDailyKgColumnIndex && getNumericValue(value) <= 0;

    // Single state update (and single array clone) covering both the edited
    // cell and, when needed, clearing the feed-batch cell — instead of two
    // separate setGridValues calls/renders.
    startGridTransition(() => {
      setGridValues((currentValues) => {
        const currentRow = currentValues[rowIndex];
        if (!currentRow) return currentValues;

        const feedBatchNextValue = shouldClearFeedBatch ? "" : currentRow[feedBatchColumnIndex];
        const unchanged =
          currentRow[colIndex] === value &&
          currentRow[feedBatchColumnIndex] === feedBatchNextValue;

        if (unchanged) return currentValues;

        return currentValues.map((row, currentRowIndex) => {
          if (currentRowIndex !== rowIndex) return row;

          return row.map((cellValue, currentColIndex) => {
            if (currentColIndex === colIndex) return value;
            if (shouldClearFeedBatch && currentColIndex === feedBatchColumnIndex) return "";
            return cellValue;
          });
        });
      });
    });

    if (shouldClearFeedBatch) {
      setFeedBatchAllocationsByRow(current => ({
        ...current,
        [rowIndex]: [],
      }));
    }
  }

  function rowHasFeedQuantity(rowIndex: number) {
    return getNumericValue(gridValues[rowIndex]?.[feedDailyKgColumnIndex] ?? "") > 0;
  }

  function rowHasFeedIntakeData(rowIndex: number) {
    const rowValues = gridValues[rowIndex] ?? [];

    return getNumericValue(rowValues[feedDailyKgColumnIndex] ?? "") > 0 ||
      String(rowValues[feedBatchColumnIndex] ?? "").trim() !== "" ||
      (feedBatchAllocationsByRow[rowIndex] ?? []).length > 0;
  }

  function rowHasFeedBatchData(rowIndex: number) {
    return String(gridValues[rowIndex]?.[feedBatchColumnIndex] ?? "").trim() !== "" ||
      (feedBatchAllocationsByRow[rowIndex] ?? []).length > 0;
  }

  async function copyRow(rowIndex: number) {
    const rowText = [rows[rowIndex]?.age ?? rowIndex, ...(computedGridValues[rowIndex] ?? [])].join("\t");

    try {
      await navigator.clipboard.writeText(rowText);
      toast("Row copied.");
    } catch (error) {
      console.error(error);
      toast("Unable to copy row.");
    }
  }

  function clearRow(rowIndex: number) {
    if (savedLineByRowIndex[rowIndex]) return;

    startGridTransition(() => {
      setGridValues(currentValues =>
        currentValues.map((row, currentRowIndex) =>
          currentRowIndex === rowIndex
            ? Array.from({ length: dataColumnCount }, () => "")
            : row
        )
      );
    });

    setFeedBatchAllocationsByRow(current => {
      const next = { ...current };
      delete next[rowIndex];
      return next;
    });
  }

  function formatFeedBatchAllocationCell(allocations: FeedBatchAllocation[]) {
    return allocations
      .filter(allocation => allocation.selectedQty > 0)
      .map(allocation => `${allocation.batchNumber} (${formatTotal(allocation.selectedQty)})`)
      .join(", ");
  }

  function parseFeedBatchAllocationCell(value: string) {
    const matches = value.matchAll(/([^,()]+?)\s*\(([-\d,.]+)\)/g);

    return Array.from(matches).flatMap(match => {
      const batchNumber = match[1]?.trim() ?? "";
      const selectedQty = getNumericValue(match[2] ?? "");

      return batchNumber && selectedQty > 0
        ? [{ batchNumber, selectedQty }]
        : [];
    });
  }

  function getFeedBatchAllocationsForSave(rowIndex: number) {
    const existingAllocations = feedBatchAllocationsByRow[rowIndex] ?? [];
    const parsedAllocations = parseFeedBatchAllocationCell(
      gridValues[rowIndex]?.[feedBatchColumnIndex] ?? ""
    );

    if (parsedAllocations.length === 0) return existingAllocations;

    return parsedAllocations.map(parsedAllocation => {
      const normalizedBatchNumber = parsedAllocation.batchNumber.toUpperCase();
      const existingAllocation = existingAllocations.find(allocation =>
        allocation.batchNumber.toUpperCase() === normalizedBatchNumber
      );
      const batch = availableFeedBatchRows.find(row =>
        row.batchNumber.toUpperCase() === normalizedBatchNumber
      );

      if (existingAllocation) {
        return {
          ...existingAllocation,
          selectedQty: parsedAllocation.selectedQty,
        };
      }

      if (batch) {
        return toFeedBatchAllocation(batch, parsedAllocation.selectedQty, "MANUAL");
      }

      throw new Error(`Unable to resolve feed batch ${parsedAllocation.batchNumber}. Please select it again from the feed batch dialog.`);
    });
  }

  function commitFeedBatchAllocations(rowIndex: number, allocations: FeedBatchAllocation[]) {
    if (savedLineByRowIndex[rowIndex]) return;

    const normalizedAllocations = allocations.filter(allocation => allocation.selectedQty > 0);

    setFeedBatchAllocationsByRow(current => ({
      ...current,
      [rowIndex]: normalizedAllocations,
    }));
    handleCellChange(rowIndex, feedBatchColumnIndex, formatFeedBatchAllocationCell(normalizedAllocations));
  }

  function toFeedBatchAllocation(
    batch: FeedBatchOnHand,
    selectedQty: number,
    source: "MANUAL" | "FIFO" = "MANUAL"
  ): FeedBatchAllocation {
    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      itemCode: batch.itemCode,
      itemName: batch.itemName || feedItemNameByCode.get(batch.itemCode.toUpperCase()) || batch.itemCode,
      warehouseCode: batch.warehouseCode,
      manufacturingDate: batch.manufacturingDate,
      expiryDate: batch.expiryDate,
      availableQty: Number(batch.onHandQty || 0),
      selectedQty,
      source,
    };
  }

  function getFeedBatchAllocationId(itemCode: string, batchNumber: string, warehouseCode: string) {
    return [
      itemCode.trim().toUpperCase(),
      batchNumber.trim().toUpperCase(),
      warehouseCode.trim().toUpperCase(),
    ].join("|");
  }

  function payloadAllocationToFeedBatchAllocation(allocation: FlockCardLinePayload["allocations"][number]): FeedBatchAllocation {
    return {
      batchId: getFeedBatchAllocationId(allocation.itemCode, allocation.batchNumber, allocation.warehouseCode),
      batchNumber: allocation.batchNumber,
      itemCode: allocation.itemCode,
      itemName: allocation.itemName ?? allocation.itemCode,
      warehouseCode: allocation.warehouseCode,
      manufacturingDate: allocation.manufacturingDate ?? "",
      expiryDate: allocation.expiryDate ?? "",
      availableQty: allocation.onHandSnapshot,
      selectedQty: allocation.allocatedQty,
      source: allocation.source ?? "MANUAL",
    };
  }

  function getFeedBatchAllocatedQty(batchId: string, excludedRowIndex?: number) {
    return Object.entries(feedBatchAllocationsByRow).reduce((total, [rowIndex, allocations]) => {
      const numericRowIndex = Number(rowIndex);
      if (excludedRowIndex != null && numericRowIndex === excludedRowIndex) return total;
      if (hydratedSavedFeedBatchRows[numericRowIndex]) return total;

      return total + allocations
        .filter(allocation => allocation.batchId === batchId)
        .reduce((allocationTotal, allocation) => allocationTotal + Number(allocation.selectedQty || 0), 0);
    }, 0);
  }

  function addFeedBatchAllocation(batch: FeedBatchOnHand) {
    if (feedBatchSelectionRowIndex == null) return;
    if (savedLineByRowIndex[feedBatchSelectionRowIndex]) return;

    const existingAllocations = feedBatchAllocationsByRow[feedBatchSelectionRowIndex] ?? [];
    const allocatedOutsideActiveRow = getFeedBatchAllocatedQty(batch.id, feedBatchSelectionRowIndex);
    const selectedForBatch = existingAllocations
      .filter(allocation => allocation.batchId === batch.id)
      .reduce((total, allocation) => total + Number(allocation.selectedQty || 0), 0);
    const availableToSelect = Math.max(Number(batch.onHandQty || 0) - allocatedOutsideActiveRow - selectedForBatch, 0);
    const qtyToSelect = Math.min(activeFeedRemainingQty, availableToSelect);

    if (qtyToSelect <= 0) return;

    const nextAllocations = existingAllocations.some(allocation => allocation.batchId === batch.id)
      ? existingAllocations.map(allocation =>
        allocation.batchId === batch.id
          ? { ...allocation, selectedQty: allocation.selectedQty + qtyToSelect }
          : allocation
      )
      : [...existingAllocations, toFeedBatchAllocation(batch, qtyToSelect)];

    commitFeedBatchAllocations(feedBatchSelectionRowIndex, nextAllocations);
  }

  function updateFeedBatchAllocationQty(batchId: string, value: string) {
    if (feedBatchSelectionRowIndex == null) return;
    if (savedLineByRowIndex[feedBatchSelectionRowIndex]) return;

    const requestedQty = Math.max(getNumericValue(value), 0);
    const currentAllocations = feedBatchAllocationsByRow[feedBatchSelectionRowIndex] ?? [];

    const otherAllocatedQty = currentAllocations
      .filter(allocation => allocation.batchId !== batchId)
      .reduce((total, allocation) => total + Number(allocation.selectedQty || 0), 0);
    const allocatedOutsideActiveRow = getFeedBatchAllocatedQty(batchId, feedBatchSelectionRowIndex);

    const nextAllocations = currentAllocations.map(allocation => {
      if (allocation.batchId !== batchId) return allocation;

      const maxForRow = Math.max(activeFeedRequiredQty - otherAllocatedQty, 0);
      const maxForBatch = Math.max(allocation.availableQty - allocatedOutsideActiveRow, 0);
      return {
        ...allocation,
        selectedQty: Math.min(requestedQty, maxForBatch, maxForRow),
      };
    });

    commitFeedBatchAllocations(feedBatchSelectionRowIndex, nextAllocations);
  }

  function removeFeedBatchAllocation(batchId: string) {
    if (feedBatchSelectionRowIndex == null) return;
    if (savedLineByRowIndex[feedBatchSelectionRowIndex]) return;

    commitFeedBatchAllocations(
      feedBatchSelectionRowIndex,
      (feedBatchAllocationsByRow[feedBatchSelectionRowIndex] ?? []).filter(
        allocation => allocation.batchId !== batchId
      )
    );
  }

  function finishFeedBatchAllocation() {
    if (feedBatchSelectionRowIndex == null) return;

    autoSelectedFeedBatchFromShortcutRef.current = false;
    setFeedBatchSelectionRowIndex(null);
    setFeedBatchDialogOpen(false);
    focusCell(feedBatchSelectionRowIndex, feedBatchColumnIndex);
  }

  finishFeedBatchAllocationRef.current = finishFeedBatchAllocation;

  function autoSelectFeedBatch() {
    if (feedBatchSelectionRowIndex == null || activeAvailableFeedBatches.length === 0) return;
    if (savedLineByRowIndex[feedBatchSelectionRowIndex]) return;

    let remainingQty = activeFeedRequiredQty;
    const allocations: FeedBatchAllocation[] = [];

    for (const batch of activeAvailableFeedBatches) {
      if (remainingQty <= 0) break;

      const availableQty = batch.availableToSelect;
      const selectedQty = Math.min(remainingQty, availableQty);
      if (selectedQty <= 0) continue;

      allocations.push(toFeedBatchAllocation(batch, selectedQty, "FIFO"));
      remainingQty -= selectedQty;
    }

    commitFeedBatchAllocations(feedBatchSelectionRowIndex, allocations);
  }

  autoSelectFeedBatchRef.current = autoSelectFeedBatch;

  useEffect(() => {
    const isFeedBatchSelectionOpen =
      feedBatchDialogOpen &&
      feedBatchDialogMode === "cell" &&
      feedBatchSelectionRowIndex != null;

    if (!isFeedBatchSelectionOpen) {
      autoSelectedFeedBatchFromShortcutRef.current = false;
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const canAutoSelect =
        !loadingFeedBatches &&
        activeFeedRequiredQty > 0 &&
        activeAvailableFeedBatches.length > 0;

      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "a") {
        if (!canAutoSelect) return;

        event.preventDefault();
        autoSelectedFeedBatchFromShortcutRef.current = true;
        autoSelectFeedBatchRef.current();
        return;
      }

      if (
        event.key === "Enter" &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        autoSelectedFeedBatchFromShortcutRef.current
      ) {
        event.preventDefault();
        finishFeedBatchAllocationRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    feedBatchDialogOpen,
    feedBatchDialogMode,
    feedBatchSelectionRowIndex,
    loadingFeedBatches,
    activeFeedRequiredQty,
    activeAvailableFeedBatches,
  ]);

  function openFeedBatchSelection(rowIndex: number) {
    if (!rowHasFeedQuantity(rowIndex)) return;

    setFeedBatchDialogMode("cell");
    setFeedBatchSelectionRowIndex(rowIndex);
    setReviewFeedBatch(null);
    setFeedBatchDialogOpen(true);
  }

  function findFeedBatchByNumber(batchNumber: string) {
    const normalizedBatchNumber = batchNumber.trim().toUpperCase();
    if (!normalizedBatchNumber) return null;

    return availableFeedBatchRows.find(row => row.batchNumber.toUpperCase() === normalizedBatchNumber) ?? null;
  }

  function openFeedBatchReview(rowIndex: number) {
    const rowLocked = Boolean(savedLineByRowIndex[rowIndex]);
    if (!rowHasFeedQuantity(rowIndex) && !rowHasFeedBatchData(rowIndex)) return;

    if ((feedBatchAllocationsByRow[rowIndex] ?? []).length > 0) {
      openFeedBatchSelection(rowIndex);
      return;
    }

    if (rowLocked) return;

    const batchNumber = gridValues[rowIndex]?.[feedBatchColumnIndex]?.trim() ?? "";
    const batch = findFeedBatchByNumber(batchNumber);

    if (!batch) {
      openFeedBatchSelection(rowIndex);
      return;
    }

    setFeedBatchDialogMode("cell");
    setFeedBatchSelectionRowIndex(null);
    setReviewFeedBatch(batch);
    setFeedBatchDialogOpen(true);
  }

  function clearFeedBatch(rowIndex: number) {
    if (savedLineByRowIndex[rowIndex]) return;

    setFeedBatchAllocationsByRow(current => ({
      ...current,
      [rowIndex]: [],
    }));
    handleCellChange(rowIndex, feedBatchColumnIndex, "");
    setReviewFeedBatch(null);
  }

  function buildFlockCardLines(): FlockCardLinePayload[] {
    // Computed once, on demand, at save time — see note near computedGridValues.
    const computedValuesForSave = computeGridValues({
      gridValues,
      numberOfAnimals,
      feedDailyKgColumnIndex,
      feedDailyPerBirdColumnIndex,
      feedGuidelineColumnIndex,
      breed: selectedBreed,
    });

    return rows.flatMap((row, rowIndex) => {
      const savedLine = savedLineByRowIndex[rowIndex];
      const feedBatchAllocationsForSave = getFeedBatchAllocationsForSave(rowIndex);

      return [{
        id: savedLine?.id ?? null,
        age: row.age,
        values: computedValuesForSave[rowIndex],
        feedIntakeLocked: Boolean(savedLine),
        allocations: feedBatchAllocationsForSave.map((allocation, allocationIndex) => {
          const item = feedItemByCode.get(allocation.itemCode.toUpperCase());
          const warehouse = warehouseByCode.get(allocation.warehouseCode.toUpperCase());

          return {
            lineNo: allocationIndex + 1,
            itemId: item?.id ?? null,
            itemCode: allocation.itemCode,
            itemName: allocation.itemName || item?.item_name || item?.description || null,
            batchNumber: allocation.batchNumber,
            warehouseId: warehouse?.id ?? null,
            warehouseCode: allocation.warehouseCode,
            warehouseName: warehouse?.whse_name ?? null,
            allocatedQty: allocation.selectedQty,
            onHandSnapshot: allocation.availableQty,
            manufacturingDate: allocation.manufacturingDate || null,
            expiryDate: allocation.expiryDate || null,
            source: allocation.source,
          };
        }),
      }];
    });
  }

  async function handleSave() {
    if (saving) return;

    if (!selectedFarm) {
      toast("Please select a farm.");
      return;
    }

    if (!selectedBuilding) {
      toast("Please select a building.");
      return;
    }

    if (!selectedWarehouseCode) {
      toast("Please select a farm with a default feed warehouse.");
      return;
    }

    setSaving(true);

    try {
      const lines = buildFlockCardLines();
      const savedCard = await saveFlockCard({
        id: flockCardId,
        fcNo: flockCardNo,
        cardNo: linkedCardNo,
        farmId: selectedFarm.id,
        farmCode: selectedFarm.code,
        farmName: selectedFarm.name,
        buildingId: selectedBuilding.source === "BUILDING" ? selectedBuilding.id ?? null : null,
        buildingWarehouseId: selectedBuilding.source === "WAREHOUSE" ? selectedBuilding.id ?? null : null,
        buildingSource: selectedBuilding.source,
        buildingKey: selectedBuilding.key,
        buildingCode: selectedBuilding.code,
        buildingName: selectedBuilding.name,
        buildingStatus: selectedBuilding.status,
        feedWarehouseId: selectedWarehouse?.id ?? null,
        feedWarehouseCode: selectedWarehouseCode,
        feedWarehouseName: selectedWarehouse?.whse_name ?? null,
        animalQty: numberOfAnimals,
        lines,
      });

      setFlockCardId(savedCard.id);
      setFlockCardNo(savedCard.fcNo);
      setFlockCardCardNo(linkedCardNo);
      setValue("brdFcNewContext", {
        ...(flockCardNavigationContext ?? {}),
        farmId: selectedFarm.id,
        buildingKey: selectedBuilding.key,
        buildingId: selectedBuilding.id,
        animalQty: numberOfAnimals,
        breed: selectedBreed,
        cardNo: linkedCardNo,
        flockCode: displayFlockCode === "-" ? "" : displayFlockCode,
        brdFcId: savedCard.id,
        dailyFlockCardId: savedCard.id,
      });
      setSavedLineByRowIndex(current => {
        const next = { ...current };

        for (const savedLine of savedCard.savedLines) {
          const rowIndex = rows.findIndex(row => row.age === savedLine.age);
          if (rowIndex >= 0 && rowHasFeedIntakeData(rowIndex)) {
            next[rowIndex] = savedLine;
          }
        }

        return next;
      });
      setFeedBatchAllocationsByRow(current => {
        const next = { ...current };

        lines.forEach(line => {
          const rowIndex = rows.findIndex(row => row.age === line.age);
          if (rowIndex >= 0 && line.allocations.length > 0) {
            next[rowIndex] = line.allocations.map(payloadAllocationToFeedBatchAllocation);
          }
        });

        return next;
      });
      setHydratedSavedFeedBatchRows(current => {
        const next = { ...current };

        lines.forEach(line => {
          const rowIndex = rows.findIndex(row => row.age === line.age);
          if (rowIndex >= 0 && line.allocations.length > 0) {
            next[rowIndex] = true;
          }
        });

        return next;
      });
      toast(`Flock card saved: ${savedCard.fcNo}`);
    } catch (error) {
      console.error(error);
      toast(`Unable to save flock card: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function reverseFeedIntake(rowIndex: number) {
    const savedLine = savedLineByRowIndex[rowIndex];
    if (!savedLine) return;

    try {
      await reverseFlockCardFeedIntake(savedLine.id, `Reversed feed intake from flock card row age ${savedLine.age}`);
      setSavedLineByRowIndex(current => {
        const next = { ...current };
        delete next[rowIndex];
        return next;
      });
      startGridTransition(() => {
        setGridValues(currentValues =>
          currentValues.map((gridRow, currentRowIndex) =>
            currentRowIndex === rowIndex
              ? gridRow.map((cellValue, currentColIndex) =>
                feedIntakeColumnIndexes.has(currentColIndex) ? "" : cellValue
              )
              : gridRow
          )
        );
      });
      setFeedBatchAllocationsByRow(current => {
        const next = { ...current };
        delete next[rowIndex];
        return next;
      });
      setHydratedSavedFeedBatchRows(current => {
        const next = { ...current };
        delete next[rowIndex];
        return next;
      });
      toast(`Age ${savedLine.age} feed intake reversed. You can now enter corrected feed intake.`);
    } catch (error) {
      console.error(error);
      toast(`Unable to reverse feed intake: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  function openFeedOnHandSummary() {
    setFeedBatchDialogMode("onHand");
    setFeedBatchSelectionRowIndex(null);
    setReviewFeedBatch(null);
    setFeedBatchDialogOpen(true);
  }

  function focusCell(rowIndex: number, colIndex: number) {
    const input = inputRefs.current[rowIndex]?.[colIndex];

    if (!input || input.getAttribute("disabled") != null) {
      return false;
    }

    setActiveCell({ rowIndex, colIndex });
    input.focus();
    if (input instanceof HTMLInputElement) input.select();
    return true;
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

  function getNextFocusableHorizontalTarget(
    rowIndex: number,
    colIndex: number,
    step: 1 | -1
  ) {
    let target = getHorizontalTarget(rowIndex, colIndex, step);

    while (target) {
      const input = inputRefs.current[target.rowIndex]?.[target.colIndex];

      if (input && input.getAttribute("disabled") == null) {
        return target;
      }

      target = getHorizontalTarget(target.rowIndex, target.colIndex, step);
    }

    return null;
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
    event: KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colIndex: number
  ) {
    const keyActions: Record<string, () => void> = {
      ArrowLeft: () =>
        moveFocus(getNextFocusableHorizontalTarget(rowIndex, colIndex, -1)),
      ArrowRight: () =>
        moveFocus(getNextFocusableHorizontalTarget(rowIndex, colIndex, 1)),
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
          getNextFocusableHorizontalTarget(
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

  function handleTableScroll(event: UIEvent<HTMLDivElement>) {
    const shouldOpen = event.currentTarget.scrollTop <= 0;
    const shouldClose = event.currentTarget.scrollTop > 16;

    if (shouldOpen && !headerOpenRef.current) {
      headerOpenRef.current = true;
      setHeaderOpen(true);
      return;
    }

    if (shouldClose && headerOpenRef.current) {
      headerOpenRef.current = false;
      setHeaderOpen(false);
    }
  }

  return (
    <div className="h-screen w-full bg-slate-100 p-4 dark:bg-background">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
        <Collapsible open={headerOpen} onOpenChange={setHeaderOpen}>
          <CollapsibleContent>
            <div className="mx-2 flex items-start justify-between gap-3 p-2">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(190px,260px)_minmax(200px,280px)_145px_145px_minmax(180px,240px)_minmax(160px,220px)_auto]">
                  <SearchableCombobox
                    label="Farm"
                    items={farmOptions}
                    value={selectedFarmId}
                    onValueChange={(value) => {
                      if (hasLockedFlockContext) return;
                      setSelectedFarmId(value);
                      setSelectedBuildingId("");
                      setSelectedWarehouseCode("");
                    }}
                    placeholder="Select farm..."
                    showCode
                    className="w-full"
                  />

                  <label className="relative block min-w-0">
                    <span className="text-sm font-medium">Default Feed Warehouse</span>

                    <Input
                      value={selectedWarehouseLabel}
                      readOnly
                      disabled
                      placeholder={selectedFarmId ? "No default feed warehouse" : "Select farm first..."}
                      className="bg-slate-50 text-slate-700 disabled:cursor-not-allowed disabled:opacity-100 dark:bg-background/60 dark:text-foreground"
                    />
                  </label>

                  <label className="relative block min-w-0">
                    <span className="text-sm font-medium">Number of animals</span>

                    <Input
                      value={numberOfAnimals}
                      onChange={(event) =>
                        setNumberOfAnimals(Number(event.target.value))
                      }
                    />
                  </label>

                  <div className="relative block min-w-0">
                    <span className="text-sm font-medium">Feed On-hand</span>

                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      disabled={!selectedWarehouseCode}
                      onClick={openFeedOnHandSummary}
                      className="h-10 w-full justify-start border-input bg-[#fffdfb] px-3 text-foreground hover:border-ring hover:bg-accent hover:text-accent-foreground disabled:opacity-100 dark:bg-input/30"
                    >
                      {loadingFeedBatches ? (
                        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <PackageCheck className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-left">
                        {loadingFeedBatches ? "Loading..." : formatQuantity(totalFeedOnHand)}
                      </span>
                      <span className="rounded border bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                        {positiveAvailableFeedBatchRows.length}
                      </span>
                      <MousePointerClick className="size-4 shrink-0 text-primary" />
                    </Button>

                    {feedBatchError ? (
                      <div className="mt-1 truncate text-xs text-amber-700 dark:text-amber-400">
                        {feedBatchError}
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    {hasLockedFlockContext ? (
                      <label className="block min-w-0">
                        <span className="text-sm font-medium">Building</span>
                        <Input
                          value={selectedBuilding
                            ? `${selectedBuilding.code}${selectedBuilding.name ? ` - ${selectedBuilding.name}` : ""}`
                            : String(flockCardNavigationContext?.buildingKey ?? "")}
                          readOnly
                          className="h-10 bg-[#fffdfb] dark:bg-input/30"
                        />
                      </label>
                    ) : loadingFarmBuildings ? (
                      <label className="block min-w-0">
                        <span className="text-sm font-medium">Building</span>
                        <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-[#fffdfb] px-3 text-sm text-muted-foreground dark:bg-input/30">
                          <Loader2 className="size-4 animate-spin" />
                          Loading buildings...
                        </div>
                      </label>
                    ) : farmBuildingError ? (
                      <label className="block min-w-0">
                        <span className="text-sm font-medium">Building</span>
                        <div className="flex h-10 items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                          {farmBuildingError}
                        </div>
                      </label>
                    ) : farmBuildings.length === 0 ? (
                      <label className="block min-w-0">
                        <span className="text-sm font-medium">Building</span>
                        <div className="flex h-10 items-center rounded-md border border-input bg-[#fffdfb] px-3 text-sm text-muted-foreground dark:bg-input/30">
                          No buildings found for this farm.
                        </div>
                      </label>
                    ) : (
                      <SearchableCombobox
                        label="Building"
                        items={buildingOptions}
                        value={selectedBuildingId}
                        onValueChange={setSelectedBuildingId}
                        placeholder="Select building..."
                        className="w-full"
                      />
                    )}
                  </div>

                  <label className="relative block min-w-0">
                    <span className="text-sm font-medium">Flock Code</span>

                    <Input
                      value={displayFlockCode}
                      readOnly
                      disabled
                      className="h-10 bg-slate-50 text-slate-700 disabled:cursor-not-allowed disabled:opacity-100 dark:bg-background/60 dark:text-foreground"
                    />
                  </label>
                  
                  <div className="flex min-w-0 flex-wrap items-center gap-2 md:col-span-2 xl:col-span-1 xl:justify-self-end">
                  
                  <Help />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Save
                    </Button>

                    {flockCardNo ? (
                      <span className="rounded border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                        {flockCardNo}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>


            </div>
          </CollapsibleContent>
        </Collapsible>

        <Dialog
          open={feedBatchDialogOpen}
          onOpenChange={(open) => {
            setFeedBatchDialogOpen(open);
            if (!open) {
              setFeedBatchDialogMode("onHand");
              setFeedBatchSelectionRowIndex(null);
              setReviewFeedBatch(null);
            }
          }}
        >
          <DialogContent
            className={`max-h-[90vh] overflow-y-auto ${feedBatchDialogMode === "cell" ? "sm:max-w-6xl xl:max-w-7xl" : "sm:max-w-4xl"
              }`}
          >
            <DialogHeader>
              <DialogTitle>
                {feedBatchDialogMode === "onHand"
                  ? "Feed On-hand Quantity"
                  : reviewFeedBatch
                    ? "Feed Batch Details"
                    : feedBatchSelectionRowIndex == null ? "Feed Batch Information" : "Select Feed Batch"}
              </DialogTitle>
              <DialogDescription>
                {feedBatchDialogMode === "onHand"
                  ? `Current on-hand feed quantity in ${selectedWarehouseLabel || "the default feed warehouse"}.`
                  : reviewFeedBatch
                    ? `${reviewFeedBatch.batchNumber} information and movement history.`
                    : feedBatchSelectionRowIndex == null
                      ? `On-hand feed batches in ${selectedWarehouseLabel || "the default feed warehouse"}.`
                      : `Choose the feed used on age ${feedBatchSelectionAge ?? ""}. Auto select follows FIFO.`}
              </DialogDescription>
            </DialogHeader>

            {feedBatchDialogMode === "cell" && feedBatchSelectionRowIndex != null ? (
              <div className="rounded-md border bg-white p-3 shadow">
                <div className="grid gap-2 text-sm sm:grid-cols-5">
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Age</div>
                    <div className="font-semibold text-foreground">{feedBatchSelectionAge ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Daily kg/Flock</div>
                    <div className="font-semibold tabular-nums text-foreground">{formatQuantity(activeFeedRequiredQty)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Allocated</div>
                    <div className="font-semibold tabular-nums text-foreground">{formatQuantity(activeFeedAllocatedQty)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Remaining</div>
                    <div className={`font-semibold tabular-nums ${activeFeedRemainingQty > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                      {formatQuantity(activeFeedRemainingQty)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Direction</div>
                    <div className="font-semibold text-foreground">Out</div>
                  </div>
                </div>

              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border bg-white px-3 py-2 shadow">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Total on hand
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {loadingFeedBatches ? "Loading..." : formatQuantity(totalFeedOnHand)}
                </div>
              </div>

              <div className="rounded-md border bg-white px-3 py-2 shadow">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Batch count
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {positiveAvailableFeedBatchRows.length}
                </div>
              </div>

              <div className="rounded-md border bg-white px-3 py-2 shadow">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Warehouse
                </div>
                <div className="mt-1 truncate text-sm font-semibold">
                  {selectedWarehouseLabel || "No default warehouse"}
                </div>
              </div>
            </div>

            {feedBatchDialogMode === "onHand" ? (
              loadingFeedBatches ? (
                <div className="flex items-center justify-center gap-2 rounded-md border bg-muted/40 px-3 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading feed on-hand quantity...
                </div>
              ) : feedBatchError ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {feedBatchError}
                </div>
              ) : positiveAvailableFeedBatchRows.length === 0 ? (
                <div className="rounded-md border bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
                  No feed on-hand quantity was found in this warehouse.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <div className="min-w-[620px]">
                    <div className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.5fr)_110px_100px_100px] gap-3 bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                      <div>Batch</div>
                      <div>Consists of</div>
                      <div className="text-right">On hand</div>
                      <div>MFG</div>
                      <div>EXP</div>
                    </div>

                    <div className="max-h-[48vh] overflow-y-auto">
                      {positiveAvailableFeedBatchRows.map(row => (
                        <div
                          key={row.id}
                          className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.5fr)_110px_100px_100px] gap-3 border-t px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-foreground">
                              {row.batchNumber}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {row.warehouseCode}
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {row.itemName || feedItemNameByCode.get(row.itemCode.toUpperCase()) || row.itemCode}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {row.itemCode}
                            </div>
                          </div>

                          <div className="text-right font-semibold tabular-nums text-foreground">
                            {formatQuantity(row.availableOnHandQty)}
                          </div>
                          <div className="text-muted-foreground">
                            {formatDateValue(row.manufacturingDate)}
                          </div>
                          <div className="text-muted-foreground">
                            {formatDateValue(row.expiryDate)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            ) : reviewFeedBatch ? (
              <Tabs defaultValue="details" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="trace">Trace</TabsTrigger>
                  <TabsTrigger value="batches">Batches</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Batch</div>
                      <div className="mt-1 break-words font-semibold text-foreground">{reviewFeedBatch.batchNumber}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Item</div>
                      <div className="mt-1 font-semibold text-foreground">
                        {reviewFeedBatch.itemName || feedItemNameByCode.get(reviewFeedBatch.itemCode.toUpperCase()) || reviewFeedBatch.itemCode}
                      </div>
                      <div className="text-xs text-muted-foreground">{reviewFeedBatch.itemCode}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Warehouse</div>
                      <div className="mt-1 font-semibold text-foreground">{reviewFeedBatch.warehouseCode || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">On hand</div>
                      <div className="mt-1 font-semibold tabular-nums text-foreground">
                        {formatQuantity(Math.max(
                          Number(reviewFeedBatch.onHandQty || 0) - (feedBatchAllocatedQtyByBatchId.get(reviewFeedBatch.id) ?? 0),
                          0
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Manufacturing Date</div>
                      <div className="mt-1 font-semibold text-foreground">{formatDateValue(reviewFeedBatch.manufacturingDate)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Expiry Date</div>
                      <div className="mt-1 font-semibold text-foreground">{formatDateValue(reviewFeedBatch.expiryDate)}</div>
                    </div>
                  </div>

                  {feedBatchSelectionRowIndex != null ? (
                    <Button
                      type="button"
                      onClick={() => addFeedBatchAllocation(reviewFeedBatch)}
                      disabled={activeFeedRemainingQty <= 0}
                    >
                      <PackageCheck className="size-4" />
                      Allocate this batch
                    </Button>
                  ) : null}
                </TabsContent>

                <TabsContent value="trace" className="space-y-3">
                  {loadingFeedBatchTrace ? (
                    <div className="flex min-h-32 items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading transaction trail...
                    </div>
                  ) : feedBatchTraceError ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                      {feedBatchTraceError}
                    </div>
                  ) : feedBatchTraceRows.length === 0 ? (
                    <div className="rounded-md border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
                      No inventory postings were found for this batch.
                    </div>
                  ) : (
                    <div className="relative space-y-3 pl-5">
                      <div className="absolute left-[11px] top-2 h-[calc(100%-1rem)] w-px bg-amber-200" />
                      {feedBatchTraceRows.map(row => {
                        const isOut = row.signedQty < 0;
                        const movementLabel = isOut ? "OUT" : "IN";

                        return (
                          <div key={row.id} className="relative rounded-md border bg-card p-3 shadow-sm">
                            <div className={`absolute -left-[17px] top-4 flex size-7 items-center justify-center rounded-full border bg-card ${isOut ? "border-red-200 text-red-600" : "border-emerald-200 text-emerald-700"}`}>
                              <ArrowRightCircle className={`size-4 ${isOut ? "rotate-180" : ""}`} />
                            </div>

                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${isOut ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                                    {movementLabel}
                                  </span>
                                  <span className="font-semibold text-foreground">{row.documentLabel}</span>
                                  <span className="text-xs text-muted-foreground">{row.sourceDocType || "-"}</span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {formatDateTime(row.createdAt)}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className={`text-sm font-semibold tabular-nums ${isOut ? "text-red-700" : "text-emerald-700"}`}>
                                  {isOut ? "-" : "+"}{formatQuantity(Math.abs(row.signedQty))}
                                </div>
                                <div className="text-xs text-muted-foreground">Movement</div>
                              </div>
                            </div>

                            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-5">
                              <div className="rounded-md bg-amber-50 px-2 py-1">
                                <span className="block font-medium text-amber-700">Running Balance</span>
                                <span className="font-semibold tabular-nums text-amber-900">{formatQuantity(row.runningQty)}</span>
                              </div>
                              <div className="rounded-md bg-muted/40 px-2 py-1">
                                <span className="block font-medium">Warehouse</span>
                                <span className="text-foreground">{row.warehouseCode || "-"}</span>
                              </div>
                              <div className="rounded-md bg-muted/40 px-2 py-1">
                                <span className="block font-medium">Bin</span>
                                <span className="text-foreground">{row.binCode || "-"}</span>
                              </div>
                              <div className="rounded-md bg-muted/40 px-2 py-1">
                                <span className="block font-medium">Reference</span>
                                <span className="text-foreground">{row.ref || row.ref2 || "-"}</span>
                              </div>
                              <div className="rounded-md bg-muted/40 px-2 py-1">
                                <span className="block font-medium">Posting ID</span>
                                <span className="text-foreground">#{row.id}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="batches">
                  <div className="overflow-x-auto rounded-md border">
                    <div className="min-w-[720px]">
                      <div className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.5fr)_110px_100px_100px_90px] gap-3 bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                        <div>Batch</div>
                        <div>Consists of</div>
                        <div className="text-right">On hand</div>
                        <div>MFG</div>
                        <div>EXP</div>
                        <div className="text-right">Action</div>
                      </div>

                      <div className="max-h-[42vh] overflow-y-auto">
                        {positiveAvailableFeedBatchRows.map(row => (
                          <div
                            key={row.id}
                            className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.5fr)_110px_100px_100px_90px] gap-3 border-t px-3 py-2 text-sm"
                          >
                            <button
                              type="button"
                              className="min-w-0 text-left"
                              onClick={() => setReviewFeedBatch(row)}
                            >
                              <div className="truncate font-semibold text-foreground">{row.batchNumber}</div>
                              <div className="truncate text-xs text-muted-foreground">{row.warehouseCode}</div>
                            </button>

                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {row.itemName || feedItemNameByCode.get(row.itemCode.toUpperCase()) || row.itemCode}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">{row.itemCode}</div>
                            </div>

                            <div className="text-right font-semibold tabular-nums text-foreground">{formatQuantity(row.availableOnHandQty)}</div>
                            <div className="text-muted-foreground">{formatDateValue(row.manufacturingDate)}</div>
                            <div className="text-muted-foreground">{formatDateValue(row.expiryDate)}</div>
                            <div className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setReviewFeedBatch(row)}
                              >
                                View
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : feedBatchDialogMode === "cell" && feedBatchSelectionRowIndex != null ? (
              loadingFeedBatches ? (
                <div className="flex items-center justify-center gap-2 rounded-md border bg-muted/40 px-3 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading feed batches...
                </div>
              ) : feedBatchError ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {feedBatchError}
                </div>
              ) : activeFeedRequiredQty <= 0 ? (
                <div className="rounded-md border bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
                  Enter Daily kg/Flock before allocating feed batches.
                </div>
              ) : (
                <div className={`grid gap-4 ${activeFeedBatchRowLocked ? "" : "lg:grid-cols-2"}`}>
                  {!activeFeedBatchRowLocked ? (
                    <div className="min-w-0 rounded-md border ">
                      <div className="border-b bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                        Available Batches
                      </div>
                      <div className="grid grid-cols-[36px_minmax(100px,1fr)_90px_90px_84px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                        <div>#</div>
                        <div>Batch</div>
                        <div className="text-right">Available</div>
                        <div>Expiration</div>
                        <div className="text-right">Allocate</div>
                      </div>
                      <div className="max-h-[38vh] overflow-y-auto">
                        {activeAvailableFeedBatches.length === 0 ? (
                          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                            No available feed batches found.
                          </div>
                        ) : (
                          activeAvailableFeedBatches.map((batch, index) => {
                            const canAllocate =
                              activeFeedRemainingQty > 0 &&
                              batch.availableToSelect > 0;

                            return (
                              <div
                                key={batch.id}
                                className="bg-white grid grid-cols-[36px_minmax(100px,1fr)_90px_90px_84px] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
                              >
                                <div className="text-muted-foreground">{index + 1}</div>
                                <button
                                  type="button"
                                  className="min-w-0 text-left"
                                  onClick={() => setReviewFeedBatch(batch)}
                                >
                                  <div className="truncate font-semibold text-foreground">{batch.batchNumber}</div>
                                  <div className="truncate text-xs text-muted-foreground">{batch.itemName || batch.itemCode}</div>
                                </button>
                                <div className="text-right font-semibold tabular-nums text-foreground">
                                  {formatQuantity(batch.availableToSelect)}
                                </div>
                                <div className="text-muted-foreground">
                                  {formatDateValue(batch.expiryDate)}
                                </div>
                                <div className="text-right">
                                  <Button
                                    type="button"
                                    size="xs"
                                    disabled={!canAllocate}
                                    onClick={() => addFeedBatchAllocation(batch)}
                                  >
                                    &gt;
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="min-w-0 rounded-md border">
                    <div className="border-b bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                      Selected Batches
                    </div>
                    <div className="grid grid-cols-[36px_minmax(100px,1fr)_110px_80px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                      <div>#</div>
                      <div>Batch</div>
                      <div className="text-right">Selected Qty</div>
                      <div className="text-right">Remove</div>
                    </div>
                    <div className="max-h-[38vh] overflow-y-auto bg-white">
                      {activeFeedBatchAllocations.length === 0 ? (
                        <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                          No batches selected yet.
                        </div>
                      ) : (
                        activeFeedBatchAllocations.map((allocation, index) => (
                          <div
                            key={allocation.batchId}
                            className="grid grid-cols-[36px_minmax(100px,1fr)_110px_80px] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
                          >
                            <div className="text-muted-foreground">{index + 1}</div>
                            <button
                              type="button"
                              className="min-w-0 text-left"
                              onClick={() => {
                                const batch = availableFeedBatchRows.find(row => row.id === allocation.batchId);
                                if (batch) setReviewFeedBatch(batch);
                              }}
                            >
                              <div className="truncate font-semibold text-foreground">{allocation.batchNumber}</div>
                              <div className="truncate text-xs text-muted-foreground">{allocation.itemName || allocation.itemCode}</div>
                            </button>
                            <Input
                              value={formatTotal(allocation.selectedQty)}
                              disabled={activeFeedBatchRowLocked}
                              onChange={(event) => updateFeedBatchAllocationQty(allocation.batchId, event.target.value)}
                              className="h-8 text-right tabular-nums"
                            />
                            <div className="text-right">
                              <Button
                                type="button"
                                size="icon-xs"
                                variant="outline"
                                disabled={activeFeedBatchRowLocked}
                                onClick={() => removeFeedBatchAllocation(allocation.batchId)}
                                aria-label={`Remove ${allocation.batchNumber}`}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )
            ) : loadingFeedBatches ? (
              <div className="flex items-center justify-center gap-2 rounded-md border bg-muted/40 px-3 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading feed batches...
              </div>
            ) : feedBatchError ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {feedBatchError}
              </div>
            ) : positiveAvailableFeedBatchRows.length === 0 ? (
              <div className="rounded-md border bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
                No feed batches with on-hand balance in this warehouse.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.5fr)_110px_100px_100px_90px] gap-3 bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                    <div>Batch</div>
                    <div>Consists of</div>
                    <div className="text-right">On hand</div>
                    <div>MFG</div>
                    <div>EXP</div>
                    <div className="text-right">Action</div>
                  </div>

                  <div className="max-h-[48vh] overflow-y-auto">
                    {positiveAvailableFeedBatchRows.map(row => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.5fr)_110px_100px_100px_90px] gap-3 border-t px-3 py-2 text-sm"
                      >
                        <button
                          type="button"
                          className="min-w-0 text-left"
                          onClick={() => {
                            if (feedBatchSelectionRowIndex == null) {
                              setReviewFeedBatch(row);
                              return;
                            }

                            addFeedBatchAllocation(row);
                          }}
                        >
                          <div className="truncate font-semibold text-foreground">
                            {row.batchNumber}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {row.warehouseCode}
                          </div>
                        </button>

                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {row.itemName || feedItemNameByCode.get(row.itemCode.toUpperCase()) || row.itemCode}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {row.itemCode}
                          </div>
                        </div>

                        <div className="text-right font-semibold tabular-nums text-foreground">
                          {formatQuantity(row.availableOnHandQty)}
                        </div>
                        <div className="text-muted-foreground">
                          {formatDateValue(row.manufacturingDate)}
                        </div>
                        <div className="text-muted-foreground">
                          {formatDateValue(row.expiryDate)}
                        </div>
                        <div className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (feedBatchSelectionRowIndex == null) {
                                setReviewFeedBatch(row);
                                return;
                              }

                              addFeedBatchAllocation(row);
                            }}
                          >
                            {feedBatchSelectionRowIndex == null ? "View" : "Add"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {feedBatchDialogMode === "cell" && feedBatchSelectionRowIndex != null ? (
              <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="sm:w-auto"
                  disabled={activeFeedBatchRowLocked || activeFeedBatchAllocations.length === 0}
                  onClick={() => {
                    if (feedBatchSelectionRowIndex != null) commitFeedBatchAllocations(feedBatchSelectionRowIndex, []);
                  }}
                >
                  Clear Selection
                </Button>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={activeFeedBatchRowLocked || loadingFeedBatches || activeAvailableFeedBatches.length === 0 || activeFeedRequiredQty <= 0}
                    onClick={autoSelectFeedBatch}
                  >
                    <PackageCheck className="size-4" />
                    Auto Select (Alt + A)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={finishFeedBatchAllocation}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <div className="relative flex-1 overflow-auto" onScroll={handleTableScroll}>
          <table
            className="fc-grid-table table-fixed border-separate border-spacing-0 caption-bottom text-sm"
            style={{ minWidth: tableMinWidth }}
          >
            <colgroup>
              <col style={{ width: ageColumnWidth }} />

              {columnWidths.map((width, index) => (
                <col key={index} style={{ width }} />
              ))}
            </colgroup>

            <TableHeader className="[&_tr]:border-0">
              <TableRow className="border-0" style={{ height: headerRowHeight }}>
                <TableHead
                  rowSpan={3}
                  className="fc-grid-header fc-grid-age-header sticky left-0 top-0 z-40 text-center"
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
                // Computed once per row instead of once per cell (27x fewer calls).
                const hasFeedQuantity = rowHasFeedQuantity(rowIndex);
                const savedLine = savedLineByRowIndex[rowIndex];
                const feedIntakeLocked = Boolean(savedLine);
                const bodyBorderClasses = striped ? bodyBorderClassesStriped : bodyBorderClassesPlain;

                return (
                  <TableRow
                    key={row.age}
                    className={`fc-grid-row border-0 ${activeCell?.rowIndex === rowIndex ? "fc-grid-row-active" : ""}`}
                  >
                    <TableCell
                      className="fc-grid-age sticky left-0 z-20 p-0 text-center font-semibold"
                      style={{ width: ageColumnWidth, minWidth: ageColumnWidth }}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex h-8 w-full items-center justify-center text-center font-semibold focus:outline-none focus:ring-2 focus:ring-ring/30"
                            aria-label={`Row ${row.age} actions`}
                          >
                            {row.age}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                          <DropdownMenuItem onClick={() => void copyRow(rowIndex)}>
                            <Copy className="size-4" />
                            Copy Row
                          </DropdownMenuItem>
                          {feedIntakeLocked ? (
                            <DropdownMenuItem onClick={() => void reverseFeedIntake(rowIndex)}>
                              <RotateCcw className="size-4" />
                              Reverse Feed Intake
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => clearRow(rowIndex)}
                            >
                              <Eraser className="size-4" />
                              Clear Row
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>

                    {columnIndexes.map((colIndex) => {
                      const feedIntakeCellLocked = feedIntakeLocked && feedIntakeColumnIndexes.has(colIndex);
                      const disabled = feedIntakeCellLocked || columnDisabledFlags[colIndex];
                      const inputDisabled = colIndex === feedBatchColumnIndex
                        ? columnDisabledFlags[colIndex]
                        : disabled;
                      const feedBatchCellCanOpen =
                        hasFeedQuantity || rowHasFeedBatchData(rowIndex);

                      const active =
                        activeCell?.rowIndex === rowIndex &&
                        activeCell.colIndex === colIndex;

                      return (
                        <TableCell
                          key={colIndex}
                          className={`fc-grid-cell ${disabled ? "fc-grid-cell-readonly" : "fc-grid-cell-editable"} ${bodyEmphasisClasses[colIndex]} ${active ? "fc-grid-cell-active" : ""} p-0 ${bodyBorderClasses[colIndex]}`}
                        >
                          {colIndex === feedBatchColumnIndex ? (
                            <div className="flex min-h-8 w-full items-stretch" style={{ minWidth: feedBatchColumnWidth }}>
                              <button
                                type="button"
                                data-fc-cell="true"
                                ref={(element) => {
                                  inputRefs.current[rowIndex] ??= [];
                                  inputRefs.current[rowIndex][colIndex] = element;
                                }}
                                onFocus={() => setActiveCell({ rowIndex, colIndex })}
                                onClick={() => openFeedBatchReview(rowIndex)}
                                onKeyDown={(event) => handleCellKeyDown(event, rowIndex, colIndex)}
                                disabled={!feedBatchCellCanOpen}
                                className="flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-normal break-words px-1.5 py-1 text-center text-xs leading-tight text-[#4f4a43] shadow-none transition-none focus:font-semibold focus:text-emerald-950 focus:outline-none disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[#7c766c] dark:text-foreground dark:focus:text-emerald-100 dark:disabled:bg-transparent dark:disabled:text-muted-foreground"
                                title={
                                  feedIntakeCellLocked
                                    ? "Saved feed intake. Open to view batches or reverse feed intake before editing."
                                    : !hasFeedQuantity
                                      ? "Enter Daily kg/Flock before selecting a feed batch"
                                      : gridValues[rowIndex]?.[feedBatchColumnIndex] || "Select feed batch"
                                }
                              >
                                <span className="min-w-0 break-words">
                                  {gridValues[rowIndex]?.[feedBatchColumnIndex]?.trim() || "Select"}
                                </span>
                                <MousePointerClick className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                              </button>

                              {gridValues[rowIndex]?.[feedBatchColumnIndex]?.trim() ? (
                                <button
                                  type="button"
                                  disabled={feedIntakeCellLocked}
                                  onClick={() => clearFeedBatch(rowIndex)}
                                  className="flex w-7 shrink-0 items-center justify-center border-l border-[#ded8ce] text-muted-foreground hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-ring/20 dark:border-border"
                                  title="Clear feed batch"
                                  aria-label="Clear feed batch"
                                >
                                  <X className="size-3.5" aria-hidden="true" />
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <CellInput
                              id={`row-${rowIndex}-col-${colIndex}`}
                              disabled={inputDisabled}
                              value={computedGridValues[rowIndex][colIndex]}
                              inputRef={(element) => {
                                inputRefs.current[rowIndex] ??= [];
                                inputRefs.current[rowIndex][colIndex] = element;
                              }}
                              onCommit={(value) =>
                                handleCellChange(
                                  rowIndex,
                                  colIndex,
                                  value
                                )
                              }
                              onBlur={() => undefined}
                              onFocus={() => setActiveCell({ rowIndex, colIndex })}
                              onKeyDown={(event) =>
                                handleCellKeyDown(event, rowIndex, colIndex)
                              }
                            />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>

            <TableFooter>
              <TableRow className="border-0">
                <TableCell
                  className="fc-grid-footer-cell fc-grid-footer-age sticky bottom-0 left-0 z-40 text-center font-semibold shadow-md"
                  style={{ width: ageColumnWidth, minWidth: ageColumnWidth }}
                >
                  Total
                </TableCell>

                {columnTotals.map((total, colIndex) => (
                  <TableCell
                    key={colIndex}
                    className={`fc-grid-footer-cell sticky bottom-0 text-center font-semibold ${footerBorderClasses[colIndex]}`}
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
