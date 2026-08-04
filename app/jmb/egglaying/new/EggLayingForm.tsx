"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Breadcrumb from "@/lib/Breadcrumb";
import FormActionButtons from "@/components/FormActionButtons";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import {
  createEggLaying,
  createEggLayingBatch,
  getEggLayingById,
  getLayingPlacementById,
  listEggLayingHistoryByFarm,
  updateEggLaying,
  type EggLaying,
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
  return Math.max(0, Math.floor((endUtc - startUtc) / 86_400_000));
}

function formatAgeWeeks(days: number | null | undefined) {
  const safeDays = Number(days ?? 0);
  const weeks = Math.floor(safeDays / 7);
  const weekDay = safeDays % 7;
  return `${weeks}.7/${weekDay}`;
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
  const [history, setHistory] = useState<EggLaying[]>([]);
  const [productionRows, setProductionRows] = useState<ProductionRow[]>(() => [createProductionRow()]);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  function handleProductionCellKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number,
  ) {
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    const offset = movement[event.key];
    if (!offset) return;

    const nextRow = rowIndex + offset[0];
    const nextColumn = columnIndex + offset[1];
    if (
      nextRow < 0 ||
      nextRow >= productionRows.length ||
      nextColumn < 0 ||
      nextColumn > productionNumberFields.length
    ) return;

    const nextInput = document.querySelector<HTMLInputElement>(
      `[data-production-cell="${nextRow}-${nextColumn}"]`,
    );
    if (!nextInput) return;

    event.preventDefault();
    nextInput.focus();
    nextInput.select();
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
      age: selectedPlacement ? getAgeInDays(selectedPlacement.placement_date, row.date_laying) : asNumber(form.age),
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
                    <Button type="button" size="sm" onClick={() => setProductionRows((rows) => [...rows, createProductionRow()])}>
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
              <div className="overflow-x-auto border border-slate-300 bg-white">
                <table
                  className="w-full min-w-[1420px] table-fixed border-collapse text-sm"
                >
                  <thead>
                    <tr>
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
                      ].map((label) => (
                        <th key={label} className="border border-slate-300 bg-emerald-50 px-2 py-2 text-center text-xs font-semibold text-slate-700">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productionRows.map((row, rowIndex) => (
                    <tr key={`${row.date_laying}-${rowIndex}`}>
                      <td className="border border-slate-300 p-0">
                        <Input type="date" value={row.date_laying} data-production-cell={`${rowIndex}-0`}
                          onChange={(event) => updateProductionRow(rowIndex, "date_laying", event.target.value)}
                          onKeyDown={(event) => handleProductionCellKeyDown(event, rowIndex, 0)} disabled={disabledAll}
                          className="h-11 rounded-none border-0 bg-transparent text-center shadow-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-inset focus-visible:ring-offset-0" />
                      </td>
                      <td className="border border-slate-300 bg-slate-50 p-0 text-center font-medium">
                        {formatAgeWeeks(selectedPlacement ? getAgeInDays(selectedPlacement.placement_date, row.date_laying) : asNumber(form.age))}
                      </td>
                      {productionNumberFields.map((field) => (
                        <td key={field} className="border border-slate-300 p-0">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={formatNumber(row[field])}
                            onChange={(event) => updateProductionRow(rowIndex, field, clampInteger(event.target.value))}
                            onFocus={(event) => event.target.select()}
                            onKeyDown={(event) => handleProductionCellKeyDown(event, rowIndex, productionNumberFields.indexOf(field) + 1)}
                            data-production-cell={`${rowIndex}-${productionNumberFields.indexOf(field) + 1}`}
                            disabled={disabledAll}
                            className="h-11 rounded-none border-0 bg-transparent text-center shadow-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-inset focus-visible:ring-offset-0"
                          />
                        </td>
                      ))}
                      <td className="border border-slate-300 bg-slate-50 p-0">
                        <Input
                          value={getProductionTotal(row).toLocaleString("en-US")}
                          readOnly
                          disabled
                          className="h-11 rounded-none border-0 bg-slate-50 text-center font-semibold shadow-none disabled:opacity-100"
                        />
                      </td>
                      <td className="border border-slate-300 p-0 text-center">
                        <Button type="button" variant="ghost" size="icon" disabled={disabledAll || isEdit || productionRows.length === 1}
                          onClick={() => setProductionRows((rows) => rows.filter((_, index) => index !== rowIndex))}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700">
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                    ))}
                  </tbody>
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

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-245 text-sm">
                  <thead className="bg-green-50">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">
                        Date Laying
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Farm Name
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Building
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Age</th>
                      <th className="px-3 py-2 text-right font-medium">
                        TEP Collection
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Hatching Egg
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Class B
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Table Egg
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Crack
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Junior
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Jumbo
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Condemn
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length ? (
                      history.map((row) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            {formatDate(row.date_laying)}
                          </td>
                          <td className="px-3 py-2">{row.farm_name ?? ""}</td>
                          <td className="px-3 py-2">{row.building ?? ""}</td>
                          <td className="px-3 py-2">
                            {formatAgeWeeks(row.age)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.tep_collection)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.hatching_egg)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.classb)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.table_egg)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.crack)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.junior)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.jumbo)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(row.condemn)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {getEggTotal(row).toLocaleString("en-US")}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={13}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          No farm history found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
