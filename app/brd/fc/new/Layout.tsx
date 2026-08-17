"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import type {
  ClipboardEvent,
  KeyboardEvent,
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
import { Skeleton } from "@/components/ui/skeleton";
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
import { ArrowRightCircle, ChevronDown, ChevronUp, Copy, Eraser, Loader2, MousePointerClick, PackageCheck, RotateCcw, Save, WandSparkles, X } from "lucide-react";
import {
  getBatchTransactionTrail,
  type BatchTransactionTrail,
} from "@/app/inv/btch/api";
import {
  getFlockCardSheet,
  getFeedBatchOnHandByWarehouse,
  getFarmBuildings,
  reverseFlockCardFeedIntake,
  reverseFlockCardMortalityThinning,
  saveFlockCard,
  type FeedBatchOnHand,
  type FarmBuildingOption,
  type FlockCardLinePayload,
} from "./api";
import { getBuildingPlacementInventory } from "../api";
import {
  computeColumnTotals,
  computeGridValues,
  formatTotal,
  getNumericValue,
} from "./gridMath";
import Help from "./Help";
import FlockCardExportMenu from "./FlockCardExportMenu";
import { calculateFlockAgeFromStartDate } from "../age";
import { getFlockCardSettings } from "../settings/api";
import { CellInput, HeaderCells } from "./FlockCardGridCells";
import { populateSensibleSampleData } from "./developmentAutoPopulate";
import {
  ageColumnWidth,
  bodyBorderClassesPlain,
  bodyBorderClassesStriped,
  bodyEmphasisClasses,
  bottomHeaderCells,
  columnDisabledFlags,
  cumulativeTotalColumnIndex,
  dataColumnCount,
  dataColumnWidth,
  editableColumnIndexes,
  editableColumns,
  feedBatchColumnIndex,
  feedBatchMaxColumnWidth,
  feedBatchMinColumnWidth,
  feedDailyKgColumnIndex,
  feedDailyPerBirdColumnIndex,
  feedGuidelineColumnIndex,
  waterGuidelineColumnIndex,
  feedIntakeColumnIndexes,
  footerBorderClasses,
  getZeroInputRow,
  headerRowHeight,
  initialGridValues,
  isStripedRow,
  middleHeaderCells,
  mortalityBatchColumnIndex,
  mortalityBatchMaxColumnWidth,
  mortalityBatchMinColumnWidth,
  rows,
  standardAdgColumnIndex,
  topHeaderCells,
  visibleColumnIndexes,
} from "./flockCardGridConfig";
import type {
  FeedBatchAllocation,
  FeedBatchDialogMode,
  FeedFarm,
  FeedWarehouseAssociation,
  FlockCardNavigationContext,
  FlockCardSettingsState,
  MortalityBatchAllocation,
} from "./flockCardTypes";

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

