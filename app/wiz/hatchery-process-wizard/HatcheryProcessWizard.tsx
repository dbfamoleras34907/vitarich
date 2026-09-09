"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  Check,
  ChevronRight,
  ClipboardCopy,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import Breadcrumb from "@/lib/Breadcrumb";
import { usePermission } from "@/hooks/usePermission";
import { useAllowedFarms } from "@/hooks/useAllowedFarms";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/numberFormat";
import { voidHatcheryProcessWizardRecord } from "@/lib/data/mutations/hatcheryProcessWizard";
import {
  getHatcheryProcessWizardData,
  HATCHERY_WIZARD_STAGES,
  type HatcheryWizardClassification,
  type HatcheryWizardData,
  type HatcheryWizardStage,
  type HatcheryWizardStageRecord,
} from "@/lib/data/repositories/hatcheryProcessWizard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import HatcheryWizardInlineEditor from "./HatcheryWizardInlineEditor";

const STAGE_META: Record<
  HatcheryWizardStage,
  {
    label: string;
    shortLabel: string;
    route: string;
    next?: HatcheryWizardStage;
  }
> = {
  storage: {
    label: "Egg Storage",
    shortLabel: "Storage",
    route: "/jmb/eggstorage",
    next: "pre_warming",
  },
  pre_warming: {
    label: "Egg Pre-Warming",
    shortLabel: "Pre-Warming",
    route: "/jmb/prewarmingv2",
    next: "setter",
  },
  setter: {
    label: "Egg Setter",
    shortLabel: "Setter",
    route: "/jmb/eggsetter",
    next: "transfer",
  },
  transfer: {
    label: "Egg Transfer",
    shortLabel: "Transfer",
    route: "/jmb/eggtransferv2",
    next: "hatcher",
  },
  hatcher: {
    label: "Egg Hatcher",
    shortLabel: "Hatcher",
    route: "/jmb/egghatcherv2",
    next: "pullout",
  },
  pullout: {
    label: "Chick Pullout",
    shortLabel: "Chick Pullout",
    route: "/jmb/chickpulloutv2",
  },
};

const RECORD_COLUMNS: Record<
  HatcheryWizardStage,
  Array<{ key: string; label: string; date?: boolean }>
> = {
  storage: [
    { key: "stor_temp", label: "Storage Temp" },
    { key: "room_temp", label: "Room Temp" },
    { key: "stor_humi", label: "Humidity %" },
    { key: "shell_start", label: "Shell Temp Start", date: true },
    { key: "shell_end", label: "Shell Temp End", date: true },
    { key: "remarks", label: "Remarks" },
  ],
  pre_warming: [
    { key: "pre_temp", label: "Pre-Warming Temp" },
    { key: "egg_temp", label: "Egg Shell Temp" },
    { key: "egg_temp_time_start", label: "Start Time", date: true },
    { key: "egg_temp_time_end", label: "End Time", date: true },
    { key: "remarks", label: "Remarks" },
  ],
  setter: [
    { key: "setting_date", label: "Setting Date", date: true },
    { key: "machine_id", label: "Machine" },
    { key: "total_eggs", label: "Hatching Eggs" },
    { key: "qty_set_egg", label: "Qty Set" },
    { key: "setter_temp", label: "Temperature" },
    { key: "setter_humidity", label: "Humidity" },
    { key: "egg_shell_orientation", label: "Orientation" },
  ],
  transfer: [
    { key: "trans_date_start", label: "Transfer Start", date: true },
    { key: "trans_date_end", label: "Transfer End", date: true },
    { key: "num_bangers", label: "Bangers" },
    { key: "total_egg_transfer", label: "Egg Transferred" },
  ],
  hatcher: [
    { key: "daterec", label: "Date Received", date: true },
    { key: "machine_no", label: "Machine" },
    { key: "hatch_temp", label: "Temperature" },
    { key: "hatch_humidity", label: "Humidity" },
    { key: "hatch_time_start", label: "Hatch Start", date: true },
    { key: "hatch_time_end", label: "Hatch End", date: true },
    { key: "hatch_window", label: "Hatch Window" },
    { key: "total_egg", label: "Egg Loaded" },
  ],
  pullout: [
    { key: "machine_no", label: "Machine" },
    { key: "hatch_date", label: "Hatch Date", date: true },
    { key: "chicks_hatched", label: "Chicks Hatched" },
    { key: "dead_in_shell", label: "Dead-In-Shell" },
    { key: "hatch_fertile", label: "Hatch of Fertile %" },
    { key: "mortality_rate", label: "Mortality %" },
    { key: "hatch_window", label: "Hatch Window" },
  ],
};

