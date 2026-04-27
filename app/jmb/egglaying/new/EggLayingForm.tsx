"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Breadcrumb from "@/lib/Breadcrumb";
import FormActionButtons from "@/components/FormActionButtons";
import RequiredLabel from "@/components/RequiredLabel";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import {
  createEggLaying,
  getEggLayingById,
  getLayingPlacementById,
  listEggLayingHistoryByFarm,
  updateEggLaying,
  type EggLaying,
  type EggLayingInsert,
  type LayingPlacement,
} from "./api";

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
  table_egg: string;
  crack: string;
  junior: string;
  jumbo: string;
  condemn: string;
};

const eggCountFields: Array<keyof FormState> = [
  "hatching_egg",
  "table_egg",
  "crack",
  "junior",
  "jumbo",
  "condemn",
];

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
    "hatching_egg" | "table_egg" | "crack" | "junior" | "jumbo" | "condemn"
  >,
) {
  return (
    Number(row.hatching_egg ?? 0) +
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
    table_egg: "",
    crack: "",
    junior: "",
    jumbo: "",
    condemn: "",
  };
}

type NumberInputProps = {
  id: keyof FormState;
  label: string;
  value: string;
  disabled?: boolean;
  required?: boolean;
  onChange: (field: keyof FormState, value: string) => void;
};

function NumberInput({
  id,
  label,
  value,
  disabled,
  required,
  onChange,
}: NumberInputProps) {
  return (
    <div className="space-y-2">
      {required ? (
        <RequiredLabel>{label}</RequiredLabel>
      ) : (
        <Label>{label}</Label>
      )}
      <Input
        type="text"
        inputMode="numeric"
        value={formatNumber(value)}
        onChange={(event) => onChange(id, clampInteger(event.target.value))}
        onFocus={(event) => event.target.select()}
        disabled={disabled}
      />
    </div>
  );
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
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);

  const disabledAll = saving || loadingRecord;
  const ageLabel = formatAgeWeeks(asNumber(form.age));
  const netPlacementFromTable =
    netPlacementParam != null && netPlacementParam !== ""
      ? Number(netPlacementParam)
      : Number.NaN;
  const displayedNetPlacement = Number.isFinite(netPlacementFromTable)
    ? netPlacementFromTable
    : getNetPlacement(selectedPlacement);
  const eggTotal = useMemo(
    () => eggCountFields.reduce((sum, field) => sum + asNumber(form[field]), 0),
    [form],
  );

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
          table_egg: row.table_egg != null ? String(row.table_egg) : "",
          crack: row.crack != null ? String(row.crack) : "",
          junior: row.junior != null ? String(row.junior) : "",
          jumbo: row.jumbo != null ? String(row.jumbo) : "",
          condemn: row.condemn != null ? String(row.condemn) : "",
        };

        setForm(nextForm);
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

  function handleNumberChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleDateChange(value: string) {
    setForm((prev) => {
      const ageDays = selectedPlacement
        ? getAgeInDays(selectedPlacement.placement_date, value)
        : asNumber(prev.age);

      return {
        ...prev,
        date_laying: value,
        age: String(ageDays),
      };
    });
  }

  async function onSave() {
    if (!form.date_laying) {
      alert("Date laying is required.");
      return;
    }

    if (!form.placement_id) {
      alert("Placement is required.");
      return;
    }

    const payload: EggLayingInsert = {
      placement_id: asNumber(form.placement_id),
      date_laying: form.date_laying,
      farm_id: form.farm_id ? asNumber(form.farm_id) : null,
      farm_name: form.farm_name || null,
      building: form.building || null,
      age: asNumber(form.age),
      tep_collection: form.tep_collection
        ? asNumber(form.tep_collection)
        : null,
      hatching_egg: form.hatching_egg ? asNumber(form.hatching_egg) : null,
      table_egg: form.table_egg ? asNumber(form.table_egg) : null,
      crack: form.crack ? asNumber(form.crack) : null,
      junior: form.junior ? asNumber(form.junior) : null,
      jumbo: form.jumbo ? asNumber(form.jumbo) : null,
      condemn: form.condemn ? asNumber(form.condemn) : null,
      is_active: true,
      building_id: form.building_id ? asNumber(form.building_id) : null,
    };

    setSaving(true);
    try {
      if (isEdit) {
        const id = Number(idParam);
        if (!Number.isFinite(id)) throw new Error("Invalid egg laying id.");
        await updateEggLaying(id, payload);
      } else {
        await createEggLaying(payload);
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
                <RequiredLabel>Date Laying</RequiredLabel>
                <Input
                  type="date"
                  value={form.date_laying}
                  onChange={(event) => handleDateChange(event.target.value)}
                  disabled={disabledAll}
                />
              </div>

              <div className="space-y-2">
                <Label>Farm Name</Label>
                <Input value={form.farm_name} readOnly disabled />
              </div>

              <div className="space-y-2">
                <Label>Building</Label>
                <Input value={form.building} readOnly disabled />
              </div>

              <div className="space-y-2">
                <Label>Age</Label>
                <Input value={ageLabel} readOnly disabled />
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <NumberInput
                  id="tep_collection"
                  label="TEP Collection"
                  value={form.tep_collection}
                  onChange={handleNumberChange}
                  disabled={disabledAll}
                />
              </div>

              <div className="space-y-2">
                <NumberInput
                  id="hatching_egg"
                  label="Hatching Egg"
                  value={form.hatching_egg}
                  onChange={handleNumberChange}
                  disabled={disabledAll}
                />
              </div>
              <div className="space-y-2">
                <NumberInput
                  id="table_egg"
                  label="Table Egg"
                  value={form.table_egg}
                  onChange={handleNumberChange}
                  disabled={disabledAll}
                />
              </div>
              <div className="space-y-2">
                <NumberInput
                  id="crack"
                  label="Crack"
                  value={form.crack}
                  onChange={handleNumberChange}
                  disabled={disabledAll}
                />
              </div>

              <div className="space-y-2">
                <NumberInput
                  id="junior"
                  label="Junior"
                  value={form.junior}
                  onChange={handleNumberChange}
                  disabled={disabledAll}
                />
              </div>
              <div className="space-y-2">
                <NumberInput
                  id="jumbo"
                  label="Jumbo"
                  value={form.jumbo}
                  onChange={handleNumberChange}
                  disabled={disabledAll}
                />
              </div>
              <div className="space-y-2">
                <NumberInput
                  id="condemn"
                  label="Condemn"
                  value={form.condemn}
                  onChange={handleNumberChange}
                  disabled={disabledAll}
                />
              </div>

              <div className="space-y-2">
                <Label>Total Egg Classification</Label>
                <Input
                  value={eggTotal.toLocaleString("en-US")}
                  readOnly
                  disabled
                  className="font-medium"
                />
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
                          colSpan={12}
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
