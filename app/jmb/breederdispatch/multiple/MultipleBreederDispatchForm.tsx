"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bird, ListPlus, Loader2, Save, Send, Trash2, X } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { TableCopyDownCell } from "@/components/ui/TableCopyDownCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTableCopyDown } from "@/hooks/useTableCopyDown";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  createBreederDispatch,
  dispatchItemKey,
  EGG_CATEGORIES,
  POPULATION_CATEGORIES,
  getDefaultFarm,
  getBreederDispatchById,
  listAvailableDispatchItems,
  listHatcheryFarms,
  updateBreederDispatch,
  type AvailableDispatchItem,
  type BreederDispatchDetail,
  type BreederDispatchInput,
  type DispatchSourceType,
  type DispatchStatus,
  type HatcheryFarmLookup,
} from "../new/api";

type DispatchRow = {
  id: string;
  dispatch_date: string;
  destination: string;
  customer_name: string;
  dr_no: string;
  hauler_name: string;
  plate_number: string;
  truck_seal: string;
  source_type: "" | DispatchSourceType;
  category: string;
  building_id: string;
  production_from_date: string;
  production_to_date: string;
  dispatch_qty: string;
  remarks: string;
};

type CopyColumn = Exclude<keyof DispatchRow, "id">;

const COPY_COLUMNS: CopyColumn[] = [
  "dispatch_date",
  "building_id",
  "source_type",
  "category",
  "production_from_date",
  "production_to_date",
  "dispatch_qty",
  "destination",
  "customer_name",
  "dr_no",
  "hauler_name",
  "plate_number",
  "truck_seal",
  "remarks",
];

const DISPATCH_GRID_COLUMNS = [
  { key: "row", label: "#", width: 50, minWidth: 50, resizable: false },
  { key: "dispatch_date", label: "Dispatch Date *", width: 130, minWidth: 100, resizable: true },
  { key: "building", label: "Building *", width: 96, minWidth: 80, resizable: true },
  { key: "source", label: "Data Source *", width: 160, minWidth: 110, resizable: true },
  { key: "category", label: "Category *", width: 120, minWidth: 90, resizable: true },
  { key: "production_from", label: "From Prod. Date *", width: 140, minWidth: 110, resizable: true },
  { key: "production_to", label: "To Prod. Date *", width: 140, minWidth: 110, resizable: true },
  { key: "available", label: "Available", width: 105, minWidth: 80, resizable: true },
  { key: "dispatch_qty", label: "Dispatch Qty *", width: 120, minWidth: 90, resizable: true },
  { key: "destination", label: "Destination Transfer *", width: 220, minWidth: 150, resizable: true },
  { key: "customer", label: "Customer Name", width: 190, minWidth: 130, resizable: true },
  { key: "dr_no", label: "TS/DR #", width: 90, minWidth: 70, resizable: true },
  { key: "hauler", label: "Hauler", width: 150, minWidth: 100, resizable: true },
  { key: "plate", label: "Plate Number", width: 72, minWidth: 65, resizable: true },
  { key: "seal", label: "Truck Seal", width: 72, minWidth: 65, resizable: true },
  { key: "remarks", label: "Remarks", width: 117, minWidth: 80, resizable: true },
  { key: "action", label: "Action", width: 60, minWidth: 50, resizable: true },
] as const;

const today = () => new Date().toLocaleDateString("en-CA");
const WALK_IN_DESTINATION = "__walk_in_customer__";

const createRowId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function emptyRow(dispatchDate = today()): DispatchRow {
  return {
    id: createRowId(),
    dispatch_date: dispatchDate,
    destination: "",
    customer_name: "",
    dr_no: "",
    hauler_name: "",
    plate_number: "",
    truck_seal: "",
    source_type: "",
    category: "",
    building_id: "",
    production_from_date: "",
    production_to_date: "",
    dispatch_qty: "",
    remarks: "",
  };
}

function isCopyEditable(column: CopyColumn, row: DispatchRow) {
  if (column === "source_type") return Boolean(row.building_id);
  if (column === "category") return Boolean(row.building_id && row.source_type);
  if (column === "production_from_date" || column === "production_to_date")
    return Boolean(row.category);
  if (column === "customer_name")
    return row.destination === WALK_IN_DESTINATION;
  return true;
}