function getDefaultDisposalWarehouseCode(farm?: FeedFarm | null) {
  const associations = farm?.associated_warehouses;
  if (!Array.isArray(associations)) return "";

  const defaultWarehouse = associations.find(warehouse =>
    typeof warehouse === "object" && Boolean(warehouse?.is_default_disposal)
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

function getMortalityThinningTotal(row: string[]) {
  return getNumericValue(row[0] ?? "") +
    getNumericValue(row[1] ?? "") +
    getNumericValue(row[3] ?? "") +
    getNumericValue(row[4] ?? "");
}

function FlockCardPageSkeleton() {
  const skeletonColumns = [
    "w-16",
    "w-24",
    "w-24",
    "w-28",
    "w-24",
    "w-32",
    "w-24",
    "w-28",
    "w-24",
    "w-32",
  ];

  return (
    <div
      className="h-screen w-full bg-slate-100 p-4 dark:bg-background"
      role="status"
      aria-label="Loading flock card"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
        <div className="flex min-h-14 items-center gap-3 border-b px-4 pb-4 pt-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-3 w-full max-w-2xl" />
          </div>
          <Skeleton className="hidden h-3 w-24 md:block" />
          <Skeleton className="size-9 shrink-0" />
          <Skeleton className="h-9 w-24 shrink-0" />
          <Skeleton className="h-9 w-20 shrink-0" />
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div className="min-w-[1180px]">
            {[0, 1, 2].map((headerRow) => (
              <div
                key={headerRow}
                className="flex h-10 gap-px border-b bg-border px-px pt-px"
              >
                {skeletonColumns.map((width, columnIndex) => (
                  <div
                    key={columnIndex}
                    className={`${width} flex shrink-0 items-center justify-center bg-slate-100 px-2 dark:bg-muted/50`}
                  >
                    <Skeleton className={`h-3 ${columnIndex % 3 === 0 ? "w-10" : "w-16"}`} />
                  </div>
                ))}
              </div>
            ))}

            {Array.from({ length: 12 }, (_, rowIndex) => (
              <div key={rowIndex} className="flex h-10 gap-px border-b bg-border px-px">
                {skeletonColumns.map((width, columnIndex) => (
                  <div
                    key={columnIndex}
                    className={`${width} flex shrink-0 items-center justify-center bg-white px-2 dark:bg-card`}
                  >
                    <Skeleton
                      className={`h-4 ${columnIndex === 0 ? "w-8" : rowIndex % 3 === 0 ? "w-16" : "w-12"}`}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading flock card data...</span>
    </div>
  );
}

export default function StickyTablePage({ devMode }: { devMode: boolean }) {
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
  const [savedMortalityLineByRowIndex, setSavedMortalityLineByRowIndex] = useState<Record<number, { id: number; age: number }>>({});
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
  const [loadingAssignedFarms, setLoadingAssignedFarms] = useState(false);
  const [loadingFlockCardSheet, setLoadingFlockCardSheet] = useState(false);
  const [farmBuildings, setFarmBuildings] = useState<FarmBuildingOption[]>([]);
  const [loadingFarmBuildings, setLoadingFarmBuildings] = useState(false);
  const [farmBuildingError, setFarmBuildingError] = useState("");
  const [feedBatchRows, setFeedBatchRows] = useState<FeedBatchOnHand[]>([]);
  const [loadingFeedBatches, setLoadingFeedBatches] = useState(false);
  const [feedBatchError, setFeedBatchError] = useState("");
  const [feedBatchRefreshKey, setFeedBatchRefreshKey] = useState(0);
  const [feedBatchDialogOpen, setFeedBatchDialogOpen] = useState(false);
  const [feedBatchDialogMode, setFeedBatchDialogMode] = useState<FeedBatchDialogMode>("onHand");
  const [feedBatchSelectionRowIndex, setFeedBatchSelectionRowIndex] = useState<number | null>(null);
  const [feedBatchAllocationsByRow, setFeedBatchAllocationsByRow] = useState<Record<number, FeedBatchAllocation[]>>({});
  const [mortalityBatchRows, setMortalityBatchRows] = useState<FeedBatchOnHand[]>([]);
  const [loadingMortalityBatches, setLoadingMortalityBatches] = useState(false);
  const [mortalityBatchError, setMortalityBatchError] = useState("");
  const [mortalityBatchDialogOpen, setMortalityBatchDialogOpen] = useState(false);
  const [mortalityBatchSelectionRowIndex, setMortalityBatchSelectionRowIndex] = useState<number | null>(null);
  const [mortalityBatchAllocationsByRow, setMortalityBatchAllocationsByRow] = useState<Record<number, MortalityBatchAllocation[]>>({});
  const [hydratedSavedMortalityBatchRows, setHydratedSavedMortalityBatchRows] = useState<Record<number, true>>({});
  const [hydratedSavedFeedBatchRows, setHydratedSavedFeedBatchRows] = useState<Record<number, true>>({});
  const [reviewFeedBatch, setReviewFeedBatch] = useState<FeedBatchOnHand | null>(null);
  const [feedBatchTraceRows, setFeedBatchTraceRows] = useState<BatchTransactionTrail[]>([]);
  const [loadingFeedBatchTrace, setLoadingFeedBatchTrace] = useState(false);
  const [feedBatchTraceError, setFeedBatchTraceError] = useState("");
  const [headerOpen, setHeaderOpen] = useState(false);

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
  const requestedFlockStartDate = String(flockCardNavigationContext?.flockStartDate ?? searchParams.get("flockStartDate") ?? "").trim();
  const rawRequestedFlockAge = flockCardNavigationContext?.flockAge ?? searchParams.get("flockAge");
  const requestedFlockAge = Number(rawRequestedFlockAge);
  const linkedCardNo = requestedCardNo || flockCardCardNo;
  const displayFlockCode = requestedFlockCode || linkedCardNo || "-";
  const selectedBreed = String(flockCardNavigationContext?.breed ?? "").trim();
  const hasLockedFlockContext = Boolean(flockCardNavigationContext?.buildingKey);
  const [flockCardSettings, setFlockCardSettings] = useState<FlockCardSettingsState | null>(null);
  const allowAdvancePosting = Boolean(flockCardSettings?.allow_advance_posting);
  const autoFeedBatchSelection = Boolean(flockCardSettings?.auto_feed_batch_selection);
  const autoFeedBatchSelectionMode = flockCardSettings?.auto_feed_batch_selection_mode ?? "USER_SELECTED";
  const autoMortalityRateBatchSelection = Boolean(flockCardSettings?.auto_mortality_rate_batch_selection);

  useEffect(() => {
    const farmId = Number(selectedFarmId);
    if (!Number.isFinite(farmId) || farmId <= 0) {
      setFlockCardSettings(null);
      return;
    }

    let cancelled = false;
    getFlockCardSettings(farmId)
      .then((nextSettings) => {
        if (!cancelled) setFlockCardSettings(nextSettings);
      })
      .catch((error) => {
        console.error("FlockCardSettings error:", error);
        if (!cancelled) setFlockCardSettings(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFarmId]);
  const currentFlockAge = requestedFlockStartDate
    ? calculateFlockAgeFromStartDate(requestedFlockStartDate)
    : rawRequestedFlockAge != null && String(rawRequestedFlockAge).trim() !== "" && Number.isFinite(requestedFlockAge)
      ? Math.max(requestedFlockAge, 0)
      : null;

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

  const mortalityBatchAllocatedQtyByBatchId = useMemo(() => {
    const allocatedQtyByBatchId = new Map<string, number>();

    Object.entries(mortalityBatchAllocationsByRow).forEach(([rowIndex, allocations]) => {
      if (hydratedSavedMortalityBatchRows[Number(rowIndex)]) return;

      allocations.forEach(allocation => {
        allocatedQtyByBatchId.set(
          allocation.batchId,
          (allocatedQtyByBatchId.get(allocation.batchId) ?? 0) + Number(allocation.selectedQty || 0)
        );
      });
    });

    return allocatedQtyByBatchId;
  }, [hydratedSavedMortalityBatchRows, mortalityBatchAllocationsByRow]);

  const availableMortalityBatchRows = useMemo(
    () => mortalityBatchRows.map(row => {
      const allocatedQty = mortalityBatchAllocatedQtyByBatchId.get(row.id) ?? 0;
      const onHandQty = Number(row.onHandQty || 0);

      return {
        ...row,
        onHandQty,
        allocatedQty,
        availableOnHandQty: Math.max(onHandQty - allocatedQty, 0),
      };
    }),
    [mortalityBatchAllocatedQtyByBatchId, mortalityBatchRows]
  );

  const positiveAvailableMortalityBatchRows = useMemo(
    () => availableMortalityBatchRows.filter(row => row.availableOnHandQty > 0),
    [availableMortalityBatchRows]
  );

  const totalMortalityBatchOnHand = useMemo(
    () => positiveAvailableMortalityBatchRows.reduce((total, row) => total + row.availableOnHandQty, 0),
    [positiveAvailableMortalityBatchRows]
  );

  const totalAnimalsOut = useMemo(
    () => gridValues.reduce((total, row) =>
      total +
      getNumericValue(row[0] ?? "") +
      getNumericValue(row[1] ?? "") +
      getNumericValue(row[3] ?? "") +
      getNumericValue(row[4] ?? ""),
      0
    ),
    [gridValues]
  );
  const liveAnimals = Math.max(Number(numberOfAnimals || 0) - totalAnimalsOut, 0);

  const selectedFarmLabel = selectedFarm
    ? `${selectedFarm.code}${selectedFarm.name ? ` - ${selectedFarm.name}` : ""}`
    : "Select farm";
  const selectedBuildingLabel = selectedBuilding
    ? `${selectedBuilding.code}${selectedBuilding.name ? ` - ${selectedBuilding.name}` : ""}`
    : String(flockCardNavigationContext?.buildingKey ?? "Select building");
  const animalMetricLabel = `${formatQuantity(numberOfAnimals)} birds`;
  const liveAnimalMetricLabel = `${formatQuantity(liveAnimals)} birds`;
  const feedOnHandMetricLabel = loadingFeedBatches ? "Loading..." : `${formatQuantity(totalFeedOnHand)} kg`;
  const feedBatchMetricLabel = `${positiveAvailableFeedBatchRows.length} ${positiveAvailableFeedBatchRows.length === 1 ? "batch" : "batches"}`;
  const mortalityBatchMetricLabel = loadingMortalityBatches
    ? "Loading..."
    : `${positiveAvailableMortalityBatchRows.length} ${positiveAvailableMortalityBatchRows.length === 1 ? "batch" : "batches"}`;
  const isDatabaseLoading = loadingAssignedFarms || loadingFlockCardSheet;
  const saveStatusLabel = saving
    ? "Saving..."
    : flockCardNo
      ? `Saved ${flockCardNo}`
      : "Not saved yet";
  const feedBatchSelectionAge = feedBatchSelectionRowIndex == null
    ? null
    : rows[feedBatchSelectionRowIndex]?.age ?? null;
  const mortalityBatchSelectionAge = mortalityBatchSelectionRowIndex == null
    ? null
    : rows[mortalityBatchSelectionRowIndex]?.age ?? null;

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

  const mortalityBatchColumnWidth = useMemo(() => {
    const longestBatchLength = gridValues.reduce((longest, row) => {
      return Math.max(longest, row[mortalityBatchColumnIndex]?.trim().length ?? 0);
    }, 0);

    if (longestBatchLength === 0) return mortalityBatchMinColumnWidth;

    return Math.min(
      mortalityBatchMaxColumnWidth,
      Math.max(mortalityBatchMinColumnWidth, longestBatchLength * 9 + 40)
    );
  }, [gridValues]);

  const columnWidths = useMemo(
    () => visibleColumnIndexes.map((colIndex) =>
      colIndex === feedBatchColumnIndex
        ? feedBatchColumnWidth
        : colIndex === mortalityBatchColumnIndex
          ? mortalityBatchColumnWidth
          : dataColumnWidth
    ),
    [feedBatchColumnWidth, mortalityBatchColumnWidth]
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
    (isRowAgeLocked(feedBatchSelectionRowIndex) ||
      Boolean(savedLineByRowIndex[feedBatchSelectionRowIndex]));

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

  const activeMortalityBatchAllocations = useMemo(
    () => mortalityBatchSelectionRowIndex == null
      ? []
      : mortalityBatchAllocationsByRow[mortalityBatchSelectionRowIndex] ?? [],
    [mortalityBatchAllocationsByRow, mortalityBatchSelectionRowIndex]
  );

  const activeMortalityRequiredQty = mortalityBatchSelectionRowIndex == null
    ? 0
    : getMortalityThinningTotal(gridValues[mortalityBatchSelectionRowIndex] ?? []);
  const activeMortalityBatchRowLocked =
    mortalityBatchSelectionRowIndex != null &&
    (isRowAgeLocked(mortalityBatchSelectionRowIndex) ||
      Boolean(savedMortalityLineByRowIndex[mortalityBatchSelectionRowIndex]));

  const activeMortalityAllocatedQty = activeMortalityBatchAllocations.reduce(
    (total, allocation) => total + Number(allocation.selectedQty || 0),
    0
  );

  const activeMortalityRemainingQty = Math.max(activeMortalityRequiredQty - activeMortalityAllocatedQty, 0);

  useEffect(() => {
    setValue("loading_g", isDatabaseLoading);

    return () => {
      setValue("loading_g", false);
    };
  }, [isDatabaseLoading, setValue]);

  useEffect(() => {
    if (assignedFarmCodes.length > 0 || !sessionUser?.id) {
      setLoadingAssignedFarms(false);
      return;
    }

    let cancelled = false;
    setLoadingAssignedFarms(true);

    getUserFarms(Number(sessionUser.id))
      .then(farms => {
        if (cancelled) return;
        setFallbackAssignedFarms(Array.isArray(farms) ? farms as FeedFarm[] : []);
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) setFallbackAssignedFarms([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAssignedFarms(false);
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
    if ((!Number.isFinite(cardId) || cardId <= 0) && !requestedCardNo) {
      setLoadingFlockCardSheet(false);
      return;
    }

    let cancelled = false;
    setLoadingFlockCardSheet(true);
    setHydratedSavedFeedBatchRows({});
    setHydratedSavedMortalityBatchRows({});

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
        const nextSavedMortalityLineByRowIndex: Record<number, { id: number; age: number }> = {};
        const nextAllocationsByRow: Record<number, FeedBatchAllocation[]> = {};
        const nextMortalityAllocationsByRow: Record<number, MortalityBatchAllocation[]> = {};
        const nextHydratedSavedFeedBatchRows: Record<number, true> = {};
        const nextHydratedSavedMortalityBatchRows: Record<number, true> = {};

        for (const line of card.lines) {
          const rowIndex = rows.findIndex(row => row.age === line.age);
          if (rowIndex < 0) continue;

          nextGridValues[rowIndex] = line.values.slice(0, dataColumnCount);
          if (line.mortalityAllocations.length > 0) {
            nextMortalityAllocationsByRow[rowIndex] = line.mortalityAllocations;
            nextHydratedSavedMortalityBatchRows[rowIndex] = true;
            nextSavedMortalityLineByRowIndex[rowIndex] = { id: line.id, age: line.age };
            nextGridValues[rowIndex][mortalityBatchColumnIndex] = formatMortalityBatchAllocationCell(line.mortalityAllocations);
          }
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
        setSavedMortalityLineByRowIndex(nextSavedMortalityLineByRowIndex);
        setFeedBatchAllocationsByRow(nextAllocationsByRow);
        setMortalityBatchAllocationsByRow(nextMortalityAllocationsByRow);
        setHydratedSavedFeedBatchRows(nextHydratedSavedFeedBatchRows);
        setHydratedSavedMortalityBatchRows(nextHydratedSavedMortalityBatchRows);
      })
      .catch(error => {
        console.error(error);
        toast(`Unable to load flock card: ${error instanceof Error ? error.message : "Unknown error"}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingFlockCardSheet(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestedCardNo, requestedFlockCardId, currentFlockAge]);

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
  }, [feedBatchRefreshKey, feedItemCodes, feedItemNameByCode, selectedWarehouseCode]);

  useEffect(() => {
    const farmId = Number(selectedFarmId);
    if (!Number.isFinite(farmId) || farmId <= 0 || !selectedBuilding) {
      setMortalityBatchRows([]);
      setMortalityBatchError("");
      setLoadingMortalityBatches(false);
      return;
    }

    let cancelled = false;
    setLoadingMortalityBatches(true);
    setMortalityBatchError("");

    getBuildingPlacementInventory({
      farmId,
      buildingCode: selectedBuilding.code,
      buildingName: selectedBuilding.name,
      buildingKey: selectedBuilding.key,
      buildingWarehouseCode: selectedBuilding.warehouseCode || selectedBuilding.code,
    })
      .then(rows => {
        if (!cancelled) setMortalityBatchRows(rows);
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) {
          setMortalityBatchRows([]);
          setMortalityBatchError("Unable to load mortality/thinning batches.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMortalityBatches(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBuilding, selectedFarmId]);

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
        waterGuidelineColumnIndex,
        cumulativeTotalColumnIndex,
        breed: selectedBreed,
      }),
    [deferredGridValues, numberOfAnimals, selectedBreed]
  );

  const exportRows = useMemo(
    () => rows.map((row, rowIndex) => ({
      age: row.age,
      values: computedGridValues[rowIndex] ?? [],
    })),
    [computedGridValues]
  );

  const columnTotals = useMemo(
    () => computeColumnTotals({
      computedGridValues,
      dataColumnCount,
      excludedColumnIndexes: [
        cumulativeTotalColumnIndex,
        feedGuidelineColumnIndex,
        waterGuidelineColumnIndex,
        standardAdgColumnIndex,
        15,
      ],
    }),
    [computedGridValues]
  );

  // NOTE: previously this also maintained a `latestComputedGridValues` memo
  // (identical computation, just against non-deferred `gridValues`) purely so
  // save-time could read the freshest formula results. That doubled the cost
  // of computeGridValues on every single keystroke, even though the result
  // was only ever consumed once, at save time. It's now computed on demand
  // inside buildFlockCardLines instead.

  function isFeedIntakeLocked(rowIndex: number) {
    return Boolean(savedLineByRowIndex[rowIndex]);
  }

  function isMortalityThinningLocked(rowIndex: number) {
    return Boolean(savedMortalityLineByRowIndex[rowIndex]);
  }

  function isRowAgeLocked(rowIndex: number) {
    if (allowAdvancePosting) return false;
    if (currentFlockAge == null) return false;

    const rowAge = rows[rowIndex]?.age ?? rowIndex;
    return rowAge > currentFlockAge;
  }

  function handleCellChange(
    rowIndex: number,
    colIndex: number,
    value: string
  ) {
    if (isRowAgeLocked(rowIndex)) return;
    if (isFeedIntakeLocked(rowIndex) && feedIntakeColumnIndexes.has(colIndex)) return;
    if (isMortalityThinningLocked(rowIndex) && [0, 1, 3, 4, mortalityBatchColumnIndex].includes(colIndex)) return;

    const currentFeedQuantityValue = gridValues[rowIndex]?.[feedDailyKgColumnIndex] ?? "";
    const hasExistingFeedBatch =
      String(gridValues[rowIndex]?.[feedBatchColumnIndex] ?? "").trim() !== "" ||
      (feedBatchAllocationsByRow[rowIndex]?.length ?? 0) > 0;
    const currentFeedQuantity = getNumericValue(currentFeedQuantityValue);
    const nextFeedQuantity = getNumericValue(value);
    const currentMortalityTotal = getMortalityThinningTotal(gridValues[rowIndex] ?? []);
    const nextMortalityRow = (gridValues[rowIndex] ?? []).map((cellValue, currentColIndex) =>
      currentColIndex === colIndex ? value : cellValue
    );
    const nextMortalityTotal = getMortalityThinningTotal(nextMortalityRow);
    const feedQuantityChanged =
      colIndex === feedDailyKgColumnIndex && currentFeedQuantityValue !== value;
    const mortalityQuantityChanged =
      [0, 1, 3, 4].includes(colIndex) && currentMortalityTotal !== nextMortalityTotal;
    const shouldClearFeedBatch =
      colIndex === feedDailyKgColumnIndex &&
      (nextFeedQuantity <= 0 || (feedQuantityChanged && hasExistingFeedBatch && currentFeedQuantity > 0));
    const hasExistingMortalityBatch = rowHasMortalityBatchData(rowIndex);
    const shouldClearMortalityBatch =
      mortalityQuantityChanged &&
      (nextMortalityTotal <= 0 || (hasExistingMortalityBatch && currentMortalityTotal > 0));
    const shouldAutoSplitMortalityBatch =
      autoMortalityRateBatchSelection &&
      mortalityQuantityChanged &&
      nextMortalityTotal > 0;
    const autoMortalityBatchAllocations = shouldAutoSplitMortalityBatch
      ? getAutoMortalitySplitAllocations(rowIndex, nextMortalityTotal)
      : null;

    if (autoMortalityBatchAllocations?.error) {
      toast(autoMortalityBatchAllocations.error);
      return;
    }

    const nextMortalityBatchText = autoMortalityBatchAllocations
      ? formatMortalityBatchAllocationCell(autoMortalityBatchAllocations.allocations)
      : "";

    // Single state update (and single array clone) covering both the edited
    // cell and, when needed, clearing the feed-batch cell — instead of two
    // separate setGridValues calls/renders.
    startGridTransition(() => {
      setGridValues((currentValues) => {
        const currentRow = currentValues[rowIndex];
        if (!currentRow) return currentValues;

        const feedBatchNextValue = shouldClearFeedBatch ? "" : currentRow[feedBatchColumnIndex];
        const mortalityBatchNextValue = shouldAutoSplitMortalityBatch
          ? nextMortalityBatchText
          : shouldClearMortalityBatch
            ? ""
            : currentRow[mortalityBatchColumnIndex];
        const unchanged =
          currentRow[colIndex] === value &&
          currentRow[feedBatchColumnIndex] === feedBatchNextValue &&
          currentRow[mortalityBatchColumnIndex] === mortalityBatchNextValue;

        if (unchanged) return currentValues;

        return currentValues.map((row, currentRowIndex) => {
          if (currentRowIndex !== rowIndex) return row;

          return row.map((cellValue, currentColIndex) => {
            if (currentColIndex === colIndex) return value;
            if (shouldClearFeedBatch && currentColIndex === feedBatchColumnIndex) return "";
            if (shouldAutoSplitMortalityBatch && currentColIndex === mortalityBatchColumnIndex) return nextMortalityBatchText;
            if (shouldClearMortalityBatch && currentColIndex === mortalityBatchColumnIndex) return "";
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

    if (autoMortalityBatchAllocations) {
      setMortalityBatchAllocationsByRow(current => ({
        ...current,
        [rowIndex]: autoMortalityBatchAllocations.allocations,
      }));
    } else if (shouldClearMortalityBatch) {
      setMortalityBatchAllocationsByRow(current => ({
        ...current,
        [rowIndex]: [],
      }));
    } else if (
      colIndex === feedDailyKgColumnIndex &&
      feedQuantityChanged &&
      nextFeedQuantity > 0
    ) {
      applyAutoFeedBatchSelection(rowIndex, nextFeedQuantity);
    }
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

  function rowHasMortalityBatchData(rowIndex: number) {
    return String(gridValues[rowIndex]?.[mortalityBatchColumnIndex] ?? "").trim() !== "" ||
      (mortalityBatchAllocationsByRow[rowIndex] ?? []).length > 0;
  }

  function rowHasAnyValue(rowIndex: number) {
    return (gridValues[rowIndex] ?? []).some(value => String(value ?? "").trim() !== "") ||
      (feedBatchAllocationsByRow[rowIndex] ?? []).length > 0 ||
      (mortalityBatchAllocationsByRow[rowIndex] ?? []).length > 0;
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
    if (isRowAgeLocked(rowIndex)) return;
    if (savedLineByRowIndex[rowIndex]) return;
    if (!rowHasAnyValue(rowIndex)) return;

    startGridTransition(() => {
      setGridValues(currentValues =>
        currentValues.map((row, currentRowIndex) =>
          currentRowIndex === rowIndex
            ? getZeroInputRow()
            : row
        )
      );
    });

    setFeedBatchAllocationsByRow(current => {
      const next = { ...current };
      delete next[rowIndex];
      return next;
    });
    setMortalityBatchAllocationsByRow(current => {
      const next = { ...current };
      delete next[rowIndex];
      return next;
    });
  }

  function handlePopulateSampleData() {
    if (currentFlockAge == null) {
      toast("The current flock age is unavailable.");
      return;
    }

    setGridValues(currentValues => populateSensibleSampleData({
      gridValues: currentValues,
      currentFlockAge,
      numberOfAnimals,
      lockedMortalityRowIndexes: Object.keys(savedMortalityLineByRowIndex).map(Number),
      devMode,
    }));
    toast(`Sample data populated through age ${Math.min(currentFlockAge, rows.length - 1)}.`);
  }

  function formatFeedBatchAllocationCell(allocations: FeedBatchAllocation[]) {
    return allocations
      .filter(allocation => allocation.selectedQty > 0)
      .map(allocation => `${allocation.batchNumber} (${formatTotal(allocation.selectedQty)})`)
      .join(", ");
  }

  function formatFeedBatchAllocationDisplay(rowIndex: number) {
    const allocations = (feedBatchAllocationsByRow[rowIndex] ?? [])
      .filter(allocation => allocation.selectedQty > 0);

    if (allocations.length === 0) {
      return gridValues[rowIndex]?.[feedBatchColumnIndex]?.trim() || "Select";
    }

    const [firstAllocation, ...remainingAllocations] = allocations;
    const firstBatch = firstAllocation.batchNumber;

    if (remainingAllocations.length === 0) return firstBatch;

    return `${firstBatch} +${remainingAllocations.length} more`;
  }

  function formatMortalityBatchAllocationCell(allocations: MortalityBatchAllocation[]) {
    return allocations
      .filter(allocation => allocation.selectedQty > 0)
      .map(allocation => `${allocation.batchNumber}(${formatTotal(allocation.selectedQty)})`)
      .join(",");
  }

  function toMortalityBatchAllocation(
    batch: FeedBatchOnHand,
    selectedQty: number,
    source: "MANUAL" | "FIFO" = "MANUAL",
  ): MortalityBatchAllocation {
    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      itemCode: batch.itemCode,
      itemName: batch.itemName || batch.itemCode,
      warehouseCode: batch.warehouseCode,
      availableQty: Number(batch.onHandQty || 0),
      selectedQty,
      source,
    };
  }

  function commitMortalityBatchAllocations(rowIndex: number, allocations: MortalityBatchAllocation[]) {
    if (isRowAgeLocked(rowIndex)) return;
    if (isMortalityThinningLocked(rowIndex)) return;

    const normalizedAllocations = allocations.filter(allocation => allocation.selectedQty > 0);
    const batchText = formatMortalityBatchAllocationCell(normalizedAllocations);

    setMortalityBatchAllocationsByRow(current => ({
      ...current,
      [rowIndex]: normalizedAllocations,
    }));
    startGridTransition(() => {
      setGridValues(currentValues =>
        currentValues.map((row, currentRowIndex) =>
          currentRowIndex === rowIndex
            ? row.map((cellValue, currentColIndex) =>
              currentColIndex === mortalityBatchColumnIndex ? batchText : cellValue
            )
            : row
        )
      );
    });
  }

  function getMortalityBatchAllocatedQty(
    batchId: string,
    excludedRowIndex?: number,
    allocationsByRow: Record<number, MortalityBatchAllocation[]> = mortalityBatchAllocationsByRow,
  ) {
    return Object.entries(allocationsByRow).reduce((total, [rowIndex, allocations]) => {
      const numericRowIndex = Number(rowIndex);
      if (excludedRowIndex != null && numericRowIndex === excludedRowIndex) return total;
      if (hydratedSavedMortalityBatchRows[numericRowIndex]) return total;

      return total + allocations
        .filter(allocation => allocation.batchId === batchId)
        .reduce((allocationTotal, allocation) => allocationTotal + Number(allocation.selectedQty || 0), 0);
    }, 0);
  }

  function getAutoMortalitySplitAllocations(
    rowIndex: number,
    requiredQty: number,
    allocationsByRow: Record<number, MortalityBatchAllocation[]> = mortalityBatchAllocationsByRow,
  ): {
    allocations: MortalityBatchAllocation[];
    error?: string;
  } {
    if (requiredQty <= 0) return { allocations: [] };
    if (!Number.isInteger(requiredQty)) {
      return {
        allocations: [],
        error: "Auto mortality split only supports whole-bird totals.",
      };
    }

    const availableBatches = mortalityBatchRows
      .map(batch => {
        const allocatedOutsideRow = getMortalityBatchAllocatedQty(batch.id, rowIndex, allocationsByRow);
        const availableQty = Math.max(Number(batch.onHandQty || 0) - allocatedOutsideRow, 0);

        return { batch, availableQty };
      })
      .filter(row => row.availableQty > 0);

    if (availableBatches.length === 0) {
      return {
        allocations: [],
        error: "Auto mortality split needs an available origin batch.",
      };
    }

    const totalAvailableQty = availableBatches.reduce((total, row) => total + row.availableQty, 0);
    if (requiredQty > totalAvailableQty) {
      return {
        allocations: [],
        error: `Auto mortality split needs ${formatQuantity(requiredQty)} birds but only ${formatQuantity(totalAvailableQty)} are available.`,
      };
    }

    const batchCount = availableBatches.length;
    const baseQty = Math.floor(requiredQty / batchCount);
    let remainderQty = requiredQty - (baseQty * batchCount);
    const rowAge = rows[rowIndex]?.age ?? rowIndex;
    const remainderOrder = Array.from({ length: batchCount }, (_, index) => index);

    if (rowAge % 2 === 0) {
      remainderOrder.reverse();
    }

    const extraQtyByIndex = new Map<number, number>();
    for (const batchIndex of remainderOrder) {
      if (remainderQty <= 0) break;

      extraQtyByIndex.set(batchIndex, 1);
      remainderQty -= 1;
    }

    const allocations = availableBatches
      .map(({ batch, availableQty }, index) => {
        const selectedQty = baseQty + (extraQtyByIndex.get(index) ?? 0);

        return {
          allocation: toMortalityBatchAllocation(batch, selectedQty, "MANUAL"),
          availableQty,
        };
      })
      .filter(row => row.allocation.selectedQty > 0);

    const overAllocatedBatch = allocations.find(row => row.allocation.selectedQty > row.availableQty);
    if (overAllocatedBatch) {
      return {
        allocations: [],
        error: `Auto mortality split needs ${formatQuantity(overAllocatedBatch.allocation.selectedQty)} from batch ${overAllocatedBatch.allocation.batchNumber}, but only ${formatQuantity(overAllocatedBatch.availableQty)} is available.`,
      };
    }

    return {
      allocations: allocations.map(row => row.allocation),
    };
  }

  function openMortalityBatchSelection(rowIndex: number) {
    if (isRowAgeLocked(rowIndex)) return;
    if (isMortalityThinningLocked(rowIndex) && !rowHasMortalityBatchData(rowIndex)) return;
    if (getMortalityThinningTotal(gridValues[rowIndex] ?? []) <= 0 && !rowHasMortalityBatchData(rowIndex)) return;

    setMortalityBatchSelectionRowIndex(rowIndex);
    setMortalityBatchDialogOpen(true);
  }

  function addMortalityBatchAllocation(batch: FeedBatchOnHand) {
    if (mortalityBatchSelectionRowIndex == null) return;
    if (isRowAgeLocked(mortalityBatchSelectionRowIndex)) return;
    if (isMortalityThinningLocked(mortalityBatchSelectionRowIndex)) return;

    const existingAllocations = mortalityBatchAllocationsByRow[mortalityBatchSelectionRowIndex] ?? [];
    const allocatedOutsideActiveRow = getMortalityBatchAllocatedQty(batch.id, mortalityBatchSelectionRowIndex);
    const selectedForBatch = existingAllocations
      .filter(allocation => allocation.batchId === batch.id)
      .reduce((total, allocation) => total + Number(allocation.selectedQty || 0), 0);
    const availableToSelect = Math.max(Number(batch.onHandQty || 0) - allocatedOutsideActiveRow - selectedForBatch, 0);
    const qtyToSelect = activeMortalityRemainingQty > 0
      ? Math.min(activeMortalityRemainingQty, availableToSelect)
      : 0;

    if (qtyToSelect <= 0) return;

    const nextAllocations = existingAllocations.some(allocation => allocation.batchId === batch.id)
      ? existingAllocations.map(allocation =>
        allocation.batchId === batch.id
          ? { ...allocation, selectedQty: allocation.selectedQty + qtyToSelect }
          : allocation
      )
      : [...existingAllocations, toMortalityBatchAllocation(batch, qtyToSelect)];

    commitMortalityBatchAllocations(mortalityBatchSelectionRowIndex, nextAllocations);
  }

  function updateMortalityBatchAllocationQty(batchId: string, value: string) {
    if (mortalityBatchSelectionRowIndex == null) return;
    if (isRowAgeLocked(mortalityBatchSelectionRowIndex)) return;
    if (isMortalityThinningLocked(mortalityBatchSelectionRowIndex)) return;

    const requestedQty = Math.max(getNumericValue(value), 0);
    const currentAllocations = mortalityBatchAllocationsByRow[mortalityBatchSelectionRowIndex] ?? [];
    const otherAllocatedQty = currentAllocations
      .filter(allocation => allocation.batchId !== batchId)
      .reduce((total, allocation) => total + Number(allocation.selectedQty || 0), 0);
    const allocatedOutsideActiveRow = getMortalityBatchAllocatedQty(batchId, mortalityBatchSelectionRowIndex);

    commitMortalityBatchAllocations(
      mortalityBatchSelectionRowIndex,
      currentAllocations.map(allocation => {
        if (allocation.batchId !== batchId) return allocation;

        const maxForRow = Math.max(activeMortalityRequiredQty - otherAllocatedQty, 0);
        const maxForBatch = Math.max(allocation.availableQty - allocatedOutsideActiveRow, 0);
        return {
          ...allocation,
          selectedQty: Math.min(requestedQty, maxForBatch, maxForRow),
        };
      })
    );
  }

  function removeMortalityBatchAllocation(batchId: string) {
    if (mortalityBatchSelectionRowIndex == null) return;
    if (isRowAgeLocked(mortalityBatchSelectionRowIndex)) return;
    if (isMortalityThinningLocked(mortalityBatchSelectionRowIndex)) return;

    commitMortalityBatchAllocations(
      mortalityBatchSelectionRowIndex,
      (mortalityBatchAllocationsByRow[mortalityBatchSelectionRowIndex] ?? []).filter(
        allocation => allocation.batchId !== batchId
      )
    );
  }

  function clearMortalityBatch(rowIndex: number) {
    if (isRowAgeLocked(rowIndex)) return;
    if (isMortalityThinningLocked(rowIndex)) return;

    setMortalityBatchAllocationsByRow(current => ({
      ...current,
      [rowIndex]: [],
    }));
    handleCellChange(rowIndex, mortalityBatchColumnIndex, "");
  }

  function autoSelectMortalityBatch() {
    if (mortalityBatchSelectionRowIndex == null) return;
    if (isRowAgeLocked(mortalityBatchSelectionRowIndex)) return;
    if (isMortalityThinningLocked(mortalityBatchSelectionRowIndex)) return;

    const splitResult = getAutoMortalitySplitAllocations(
      mortalityBatchSelectionRowIndex,
      activeMortalityRequiredQty,
    );

    if (splitResult.error) {
      toast(splitResult.error);
      return;
    }

    commitMortalityBatchAllocations(mortalityBatchSelectionRowIndex, splitResult.allocations);
  }

  function parseFeedBatchAllocationCell(value: string) {
    const matches = value.matchAll(/([^,()]+?)\s*\(([-\d,.]+)\)/g);

    return Array.from(matches).flatMap(match => {
      const batchNumber = match[1]?.trim() ?? "";
      const selectedQty = getNumericValue(match[2] ?? "");

      return batchNumber && selectedQty >= 0
        ? [{ batchNumber, selectedQty }]
        : [];
    });
  }

  function parseClipboardGrid(text: string) {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((line, index, lines) => line !== "" || index < lines.length - 1)
      .map(line => line.split("\t").map(value => value.trim()));
  }

  function resolvePastedFeedBatchAllocations(
    rowIndex: number,
    value: string,
    rowValues: string[],
  ) {
    const trimmedValue = value.trim();
    if (!trimmedValue) return { allocations: [], unresolvedBatchNumbers: [] as string[] };

    const parsedAllocations = parseFeedBatchAllocationCell(trimmedValue);
    const requestedAllocations = parsedAllocations.length > 0
      ? parsedAllocations
      : trimmedValue
        .split(",")
        .map(batchNumber => batchNumber.trim())
        .filter(Boolean)
        .map((batchNumber, index) => ({
          batchNumber,
          selectedQty: index === 0
            ? getNumericValue(rowValues[feedDailyKgColumnIndex] ?? "")
            : 0,
        }));

    const unresolvedBatchNumbers: string[] = [];
    const allocations = requestedAllocations.flatMap(requestedAllocation => {
      const batch = findFeedBatchByNumber(requestedAllocation.batchNumber);
      if (!batch) {
        unresolvedBatchNumbers.push(requestedAllocation.batchNumber);
        return [];
      }

      const selectedQty = Math.max(requestedAllocation.selectedQty, 0);
      const allocatedOutsideRow = getFeedBatchAllocatedQty(batch.id, rowIndex);
      const availableQty = Math.max(Number(batch.onHandQty || 0) - allocatedOutsideRow, 0);

      return [toFeedBatchAllocation(
        batch,
        Math.min(selectedQty, availableQty),
        "MANUAL"
      )];
    });

    return { allocations, unresolvedBatchNumbers };
  }

  function handleGridPaste(
    event: ClipboardEvent<HTMLElement>,
    startRowIndex: number,
    startColIndex: number,
  ) {
    const text = event.clipboardData.getData("text/plain");
    const hasTabularShape = text.includes("\t") || text.includes("\n") || text.includes("\r");
    if (!text || (!hasTabularShape && startColIndex !== feedBatchColumnIndex)) return;

    event.preventDefault();

    const pastedRows = parseClipboardGrid(text);
    if (pastedRows.length === 0) return;

    const nextGridValues = gridValues.map(row => [...row]);
    const nextFeedBatchAllocationsByRow: Record<number, FeedBatchAllocation[]> = {
      ...feedBatchAllocationsByRow,
    };
    const nextMortalityBatchAllocationsByRow: Record<number, MortalityBatchAllocation[]> = {
      ...mortalityBatchAllocationsByRow,
    };
    const unresolvedBatchNumbers = new Set<string>();
    let changedCellCount = 0;
    let skippedLockedCellCount = 0;
    let pasteBlockingError = "";

    pastedRows.forEach((pastedRow, pastedRowIndex) => {
      if (pasteBlockingError) return;

      const targetRowIndex = startRowIndex + pastedRowIndex;
      const targetRow = nextGridValues[targetRowIndex];
      if (!targetRow) return;

      const rowAge = rows[targetRowIndex]?.age ?? targetRowIndex;
      const hasLeadingAgeCell =
        pastedRow.length > 1 &&
        String(pastedRow[0] ?? "").trim() === String(rowAge);
      const rowValues = hasLeadingAgeCell ? pastedRow.slice(1) : pastedRow;
      const rowStartColIndex = hasLeadingAgeCell ? 0 : startColIndex;

      rowValues.forEach((value, pastedColIndex) => {
        if (pasteBlockingError) return;

        const targetColIndex = rowStartColIndex + pastedColIndex;
        if (targetColIndex < 0 || targetColIndex >= dataColumnCount) return;
        if (!editableColumnIndexes.has(targetColIndex)) return;
        if (targetColIndex === mortalityBatchColumnIndex) return;

        const rowAgeLocked = isRowAgeLocked(targetRowIndex);
        const feedIntakeLocked = isFeedIntakeLocked(targetRowIndex);
        const mortalityThinningLocked = isMortalityThinningLocked(targetRowIndex);
        if (
          rowAgeLocked ||
          (feedIntakeLocked && feedIntakeColumnIndexes.has(targetColIndex)) ||
          (mortalityThinningLocked && [0, 1, 3, 4, mortalityBatchColumnIndex].includes(targetColIndex))
        ) {
          skippedLockedCellCount += 1;
          return;
        }

        if (targetColIndex === feedBatchColumnIndex) {
          const { allocations, unresolvedBatchNumbers: unresolved } =
            resolvePastedFeedBatchAllocations(targetRowIndex, value, targetRow);

          unresolved.forEach(batchNumber => unresolvedBatchNumbers.add(batchNumber));
          nextFeedBatchAllocationsByRow[targetRowIndex] = allocations;
          targetRow[targetColIndex] = formatFeedBatchAllocationCell(allocations);
          changedCellCount += 1;
          return;
        }

        const currentFeedQuantityValue = targetRow[feedDailyKgColumnIndex] ?? "";
        const currentFeedQuantity = getNumericValue(currentFeedQuantityValue);
        const nextFeedQuantity = getNumericValue(value);
        const hasExistingFeedBatch =
          String(targetRow[feedBatchColumnIndex] ?? "").trim() !== "" ||
          (nextFeedBatchAllocationsByRow[targetRowIndex]?.length ?? 0) > 0;
        const shouldClearFeedBatch =
          targetColIndex === feedDailyKgColumnIndex &&
          (nextFeedQuantity <= 0 || (currentFeedQuantityValue !== value && hasExistingFeedBatch && currentFeedQuantity > 0));
        const currentMortalityTotal = getMortalityThinningTotal(targetRow);
        const nextMortalityRow = targetRow.map((cellValue, currentColIndex) =>
          currentColIndex === targetColIndex ? value : cellValue
        );
        const nextMortalityTotal = getMortalityThinningTotal(nextMortalityRow);
        const mortalityQuantityChanged =
          [0, 1, 3, 4].includes(targetColIndex) && currentMortalityTotal !== nextMortalityTotal;
        const hasExistingMortalityBatch =
          String(targetRow[mortalityBatchColumnIndex] ?? "").trim() !== "" ||
          (nextMortalityBatchAllocationsByRow[targetRowIndex] ?? []).length > 0;
        const shouldClearMortalityBatch =
          mortalityQuantityChanged &&
          (nextMortalityTotal <= 0 || (hasExistingMortalityBatch && currentMortalityTotal > 0));
        const shouldAutoSplitMortalityBatch =
          autoMortalityRateBatchSelection &&
          mortalityQuantityChanged &&
          nextMortalityTotal > 0;
        const autoMortalityBatchAllocations = shouldAutoSplitMortalityBatch
          ? getAutoMortalitySplitAllocations(targetRowIndex, nextMortalityTotal, nextMortalityBatchAllocationsByRow)
          : null;

        if (autoMortalityBatchAllocations?.error) {
          pasteBlockingError = autoMortalityBatchAllocations.error;
          return;
        }

        targetRow[targetColIndex] = value;
        if (shouldClearFeedBatch) {
          targetRow[feedBatchColumnIndex] = "";
          nextFeedBatchAllocationsByRow[targetRowIndex] = [];
        }
        if (autoMortalityBatchAllocations) {
          targetRow[mortalityBatchColumnIndex] = formatMortalityBatchAllocationCell(autoMortalityBatchAllocations.allocations);
          nextMortalityBatchAllocationsByRow[targetRowIndex] = autoMortalityBatchAllocations.allocations;
        } else if (shouldClearMortalityBatch) {
          targetRow[mortalityBatchColumnIndex] = "";
          nextMortalityBatchAllocationsByRow[targetRowIndex] = [];
        }
        changedCellCount += 1;
      });
    });

    if (pasteBlockingError) {
      toast(pasteBlockingError);
      return;
    }

    if (changedCellCount === 0) {
      toast(skippedLockedCellCount > 0 ? "Pasted cells are locked." : "No editable cells found in pasted data.");
      return;
    }

    startGridTransition(() => {
      setGridValues(nextGridValues);
    });
    setFeedBatchAllocationsByRow(nextFeedBatchAllocationsByRow);
    setMortalityBatchAllocationsByRow(nextMortalityBatchAllocationsByRow);

    if (unresolvedBatchNumbers.size > 0) {
      toast(`Pasted ${changedCellCount} cells. Some feed batches were not found: ${Array.from(unresolvedBatchNumbers).slice(0, 3).join(", ")}.`);
      return;
    }

    toast(`Pasted ${changedCellCount} cells.`);
  }

  function getFeedBatchAllocationsForSave(rowIndex: number) {
    const existingAllocations = feedBatchAllocationsByRow[rowIndex] ?? [];
    const parsedAllocations = parseFeedBatchAllocationCell(
      gridValues[rowIndex]?.[feedBatchColumnIndex] ?? ""
    );

    if (parsedAllocations.length === 0) {
      return existingAllocations.filter(allocation => allocation.selectedQty > 0);
    }

    return parsedAllocations.flatMap(parsedAllocation => {
      if (parsedAllocation.selectedQty <= 0) return [];

      const normalizedBatchNumber = parsedAllocation.batchNumber.toUpperCase();
      const existingAllocation = existingAllocations.find(allocation =>
        allocation.batchNumber.toUpperCase() === normalizedBatchNumber
      );
      const batch = availableFeedBatchRows.find(row =>
        row.batchNumber.toUpperCase() === normalizedBatchNumber
      );

      if (existingAllocation) {
        return [{
          ...existingAllocation,
          selectedQty: parsedAllocation.selectedQty,
        }];
      }

      if (batch) {
        return [toFeedBatchAllocation(batch, parsedAllocation.selectedQty, "MANUAL")];
      }

      throw new Error(`Unable to resolve feed batch ${parsedAllocation.batchNumber}. Please select it again from the feed batch dialog.`);
    });
  }

  function commitFeedBatchAllocations(rowIndex: number, allocations: FeedBatchAllocation[]) {
    if (savedLineByRowIndex[rowIndex]) return;

    const normalizedAllocations = allocations.filter(allocation => allocation.selectedQty >= 0);

    setFeedBatchAllocationsByRow(current => ({
      ...current,
      [rowIndex]: normalizedAllocations,
    }));
    handleCellChange(rowIndex, feedBatchColumnIndex, formatFeedBatchAllocationCell(normalizedAllocations));
  }

  function setFeedBatchAllocationsForRow(rowIndex: number, allocations: FeedBatchAllocation[]) {
    if (savedLineByRowIndex[rowIndex]) return;

    const normalizedAllocations = allocations.filter(allocation => allocation.selectedQty >= 0);
    const feedBatchText = formatFeedBatchAllocationCell(normalizedAllocations);

    setFeedBatchAllocationsByRow(current => ({
      ...current,
      [rowIndex]: normalizedAllocations,
    }));
    startGridTransition(() => {
      setGridValues(currentValues =>
        currentValues.map((row, currentRowIndex) =>
          currentRowIndex === rowIndex
            ? row.map((cellValue, currentColIndex) =>
              currentColIndex === feedBatchColumnIndex ? feedBatchText : cellValue
            )
            : row
        )
      );
    });
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

  function getFifoFeedBatchAllocations(rowIndex: number, requiredQty: number) {
    if (requiredQty <= 0) return [];

    let remainingQty = requiredQty;
    const allocations: FeedBatchAllocation[] = [];

    for (const batch of fifoFeedBatchRows) {
      if (remainingQty <= 0) break;

      const allocatedOutsideRow = getFeedBatchAllocatedQty(batch.id, rowIndex);
      const availableQty = Math.max(Number(batch.onHandQty || 0) - allocatedOutsideRow, 0);
      const selectedQty = Math.min(remainingQty, availableQty);
      if (selectedQty <= 0) continue;

      allocations.push(toFeedBatchAllocation(batch, selectedQty, "FIFO"));
      remainingQty -= selectedQty;
    }

    return allocations;
  }

  function applyAutoFeedBatchSelection(rowIndex: number, requiredQty: number) {
    if (!autoFeedBatchSelection) return;
    if (isRowAgeLocked(rowIndex)) return;
    if (isFeedIntakeLocked(rowIndex)) return;

    if (requiredQty <= 0) {
      setFeedBatchAllocationsForRow(rowIndex, []);
      return;
    }

    if (autoFeedBatchSelectionMode === "FIFO") {
      setFeedBatchAllocationsForRow(rowIndex, getFifoFeedBatchAllocations(rowIndex, requiredQty));
      return;
    }

    setFeedBatchDialogMode("cell");
    setFeedBatchSelectionRowIndex(rowIndex);
    setReviewFeedBatch(null);
    setFeedBatchRefreshKey(current => current + 1);
    setFeedBatchDialogOpen(true);
  }

  function addFeedBatchAllocation(batch: FeedBatchOnHand) {
    if (feedBatchSelectionRowIndex == null) return;
    if (isRowAgeLocked(feedBatchSelectionRowIndex)) return;
    if (isFeedIntakeLocked(feedBatchSelectionRowIndex)) return;

    const existingAllocations = feedBatchAllocationsByRow[feedBatchSelectionRowIndex] ?? [];
    const allocatedOutsideActiveRow = getFeedBatchAllocatedQty(batch.id, feedBatchSelectionRowIndex);
    const selectedForBatch = existingAllocations
      .filter(allocation => allocation.batchId === batch.id)
      .reduce((total, allocation) => total + Number(allocation.selectedQty || 0), 0);
    const availableToSelect = Math.max(Number(batch.onHandQty || 0) - allocatedOutsideActiveRow - selectedForBatch, 0);
    const qtyToSelect = activeFeedRemainingQty > 0
      ? Math.min(activeFeedRemainingQty, availableToSelect)
      : 0;

    if (qtyToSelect <= 0 && availableToSelect <= 0) return;

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
    if (isRowAgeLocked(feedBatchSelectionRowIndex)) return;
    if (isFeedIntakeLocked(feedBatchSelectionRowIndex)) return;

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
    if (isRowAgeLocked(feedBatchSelectionRowIndex)) return;
    if (isFeedIntakeLocked(feedBatchSelectionRowIndex)) return;

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
    if (isRowAgeLocked(feedBatchSelectionRowIndex)) return;
    if (isFeedIntakeLocked(feedBatchSelectionRowIndex)) return;

    commitFeedBatchAllocations(
      feedBatchSelectionRowIndex,
      getFifoFeedBatchAllocations(feedBatchSelectionRowIndex, activeFeedRequiredQty)
    );
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
    if (isRowAgeLocked(rowIndex)) return;
    if (isFeedIntakeLocked(rowIndex)) return;

    setFeedBatchDialogMode("cell");
    setFeedBatchSelectionRowIndex(rowIndex);
    setReviewFeedBatch(null);
    setFeedBatchRefreshKey(current => current + 1);
    setFeedBatchDialogOpen(true);
  }

  function findFeedBatchByNumber(batchNumber: string) {
    const normalizedBatchNumber = batchNumber.trim().toUpperCase();
    if (!normalizedBatchNumber) return null;

    return availableFeedBatchRows.find(row => row.batchNumber.toUpperCase() === normalizedBatchNumber) ?? null;
  }

  function openFeedBatchReview(rowIndex: number) {
    if (isRowAgeLocked(rowIndex)) return;

    const rowLocked = isFeedIntakeLocked(rowIndex);
    if (rowLocked && !rowHasFeedBatchData(rowIndex)) return;

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
    if (isRowAgeLocked(rowIndex)) return;
    if (isFeedIntakeLocked(rowIndex)) return;

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
      waterGuidelineColumnIndex,
      cumulativeTotalColumnIndex,
      breed: selectedBreed,
    });

    return rows.flatMap((row, rowIndex) => {
      const savedLine = savedLineByRowIndex[rowIndex];
      const feedBatchAllocationsForSave = getFeedBatchAllocationsForSave(rowIndex);
      const mortalityBatchAllocationsForSave = mortalityBatchAllocationsByRow[rowIndex] ?? [];

      return [{
        id: savedLine?.id ?? null,
        age: row.age,
        values: computedValuesForSave[rowIndex],
        feedIntakeLocked: Boolean(savedLine),
        mortalityThinningLocked: Boolean(savedMortalityLineByRowIndex[rowIndex]),
        mortalityAllocations: mortalityBatchAllocationsForSave.map((allocation, allocationIndex) => ({
          lineNo: allocationIndex + 1,
          itemCode: allocation.itemCode,
          itemName: allocation.itemName || null,
          batchNumber: allocation.batchNumber,
          warehouseCode: allocation.warehouseCode,
          allocatedQty: allocation.selectedQty,
          onHandSnapshot: allocation.availableQty,
          source: allocation.source,
        })),
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

    const hasMortalityOrThinning = gridValues.some(row => getMortalityThinningTotal(row) > 0);
    if (hasMortalityOrThinning && !getDefaultDisposalWarehouseCode(selectedFarm)) {
      toast("Please configure the farm's default Disposal warehouse before saving mortality or thinning.");
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
      setSavedMortalityLineByRowIndex(current => {
        const next = { ...current };

        lines.forEach(line => {
          const rowIndex = rows.findIndex(row => row.age === line.age);
          if (rowIndex >= 0 && (line.mortalityAllocations?.length ?? 0) > 0) {
            const savedLine = savedCard.savedLines.find(candidate => candidate.age === line.age);
            if (savedLine) next[rowIndex] = savedLine;
          }
        });

        return next;
      });
      setMortalityBatchAllocationsByRow(current => {
        const next = { ...current };

        lines.forEach(line => {
          const rowIndex = rows.findIndex(row => row.age === line.age);
          if (rowIndex >= 0 && (line.mortalityAllocations?.length ?? 0) > 0) {
            next[rowIndex] = (line.mortalityAllocations ?? []).map(allocation => ({
              batchId: [
                allocation.itemCode.trim().toUpperCase(),
                allocation.batchNumber.trim().toUpperCase(),
                allocation.warehouseCode.trim().toUpperCase(),
              ].join("|"),
              batchNumber: allocation.batchNumber,
              itemCode: allocation.itemCode,
              itemName: allocation.itemName ?? allocation.itemCode,
              warehouseCode: allocation.warehouseCode,
              availableQty: allocation.onHandSnapshot,
              selectedQty: allocation.allocatedQty,
              source: allocation.source ?? "MANUAL",
            }));
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
      setHydratedSavedMortalityBatchRows(current => {
        const next = { ...current };

        lines.forEach(line => {
          const rowIndex = rows.findIndex(row => row.age === line.age);
          if (rowIndex >= 0 && (line.mortalityAllocations?.length ?? 0) > 0) {
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

  async function reverseMortalityThinning(rowIndex: number) {
    const savedLine = savedMortalityLineByRowIndex[rowIndex];
    if (!savedLine) return;

    try {
      await reverseFlockCardMortalityThinning(savedLine.id, `Reversed mortality/thinning from flock card row age ${savedLine.age}`);
      setSavedMortalityLineByRowIndex(current => {
        const next = { ...current };
        delete next[rowIndex];
        return next;
      });
      startGridTransition(() => {
        setGridValues(currentValues =>
          currentValues.map((gridRow, currentRowIndex) =>
            currentRowIndex === rowIndex
              ? gridRow.map((cellValue, currentColIndex) =>
                [0, 1, 2, 3, 4, 5, cumulativeTotalColumnIndex, mortalityBatchColumnIndex].includes(currentColIndex)
                  ? ""
                  : cellValue
              )
              : gridRow
          )
        );
      });
      setMortalityBatchAllocationsByRow(current => {
        const next = { ...current };
        delete next[rowIndex];
        return next;
      });
      setHydratedSavedMortalityBatchRows(current => {
        const next = { ...current };
        delete next[rowIndex];
        return next;
      });
      toast(`Age ${savedLine.age} mortality/thinning reversed. You can now enter corrected values.`);
    } catch (error) {
      console.error(error);
      toast(`Unable to reverse mortality/thinning: ${error instanceof Error ? error.message : "Unknown error"}`);
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

  if (isDatabaseLoading) {
    return <FlockCardPageSkeleton />;
  }

  return (
    <div className="h-screen w-full bg-slate-100 p-4 dark:bg-background">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
        <Collapsible open={headerOpen} onOpenChange={setHeaderOpen}>
          <CollapsibleContent className="overflow-visible">
            <div className="relative border-b bg-white px-4 pb-6 pt-3 dark:bg-card">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Farm / Flock
                  </div>

                  <div className="grid items-end gap-3 md:grid-cols-[minmax(220px,1.4fr)_minmax(210px,1fr)] xl:grid-cols-[minmax(260px,1.4fr)_minmax(240px,1fr)_minmax(220px,0.9fr)]">
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

                    <div className="min-w-0">
                      {hasLockedFlockContext ? (
                        <label className="block min-w-0">
                          <span className="text-xs font-medium text-muted-foreground">Building</span>
                          <Input
                            value={selectedBuildingLabel}
                            readOnly
                            className="h-10 bg-[#fffdfb] dark:bg-input/30"
                          />
                        </label>
                      ) : loadingFarmBuildings ? (
                        <label className="block min-w-0">
                          <span className="text-xs font-medium text-muted-foreground">Building</span>
                          <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-[#fffdfb] px-3 text-sm text-muted-foreground dark:bg-input/30">
                            <Loader2 className="size-4 animate-spin" />
                            Loading buildings...
                          </div>
                        </label>
                      ) : farmBuildingError ? (
                        <label className="block min-w-0">
                          <span className="text-xs font-medium text-muted-foreground">Building</span>
                          <div className="flex h-10 items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                            {farmBuildingError}
                          </div>
                        </label>
                      ) : farmBuildings.length === 0 ? (
                        <label className="block min-w-0">
                          <span className="text-xs font-medium text-muted-foreground">Building</span>
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
                      <span className="text-xs font-medium text-muted-foreground">Flock</span>

                      <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-slate-50 px-3 text-sm dark:bg-background/60">
                        <span className="min-w-0 flex-1 truncate font-mono text-slate-800 dark:text-foreground">
                          {displayFlockCode}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          title="Copy flock code"
                          aria-label="Copy flock code"
                          disabled={displayFlockCode === "-"}
                          onClick={() => {
                            void navigator.clipboard?.writeText(displayFlockCode);
                          }}
                        >
                          <Copy className="size-3.5" />
                        </Button>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
                  <Help />
                  {devMode ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      onClick={handlePopulateSampleData}
                      disabled={currentFlockAge == null}
                      title="Populate blank cells with development sample data through the current flock age"
                    >
                      <WandSparkles className="size-4" />
                      Populate sample data
                    </Button>
                  ) : null}
                  <div className="min-w-[120px] text-xs text-muted-foreground" aria-live="polite">
                    {saveStatusLabel}
                  </div>
                  <FlockCardExportMenu
                    farmLabel={selectedFarmLabel}
                    buildingLabel={selectedBuildingLabel}
                    flockCode={displayFlockCode}
                    animalSummary={animalMetricLabel}
                    feedSummary={feedOnHandMetricLabel}
                    batchSummary={feedBatchMetricLabel}
                    rows={exportRows}
                  />
                  <Button
                    type="button"
                    size="default"
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
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-stretch justify-start gap-2 border-t pt-3">
                <div className="w-fit max-w-full min-w-0 rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
                  <div className="text-xs font-medium text-muted-foreground">Feed warehouse</div>
                  <div className="truncate text-sm font-semibold text-foreground" title={selectedWarehouseLabel || undefined}>
                    {selectedWarehouseLabel || (selectedFarmId ? "No default feed warehouse" : "Select farm first")}
                  </div>
                </div>

                <div className="grid w-[328px] min-w-0 grid-cols-2 divide-x rounded-md border bg-slate-50 dark:bg-background/40">
                  <label className="min-w-0 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">Total birds</span>
                    <Input
                      value={numberOfAnimals}
                      onChange={(event) =>
                        setNumberOfAnimals(Number(event.target.value))
                      }
                      aria-label="Total birds"
                      className="h-6 border-0 bg-transparent p-0 text-base font-semibold tabular-nums shadow-none focus-visible:ring-0"
                    />
                  </label>

                  <div className="min-w-0 px-3 py-2">
                    <div className="text-xs font-medium text-muted-foreground">Live birds</div>
                    <div className="truncate text-base font-semibold tabular-nums text-foreground">
                      {liveAnimalMetricLabel}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!selectedWarehouseCode}
                  onClick={openFeedOnHandSummary}
                  className="w-[170px] min-w-0 rounded-md border bg-[#fffdfb] px-3 py-2 text-left transition hover:border-ring hover:bg-accent disabled:cursor-not-allowed disabled:opacity-70 dark:bg-input/30"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    {loadingFeedBatches ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <PackageCheck className="size-3.5" />
                    )}
                    Feed on-hand
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold tabular-nums text-foreground">
                      {feedOnHandMetricLabel}
                    </span>
                    <MousePointerClick className="size-3.5 shrink-0 text-primary" />
                  </div>
                  {feedBatchError ? (
                    <div className="mt-1 truncate text-xs text-amber-700 dark:text-amber-400">
                      {feedBatchError}
                    </div>
                  ) : null}
                </button>

                <div className="w-[190px] min-w-0 rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
                  <div className="text-xs font-medium text-muted-foreground">Auto feed selection</div>
                  <div className="truncate text-sm font-semibold text-foreground">
                    {autoFeedBatchSelection ? autoFeedBatchSelectionMode : "Off"}
                  </div>
                </div>

                <div className="w-[190px] min-w-0 rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
                  <div className="text-xs font-medium text-muted-foreground">Auto mortality split</div>
                  <div className="truncate text-sm font-semibold text-foreground">
                    {autoMortalityRateBatchSelection ? "On" : "Off"}
                  </div>
                </div>

              </div>

              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="Collapse header"
                aria-label="Collapse header"
                onClick={() => setHeaderOpen(false)}
                className="absolute bottom-0 left-1/2 z-[60] -translate-x-1/2 translate-y-1/2 rounded-full border bg-white shadow-md hover:bg-accent dark:bg-card"
              >
                <ChevronUp className="size-4" />
              </Button>
            </div>
          </CollapsibleContent>
          {!headerOpen ? (
            <div className="relative flex min-h-14 items-center gap-3 border-b bg-white px-4 pb-4 pt-2 dark:bg-card">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">
                  {selectedFarmLabel} &gt; {selectedBuildingLabel} &gt; {displayFlockCode}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  Animals {animalMetricLabel} | Live {liveAnimalMetricLabel} | Feed {feedOnHandMetricLabel} | {feedBatchMetricLabel} | Mortality {mortalityBatchMetricLabel}
                </div>
              </div>

              <div className="hidden text-xs text-muted-foreground md:block" aria-live="polite">
                {saveStatusLabel}
              </div>
              <Help />
              {devMode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePopulateSampleData}
                  disabled={currentFlockAge == null}
                  title="Populate blank cells with development sample data through the current flock age"
                >
                  <WandSparkles className="size-4" />
                  Sample data
                </Button>
              ) : null}
              <FlockCardExportMenu
                farmLabel={selectedFarmLabel}
                buildingLabel={selectedBuildingLabel}
                flockCode={displayFlockCode}
                animalSummary={animalMetricLabel}
                feedSummary={feedOnHandMetricLabel}
                batchSummary={feedBatchMetricLabel}
                rows={exportRows}
              />
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
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="Show header details"
                aria-label="Show header details"
                onClick={() => setHeaderOpen(true)}
                className="absolute bottom-0 left-1/2 z-[60] -translate-x-1/2 translate-y-1/2 rounded-full border bg-white shadow-md hover:bg-accent dark:bg-card"
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
          ) : null}
        </Collapsible>

        <Dialog
          open={mortalityBatchDialogOpen}
          onOpenChange={(open) => {
            setMortalityBatchDialogOpen(open);
            if (!open) setMortalityBatchSelectionRowIndex(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Select Mortality/Thinning Batch</DialogTitle>
              <DialogDescription>
                Choose the origin batch for the combined mortality and thinning total on age {mortalityBatchSelectionAge ?? ""}.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-md border bg-white p-3 shadow">
              <div className="grid gap-2 text-sm sm:grid-cols-5">
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">Age</div>
                  <div className="font-semibold text-foreground">{mortalityBatchSelectionAge ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">Total</div>
                  <div className="font-semibold tabular-nums text-foreground">{formatQuantity(activeMortalityRequiredQty)}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">Allocated</div>
                  <div className="font-semibold tabular-nums text-foreground">{formatQuantity(activeMortalityAllocatedQty)}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">Remaining</div>
                  <div className={`font-semibold tabular-nums ${activeMortalityRemainingQty > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {formatQuantity(activeMortalityRemainingQty)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">On hand</div>
                  <div className="font-semibold tabular-nums text-foreground">
                    {loadingMortalityBatches ? "Loading..." : formatQuantity(totalMortalityBatchOnHand)}
                  </div>
                </div>
              </div>
            </div>

            {loadingMortalityBatches ? (
              <div className="flex items-center justify-center gap-2 rounded-md border bg-muted/40 px-3 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading mortality/thinning batches...
              </div>
            ) : mortalityBatchError ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {mortalityBatchError}
              </div>
            ) : positiveAvailableMortalityBatchRows.length === 0 && activeMortalityBatchAllocations.length === 0 ? (
              <div className="rounded-md border bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
                No origin batches were found for this flock.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
                {positiveAvailableMortalityBatchRows.length === 0 ? (
                  <div className="rounded-md border bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
                    No selectable origin batches are currently available.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <div className="min-w-[620px]">
                      <div className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.3fr)_120px_90px] gap-3 bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                        <div>Batch</div>
                        <div>Consists of</div>
                        <div className="text-right">Available</div>
                        <div className="text-right">Action</div>
                      </div>
                      <div className="max-h-[46vh] overflow-y-auto">
                        {positiveAvailableMortalityBatchRows.map(row => (
                          <div
                            key={row.id}
                            className="grid grid-cols-[minmax(130px,1fr)_minmax(180px,1.3fr)_120px_90px] items-center gap-3 border-t px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-foreground">{row.batchNumber}</div>
                              <div className="truncate text-xs text-muted-foreground">{row.warehouseCode}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium">{row.itemName || row.itemCode}</div>
                              <div className="truncate text-xs text-muted-foreground">{row.itemCode}</div>
                            </div>
                            <div className="text-right font-semibold tabular-nums text-foreground">
                              {formatQuantity(row.availableOnHandQty)}
                            </div>
                            <div className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={activeMortalityBatchRowLocked || activeMortalityRemainingQty <= 0}
                                onClick={() => addMortalityBatchAllocation(row)}
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="min-w-0 rounded-md border">
                  <div className="border-b bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                    Selected Batches
                  </div>
                  <div className="grid grid-cols-[minmax(90px,1fr)_90px_42px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                    <div>Batch</div>
                    <div className="text-right">Qty</div>
                    <div className="text-right">Remove</div>
                  </div>
                  <div className="max-h-[46vh] overflow-y-auto bg-white">
                    {activeMortalityBatchAllocations.length === 0 ? (
                      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                        No batches selected yet.
                      </div>
                    ) : (
                      activeMortalityBatchAllocations.map(allocation => (
                        <div
                          key={allocation.batchId}
                          className="grid grid-cols-[minmax(90px,1fr)_90px_42px] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-foreground">{allocation.batchNumber}</div>
                            <div className="truncate text-xs text-muted-foreground">{allocation.itemName || allocation.itemCode}</div>
                          </div>
                          <Input
                            value={formatTotal(allocation.selectedQty)}
                            disabled={activeMortalityBatchRowLocked}
                            onChange={(event) => updateMortalityBatchAllocationQty(allocation.batchId, event.target.value)}
                            className="h-8 text-right tabular-nums"
                          />
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="outline"
                            disabled={activeMortalityBatchRowLocked}
                            onClick={() => removeMortalityBatchAllocation(allocation.batchId)}
                            aria-label={`Remove ${allocation.batchNumber}`}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={activeMortalityBatchRowLocked || activeMortalityBatchAllocations.length === 0 || mortalityBatchSelectionRowIndex == null}
                onClick={() => {
                  if (mortalityBatchSelectionRowIndex != null) commitMortalityBatchAllocations(mortalityBatchSelectionRowIndex, []);
                }}
              >
                Clear Selection
              </Button>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={activeMortalityBatchRowLocked || loadingMortalityBatches || positiveAvailableMortalityBatchRows.length === 0 || activeMortalityRequiredQty <= 0}
                  onClick={autoSelectMortalityBatch}
                >
                  <PackageCheck className="size-4" />
                  Auto Select
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const rowIndex = mortalityBatchSelectionRowIndex;
                    setMortalityBatchDialogOpen(false);
                    setMortalityBatchSelectionRowIndex(null);
                    if (rowIndex != null) focusCell(rowIndex, mortalityBatchColumnIndex);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                      disabled={Number(reviewFeedBatch.onHandQty || 0) <= 0}
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

        <div className="relative flex-1 overflow-auto">
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
                const savedLine = savedLineByRowIndex[rowIndex];
                const savedMortalityLine = savedMortalityLineByRowIndex[rowIndex];
                const rowAgeLocked = isRowAgeLocked(rowIndex);
                const feedIntakeLocked = isFeedIntakeLocked(rowIndex);
                const mortalityThinningLocked = isMortalityThinningLocked(rowIndex);
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
                          {savedLine ? (
                            <DropdownMenuItem
                              disabled={rowAgeLocked}
                              onClick={() => void reverseFeedIntake(rowIndex)}
                            >
                              <RotateCcw className="size-4" />
                              Reverse Feed Intake
                            </DropdownMenuItem>
                          ) : null}
                          {savedMortalityLine ? (
                            <DropdownMenuItem
                              disabled={rowAgeLocked}
                              onClick={() => void reverseMortalityThinning(rowIndex)}
                            >
                              <RotateCcw className="size-4" />
                              Reverse Mortality/Thinning
                            </DropdownMenuItem>
                          ) : null}
                          {!savedLine && !savedMortalityLine ? (
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={rowAgeLocked}
                              onClick={() => clearRow(rowIndex)}
                            >
                              <Eraser className="size-4" />
                              Clear Row
                            </DropdownMenuItem>
                          ) : (
                            null
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>

                    {visibleColumnIndexes.map((colIndex) => {
                      const feedIntakeCellLocked = feedIntakeLocked && feedIntakeColumnIndexes.has(colIndex);
                      const mortalityThinningCellLocked =
                        mortalityThinningLocked && [0, 1, 3, 4, mortalityBatchColumnIndex].includes(colIndex);
                      const disabled = rowAgeLocked || feedIntakeCellLocked || mortalityThinningCellLocked || columnDisabledFlags[colIndex];
                      const inputDisabled = colIndex === feedBatchColumnIndex || colIndex === mortalityBatchColumnIndex
                        ? rowAgeLocked || mortalityThinningCellLocked || columnDisabledFlags[colIndex]
                        : disabled;
                      const feedBatchCellCanOpen =
                        !rowAgeLocked && (!feedIntakeCellLocked || rowHasFeedBatchData(rowIndex));
                      const mortalityBatchCellCanOpen =
                        !rowAgeLocked &&
                        (!mortalityThinningCellLocked || rowHasMortalityBatchData(rowIndex)) &&
                        (getMortalityThinningTotal(gridValues[rowIndex] ?? []) > 0 || rowHasMortalityBatchData(rowIndex));

                      const active =
                        activeCell?.rowIndex === rowIndex &&
                        activeCell.colIndex === colIndex;

                      return (
                        <TableCell
                          key={colIndex}
                          className={`fc-grid-cell ${disabled ? "fc-grid-cell-readonly" : "fc-grid-cell-editable"} ${bodyEmphasisClasses[colIndex]} ${active ? "fc-grid-cell-active" : ""} p-0 ${bodyBorderClasses[colIndex]}`}
                        >
                          {colIndex === mortalityBatchColumnIndex ? (
                            <div className="flex min-h-8 w-full items-stretch" style={{ minWidth: mortalityBatchColumnWidth }}>
                              <button
                                type="button"
                                data-fc-cell="true"
                                ref={(element) => {
                                  inputRefs.current[rowIndex] ??= [];
                                  inputRefs.current[rowIndex][colIndex] = element;
                                }}
                                onFocus={() => setActiveCell({ rowIndex, colIndex })}
                                onClick={() => openMortalityBatchSelection(rowIndex)}
                                onKeyDown={(event) => handleCellKeyDown(event, rowIndex, colIndex)}
                                disabled={!mortalityBatchCellCanOpen}
                                className="flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-normal break-words px-1.5 py-1 text-center text-xs leading-tight text-[#4f4a43] shadow-none transition-none focus:font-semibold focus:text-emerald-950 focus:outline-none disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[#7c766c] dark:text-foreground dark:focus:text-emerald-100 dark:disabled:bg-transparent dark:disabled:text-muted-foreground"
                                title={
                                  mortalityThinningCellLocked
                                    ? "Saved mortality/thinning. Open to view batches or reverse mortality/thinning before editing."
                                    : rowAgeLocked
                                    ? `Flock age is ${currentFlockAge}. Enable advance posting to edit this age.`
                                    : gridValues[rowIndex]?.[mortalityBatchColumnIndex] || "Select mortality/thinning batch"
                                }
                              >
                                <span className="min-w-0 break-words">
                                  {gridValues[rowIndex]?.[mortalityBatchColumnIndex]?.trim() || "Select"}
                                </span>
                                <MousePointerClick className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                              </button>

                              {gridValues[rowIndex]?.[mortalityBatchColumnIndex]?.trim() ? (
                                <button
                                  type="button"
                                  disabled={rowAgeLocked || mortalityThinningCellLocked}
                                  onClick={() => clearMortalityBatch(rowIndex)}
                                  className="flex w-7 shrink-0 items-center justify-center border-l border-[#ded8ce] text-muted-foreground hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-ring/20 dark:border-border"
                                  title="Clear mortality/thinning batch"
                                  aria-label="Clear mortality/thinning batch"
                                >
                                  <X className="size-3.5" aria-hidden="true" />
                                </button>
                              ) : null}
                            </div>
                          ) : colIndex === feedBatchColumnIndex ? (
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
                                onPaste={(event) => handleGridPaste(event, rowIndex, colIndex)}
                                disabled={!feedBatchCellCanOpen}
                                className="flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-normal break-words px-1.5 py-1 text-center text-xs leading-tight text-[#4f4a43] shadow-none transition-none focus:font-semibold focus:text-emerald-950 focus:outline-none disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[#7c766c] dark:text-foreground dark:focus:text-emerald-100 dark:disabled:bg-transparent dark:disabled:text-muted-foreground"
                                title={
                                  feedIntakeCellLocked
                                    ? "Saved feed intake. Open to view batches or reverse feed intake before editing."
                                    : rowAgeLocked
                                      ? `Flock age is ${currentFlockAge}. Enable advance posting to edit this age.`
                                      : gridValues[rowIndex]?.[feedBatchColumnIndex] || "Select feed batch"
                                }
                              >
                                <span className="min-w-0 break-words">
                                  {formatFeedBatchAllocationDisplay(rowIndex)}
                                </span>
                                <MousePointerClick className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                              </button>

                              {gridValues[rowIndex]?.[feedBatchColumnIndex]?.trim() ? (
                                <button
                                  type="button"
                                  disabled={rowAgeLocked || feedIntakeCellLocked}
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
                              onPaste={(event) => handleGridPaste(event, rowIndex, colIndex)}
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

                {visibleColumnIndexes.map((colIndex) => (
                  <TableCell
                    key={colIndex}
                    className={`fc-grid-footer-cell sticky bottom-0 text-center font-semibold ${footerBorderClasses[colIndex]}`}
                  >
                    {columnTotals[colIndex]}
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
