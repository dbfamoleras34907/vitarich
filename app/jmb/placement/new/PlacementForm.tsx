"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Paperclip, Plus } from "lucide-react";
import Breadcrumb from "@/lib/Breadcrumb";
import FormActionButtons from "@/components/FormActionButtons";
import RequiredLabel from "@/components/RequiredLabel";
import SearchableCombobox from "@/components/SearchableCombobox";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { getUserFarms } from "@/app/admin/user/new/api";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  createFarmPen,
  createPlacement,
  createPlacementBatch,
  getPlacementById,
  getUserInfo,
  listBreederFarms,
  listBreederSources,
  listFarmLocationLookup,
  placementHasGrowingOrLaying,
  updatePlacement,
  type BreederFarm,
  type FarmLocationLookup,
  type PlacementInsert,
} from "./api";

type PlacementRow = {
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
};

type AccessibleFarm = Partial<BreederFarm> & {
  farm_id?: number | null;
  farm_code?: string | null;
  farm_name?: string | null;
};

const asArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

function normalizeFarmCode(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeAccessibleFarm(
  farm: AccessibleFarm,
  masterFarms: AccessibleFarm[] = [],
) {
  const code = normalizeFarmCode(farm.code ?? farm.farm_code);
  if (!code) return null;

  const masterFarm = masterFarms.find(
    (candidate) => normalizeFarmCode(candidate.code) === code,
  );
  const id = farm.id ?? farm.farm_id ?? masterFarm?.id ?? null;
  if (id == null) return null;

  return {
    id,
    code,
    name: farm.name ?? farm.farm_name ?? masterFarm?.name ?? code,
  };
}

type FormState = {
  placement_date: string;
  dr_no: string;
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

function normalizeLookupValue(value: string | number | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isSelectedFarmLocation(
  location: FarmLocationLookup,
  farmId: string,
  farmName: string,
) {
  const selectedFarmId = normalizeLookupValue(farmId);
  const selectedFarmName = normalizeLookupValue(farmName);

  return (
    (selectedFarmId &&
      (normalizeLookupValue(location.farm_id) === selectedFarmId ||
        normalizeLookupValue(location.farm_code) === selectedFarmId)) ||
    (selectedFarmName &&
      normalizeLookupValue(location.farm_name) === selectedFarmName)
  );
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
  const { placement_date: placementDate, ...rest } = payload;
  void placementDate;
  return rest;
}

const TableWidths = {
  tableMin: "min-w-[1080px]",
  pen: "w-[72px] min-w-[72px]",
  count: "w-[112px] min-w-[112px]",
  shortCount: "w-[128px] min-w-[128px]",
  ending: "w-[104px] min-w-[104px]",
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
  const { getValue } = useGlobalContext();
  const idParam = searchParams.get("id");
  const isEdit = !!idParam;

  const [saving, setSaving] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [hasDependentRecords, setHasDependentRecords] = useState(false);
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [locations, setLocations] = useState<FarmLocationLookup[]>([]);
  const [breederFarms, setBreederFarms] = useState<BreederFarm[]>([]);
  const [fallbackAssignedFarms, setFallbackAssignedFarms] = useState<
    AccessibleFarm[]
  >([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [addingPen, setAddingPen] = useState(false);
  const [addPenDialogOpen, setAddPenDialogOpen] = useState(false);
  const [newPenNo, setNewPenNo] = useState("");
  const [form, setForm] = useState<FormState>({
    placement_date: getToday(),
    dr_no: "",
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
        const [lookup, farms] = await Promise.all([
          listFarmLocationLookup(),
          listBreederFarms(),
        ]);
        if (!mounted) return;
        setLocations(lookup);
        setBreederFarms(farms);
      } catch {
        if (!mounted) return;
        setLocations([]);
        setBreederFarms([]);
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
        const [record, isLocked] = await Promise.all([
          getPlacementById(id),
          placementHasGrowingOrLaying(id),
        ]);
        if (!mounted) return;

        setHasDependentRecords(isLocked);
        setForm({
          placement_date: record.placement_date ?? getToday(),
          dr_no: record.dr_no ?? "",
          file_attached: record.file_attached ?? "",
          farm_id: String(record.farm_id),
          farm_name: record.farm_name ?? "",
          building_id: String(record.building_id),
          building_no: record.building_no ?? "",
          pen_count: "1",
          source: record.f_source ?? record.m_source ?? "",
          remarks: record.remarks ?? "",
        });

        setRows([
          {
            pen_id: String(record.pen_id),
            pen_no: record.pen_no ?? "1",
            f_beg: String(record.f_beg ?? 0),
            f_doa: String(record.f_doa ?? 0),
            f_reject: String(record.f_reject ?? 0),
            f_shortcount: String(record.f_shortcount ?? 0),
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

  const sessionUser = getValue("UserInfoAuthSession")?.[0] as
    | { id?: number | string; users_farms?: unknown[] }
    | undefined;

  const assignedFarmCodes = useMemo(
    () =>
      asArray<unknown>(sessionUser?.users_farms)
        .map(normalizeFarmCode)
        .filter(Boolean),
    [sessionUser?.users_farms],
  );

  const accessibleFarms = useMemo(() => {
    const normalizedBreederFarms = breederFarms
      .map((farm) => normalizeAccessibleFarm(farm, breederFarms))
      .filter((farm): farm is NonNullable<typeof farm> => Boolean(farm));

    if (assignedFarmCodes.length > 0) {
      const assignedCodeSet = new Set(assignedFarmCodes);
      return normalizedBreederFarms.filter((farm) =>
        assignedCodeSet.has(farm.code),
      );
    }

    const fallbackCodeSet = new Set(
      fallbackAssignedFarms.map((farm) =>
        normalizeFarmCode(farm.code ?? farm.farm_code),
      ),
    );
    return normalizedBreederFarms.filter((farm) =>
      fallbackCodeSet.has(farm.code),
    );
  }, [assignedFarmCodes, breederFarms, fallbackAssignedFarms]);

  useEffect(() => {
    if (assignedFarmCodes.length > 0 || !sessionUser?.id) return;

    let cancelled = false;

    getUserFarms(Number(sessionUser.id))
      .then((farms) => {
        if (!cancelled) {
          setFallbackAssignedFarms(
            Array.isArray(farms) ? (farms as AccessibleFarm[]) : [],
          );
        }
      })
      .catch(() => {
        if (!cancelled) setFallbackAssignedFarms([]);
      });

    return () => {
      cancelled = true;
    };
  }, [assignedFarmCodes.length, sessionUser?.id]);

  const totalPens = useMemo(() => rows.length, [rows]);
  const disabledAll = saving || loadingRecord;
  const disablePlacementDate = disabledAll || (isEdit && hasDependentRecords);
  const selectedFarmLocations = useMemo(
    () =>
      locations.filter((location) =>
        isSelectedFarmLocation(location, form.farm_id, form.farm_name),
      ),
    [form.farm_id, form.farm_name, locations],
  );
  const farmOptions = useMemo(() => {
    const options = accessibleFarms.map((farm) => {
      const farmLocation = locations.find(
        (location) =>
          normalizeFarmCode(location.farm_code) ===
          normalizeFarmCode(farm.code),
      );

      return {
        code: String(farmLocation?.farm_id ?? farm.id),
        name: farm.code
          ? `${farm.code} - ${farm.name ?? ""}`
          : (farm.name ?? String(farm.id)),
      };
    });

    if (
      isEdit &&
      form.farm_id &&
      !options.some((farm) => farm.code === form.farm_id)
    ) {
      const location = locations.find(
        (item) => String(item.farm_id) === form.farm_id,
      );
      options.push({
        code: form.farm_id,
        name: location?.farm_code
          ? `${location.farm_code} - ${form.farm_name}`
          : form.farm_name,
      });
    }

    return options;
  }, [accessibleFarms, form.farm_id, form.farm_name, isEdit, locations]);
  const buildingOptions = useMemo(() => {
    const values = new Map<string, string>();

    selectedFarmLocations.forEach((location) => {
      if (!location.building_id || !location.building_no) return;
      values.set(String(location.building_id), location.building_no);
    });

    if (form.building_id && form.building_no.trim()) {
      values.set(form.building_id, form.building_no.trim());
    } else if (form.building_no.trim()) {
      values.set(form.building_no.trim(), form.building_no.trim());
    }

    return Array.from(values, ([id, label]) => ({ id, label }));
  }, [form.building_id, form.building_no, selectedFarmLocations]);
  const breederSourceOptions = useMemo(() => {
    const values = new Set(sourceOptions);
    if (form.source.trim()) values.add(form.source.trim());
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [form.source, sourceOptions]);

  useEffect(() => {
    if (
      form.building_id ||
      !form.building_no ||
      !selectedFarmLocations.length
    ) {
      return;
    }

    const match = selectedFarmLocations.find(
      (location) => location.building_no === form.building_no,
    );

    if (!match) return;

    setForm((prev) => ({
      ...prev,
      building_id: prev.building_id || String(match.building_id),
    }));
  }, [form.building_id, form.building_no, selectedFarmLocations]);

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

  function getSelectedBuildingPens(source = locations) {
    return source.filter(
      (location) =>
        String(location.building_id) === form.building_id ||
        location.building_no === form.building_no,
    );
  }

  function getNextPenNo(
    pens: FarmLocationLookup[] = getSelectedBuildingPens(),
  ) {
    const highestNumericPen = pens.reduce((highest, pen) => {
      const parsed = Number(pen.pen_no);
      return Number.isFinite(parsed) ? Math.max(highest, parsed) : highest;
    }, 0);

    return String(highestNumericPen ? highestNumericPen + 1 : pens.length + 1);
  }

  function handleFarmChange(farmId: string) {
    const farmLocation = locations.find(
      (location) => String(location.farm_id) === farmId,
    );
    const accessibleFarm = accessibleFarms.find(
      (farm) =>
        String(farm.id) === farmId ||
        normalizeFarmCode(farm.code) ===
          normalizeFarmCode(farmLocation?.farm_code),
    );

    setForm((prev) => ({
      ...prev,
      farm_id: farmId,
      farm_name: farmLocation?.farm_name ?? accessibleFarm?.name ?? "",
      building_id: "",
      building_no: "",
      pen_count: "",
    }));
    setRows([]);
    setNewPenNo("");
  }

  function handleBuildingChange(buildingId: string) {
    const buildingLocations = selectedFarmLocations.filter(
      (location) =>
        String(location.building_id) === buildingId ||
        location.building_no === buildingId,
    );
    const buildingNo = buildingLocations[0]?.building_no ?? buildingId;
    const nextRows = buildRowsFromPens(buildingLocations);

    setForm((prev) => ({
      ...prev,
      building_id: buildingId,
      building_no: buildingNo,
      pen_count: String(nextRows.length),
    }));
    setRows(nextRows);
    setNewPenNo(getNextPenNo(buildingLocations));
  }

  async function handleAddPen() {
    if (!form.building_id) {
      alert("Please select a building before adding a pen.");
      return;
    }

    const penNo = newPenNo.trim();
    if (!penNo) {
      alert("Additional pen number is required.");
      return;
    }

    const existingPens = getSelectedBuildingPens();
    const isDuplicate = existingPens.some(
      (pen) => pen.pen_no.trim().toLowerCase() === penNo.toLowerCase(),
    );

    if (isDuplicate) {
      alert(`Pen ${penNo} already exists for this building.`);
      return;
    }

    setAddingPen(true);
    try {
      await createFarmPen({
        buildingId: asNumber(form.building_id),
        penNo,
      });

      const lookup = await listFarmLocationLookup();
      const refreshedBuildingPens = getSelectedBuildingPens(lookup);
      const nextRows = buildRowsFromPens(refreshedBuildingPens);

      setLocations(lookup);
      setRows(nextRows);
      setForm((prev) => ({
        ...prev,
        pen_count: String(nextRows.length),
      }));
      setNewPenNo(getNextPenNo(refreshedBuildingPens));
      setAddPenDialogOpen(false);
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Failed to add pen."));
    } finally {
      setAddingPen(false);
    }
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

    const payloads: PlacementInsert[] = rows.map((row) => ({
      placement_date: form.placement_date,
      dr_no: form.dr_no.trim(),
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
      remarks: form.remarks.trim() || null,
    }));

    setSaving(true);
    try {
      if (isEdit) {
        const id = Number(idParam);
        if (!Number.isFinite(id)) throw new Error("Invalid placement id.");
        await updatePlacement(
          id,
          hasDependentRecords ? withoutPlacementDate(payloads[0]) : payloads[0],
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
    <div className="space-y-4 mt-8">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Placement List"
        CurrentPageName={isEdit ? "Edit Placement" : "New Placement"}
      />

      <Card>
        <CardContent className="pt-4 space-y-5">
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <div className="grid grid-cols-1 gap-4 bg-stone-50/80 p-5 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1.5">
                <RequiredLabel>Farm Name</RequiredLabel>
                <SearchableCombobox
                  items={farmOptions}
                  value={form.farm_id}
                  onValueChange={handleFarmChange}
                  placeholder={
                    loadingLocations ? "Loading farms..." : "Select farm..."
                  }
                  showCode
                  className={`w-full bg-white ${
                    disabledAll || loadingLocations || isEdit
                      ? "pointer-events-none opacity-50"
                      : ""
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <RequiredLabel>Building #</RequiredLabel>
                <Select
                  value={form.building_id || form.building_no}
                  onValueChange={handleBuildingChange}
                  disabled={
                    disabledAll || loadingLocations || !form.farm_id || isEdit
                  }
                >
                  <SelectTrigger className="h-10 w-full bg-white">
                    <SelectValue
                      placeholder={
                        form.farm_id ? "Select building" : "Select farm first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {buildingOptions.length ? (
                      buildingOptions.map((building) => (
                        <SelectItem key={building.id} value={building.id}>
                          {building.label}
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

              <div className="space-y-1.5 md:col-span-2 xl:col-span-1">
                <RequiredLabel>Total Pen</RequiredLabel>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={
                      form.pen_count
                        ? asNumber(form.pen_count).toLocaleString("en-US")
                        : ""
                    }
                    placeholder="Generated from building"
                    disabled
                    className="h-10 bg-stone-100"
                  />
                  {!isEdit ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddPenDialogOpen(true)}
                      disabled={
                        disabledAll ||
                        addingPen ||
                        loadingLocations ||
                        !form.building_id
                      }
                      className="h-10 shrink-0 gap-2 border-emerald-600/60 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      <Plus className="h-4 w-4" />
                      Add Pen
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecting a building creates placement rows from active pens.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-stone-200 p-5 md:grid-cols-2 xl:grid-cols-3">
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
                  disabled={disablePlacementDate}
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

            <div className="space-y-3">
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
                        colSpan={5}
                        className={`${SheetClasses.group} text-pink-800`}
                      >
                        Female
                      </th>
                      <th
                        colSpan={5}
                        className={`${SheetClasses.group} text-sky-800`}
                      >
                        Male
                      </th>
                    </tr>
                    <tr>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.count}`}
                      >
                        Total Placement
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.count}`}
                      >
                        DOA
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.count}`}
                      >
                        Rejects
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.shortCount}`}
                      >
                        Short Count
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.ending}`}
                      >
                        Ending
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.count}`}
                      >
                        Total Placement
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.count}`}
                      >
                        DOA
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.count}`}
                      >
                        Rejects
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.shortCount}`}
                      >
                        Short Count
                      </th>
                      <th
                        className={`${SheetClasses.header} ${TableWidths.ending}`}
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
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={11}
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

      <Dialog
        open={addPenDialogOpen}
        onOpenChange={(open) => {
          if (!addingPen) setAddPenDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddPen();
            }}
          >
            <DialogHeader>
              <DialogTitle>Add Pen</DialogTitle>
              <DialogDescription>
                Add a new pen to building {form.building_no}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <RequiredLabel>Pen Name</RequiredLabel>
              <Input
                type="text"
                value={newPenNo}
                onChange={(event) => setNewPenNo(event.target.value)}
                placeholder="Enter pen name"
                disabled={addingPen}
                autoFocus
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddPenDialogOpen(false)}
                disabled={addingPen}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addingPen}>
                <Plus className="h-4 w-4" />
                {addingPen ? "Adding..." : "Add Pen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