function applyRowValue(
  row: DispatchRow,
  key: CopyColumn,
  value: string,
): DispatchRow {
  const next = { ...row, [key]: value } as DispatchRow;
  if (key === "building_id") {
    next.source_type = "";
    next.category = "";
    next.production_from_date = "";
    next.production_to_date = "";
    next.dispatch_qty = "";
  } else if (key === "source_type") {
    next.category = "";
    next.production_from_date = "";
    next.production_to_date = "";
    next.dispatch_qty = "";
  } else if (key === "category") {
    next.production_from_date = "";
    next.production_to_date = "";
    next.dispatch_qty = "";
  } else if (key === "production_from_date") {
    if (next.production_to_date && value > next.production_to_date)
      next.production_to_date = "";
    next.dispatch_qty = "";
  } else if (key === "production_to_date") {
    next.dispatch_qty = "";
  } else if (key === "dispatch_date") {
    if (next.production_from_date > value) next.production_from_date = "";
    if (next.production_to_date > value) next.production_to_date = "";
    next.dispatch_qty = "";
  } else if (key === "destination" && value !== WALK_IN_DESTINATION) {
    next.customer_name = "";
  }
  return next;
}

const quantity = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sourceCategoryKey = (
  row: Pick<
    DispatchRow,
    | "source_type"
    | "category"
    | "building_id"
    | "production_from_date"
    | "production_to_date"
  >,
) =>
  `${row.source_type}:${row.category}:${row.building_id}:${row.production_from_date}:${row.production_to_date}`;

const buildingValue = (item: Pick<AvailableDispatchItem, "building_id">) =>
  item.building_id === null
    ? "__unassigned_building__"
    : String(item.building_id);

function rowsFromDispatch(record: BreederDispatchDetail): DispatchRow[] {
  const walkInPrefix = "Walk-in Customer - ";
  const isWalkIn = record.destination.startsWith(walkInPrefix);
  return record.lines.map((line) => ({
    id: createRowId(),
    dispatch_date: record.dispatch_date.slice(0, 10),
    destination: isWalkIn ? WALK_IN_DESTINATION : String(record.farm_destination_id ?? ""),
    customer_name: isWalkIn ? record.destination.slice(walkInPrefix.length) : "",
    dr_no: line.dr_no ?? "",
    hauler_name: record.hauler_name ?? "",
    plate_number: record.plate_number ?? "",
    truck_seal: record.truck_seal ?? "",
    source_type: line.source_type,
    category: line.category,
    building_id: buildingValue(line),
    production_from_date: line.source_date.slice(0, 10),
    production_to_date: line.source_date.slice(0, 10),
    dispatch_qty: String(line.dispatch_qty),
    remarks: line.remarks ?? record.remarks ?? "",
  }));
}

function itemsFromDispatch(record: BreederDispatchDetail): AvailableDispatchItem[] {
  return record.lines.map((line) => ({
    ...line,
    key: dispatchItemKey(line.source_type, line.source_record_id, line.category),
    farm_id: record.farm_id,
    farm_code: record.farm_code,
    farm_name: record.farm_name,
  }));
}

