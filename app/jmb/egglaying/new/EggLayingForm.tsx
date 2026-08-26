"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Breadcrumb from "@/lib/Breadcrumb";
import FormActionButtons from "@/components/FormActionButtons";
import { ChevronLeft, ChevronRight, Download, Plus, Trash2, Upload } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import {
  createEggLaying,
  createEggLayingBatch,
  getEggLayingById,
  getLayingPlacementById,
  listEggLayingHistoryByFarm,
  updateEggLaying,
  type EggLaying,
  type EggLayingHistory,
  type EggLayingInsert,
  type LayingPlacement,
} from "./api";

type ProductionRow = {
  date_laying: string;
  tep_collection: string;
  hatching_egg: string;
  table_egg: string;
  classb: string;
  crack: string;
  junior: string;
  jumbo: string;
  condemn: string;
};

const IMPORT_HEADERS = [
  "Date Laying",
  "TEP Collection",
  "Hatching Egg",
  "Table Egg",
  "Class B",
  "Crack",
  "Junior",
  "Jumbo",
  "Condemn",
  "Total Egg Classification",
] as const;

const productionNumberFields: Array<Exclude<keyof ProductionRow, "date_laying">> = [
  "tep_collection", "hatching_egg", "table_egg", "classb", "crack", "junior", "jumbo", "condemn",
];

const historyNumberFields = [
  "tep_collection", "hatching_egg", "table_egg", "classb", "crack", "junior", "jumbo", "condemn",
] as const satisfies ReadonlyArray<keyof EggLaying>;

const productionGridInputClass = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const HISTORY_PAGE_SIZE = 20;

function createProductionRow(dateLaying = getToday()): ProductionRow {
  return {
    date_laying: dateLaying,
    tep_collection: "",
    hatching_egg: "",
    table_egg: "",
    classb: "",
    crack: "",
    junior: "",
    jumbo: "",
    condemn: "",
  };
}

function getProductionTotal(row: ProductionRow) {
  return productionNumberFields
    .filter((field) => field !== "tep_collection")
    .reduce((sum, field) => sum + asNumber(row[field]), 0);
}

type FormState = {
  placement_id: string;
  date_laying: string;
  farm_id: string;
  farm_name: string;
  building_id: string;
  building: string;
  age: string;
  tep_collection: string;
  hatching_egg: string;
  classb: string;
  table_egg: string;
  crack: string;
  junior: string;
  jumbo: string;
  condemn: string;
};

function getToday() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function clampInteger(raw: string) {
  if (raw === "") return "";
  const cleaned = raw.replace(/[^0-9]/g, "");
  if (cleaned === "") return "";
  return String(Math.max(0, Number(cleaned)));
}

function asNumber(value: string | number | null | undefined) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: string | number | null | undefined) {
  const parsed = asNumber(value);
  return parsed ? parsed.toLocaleString("en-US") : "";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-CA");
}

