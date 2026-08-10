"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Breadcrumb from "@/lib/Breadcrumb";
import { decryptData } from "@/app/utils/supabase/url-encryption";
import {
  getBuildingPlacementInventory,
  getFarmBuildingsForFlockCard,
  getFarmInfoForFlockCard,
  type FarmOriginBatchOption,
  type FarmBuildingListRow,
  type FlockCardFarmInfo,
} from "../../api";
import { calculateFlockAgeFromStartDate } from "../../age";
import {
  getFlockCardPlacement,
  getNextFlockCardCycleCount,
  flockCardBreedComboOptions,
  saveFlockCardPlacement,
} from "./api";

type AddFlockRoutePayload = {
  farmId?: number;
  farmCode?: string | null;
  farmName?: string | null;
  farmAddress?: string | null;
  farmType?: string | null;
  farmContact?: string | null;
  buildingKey?: string;
  buildingCode?: string;
  buildingName?: string;
  cardId?: number | null;
};

type CompactAddFlockRoutePayload = [
  farmId?: number,
  buildingKey?: string,
  cardId?: number | null,
];

type AddFlockForm = {
  age: string;
  flockStartDate: string;
  cycleAsOfDate: string;
  broilerType: string;
  breed: string;
  guideline: string;
  coccidiostatProgramId: string;
  otherProgramId: string;
  vaccinationProgramId: string;
  trialCode: string;
  cycleNumber: string;
  nofAnimals: string;
  feedMill: string;
  stockingDensity: string;
  stockingDensityByWeight: string;
  sex: string;
  extra: Record<string, unknown>;
};

const sexOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "mix", label: "Mix" },
];

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();

  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

const emptyFlockForm: AddFlockForm = {
  age: "0",
  flockStartDate: today(),
  cycleAsOfDate: "",
  broilerType: "",
  breed: "",
  guideline: "",
  coccidiostatProgramId: "",
  otherProgramId: "",
  vaccinationProgramId: "",
  trialCode: "",
  cycleNumber: "1",
  nofAnimals: "",
  feedMill: "",
  stockingDensity: "",
  stockingDensityByWeight: "",
  sex: "unknown",
  extra: {},
};

const optionalNumberToInputValue = (value: number | string | null | undefined) =>
  value == null || value === "" ? "" : String(value);

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);

const formatDateValue = (value: string) => value || "-";
const calculateCycleAge = (startDate: string, asOfDate: string) =>
  calculateFlockAgeFromStartDate(
    startDate,
    asOfDate ? new Date(`${asOfDate}T00:00:00`) : new Date(),
  );

function normalizeRoutePayload(value: unknown): AddFlockRoutePayload | null {
  if (Array.isArray(value)) {
    const [farmId, buildingKey, cardId] = value as CompactAddFlockRoutePayload;

    return {
      farmId: Number(farmId),
      buildingKey,
      cardId: cardId ?? null,
    };
  }

  return value as AddFlockRoutePayload | null;
}

