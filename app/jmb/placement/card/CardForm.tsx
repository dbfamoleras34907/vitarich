"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
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

type EditableRow = Omit<
  BreederDailyPerformance,
  "id" | "created_at" | "created_by" | "updated_at" | "updated_by"
> & { id?: number };

type NumericKey = keyof Pick<
  EditableRow,
  | "inv_male" | "inv_female" | "mc_male" | "mc_female"
  | "cull_male" | "cull_female" | "trans_in_male" | "trans_in_female"
  | "trans_out_male" | "trans_out_female" | "avg_body_weight_male"
  | "avg_body_weight_female" | "feed_consumption_male"
  | "feed_consumption_female"
>;

const zeroFields = {
  mc_male: 0,
  mc_female: 0,
  cull_male: 0,
  cull_female: 0,
  trans_in_male: 0,
  trans_in_female: 0,
  trans_out_male: 0,
  trans_out_female: 0,
  avg_body_weight_male: 0,
  avg_body_weight_female: 0,
  feed_consumption_male: 0,
  feed_consumption_female: 0,
};

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
    ? row.inv_male + row.trans_in_male - row.mc_male - row.cull_male - row.trans_out_male
    : row.inv_female + row.trans_in_female - row.mc_female - row.cull_female - row.trans_out_female;
}

