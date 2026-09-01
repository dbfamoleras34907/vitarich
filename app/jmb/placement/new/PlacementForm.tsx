"use client";

import { useEffect, useMemo, useState, type ClipboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp, Loader2, Paperclip, Save, X } from "lucide-react";
import { toast } from "sonner";
import RequiredLabel from "@/components/RequiredLabel";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import {
  createPlacement,
  createPlacementBatch,
  ensureBreederCycles,
  getPlacementById,
  getUserInfo,
  listBreederSources,
  listFarmLocationLookup,
  listPlacementHistory,
  placementHasGrowingOrLaying,
  updatePlacement,
  type FarmLocationLookup,
  type PlacementInsert,
  type Placement,
} from "./api";

type PlacementRow = {
  placement_id: number | null;
  pen_id: string;
  pen_no: string;
  f_beg: string;
  f_doa: string;
  f_reject: string;
  f_shortcount: string;
  m_beg: string;
  m_doa: string;
  m_reject: string;
  m_shortcount: string;
  f_avg_bodyw: string;
  m_avg_bodyw: string;
};

type PlacementNumericField = Exclude<keyof PlacementRow, "placement_id" | "pen_id" | "pen_no">;
type PlacementPasteColumn =
  | { kind: "numeric"; field: PlacementNumericField }
  | { kind: "locked" };

const placementPasteColumns: PlacementPasteColumn[] = [
  { kind: "locked" },
  { kind: "numeric", field: "f_beg" },
  { kind: "numeric", field: "f_doa" },
  { kind: "numeric", field: "f_reject" },
  { kind: "numeric", field: "f_shortcount" },
  { kind: "locked" },
  { kind: "numeric", field: "f_avg_bodyw" },
  { kind: "numeric", field: "m_beg" },
  { kind: "numeric", field: "m_doa" },
  { kind: "numeric", field: "m_reject" },
  { kind: "numeric", field: "m_shortcount" },
  { kind: "locked" },
  { kind: "numeric", field: "m_avg_bodyw" },
];

type FormState = {
  placement_date: string;
  cycle_no: string;
  file_attached: string;
  farm_id: string;
  farm_name: string;
  building_id: string;
  building_no: string;
  pen_count: string;
  source: string;
  remarks: string;
};

function getToday() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function createEmptyRow(index: number): PlacementRow {
  return {
    placement_id: null,
    pen_id: "",
    pen_no: String(index + 1),
    f_beg: "0",
    f_doa: "0",
    f_reject: "0",
    f_shortcount: "0",
    m_beg: "0",
    m_doa: "0",
    m_reject: "0",
    m_shortcount: "0",
    f_avg_bodyw: "0",
    m_avg_bodyw: "0",
  };
}

function clampInteger(raw: string) {
  if (raw === "") return "";
  const cleaned = raw.replace(/[^0-9]/g, "");
  if (cleaned === "") return "";
  return String(Math.max(0, Number(cleaned)));
}

function asNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatHistoryDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-CA");
}

function formatHistoryNumber(value?: number | null) {
  return Number(value ?? 0).toLocaleString("en-US");
}

function getEndingBalance(
  beg: string,
  doa: string,
  reject: string,
  shortCount: string,
) {
  return (
    asNumber(beg) - (asNumber(doa) + asNumber(reject) + asNumber(shortCount))
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
  ) {
    return error.message;
  }
  return fallback;
}

function withoutPlacementDate(payload: PlacementInsert) {
  const {
    placement_date: placementDate,
    cycle_id: cycleId,
    ...rest
  } = payload;
  void placementDate;
  void cycleId;
  return rest;
}

function parseClipboardGrid(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line, index, lines) => line !== "" || index < lines.length - 1)
    .map((line) => line.split("\t").map((value) => value.trim()));
}

const TableWidths = {
  tableMin: "min-w-[1320px]",
  pen: "w-[72px] min-w-[72px]",
  count: "w-[112px] min-w-[112px]",
  shortCount: "w-[128px] min-w-[128px]",
  ending: "w-[104px] min-w-[104px]",
  bodyWeight: "w-[120px] min-w-[120px]",
} as const;