export default function Layout() {
  const router = useRouter();
  const params = useParams<{ buildingId: string }>();
  const routePayload = useMemo(
    () => normalizeRoutePayload(decryptData(params.buildingId)),
    [params.buildingId],
  );
  const [form, setForm] = useState<AddFlockForm>(emptyFlockForm);
  const [farmInfo, setFarmInfo] = useState<FlockCardFarmInfo | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<FarmBuildingListRow | null>(null);
  const [placementRows, setPlacementRows] = useState<FarmOriginBatchOption[]>([]);
  const [loadingPlacement, setLoadingPlacement] = useState(false);
  const [placementError, setPlacementError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editingCardNo, setEditingCardNo] = useState("");
  const [editingFarmCycleId, setEditingFarmCycleId] = useState<number | null>(null);
  const [loadingFlockCard, setLoadingFlockCard] = useState(false);
  const totalPlacementAnimals = placementRows.reduce(
    (sum, row) => sum + Number(row.onHandQty || 0),
    0,
  );
  const placementBatchTotals = Array.from(new Map(
    placementRows.map(row => [
      [row.itemCode, row.batchNumber, row.warehouseCode].map(value => value.trim().toUpperCase()).join("|"),
      row,
    ]),
  ).values());
  const totalActualReceived = placementBatchTotals.reduce(
    (sum, row) => sum + row.docDetails.reduce(
      (detailSum, detail) => detailSum + Number(detail.actualReceived || 0),
      0,
    ),
    0,
  );
  const totalMortalityAnimals = placementBatchTotals.reduce((sum, row) => sum + Number(row.mortalityQty || 0), 0);
  const totalThinningAnimals = placementBatchTotals.reduce((sum, row) => sum + Number(row.thinningQty || 0), 0);

  useEffect(() => {
    if (!routePayload?.farmId) return;

    let cancelled = false;

    async function loadFarmInformation() {
      try {
        const [farm, buildings] = await Promise.all([
          getFarmInfoForFlockCard(Number(routePayload?.farmId)),
          getFarmBuildingsForFlockCard(Number(routePayload?.farmId)),
        ]);

        if (cancelled) return;

        setFarmInfo(farm);
        setSelectedBuilding(
          buildings.find(building => building.key === routePayload?.buildingKey) ?? null,
        );
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setFarmInfo(null);
          setSelectedBuilding(null);
        }
      }
    }

    void loadFarmInformation();

    return () => {
      cancelled = true;
    };
  }, [routePayload?.buildingKey, routePayload?.farmId]);

  useEffect(() => {
    const farmId = Number(routePayload?.farmId ?? 0);
    if (!Number.isFinite(farmId) || farmId <= 0 || !selectedBuilding) {
      setPlacementRows([]);
      return;
    }

    let cancelled = false;
    setLoadingPlacement(true);
    setPlacementError("");

    getBuildingPlacementInventory({
      farmId,
      buildingCode: selectedBuilding.code,
      buildingName: selectedBuilding.name,
      buildingKey: selectedBuilding.key,
      buildingWarehouseCode: selectedBuilding.warehouseCode || selectedBuilding.code,
    })
      .then(rows => {
        if (!cancelled) setPlacementRows(rows);
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) {
          setPlacementRows([]);
          setPlacementError(error instanceof Error ? error.message : "Unable to load building stock.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPlacement(false);
      });

    return () => {
      cancelled = true;
    };
  }, [routePayload?.farmId, selectedBuilding]);

  useEffect(() => {
    const cardId = Number(routePayload?.cardId ?? 0);
    if (!Number.isFinite(cardId) || cardId <= 0) return;

    let cancelled = false;
    setLoadingFlockCard(true);

    getFlockCardPlacement(cardId)
      .then(card => {
        if (cancelled || !card) return;

        setEditingCardId(card.id);
        setEditingCardNo(card.cardNo);
        setEditingFarmCycleId(card.farmCycleId ?? null);
        setForm({
          age: String(card.startDate
            ? calculateCycleAge(card.startDate, String(card.extra?.cycleAsOfDate ?? ""))
            : card.age ?? 0),
          flockStartDate: card.startDate || today(),
          cycleAsOfDate: String(card.extra?.cycleAsOfDate ?? ""),
          broilerType: card.broilerType ?? "",
          breed: card.breed ?? "",
          guideline: card.guideline ?? "",
          coccidiostatProgramId: card.coccidiostatProgramId ?? "",
          otherProgramId: card.otherProgramId ?? "",
          vaccinationProgramId: card.vaccinationProgramId ?? "",
          trialCode: card.trialCode ?? "",
          cycleNumber: card.cycleNumber?.trim() || "1",
          nofAnimals: optionalNumberToInputValue(card.animalQty),
          feedMill: card.feedMill ?? "",
          stockingDensity: optionalNumberToInputValue(card.stockingDensity),
          stockingDensityByWeight: optionalNumberToInputValue(card.stockingDensityByWeight),
          sex: card.sex ?? "unknown",
          extra: card.extra ?? {},
        });

      })
      .catch(error => {
        console.error(error);
        if (!cancelled) toast(`Unable to load flock card: ${error instanceof Error ? error.message : "Unknown error"}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingFlockCard(false);
      });

    return () => {
      cancelled = true;
    };
  }, [routePayload?.cardId]);

  useEffect(() => {
    if (editingCardId || !routePayload?.farmId || !routePayload.buildingKey || !selectedBuilding) return;

    let cancelled = false;

    getNextFlockCardCycleCount({
      farmId: routePayload.farmId,
      buildingId: selectedBuilding.source === "BUILDING" ? selectedBuilding.id : null,
      buildingWarehouseId: selectedBuilding.source === "WAREHOUSE" ? selectedBuilding.id : null,
      buildingKey: routePayload.buildingKey,
    })
      .then(cycleCount => {
        if (!cancelled) updateForm("cycleNumber", cycleCount);
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) toast(`Unable to calculate cycle count: ${error instanceof Error ? error.message : "Unknown error"}`);
      });

    return () => {
      cancelled = true;
    };
  }, [editingCardId, routePayload?.buildingKey, routePayload?.farmId, selectedBuilding]);

  function updateForm<K extends keyof AddFlockForm>(key: K, value: AddFlockForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function updateFlockStartDate(value: string) {
    setForm(current => ({
      ...current,
      flockStartDate: value,
      age: String(calculateCycleAge(value, current.cycleAsOfDate)),
    }));
  }

  function updateCycleAsOfDate(value: string) {
    setForm(current => ({
      ...current,
      cycleAsOfDate: value,
      age: String(calculateCycleAge(current.flockStartDate, value)),
    }));
  }

  function updateBreed(value: string) {
    updateForm("breed", value);
  }

  async function handleSave() {
    if (!routePayload?.farmId || !routePayload.buildingKey) {
      toast("Unable to read selected building.");
      return;
    }

    if (!form.flockStartDate || !form.breed) {
      toast("Please complete required flock fields.");
      return;
    }

    setSaving(true);

    try {
      const flockAge = calculateCycleAge(form.flockStartDate, form.cycleAsOfDate);
      const savedCard = await saveFlockCardPlacement({
        id: editingCardId,
        cardNo: editingCardNo,
        farmId: routePayload.farmId,
        farmCode: farmInfo?.code || routePayload.farmCode || null,
        farmName: farmInfo?.name || routePayload.farmName || null,
        buildingId: selectedBuilding?.source === "BUILDING" ? selectedBuilding.id : null,
        buildingWarehouseId: selectedBuilding?.source === "WAREHOUSE" ? selectedBuilding.id : null,
        buildingSource: selectedBuilding?.source ?? null,
        buildingKey: routePayload.buildingKey,
        buildingCode: selectedBuilding?.code || routePayload.buildingCode || null,
        buildingName: selectedBuilding?.name || routePayload.buildingName || null,
        age: flockAge,
        startDate: form.flockStartDate,
        broilerType: form.broilerType,
        breed: form.breed,
        guideline: form.guideline,
        coccidiostatProgramId: form.coccidiostatProgramId,
        otherProgramId: form.otherProgramId,
        vaccinationProgramId: form.vaccinationProgramId,
        trialCode: form.trialCode,
        cycleNumber: form.cycleNumber,
        farmCycleId: editingFarmCycleId,
        animalQty: form.nofAnimals.trim() === ""
          ? totalPlacementAnimals
          : Number(form.nofAnimals || 0),
        feedMill: form.feedMill,
        stockingDensity: Number(form.stockingDensity || 0) || null,
        stockingDensityByWeight: Number(form.stockingDensityByWeight || 0) || null,
        sex: form.sex,
        extra: {
          ...form.extra,
          cycleAsOfDate: form.cycleAsOfDate,
        },
        origins: placementRows.map((row, index) => ({
          lineNo: index + 1,
          itemCode: row.itemCode,
          itemName: row.itemName,
          batchNo: row.batchNumber,
          warehouseCode: row.warehouseCode,
          warehouseName: row.warehouseName,
          grOrigin: row.grOrigin,
          animalQty: Number(row.onHandQty || 0),
          onHandSnapshot: row.batchOnHandQty,
          breed: form.breed,
          manufacturingDate: row.manufacturingDate,
          expiryDate: row.expiryDate,
          extra: {
            docDetails: row.docDetails,
            mortalityQty: row.mortalityQty,
            thinningQty: row.thinningQty,
            batchOnHandQty: row.batchOnHandQty,
          },
        })),
      });

      toast(`Cycle saved: ${savedCard.cardNo}.`);
      router.push("/brd/fc");
    } catch (error) {
      console.error(error);
      toast(`Unable to save flock: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-8 text-stone-950 dark:bg-background dark:text-foreground">
      <div className="flex items-center justify-between gap-3 px-4 mt-4">
        <Breadcrumb
          SecondPreviewPageName="Breeder"
          SecondPreviewPageLink="/brd"
          FirstPreviewsPageName="Cycle Card"
          FirstPreviewsPageLink="/brd/fc"
          CurrentPageName="Add Cycle"
        />
        <Button type="button" variant="outline" onClick={() => router.push("/brd/fc")}>
          <ArrowLeft className="size-4" />
          Cycle Card List
        </Button>
      </div>

      <section className="mx-auto mt-6 max-w-[1270px] overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-card">
        <div className="border-b p-5">
          <h1 className="text-lg font-semibold">{editingCardId ? "Edit flock" : "Add new Cycle"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Building {selectedBuilding?.code || selectedBuilding?.name || routePayload?.buildingCode || routePayload?.buildingName || "-"}
            {editingCardNo ? ` | ${editingCardNo}` : ""}
          </p>
        </div>

        {loadingFlockCard ? (
          <div className="flex items-center justify-center gap-2 border-b px-5 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading flock card information...
          </div>
        ) : null}

        <div className="space-y-5 p-5">
          <section className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Farm information</h2>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Farm</label>
                <Input value={farmInfo?.name || routePayload?.farmName || ""} readOnly className="bg-stone-50" />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Farm Code</label>
                <Input value={farmInfo?.code || routePayload?.farmCode || ""} readOnly className="bg-stone-50" />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Complex</label>
                <Input value={farmInfo?.farmType || routePayload?.farmType || ""} readOnly className="bg-stone-50" />
              </div>

              <div className="grid gap-2 md:col-span-2">
                <label className="text-sm font-medium">Location</label>
                <Input value={farmInfo?.address || routePayload?.farmAddress || ""} readOnly className="bg-stone-50" />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Contact</label>
                <Input value={farmInfo?.contactPerson || routePayload?.farmContact || ""} readOnly className="bg-stone-50" />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Selected Building</label>
                <Input
                  value={selectedBuilding
                    ? `${selectedBuilding.code}${selectedBuilding.name ? ` - ${selectedBuilding.name}` : ""}`
                    : routePayload?.buildingCode || routePayload?.buildingName || ""}
                  readOnly
                  className="bg-stone-50"
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Placement Information</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  DOC inventory currently available in {selectedBuilding?.code || "the selected building"}.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-right text-xs">
                <div className="rounded-md border px-3 py-2">
                  <div className="text-muted-foreground">Actual Received</div>
                  <div className="font-semibold tabular-nums">{formatQuantity(totalActualReceived)}</div>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <div className="text-muted-foreground">On-hand</div>
                  <div className="font-semibold tabular-nums">{formatQuantity(totalPlacementAnimals)}</div>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <div className="text-muted-foreground">Mortality</div>
                  <div className="font-semibold tabular-nums">{formatQuantity(totalMortalityAnimals)}</div>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <div className="text-muted-foreground">Thinning</div>
                  <div className="font-semibold tabular-nums">{formatQuantity(totalThinningAnimals)}</div>
                </div>
              </div>
            </div>

            {loadingPlacement ? (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading building DOC inventory...
              </div>
            ) : placementError ? (
              <div className="p-4 text-sm text-destructive">{placementError}</div>
            ) : placementRows.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No DOC inventory is available for this building.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1300px] w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      {[
                        "GR Origin",
                        "Receive Date",
                        "MNF Date",
                        "Transfer Slip",
                        "Total Received",
                        "Actual Received",
                        "Avg DOC Weight",
                        "DOA",
                        "Reject",
                        "Short",
                        "Short Count Remarks",
                        "DOA Count Remarks",
                        "Reject Count Remarks",
                      ].map(label => (
                        <th key={label} className="whitespace-nowrap border-r px-3 py-2 last:border-r-0">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {placementRows.map(row => {
                      const details = row.docDetails.length > 0 ? row.docDetails : [undefined];

                      return details.map((detail, detailIndex) => (
                        <Fragment key={`${row.id}-${detailIndex}`}>
                          <tr className="border-t">
                            <td className="whitespace-nowrap border-r px-3 py-2">{detail?.grOrigin || row.grOrigin || "-"}</td>
                            <td className="whitespace-nowrap border-r px-3 py-2">{formatDateValue(detail?.receiveDate ?? "")}</td>
                            <td className="whitespace-nowrap border-r px-3 py-2">{formatDateValue(detail?.manufacturingDate || row.manufacturingDate)}</td>
                            <td className="whitespace-nowrap border-r px-3 py-2">{detail?.transferSlip || "-"}</td>
                            <td className="whitespace-nowrap border-r px-3 py-2 text-right tabular-nums">{formatQuantity(detail?.totalReceived ?? 0)}</td>
                            <td className="whitespace-nowrap border-r px-3 py-2 text-right tabular-nums">{formatQuantity(detail?.actualReceived ?? row.batchQuantity)}</td>
                            <td className="whitespace-nowrap border-r px-3 py-2 text-right tabular-nums">{formatQuantity(detail?.averageDocWeight ?? 0)}</td>
                            <td className="whitespace-nowrap border-r px-3 py-2 text-right tabular-nums">{formatQuantity(detail?.doaCount ?? 0)}</td>
                            <td className="whitespace-nowrap border-r px-3 py-2 text-right tabular-nums">{formatQuantity(detail?.rejectCount ?? 0)}</td>
                            <td className="whitespace-nowrap border-r px-3 py-2 text-right tabular-nums">{formatQuantity(detail?.shortCount ?? 0)}</td>
                            <td className="border-r px-3 py-2">{detail?.shortCountRemarks || "-"}</td>
                            <td className="border-r px-3 py-2">{detail?.doaCountRemarks || "-"}</td>
                            <td className="px-3 py-2">{detail?.rejectCountRemarks || "-"}</td>
                          </tr>
                        </Fragment>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Mandatory flock info</h2>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Age of birds *</label>
                <div className="flex">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    value={form.age}
                    readOnly
                    className="mx-2 bg-stone-50 text-right"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Cycle Count</label>
                <Input
                  type="number"
                  min={1}
                  value={form.cycleNumber || "1"}
                  placeholder="Calculated automatically"
                  readOnly
                  className="bg-stone-50"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Cycle Date From</label>
                <Input
                  type="date"
                  value={form.flockStartDate}
                  onChange={event => updateFlockStartDate(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Cycle Date To</label>
                <Input
                  type="date"
                  value={form.cycleAsOfDate}
                  onChange={event => updateCycleAsOfDate(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">House name *</label>
                <Input
                  value={selectedBuilding
                    ? `${selectedBuilding.code}${selectedBuilding.name ? ` - ${selectedBuilding.name}` : ""}`
                    : routePayload?.buildingCode || routePayload?.buildingName || ""}
                  readOnly
                  className="bg-stone-50"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Breed *</label>
                <SearchableCombobox
                  items={flockCardBreedComboOptions}
                  value={form.breed}
                  onValueChange={updateBreed}
                  placeholder="Select breed"
                  showCode={false}
                  className="w-full"
                />
              </div>

            </div>
          </section>

          <section className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Optional flock info</h2>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                ["coccidiostatProgramId", "Cocci programs", "Add cocci program"],
                ["otherProgramId", "Other programs", "Add other program"],
                ["vaccinationProgramId", "Vaccination programs", "Add vaccination program"],
                ["trialCode", "Trial code", "Enter the trial code"],
                ["nofAnimals", "Number of animals (on start date)", "Enter the number of animals"],
                ["feedMill", "Feedmill", "Enter the feedmill"],
                ["stockingDensity", "Stocking density (Birds/m2)", "Stocking density"],
                ["stockingDensityByWeight", "Stocking density (kg/m2)", "Stocking density"],
              ].map(([key, label, placeholder]) => (
                <div key={key} className="grid gap-2">
                  <label className="text-sm font-medium">{label}</label>
                  <Input
                    value={String(form[key as keyof AddFlockForm])}
                    onChange={event => updateForm(key as keyof AddFlockForm, event.target.value as never)}
                    placeholder={placeholder}
                    type={["nofAnimals", "stockingDensity", "stockingDensityByWeight"].includes(key) ? "number" : "text"}
                  />
                </div>
              ))}

              <div className="grid gap-2">
                <label className="text-sm font-medium">Sex</label>
                <Select value={form.sex} onValueChange={value => updateForm("sex", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    {sexOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

        </div>

        <div className="flex justify-end gap-2 border-t p-5">
          <Button type="button" variant="outline" onClick={() => router.push("/brd/fc")}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </section>

    </main>
  );
}