type StagePermissions = Record<
  HatcheryWizardStage,
  { insertDenied: boolean; editDenied: boolean; voidDenied: boolean }
>;

type VoidTarget = {
  record: HatcheryWizardStageRecord;
  label: string;
} | null;

function activeRecords(records: HatcheryWizardStageRecord[]) {
  return records.filter((record) => !record.isVoided);
}

function displayDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: value.includes("T") ? "2-digit" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
  }).format(date);
}

function wizardHref(ref: string, stage: HatcheryWizardStage) {
  const params = new URLSearchParams({ ref, step: stage });
  return `/wiz/hatchery-process-wizard?${params.toString()}`;
}

function displayRecordValue(value: unknown, asDate = false) {
  if (value === null || value === undefined || value === "") return "-";
  if (asDate) return displayDate(String(value));
  if (typeof value === "number") return value.toLocaleString("en-PH");
  return String(value);
}

function statusForStage(
  stage: HatcheryWizardStage,
  recordsByStage: Record<HatcheryWizardStage, HatcheryWizardStageRecord[]>,
) {
  const records = recordsByStage[stage];
  const active = activeRecords(records);
  if (active.length) return { label: "Completed", tone: "completed" as const };
  if (records.length) return { label: "Voided", tone: "voided" as const };

  const index = HATCHERY_WIZARD_STAGES.indexOf(stage);
  const previousComplete = HATCHERY_WIZARD_STAGES.slice(0, index).every(
    (key) => activeRecords(recordsByStage[key]).length > 0,
  );
  return previousComplete
    ? { label: "In Progress", tone: "progress" as const }
    : { label: "Not Started", tone: "pending" as const };
}

function StatusBadge({
  label,
  tone,
  count,
}: {
  label: string;
  tone: "completed" | "voided" | "progress" | "pending";
  count?: number;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 whitespace-nowrap px-1.5 text-[11px] font-medium",
        tone === "completed" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
        tone === "voided" &&
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
        tone === "progress" &&
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
        tone === "pending" && "text-muted-foreground",
      )}
    >
      {label}
      {count && count > 1 ? ` (${count})` : ""}
    </Badge>
  );
}

function HeaderMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background px-2.5 py-1.5">
      <div className="text-[11px] leading-4 text-muted-foreground">{label}</div>
      <div className="font-medium tabular-nums text-foreground">{value}</div>
    </div>
  );
}