function buildDailyRows(
  placement: Placement,
  savedRows: BreederDailyPerformance[] = [],
) {
  const savedByDate = new Map(savedRows.map((row) => [row.daterec, row]));
  let previous: EditableRow | undefined;

  return Array.from({ length: 31 }, (_, age): EditableRow => {
    const daterec = addDays(placement.placement_date, age);
    const saved = savedByDate.get(daterec);
    const row: EditableRow = saved ?? {
      placement_id: placement.id,
      daterec,
      inv_male: previous ? Math.max(0, liveInventory(previous, "male")) : placementInventory(placement, "male"),
      inv_female: previous ? Math.max(0, liveInventory(previous, "female")) : placementInventory(placement, "female"),
      ...zeroFields,
      male_feedtype_id: null,
      female_feedtype_id: null,
      isactive: true,
    };
    previous = row;
    return row;
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
  const [headerOpen, setHeaderOpen] = useState(true);

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
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load breeder pen card."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [placementId]);

  const latest = rows.at(-1);
  const totals = useMemo(() => rows.reduce((total, row) => ({
    mcFemale: total.mcFemale + row.mc_female,
    cullFemale: total.cullFemale + row.cull_female,
    inFemale: total.inFemale + row.trans_in_female,
    outFemale: total.outFemale + row.trans_out_female,
    feedFemale: total.feedFemale + row.feed_consumption_female,
    mcMale: total.mcMale + row.mc_male,
    cullMale: total.cullMale + row.cull_male,
    inMale: total.inMale + row.trans_in_male,
    outMale: total.outMale + row.trans_out_male,
    feedMale: total.feedMale + row.feed_consumption_male,
  }), {
    mcFemale: 0, cullFemale: 0, inFemale: 0, outFemale: 0, feedFemale: 0,
    mcMale: 0, cullMale: 0, inMale: 0, outMale: 0, feedMale: 0,
  }), [rows]);
  const cumulativeMortality = useMemo(() => {
    let male = 0;
    let female = 0;
    return rows.map((row) => {
      male += row.mc_male;
      female += row.mc_female;
      return { male, female };
    });
  }, [rows]);
  const exportRows = useMemo(() => {
    const feedTypeById = new Map(feedTypes.map((feedType) => [feedType.id, feedType.description ?? ""]));
    return rows.map((row, index) => ({
      age: placement ? ageOn(placement.placement_date, row.daterec) : 1,
      date: row.daterec,
      values: [
        row.inv_male, row.inv_female,
        row.mc_male, row.mc_female,
        cumulativeMortality[index]?.male ?? 0, cumulativeMortality[index]?.female ?? 0,
        row.cull_male, row.cull_female,
        row.trans_in_male, row.trans_in_female,
        row.trans_out_male, row.trans_out_female,
        row.avg_body_weight_male, row.avg_body_weight_female,
        `${row.feed_consumption_male}${row.male_feedtype_id ? ` / ${feedTypeById.get(row.male_feedtype_id) ?? ""}` : ""}`,
        `${row.feed_consumption_female}${row.female_feedtype_id ? ` / ${feedTypeById.get(row.female_feedtype_id) ?? ""}` : ""}`,
      ],
    }));
  }, [cumulativeMortality, feedTypes, placement, rows]);
  const templateRows = useMemo<BreederImportRow[]>(() => rows.map((row) => ({
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
    avg_body_weight_male: row.avg_body_weight_male,
    avg_body_weight_female: row.avg_body_weight_female,
    feed_consumption_male: row.feed_consumption_male,
    feed_consumption_female: row.feed_consumption_female,
    male_feedtype_id: row.male_feedtype_id,
    female_feedtype_id: row.female_feedtype_id,
  })), [rows]);

  function updateRow(index: number, key: keyof EditableRow, value: string | number | null) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  }

  async function save() {
    if (!placement || !rows.length) return;
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
      if (dataRows.length !== 31) throw new Error(`The import must contain exactly 31 daily rows (Day 1 through Day 31); found ${dataRows.length}.`);

      const errors: string[] = [];
      const validFeedTypeIds = new Set(feedTypes.map((feedType) => feedType.id));
      const integerFields = new Set<string>([
        "inv_male", "inv_female", "mc_male", "mc_female", "cull_male", "cull_female",
        "trans_in_male", "trans_in_female", "trans_out_male", "trans_out_female",
      ]);
      const nullableFeedFields = new Set<string>(["male_feedtype_id", "female_feedtype_id"]);
      const importedRows = dataRows.map((excelRow, index): EditableRow => {
        const rowNumber = index + 2;
        if (excelRow.slice(BREEDER_IMPORT_HEADERS.length).some((value) => value != null && String(value).trim() !== "")) {
          errors.push(`Row ${rowNumber}: contains data outside the exact ${BREEDER_IMPORT_HEADERS.length}-field template.`);
        }
        const expectedDate = addDays(placement.placement_date, index);
        const daterec = normalizeImportedDate(excelRow[0]);
        if (daterec !== expectedDate) errors.push(`Row ${rowNumber}: daterec must be ${expectedDate} for Day ${index + 1}.`);
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
        const maleOutflow = Number(typed.mc_male) + Number(typed.cull_male) + Number(typed.trans_out_male);
        const femaleOutflow = Number(typed.mc_female) + Number(typed.cull_female) + Number(typed.trans_out_female);
        if (maleOutflow > Number(typed.inv_male) + Number(typed.trans_in_male)) errors.push(`Row ${rowNumber}: male outflow exceeds available male inventory.`);
        if (femaleOutflow > Number(typed.inv_female) + Number(typed.trans_in_female)) errors.push(`Row ${rowNumber}: female outflow exceeds available female inventory.`);

        return {
          ...(rows[index]?.id ? { id: rows[index].id } : {}),
          placement_id: placement.id,
          daterec: expectedDate,
          inv_male: Number(typed.inv_male), inv_female: Number(typed.inv_female),
          mc_male: Number(typed.mc_male), mc_female: Number(typed.mc_female),
          cull_male: Number(typed.cull_male), cull_female: Number(typed.cull_female),
          trans_in_male: Number(typed.trans_in_male), trans_in_female: Number(typed.trans_in_female),
          trans_out_male: Number(typed.trans_out_male), trans_out_female: Number(typed.trans_out_female),
          avg_body_weight_male: Number(typed.avg_body_weight_male), avg_body_weight_female: Number(typed.avg_body_weight_female),
          feed_consumption_male: Number(typed.feed_consumption_male), feed_consumption_female: Number(typed.feed_consumption_female),
          male_feedtype_id: typed.male_feedtype_id == null ? null : Number(typed.male_feedtype_id),
          female_feedtype_id: typed.female_feedtype_id == null ? null : Number(typed.female_feedtype_id),
          isactive: true,
        };
      });

      if (errors.length) throw new Error(errors.slice(0, 15).join("\n"));
      const today = localDate();
      setRows((current) => importedRows.map((row, index) => row.daterec <= today ? row : current[index]));
      const ignoredFutureCount = importedRows.filter((row) => row.daterec > today).length;
      toast.success(`Excel imported for ${placement.pen_no || `Pen ${placement.id}`}.${ignoredFutureCount ? ` ${ignoredFutureCount} future rows were validated but left unchanged.` : ""}`);
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
    return (
      <td key={`${rowIndex}-${field}`} className={`fc-grid-cell ${future ? "fc-grid-cell-readonly" : "fc-grid-cell-editable"} p-0 ${groupEnd ? "fc-grid-group-divider" : "fc-grid-border-r"} ${rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider"}`}>
        <Input
          type="number"
          min="0"
          step={decimal ? "0.001" : "1"}
          value={row[field]}
          disabled={future}
          onChange={(event) => updateRow(rowIndex, field, Math.max(0, Number(event.target.value)))}
          className="h-8 rounded-none border-0 bg-transparent text-center shadow-none focus-visible:ring-0"
        />
      </td>
    );
  }

  function renderCumulativeCell(rowIndex: number, sex: "male" | "female", groupEnd = false) {
    return (
      <td key={`${rowIndex}-cumulative-${sex}`} className={`fc-grid-cell fc-grid-cell-readonly p-0 text-center font-semibold tabular-nums ${groupEnd ? "fc-grid-group-divider" : "fc-grid-border-r"} ${rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider"}`}>
        {count(cumulativeMortality[rowIndex]?.[sex] ?? 0)}
      </td>
    );
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
            step="0.001"
            value={row[consumptionField]}
            disabled={future}
            title="Feed consumption"
            onChange={(event) => updateRow(rowIndex, consumptionField, Math.max(0, Number(event.target.value)))}
            className="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent px-1 text-center shadow-none focus-visible:ring-0"
          />
          <select
            value={row[feedTypeField] ?? ""}
            disabled={future}
            title="Feed type"
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

  return (
    <div className="h-screen w-full bg-slate-100 p-4 dark:bg-background">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
        <Collapsible open={headerOpen} onOpenChange={setHeaderOpen}>
          <CollapsibleContent className="overflow-visible">
            <div className="relative border-b bg-white px-4 pb-6 pt-3 dark:bg-card">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Farm / Pen</div>
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
                  <BreederCardExportMenu
                    farm={placement.farm_name || ""}
                    building={placement.building_no || ""}
                    pen={penLabel}
                    placementDate={placement.placement_date}
                    placedBirds={placedTotal}
                    liveBirds={liveFemale + liveMale}
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
                  <div className="px-3 py-2"><div className="text-xs font-medium text-muted-foreground">Live birds</div><div className="text-base font-semibold tabular-nums">{count(liveFemale + liveMale)}</div></div>
                </div>
                <div className="w-[190px] rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
                  <div className="text-xs font-medium text-muted-foreground">Female live / losses</div>
                  <div className="text-sm font-semibold tabular-nums">{count(liveFemale)} / {count(totals.mcFemale + totals.cullFemale)}</div>
                </div>
                <div className="w-[190px] rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
                  <div className="text-xs font-medium text-muted-foreground">Male live / losses</div>
                  <div className="text-sm font-semibold tabular-nums">{count(liveMale)} / {count(totals.mcMale + totals.cullMale)}</div>
                </div>
                <div className="w-[170px] rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
                  <div className="text-xs font-medium text-muted-foreground">Daily rows</div>
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
                <div className="truncate text-xs text-muted-foreground">Placed {count(placedTotal)} | Live {count(liveFemale + liveMale)} | Rows {rows.length}</div>
              </div>
              <BreederCardExportMenu
                farm={placement.farm_name || ""}
                building={placement.building_no || ""}
                pen={penLabel}
                placementDate={placement.placement_date}
                placedBirds={placedTotal}
                liveBirds={liveFemale + liveMale}
                rows={exportRows}
                templateRows={templateRows}
                importing={importing}
                onImport={importExcel}
              />
              <Button type="button" size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save</Button>
              <Button type="button" variant="outline" size="icon-sm" onClick={() => setHeaderOpen(true)} title="Show header details" className="absolute bottom-0 left-1/2 z-[60] -translate-x-1/2 translate-y-1/2 rounded-full border bg-white shadow-md dark:bg-card">
                <ChevronDown className="size-4" />
              </Button>
            </div>
          ) : null}
        </Collapsible>

        <div className="relative flex-1 overflow-auto">
          <table className="fc-grid-table table-fixed border-separate border-spacing-0 caption-bottom text-sm" style={{ minWidth: 1780 }}>
            <colgroup>
              <col style={{ width: 132 }} /><col style={{ width: 52 }} />
              {[92, 92, 76, 76, 92, 92, 76, 76, 82, 82, 82, 82, 100, 100, 180, 180].map((width, index) => <col key={index} style={{ width }} />)}
            </colgroup>
            <thead>
              <tr style={{ height: 28 }}>
                <th rowSpan={2} className="fc-grid-header fc-grid-header-border sticky left-0 top-0 z-40 text-center text-xs" style={{ minWidth: 132 }}>Date</th>
                <th rowSpan={2} className="fc-grid-header fc-grid-age-header fc-grid-header-border sticky left-[132px] top-0 z-40 text-center text-xs" style={{ minWidth: 52 }}>Age</th>
                {[
                  "Inventory", "MC", "Cumm M/C", "Culls", "Transfer In",
                  "Transfer Out", "Grams/Birds", "FC",
                ].map((label) => (
                  <th key={label} colSpan={2} className={`${headerClass(true)} fc-grid-header-group capitalize`} style={{ top: 0 }}>{label}</th>
                ))}
              </tr>
              <tr style={{ height: 28 }}>
                {Array.from({ length: 8 }, (_, groupIndex) => ["Male", "Female"].map((label, sexIndex) => (
                  <th key={`${groupIndex}-${label}`} className={headerClass(sexIndex === 1)} style={{ top: 28 }}>{label}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.id ?? `new-${rowIndex}`} className="fc-grid-row border-0">
                  <td className={`fc-grid-age sticky left-0 z-20 p-0 text-center font-semibold ${rowDivider(rowIndex)}`} style={{ minWidth: 132 }}><Input type="date" value={row.daterec} readOnly disabled={row.daterec > localDate()} className="h-8 rounded-none border-0 bg-transparent px-1 text-center text-xs shadow-none focus-visible:ring-0 disabled:opacity-100" /></td>
                  <td className={`fc-grid-age sticky left-[132px] z-20 p-0 text-center font-semibold ${rowDivider(rowIndex)}`} style={{ minWidth: 52 }}><div className="flex h-8 items-center justify-center">{ageOn(placement.placement_date, row.daterec)}</div></td>
                  {renderNumericCell(row, rowIndex, "inv_male")}
                  {renderNumericCell(row, rowIndex, "inv_female", true)}
                  {renderNumericCell(row, rowIndex, "mc_male")}
                  {renderNumericCell(row, rowIndex, "mc_female", true)}
                  {renderCumulativeCell(rowIndex, "male")}
                  {renderCumulativeCell(rowIndex, "female", true)}
                  {renderNumericCell(row, rowIndex, "cull_male")}
                  {renderNumericCell(row, rowIndex, "cull_female", true)}
                  {renderNumericCell(row, rowIndex, "trans_in_male")}
                  {renderNumericCell(row, rowIndex, "trans_in_female", true)}
                  {renderNumericCell(row, rowIndex, "trans_out_male")}
                  {renderNumericCell(row, rowIndex, "trans_out_female", true)}
                  {renderNumericCell(row, rowIndex, "avg_body_weight_male")}
                  {renderNumericCell(row, rowIndex, "avg_body_weight_female", true)}
                  {renderFeedCell(row, rowIndex, "male")}
                  {renderFeedCell(row, rowIndex, "female", true)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="fc-grid-footer-cell sticky bottom-0 left-0 z-40 h-9 text-center font-semibold">Total</td>
                <td className="fc-grid-footer-cell fc-grid-footer-age sticky bottom-0 left-[132px] z-40 text-center font-semibold">{rows.length} days</td>
                {[
                  liveMale, liveFemale,
                  totals.mcMale, totals.mcFemale,
                  totals.mcMale, totals.mcFemale,
                  totals.cullMale, totals.cullFemale,
                  totals.inMale, totals.inFemale,
                  totals.outMale, totals.outFemale,
                  latest?.avg_body_weight_male ?? 0, latest?.avg_body_weight_female ?? 0,
                  totals.feedMale, totals.feedFemale,
                ].map((value, index) => <td key={index} className={`fc-grid-footer-cell sticky bottom-0 text-center font-semibold ${index % 2 === 1 ? "fc-grid-group-divider" : "fc-grid-border-r"}`}>{count(value)}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