const SheetClasses = {
  cell: "border border-slate-200 p-0 align-middle",
  header:
    "border border-slate-300 bg-slate-50 px-2 py-2 text-center text-sm font-medium text-slate-700",
  group:
    "border border-slate-300 bg-slate-100 px-2 py-2 text-left text-sm font-medium text-slate-700",
  input:
    "h-10 rounded-none border-0 bg-transparent text-center shadow-none focus-visible:ring-1 focus-visible:ring-emerald-700 focus-visible:ring-offset-0 disabled:cursor-default disabled:opacity-100",
  readOnlyInput:
    "h-10 rounded-none border-0 bg-slate-50 text-center text-slate-600 shadow-none disabled:cursor-default disabled:opacity-100",
} as const;

export default function PlacementForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const farmIdParam = searchParams.get("farmId");
  const buildingIdParam = searchParams.get("buildingId");
  const cycleNoParam = searchParams.get("cycleNo");
  const isEdit = !!idParam;

  const [saving, setSaving] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [hasDependentRecords, setHasDependentRecords] = useState(false);
  const [dependentPlacementIds, setDependentPlacementIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [locations, setLocations] = useState<FarmLocationLookup[]>([]);
  const [headerOpen, setHeaderOpen] = useState(true);
  const [form, setForm] = useState<FormState>({
    placement_date: getToday(),
    cycle_no: "1",
    file_attached: "",
    farm_id: "",
    farm_name: "",
    building_id: "",
    building_no: "",
    pen_count: "",
    source: "",
    remarks: "",
  });
  const [rows, setRows] = useState<PlacementRow[]>([]);
  const [history, setHistory] = useState<Placement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoadingSources(true);
      try {
        const sources = await listBreederSources();
        if (!mounted) return;
        setSourceOptions(sources);
      } catch {
        if (!mounted) return;
        setSourceOptions([]);
      } finally {
        if (mounted) setLoadingSources(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const lookup = await listFarmLocationLookup();
        if (!mounted) return;
        setLocations(lookup);
      } catch {
        if (!mounted) return;
        setLocations([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!form.farm_id || !locations.length) return;

    const match = locations.find(
      (location) =>
        String(location.farm_id) === form.farm_id &&
        (!form.building_no || location.building_no === form.building_no),
    );

    if (!match || match.farm_name === form.farm_name) return;

    setForm((prev) => ({
      ...prev,
      farm_name: match.farm_name,
    }));
  }, [form.building_no, form.farm_id, form.farm_name, locations]);

  useEffect(() => {
    if (form.farm_id || !form.farm_name || !locations.length) return;

    const match = locations.find(
      (location) =>
        location.farm_name === form.farm_name &&
        (!form.building_no || location.building_no === form.building_no),
    );

    if (!match) return;

    setForm((prev) => ({
      ...prev,
      farm_id: prev.farm_id || String(match.farm_id),
    }));
  }, [form.building_no, form.farm_id, form.farm_name, locations]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await getUserInfo();
        const farm = data?.[0];

        if (!mounted || !farm?.name) return;

        setForm((prev) => ({
          ...prev,
          farm_id: prev.farm_id || (farm?.id ? String(farm.id) : ""),
          farm_name: prev.farm_name || farm.name,
        }));
      } catch {
        // Keep the form usable even if default farm lookup fails.
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isEdit) return;

    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      alert("Invalid placement id.");
      router.push("/jmb/placement");
      return;
    }

    let mounted = true;

    (async () => {
      setLoadingRecord(true);
      try {
        const record = await getPlacementById(id);
        const buildingRecords = await listPlacementHistory({
          farmId: record.farm_id,
          buildingId: record.building_id,
        });
        const placementRecords = buildingRecords
          .filter(
            (candidate) => candidate.placement_date === record.placement_date,
          )
          .sort(
            (left, right) =>
              left.pen_no.localeCompare(right.pen_no, undefined, {
                numeric: true,
              }) || left.id - right.id,
          );
        const records = placementRecords.length ? placementRecords : [record];
        const lockResults = await Promise.all(
          records.map(async (candidate) => ({
            id: candidate.id,
            locked: await placementHasGrowingOrLaying(candidate.id),
          })),
        );
        if (!mounted) return;

        const lockedIds = new Set(
          lockResults.filter((result) => result.locked).map((result) => result.id),
        );
        setDependentPlacementIds(lockedIds);
        setHasDependentRecords(lockedIds.size > 0);
        setForm({
          placement_date: record.placement_date ?? getToday(),
          cycle_no: record.cycle_no == null ? "1" : String(record.cycle_no),
          file_attached: record.file_attached ?? "",
          farm_id: String(record.farm_id),
          farm_name: record.farm_name ?? "",
          building_id: String(record.building_id),
          building_no: record.building_no ?? "",
          pen_count: String(records.length),
          source: record.f_source ?? record.m_source ?? "",
          remarks: record.remarks ?? "",
        });

        setRows(
          records.map((candidate) => ({
            placement_id: candidate.id,
            pen_id: String(candidate.pen_id),
            pen_no: candidate.pen_no ?? "",
            f_beg: String(candidate.f_beg ?? 0),
            f_doa: String(candidate.f_doa ?? 0),
            f_reject: String(candidate.f_reject ?? 0),
            f_shortcount: String(candidate.f_shortcount ?? 0),
            m_beg: String(candidate.m_beg ?? 0),
            m_doa: String(candidate.m_doa ?? 0),
            m_reject: String(candidate.m_reject ?? 0),
            m_shortcount: String(candidate.m_shortcount ?? 0),
            f_avg_bodyw: String(candidate.f_avg_bodyw ?? 0),
            m_avg_bodyw: String(candidate.m_avg_bodyw ?? 0),
          })),
        );
      } catch (error: unknown) {
        alert(getErrorMessage(error, "Failed to load placement record."));
        router.push("/jmb/placement");
      } finally {
        if (mounted) setLoadingRecord(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [idParam, isEdit, router]);

  const totalPens = useMemo(() => rows.length, [rows]);
  const disabledAll = saving || loadingRecord;
  const disablePlacementDate = disabledAll || (isEdit && hasDependentRecords);

  useEffect(() => {
    const farmId = Number(form.farm_id);
    const buildingId = Number(form.building_id);
    if (!Number.isFinite(farmId) || !Number.isFinite(buildingId) || !farmId || !buildingId) {
      setHistory([]);
      return;
    }

    let cancelled = false;
    setLoadingHistory(true);
    listPlacementHistory({ farmId, buildingId })
      .then((records) => {
        if (!cancelled) setHistory(records);
      })
      .catch((error) => {
        console.error("Unable to load placement history.", error);
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => { cancelled = true; };
  }, [form.building_id, form.farm_id]);

  useEffect(() => {
    if (isEdit || !farmIdParam || !buildingIdParam || !locations.length) return;
    const location = locations.find(
      (item) =>
        String(item.farm_id) === farmIdParam &&
        String(item.building_id) === buildingIdParam,
    );
    if (!location) return;

    const buildingLocations = locations.filter(
      (item) => item.building_id === location.building_id,
    );
    const nextRows = buildRowsFromPens(buildingLocations);
    setForm((prev) => {
      const nextForm = {
        ...prev,
        farm_id: String(location.farm_id),
        farm_name: location.farm_name,
        building_id: String(location.building_id),
        building_no: location.building_no,
        pen_count: String(nextRows.length),
        cycle_no:
          cycleNoParam && Number(cycleNoParam) > 0
            ? String(Math.trunc(Number(cycleNoParam)))
            : prev.cycle_no,
      };
      return nextForm;
    });
    setRows(nextRows);
  }, [buildingIdParam, cycleNoParam, farmIdParam, isEdit, locations]);
  const breederSourceOptions = useMemo(() => {
    const values = new Set(sourceOptions);
    if (form.source.trim()) values.add(form.source.trim());
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [form.source, sourceOptions]);

  function buildRowsFromPens(pens: FarmLocationLookup[]) {
    const uniquePens = Array.from(
      new Map(pens.map((pen) => [pen.pen_id, pen])).values(),
    );

    return uniquePens.map((pen, index) => ({
      ...createEmptyRow(index),
      pen_id: String(pen.pen_id),
      pen_no: pen.pen_no,
    }));
  }

  function handleRowChange(
    index: number,
    field: keyof PlacementRow,
    value: string,
  ) {
    setRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]:
                field.includes("_beg") ||
                field.includes("_doa") ||
                field.includes("_reject") ||
                field.includes("shortcount")
                  ? clampInteger(value)
                  : field === "f_avg_bodyw" || field === "m_avg_bodyw"
                    ? clampInteger(value)
                  : value,
            }
          : row,
      ),
    );
  }

  function handlePlacementGridKeyDown(event: React.KeyboardEvent<HTMLTableElement>) {
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    const offset = movement[event.key];
    if (!offset) return;

    const target = event.target as HTMLElement;
    const currentCell = target.closest("td");
    const currentRow = currentCell?.parentElement;
    const tableBody = currentRow?.parentElement;
    if (!currentCell || !currentRow || !tableBody || tableBody.tagName !== "TBODY") return;

    const tableRows = Array.from(tableBody.querySelectorAll("tr"));
    const rowCells = Array.from(currentRow.querySelectorAll("td"));
    const rowIndex = tableRows.indexOf(currentRow as HTMLTableRowElement);
    const columnIndex = rowCells.indexOf(currentCell as HTMLTableCellElement);
    const nextRow = tableRows[rowIndex + offset[0]];
    let nextColumnIndex = columnIndex + offset[1];
    let nextInput: HTMLInputElement | null = null;
    while (nextRow && nextColumnIndex >= 0 && nextColumnIndex < rowCells.length) {
      const nextCell = nextRow.querySelectorAll("td")[nextColumnIndex];
      nextInput = nextCell?.querySelector<HTMLInputElement>("input:not([disabled])") ?? null;
      if (nextInput || offset[1] === 0) break;
      nextColumnIndex += offset[1];
    }
    if (!nextInput) return;

    event.preventDefault();
    nextInput.focus();
    nextInput.select();
  }

  function handlePlacementGridPaste(event: ClipboardEvent<HTMLTableElement>) {
    if (disabledAll) return;
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;

    const target = event.target as HTMLElement;
    const currentCell = target.closest("td");
    const currentRow = currentCell?.parentElement;
    const tableBody = currentRow?.parentElement;
    if (!currentCell || !currentRow || !tableBody || tableBody.tagName !== "TBODY") return;

    const tableRows = Array.from(tableBody.querySelectorAll("tr"));
    const rowCells = Array.from(currentRow.querySelectorAll("td"));
    const startRowIndex = tableRows.indexOf(currentRow as HTMLTableRowElement);
    const startColumnIndex = rowCells.indexOf(currentCell as HTMLTableCellElement);
    if (startRowIndex < 0 || startColumnIndex < 0) return;

    event.preventDefault();
    const pastedRows = parseClipboardGrid(text);
    const nextRows = rows.map((row) => ({ ...row }));
    let changedCellCount = 0;
    let skippedLockedCellCount = 0;
    let invalidCellCount = 0;

    pastedRows.forEach((pastedRow, pastedRowIndex) => {
      const targetRowIndex = startRowIndex + pastedRowIndex;
      const targetRow = nextRows[targetRowIndex];
      if (!targetRow) return;

      pastedRow.forEach((rawValue, pastedColumnIndex) => {
        const column = placementPasteColumns[startColumnIndex + pastedColumnIndex];
        if (!column) return;
        if (column.kind === "locked") {
          skippedLockedCellCount += 1;
          return;
        }

        const normalizedValue = rawValue.replace(/,/g, "").trim();
        if (normalizedValue === "") {
          targetRow[column.field] = "";
          changedCellCount += 1;
          return;
        }
        const parsedValue = Number(normalizedValue);
        if (!Number.isSafeInteger(parsedValue) || parsedValue < 0) {
          invalidCellCount += 1;
          return;
        }
        targetRow[column.field] = String(parsedValue);
        changedCellCount += 1;
      });
    });

    if (!changedCellCount) {
      toast.error(
        invalidCellCount
          ? "No cells were pasted because the copied values are invalid."
          : skippedLockedCellCount
            ? "The pasted Placement Details cells are read-only."
            : "No editable cells found in pasted data.",
      );
      return;
    }

    setRows(nextRows);
    const notes = [
      invalidCellCount ? `${invalidCellCount} invalid skipped` : "",
      skippedLockedCellCount ? `${skippedLockedCellCount} read-only skipped` : "",
    ].filter(Boolean);
    toast.success(`Pasted ${changedCellCount} cell${changedCellCount === 1 ? "" : "s"}${notes.length ? `. ${notes.join(", ")}.` : "."}`);
  }

  function renderSourceSelect(
    value: string,
    onValueChange: (nextValue: string) => void,
  ) {
    return (
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={saving}
      >
        <SelectTrigger className="w-full min-w-0 max-w-full overflow-hidden">
          <SelectValue
            className="truncate"
            placeholder={loadingSources ? "Loading..." : "Select source"}
          />
        </SelectTrigger>
        <SelectContent>
          {breederSourceOptions.length ? (
            breederSourceOptions.map((source) => (
              <SelectItem key={source} value={source}>
                {source}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="__no_source_options__" disabled>
              No active sources
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    );
  }

  async function onSave() {
    if (!form.placement_date) {
      alert("Placement date is required.");
      return;
    }
    const cycleNumber = Number(form.cycle_no);
    if (!Number.isInteger(cycleNumber) || cycleNumber <= 0) {
      alert("Cycle number must be a positive whole number.");
      return;
    }
    if (!form.farm_name.trim()) {
      alert("Farm name is required.");
      return;
    }
    if (!form.farm_id.trim()) {
      alert("Farm is required.");
      return;
    }
    if (!form.building_no.trim()) {
      alert("Building number is required.");
      return;
    }
    if (!form.building_id.trim()) {
      alert("Building is required.");
      return;
    }
    if (!rows.length) {
      alert("Please enter the number of pens to generate rows.");
      return;
    }
    if (rows.some((row) => !row.pen_no.trim())) {
      alert("Every row must have a Pen number.");
      return;
    }
    if (rows.some((row) => !row.pen_id.trim())) {
      alert("Every placement row must be linked to a valid Pen.");
      return;
    }

    setSaving(true);
    try {
      const cycleIdByPenId = await ensureBreederCycles({
        farmId: asNumber(form.farm_id),
        buildingId: asNumber(form.building_id),
        penIds: rows.map((row) => asNumber(row.pen_id)),
        cycleNumber,
      });
      const payloads: PlacementInsert[] = rows.map((row) => ({
        placement_date: form.placement_date,
        dr_no: "",
        file_attached: form.file_attached.trim() || null,
        farm_id: asNumber(form.farm_id),
        building_id: asNumber(form.building_id),
        pen_id: asNumber(row.pen_id),
        farm_name: form.farm_name.trim(),
        building_no: form.building_no.trim(),
        pen_no: row.pen_no.trim(),
        f_source: form.source.trim() || null,
        f_beg: asNumber(row.f_beg),
        f_doa: asNumber(row.f_doa),
        f_reject: asNumber(row.f_reject),
        f_shortcount: asNumber(row.f_shortcount),
        m_source: form.source.trim() || null,
        m_beg: asNumber(row.m_beg),
        m_doa: asNumber(row.m_doa),
        m_reject: asNumber(row.m_reject),
        m_shortcount: asNumber(row.m_shortcount),
        f_avg_bodyw: asNumber(row.f_avg_bodyw),
        m_avg_bodyw: asNumber(row.m_avg_bodyw),
        remarks: form.remarks.trim() || null,
        cycle_id: cycleIdByPenId.get(asNumber(row.pen_id)) ?? null,
      }));

      if (isEdit) {
        if (rows.some((row) => row.placement_id == null)) {
          throw new Error("One or more placement rows are missing their record id.");
        }
        await Promise.all(
          rows.map((row, index) => {
            const placementId = row.placement_id as number;
            const payload = payloads[index];
            return updatePlacement(
              placementId,
              dependentPlacementIds.has(placementId)
                ? withoutPlacementDate(payload)
                : payload,
            );
          }),
        );
      } else if (payloads.length === 1) {
        await createPlacement(payloads[0]);
      } else {
        await createPlacementBatch(payloads);
      }

      router.push("/jmb/placement");
      router.refresh();
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Failed to save placement."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-screen w-full bg-slate-100 p-4 dark:bg-background">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
        <Collapsible open={headerOpen} onOpenChange={setHeaderOpen} className="shrink-0">
          <CollapsibleContent className="overflow-visible">
        <header className="relative border-b bg-white px-4 pb-6 pt-3 dark:bg-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Farm / Placement
              </div>
              <h1 className="truncate text-lg font-semibold text-foreground">
                {isEdit ? "Edit Placement" : "New Placement"}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {form.farm_name || "Select farm"} &gt; {form.building_no || "Select building"}
                {form.pen_count ? ` · ${form.pen_count} pen${asNumber(form.pen_count) === 1 ? "" : "s"}` : ""}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/jmb/placement")}
                disabled={saving}
              >
                <X className="size-4" />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void onSave()}
                disabled={saving || disabledAll}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-stretch gap-2 border-t pt-3">
            <div className="min-w-[210px] rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
              <div className="text-xs font-medium text-muted-foreground">Farm</div>
              <div className="truncate text-sm font-semibold">{form.farm_name || "Select farm"}</div>
            </div>
            <div className="min-w-[190px] rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
              <div className="text-xs font-medium text-muted-foreground">Building</div>
              <div className="truncate text-sm font-semibold">{form.building_no || "Select building"}</div>
            </div>
            <div className="min-w-[130px] rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
              <div className="text-xs font-medium text-muted-foreground">Total pens</div>
              <div className="text-sm font-semibold tabular-nums">{totalPens.toLocaleString("en-PH")}</div>
            </div>
            <div className="min-w-[150px] rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
              <div className="text-xs font-medium text-muted-foreground">Placement date</div>
              <div className="text-sm font-semibold tabular-nums">{form.placement_date || "-"}</div>
            </div>
            <div className="min-w-[140px] rounded-md border bg-slate-50 px-3 py-2 dark:bg-background/40">
              <div className="text-xs font-medium text-muted-foreground">Cycle number</div>
              <div className="text-sm font-semibold tabular-nums">{form.cycle_no || "-"}</div>
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
        </header>
          </CollapsibleContent>

          {!headerOpen ? (
            <div className="relative flex min-h-14 items-center gap-3 border-b bg-white px-4 pb-4 pt-2 dark:bg-card">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">
                  {form.farm_name || "Select farm"} &gt; {form.building_no || "Select building"} &gt; {isEdit ? "Edit Placement" : "New Placement"}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {totalPens.toLocaleString("en-PH")} pens | Date {form.placement_date || "-"} | Cycle {form.cycle_no || "-"}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push("/jmb/placement")}
                disabled={saving}
              >
                <X className="size-4" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void onSave()}
                disabled={saving || disabledAll}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
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

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 dark:bg-background/40">
          <div className="mx-auto max-w-[1800px] overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm dark:border-border dark:bg-card">
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <RequiredLabel>Placement Date</RequiredLabel>
                <Input
                  type="date"
                  value={form.placement_date}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      placement_date: e.target.value,
                    }))
                  }
                  disabled={disablePlacementDate}
                />
              </div>

              <div className="space-y-2">
                <RequiredLabel>Cycle Number</RequiredLabel>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.cycle_no}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      cycle_no: clampInteger(e.target.value),
                    }))
                  }
                  disabled={
                    disabledAll ||
                    !!cycleNoParam ||
                    (isEdit && hasDependentRecords)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  File Attach
                </Label>
                <Input
                  type="file"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      file_attached: e.target.files?.[0]?.name ?? "",
                    }))
                  }
                  disabled={disabledAll}
                />
                {form.file_attached ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5" />
                    Selected: {form.file_attached}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <RequiredLabel>Source of Birds</RequiredLabel>
                {renderSourceSelect(form.source, (nextValue) =>
                  setForm((prev) => ({
                    ...prev,
                    source: nextValue,
                  })),
                )}
              </div>

              <div className="space-y-2 md:col-span-2 xl:col-span-3">
                <Label>Remarks</Label>
                <Textarea
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      remarks: e.target.value,
                    }))
                  }
                  disabled={disabledAll}
                  className="min-h-10"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Placement Details</h3>
                  <p className="text-xs text-muted-foreground">
                    Total rows generated: {totalPens}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-300 bg-white">
                <table
                  className={`w-full ${TableWidths.tableMin} border-collapse table-fixed text-sm`}
                  onKeyDownCapture={handlePlacementGridKeyDown}
                  onPasteCapture={handlePlacementGridPaste}
                >
                  <thead>
                    <tr>
                      <th
                        rowSpan={2}
                        className={`${SheetClasses.header} ${TableWidths.pen}`}
                      >
                        Pen #
                      </th>
                      <th
                        colSpan={6}
                        className={`${SheetClasses.group} !bg-pink-100 text-pink-800`}
                      >
                        Female
                      </th>
                      <th
                        colSpan={6}
                        className={`${SheetClasses.group} !bg-sky-100 text-sky-800`}
                      >
                        Male
                      </th>
                    </tr>
                    <tr>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.count} !bg-pink-50`}
                      >
                        Total Placement
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.count} !bg-pink-50`}
                      >
                        DOA
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.count} !bg-pink-50`}
                      >
                        Rejects
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.shortCount} !bg-pink-50`}
                      >
                        Short Count
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.ending} !bg-pink-50`}
                      >
                        Ending
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.bodyWeight} !bg-pink-50`}
                      >
                        AVG Body W
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.count} !bg-sky-50`}
                      >
                        Total Placement
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.count} !bg-sky-50`}
                      >
                        DOA
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.count} !bg-sky-50`}
                      >
                        Rejects
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.shortCount} !bg-sky-50`}
                      >
                        Short Count
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.ending} !bg-sky-50`}
                      >
                        Ending
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.bodyWeight} !bg-sky-50`}
                      >
                        AVG Body W
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length ? (
                      rows.map((row, index) => {
                        const femaleEnding = getEndingBalance(
                          row.f_beg,
                          row.f_doa,
                          row.f_reject,
                          row.f_shortcount,
                        );
                        const maleEnding = getEndingBalance(
                          row.m_beg,
                          row.m_doa,
                          row.m_reject,
                          row.m_shortcount,
                        );

                        return (
                          <tr
                            key={`${row.pen_no}-${index}`}
                            className="even:bg-white odd:bg-emerald-50/40"
                          >
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.pen} bg-slate-50`}
                            >
                              <Input
                                value={row.pen_no}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    "pen_no",
                                    e.target.value,
                                  )
                                }
                                readOnly
                                className={SheetClasses.readOnlyInput}
                              />
                            </td>
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.count}`}
                            >
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={asNumber(row.f_beg).toLocaleString(
                                  "en-US",
                                )}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    "f_beg",
                                    e.target.value.replace(/,/g, ""),
                                  )
                                }
                                disabled={disabledAll}
                                className={SheetClasses.input}
                              />
                            </td>
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.count}`}
                            >
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={asNumber(row.f_doa).toLocaleString(
                                  "en-US",
                                )}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    "f_doa",
                                    e.target.value.replace(/,/g, ""),
                                  )
                                }
                                disabled={disabledAll}
                                className={SheetClasses.input}
                              />
                            </td>
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.count}`}
                            >
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={asNumber(row.f_reject).toLocaleString(
                                  "en-US",
                                )}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    "f_reject",
                                    e.target.value.replace(/,/g, ""),
                                  )
                                }
                                disabled={disabledAll}
                                className={SheetClasses.input}
                              />
                            </td>
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.shortCount}`}
                            >
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={asNumber(
                                  row.f_shortcount,
                                ).toLocaleString("en-US")}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    "f_shortcount",
                                    e.target.value.replace(/,/g, ""),
                                  )
                                }
                                disabled={disabledAll}
                                className={SheetClasses.input}
                              />
                            </td>
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.ending}`}
                            >
                              <Input
                                value={femaleEnding.toLocaleString("en-US")}
                                readOnly
                                disabled
                                className={SheetClasses.readOnlyInput}
                              />
                            </td>
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.bodyWeight}`}
                            >
                              <Input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="1"
                                value={row.f_avg_bodyw}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    "f_avg_bodyw",
                                    e.target.value,
                                  )
                                }
                                disabled={disabledAll}
                                className={SheetClasses.input}
                              />
                            </td>
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.count}`}
                            >
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={asNumber(row.m_beg).toLocaleString(
                                  "en-US",
                                )}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    "m_beg",
                                    e.target.value.replace(/,/g, ""),
                                  )
                                }
                                disabled={disabledAll}
                                className={SheetClasses.input}
                              />
                            </td>
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.count}`}
                            >
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={asNumber(row.m_doa).toLocaleString(
                                  "en-US",
                                )}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    "m_doa",
                                    e.target.value.replace(/,/g, ""),
                                  )
                                }
                                disabled={disabledAll}
                                className={SheetClasses.input}
                              />
                            </td>
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.count}`}
                            >
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={asNumber(row.m_reject).toLocaleString(
                                  "en-US",
                                )}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    "m_reject",
                                    e.target.value.replace(/,/g, ""),
                                  )
                                }
                                disabled={disabledAll}
                                className={SheetClasses.input}
                              />
                            </td>
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.shortCount}`}
                            >
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={asNumber(
                                  row.m_shortcount,
                                ).toLocaleString("en-US")}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    "m_shortcount",
                                    e.target.value.replace(/,/g, ""),
                                  )
                                }
                                disabled={disabledAll}
                                className={SheetClasses.input}
                              />
                            </td>
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.ending}`}
                            >
                              <Input
                                value={maleEnding.toLocaleString("en-US")}
                                readOnly
                                disabled
                                className={SheetClasses.readOnlyInput}
                              />
                            </td>
                            <td
                              className={`${SheetClasses.cell} ${TableWidths.bodyWeight}`}
                            >
                              <Input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="1"
                                value={row.m_avg_bodyw}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    "m_avg_bodyw",
                                    e.target.value,
                                  )
                                }
                                disabled={disabledAll}
                                className={SheetClasses.input}
                              />
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={13}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          Select a farm and building above to generate placement
                          rows.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <Separator className="mt-6" />

            <div className="space-y-3 p-5">
              <div>
                <h3 className="text-sm font-medium">Placement History</h3>
                <p className="text-xs text-muted-foreground">
                  {form.farm_name && form.building_no
                    ? `Showing previous placements for ${form.farm_name} / ${form.building_no}.`
                    : "Select a farm and building to show placement history."}
                </p>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[1050px] text-sm">
                  <thead className="bg-emerald-50">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Cycle #</th>
                      <th className="px-3 py-2 text-left font-medium">Pen</th>
                      <th className="px-3 py-2 text-left font-medium">Source of Birds</th>
                      <th className="px-3 py-2 text-right font-medium">Female Placement</th>
                      <th className="px-3 py-2 text-right font-medium">Female Ending</th>
                      <th className="px-3 py-2 text-right font-medium">Male Placement</th>
                      <th className="px-3 py-2 text-right font-medium">Male Ending</th>
                      <th className="px-3 py-2 text-left font-medium">Date Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHistory ? (
                      <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">Loading placement history...</td></tr>
                    ) : history.length ? (
                      history.map((record) => {
                        const femaleEnding = record.f_endingbalance ?? record.f_beg - record.f_doa - record.f_reject - record.f_shortcount;
                        const maleEnding = record.m_endingbalance ?? record.m_beg - record.m_doa - record.m_reject - record.m_shortcount;
                        return (
                          <tr key={record.id} className="border-b last:border-0">
                            <td className="px-3 py-2 tabular-nums">{formatHistoryDate(record.placement_date)}</td>
                            <td className="px-3 py-2 font-medium tabular-nums">{record.cycle_no ?? "-"}</td>
                            <td className="px-3 py-2">{record.pen_no}</td>
                            <td className="px-3 py-2">{record.f_source ?? record.m_source ?? ""}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatHistoryNumber(record.f_beg)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatHistoryNumber(femaleEnding)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatHistoryNumber(record.m_beg)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatHistoryNumber(maleEnding)}</td>
                            <td className="px-3 py-2 tabular-nums">{formatHistoryDate(record.created_at)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">No placement history found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
