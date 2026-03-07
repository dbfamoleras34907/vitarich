"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import Breadcrumb from "@/lib/Breadcrumb";

import {
  createEggTransfer,
  updateEggTransfer,
  getEggTransferById,
  listClassiRefNos,
} from "./api";
import FormActionButtons from "@/components/FormActionButtons";

type FormState = {
  ref_no: string;
  farm_source: string;
  trans_date_start: string; // datetime-local
  trans_date_end: string; // datetime-local
  num_bangers: string;
  total_egg_transfer: string;
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

// Convert ISO -> datetime-local (best-effort)
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

export default function EggTransferForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id");
  const editId = idParam ? Number(idParam) : null;
  const isEdit = Number.isFinite(editId) && !!editId;

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState<boolean>(!!isEdit);

  const [refOptions, setRefOptions] = useState<string[]>([]);
  const [refLoading, setRefLoading] = useState(false);

  const [form, setForm] = useState<FormState>({
    ref_no: "",
    farm_source: "",
    trans_date_start: "",
    trans_date_end: "",
    num_bangers: "",
    total_egg_transfer: "",
  });

  // load dropdown options (hatch_classification.classi_ref_no)
  useEffect(() => {
    let alive = true;
    (async () => {
      setRefLoading(true);
      try {
        const refs = await listClassiRefNos();
        if (!alive) return;
        setRefOptions(refs);
      } catch (e: any) {
        console.error(e);
      } finally {
        if (alive) setRefLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // load record when editing
  useEffect(() => {
    if (!isEdit || !editId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const row = await getEggTransferById(editId);
        if (!alive) return;
        setForm({
          ref_no: row.ref_no ?? "",
          farm_source: row.farm_source ?? "",
          trans_date_start: isoToLocalInput(row.trans_date_start),
          trans_date_end: isoToLocalInput(row.trans_date_end),
          num_bangers: row.num_bangers?.toString() ?? "",
          total_egg_transfer: row.total_egg_transfer?.toString() ?? "",
        });
      } catch (e: any) {
        alert(e?.message ?? "Failed to load record.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isEdit, editId]);

  const durationMinutes = useMemo(() => {
    if (!form.trans_date_start) return null;
    if (!form.trans_date_end) return null;
    return minutesBetween(form.trans_date_start, form.trans_date_end);
  }, [form.trans_date_start, form.trans_date_end]);

  const isValidDates = useMemo(() => {
    if (!form.trans_date_start) return true;
    if (!form.trans_date_end) return true;
    return durationMinutes !== null;
  }, [form.trans_date_start, form.trans_date_end, durationMinutes]);

  async function onSave() {
    if (!form.ref_no) {
      alert("Reference Number is required.");
      return;
    }
    if (!form.trans_date_start) {
      alert("Transfer Date & Time Start is required.");
      return;
    }
    if (!form.trans_date_end) {
      alert("Transfer Date & Time End is required.");
      return;
    }
    if (!isValidDates) {
      alert("Transfer End must be after Transfer Start.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ref_no: form.ref_no.trim() || null,
        farm_source: form.farm_source.trim() || null,

        trans_date_start: form.trans_date_start
          ? new Date(form.trans_date_start).toISOString()
          : null,
        trans_date_end: form.trans_date_end
          ? new Date(form.trans_date_end).toISOString()
          : null,

        duration: durationMinutes,

        num_bangers: form.num_bangers ? Number(form.num_bangers) : null,
        total_egg_transfer: form.total_egg_transfer
          ? Number(form.total_egg_transfer)
          : null,
      };

      if (isEdit && editId) {
        await updateEggTransfer(editId, payload);
      } else {
        await createEggTransfer(payload);
      }

      router.push("/jmb/eggtransferv2");
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full  px-6 py-6  mt-4 space-y-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Egg Transfer"
        CurrentPageName={isEdit ? "Edit Entry" : "New Entry"}
      />

      <Card className="w-full  min-h-[calc(90vh-120px)] p-6 space-y-4 mt-2">
        <CardContent className="max-w-2xl p-4 space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              {/* ONE COLUMN UI */}
              <div className="space-y-2">
                <Label>Egg Reference Number</Label>
                <Select
                  value={form.ref_no}
                  onValueChange={(v) => setForm((p) => ({ ...p, ref_no: v }))}
                  disabled={refLoading || saving}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        refLoading ? "Loading..." : "Select Egg Reference No."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {refOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* separator after Ref No. */}
              <Separator />

              <div className="space-y-2">
                <Label>Farm Source</Label>
                <Input
                  value={form.farm_source}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, farm_source: e.target.value }))
                  }
                  placeholder=""
                />
              </div>

              <div className="space-y-2">
                <Label>Transfer Date &amp; Time Start</Label>
                <Input
                  type="datetime-local"
                  value={form.trans_date_start}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, trans_date_start: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Transfer Date &amp; Time End</Label>
                <Input
                  type="datetime-local"
                  value={form.trans_date_end}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, trans_date_end: e.target.value }))
                  }
                />
                {form.trans_date_start &&
                form.trans_date_end &&
                !isValidDates ? (
                  <p className="text-xs text-destructive mt-1">
                    End must be after Start.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Duration</Label>
                <Input
                  disabled
                  value={fmtDuration(durationMinutes)}
                  placeholder=""
                />
              </div>

              <div className="space-y-2">
                <Label>No. of Bangers</Label>
                <Input
                  type="number"
                  value={form.num_bangers}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, num_bangers: e.target.value }))
                  }
                  placeholder=""
                />
              </div>

              <div className="space-y-2">
                <Label>Total Egg Transfer</Label>
                <Input
                  type="number"
                  value={form.total_egg_transfer}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      total_egg_transfer: e.target.value,
                    }))
                  }
                  placeholder=""
                />
              </div>

              {/* Actions */}
              <FormActionButtons
                saving={saving}
                isEdit={isEdit}
                // disabled={disabledAll}
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