export default function MultipleBreederDispatchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setValue } = useGlobalContext();
  const dispatchId = Number(searchParams.get("id"));
  const isViewing = Number.isInteger(dispatchId) && dispatchId > 0;
  const [farmId, setFarmId] = useState("");
  const [items, setItems] = useState<AvailableDispatchItem[]>([]);
  const [hatcheryFarms, setHatcheryFarms] = useState<HatcheryFarmLookup[]>([]);
  const [rows, setRows] = useState<DispatchRow[]>(() => [emptyRow()]);
  const [columnWidths, setColumnWidths] = useState<number[]>(() => DISPATCH_GRID_COLUMNS.map((column) => column.width));
  const columnResizeCleanup = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [viewDocumentNo, setViewDocumentNo] = useState("");
  const [viewStatus, setViewStatus] = useState<DispatchStatus | null>(null);
  const isEditingDraft = isViewing && viewStatus === "Draft";
  const isReadOnly = isViewing && !isEditingDraft;
  const inventoryDate = rows.reduce(
    (latest, row) => (row.dispatch_date > latest ? row.dispatch_date : latest),
    "",
  );

  useEffect(() => {
    // Repair duplicate IDs retained by Fast Refresh from the previous counter-based implementation.
    setRows((current) => {
      const seen = new Set<string>();
      let changed = false;
      const uniqueRows = current.map((row) => {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          return row;
        }
        changed = true;
        const id = createRowId();
        seen.add(id);
        return { ...row, id };
      });
      return changed ? uniqueRows : current;
    });
  }, []);

  useEffect(() => () => columnResizeCleanup.current?.(), []);

  useEffect(() => {
    void refreshSessionx(router);
  }, [router]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      isViewing ? getBreederDispatchById(dispatchId) : getDefaultFarm(),
      listHatcheryFarms(),
    ])
      .then(([setup, destinations]) => {
        if (cancelled) return;
        setHatcheryFarms(destinations);
        if (isViewing) {
          const record = setup as BreederDispatchDetail;
          setFarmId(String(record.farm_id));
          setItems(itemsFromDispatch(record));
          setRows(rowsFromDispatch(record));
          setViewDocumentNo(record.document_no);
          setViewStatus(record.status);
        } else {
          const farm = setup as Awaited<ReturnType<typeof getDefaultFarm>>;
          if (farm?.id) setFarmId(String(farm.id));
        }
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) setError("Unable to load breeder dispatch setup.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatchId, isViewing]);

  useEffect(() => {
    if (loading || isReadOnly || !inventoryDate) return;
    let cancelled = false;
    setLoadingItems(true);
    setError("");
    listAvailableDispatchItems(inventoryDate)
      .then((available) => {
        if (cancelled) return;
        setItems(available);
        setFarmId((current) =>
          current && available.some((item) => String(item.farm_id) === current)
            ? current
            : available[0]
              ? String(available[0].farm_id)
              : "",
        );
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled)
          setError(
            "Unable to load dispatchable Population Record and Egg Laying quantities.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inventoryDate, isReadOnly, loading]);

  useEffect(
    () => setValue("loading_g", loading || loadingItems || saving),
    [loading, loadingItems, saving, setValue],
  );

  const farms = useMemo(() => {
    const unique = new Map<number, AvailableDispatchItem>();
    items.forEach((item) => unique.set(item.farm_id, item));
    return [...unique.values()].sort((left, right) =>
      left.farm_name.localeCompare(right.farm_name),
    );
  }, [items]);
  const selectedFarm =
    farms.find((farm) => String(farm.farm_id) === farmId) ?? null;
  const farmItems = useMemo(
    () => items.filter((item) => String(item.farm_id) === farmId),
    [farmId, items],
  );
  const destinationOptions = hatcheryFarms.map((farm) => ({
    value: String(farm.farm_id),
    label: farm.farm_code
      ? `${farm.farm_code} - ${farm.farm_name}`
      : farm.farm_name,
  }));
  const tableWidth = columnWidths.reduce((total, width) => total + width, 0);

  function updateRow(id: string, key: CopyColumn, value: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === id ? applyRowValue(row, key, value) : row,
      ),
    );
  }

  const copyDown = useTableCopyDown({
    rows,
    columns: COPY_COLUMNS,
    disabled: loading || loadingItems || saving || isReadOnly,
    isEditable: isCopyEditable,
    getValue: (column, row) => row[column],
    onCopy: (column, targets, value) => {
      const targetIds = new Set(targets.map((row) => row.id));
      setRows((current) =>
        current.map((row) =>
          targetIds.has(row.id)
            ? applyRowValue(row, column, String(value ?? ""))
            : row,
        ),
      );
    },
  });

  function copyCellProps(rowIndex: number, column: CopyColumn) {
    return {
      canCopyDown:
        isCopyEditable(column, rows[rowIndex]) &&
        rows.slice(rowIndex + 1).some((row) => isCopyEditable(column, row)),
      onCopyDown: () =>
        copyDown.copyToBottom(rowIndex, COPY_COLUMNS.indexOf(column)),
    };
  }

  function startColumnResize(columnIndex: number, event: ReactPointerEvent<HTMLButtonElement>) {
    const column = DISPATCH_GRID_COLUMNS[columnIndex];
    if (!column?.resizable) return;
    event.preventDefault();
    event.stopPropagation();
    columnResizeCleanup.current?.();
    const startX = event.clientX;
    const startWidth = columnWidths[columnIndex] ?? column.width;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onPointerMove = (moveEvent: PointerEvent) => {
      const width = Math.max(column.minWidth, startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => current.map((currentWidth, index) => index === columnIndex ? width : currentWidth));
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      columnResizeCleanup.current = null;
    };
    columnResizeCleanup.current = cleanup;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  }

  function resetSources() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        building_id: "",
        source_type: "",
        category: "",
        production_from_date: "",
        production_to_date: "",
        dispatch_qty: "",
      })),
    );
  }

  function rowItems(row: DispatchRow) {
    return farmItems.filter(
      (item) =>
        item.source_type === row.source_type &&
        item.category === row.category &&
        buildingValue(item) === row.building_id &&
        item.source_date.slice(0, 10) >= row.production_from_date &&
        item.source_date.slice(0, 10) <= row.production_to_date &&
        item.source_date.slice(0, 10) <= row.dispatch_date,
    );
  }

  function availableFor(row: DispatchRow) {
    const total = rowItems(row).reduce(
      (sum, item) => sum + quantity(item.source_available),
      0,
    );
    const usedByOtherRows = rows.reduce(
      (sum, other) =>
        other.id !== row.id &&
        sourceCategoryKey(other) === sourceCategoryKey(row)
          ? sum + quantity(other.dispatch_qty)
          : sum,
      0,
    );
    return Math.max(0, total - usedByOtherRows);
  }

  function buildPayloads(): BreederDispatchInput[] {
    if (!selectedFarm) throw new Error("Breeder farm is required.");
    if (!rows.length) throw new Error("Add at least one dispatch row.");

    const remaining = new Map(
      farmItems.map((item) => [item.key, quantity(item.source_available)]),
    );
    return rows.map((row, rowIndex) => {
      const lineLabel = `Row ${rowIndex + 1}`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.dispatch_date))
        throw new Error(`${lineLabel}: Dispatch Date is required.`);
      if (!row.destination.trim())
        throw new Error(`${lineLabel}: Destination Transfer is required.`);
      if (row.destination === WALK_IN_DESTINATION && !row.customer_name.trim())
        throw new Error(
          `${lineLabel}: Customer Name is required for a walk-in customer.`,
        );
      const destinationFarm =
        row.destination === WALK_IN_DESTINATION
          ? null
          : hatcheryFarms.find(
              (farm) => String(farm.farm_id) === row.destination,
            );
      if (row.destination !== WALK_IN_DESTINATION && !destinationFarm)
        throw new Error(
          `${lineLabel}: Select an active Hatchery destination farm.`,
        );
      if (!row.source_type)
        throw new Error(`${lineLabel}: Data Source is required.`);
      if (!row.category) throw new Error(`${lineLabel}: Category is required.`);
      if (!row.building_id)
        throw new Error(`${lineLabel}: Building is required.`);
      if (!row.production_from_date)
        throw new Error(`${lineLabel}: From Prod. Date is required.`);
      if (!row.production_to_date)
        throw new Error(`${lineLabel}: To Prod. Date is required.`);
      if (row.production_from_date > row.production_to_date)
        throw new Error(
          `${lineLabel}: From Prod. Date cannot be later than To Prod. Date.`,
        );
      if (row.production_to_date > row.dispatch_date)
        throw new Error(
          `${lineLabel}: To Prod. Date cannot be later than Dispatch Date.`,
        );
      const requested = quantity(row.dispatch_qty);
      if (!Number.isInteger(requested) || requested <= 0)
        throw new Error(
          `${lineLabel}: Dispatch Quantity must be a positive whole number.`,
        );

      let unallocated = requested;
      const lines: BreederDispatchInput["lines"] = [];
      const matching = rowItems(row).sort(
        (left, right) => left.source_record_id - right.source_record_id,
      );
      for (const item of matching) {
        const itemRemaining = remaining.get(item.key) ?? 0;
        if (unallocated <= 0 || itemRemaining <= 0) continue;
        const allocated = Math.min(unallocated, itemRemaining);
        remaining.set(item.key, itemRemaining - allocated);
        unallocated -= allocated;
        lines.push({
          line_no: lines.length + 1,
          source_type: item.source_type,
          source_record_id: item.source_record_id,
          source_date: item.source_date,
          category: item.category,
          category_label: item.category_label,
          placement_id: item.placement_id,
          placement_date: item.placement_date,
          building_id: item.building_id,
          building_name: item.building_name,
          pen_id: item.pen_id,
          pen_name: item.pen_name,
          dr_no: row.dr_no.trim() || item.dr_no,
          source_available: item.source_available,
          dispatch_qty: allocated,
          remarks: row.remarks.trim() || null,
        });
      }
      if (unallocated > 0)
        throw new Error(
          `${lineLabel}: Dispatch Quantity exceeds the remaining inventory for this source, category, and production date.`,
        );

      return {
        dispatch_date: row.dispatch_date,
        farm_id: selectedFarm.farm_id,
        farm_code: selectedFarm.farm_code,
        farm_name: selectedFarm.farm_name,
        destination:
          row.destination === WALK_IN_DESTINATION
            ? `Walk-in Customer - ${row.customer_name.trim()}`
            : destinationFarm!.farm_name,
        farm_destination_id: destinationFarm?.farm_id ?? null,
        hauler_name: row.hauler_name.trim() || null,
        plate_number: row.plate_number.trim() || null,
        truck_seal: row.truck_seal.trim() || null,
        remarks: row.remarks.trim() || null,
        lines,
      };
    });
  }

  function buildDraftPayload(payloads: BreederDispatchInput[]): BreederDispatchInput {
    const [first] = payloads;
    if (!first) throw new Error("Add at least one dispatch row.");
    const hasDifferentHeader = payloads.some((payload) =>
      payload.dispatch_date !== first.dispatch_date ||
      payload.farm_id !== first.farm_id ||
      payload.destination !== first.destination ||
      payload.farm_destination_id !== first.farm_destination_id ||
      payload.hauler_name !== first.hauler_name ||
      payload.plate_number !== first.plate_number ||
      payload.truck_seal !== first.truck_seal,
    );
    if (hasDifferentHeader) {
      throw new Error("All rows in this draft must use the same dispatch date, destination, and transport details.");
    }
    return {
      ...first,
      lines: payloads.flatMap((payload) => payload.lines)
        .map((line, index) => ({ ...line, line_no: index + 1 })),
    };
  }

  async function save(post: boolean) {
    let payloads: BreederDispatchInput[];
    let draftPayload: BreederDispatchInput | null = null;
    try {
      payloads = buildPayloads();
      if (isEditingDraft) draftPayload = buildDraftPayload(payloads);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Complete all required dispatch fields.",
      );
      return;
    }
    if (
      post &&
      !window.confirm(
        isEditingDraft
          ? "Post this breeder dispatch? The quantities will be reserved immediately."
          : `Post ${payloads.length} breeder dispatch transaction${payloads.length === 1 ? "" : "s"}? The quantities will be reserved immediately.`,
      )
    )
      return;

    setSaving(true);
    setError("");
    let completed = 0;
    try {
      if (isEditingDraft) {
        await updateBreederDispatch(dispatchId, draftPayload!, post);
      } else {
        for (const payload of payloads) {
          await createBreederDispatch(payload, post);
          completed += 1;
        }
      }
      router.push("/jmb/breederdispatch");
      router.refresh();
    } catch (saveError) {
      console.error(saveError);
      const detail =
        saveError instanceof Error
          ? saveError.message
          : "Unable to save multiple breeder dispatches.";
      if (completed) {
        setRows((current) => current.slice(completed));
        try {
          if (inventoryDate)
            setItems(await listAvailableDispatchItems(inventoryDate));
        } catch (refreshError) {
          console.error(refreshError);
        }
      }
      setError(
        completed
          ? `${completed} transaction${completed === 1 ? " was" : "s were"} saved before processing stopped. Only the unsaved rows remain below. ${detail}`
          : detail,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-slate-100 p-4 dark:bg-background">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
        className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card"
      >
        <header className="min-w-0 shrink-0 border-b px-4 py-3">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Breeder / Dispatch
              </div>
              <h1 className="text-lg font-semibold">
                {isReadOnly
                  ? "View Breeder Dispatch"
                  : isEditingDraft
                    ? "Continue Breeder Dispatch"
                    : "Breeder Multiple Dispatch"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isViewing
                  ? `${viewDocumentNo || "Loading dispatch"}${viewStatus ? ` · ${viewStatus}` : ""}`
                  : "Enter and save several dispatch transactions in one tabular worksheet."}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/jmb/breederdispatch")}
                disabled={saving}
              >
                <X className="size-4" />
                {isReadOnly ? "Close" : "Cancel"}
              </Button>
              {!isReadOnly ? <><Button
                type="submit"
                variant="outline"
                disabled={saving || loading || loadingItems}
              >
                <Save className="size-4" />
                Save drafts
              </Button>
              <Button
                type="button"
                onClick={() => void save(true)}
                disabled={saving || loading || loadingItems}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {isEditingDraft ? "Post dispatch" : "Post multiple"}
              </Button></> : null}
            </div>
          </div>
        </header>

        <fieldset
          disabled={loading || loadingItems || saving || isReadOnly}
          className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto bg-slate-50/60 p-4 dark:bg-background/40"
        >
          <div className="mx-auto w-full min-w-0 max-w-[1900px] space-y-4">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <section className="w-full min-w-0 max-w-full rounded-lg border bg-white p-4 shadow-sm dark:bg-card">
              <div className="mb-4 flex items-start gap-2">
                <Bird className="mt-0.5 size-4" />
                <div>
                  <h2 className="text-sm font-medium">Transaction header</h2>
                  <p className="text-xs text-muted-foreground">
                    The breeder farm applies to every transaction row below.
                  </p>
                </div>
              </div>
              <div className="max-w-3xl min-w-0">
                <div className="min-w-0 space-y-2">
                  <Label required>Breeder farm</Label>
                  <SearchableCombobox
                    items={farms.map((farm) => ({
                      code: String(farm.farm_id),
                      name: farm.farm_code
                        ? `${farm.farm_code} - ${farm.farm_name}`
                        : farm.farm_name,
                    }))}
                    value={farmId}
                    onValueChange={(value) => {
                      setFarmId(value);
                      resetSources();
                    }}
                    placeholder="Select farm"
                    showCode
                    className="w-full min-w-0 max-w-full"
                  />
                </div>
              </div>
            </section>

            <section className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
              <div className="flex min-w-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-medium">Dispatch transactions</h2>
                  <p className="text-xs text-muted-foreground">
                    {isViewing
                      ? isEditingDraft
                        ? "Continue editing this draft dispatch transaction."
                        : "Saved transaction lines for this breeder dispatch document."
                      : "Each table row creates one breeder dispatch document. Right-click an editable cell and choose Copy down to fill the rows below."}
                  </p>
                </div>
                {!isReadOnly ? <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    setRows((current) => [
                      ...current,
                      emptyRow(current.at(-1)?.dispatch_date),
                    ])
                  }
                >
                  <ListPlus className="size-4" />
                  Add row
                </Button> : null}
              </div>
              <div className="max-h-[520px] w-full min-w-0 max-w-full overflow-auto bg-white dark:bg-card">
                <table style={{ minWidth: tableWidth, width: tableWidth }} className="fc-grid-table table-fixed border-separate border-spacing-0 caption-bottom text-sm">
                  <colgroup>
                    {DISPATCH_GRID_COLUMNS.map((column, index) => <col key={column.key} style={{ width: columnWidths[index] ?? column.width }} />)}
                  </colgroup>
                  <thead>
                    <tr style={{ height: 36 }}>
                      {DISPATCH_GRID_COLUMNS.map((column, index) => (
                        <th
                          key={column.key}
                          scope="col"
                          style={index === 1 ? { left: 50 } : undefined}
                          className={`fc-grid-header fc-grid-header-border fc-grid-border-r sticky top-0 px-1 text-center text-xs font-semibold leading-tight ${index === 0 ? "left-0 z-40" : index === 1 ? "z-40 fc-grid-age-header" : "z-30"}`}
                        >
                          {column.label}
                          {column.resizable ? <button type="button" aria-label={`Resize ${column.label} column`} title="Drag to resize column" className="absolute right-0 top-0 z-50 h-full w-2 cursor-col-resize touch-none border-r-2 border-transparent hover:border-primary focus-visible:border-primary focus-visible:outline-none" onPointerDown={(event) => startColumnResize(index, event)} /> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => {
                      const buildingOptions = [
                        ...new Map(
                          farmItems
                            .filter(
                              (item) =>
                                item.source_date.slice(0, 10) <=
                                row.dispatch_date,
                            )
                            .map((item) => [buildingValue(item), item]),
                        ).values(),
                      ].sort((left, right) =>
                        left.building_name.localeCompare(
                          right.building_name,
                          undefined,
                          { numeric: true },
                        ),
                      );
                      const availableSources = new Set(
                        farmItems
                          .filter(
                            (item) =>
                              buildingValue(item) === row.building_id &&
                              item.source_date.slice(0, 10) <=
                                row.dispatch_date,
                          )
                          .map((item) => item.source_type),
                      );
                      const availableCategories = new Set(
                        farmItems
                          .filter(
                            (item) =>
                              buildingValue(item) === row.building_id &&
                              item.source_type === row.source_type &&
                              item.source_date.slice(0, 10) <=
                                row.dispatch_date,
                          )
                          .map((item) => item.category),
                      );
                      const categoryOptions = (
                        row.source_type === "Population Record"
                          ? POPULATION_CATEGORIES
                          : row.source_type === "Egg Laying"
                            ? EGG_CATEGORIES
                            : []
                      ).filter(([category]) =>
                        availableCategories.has(category),
                      );
                      const available = availableFor(row);
                      const divider =
                        rowIndex % 5 === 4
                          ? "fc-grid-row-divider-strong"
                          : "fc-grid-row-divider";
                      const editableCell = `fc-grid-cell fc-grid-cell-editable fc-grid-border-r p-0 ${divider}`;
                      const inputClass =
                        "h-8 min-w-0 rounded-none border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0";
                      const selectClass =
                        "h-8 w-full min-w-0 border-0 bg-transparent px-1 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50";
                      return (
                        <tr
                          key={row.id}
                          data-copy-down-row={rowIndex}
                          className="fc-grid-row border-0"
                        >
                          <td
                            className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r sticky left-0 z-20 p-0 text-center font-semibold tabular-nums ${divider}`}
                          >
                            <div className="flex h-8 items-center justify-center">
                              {rowIndex + 1}
                            </div>
                          </td>
                          <TableCopyDownCell
                            style={{ left: 50, position: "sticky" }}
                            className={`${editableCell} z-20`}
                            {...copyCellProps(rowIndex, "dispatch_date")}
                          >
                            <Input
                              aria-label={`Row ${rowIndex + 1} Dispatch Date`}
                              className={`${inputClass} w-full max-w-full text-center`}
                              type="date"
                              value={row.dispatch_date}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "dispatch_date",
                                  event.target.value,
                                )
                              }
                            />
                          </TableCopyDownCell>
                          <TableCopyDownCell
                            className={editableCell}
                            {...copyCellProps(rowIndex, "building_id")}
                          >
                            <select
                              data-fc-cell="true"
                              aria-label={`Row ${rowIndex + 1} Building`}
                              className={selectClass}
                              value={row.building_id}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "building_id",
                                  event.target.value,
                                )
                              }
                            >
                              <option value="">Select building</option>
                              {buildingOptions.map((building) => (
                                <option
                                  key={buildingValue(building)}
                                  value={buildingValue(building)}
                                >
                                  {building.building_name ||
                                    "Unassigned building"}
                                </option>
                              ))}
                            </select>
                          </TableCopyDownCell>
                          <TableCopyDownCell
                            className={editableCell}
                            {...copyCellProps(rowIndex, "source_type")}
                          >
                            <select
                              data-fc-cell="true"
                              aria-label={`Row ${rowIndex + 1} Data Source`}
                              className={selectClass}
                              value={row.source_type}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "source_type",
                                  event.target.value,
                                )
                              }
                              disabled={!row.building_id}
                            >
                              <option value="">Select source</option>
                              {availableSources.has("Population Record") ? (
                                <option value="Population Record">
                                  Population Record
                                </option>
                              ) : null}
                              {availableSources.has("Egg Laying") ? (
                                <option value="Egg Laying">Egg Laying</option>
                              ) : null}
                            </select>
                          </TableCopyDownCell>
                          <TableCopyDownCell
                            className={editableCell}
                            {...copyCellProps(rowIndex, "category")}
                          >
                            <select
                              data-fc-cell="true"
                              aria-label={`Row ${rowIndex + 1} Category`}
                              className={selectClass}
                              value={row.category}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "category",
                                  event.target.value,
                                )
                              }
                              disabled={!row.building_id || !row.source_type}
                            >
                              <option value="">Select category</option>
                              {categoryOptions.map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </TableCopyDownCell>
                          <TableCopyDownCell
                            className={editableCell}
                            {...copyCellProps(rowIndex, "production_from_date")}
                          >
                            <Input
                              aria-label={`Row ${rowIndex + 1} From Production Date`}
                              className={`${inputClass} text-center`}
                              type="date"
                              max={row.production_to_date || row.dispatch_date}
                              value={row.production_from_date}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "production_from_date",
                                  event.target.value,
                                )
                              }
                              disabled={!row.category}
                            />
                          </TableCopyDownCell>
                          <TableCopyDownCell
                            className={editableCell}
                            {...copyCellProps(rowIndex, "production_to_date")}
                          >
                            <Input
                              aria-label={`Row ${rowIndex + 1} To Production Date`}
                              className={`${inputClass} text-center`}
                              type="date"
                              min={row.production_from_date || undefined}
                              max={row.dispatch_date}
                              value={row.production_to_date}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "production_to_date",
                                  event.target.value,
                                )
                              }
                              disabled={!row.category}
                            />
                          </TableCopyDownCell>
                          <td
                            className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 text-center font-semibold tabular-nums ${divider}`}
                          >
                            <div className="flex h-8 items-center justify-center">
                              {available.toLocaleString()}
                            </div>
                          </td>
                          <TableCopyDownCell
                            className={editableCell}
                            {...copyCellProps(rowIndex, "dispatch_qty")}
                          >
                            <Input
                              aria-label={`Row ${rowIndex + 1} Dispatch Quantity`}
                              className={`${inputClass} [appearance:textfield] text-center tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                              type="number"
                              min="1"
                              max={available || undefined}
                              step="1"
                              value={row.dispatch_qty}
                              onFocus={(event) => event.target.select()}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "dispatch_qty",
                                  event.target.value,
                                )
                              }
                              placeholder="0"
                            />
                          </TableCopyDownCell>
                          <TableCopyDownCell
                            className={editableCell}
                            {...copyCellProps(rowIndex, "destination")}
                          >
                            <select
                              data-fc-cell="true"
                              aria-label={`Row ${rowIndex + 1} Destination Transfer`}
                              className={selectClass}
                              value={row.destination}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "destination",
                                  event.target.value,
                                )
                              }
                            >
                              <option value="">Select destination</option>
                              {destinationOptions.map((option) => (
                                <option
                                  key={`${option.value}:${option.label}`}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                              <option value={WALK_IN_DESTINATION}>
                                Walk-in Customer
                              </option>
                            </select>
                          </TableCopyDownCell>
                          <TableCopyDownCell
                            className={
                              row.destination === WALK_IN_DESTINATION
                                ? editableCell
                                : `fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 ${divider}`
                            }
                            {...copyCellProps(rowIndex, "customer_name")}
                          >
                            <Input
                              aria-label={`Row ${rowIndex + 1} Customer Name`}
                              className={inputClass}
                              value={row.customer_name}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "customer_name",
                                  event.target.value,
                                )
                              }
                              disabled={row.destination !== WALK_IN_DESTINATION}
                              placeholder={
                                row.destination === WALK_IN_DESTINATION
                                  ? "Required"
                                  : "Farm transfer"
                              }
                              maxLength={150}
                            />
                          </TableCopyDownCell>
                          <TableCopyDownCell
                            className={editableCell}
                            {...copyCellProps(rowIndex, "dr_no")}
                          >
                            <Input
                              aria-label={`Row ${rowIndex + 1} TS/DR Number`}
                              className={inputClass}
                              value={row.dr_no}
                              onChange={(event) =>
                                updateRow(row.id, "dr_no", event.target.value)
                              }
                              placeholder="TS/DR #"
                              maxLength={100}
                            />
                          </TableCopyDownCell>
                          <TableCopyDownCell
                            className={editableCell}
                            {...copyCellProps(rowIndex, "hauler_name")}
                          >
                            <Input
                              aria-label={`Row ${rowIndex + 1} Hauler`}
                              className={inputClass}
                              value={row.hauler_name}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "hauler_name",
                                  event.target.value,
                                )
                              }
                            />
                          </TableCopyDownCell>
                          <TableCopyDownCell
                            className={editableCell}
                            {...copyCellProps(rowIndex, "plate_number")}
                          >
                            <Input
                              aria-label={`Row ${rowIndex + 1} Plate Number`}
                              className={inputClass}
                              value={row.plate_number}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "plate_number",
                                  event.target.value,
                                )
                              }
                            />
                          </TableCopyDownCell>
                          <TableCopyDownCell
                            className={editableCell}
                            {...copyCellProps(rowIndex, "truck_seal")}
                          >
                            <Input
                              aria-label={`Row ${rowIndex + 1} Truck Seal`}
                              className={inputClass}
                              value={row.truck_seal}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "truck_seal",
                                  event.target.value,
                                )
                              }
                            />
                          </TableCopyDownCell>
                          <TableCopyDownCell
                            className={editableCell}
                            {...copyCellProps(rowIndex, "remarks")}
                          >
                            <Input
                              aria-label={`Row ${rowIndex + 1} Remarks`}
                              className={inputClass}
                              value={row.remarks}
                              onChange={(event) =>
                                updateRow(row.id, "remarks", event.target.value)
                              }
                              maxLength={250}
                            />
                          </TableCopyDownCell>
                          <td
                            className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 text-center ${divider}`}
                          >
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Remove row ${rowIndex + 1}`}
                              disabled={rows.length === 1}
                              onClick={() =>
                                setRows((current) =>
                                  current.filter(
                                    (currentRow) => currentRow.id !== row.id,
                                  ),
                                )
                              }
                              className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="fc-grid-footer-cell sticky bottom-0 left-0 z-40 h-9 text-center font-semibold">
                        #
                      </td>
                      <td
                        style={{ left: 50 }}
                        className="fc-grid-footer-cell fc-grid-footer-age sticky bottom-0 z-40 px-2 text-left text-xs font-semibold"
                      >
                        {rows.length} row{rows.length === 1 ? "" : "s"}
                      </td>
                      <td
                        colSpan={6}
                        className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0 px-2 text-left text-xs font-semibold"
                      >
                        Total Dispatch Quantity
                      </td>
                      <td className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0 text-center font-semibold tabular-nums">
                        {rows
                          .reduce(
                            (sum, row) => sum + quantity(row.dispatch_qty),
                            0,
                          )
                          .toLocaleString()}
                      </td>
                      <td
                        colSpan={8}
                        className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0"
                      />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
