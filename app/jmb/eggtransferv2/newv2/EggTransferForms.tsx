"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import Breadcrumb from "@/lib/Breadcrumb";

import {
  createEggTransfer,
  createEggTransferBatch,
  getEggTransferById,
  listSetterInventoryRefs,
  listTransferHistory,
  type TransferClassiRefOption,
  updateEggTransfer,
} from "./api";
import FormActionButtons from "@/components/FormActionButtons";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import RequiredLabel from "@/components/RequiredLabel";
import SearchableDropdown1 from "@/lib/SearchableDropdown1";

type FormState = {
  ref_no: string[];
  farm_source: string;
  trans_date_start: string;
  trans_date_end: string;
};

type EggTransferReferenceRow = {
  ref_no: string;
  farm_source: string;
  total_hatching_egg: number;
  previous_total_egg_transfer: number;
  num_bangers: number;
  total_egg_transfer: number;
};

type TransferHistoryItem = {
  id: number;
  ref_no: string | null;
  total_egg_transfer: number | null;
};

function minutesBetween(start: string, end: string) {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  if (b < a) return null;
  return Math.floor((b - a) / 60000);
}

function fmtDuration(mins: number | null) {
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} min`;
  return `${h} hr ${m} min`;
}

function isoToLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function clampNonNegative(raw: string) {
  if (raw === "") return 0;
  const sanitized = raw.replace(/[^0-9]/g, "");
  const parsed = Number(sanitized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function parseRefNumbers(value: string | null | undefined) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPreviousTransferMap(rows: TransferHistoryItem[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const qty = Number(row.total_egg_transfer ?? 0);
    if (!Number.isFinite(qty)) return acc;

    for (const ref of parseRefNumbers(row.ref_no)) {
      acc[ref] = (acc[ref] ?? 0) + qty;
    }

    return acc;
  }, {});
}

function buildFarmSource(
  refs: string[],
  refOptions: TransferClassiRefOption[],
  fallback = "",
) {
  const farms = Array.from(
    new Set(
      refs
        .map(
          (ref) => refOptions.find((item) => item.ref_no === ref)?.farm_source,
        )
        .map((farm) => String(farm ?? "").trim())
        .filter(Boolean),
    ),
  );

  return farms.length ? farms.join(", ") : fallback;
}

function buildReferenceRows(
  refs: string[],
  refOptions: TransferClassiRefOption[],
  previousTransferMap: Record<string, number>,
  existingRows: EggTransferReferenceRow[] = [],
) {
  return refs.map((ref) => {
    const option = refOptions.find((item) => item.ref_no === ref);
    const existingRow = existingRows.find((item) => item.ref_no === ref);
    const totalHatchingEgg = Number(option?.total_hatching_egg ?? 0);

    return {
      ref_no: ref,
      farm_source: option?.farm_source ?? existingRow?.farm_source ?? "",
      total_hatching_egg: Number.isFinite(totalHatchingEgg)
        ? totalHatchingEgg
        : 0,
      previous_total_egg_transfer: previousTransferMap[ref] ?? 0,
      num_bangers: existingRow?.num_bangers ?? 0,
      total_egg_transfer: existingRow?.total_egg_transfer ?? 0,
    };
  });
}

function getRemainingTransferCapacity(row: EggTransferReferenceRow) {
  return Math.max(
    0,
    row.total_hatching_egg - row.previous_total_egg_transfer - row.num_bangers,
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function EggTransferForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id");
  const editId = idParam ? Number(idParam) : null;
  const isEdit = Number.isFinite(editId) && !!editId;

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState<boolean>(!!isEdit);
  const [refLoading, setRefLoading] = useState(false);
  const [refOptions, setRefOptions] = useState<TransferClassiRefOption[]>([]);
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>(
    [],
  );
  const [loadedRecord, setLoadedRecord] = useState<TransferHistoryItem | null>(
    null,
  );
  const [referenceRows, setReferenceRows] = useState<EggTransferReferenceRow[]>(
    [],
  );

  const [form, setForm] = useState<FormState>({
    ref_no: [],
    farm_source: "",
    trans_date_start: "",
    trans_date_end: "",
  });

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setRefLoading(true);
      try {
        const [refs, history] = await Promise.all([
          listSetterInventoryRefs(),
          listTransferHistory(),
        ]);
        if (!alive) return;
        setRefOptions(refs);
        setTransferHistory(history);
      } catch (error) {
        console.error(error);
      } finally {
        if (alive) setRefLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isEdit || !editId) return;

    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const row = await getEggTransferById(editId);
        if (!alive) return;

        setLoadedRecord(row);
        setForm({
          ref_no: row.ref_no ? [row.ref_no] : [],
          farm_source: row.farm_source ?? "",
          trans_date_start: isoToLocalInput(row.trans_date_start),
          trans_date_end: isoToLocalInput(row.trans_date_end),
        });
        setReferenceRows(
          row.ref_no
            ? [
                {
                  ref_no: row.ref_no,
                  farm_source: row.farm_source ?? "",
                  total_hatching_egg: 0,
                  previous_total_egg_transfer: 0,
                  num_bangers: Number(row.num_bangers ?? 0),
                  total_egg_transfer: Number(row.total_egg_transfer ?? 0),
                },
              ]
            : [],
        );
      } catch (error: unknown) {
        alert(getErrorMessage(error, "Failed to load record."));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isEdit, editId]);

  const durationMinutes = useMemo(() => {
    if (!form.trans_date_start || !form.trans_date_end) return null;
    return minutesBetween(form.trans_date_start, form.trans_date_end);
  }, [form.trans_date_start, form.trans_date_end]);

  const isValidDates = useMemo(() => {
    if (!form.trans_date_start || !form.trans_date_end) return true;
    return durationMinutes !== null;
  }, [form.trans_date_start, form.trans_date_end, durationMinutes]);

  const previousTransferMap = useMemo(() => {
    const nextMap = buildPreviousTransferMap(transferHistory);

    if (loadedRecord?.ref_no) {
      nextMap[loadedRecord.ref_no] = Math.max(
        0,
        (nextMap[loadedRecord.ref_no] ?? 0) -
          Number(loadedRecord.total_egg_transfer ?? 0),
      );
    }

    return nextMap;
  }, [transferHistory, loadedRecord]);

  const selectableRefOptions = useMemo(() => {
    return refOptions.filter((option) => {
      const previousTransferred = previousTransferMap[option.ref_no] ?? 0;
      const totalHatchingEgg = Number(option.total_hatching_egg ?? 0);
      const hasRemainingTransfer = previousTransferred < totalHatchingEgg;

      if (hasRemainingTransfer) return true;

      return isEdit && loadedRecord?.ref_no === option.ref_no;
    });
  }, [isEdit, loadedRecord, previousTransferMap, refOptions]);

  useEffect(() => {
    if (!form.ref_no.length) {
      setReferenceRows((prev) => (prev.length ? [] : prev));
      setForm((prev) =>
        prev.farm_source
          ? {
              ...prev,
              farm_source: "",
            }
          : prev,
      );
      return;
    }

    setReferenceRows((prev) => {
      const nextRows = buildReferenceRows(
        form.ref_no,
        selectableRefOptions,
        previousTransferMap,
        prev,
      ).map((row) => ({
        ...row,
        total_egg_transfer: Math.min(
          row.total_egg_transfer,
          getRemainingTransferCapacity(row),
        ),
      }));

      return JSON.stringify(prev) === JSON.stringify(nextRows)
        ? prev
        : nextRows;
    });

    const nextFarmSource = buildFarmSource(
      form.ref_no,
      selectableRefOptions,
      form.farm_source,
    );

    setForm((prev) =>
      prev.farm_source === nextFarmSource
        ? prev
        : {
            ...prev,
            farm_source: nextFarmSource,
          },
    );
  }, [
    form.ref_no,
    form.farm_source,
    previousTransferMap,
    selectableRefOptions,
  ]);

  function handleSelectRef(refs: string[]) {
    setForm((prev) => ({
      ...prev,
      ref_no: refs,
      farm_source: buildFarmSource(
        refs,
        selectableRefOptions,
        prev.farm_source,
      ),
    }));
  }

  function handleRowChange(
    refNo: string,
    field: "num_bangers" | "total_egg_transfer",
    value: string,
  ) {
    const numericValue = clampNonNegative(value);

    setReferenceRows((prev) =>
      prev.map((row) => {
        if (row.ref_no !== refNo) return row;

        if (field === "num_bangers") {
          const nextRow = {
            ...row,
            num_bangers: numericValue,
          };

          return {
            ...nextRow,
            total_egg_transfer: Math.min(
              nextRow.total_egg_transfer,
              getRemainingTransferCapacity(nextRow),
            ),
          };
        }

        return {
          ...row,
          total_egg_transfer: Math.min(
            numericValue,
            getRemainingTransferCapacity(row),
          ),
        };
      }),
    );
  }

  async function onSave() {
    if (!form.ref_no.length) {
      alert("Egg Reference Number is required.");
      return;
    }

    if (!form.trans_date_start) {
      alert("Transfer Date & Time Start is required.");
      return;
    }

    if (!isValidDates) {
      alert("Transfer End must be after Transfer Start.");
      return;
    }

    if (!referenceRows.length) {
      alert("Please select at least one Egg Reference Number.");
      return;
    }

    const invalidRow = referenceRows.find(
      (row) =>
        row.previous_total_egg_transfer +
          row.num_bangers +
          row.total_egg_transfer >
        row.total_hatching_egg,
    );

    if (invalidRow) {
      alert(
        `No. of Bangers plus Total Egg Transfer exceeds available hatching egg for ${invalidRow.ref_no}.`,
      );
      return;
    }

    const buildPayload = (row: EggTransferReferenceRow) => ({
      ref_no: row.ref_no || null,
      farm_source: row.farm_source || form.farm_source || null,
      trans_date_start: form.trans_date_start
        ? new Date(form.trans_date_start).toISOString()
        : null,
      trans_date_end: form.trans_date_end
        ? new Date(form.trans_date_end).toISOString()
        : null,
      duration: durationMinutes,
      num_bangers: row.num_bangers,
      total_egg_transfer: row.total_egg_transfer,
    });

    const payloads = referenceRows.map(buildPayload);
    const payload = payloads[0];

    if (!payload) {
      alert("At least one transfer row is required.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && editId) {
        await updateEggTransfer(editId, payload);
      } else if (payloads.length === 1) {
        await createEggTransfer(payload);
      } else {
        await createEggTransferBatch(payloads);
      }

      router.push("/jmb/eggtransferv2");
      router.refresh();
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Failed to save."));
    } finally {
      setSaving(false);
    }
  }

  const disabledAll = saving || loading;

  return (
    <div className="w-full px-6 py-6 mt-4 space-y-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Egg Transfer"
        CurrentPageName={isEdit ? "Edit Entry" : "New Entry"}
      />

      <Card className="w-full min-h-[calc(90vh-120px)] p-6 mt-2">
        <CardContent className="max-w-4xl p-4 space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="space-y-2 max-w-md">
                <RequiredLabel>Egg Reference No.</RequiredLabel>
                <SearchableDropdown1
                  list={selectableRefOptions}
                  codeLabel="ref_no"
                  nameLabel="ref_no"
                  showNameOnly
                  value={form.ref_no}
                  onChange={handleSelectRef}
                  multiple
                  disabled={saving || refLoading || isEdit}
                />
              </div>

              <Separator />

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-green-50">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">
                        Egg Reference No.
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Total Hatching Egg
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Previous Total Egg Transfer
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        No. of Bangers
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Total Egg Transfer
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {referenceRows.length ? (
                      referenceRows.map((row) => (
                        <tr key={row.ref_no} className="border-b last:border-0">
                          <td className="px-3 py-2 align-top">
                            <Input
                              value={row.ref_no}
                              readOnly
                              className="bg-green-100"
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            {row.total_hatching_egg.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {row.previous_total_egg_transfer.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <Input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={row.num_bangers}
                              onChange={(e) =>
                                handleRowChange(
                                  row.ref_no,
                                  "num_bangers",
                                  e.target.value,
                                )
                              }
                              disabled={disabledAll}
                              className="bg-red-100"
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="space-y-1">
                              <Input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={row.total_egg_transfer}
                                onChange={(e) =>
                                  handleRowChange(
                                    row.ref_no,
                                    "total_egg_transfer",
                                    e.target.value,
                                  )
                                }
                                disabled={disabledAll}
                                className="bg-red-100"
                              />
                              <p className="text-xs text-muted-foreground">
                                Available:{" "}
                                {getRemainingTransferCapacity(
                                  row,
                                ).toLocaleString()}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="h-32 px-3 py-6 text-center text-muted-foreground"
                        >
                          Select one or more Egg Reference No. to add transfer
                          rows.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <RequiredLabel>Transfer Date &amp; Time Start</RequiredLabel>
                <Input
                  type="datetime-local"
                  value={form.trans_date_start}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      trans_date_start: e.target.value,
                    }))
                  }
                  disabled={disabledAll}
                />
              </div>

              <div className="space-y-2">
                <Label>Transfer Date &amp; Time End</Label>
                <Input
                  type="datetime-local"
                  value={form.trans_date_end}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      trans_date_end: e.target.value,
                    }))
                  }
                  disabled={disabledAll}
                />
                {form.trans_date_start &&
                form.trans_date_end &&
                !isValidDates ? (
                  <p className="text-xs text-destructive">
                    End must be after Start.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Duration</Label>
                <Input disabled value={fmtDuration(durationMinutes)} />
              </div>

              <FormActionButtons
                saving={saving}
                isEdit={isEdit}
                cancelPath="/jmb/eggtransferv2"
                onSave={onSave}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
