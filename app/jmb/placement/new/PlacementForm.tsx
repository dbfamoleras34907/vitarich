"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
import { Paperclip } from "lucide-react";
import Breadcrumb from "@/lib/Breadcrumb";
import FormActionButtons from "@/components/FormActionButtons";
import RequiredLabel from "@/components/RequiredLabel";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import {
  createPlacement,
  createPlacementBatch,
  getPlacementById,
  getUserInfo,
  listBreederSources,
  listFarmLocationLookup,
  updatePlacement,
  type FarmLocationLookup,
  type PlacementInsert,
} from "./api";

type PlacementRow = {
  pen_no: string;
  f_source: string;
  f_beg: string;
  f_doa: string;
  f_reject: string;
  f_shortcount: string;
  m_source: string;
  m_beg: string;
  m_doa: string;
  m_reject: string;
  m_shortcount: string;
};

type FormState = {
  placement_date: string;
  dr_no: string;
  file_attached: string;
  farm_id: string;
  farm_name: string;
  building_no: string;
  pen_count: string;
  remarks: string;
};

function getToday() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function createEmptyRow(index: number): PlacementRow {
  return {
    pen_no: String(index + 1),
    f_source: "",
    f_beg: "0",
    f_doa: "0",
    f_reject: "0",
    f_shortcount: "0",
    m_source: "",
    m_beg: "0",
    m_doa: "0",
    m_reject: "0",
    m_shortcount: "0",
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
  return fallback;
}

const TableWidths = {
  tableMin: "min-w-[344px]",
  pen: "w-8",
  source: "w-24 min-w-24 max-w-24",
  count: "w-[1.52rem]",
  shortCount: "w-[2.8rem]",
  ending: "w-[3.2rem]",
} as const;

export default function PlacementForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const isEdit = !!idParam;

  const [saving, setSaving] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [locations, setLocations] = useState<FarmLocationLookup[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [form, setForm] = useState<FormState>({
    placement_date: getToday(),
    dr_no: "",
    file_attached: "",
    farm_id: "",
    farm_name: "",
    building_no: "",
    pen_count: "",
    remarks: "",
  });
  const [rows, setRows] = useState<PlacementRow[]>([]);

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
      setLoadingLocations(true);
      try {
        const lookup = await listFarmLocationLookup();
        if (!mounted) return;
        setLocations(lookup);
      } catch {
        if (!mounted) return;
        setLocations([]);
      } finally {
        if (mounted) setLoadingLocations(false);
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
        if (!mounted) return;

        setForm({
          placement_date: record.placement_date ?? getToday(),
          dr_no: record.dr_no ?? "",
          file_attached: record.file_attached ?? "",
          farm_id: record.farm_id != null ? String(record.farm_id) : "",
          farm_name: record.farm_name ?? "",
          building_no: record.building_no ?? "",
          pen_count: "1",
          remarks: record.remarks ?? "",
        });

        setRows([
          {
            pen_no: record.pen_no ?? "1",
            f_source: record.f_source ?? "",
            f_beg: String(record.f_beg ?? 0),
            f_doa: String(record.f_doa ?? 0),
            f_reject: String(record.f_reject ?? 0),
            f_shortcount: String(record.f_shortcount ?? 0),
            m_source: record.m_source ?? "",
            m_beg: String(record.m_beg ?? 0),
            m_doa: String(record.m_doa ?? 0),
            m_reject: String(record.m_reject ?? 0),
            m_shortcount: String(record.m_shortcount ?? 0),
          },
        ]);
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
  const farmOptions = useMemo(() => {
    const values = new Map<string, string>();
    locations.forEach((location) => {
      values.set(String(location.farm_id), location.farm_name);
    });
    if (form.farm_id && form.farm_name.trim()) {
      values.set(form.farm_id, form.farm_name.trim());
    }
    return Array.from(values, ([id, name]) => ({ id, name }));
  }, [form.farm_id, form.farm_name, locations]);
  const buildingOptions = useMemo(() => {
    const values = new Set<string>();
    if (form.farm_id) {
      locations
        .filter((location) => String(location.farm_id) === form.farm_id)
        .map((location) => location.building_no)
        .filter(Boolean)
        .forEach((buildingNo) => values.add(buildingNo));
    }
    if (form.building_no.trim()) values.add(form.building_no.trim());
    return Array.from(values);
  }, [form.building_no, form.farm_id, locations]);
  const breederSourceOptions = useMemo(() => {
    const values = new Set(sourceOptions);
    rows.forEach((row) => {
      if (row.f_source.trim()) values.add(row.f_source.trim());
      if (row.m_source.trim()) values.add(row.m_source.trim());
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [rows, sourceOptions]);

  function buildRowsFromPens(pens: FarmLocationLookup[]) {
    return pens.map((pen, index) => ({
      ...createEmptyRow(index),
      pen_no: pen.pen_no,
    }));
  }

  function handleFarmChange(farmId: string) {
    const farm = locations.find(
      (location) => String(location.farm_id) === farmId,
    );

    setForm((prev) => ({
      ...prev,
      farm_id: farmId,
      farm_name: farm?.farm_name ?? "",
      building_no: "",
      pen_count: "",
    }));
    setRows([]);
  }

  function handleBuildingChange(buildingNo: string) {
    const nextRows = buildRowsFromPens(
      locations.filter(
        (location) =>
          String(location.farm_id) === form.farm_id &&
          location.building_no === buildingNo,
      ),
    );

    setForm((prev) => ({
      ...prev,
      building_no: buildingNo,
      pen_count: String(nextRows.length),
    }));
    setRows(nextRows);
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
                  : value,
            }
          : row,
      ),
    );
  }

  function renderSourceSelect(
    index: number,
    field: "f_source" | "m_source",
    value: string,
  ) {
    return (
      <Select
        value={value}
        onValueChange={(nextValue) => handleRowChange(index, field, nextValue)}
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
    if (!form.dr_no.trim()) {
      alert("DR No. is required.");
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
    if (!rows.length) {
      alert("Please enter the number of pens to generate rows.");
      return;
    }
    if (rows.some((row) => !row.pen_no.trim())) {
      alert("Every row must have a Pen number.");
      return;
    }

    const payloads: PlacementInsert[] = rows.map((row) => ({
      placement_date: form.placement_date,
      dr_no: form.dr_no.trim(),
      file_attached: form.file_attached.trim() || null,
      farm_id: Number(form.farm_id),
      farm_name: form.farm_name.trim(),
      building_no: form.building_no.trim(),
      pen_no: row.pen_no.trim(),
      f_source: row.f_source.trim() || null,
      f_beg: asNumber(row.f_beg),
      f_doa: asNumber(row.f_doa),
      f_reject: asNumber(row.f_reject),
      f_shortcount: asNumber(row.f_shortcount),
      f_endingbalance: getEndingBalance(
        row.f_beg,
        row.f_doa,
        row.f_reject,
        row.f_shortcount,
      ),
      m_source: row.m_source.trim() || null,
      m_beg: asNumber(row.m_beg),
      m_doa: asNumber(row.m_doa),
      m_reject: asNumber(row.m_reject),
      m_shortcount: asNumber(row.m_shortcount),
      m_endingbalance: getEndingBalance(
        row.m_beg,
        row.m_doa,
        row.m_reject,
        row.m_shortcount,
      ),
      remarks: form.remarks.trim() || null,
    }));

    setSaving(true);
    try {
      if (isEdit) {
        const id = Number(idParam);
        if (!Number.isFinite(id)) throw new Error("Invalid placement id.");
        await updatePlacement(id, payloads[0]);
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
    <div className="space-y-4 mt-8">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Placement List"
        CurrentPageName={isEdit ? "Edit Placement" : "New Placement"}
      />

      <Card>
        <CardContent className="pt-4 space-y-5">
          <div className="rounded-md border p-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <RequiredLabel>Date</RequiredLabel>
                <Input
                  type="date"
                  value={form.placement_date}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      placement_date: e.target.value,
                    }))
                  }
                  disabled={disabledAll}
                />
              </div>

              <div className="space-y-2">
                <RequiredLabel>DR Number</RequiredLabel>
                <Input
                  value={form.dr_no}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      dr_no: e.target.value,
                    }))
                  }
                  disabled={disabledAll}
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
                <RequiredLabel>Farm Name</RequiredLabel>
                <Select
                  value={form.farm_id}
                  onValueChange={handleFarmChange}
                  disabled={disabledAll || loadingLocations || isEdit}
                >
                  <SelectTrigger className="w-full">
                    <span
                      className={
                        form.farm_name ? "truncate" : "text-muted-foreground"
                      }
                    >
                      {form.farm_name ||
                        (loadingLocations ? "Loading..." : "Select farm")}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {farmOptions.length ? (
                      farmOptions.map((farm) => (
                        <SelectItem key={farm.id} value={farm.id}>
                          {farm.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__no_farm_options__" disabled>
                        No active farms
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <RequiredLabel>Building #</RequiredLabel>
                <Select
                  value={form.building_no}
                  onValueChange={handleBuildingChange}
                  disabled={
                    disabledAll || loadingLocations || !form.farm_id || isEdit
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        form.farm_id ? "Select building" : "Select farm first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {buildingOptions.length ? (
                      buildingOptions.map((buildingNo) => (
                        <SelectItem key={buildingNo} value={buildingNo}>
                          {buildingNo}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__no_building_options__" disabled>
                        No active buildings
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <RequiredLabel>Pen #</RequiredLabel>
                <Input
                  type="text"
                  value={
                    form.pen_count
                      ? asNumber(form.pen_count).toLocaleString("en-US")
                      : ""
                  }
                  placeholder="Generated from building"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Selecting a building creates placement rows from active pens.
                </p>
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Placement Details</h3>
                  <p className="text-xs text-muted-foreground">
                    Total rows generated: {totalPens}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className={`w-full ${TableWidths.tableMin} text-sm`}>
                  <thead className="bg-green-50">
                    <tr className="border-b">
                      <th
                        rowSpan={2}
                        className={`px-2 py-2 text-left font-medium ${TableWidths.pen}`}
                      >
                        Pen #
                      </th>
                      <th
                        colSpan={6}
                        className="px-2 py-2 text-center font-medium bg-pink-100 text-pink-800"
                      >
                        Female
                      </th>
                      <th
                        colSpan={6}
                        className="px-2 py-2 text-center font-medium bg-sky-100 text-sky-800"
                      >
                        Male
                      </th>
                    </tr>
                    <tr className="border-b">
                      <th
                        className={`${TableWidths.source} px-1 py-1 text-left font-medium bg-pink-50`}
                      >
                        Source
                      </th>
                      <th
                        className={`${TableWidths.count} px-1 text-left font-medium bg-pink-50`}
                      >
                        Total Placement
                      </th>
                      <th
                        className={`${TableWidths.count} px-1 text-left font-medium bg-pink-50`}
                      >
                        DOA
                      </th>
                      <th
                        className={`${TableWidths.count} px-1 text-left font-medium bg-pink-50`}
                      >
                        Rejects
                      </th>
                      <th
                        className={`${TableWidths.shortCount} px-1 text-left font-medium bg-pink-50`}
                      >
                        Short Count
                      </th>
                      <th
                        className={`${TableWidths.ending} px-1 text-left font-medium bg-pink-50`}
                      >
                        Ending
                      </th>
                      <th
                        className={`${TableWidths.source} px-1 text-left font-medium bg-sky-50`}
                      >
                        Source
                      </th>
                      <th
                        className={`${TableWidths.count} px-1 text-left font-medium bg-sky-50`}
                      >
                        Total Placement
                      </th>
                      <th
                        className={`${TableWidths.count} px-1 text-left font-medium bg-sky-50`}
                      >
                        DOA
                      </th>
                      <th
                        className={`${TableWidths.count} px-1 text-left font-medium bg-sky-50`}
                      >
                        Rejects
                      </th>
                      <th
                        className={`${TableWidths.shortCount} px-1 text-left font-medium bg-sky-50`}
                      >
                        Short Count
                      </th>
                      <th
                        className={`${TableWidths.ending} px-1 text-left font-medium bg-sky-50`}
                      >
                        Ending
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
                            className="border-b last:border-0"
                          >
                            <td className={`${TableWidths.pen} px-1 py-1`}>
                              <Input
                                value={row.pen_no}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    "pen_no",
                                    e.target.value,
                                  )
                                }
                                disabled
                                className="w-full"
                              />
                            </td>
                            <td className={`${TableWidths.source} px-1`}>
                              {renderSourceSelect(
                                index,
                                "f_source",
                                row.f_source,
                              )}
                            </td>
                            <td className={`${TableWidths.count} px-1`}>
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
                                className="w-full"
                              />
                            </td>
                            <td className={`${TableWidths.count} px-1`}>
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
                                className="w-full"
                              />
                            </td>
                            <td className={`${TableWidths.count} px-1`}>
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
                                className="w-full"
                              />
                            </td>
                            <td className={`${TableWidths.shortCount} px-1`}>
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
                                className="w-full"
                              />
                            </td>
                            <td className={`${TableWidths.ending} px-1`}>
                              <Input
                                value={femaleEnding.toLocaleString("en-US")}
                                readOnly
                                disabled
                                className="bg-slate-100 w-full"
                              />
                            </td>
                            <td className={`${TableWidths.source} px-1`}>
                              {renderSourceSelect(
                                index,
                                "m_source",
                                row.m_source,
                              )}
                            </td>
                            <td className={`${TableWidths.count} px-1`}>
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
                                className="w-full"
                              />
                            </td>
                            <td className={`${TableWidths.count} px-1`}>
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
                                className="w-full"
                              />
                            </td>
                            <td className={`${TableWidths.count} px-1`}>
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
                                className="w-full"
                              />
                            </td>
                            <td className={`${TableWidths.shortCount} px-1`}>
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
                                className="w-full"
                              />
                            </td>
                            <td className={`${TableWidths.ending} px-1`}>
                              <Input
                                value={maleEnding.toLocaleString("en-US")}
                                readOnly
                                disabled
                                className="bg-slate-100 w-full"
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
            <Separator />
            <FormActionButtons
              saving={saving}
              isEdit={isEdit}
              disabled={disabledAll}
              cancelPath="/jmb/placement"
              onSave={onSave}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
