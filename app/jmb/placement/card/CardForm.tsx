"use client";

import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import type { Placement } from "../new/api";
import {
  getPlacement,
  listDailyPerformance,
  listFeedTypes,
  listPlacementPens,
  saveDailyPerformance,
  type BreederDailyPerformance,
  type FeedType,
} from "./api";
import BreederCardExportMenu, {
  BREEDER_IMPORT_HEADERS,
  type BreederImportRow,
} from "./BreederCardExportMenu";
import { createBreederTransfer, loadBreederTransfers, type TransferPlacement } from "../transfer/api";

type EditableRow = Omit<
  BreederDailyPerformance,
  "id" | "created_at" | "created_by" | "updated_at" | "updated_by"
> & { id?: number };

type TransferModalState = {
  transfer_date: string;
  destination_placement_id: string;
  male_qty: string;
  female_qty: string;
  reason: string;
  remarks: string;
};

type NumericKey = keyof Pick<
  EditableRow,
  | "inv_male" | "inv_female" | "mc_male" | "mc_female"
  | "cull_male" | "cull_female" | "trans_in_male" | "trans_in_female"
  | "trans_out_male" | "trans_out_female" | "kitchen_male" | "kitchen_female"
  | "condem_male" | "condem_female" | "avg_body_weight_male"
  | "avg_body_weight_female" | "feed_consumption_male"
  | "feed_consumption_female"
>;

const gridColumnByField: Partial<Record<NumericKey, number>> = {
  mc_male: 0,
  mc_female: 1,
  cull_male: 2,
  cull_female: 3,
  trans_in_male: 4,
  trans_in_female: 5,
  trans_out_male: 6,
  trans_out_female: 7,
  kitchen_male: 8,
  kitchen_female: 9,
  condem_male: 10,
  condem_female: 11,
  avg_body_weight_male: 12,
  avg_body_weight_female: 13,
};

type FeedTypeKey = "male_feedtype_id" | "female_feedtype_id";
type PopulationPasteColumn =
  | { kind: "numeric"; field: NumericKey }
  | { kind: "feedType"; field: FeedTypeKey }
  | { kind: "locked" };

const populationPasteColumns: PopulationPasteColumn[] = [
  { kind: "numeric", field: "mc_male" },
  { kind: "numeric", field: "mc_female" },
  { kind: "numeric", field: "cull_male" },
  { kind: "numeric", field: "cull_female" },
  { kind: "locked" },
  { kind: "locked" },
  { kind: "locked" },
  { kind: "locked" },
  { kind: "numeric", field: "kitchen_male" },
  { kind: "numeric", field: "kitchen_female" },
  { kind: "numeric", field: "condem_male" },
  { kind: "numeric", field: "condem_female" },
  { kind: "numeric", field: "avg_body_weight_male" },
  { kind: "numeric", field: "avg_body_weight_female" },
  { kind: "numeric", field: "feed_consumption_male" },
  { kind: "feedType", field: "male_feedtype_id" },
  { kind: "numeric", field: "feed_consumption_female" },
  { kind: "feedType", field: "female_feedtype_id" },
];

const gridInputClass = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const PERIOD_DAYS = 30;

const zeroFields = {
  mc_male: 0,
  mc_female: 0,
  cull_male: 0,
  cull_female: 0,
  trans_in_male: 0,
  trans_in_female: 0,
  trans_out_male: 0,
  trans_out_female: 0,
  kitchen_male: 0,
  kitchen_female: 0,
  condem_male: 0,
  condem_female: 0,
  avg_body_weight_male: 0,
  avg_body_weight_female: 0,
  feed_consumption_male: 0,
  feed_consumption_female: 0,
};

const dailyEntryFields = Object.keys(zeroFields) as Array<keyof typeof zeroFields>;

function hasDailyRecord(row: EditableRow) {
  return row.id != null
    || dailyEntryFields.some((field) => Number(row[field]) !== 0)
    || row.male_feedtype_id != null
    || row.female_feedtype_id != null;
}

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
}

function count(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("en-PH", { maximumFractionDigits: 3 });
}

function parseClipboardGrid(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line, index, lines) => line !== "" || index < lines.length - 1)
    .map((line) => line.split("\t").map((value) => value.trim()));
}

function placementInventory(placement: Placement | null, sex: "male" | "female") {
  if (!placement) return 0;
  return sex === "male"
    ? Number(placement.m_endingbalance ?? placement.m_beg - placement.m_doa - placement.m_reject - placement.m_shortcount)
    : Number(placement.f_endingbalance ?? placement.f_beg - placement.f_doa - placement.f_reject - placement.f_shortcount);
}