function getAgeInDays(placementDate?: string | null, endDateValue?: string) {
  if (!placementDate || !endDateValue) return 0;
  const start = new Date(`${placementDate}T00:00:00`);
  const end = new Date(`${endDateValue}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const elapsedDays = Math.floor((endUtc - startUtc) / 86_400_000);
  return elapsedDays >= 0 ? elapsedDays + 1 : 0;
}

function formatAge(days: number | null | undefined) {
  const safeDays = Number(days ?? 0);
  if (!Number.isFinite(safeDays)) return "0/0";
  const wholeDays = Math.max(0, Math.floor(safeDays));
  return `${Math.floor(wholeDays / 7)}/${wholeDays % 7}`;
}

function getEggTotal(
  row: Pick<
    EggLaying,
    "hatching_egg" | "classb" | "table_egg" | "crack" | "junior" | "jumbo" | "condemn"
  >,
) {
  return (
    Number(row.hatching_egg ?? 0) +
    Number(row.classb ?? 0) +
    Number(row.table_egg ?? 0) +
    Number(row.crack ?? 0) +
    Number(row.junior ?? 0) +
    Number(row.jumbo ?? 0) +
    Number(row.condemn ?? 0)
  );
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return getToday();
  date.setDate(date.getDate() + days);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getNetPlacement(placement: LayingPlacement | null) {
  if (!placement) return 0;
  return (
    Number(placement.f_endingbalance ?? 0) +
    Number(placement.m_endingbalance ?? 0)
  );
}

function createInitialForm(): FormState {
  return {
    placement_id: "",
    date_laying: getToday(),
    farm_id: "",
    farm_name: "",
    building_id: "",
    building: "",
    age: "0",
    tep_collection: "",
    hatching_egg: "",
    classb: "",
    table_egg: "",
    crack: "",
    junior: "",
    jumbo: "",
    condemn: "",
  };
}

export default function EggLayingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const placementIdParam = searchParams.get("placementId");
  const netPlacementParam = searchParams.get("netPlacement");
  const isEdit = Boolean(idParam);

  const [form, setForm] = useState<FormState>(() => createInitialForm());
  const [selectedPlacement, setSelectedPlacement] =
    useState<LayingPlacement | null>(null);
  const [history, setHistory] = useState<EggLayingHistory[]>([]);
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyBuildingFilter, setHistoryBuildingFilter] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [productionRows, setProductionRows] = useState<ProductionRow[]>(() => [createProductionRow()]);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productionGridRef = useRef<HTMLTableElement>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);

  const disabledAll = saving || loadingRecord;
  const netPlacementFromTable =
    netPlacementParam != null && netPlacementParam !== ""
      ? Number(netPlacementParam)
      : Number.NaN;
  const displayedNetPlacement = Number.isFinite(netPlacementFromTable)
    ? netPlacementFromTable
    : getNetPlacement(selectedPlacement);
  const productionTotals = useMemo(() => productionNumberFields.map((field) =>
    productionRows.reduce((total, row) => total + asNumber(row[field]), 0),
  ), [productionRows]);
  const filteredHistory = useMemo(() => {
    const buildingFilter = historyBuildingFilter.trim().toLowerCase();
    return history.filter((row) =>
      (!historyDateFrom || row.date_laying >= historyDateFrom) &&
      (!historyDateTo || row.date_laying <= historyDateTo) &&
      (!buildingFilter || (row.building ?? "").toLowerCase().includes(buildingFilter)),
    );
  }, [history, historyBuildingFilter, historyDateFrom, historyDateTo]);
  const historyPageCount = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return filteredHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [filteredHistory, historyPage]);

  function applyPlacement(
    placement: LayingPlacement,
    dateLaying = form.date_laying,
  ) {
    const ageDays = getAgeInDays(placement.placement_date, dateLaying);
    setSelectedPlacement(placement);
    setForm((prev) => ({
      ...prev,
      placement_id: String(placement.id),
      farm_id:
        placement.farm_id !== null && placement.farm_id !== undefined
          ? String(placement.farm_id)
          : "",
      farm_name: placement.farm_name ?? "",
      building_id:
        placement.building_id !== null && placement.building_id !== undefined
          ? String(placement.building_id)
          : "",
      building: placement.building_no ?? "",
      age: String(ageDays),
    }));
  }

  async function refreshHistory(nextForm = form) {
    if (!nextForm.farm_id && !nextForm.farm_name) {
      setHistory([]);
      return;
    }

    const rows = await listEggLayingHistoryByFarm({
      farmId: nextForm.farm_id ? asNumber(nextForm.farm_id) : null,
      farmName: nextForm.farm_name || null,
    });
    setHistory(rows);
    setHistoryPage(1);
  }

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    if (!placementIdParam || isEdit) return;

    (async () => {
      const placementId = Number(placementIdParam);
      if (!Number.isFinite(placementId)) return;

      try {
        const placement = await getLayingPlacementById(placementId);
        applyPlacement(placement);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load placement.";
        alert(message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementIdParam, isEdit]);

  useEffect(() => {
    if (!idParam) return;

    (async () => {
      const id = Number(idParam);
      if (!Number.isFinite(id)) {
        alert("Invalid egg laying id.");
        router.push("/jmb/egglaying");
        return;
      }

      setLoadingRecord(true);
      try {
        const row = await getEggLayingById(id);
        const nextForm: FormState = {
          placement_id: row.placement_id ? String(row.placement_id) : "",
          date_laying: row.date_laying ?? getToday(),
          farm_id: row.farm_id ? String(row.farm_id) : "",
          farm_name: row.farm_name ?? "",
          building_id: row.building_id ? String(row.building_id) : "",
          building: row.building ?? "",
          age: row.age != null ? String(row.age) : "0",
          tep_collection:
            row.tep_collection != null ? String(row.tep_collection) : "",
          hatching_egg:
            row.hatching_egg != null ? String(row.hatching_egg) : "",
          classb: row.classb != null ? String(row.classb) : "",
          table_egg: row.table_egg != null ? String(row.table_egg) : "",
          crack: row.crack != null ? String(row.crack) : "",
          junior: row.junior != null ? String(row.junior) : "",
          jumbo: row.jumbo != null ? String(row.jumbo) : "",
          condemn: row.condemn != null ? String(row.condemn) : "",
        };

        setForm(nextForm);
        setProductionRows([{
          date_laying: nextForm.date_laying,
          tep_collection: nextForm.tep_collection,
          hatching_egg: nextForm.hatching_egg,
          table_egg: nextForm.table_egg,
          classb: nextForm.classb,
          crack: nextForm.crack,
          junior: nextForm.junior,
          jumbo: nextForm.jumbo,
          condemn: nextForm.condemn,
        }]);
        await refreshHistory(nextForm);

        if (row.placement_id) {
          const placement = await getLayingPlacementById(row.placement_id);
          setSelectedPlacement(placement);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load egg laying.";
        alert(message);
        router.push("/jmb/egglaying");
      } finally {
        setLoadingRecord(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam, router]);

  useEffect(() => {
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.farm_id, form.farm_name]);

  function updateProductionRow(index: number, field: keyof ProductionRow, value: string) {
    setProductionRows((current) => current.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [field]: value } : row,
    ));
  }

  function addProductionRow() {
    const lastDate = productionRows.at(-1)?.date_laying;
    const nextDate = lastDate ? addDays(lastDate, 1) : getToday();
    if (nextDate > getToday()) {
      alert("Advance recording is not allowed. Date Laying cannot be later than today.");
      return;
    }
    setProductionRows((current) => [...current, createProductionRow(nextDate)]);
  }

  function focusProductionCell(rowIndex: number, columnIndex: number) {
    const input = productionGridRef.current?.querySelector<HTMLInputElement>(
      `[data-production-row="${rowIndex}"][data-production-column="${columnIndex}"]:not(:disabled)`,
    );
    if (!input) return false;
    input.focus();
    input.select();
    return true;
  }

  function moveProductionFocus(rowIndex: number, columnIndex: number, rowStep: number, columnStep: number) {
    let nextRow = rowIndex + rowStep;
    let nextColumn = columnIndex + columnStep;
    const lastColumn = productionNumberFields.length;

    if (columnStep !== 0) {
      if (nextColumn > lastColumn) { nextColumn = 0; nextRow += 1; }
      if (nextColumn < 0) { nextColumn = lastColumn; nextRow -= 1; }
    }

    while (nextRow >= 0 && nextRow < productionRows.length) {
      if (focusProductionCell(nextRow, nextColumn)) return;
      if (columnStep !== 0) {
        nextColumn += columnStep;
        if (nextColumn > lastColumn) { nextColumn = 0; nextRow += 1; }
        if (nextColumn < 0) { nextColumn = lastColumn; nextRow -= 1; }
      } else {
        nextRow += rowStep;
      }
    }
  }

  function handleProductionCellKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number,
  ) {
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      Enter: [event.shiftKey ? -1 : 1, 0],
      Tab: [0, event.shiftKey ? -1 : 1],
    };
    const offset = movement[event.key];
    if (!offset) return;
    event.preventDefault();
    moveProductionFocus(rowIndex, columnIndex, offset[0], offset[1]);
  }

  async function exportTemplate() {
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const header = IMPORT_HEADERS.map((value) => ({
      value,
      type: String,
      fontWeight: "bold" as const,
      color: "#FFFFFF",
      backgroundColor: "#047857",
      align: "center" as const,
    }));
    const blankRows = Array.from({ length: 30 }, (_, index) => [
      { type: Date, format: "yyyy-mm-dd" },
      ...Array.from({ length: 8 }, () => ({ type: Number, format: "#,##0" })),
      { value: `SUM(C${index + 2}:I${index + 2})`, type: "Formula" as const, format: "#,##0" },
    ]);
    const templateFile = writeXlsxFile([header, ...blankRows], {
      sheet: "Egg Laying Production",
      stickyRowsCount: 1,
      columns: [
        { width: 15 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 12 },
        { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 24 },
      ],
    });
    await templateFile.toFile("egg-laying-production-template.xlsx");
  }

  function normalizeImportedDate(value: unknown) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
      return date.toISOString().slice(0, 10);
    }
    const text = String(value ?? "").trim();
    if (!text) return "";
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }

  async function importExcel(file: File) {
    setImportError("");
    try {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const workbookSheets = await readXlsxFile(file);
      const productionSheet = workbookSheets.find((sheet) => sheet.sheet === "Egg Laying Production");
      if (!productionSheet) {
        throw new Error("Required worksheet “Egg Laying Production” was not found. Download and use the current template.");
      }
      const excelRows = productionSheet.data;
      const headers = IMPORT_HEADERS.map((_, index) => String(excelRows[0]?.[index] ?? "").trim());
      const invalidHeader = IMPORT_HEADERS.findIndex((header, index) => headers[index] !== header);
      if (invalidHeader >= 0) {
        throw new Error(`Invalid template column ${invalidHeader + 1}. Expected “${IMPORT_HEADERS[invalidHeader]}”. Download and use the current template.`);
      }

      const importedRows: ProductionRow[] = [];
      const errors: string[] = [];
      const dates = new Set<string>();
      const existingDates = new Set(
        history
          .filter((record) => record.building === form.building)
          .map((record) => record.date_laying),
      );
      excelRows.slice(1).forEach((excelRow, index) => {
        const rowNumber = index + 2;
        const raw = Array.from({ length: 9 }, (_, columnIndex) => excelRow[columnIndex]);
        if (raw.every((value) => value == null || String(value).trim() === "")) return;
        const dateLaying = normalizeImportedDate(raw[0]);
        if (!dateLaying) errors.push(`Row ${rowNumber}: Date Laying is invalid.`);
        if (dateLaying && dateLaying > getToday()) errors.push(`Row ${rowNumber}: advance recording is not allowed. Date Laying cannot be later than today.`);
        if (dateLaying && dates.has(dateLaying)) errors.push(`Row ${rowNumber}: duplicate Date Laying ${dateLaying}.`);
        if (dateLaying && existingDates.has(dateLaying)) errors.push(`Row ${rowNumber}: Date Laying ${dateLaying} already has a saved record.`);
        if (dateLaying) dates.add(dateLaying);

        const numbers = raw.slice(1).map((value, index) => {
          const parsed = Number(value ?? 0);
          if (!Number.isInteger(parsed) || parsed < 0) {
            errors.push(`Row ${rowNumber}: ${IMPORT_HEADERS[index + 1]} must be a whole number zero or greater.`);
            return "0";
          }
          return String(parsed);
        });
        if (numbers[0] === "0") errors.push(`Row ${rowNumber}: TEP Collection is required and must be greater than zero.`);
        const classificationTotal = numbers.slice(1).reduce((sum, value) => sum + Number(value), 0);
        if (Number(numbers[0]) !== classificationTotal) {
          errors.push(`Row ${rowNumber}: TEP Collection (${numbers[0]}) does not equal classification total (${classificationTotal}).`);
        }
        importedRows.push({
          date_laying: dateLaying,
          tep_collection: numbers[0], hatching_egg: numbers[1], table_egg: numbers[2],
          classb: numbers[3], crack: numbers[4], junior: numbers[5], jumbo: numbers[6], condemn: numbers[7],
        });
      });
      if (!importedRows.length) errors.push("No production rows were found in the template.");
      if (errors.length) throw new Error(errors.slice(0, 12).join("\n"));
      setProductionRows(importedRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import the Excel file.";
      setImportError(message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSave() {
    if (!productionRows.length) {
      alert("Add at least one egg laying production row.");
      return;
    }

    if (!form.placement_id) {
      alert("Placement is required.");
      return;
    }

    const dates = new Set<string>();
    const existingDates = new Set(
      history
        .filter((record) => record.building === form.building)
        .filter((record) => !isEdit || record.id !== Number(idParam))
        .map((record) => record.date_laying),
    );
    for (const [index, row] of productionRows.entries()) {
      if (!row.date_laying) {
        alert(`Row ${index + 1}: Date Laying is required.`);
        return;
      }
      if (row.date_laying > getToday()) {
        alert(`Row ${index + 1}: advance recording is not allowed. Date Laying cannot be later than today.`);
        return;
      }
      if (dates.has(row.date_laying)) {
        alert(`Row ${index + 1}: duplicate Date Laying ${row.date_laying}.`);
        return;
      }
      dates.add(row.date_laying);
      if (existingDates.has(row.date_laying)) {
        alert(`Row ${index + 1}: Date Laying ${row.date_laying} already has a saved record.`);
        return;
      }
      const tepCollection = asNumber(row.tep_collection);
      const classificationTotal = getProductionTotal(row);
      if (tepCollection <= 0) {
        alert(`Row ${index + 1}: TEP Collection is required and must be greater than zero.`);
        return;
      }
      if (classificationTotal !== tepCollection) {
        alert(`Row ${index + 1}: TEP Collection (${tepCollection.toLocaleString("en-US")}) must equal Total Egg Classification (${classificationTotal.toLocaleString("en-US")}).`);
        return;
      }
    }

    const payloads: EggLayingInsert[] = productionRows.map((row) => ({
      placement_id: asNumber(form.placement_id),
      date_laying: row.date_laying,
      farm_id: form.farm_id ? asNumber(form.farm_id) : null,
      farm_name: form.farm_name || null,
      building: form.building || null,
      age: selectedPlacement
        ? getAgeInDays(selectedPlacement.placement_date, row.date_laying)
        : Math.max(0, Math.floor(asNumber(form.age))),
      tep_collection: row.tep_collection
        ? asNumber(row.tep_collection)
        : null,
      hatching_egg: row.hatching_egg ? asNumber(row.hatching_egg) : null,
      classb: row.classb ? asNumber(row.classb) : null,
      table_egg: row.table_egg ? asNumber(row.table_egg) : null,
      crack: row.crack ? asNumber(row.crack) : null,
      junior: row.junior ? asNumber(row.junior) : null,
      jumbo: row.jumbo ? asNumber(row.jumbo) : null,
      condemn: row.condemn ? asNumber(row.condemn) : null,
      is_active: true,
      building_id: form.building_id ? asNumber(form.building_id) : null,
    }));

    setSaving(true);
    try {
      if (isEdit) {
        const id = Number(idParam);
        if (!Number.isFinite(id)) throw new Error("Invalid egg laying id.");
        await updateEggLaying(id, payloads[0]);
      } else if (payloads.length > 1) {
        await createEggLayingBatch(payloads);
      } else {
        await createEggLaying(payloads[0]);
      }

      router.push("/jmb/egglaying");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save egg laying.";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 mt-8">
      <Breadcrumb
        SecondPreviewPageName="Breeder"
        FirstPreviewsPageName="Egg Laying List"
        CurrentPageName={isEdit ? "Edit Egg Laying" : "New Egg Laying"}
      />

      <Card>
        <CardContent className="pt-4 space-y-5">
          <div className="rounded-md border p-4 space-y-4">
            {loadingRecord ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : null}

            <input type="hidden" value={form.placement_id} readOnly />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label>Farm Name</Label>
                <Input value={form.farm_name} readOnly disabled />
              </div>

              <div className="space-y-2">
                <Label>Building</Label>
                <Input value={form.building} readOnly disabled />
              </div>

              <div className="space-y-2">
                <Label>Net of Placement</Label>
                <Input
                  value={displayedNetPlacement.toLocaleString("en-US")}
                  readOnly
                  disabled
                />
              </div>

            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium">Egg Laying Production</h3>
                  <p className="text-xs text-muted-foreground">
                    Record multiple dates manually or import the validated Excel template.
                  </p>
                </div>
                {!isEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void exportTemplate()}>
                      <Download className="size-4" /> Export Template
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="size-4" /> Import Excel
                    </Button>
                    <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importExcel(file);
                    }} />
                    <Button type="button" size="sm" onClick={addProductionRow} disabled={(productionRows.at(-1)?.date_laying ?? getToday()) >= getToday()}>
                      <Plus className="size-4" /> Add Date
                    </Button>
                  </div>
                ) : null}
              </div>
              {importError ? (
                <div className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <strong>Import rejected.</strong>{"\n"}{importError}
                </div>
              ) : null}
              <div className="max-h-[520px] w-full overflow-x-hidden overflow-y-auto bg-white dark:bg-card">
                <table
                  ref={productionGridRef}
                  className="fc-grid-table w-full table-fixed border-separate border-spacing-0 caption-bottom text-sm"
                >
                  <colgroup>
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "10%" }} />
                    {Array.from({ length: 7 }, (_, index) => <col key={index} style={{ width: "8%" }} />)}
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "5%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ height: 36 }}>
                      {[
                        "Date Laying *",
                        "Age",
                        "TEP Collection *",
                        "Hatching Egg",
                        "Table Egg",
                        "Class B",
                        "Crack",
                        "Junior",
                        "Jumbo",
                        "Condemn",
                        "Total Egg Classification",
                        "Action",
                      ].map((label, index) => (
                        <th
                          key={label}
                          style={index === 1 ? { left: "11%" } : undefined}
                          className={`fc-grid-header fc-grid-header-border sticky top-0 px-1 py-0 text-center text-[10px] font-semibold leading-tight ${index === 0 ? "left-0 z-40 fc-grid-border-r" : index === 1 ? "z-40 fc-grid-age-header" : "z-30 fc-grid-border-r"}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productionRows.map((row, rowIndex) => (
                    <tr key={`${row.date_laying}-${rowIndex}`} className="fc-grid-row border-0">
                      <td className={`fc-grid-cell fc-grid-cell-editable sticky left-0 z-20 p-0 fc-grid-border-r ${rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider"}`}>
                        <Input type="date" value={row.date_laying} max={getToday()}
                          data-production-row={rowIndex} data-production-column={0}
                          onChange={(event) => updateProductionRow(rowIndex, "date_laying", event.target.value)}
                          onKeyDown={(event) => handleProductionCellKeyDown(event, rowIndex, 0)} disabled={disabledAll}
                          className="h-8 min-w-0 rounded-none border-0 bg-transparent px-0.5 text-center text-[10px] shadow-none focus-visible:ring-0" />
                      </td>
                      <td style={{ left: "11%" }} className={`fc-grid-age sticky z-20 p-0 text-center text-xs font-semibold ${rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider"}`}>
                        <div className="flex h-8 items-center justify-center">
                          {formatAge(selectedPlacement ? getAgeInDays(selectedPlacement.placement_date, row.date_laying) : asNumber(form.age))}
                        </div>
                      </td>
                      {productionNumberFields.map((field, fieldIndex) => (
                        <td key={field} className={`fc-grid-cell fc-grid-cell-editable p-0 fc-grid-border-r ${rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider"}`}>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={row[field]}
                            onChange={(event) => updateProductionRow(rowIndex, field, clampInteger(event.target.value))}
                            onFocus={(event) => event.target.select()}
                            onKeyDown={(event) => handleProductionCellKeyDown(event, rowIndex, fieldIndex + 1)}
                            data-production-row={rowIndex}
                            data-production-column={fieldIndex + 1}
                            disabled={disabledAll}
                            className={`h-8 min-w-0 rounded-none border-0 bg-transparent px-0.5 text-center text-xs shadow-none focus-visible:ring-0 ${productionGridInputClass}`}
                          />
                        </td>
                      ))}
                      <td className={`fc-grid-cell fc-grid-cell-readonly p-0 text-center font-semibold tabular-nums fc-grid-border-r ${rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider"}`}>
                        {getProductionTotal(row).toLocaleString("en-US")}
                      </td>
                      <td className={`fc-grid-cell fc-grid-cell-readonly p-0 text-center fc-grid-border-r ${rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider"}`}>
                        <Button type="button" variant="ghost" size="icon-sm" disabled={disabledAll || isEdit || productionRows.length === 1}
                          onClick={() => setProductionRows((rows) => rows.filter((_, index) => index !== rowIndex))}
                          className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700">
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="fc-grid-footer-cell sticky bottom-0 left-0 z-40 h-9 text-center font-semibold">Total</td>
                      <td style={{ left: "11%" }} className="fc-grid-footer-cell fc-grid-footer-age sticky bottom-0 z-40 text-center text-xs font-semibold">{productionRows.length} row{productionRows.length === 1 ? "" : "s"}</td>
                      {productionTotals.map((value, index) => (
                        <td key={productionNumberFields[index]} className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0 text-center font-semibold tabular-nums">
                          {value.toLocaleString("en-US")}
                        </td>
                      ))}
                      <td className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0 text-center font-semibold tabular-nums">
                        {productionTotals.slice(1).reduce((total, value) => total + value, 0).toLocaleString("en-US")}
                      </td>
                      <td className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <Separator />

            <FormActionButtons
              saving={saving}
              isEdit={isEdit}
              disabled={disabledAll}
              cancelPath="/jmb/egglaying"
              onSave={onSave}
            />

            <Separator />

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">
                  Egg Collection Farm History
                </h3>
                <p className="text-xs text-muted-foreground">
                  {form.farm_name
                    ? `Showing recent transactions for ${form.farm_name}.`
                    : "Select a placement to show farm history."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="history-date-from" className="text-xs">Date Laying From</Label>
                  <Input
                    id="history-date-from"
                    type="date"
                    max={historyDateTo || undefined}
                    value={historyDateFrom}
                    onChange={(event) => {
                      setHistoryDateFrom(event.target.value);
                      setHistoryPage(1);
                    }}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="history-date-to" className="text-xs">Date Laying To</Label>
                  <Input
                    id="history-date-to"
                    type="date"
                    min={historyDateFrom || undefined}
                    value={historyDateTo}
                    onChange={(event) => {
                      setHistoryDateTo(event.target.value);
                      setHistoryPage(1);
                    }}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="history-building-filter" className="text-xs">Building</Label>
                  <Input
                    id="history-building-filter"
                    type="search"
                    placeholder="Search building..."
                    value={historyBuildingFilter}
                    onChange={(event) => {
                      setHistoryBuildingFilter(event.target.value);
                      setHistoryPage(1);
                    }}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="max-h-[420px] w-full overflow-x-hidden overflow-y-auto bg-white dark:bg-card">
                <table className="fc-grid-table w-full table-fixed border-separate border-spacing-0 caption-bottom text-sm">
                  <colgroup>
                    {[4, 8, 9, 5, 5, 9, 8, 7, 7, 6, 6, 6, 7, 9].map((width, index) => (
                      <col key={index} style={{ width: `${width}%` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr style={{ height: 36 }}>
                      {[
                        "Row #", "Date Laying", "Building", "Cycle #", "Age", "TEP Collection",
                        "Hatching Egg", "Table Egg", "Class B", "Crack", "Junior", "Jumbo",
                        "Condemn", "Total Egg Classification",
                      ].map((label, index) => (
                        <th
                          key={label}
                          className={`fc-grid-header fc-grid-header-border sticky top-0 px-1 py-0 text-center text-[10px] font-semibold leading-tight ${index === 0 ? "left-0 z-40 fc-grid-age-header" : "z-30 fc-grid-border-r"}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.length ? (
                      paginatedHistory.map((row, rowIndex) => {
                        const rowDivider = rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider";
                        return (
                        <tr key={row.id} className="fc-grid-row border-0">
                          <td className={`fc-grid-age sticky left-0 z-20 p-0 text-center font-semibold ${rowDivider}`}>
                            <div className="flex h-8 items-center justify-center px-0.5 text-[10px]">
                              {(historyPage - 1) * HISTORY_PAGE_SIZE + rowIndex + 1}
                            </div>
                          </td>
                          <td className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 ${rowDivider}`}>
                            <div className="flex h-8 items-center justify-center px-0.5 text-[10px]">{formatDate(row.date_laying)}</div>
                          </td>
                          <td className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 ${rowDivider}`}>
                            <div className="flex h-8 min-w-0 items-center truncate px-1 text-xs" title={row.building ?? ""}>{row.building ?? ""}</div>
                          </td>
                          <td className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 text-center text-xs font-semibold tabular-nums ${rowDivider}`}>
                            {row.cycle_no ?? "-"}
                          </td>
                          <td className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 text-center text-xs font-semibold ${rowDivider}`}>
                            {formatAge(row.age)}
                          </td>
                          {historyNumberFields.map((field) => (
                            <td key={field} className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 text-center text-xs tabular-nums ${rowDivider}`}>
                              {formatNumber(row[field])}
                            </td>
                          ))}
                          <td className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 text-center text-xs font-semibold tabular-nums ${rowDivider}`}>
                            {getEggTotal(row).toLocaleString("en-US")}
                          </td>
                        </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={14}
                          className="fc-grid-cell fc-grid-cell-readonly fc-grid-border-r fc-grid-row-divider px-3 py-6 text-center text-muted-foreground"
                        >
                          {history.length ? "No history matches the selected filters." : "No farm history found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="text-muted-foreground">
                  {filteredHistory.length
                    ? `Showing ${(historyPage - 1) * HISTORY_PAGE_SIZE + 1}-${Math.min(historyPage * HISTORY_PAGE_SIZE, filteredHistory.length)} of ${filteredHistory.length}`
                    : "Showing 0 of 0"}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                    disabled={historyPage === 1}
                  >
                    <ChevronLeft className="size-4" /> Previous
                  </Button>
                  <span className="min-w-24 text-center text-xs font-medium">
                    Page {historyPage} of {historyPageCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))}
                    disabled={historyPage === historyPageCount}
                  >
                    Next <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