export default function HatcheryProcessWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const allowedFarms = useAllowedFarms();
  const selectedRefParam = searchParams.get("ref")?.trim() ?? "";
  const stepParam = searchParams.get("step") as HatcheryWizardStage | null;

  const wizardViewDenied = usePermission("/wiz/hatchery-process-wizard/view");
  const docClassificationInsertDenied = usePermission("/jmb/docclassification/insert");
  const storageInsertDenied = usePermission("/jmb/eggstorage/insert");
  const storageEditDenied = usePermission("/jmb/eggstorage/edit");
  const storageVoidDenied = usePermission("/jmb/eggstorage/void");
  const preWarmingInsertDenied = usePermission("/jmb/prewarmingv2/insert");
  const preWarmingEditDenied = usePermission("/jmb/prewarmingv2/edit");
  const preWarmingVoidDenied = usePermission("/jmb/prewarmingv2/void");
  const setterInsertDenied = usePermission("/jmb/eggsetter/insert");
  const setterEditDenied = usePermission("/jmb/eggsetter/edit");
  const setterVoidDenied = usePermission("/jmb/eggsetter/void");
  const transferInsertDenied = usePermission("/jmb/eggtransferv2/insert");
  const transferEditDenied = usePermission("/jmb/eggtransferv2/edit");
  const transferVoidDenied = usePermission("/jmb/eggtransferv2/void");
  const hatcherInsertDenied = usePermission("/jmb/egghatcherv2/insert");
  const hatcherEditDenied = usePermission("/jmb/egghatcherv2/edit");
  const hatcherVoidDenied = usePermission("/jmb/egghatcherv2/void");
  const pulloutInsertDenied = usePermission("/jmb/chickpulloutv2/insert");
  const pulloutEditDenied = usePermission("/jmb/chickpulloutv2/edit");
  const pulloutVoidDenied = usePermission("/jmb/chickpulloutv2/void");

  const permissions: StagePermissions = useMemo(
    () => ({
      storage: {
        insertDenied: storageInsertDenied,
        editDenied: storageEditDenied,
        voidDenied: storageVoidDenied,
      },
      pre_warming: {
        insertDenied: preWarmingInsertDenied,
        editDenied: preWarmingEditDenied,
        voidDenied: preWarmingVoidDenied,
      },
      setter: {
        insertDenied: setterInsertDenied,
        editDenied: setterEditDenied,
        voidDenied: setterVoidDenied,
      },
      transfer: {
        insertDenied: transferInsertDenied,
        editDenied: transferEditDenied,
        voidDenied: transferVoidDenied,
      },
      hatcher: {
        insertDenied: hatcherInsertDenied,
        editDenied: hatcherEditDenied,
        voidDenied: hatcherVoidDenied,
      },
      pullout: {
        insertDenied: pulloutInsertDenied,
        editDenied: pulloutEditDenied,
        voidDenied: pulloutVoidDenied,
      },
    }),
    [
      hatcherEditDenied,
      hatcherInsertDenied,
      hatcherVoidDenied,
      preWarmingEditDenied,
      preWarmingInsertDenied,
      preWarmingVoidDenied,
      pulloutEditDenied,
      pulloutInsertDenied,
      pulloutVoidDenied,
      setterEditDenied,
      setterInsertDenied,
      setterVoidDenied,
      storageEditDenied,
      storageInsertDenied,
      storageVoidDenied,
      transferEditDenied,
      transferInsertDenied,
      transferVoidDenied,
    ],
  );

  const [data, setData] = useState<HatcheryWizardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [workspaceMaximized, setWorkspaceMaximized] = useState(false);
  const [voidTarget, setVoidTarget] = useState<VoidTarget>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [editor, setEditor] = useState<{
    mode: "add" | "edit";
    record?: HatcheryWizardStageRecord;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const farmIds = allowedFarms.map((farm) => Number(farm.id));
      const result = await getHatcheryProcessWizardData({
        farmIds: farmIds.length ? farmIds : undefined,
      });
      setData(result);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load Hatchery Process Wizard.",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [allowedFarms]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (wizardViewDenied) router.replace("/a_dean/hatchery");
  }, [router, wizardViewDenied]);

  const classifications = useMemo(() => data?.classifications ?? [], [data]);
  const selectedClassification = classifications.find(
    (row) => row.classificationRefNo === selectedRefParam,
  );

  const recordsForSelectedRef = useMemo(() => {
    return Object.fromEntries(
      HATCHERY_WIZARD_STAGES.map((stage) => [
        stage,
        (data?.records[stage] ?? []).filter(
          (record) => record.classificationRefNo === selectedRefParam,
        ),
      ]),
    ) as Record<HatcheryWizardStage, HatcheryWizardStageRecord[]>;
  }, [data, selectedRefParam]);

  const firstIncompleteStage = useMemo(
    () =>
      HATCHERY_WIZARD_STAGES.find(
        (stage) => activeRecords(recordsForSelectedRef[stage]).length === 0,
      ) ?? "pullout",
    [recordsForSelectedRef],
  );
  const requestedStage =
    stepParam && HATCHERY_WIZARD_STAGES.includes(stepParam) ? stepParam : null;
  const requestedStageAvailable = requestedStage
    ? selectedClassification?.isVoided ||
      HATCHERY_WIZARD_STAGES.slice(
        0,
        HATCHERY_WIZARD_STAGES.indexOf(requestedStage),
      ).every(
        (stage) => activeRecords(recordsForSelectedRef[stage]).length > 0,
      )
    : false;
  const selectedStage =
    requestedStage && requestedStageAvailable
      ? requestedStage
      : firstIncompleteStage;
  const selectedStageRecords = recordsForSelectedRef[selectedStage] ?? [];

  useEffect(() => {
    setEditor(null);
  }, [selectedRefParam, selectedStage]);

  const filteredClassifications = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return classifications;
    return classifications.filter((row) =>
      [
        row.classificationRefNo,
        row.breederRefNo,
        row.farmCode,
        row.farmName,
      ].some((field) => field.toLowerCase().includes(value)),
    );
  }, [classifications, search]);

  function chooseReference(row: HatcheryWizardClassification) {
    setSelectorOpen(false);
    router.push(
      `/wiz/hatchery-process-wizard?ref=${encodeURIComponent(row.classificationRefNo)}`,
    );
  }

  function recordsForRow(ref: string) {
    return Object.fromEntries(
      HATCHERY_WIZARD_STAGES.map((stage) => [
        stage,
        (data?.records[stage] ?? []).filter(
          (record) => record.classificationRefNo === ref,
        ),
      ]),
    ) as Record<HatcheryWizardStage, HatcheryWizardStageRecord[]>;
  }

  function canOpenStage(stage: HatcheryWizardStage) {
    if (selectedClassification?.isVoided) return true;
    const index = HATCHERY_WIZARD_STAGES.indexOf(stage);
    return HATCHERY_WIZARD_STAGES.slice(0, index).every(
      (key) => activeRecords(recordsForSelectedRef[key]).length > 0,
    );
  }

  useEffect(() => {
    if (
      !selectedClassification ||
      selectedClassification.isVoided ||
      selectedStageRecords.length > 0 ||
      permissions[selectedStage].insertDenied ||
      !canOpenStage(selectedStage)
    ) {
      return;
    }

    setEditor({ mode: "add" });
    // Open once when the selected reference/stage becomes an empty, available module.
    // Omitting `editor` keeps Cancel from immediately reopening the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedClassification?.id,
    selectedClassification?.isVoided,
    selectedRefParam,
    selectedStage,
    selectedStageRecords.length,
    permissions,
  ]);

  function selectStage(stage: HatcheryWizardStage) {
    if (stage === selectedStage) return;
    router.replace(wizardHref(selectedRefParam, stage), { scroll: false });
  }

  const nextStage = STAGE_META[selectedStage].next;
  const directChildActive = nextStage
    ? activeRecords(recordsForSelectedRef[nextStage])
    : [];
  const currentStatus = statusForStage(selectedStage, recordsForSelectedRef);
  const currentActiveRecords = activeRecords(selectedStageRecords);
  const currentQuantity = currentActiveRecords.reduce(
    (sum, record) => sum + Number(record.quantity ?? 0),
    0,
  );

  function childDependencyMessage() {
    return nextStage
      ? `Manually void the active ${STAGE_META[nextStage].label} record first.`
      : "A child record must be voided first.";
  }

  function beginEdit(record: HatcheryWizardStageRecord) {
    setEditor({ mode: "edit", record });
  }

  function beginVoid(record: HatcheryWizardStageRecord) {
    if (directChildActive.length) {
      toast.warning(childDependencyMessage());
      return;
    }
    setVoidReason("");
    setVoidTarget({ record, label: STAGE_META[selectedStage].label });
  }

  async function confirmVoid() {
    if (!voidTarget) return;
    if (voidReason.trim().length < 3) {
      toast.error("Enter a valid void reason of at least 3 characters.");
      return;
    }

    setVoiding(true);
    try {
      await voidHatcheryProcessWizardRecord({
        stage: voidTarget.record.stage,
        recordId: voidTarget.record.id,
        reason: voidReason,
      });
      toast.success(`${voidTarget.label} was voided.`);
      setVoidTarget(null);
      setVoidReason("");
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to void record.");
    } finally {
      setVoiding(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 px-4 py-4">
        <div className="h-6 w-64 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-14 animate-pulse rounded-lg border bg-muted/50" />
          ))}
        </div>
        <div className="h-[360px] animate-pulse rounded-lg border bg-muted/40" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3 px-3 py-4 md:px-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Hatchery Process Wizard"
        FirstPreviewsPageLink="/wiz/hatchery-process-wizard"
        CurrentPageName={
          selectedClassification
            ? STAGE_META[selectedStage].shortLabel.replaceAll("-", " ")
            : "Process List"
        }
      />

      {!selectedClassification ? (
        <Card>
          <CardHeader className="gap-3 border-b p-4">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <CardTitle>Hatchery Process Wizard</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select a Classification Ref. No. to continue its process from Egg Storage through Chick Pullout.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RefreshCw className="size-3.5" />
                Refresh
              </Button>
            </div>
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search classification, breeder reference, or farm..."
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-48">Classification Ref. No.</TableHead>
                    <TableHead className="min-w-44">Breeder Ref. No.</TableHead>
                    <TableHead className="min-w-48">Farm/Source</TableHead>
                    {HATCHERY_WIZARD_STAGES.map((stage) => (
                      <TableHead key={stage} className="min-w-32">
                        {STAGE_META[stage].shortLabel}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!filteredClassifications.length ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                        No classification references found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClassifications.map((row) => {
                      const rowRecords = recordsForRow(row.classificationRefNo);
                      return (
                        <TableRow
                          key={row.id}
                          className={cn(row.isVoided && "bg-muted/40 text-muted-foreground")}
                        >
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => chooseReference(row)}
                              className="font-semibold text-primary underline-offset-4 hover:underline"
                            >
                              {row.classificationRefNo}
                            </button>
                            {row.isVoided ? (
                              <Badge variant="destructive" className="ml-2">Voided</Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="font-medium">{row.breederRefNo || "-"}</TableCell>
                          <TableCell>
                            <div className="font-medium">{row.farmName || row.farmCode || "-"}</div>
                            {row.farmId ? (
                              <div className="text-xs text-muted-foreground">Farm ID {row.farmId}</div>
                            ) : null}
                          </TableCell>
                          {HATCHERY_WIZARD_STAGES.map((stage) => {
                            const status = statusForStage(stage, rowRecords);
                            const count = activeRecords(rowRecords[stage]).length;
                            return (
                              <TableCell key={stage}>
                                <StatusBadge {...status} count={count} />
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right">
                            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => chooseReference(row)}>
                              Open
                              <ChevronRight className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {selectedClassification.isVoided ? (
            <Alert variant="destructive">
              <Ban className="size-4" />
              <AlertTitle>Voided classification</AlertTitle>
              <AlertDescription>
                This workflow is read-only. Existing process records remain available for review.
              </AlertDescription>
            </Alert>
          ) : null}

          <Card className="gap-0 overflow-hidden py-0">
            <div
              className={cn(
                "grid min-w-0",
                workspaceMaximized
                  ? "grid-cols-[64px_minmax(0,1fr)]"
                  : "md:grid-cols-[190px_minmax(0,1fr)]",
              )}
            >
              <aside className="border-b bg-muted/30 p-2 md:min-h-[430px] md:border-r md:border-b-0">
                <div
                  className={cn(
                    "flex items-center pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                    workspaceMaximized ? "justify-end" : "justify-between px-2",
                  )}
                >
                  {!workspaceMaximized ? <span>Process Steps</span> : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setWorkspaceMaximized((current) => !current)}
                    title={workspaceMaximized ? "Restore wizard layout" : "Maximize process workspace"}
                    aria-label={workspaceMaximized ? "Restore wizard layout" : "Maximize process workspace"}
                    className="float-right shrink-0"
                  >
                    {workspaceMaximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                  </Button>
                </div>
                <nav className={cn("grid gap-1", !workspaceMaximized && "sm:grid-cols-2 md:grid-cols-1")}>
                  {HATCHERY_WIZARD_STAGES.map((stage, index) => {
                    const status = statusForStage(stage, recordsForSelectedRef);
                    const available = canOpenStage(stage);
                    const active = selectedStage === stage;
                    return (
                      <Button
                        key={stage}
                        type="button"
                        variant={active ? "default" : "ghost"}
                        disabled={!available}
                        onClick={() => selectStage(stage)}
                        title={`${STAGE_META[stage].shortLabel} - ${status.label}`}
                        aria-label={`${STAGE_META[stage].shortLabel} - ${status.label}`}
                        className={cn(
                          "h-10 w-full gap-2 px-2",
                          workspaceMaximized ? "justify-center" : "justify-start",
                        )}
                      >
                        {workspaceMaximized ? (
                          <span className="text-sm font-semibold" aria-hidden="true">
                            {STAGE_META[stage].shortLabel.charAt(0)}
                          </span>
                        ) : (
                          <>
                            <span
                              className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]",
                                active && "border-primary-foreground/50",
                              )}
                            >
                              {status.tone === "completed" ? <Check className="size-4" /> : index + 1}
                            </span>
                            <span className="min-w-0 flex-1 text-left">
                              <span className="block truncate text-sm font-medium leading-4">{STAGE_META[stage].shortLabel}</span>
                              <span className="block text-[10px] leading-3 opacity-70">{status.label}</span>
                            </span>
                          </>
                        )}
                      </Button>
                    );
                  })}
                </nav>
              </aside>

              <div className="min-w-0">
                <div className="border-b bg-card">
                  {workspaceMaximized ? (
                    <div className="flex min-h-14 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectorOpen(true)}
                        className="min-w-0 truncate text-left text-sm font-semibold text-primary underline-offset-4 hover:underline"
                        title={selectedClassification.classificationRefNo}
                      >
                        {selectedClassification.classificationRefNo}
                      </button>
                      <span className="hidden text-muted-foreground sm:inline">|</span>
                      <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        Breeder {selectedClassification.breederRefNo || "-"} | {selectedClassification.farmName || selectedClassification.farmCode || "-"} | {displayDate(selectedClassification.classificationDate)} | Hatching Eggs {formatNumber(selectedClassification.totalHatchingEggs)} | {STAGE_META[selectedStage].shortLabel} {currentQuantity ? formatNumber(currentQuantity) : "-"}
                      </div>
                      <StatusBadge {...currentStatus} count={currentActiveRecords.length} />
                    </div>
                  ) : (
                    <div className="space-y-3 p-3">
                      <div className="flex flex-col justify-between gap-2 lg:flex-row lg:items-center">
                        <div className="min-w-0">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Classification Ref. No.
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectorOpen(true)}
                            className="break-all text-left text-lg font-semibold text-primary underline-offset-4 hover:underline"
                          >
                            {selectedClassification.classificationRefNo}
                          </button>
                        </div>
                        <div className="min-w-0 lg:text-right">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Breeder Ref. No.
                          </div>
                          <div className="break-all font-semibold">
                            {selectedClassification.breederRefNo || "-"}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        <HeaderMetric
                          label="Farm/Source"
                          value={selectedClassification.farmName || selectedClassification.farmCode || "-"}
                        />
                        <HeaderMetric
                          label="Classification Date"
                          value={displayDate(selectedClassification.classificationDate)}
                        />
                        <HeaderMetric
                          label="Total Hatching Eggs"
                          value={formatNumber(selectedClassification.totalHatchingEggs)}
                        />
                        <HeaderMetric
                          label={`${STAGE_META[selectedStage].shortLabel} Quantity`}
                          value={currentQuantity ? formatNumber(currentQuantity) : "-"}
                        />
                        <HeaderMetric
                          label={`${STAGE_META[selectedStage].shortLabel} Status`}
                          value={<StatusBadge {...currentStatus} count={currentActiveRecords.length} />}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <CardContent className="min-w-0 space-y-3 p-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-semibold">{STAGE_META[selectedStage].label}</h2>
                    <p className="text-xs text-muted-foreground">
                      Records are shown automatically. Add and edit directly inside the wizard.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setEditor({ mode: "add" })}
                    disabled={
                      Boolean(editor) ||
                      selectedClassification.isVoided ||
                      permissions[selectedStage].insertDenied ||
                      !canOpenStage(selectedStage)
                    }
                  >
                    <Plus className="size-4" />
                    New
                  </Button>
                </div>

                {editor ? (
                  <HatcheryWizardInlineEditor
                    key={`${selectedStage}-${editor.mode}-${editor.record?.id ?? "new"}`}
                    stage={selectedStage}
                    classification={selectedClassification}
                    recordsByStage={recordsForSelectedRef}
                    editRecord={editor.record}
                    onCancel={() => setEditor(null)}
                    onSaved={async (continueToNext) => {
                      setEditor(null);
                      await load();
                      if (continueToNext && nextStage) {
                        router.push(wizardHref(selectedRefParam, nextStage));
                      }
                    }}
                  />
                ) : null}

                <div className="overflow-x-auto rounded-md border">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Record ID</TableHead>
                        {RECORD_COLUMNS[selectedStage].map((column) => (
                          <TableHead key={column.key} className="min-w-36">
                            {column.label}
                          </TableHead>
                        ))}
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead className="min-w-56 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!selectedStageRecords.length ? (
                        <TableRow>
                          <TableCell
                            colSpan={RECORD_COLUMNS[selectedStage].length + 3}
                            className="h-20 text-center text-muted-foreground"
                          >
                            No records yet. Select New to add one or more rows.
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedStageRecords.map((record) => (
                          <TableRow
                            key={record.id}
                            className={cn(record.isVoided && "bg-muted/40 text-muted-foreground")}
                          >
                            <TableCell className="font-medium tabular-nums">{record.id}</TableCell>
                            {RECORD_COLUMNS[selectedStage].map((column) => (
                              <TableCell key={column.key} className="whitespace-nowrap">
                                {displayRecordValue(record.raw[column.key], column.date)}
                              </TableCell>
                            ))}
                            <TableCell>
                              {record.isVoided ? (
                                <StatusBadge label="Voided" tone="voided" />
                              ) : (
                                <StatusBadge label="Active" tone="completed" />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  disabled={
                                    Boolean(editor) ||
                                    selectedClassification.isVoided ||
                                    record.isVoided ||
                                    permissions[selectedStage].editDenied ||
                                    directChildActive.length > 0
                                  }
                                  onClick={() => beginEdit(record)}
                                >
                                  <Pencil className="size-3.5" />
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2 text-xs"
                                  disabled={
                                    Boolean(editor) ||
                                    selectedClassification.isVoided ||
                                    record.isVoided ||
                                    permissions[selectedStage].voidDenied
                                  }
                                  onClick={() => beginVoid(record)}
                                >
                                  <Ban className="size-3.5" />
                                  Void
                                </Button>
                                {selectedStage === "pullout" && !record.isVoided ? (
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    asChild={!docClassificationInsertDenied}
                                    disabled={docClassificationInsertDenied}
                                  >
                                    {!docClassificationInsertDenied ? (
                                      <Link
                                        href={`/jmb/docclassification/newv2?egg_ref_no=${encodeURIComponent(
                                          selectedRefParam,
                                        )}&pullout_id=${record.id}&wizard=1`}
                                      >
                                        <ClipboardCopy className="size-3.5" />
                                        Copy
                                      </Link>
                                    ) : (
                                      <span>
                                        <ClipboardCopy className="size-3.5" />
                                        Copy
                                      </span>
                                    )}
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                </CardContent>
              </div>
            </div>
          </Card>
        </>
      )}

      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose Classification Ref. No.</DialogTitle>
            <DialogDescription>
              Changing the reference updates the entire wizard and its fixed Farm/Source.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search classification, breeder reference, or farm..."
              className="pl-9"
            />
          </div>
          <div className="max-h-[55vh] overflow-y-auto rounded-md border">
            <div className="divide-y">
              {filteredClassifications.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => chooseReference(row)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted"
                >
                  <span>
                    <span className="font-semibold text-primary">{row.classificationRefNo}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {row.breederRefNo || "No breeder reference"} · {row.farmName || row.farmCode || "No farm"}
                    </span>
                  </span>
                  {row.isVoided ? <Badge variant="destructive">Voided</Badge> : <ChevronRight className="size-4" />}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(voidTarget)}
        onOpenChange={(open) => {
          if (!open && !voiding) {
            setVoidTarget(null);
            setVoidReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void {voidTarget?.label} record?</DialogTitle>
            <DialogDescription>
              This action does not void any child automatically. A valid reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="wizard-void-reason" required>Void reason</Label>
            <Textarea
              id="wizard-void-reason"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="Explain why this record must be voided."
              minLength={3}
              disabled={voiding}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)} disabled={voiding}>
              Keep record
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmVoid()}
              disabled={voiding || voidReason.trim().length < 3}
            >
              {voiding ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              Confirm Void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