function ageOn(placementDate: string | undefined, recordDate: string) {
  if (!placementDate || !recordDate) return 1;
  const start = Date.parse(`${placementDate}T00:00:00Z`);
  const end = Date.parse(`${recordDate}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(1, Math.floor((end - start) / 86_400_000) + 1)
    : 1;
}

function liveInventory(row: EditableRow | undefined, sex: "male" | "female") {
  if (!row) return 0;
  return sex === "male"
    ? row.inv_male + row.trans_in_male - row.mc_male - row.cull_male - row.trans_out_male - row.kitchen_male - row.condem_male
    : row.inv_female + row.trans_in_female - row.mc_female - row.cull_female - row.trans_out_female - row.kitchen_female - row.condem_female;
}

function buildDailyRows(
  placement: Placement,
  savedRows: BreederDailyPerformance[] = [],
) {
  const savedByDate = new Map(savedRows.map((row) => [row.daterec, row]));
  const lastSavedDay = savedRows.reduce(
    (latest, row) => Math.max(latest, ageOn(placement.placement_date, row.daterec)),
    0,
  );
  const rowCount = Math.max(PERIOD_DAYS, Math.ceil(lastSavedDay / PERIOD_DAYS) * PERIOD_DAYS);
  const sourceRows = Array.from({ length: rowCount }, (_, age): EditableRow => {
    const daterec = addDays(placement.placement_date, age);
    const saved = savedByDate.get(daterec);
    return {
      ...(saved ?? {
        placement_id: placement.id,
        daterec,
        inv_male: 0,
        inv_female: 0,
        ...zeroFields,
        male_feedtype_id: null,
        female_feedtype_id: null,
        isactive: true,
      }),
      inv_male: 0,
      inv_female: 0,
    };
  });
  return recalculateInventories(placement, sourceRows);
}

function recalculateInventories(placement: Placement, sourceRows: EditableRow[]) {
  let maleInventory = placementInventory(placement, "male");
  let femaleInventory = placementInventory(placement, "female");

  return sourceRows.map((sourceRow) => {
    const row = {
      ...sourceRow,
      inv_male: maleInventory,
      inv_female: femaleInventory,
    };
    maleInventory = liveInventory(row, "male");
    femaleInventory = liveInventory(row, "female");
    return row;
  });
}

function negativeInventoryMessage(sourceRows: EditableRow[]) {
  const index = sourceRows.findIndex(
    (row) => liveInventory(row, "male") < 0 || liveInventory(row, "female") < 0,
  );
  if (index < 0) return "";
  const row = sourceRows[index];
  const sex = liveInventory(row, "male") < 0 ? "Male" : "Female";
  return `${sex} inventory cannot be below zero on ${row.daterec}.`;
}

function summarizeDailyRows(sourceRows: EditableRow[]) {
  return sourceRows.reduce((total, row) => ({
    mcFemale: total.mcFemale + row.mc_female,
    cullFemale: total.cullFemale + row.cull_female,
    inFemale: total.inFemale + row.trans_in_female,
    outFemale: total.outFemale + row.trans_out_female,
    kitchenFemale: total.kitchenFemale + row.kitchen_female,
    condemFemale: total.condemFemale + row.condem_female,
    feedFemale: total.feedFemale + row.feed_consumption_female,
    mcMale: total.mcMale + row.mc_male,
    cullMale: total.cullMale + row.cull_male,
    inMale: total.inMale + row.trans_in_male,
    outMale: total.outMale + row.trans_out_male,
    kitchenMale: total.kitchenMale + row.kitchen_male,
    condemMale: total.condemMale + row.condem_male,
    feedMale: total.feedMale + row.feed_consumption_male,
  }), {
    mcFemale: 0, cullFemale: 0, inFemale: 0, outFemale: 0, kitchenFemale: 0, condemFemale: 0, feedFemale: 0,
    mcMale: 0, cullMale: 0, inMale: 0, outMale: 0, kitchenMale: 0, condemMale: 0, feedMale: 0,
  });
}

function headerClass(groupEnd = false) {
  return `fc-grid-header fc-grid-header-border sticky z-30 px-2 py-0 text-center text-xs font-semibold ${groupEnd ? "fc-grid-group-divider" : "fc-grid-border-r"}`;
}

export default function CardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placementId = Number(searchParams.get("placementId"));
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [penPlacements, setPenPlacements] = useState<Placement[]>([]);
  const [feedTypes, setFeedTypes] = useState<FeedType[]>([]);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [periodIndex, setPeriodIndex] = useState(0);
  const [headerOpen, setHeaderOpen] = useState(true);
  const [explicitZeroCells, setExplicitZeroCells] = useState<Set<string>>(() => new Set());
  const [transferModal, setTransferModal] = useState<TransferModalState | null>(null);
  const [transferPlacements, setTransferPlacements] = useState<TransferPlacement[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const gridRef = useRef<HTMLTableElement>(null);

  function numericCellKey(rowIndex: number, field: NumericKey) {
    return `${rowIndex}:${field}`;
  }

  function updateNumericCell(rowIndex: number, field: NumericKey, rawValue: string) {
    if (field.includes("feed_consumption") && !/^\d*(?:\.\d{0,2})?$/.test(rawValue)) return;
    const parsedValue = rawValue === "" ? 0 : Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) return;
    const cellKey = numericCellKey(rowIndex, field);
    setExplicitZeroCells((current) => {
      const next = new Set(current);
      if (rawValue !== "" && parsedValue === 0) next.add(cellKey);
      else next.delete(cellKey);
      return next;
    });
    updateRow(rowIndex, field, parsedValue);
  }

  function focusGridCell(rowIndex: number, columnIndex: number) {
    const element = gridRef.current?.querySelector<HTMLElement>(
      `[data-pop-row="${rowIndex}"][data-pop-column="${columnIndex}"]:not(:disabled)`,
    );
    if (!element) return false;
    element.focus();
    if (element instanceof HTMLInputElement) element.select();
    return true;
  }

  function moveGridFocus(rowIndex: number, columnIndex: number, rowStep: number, columnStep: number) {
    let nextRow = rowIndex + rowStep;
    let nextColumn = columnIndex + columnStep;
    if (columnStep !== 0) {
      if (nextColumn > 17) { nextColumn = 0; nextRow += 1; }
      if (nextColumn < 0) { nextColumn = 17; nextRow -= 1; }
    }
    while (nextRow >= 0 && nextRow < rows.length) {
      if (focusGridCell(nextRow, nextColumn)) return;
      if (columnStep !== 0) {
        nextColumn += columnStep;
        if (nextColumn > 17) { nextColumn = 0; nextRow += 1; }
        if (nextColumn < 0) { nextColumn = 17; nextRow -= 1; }
      } else {
        nextRow += rowStep;
      }
    }
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLElement>, rowIndex: number, columnIndex: number) {
    const movements: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      Enter: [event.shiftKey ? -1 : 1, 0],
      Tab: [0, event.shiftKey ? -1 : 1],
    };
    const movement = movements[event.key];
    if (!movement) return;
    event.preventDefault();
    moveGridFocus(rowIndex, columnIndex, movement[0], movement[1]);
  }

  function handleGridPaste(
    event: ClipboardEvent<HTMLElement>,
    startRowIndex: number,
    startColumnIndex: number,
  ) {
    if (!placement) return;
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;

    event.preventDefault();
    const pastedRows = parseClipboardGrid(text);
    if (!pastedRows.length) return;

    const nextRows = rows.map((row) => ({ ...row }));
    const nextExplicitZeroCells = new Set(explicitZeroCells);
    const feedTypeLabels = new Map<number, string>();
    feedTypes.forEach((feedType) => {
      feedTypeLabels.set(feedType.id, String(feedType.description ?? "").trim().toLocaleLowerCase());
    });
    let changedCellCount = 0;
    let skippedLockedCellCount = 0;
    let invalidCellCount = 0;

    pastedRows.forEach((pastedRow, pastedRowIndex) => {
      const targetRowIndex = startRowIndex + pastedRowIndex;
      const targetRow = nextRows[targetRowIndex];
      if (!targetRow) return;

      const rowAge = ageOn(placement.placement_date, targetRow.daterec);
      const hasLeadingAgeCell = pastedRow.length > 1 && String(pastedRow[0] ?? "").trim() === String(rowAge);
      const rowValues = hasLeadingAgeCell ? pastedRow.slice(1) : pastedRow;
      const rowStartColumnIndex = hasLeadingAgeCell ? 0 : startColumnIndex;

      rowValues.forEach((rawValue, pastedColumnIndex) => {
        const targetColumnIndex = rowStartColumnIndex + pastedColumnIndex;
        const column = populationPasteColumns[targetColumnIndex];
        if (!column) return;
        if (targetRow.daterec > localDate() || column.kind === "locked") {
          skippedLockedCellCount += 1;
          return;
        }

        if (column.kind === "numeric") {
          const normalizedValue = rawValue.replace(/,/g, "").trim();
          if (column.field.includes("feed_consumption") && !/^\d*(?:\.\d{0,2})?$/.test(normalizedValue)) {
            invalidCellCount += 1;
            return;
          }
          const parsedValue = normalizedValue === "" ? 0 : Number(normalizedValue);
          if (!Number.isFinite(parsedValue) || parsedValue < 0) {
            invalidCellCount += 1;
            return;
          }
          targetRow[column.field] = parsedValue;
          const cellKey = numericCellKey(targetRowIndex, column.field);
          if (normalizedValue !== "" && parsedValue === 0) nextExplicitZeroCells.add(cellKey);
          else nextExplicitZeroCells.delete(cellKey);
          changedCellCount += 1;
          return;
        }

        const normalizedFeedType = rawValue.trim().toLocaleLowerCase();
        if (!normalizedFeedType) {
          targetRow[column.field] = null;
          changedCellCount += 1;
          return;
        }
        const numericFeedTypeId = Number(normalizedFeedType);
        const matchingFeedType = feedTypes.find((feedType) =>
          (Number.isInteger(numericFeedTypeId) && feedType.id === numericFeedTypeId)
          || feedTypeLabels.get(feedType.id) === normalizedFeedType
          || `${feedTypeLabels.get(feedType.id)}${feedType.uom ? ` (${feedType.uom})` : ""}`.toLocaleLowerCase() === normalizedFeedType
        );
        if (!matchingFeedType) {
          invalidCellCount += 1;
          return;
        }
        targetRow[column.field] = matchingFeedType.id;
        changedCellCount += 1;
      });
    });

    if (!changedCellCount) {
      toast.error(
        invalidCellCount > 0
          ? "No cells were pasted because the copied values are invalid."
          : skippedLockedCellCount > 0
            ? "Pasted cells are locked or dated in the future."
            : "No editable cells found in pasted data.",
      );
      return;
    }

    const recalculatedRows = recalculateInventories(placement, nextRows);
    const inventoryError = negativeInventoryMessage(recalculatedRows);
    if (inventoryError) {
      toast.error(inventoryError);
      return;
    }

    setRows(recalculatedRows);
    setExplicitZeroCells(nextExplicitZeroCells);
    const notes = [
      invalidCellCount ? `${invalidCellCount} invalid skipped` : "",
      skippedLockedCellCount ? `${skippedLockedCellCount} locked skipped` : "",
    ].filter(Boolean);
    toast.success(`Pasted ${changedCellCount} cell${changedCellCount === 1 ? "" : "s"}${notes.length ? `. ${notes.join(", ")}.` : "."}`);
  }

  useEffect(() => { refreshSessionx(router); }, [router]);

  useEffect(() => {
    let cancelled = false;
    if (!Number.isInteger(placementId) || placementId <= 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getPlacement(placementId)
      .then(async (placementRow) => {
        const [dailyRows, feedRows, penRows] = await Promise.all([
          listDailyPerformance(placementId),
          listFeedTypes(),
          listPlacementPens(placementRow),
        ]);
        if (cancelled) return;
        setPlacement(placementRow);
        setFeedTypes(feedRows);
        setPenPlacements(penRows);
        setRows(buildDailyRows(placementRow, dailyRows));
        const lastSavedDay = dailyRows.reduce(
          (latest, row) => Math.max(latest, ageOn(placementRow.placement_date, row.daterec)),
          0,
        );
        setPeriodIndex(Math.floor(Math.max(0, lastSavedDay - 1) / PERIOD_DAYS));
        setExplicitZeroCells(new Set());
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load breeder pen card."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [placementId]);

  const latest = rows.at(-1);
  const totals = useMemo(() => summarizeDailyRows(rows), [rows]);
  const cumulativeMortality = useMemo(() => {
    let male = 0;
    let female = 0;
    return rows.map((row) => {
      male += row.mc_male;
      female += row.mc_female;
      return { male, female };
    });
  }, [rows]);
  const periodStartIndex = periodIndex * PERIOD_DAYS;
  const visibleRows = useMemo(
    () => rows.slice(periodStartIndex, periodStartIndex + PERIOD_DAYS),
    [periodStartIndex, rows],
  );
  const periodTotals = useMemo(() => summarizeDailyRows(visibleRows), [visibleRows]);
  const exportRows = useMemo(() => {
    const feedTypeById = new Map(feedTypes.map((feedType) => [feedType.id, feedType.description ?? ""]));
    return visibleRows.map((row, visibleIndex) => {
      const index = periodStartIndex + visibleIndex;
      return {
      age: placement ? ageOn(placement.placement_date, row.daterec) : 1,
      date: row.daterec,
      values: [
        row.inv_male, row.inv_female,
        row.mc_male, row.mc_female,
        cumulativeMortality[index]?.male ?? 0, cumulativeMortality[index]?.female ?? 0,
        row.cull_male, row.cull_female,
        row.trans_in_male, row.trans_in_female,
        row.trans_out_male, row.trans_out_female,
        row.kitchen_male, row.kitchen_female,
        row.condem_male, row.condem_female,
        row.avg_body_weight_male, row.avg_body_weight_female,
        `${row.feed_consumption_male}${row.male_feedtype_id ? ` / ${feedTypeById.get(row.male_feedtype_id) ?? ""}` : ""}`,
        `${row.feed_consumption_female}${row.female_feedtype_id ? ` / ${feedTypeById.get(row.female_feedtype_id) ?? ""}` : ""}`,
      ],
    };
    });
  }, [cumulativeMortality, feedTypes, periodStartIndex, placement, visibleRows]);
  const templateRows = useMemo<BreederImportRow[]>(() => visibleRows.map((row) => ({
    daterec: row.daterec,
    inv_male: row.inv_male,
    inv_female: row.inv_female,
    mc_male: row.mc_male,
    mc_female: row.mc_female,
    cull_male: row.cull_male,
    cull_female: row.cull_female,
    trans_in_male: row.trans_in_male,
    trans_in_female: row.trans_in_female,
    trans_out_male: row.trans_out_male,
    trans_out_female: row.trans_out_female,
    kitchen_male: row.kitchen_male,
    kitchen_female: row.kitchen_female,
    condem_male: row.condem_male,
    condem_female: row.condem_female,
    avg_body_weight_male: row.avg_body_weight_male,
    avg_body_weight_female: row.avg_body_weight_female,
    feed_consumption_male: row.feed_consumption_male,
    feed_consumption_female: row.feed_consumption_female,
    male_feedtype_id: row.male_feedtype_id,
    female_feedtype_id: row.female_feedtype_id,
  })), [visibleRows]);

  function updateRow(index: number, key: keyof EditableRow, value: string | number | null) {
    if (!placement) return;
    const updated = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row);
    const recalculated = recalculateInventories(placement, updated);
    const inventoryError = negativeInventoryMessage(recalculated);
    if (inventoryError) {
      toast.error(inventoryError);
      return;
    }
    setRows(recalculated);
  }

  function showNextPeriod() {
    if (!placement) return;
    const nextPeriodIndex = periodIndex + 1;
    const requiredRowCount = (nextPeriodIndex + 1) * PERIOD_DAYS;
    setRows((current) => {
      if (current.length >= requiredRowCount) return current;
      const nextRows = [...current];
      while (nextRows.length < requiredRowCount) {
        nextRows.push({
          placement_id: placement.id,
          daterec: addDays(placement.placement_date, nextRows.length),
          inv_male: 0,
          inv_female: 0,
          ...zeroFields,
          male_feedtype_id: null,
          female_feedtype_id: null,
          isactive: true,
        });
      }
      return recalculateInventories(placement, nextRows);
    });
    setPeriodIndex(nextPeriodIndex);
  }

  async function save() {
    if (!placement || !rows.length) return;
    const inventoryError = negativeInventoryMessage(rows);
    if (inventoryError) {
      toast.error(inventoryError);
      return;
    }
    if (new Set(rows.map((row) => row.daterec)).size !== rows.length) {
      toast.error("Each record date must be unique on this placement card.");
      return;
    }
    setSaving(true);
    try {
      const eligibleRows = rows.filter((row) => row.daterec <= localDate());
      const saved = await Promise.all(eligibleRows.map((row) => saveDailyPerformance(row)));
      setRows(buildDailyRows(placement, saved));
      toast.success("Breeder pen card saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save breeder pen card.");
    } finally {
      setSaving(false);
    }
  }

  function normalizeImportedDate(value: unknown) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return localDate(value);
    if (typeof value === "number" && Number.isFinite(value)) {
      const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
      return date.toISOString().slice(0, 10);
    }
    const text = String(value ?? "").trim();
    if (!text) return "";
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return text;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? "" : localDate(date);
  }

  async function importExcel(file: File) {
    if (!placement) return;
    setImporting(true);
    try {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const sheets = await readXlsxFile(file);
      const sheet = sheets.find((candidate) => candidate.sheet === "Breeder Daily Performance");
      if (!sheet) {
        throw new Error('Required worksheet "Breeder Daily Performance" was not found. Download and use the current template.');
      }

      const excelRows = sheet.data;
      const rawHeaders = (excelRows[0] ?? []).map((value) => String(value ?? "").trim());
      if (rawHeaders.length !== BREEDER_IMPORT_HEADERS.length) {
        throw new Error(`Invalid field count. Expected exactly ${BREEDER_IMPORT_HEADERS.length} fields but found ${rawHeaders.length}.`);
      }
      const duplicateHeaders = rawHeaders.filter((header, index) => rawHeaders.indexOf(header) !== index);
      if (duplicateHeaders.length) throw new Error(`Duplicate field(s): ${Array.from(new Set(duplicateHeaders)).join(", ")}.`);
      const invalidHeaderIndex = BREEDER_IMPORT_HEADERS.findIndex((header, index) => rawHeaders[index] !== header);
      if (invalidHeaderIndex >= 0) {
        throw new Error(`Invalid field ${invalidHeaderIndex + 1}. Expected "${BREEDER_IMPORT_HEADERS[invalidHeaderIndex]}" but found "${rawHeaders[invalidHeaderIndex] || "blank"}".`);
      }

      const dataRows = excelRows.slice(1).filter((row) => row.some((value) => value != null && String(value).trim() !== ""));
      if (dataRows.length !== PERIOD_DAYS) {
        throw new Error(`The import must contain exactly ${PERIOD_DAYS} daily rows for the selected period; found ${dataRows.length}.`);
      }

      const errors: string[] = [];
      const validFeedTypeIds = new Set(feedTypes.map((feedType) => feedType.id));
      const integerFields = new Set<string>([
        "inv_male", "inv_female", "mc_male", "mc_female", "cull_male", "cull_female",
        "trans_in_male", "trans_in_female", "trans_out_male", "trans_out_female",
        "kitchen_male", "kitchen_female", "condem_male", "condem_female",
      ]);
      const nullableFeedFields = new Set<string>(["male_feedtype_id", "female_feedtype_id"]);
      const importedRows = dataRows.map((excelRow, index): EditableRow => {
        const rowNumber = index + 2;
        if (excelRow.slice(BREEDER_IMPORT_HEADERS.length).some((value) => value != null && String(value).trim() !== "")) {
          errors.push(`Row ${rowNumber}: contains data outside the exact ${BREEDER_IMPORT_HEADERS.length}-field template.`);
        }
        const targetIndex = periodStartIndex + index;
        const expectedDate = addDays(placement.placement_date, targetIndex);
        const daterec = normalizeImportedDate(excelRow[0]);
        if (daterec !== expectedDate) errors.push(`Row ${rowNumber}: daterec must be ${expectedDate} for Day ${targetIndex + 1}.`);
        const values: Record<string, number | null> = {};

        BREEDER_IMPORT_HEADERS.slice(1).forEach((field, fieldIndex) => {
          const raw = excelRow[fieldIndex + 1];
          if (nullableFeedFields.has(field)) {
            if (raw == null || String(raw).trim() === "") {
              values[field] = null;
              return;
            }
            const parsed = Number(raw);
            if (!Number.isInteger(parsed) || parsed <= 0 || !validFeedTypeIds.has(parsed)) {
              errors.push(`Row ${rowNumber}: ${field} must be blank or a valid active tbl_feedtype ID.`);
            }
            values[field] = parsed;
            return;
          }
          if (raw == null || String(raw).trim() === "") {
            errors.push(`Row ${rowNumber}: ${field} is required.`);
            values[field] = 0;
            return;
          }
          const parsed = Number(raw);
          if (!Number.isFinite(parsed) || parsed < 0 || (integerFields.has(field) && !Number.isInteger(parsed))) {
            errors.push(`Row ${rowNumber}: ${field} must be ${integerFields.has(field) ? "a whole number" : "a number"} zero or greater.`);
          }
          if (integerFields.has(field) && parsed > Number.MAX_SAFE_INTEGER) {
            errors.push(`Row ${rowNumber}: ${field} exceeds JavaScript's safe whole-number range.`);
          }
          if (!integerFields.has(field) && Number.isFinite(parsed)) {
            const decimalPlaces = String(raw).includes(".") ? String(raw).split(".")[1]?.length ?? 0 : 0;
            if (decimalPlaces > 3 || parsed >= 1_000_000_000) {
              errors.push(`Row ${rowNumber}: ${field} must fit numeric(12,3) with at most 3 decimal places.`);
            }
          }
          values[field] = Number.isFinite(parsed) ? parsed : 0;
        });

        const typed = values as Record<Exclude<(typeof BREEDER_IMPORT_HEADERS)[number], "daterec">, number | null>;
        const existingRow = rows[targetIndex];
        return {
          ...(existingRow?.id ? { id: existingRow.id } : {}),
          placement_id: placement.id,
          daterec: expectedDate,
          inv_male: Number(typed.inv_male), inv_female: Number(typed.inv_female),
          mc_male: Number(typed.mc_male), mc_female: Number(typed.mc_female),
          cull_male: Number(typed.cull_male), cull_female: Number(typed.cull_female),
          trans_in_male: Number(existingRow?.trans_in_male ?? 0), trans_in_female: Number(existingRow?.trans_in_female ?? 0),
          trans_out_male: Number(existingRow?.trans_out_male ?? 0), trans_out_female: Number(existingRow?.trans_out_female ?? 0),
          kitchen_male: Number(typed.kitchen_male), kitchen_female: Number(typed.kitchen_female),
          condem_male: Number(typed.condem_male), condem_female: Number(typed.condem_female),
          avg_body_weight_male: Number(typed.avg_body_weight_male), avg_body_weight_female: Number(typed.avg_body_weight_female),
          feed_consumption_male: Number(typed.feed_consumption_male), feed_consumption_female: Number(typed.feed_consumption_female),
          male_feedtype_id: typed.male_feedtype_id == null ? null : Number(typed.male_feedtype_id),
          female_feedtype_id: typed.female_feedtype_id == null ? null : Number(typed.female_feedtype_id),
          isactive: true,
        };
      });

      const validationRows = rows.map((row) => ({ ...row }));
      importedRows.forEach((row, index) => { validationRows[periodStartIndex + index] = row; });
      const recalculatedValidationRows = recalculateInventories(placement, validationRows);
      const inventoryError = negativeInventoryMessage(recalculatedValidationRows);
      if (inventoryError) errors.push(inventoryError);

      if (errors.length) throw new Error(errors.slice(0, 15).join("\n"));
      const today = localDate();
      setRows((current) => {
        const mergedRows = current.map((row) => ({ ...row }));
        importedRows.forEach((row, index) => {
          const targetIndex = periodStartIndex + index;
          if (row.daterec <= today) mergedRows[targetIndex] = row;
        });
        return recalculateInventories(placement, mergedRows);
      });
      const ignoredFutureCount = importedRows.filter((row) => row.daterec > today).length;
      toast.success(`Excel imported for Days ${periodStartIndex + 1}-${periodStartIndex + PERIOD_DAYS}.${ignoredFutureCount ? ` ${ignoredFutureCount} future rows were validated but left unchanged.` : ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to import the Excel file.", { duration: 10000 });
    } finally {
      setImporting(false);
    }
  }

  function renderNumericCell(
    row: EditableRow,
    rowIndex: number,
    field: NumericKey,
    groupEnd = false,
  ) {
    const decimal = field.includes("weight") || field.includes("consumption");
    const future = row.daterec > localDate();
    const readOnly = field === "inv_male" || field === "inv_female" || field.startsWith("trans_in_") || field.startsWith("trans_out_");
    const gridColumn = gridColumnByField[field];
    return (
      <td key={`${rowIndex}-${field}`} className={`fc-grid-cell ${future || readOnly ? "fc-grid-cell-readonly" : "fc-grid-cell-editable"} p-0 ${groupEnd ? "fc-grid-group-divider" : "fc-grid-border-r"} ${rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider"}`}>
        <Input
          type="number"
          min="0"
          step={decimal ? "0.001" : "1"}
          value={
            !readOnly && Number(row[field]) === 0 && !explicitZeroCells.has(numericCellKey(rowIndex, field))
              ? ""
              : row[field]
          }
          readOnly={readOnly}
          disabled={future}
          data-pop-row={!readOnly ? rowIndex : undefined}
          data-pop-column={!readOnly ? gridColumn : undefined}
          onKeyDown={!readOnly && gridColumn != null ? (event) => handleGridKeyDown(event, rowIndex, gridColumn) : undefined}
          onPaste={!readOnly && gridColumn != null ? (event) => handleGridPaste(event, rowIndex, gridColumn) : undefined}
          onChange={readOnly ? undefined : (event) => updateNumericCell(rowIndex, field, event.target.value)}
          className={`h-8 rounded-none border-0 bg-transparent text-center shadow-none focus-visible:ring-0 ${gridInputClass}`}
        />
      </td>
    );
  }

  function renderCumulativeCell(row: EditableRow, rowIndex: number, sex: "male" | "female", groupEnd = false) {
    const value = hasDailyRecord(row) ? cumulativeMortality[rowIndex]?.[sex] ?? 0 : "";
    return (
      <td key={`${rowIndex}-cumulative-${sex}`} className={`fc-grid-cell fc-grid-cell-readonly p-0 ${groupEnd ? "fc-grid-group-divider" : "fc-grid-border-r"} ${rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider"}`}>
        <Input
          value={value}
          readOnly
          tabIndex={-1}
          className="h-8 rounded-none border-0 bg-transparent text-center font-semibold tabular-nums shadow-none focus-visible:ring-0"
        />
      </td>
    );
  }

  async function openTransferModal(row: EditableRow) {
    if (!placement || row.daterec > localDate()) return;
    setTransferModal({
      transfer_date: row.daterec,
      destination_placement_id: "",
      male_qty: "",
      female_qty: "",
      reason: "",
      remarks: "",
    });
    setTransferLoading(true);
    try {
      const result = await loadBreederTransfers();
      setTransferPlacements(result.placements);
      if (!result.placements.some((item) => item.id === placement.id)) {
        toast.error("This source placement does not have an active breeder cycle.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load transfer destinations.");
      setTransferModal(null);
    } finally {
      setTransferLoading(false);
    }
  }

  async function postTransferFromModal() {
    if (!placement || !transferModal) return;
    const source = transferPlacements.find((item) => item.id === placement.id);
    const destination = transferPlacements.find((item) => String(item.id) === transferModal.destination_placement_id);
    const maleQty = Number(transferModal.male_qty || 0);
    const femaleQty = Number(transferModal.female_qty || 0);
    if (!source) { toast.error("The source placement is not active for transfer."); return; }
    if (!destination) { toast.error("Select a destination building and pen."); return; }
    if (transferModal.transfer_date < source.placement_date || transferModal.transfer_date < destination.placement_date) { toast.error("Transfer date cannot be earlier than either placement date."); return; }
    if (!Number.isInteger(maleQty) || !Number.isInteger(femaleQty) || maleQty < 0 || femaleQty < 0 || maleQty + femaleQty <= 0) { toast.error("Enter a positive whole-number male or female quantity."); return; }
    if (maleQty > source.male_available || femaleQty > source.female_available) { toast.error("Transfer quantity exceeds the source inventory."); return; }
    if (!transferModal.reason.trim()) { toast.error("Transfer reason is required."); return; }
    setTransferSaving(true);
    try {
      await createBreederTransfer({
        transfer_date: transferModal.transfer_date,
        source_placement_id: source.id,
        destination_placement_id: destination.id,
        male_qty: maleQty,
        female_qty: femaleQty,
        reason: transferModal.reason.trim(),
        remarks: transferModal.remarks.trim() || null,
      }, true);
      const refreshed = await listDailyPerformance(placement.id);
      setRows(buildDailyRows(placement, refreshed));
      setTransferModal(null);
      toast.success("Bird transfer posted to both Population Records.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to post bird transfer.");
    } finally {
      setTransferSaving(false);
    }
  }

  function renderFeedCell(
    row: EditableRow,
    rowIndex: number,
    sex: "male" | "female",
    groupEnd = false,
  ) {
    const future = row.daterec > localDate();
    const consumptionField: NumericKey = sex === "male" ? "feed_consumption_male" : "feed_consumption_female";
    const feedTypeField: "male_feedtype_id" | "female_feedtype_id" = sex === "male" ? "male_feedtype_id" : "female_feedtype_id";
    return (
      <td key={`${rowIndex}-feed-${sex}`} className={`fc-grid-cell ${future ? "fc-grid-cell-readonly" : "fc-grid-cell-editable"} p-0 ${groupEnd ? "fc-grid-group-divider" : "fc-grid-border-r"} ${rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider"}`}>
        <div className="flex h-8 items-stretch">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={
              Number(row[consumptionField]) === 0 && !explicitZeroCells.has(numericCellKey(rowIndex, consumptionField))
                ? ""
                : row[consumptionField]
            }
            disabled={future}
            data-pop-row={rowIndex}
            data-pop-column={sex === "male" ? 14 : 16}
            title="Feed consumption"
            onKeyDown={(event) => handleGridKeyDown(event, rowIndex, sex === "male" ? 14 : 16)}
            onPaste={(event) => handleGridPaste(event, rowIndex, sex === "male" ? 14 : 16)}
            onChange={(event) => updateNumericCell(rowIndex, consumptionField, event.target.value)}
            className={`h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent px-1 text-center shadow-none focus-visible:ring-0 ${gridInputClass}`}
          />
          <select
            value={row[feedTypeField] ?? ""}
            disabled={future}
            data-pop-row={rowIndex}
            data-pop-column={sex === "male" ? 15 : 17}
            title="Feed type"
            onKeyDown={(event) => handleGridKeyDown(event, rowIndex, sex === "male" ? 15 : 17)}
            onPaste={(event) => handleGridPaste(event, rowIndex, sex === "male" ? 15 : 17)}
            onChange={(event) => updateRow(rowIndex, feedTypeField, event.target.value ? Number(event.target.value) : null)}
            className="h-8 w-[52%] min-w-0 border-l bg-transparent px-1 text-[10px] outline-none disabled:cursor-not-allowed"
          >
            <option value="">Type</option>
            {feedTypes.map((feed) => <option key={feed.id} value={feed.id}>{feed.description}{feed.uom ? ` (${feed.uom})` : ""}</option>)}
          </select>
        </div>
      </td>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100 p-4 dark:bg-background">
        <div className="flex min-w-[280px] items-center gap-3 rounded-lg border bg-white px-5 py-4 text-sm font-medium text-muted-foreground shadow-sm dark:bg-card">
          <Loader2 className="size-5 animate-spin text-primary" /> Loading breeder pen card...
        </div>
      </div>
    );
  }

  if (!placement) {
    return <div className="m-4 rounded-md border p-6 text-sm text-destructive">Open the flock card from a valid breeder placement row.</div>;
  }

  const penLabel = placement.pen_no || `Pen ${placement.id}`;
  const placedTotal = placementInventory(placement, "female") + placementInventory(placement, "male");
  const liveFemale = liveInventory(latest, "female");
  const liveMale = liveInventory(latest, "male");
  const rowDivider = (rowIndex: number) => rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider";
  const transferSource = transferPlacements.find((item) => item.id === placement.id) ?? null;
  const transferDestination = transferPlacements.find((item) => String(item.id) === transferModal?.destination_placement_id) ?? null;
  const transferMinimumDate = [transferSource?.placement_date, transferDestination?.placement_date].filter(Boolean).sort().at(-1) ?? placement.placement_date;
  const transferLabel = (item: TransferPlacement) => `${item.building_no} - ${item.pen_no}`;
  const periodEndIndex = periodStartIndex + visibleRows.length;
  const periodFirstRow = visibleRows[0];
  const periodLastRow = visibleRows.at(-1);
  const periodClosingMale = liveInventory(periodLastRow, "male");
  const periodClosingFemale = liveInventory(periodLastRow, "female");
  const periodLatestRecord = [...visibleRows].reverse().find(hasDailyRecord) ?? periodLastRow;
  const periodEndCumulative = cumulativeMortality[Math.max(0, periodEndIndex - 1)] ?? { male: 0, female: 0 };
  const canShowNextPeriod = periodEndIndex < rows.length
    || addDays(placement.placement_date, periodEndIndex) <= localDate();

  return (
    <div className="h-screen w-full bg-slate-100 p-4 dark:bg-background">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
        <Collapsible open={headerOpen} onOpenChange={setHeaderOpen}>
          <CollapsibleContent className="overflow-visible">
            <div className="relative border-b bg-white px-4 pb-6 pt-3 dark:bg-card">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-semibold text-foreground">Population Record</h1>
                  <div className="mb-2 mt-1 text-xs font-semibold uppercase text-muted-foreground">Farm / Pen</div>
                  <div className="grid items-end gap-3 md:grid-cols-3">
                    <label className="block min-w-0">
                      <span className="text-xs font-medium text-muted-foreground">Farm</span>
                      <Input value={placement.farm_name || "-"} readOnly className="h-10 bg-[#fffdfb] dark:bg-input/30" />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-xs font-medium text-muted-foreground">Building</span>
                      <Input value={placement.building_no || "-"} readOnly className="h-10 bg-[#fffdfb] dark:bg-input/30" />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-xs font-medium text-muted-foreground">Pen</span>
                      <select
                        value={String(placement.id)}
                        onChange={(event) => router.replace(`/jmb/placement/card?placementId=${event.target.value}`)}
                        className="flex h-10 w-full rounded-md border border-input bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 dark:bg-background/60"
                      >
                        {penPlacements.map((pen) => (
                          <option key={pen.id} value={pen.id}>{pen.pen_no || `Pen ${pen.id}`}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
                  <Button type="button" variant="outline" onClick={() => router.push(`/jmb/placement/transfer?sourcePlacementId=${placement.id}`)}>
                    <ArrowLeftRight className="size-4" /> Transfer History
                  </Button>
                  <BreederCardExportMenu
                    farm={placement.farm_name || ""}
                    building={placement.building_no || ""}
                    pen={penLabel}
                    placementDate={placement.placement_date}
                    placedBirds={placedTotal}
                    liveBirds={periodClosingFemale + periodClosingMale}
                    rows={exportRows}
                    templateRows={templateRows}
                    importing={importing}
                    onImport={importExcel}
                  />
                  <Button type="button" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-stretch gap-2 border-t pt-3">
                <div className="w-[190px] rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
                  <div className="text-xs font-medium text-muted-foreground">Placement date</div>
                  <div className="text-sm font-semibold">{formatDate(placement.placement_date)}</div>
                </div>
                <div className="grid w-[328px] grid-cols-2 divide-x rounded-md border bg-slate-50 dark:bg-background/40">
                  <div className="px-3 py-2"><div className="text-xs font-medium text-muted-foreground">Placed birds</div><div className="text-base font-semibold tabular-nums">{count(placedTotal)}</div></div>
                  <div className="px-3 py-2"><div className="text-xs font-medium text-muted-foreground">Cycle #</div><div className="text-base font-semibold tabular-nums">{placement.cycle_no ?? "-"}</div></div>
                </div>
                <div className="w-[190px] rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
                  <div className="text-xs font-medium text-muted-foreground">Female live / Mortality</div>
                  <div className="text-sm font-semibold tabular-nums">{count(liveFemale)} / {count(totals.mcFemale)}</div>
                </div>
                <div className="w-[190px] rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
                  <div className="text-xs font-medium text-muted-foreground">Male live / Mortality</div>
                  <div className="text-sm font-semibold tabular-nums">{count(liveMale)} / {count(totals.mcMale)}</div>
                </div>
                <div className="w-[170px] rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
                  <div className="text-xs font-medium text-muted-foreground">Generated days</div>
                  <div className="text-sm font-semibold tabular-nums">{rows.length}</div>
                </div>
              </div>

              <Button type="button" variant="outline" size="icon-sm" onClick={() => setHeaderOpen(false)} title="Collapse header" className="absolute bottom-0 left-1/2 z-[60] -translate-x-1/2 translate-y-1/2 rounded-full border bg-white shadow-md dark:bg-card">
                <ChevronUp className="size-4" />
              </Button>
            </div>
          </CollapsibleContent>

          {!headerOpen ? (
            <div className="relative flex min-h-14 items-center gap-3 border-b bg-white px-4 pb-4 pt-2 dark:bg-card">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{placement.farm_name} &gt; {placement.building_no} &gt; {penLabel}</div>
                <div className="truncate text-xs text-muted-foreground">Placed {count(placedTotal)} | Cycle {placement.cycle_no ?? "-"} | Rows {rows.length}</div>
              </div>
              <BreederCardExportMenu
                farm={placement.farm_name || ""}
                building={placement.building_no || ""}
                pen={penLabel}
                placementDate={placement.placement_date}
                placedBirds={placedTotal}
                liveBirds={periodClosingFemale + periodClosingMale}
                rows={exportRows}
                templateRows={templateRows}
                importing={importing}
                onImport={importExcel}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => router.push(`/jmb/placement/transfer?sourcePlacementId=${placement.id}`)}><ArrowLeftRight className="size-4" /> Transfer History</Button>
              <Button type="button" size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save</Button>
              <Button type="button" variant="outline" size="icon-sm" onClick={() => setHeaderOpen(true)} title="Show header details" className="absolute bottom-0 left-1/2 z-[60] -translate-x-1/2 translate-y-1/2 rounded-full border bg-white shadow-md dark:bg-card">
                <ChevronDown className="size-4" />
              </Button>
            </div>
          ) : null}
        </Collapsible>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-2 dark:bg-background/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPeriodIndex((current) => Math.max(0, current - 1))}
            disabled={periodIndex === 0}
          >
            <ChevronLeft className="size-4" /> Previous 30 Days
          </Button>
          <div className="text-center">
            <div className="text-sm font-semibold">Days {periodStartIndex + 1}-{periodStartIndex + PERIOD_DAYS}</div>
            <div className="text-xs text-muted-foreground">
              {formatDate(periodFirstRow?.daterec)} – {formatDate(periodLastRow?.daterec)} · Inventory carries over from the previous period
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={showNextPeriod} disabled={!canShowNextPeriod}>
            Next 30 Days <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="relative flex-1 overflow-auto">
          <table ref={gridRef} className="fc-grid-table table-fixed border-separate border-spacing-0 caption-bottom text-sm" style={{ minWidth: 2228 }}>
            <colgroup>
              <col style={{ width: 132 }} /><col style={{ width: 52 }} />
              {[92, 92, 76, 76, 92, 92, 76, 76, 82, 82, 82, 82, 120, 82, 82, 82, 82, 100, 100, 180, 180].map((width, index) => <col key={index} style={{ width }} />)}
            </colgroup>
            <thead>
              <tr style={{ height: 28 }}>
                <th rowSpan={2} className="fc-grid-header fc-grid-header-border sticky left-0 top-0 z-40 text-center text-xs" style={{ minWidth: 132 }}>Date</th>
                <th rowSpan={2} className="fc-grid-header fc-grid-age-header fc-grid-header-border sticky left-[132px] top-0 z-40 text-center text-xs" style={{ minWidth: 52 }}>Age</th>
                {[
                  "Beginning Inventory (pc)", "Mortality (pc)", "Cumm Mortality (pc)", "Culls (pc)", "Transfer In (pc)",
                  "Transfer Out (pc)", "Kitchen (pc)", "Condem (pc)", "Grams/Birds (kg/pc)", "Feeds Consumption (kg)",
                ].map((label) => (
                  <th key={label} colSpan={label === "Transfer Out (pc)" ? 3 : 2} className={`${headerClass(true)} fc-grid-header-group capitalize`} style={{ top: 0 }}>{label}</th>
                ))}
              </tr>
              <tr style={{ height: 28 }}>
                {Array.from({ length: 10 }, (_, groupIndex) => (groupIndex === 5 ? ["Male", "Female", "Transfer"] : ["Male", "Female"]).map((label, columnIndex, labels) => (
                  <th key={`${groupIndex}-${label}`} className={headerClass(columnIndex === labels.length - 1)} style={{ top: 28 }}>{label}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, visibleRowIndex) => {
                const rowIndex = periodStartIndex + visibleRowIndex;
                return (
                <tr key={row.id ?? `new-${rowIndex}`} className="fc-grid-row border-0">
                  <td className={`fc-grid-age sticky left-0 z-20 p-0 text-center font-semibold ${rowDivider(rowIndex)}`} style={{ minWidth: 132 }}><Input type="date" value={row.daterec} readOnly disabled={row.daterec > localDate()} className="h-8 rounded-none border-0 bg-transparent px-1 text-center text-xs shadow-none focus-visible:ring-0 disabled:opacity-100" /></td>
                  <td className={`fc-grid-age sticky left-[132px] z-20 p-0 text-center font-semibold ${rowDivider(rowIndex)}`} style={{ minWidth: 52 }}><div className="flex h-8 items-center justify-center">{ageOn(placement.placement_date, row.daterec)}</div></td>
                  {renderNumericCell(row, rowIndex, "inv_male")}
                  {renderNumericCell(row, rowIndex, "inv_female", true)}
                  {renderNumericCell(row, rowIndex, "mc_male")}
                  {renderNumericCell(row, rowIndex, "mc_female", true)}
                  {renderCumulativeCell(row, rowIndex, "male")}
                  {renderCumulativeCell(row, rowIndex, "female", true)}
                  {renderNumericCell(row, rowIndex, "cull_male")}
                  {renderNumericCell(row, rowIndex, "cull_female", true)}
                  {renderNumericCell(row, rowIndex, "trans_in_male")}
                  {renderNumericCell(row, rowIndex, "trans_in_female", true)}
                  {renderNumericCell(row, rowIndex, "trans_out_male")}
                  {renderNumericCell(row, rowIndex, "trans_out_female", true)}
                  <td className={`fc-grid-cell fc-grid-cell-readonly p-0 text-center fc-grid-group-divider ${rowDivider(rowIndex)}`}>
                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" disabled={row.daterec > localDate()} onClick={() => void openTransferModal(row)}><ArrowLeftRight className="size-3.5" />Transfer</Button>
                  </td>
                  {renderNumericCell(row, rowIndex, "kitchen_male")}
                  {renderNumericCell(row, rowIndex, "kitchen_female", true)}
                  {renderNumericCell(row, rowIndex, "condem_male")}
                  {renderNumericCell(row, rowIndex, "condem_female", true)}
                  {renderNumericCell(row, rowIndex, "avg_body_weight_male")}
                  {renderNumericCell(row, rowIndex, "avg_body_weight_female", true)}
                  {renderFeedCell(row, rowIndex, "male")}
                  {renderFeedCell(row, rowIndex, "female", true)}
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="fc-grid-footer-cell sticky bottom-0 left-0 z-40 h-9 text-center font-semibold">Total</td>
                <td className="fc-grid-footer-cell fc-grid-footer-age sticky bottom-0 left-[132px] z-40 text-center font-semibold">{visibleRows.length} days</td>
                {[
                  periodFirstRow?.inv_male ?? 0, periodFirstRow?.inv_female ?? 0,
                  periodTotals.mcMale, periodTotals.mcFemale,
                  periodEndCumulative.male, periodEndCumulative.female,
                  periodTotals.cullMale, periodTotals.cullFemale,
                  periodTotals.inMale, periodTotals.inFemale,
                  periodTotals.outMale, periodTotals.outFemale,
                ].map((value, index) => <td key={`before-${index}`} className={`fc-grid-footer-cell sticky bottom-0 text-center font-semibold ${index % 2 === 1 ? "fc-grid-group-divider" : "fc-grid-border-r"}`}>{count(value)}</td>)}
                <td className="fc-grid-footer-cell fc-grid-group-divider sticky bottom-0" />
                {[
                  periodTotals.kitchenMale, periodTotals.kitchenFemale,
                  periodTotals.condemMale, periodTotals.condemFemale,
                  periodLatestRecord?.avg_body_weight_male ?? 0, periodLatestRecord?.avg_body_weight_female ?? 0,
                  periodTotals.feedMale, periodTotals.feedFemale,
                ].map((value, index) => <td key={`after-${index}`} className={`fc-grid-footer-cell sticky bottom-0 text-center font-semibold ${index % 2 === 1 ? "fc-grid-group-divider" : "fc-grid-border-r"}`}>{count(value)}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <Dialog open={Boolean(transferModal)} onOpenChange={(open) => { if (!open && !transferSaving) setTransferModal(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transfer Transaction</DialogTitle>
            <DialogDescription>Transfer Out is posted to this source pen and Transfer In is posted to the selected destination.</DialogDescription>
          </DialogHeader>
          {transferModal ? <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2"><Label>Transfer date</Label><Input type="date" min={transferMinimumDate} max={localDate()} value={transferModal.transfer_date} onChange={(event) => setTransferModal((current) => current ? { ...current, transfer_date: event.target.value } : current)} /></label>
            <label className="space-y-2"><Label>Source building / pen</Label><Input value={`${placement.farm_name} / ${placement.building_no} / ${placement.pen_no}`} readOnly className="bg-muted/40" /></label>
            <label className="space-y-2 sm:col-span-2"><Label required>Destination building / pen</Label><select value={transferModal.destination_placement_id} onChange={(event) => setTransferModal((current) => current ? { ...current, destination_placement_id: event.target.value } : current)} disabled={transferLoading} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">{transferLoading ? "Loading destinations..." : "Select destination"}</option>{transferPlacements.filter((item) => item.id !== placement.id).sort((left, right) => left.building_no.localeCompare(right.building_no, undefined, { numeric: true }) || left.pen_no.localeCompare(right.pen_no, undefined, { numeric: true })).map((item) => <option key={item.id} value={item.id}>{transferLabel(item)}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3 sm:col-span-2"><div className="rounded-md border bg-muted/20 px-3 py-2"><div className="text-xs text-muted-foreground">Male available</div><div className="font-semibold tabular-nums">{Number(transferSource?.male_available ?? 0).toLocaleString()}</div></div><div className="rounded-md border bg-muted/20 px-3 py-2"><div className="text-xs text-muted-foreground">Female available</div><div className="font-semibold tabular-nums">{Number(transferSource?.female_available ?? 0).toLocaleString()}</div></div></div>
            <label className="space-y-2"><Label>Male quantity</Label><Input type="number" min="0" max={transferSource?.male_available ?? 0} step="1" value={transferModal.male_qty} onChange={(event) => setTransferModal((current) => current ? { ...current, male_qty: event.target.value } : current)} /></label>
            <label className="space-y-2"><Label>Female quantity</Label><Input type="number" min="0" max={transferSource?.female_available ?? 0} step="1" value={transferModal.female_qty} onChange={(event) => setTransferModal((current) => current ? { ...current, female_qty: event.target.value } : current)} /></label>
            <label className="space-y-2 sm:col-span-2"><Label required>Reason</Label><Input value={transferModal.reason} maxLength={250} onChange={(event) => setTransferModal((current) => current ? { ...current, reason: event.target.value } : current)} /></label>
            <label className="space-y-2 sm:col-span-2"><Label>Remarks</Label><Textarea value={transferModal.remarks} maxLength={500} onChange={(event) => setTransferModal((current) => current ? { ...current, remarks: event.target.value } : current)} /></label>
          </div> : null}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setTransferModal(null)} disabled={transferSaving}>Cancel</Button><Button type="button" onClick={() => void postTransferFromModal()} disabled={transferLoading || transferSaving || !transferSource}>{transferSaving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Post Transfer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
