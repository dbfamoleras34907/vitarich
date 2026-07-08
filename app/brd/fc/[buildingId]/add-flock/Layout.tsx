"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Minus, MousePointerClick, Plus } from "lucide-react";
import { toast } from "sonner";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  getFarmOriginBatchesForFlockCard,
  getFarmBuildingsForFlockCard,
  getFarmInfoForFlockCard,
  type FarmBuildingListRow,
  type FarmOriginBatchOption,
  type FlockCardFarmInfo,
} from "../../api";
import { calculateFlockAgeFromStartDate } from "../../age";
import { getFlockCardPlacement, saveFlockCardPlacement } from "./api";

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

type AddFlockForm = {
  age: string;
  flockStartDate: string;
  broilerType: string;
  breed: string;
  guideline: string;
  coccidiostatProgramId: string;
  otherProgramId: string;
  vaccinationProgramId: string;
  flockId: string;
  trialCode: string;
  cycleNumber: string;
  nofAnimals: string;
  feedMill: string;
  stockingDensity: string;
  stockingDensityByWeight: string;
  sex: string;
};

type FlockOriginRow = {
  id: string;
  batch: string;
  itemCode: string;
  itemName: string;
  warehouse: string;
  warehouseName: string;
  grOrigin: string;
  nofAnimals: string;
  breed: string;
  onHandQty: number;
  manufacturingDate: string;
  expiryDate: string;
};

const broilerTypeOptions = [
  { value: "2kgMax", label: "<= 2 kg" },
  { value: "2To3", label: "2 - 3 kg" },
  { value: "3kgMin", label: ">= 3 kg" },
  { value: "freeRange", label: "Free range" },
  { value: "slowGrowingBirds", label: "Slow growing birds" },
  { value: "byProduct", label: "By product" },
];

const sexOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "mix", label: "Mix" },
];

const breedOptions = [
  "Arbor Acres Plus",
  "Aviagen AP 95",
  "COBB 400",
  "COBB 500",
  "COBB 700",
  "COBB 800",
  "COBB AVIAN 48",
  "Cobb Sasso-150",
  "Cobb Sasso-175",
  "Hubbard Classic",
  "Hubbard Efficiency Plus",
  "Hubbard F15",
  "Hubbard Flex",
  "Hubbard H1",
  "Hubbard JA 757",
  "Hubbard JA 787",
  "Hubbard JA 957",
  "Hubbard JA 987",
  "Hubbard JV",
  "Hubbard Redbro",
  "Indian River",
  "Ross Ranger",
  "Ross 308",
  "Ross 708",
  "Ross PM3",
  "Rowan Rambler Ranger",
  "Rowan Ranger",
  "Rowan Ranger Classic",
  "Rowan Ranger Gold",
  "Vencobb 430 Y",
  "Mixed",
  "Other",
  "Unknown",
];

const breedComboOptions = breedOptions.map(breed => ({
  code: breed,
  name: breed,
}));

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();

  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

const emptyFlockForm: AddFlockForm = {
  age: "0",
  flockStartDate: today(),
  broilerType: "",
  breed: "",
  guideline: "",
  coccidiostatProgramId: "",
  otherProgramId: "",
  vaccinationProgramId: "",
  flockId: "",
  trialCode: "",
  cycleNumber: "",
  nofAnimals: "",
  feedMill: "",
  stockingDensity: "",
  stockingDensityByWeight: "",
  sex: "unknown",
};

const newOriginRow = (): FlockOriginRow => ({
  id: crypto.randomUUID(),
  batch: "",
  itemCode: "",
  itemName: "",
  warehouse: "",
  warehouseName: "",
  grOrigin: "",
  nofAnimals: "",
  breed: "",
  onHandQty: 0,
  manufacturingDate: "",
  expiryDate: "",
});

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);

const formatDateValue = (value: string) => value || "-";

export default function Layout() {
  const router = useRouter();
  const params = useParams<{ buildingId: string }>();
  const routePayload = useMemo(
    () => decryptData(params.buildingId) as AddFlockRoutePayload | null,
    [params.buildingId],
  );
  const [form, setForm] = useState<AddFlockForm>(emptyFlockForm);
  const [originRows, setOriginRows] = useState<FlockOriginRow[]>([newOriginRow()]);
  const [farmInfo, setFarmInfo] = useState<FlockCardFarmInfo | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<FarmBuildingListRow | null>(null);
  const [originBatchRows, setOriginBatchRows] = useState<FarmOriginBatchOption[]>([]);
  const [loadingOriginBatches, setLoadingOriginBatches] = useState(false);
  const [originBatchError, setOriginBatchError] = useState("");
  const [originBatchDialogOpen, setOriginBatchDialogOpen] = useState(false);
  const [originBatchSelectionRowId, setOriginBatchSelectionRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editingCardNo, setEditingCardNo] = useState("");
  const [loadingFlockCard, setLoadingFlockCard] = useState(false);

  const selectedOriginRow = originRows.find(row => row.id === originBatchSelectionRowId) ?? null;
const totalOriginOnHand = originBatchRows.reduce((sum, row) => sum + row.onHandQty, 0);
  const totalOriginAnimals = originRows.reduce((sum, row) => sum + (Number(row.nofAnimals) || 0), 0);

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
    if (!routePayload?.farmId) return;

    let cancelled = false;

    async function loadOriginBatches() {
      setLoadingOriginBatches(true);
      setOriginBatchError("");

      try {
        const rows = await getFarmOriginBatchesForFlockCard(Number(routePayload?.farmId));
        if (cancelled) return;
        setOriginBatchRows(rows);
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setOriginBatchRows([]);
        setOriginBatchError(error instanceof Error ? error.message : "Unable to load farm batches.");
      } finally {
        if (!cancelled) setLoadingOriginBatches(false);
      }
    }

    void loadOriginBatches();

    return () => {
      cancelled = true;
    };
  }, [routePayload?.farmId]);

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
        setForm({
          age: String(card.startDate ? calculateFlockAgeFromStartDate(card.startDate) : card.age ?? 0),
          flockStartDate: card.startDate || today(),
          broilerType: card.broilerType ?? "",
          breed: card.breed ?? "",
          guideline: card.guideline ?? "",
          coccidiostatProgramId: card.coccidiostatProgramId ?? "",
          otherProgramId: card.otherProgramId ?? "",
          vaccinationProgramId: card.vaccinationProgramId ?? "",
          flockId: card.flockCode ?? "",
          trialCode: card.trialCode ?? "",
          cycleNumber: card.cycleNumber ?? "",
          nofAnimals: card.animalQty ? String(card.animalQty) : "",
          feedMill: card.feedMill ?? "",
          stockingDensity: card.stockingDensity ? String(card.stockingDensity) : "",
          stockingDensityByWeight: card.stockingDensityByWeight ? String(card.stockingDensityByWeight) : "",
          sex: card.sex ?? "unknown",
        });

        const rows = card.origins.map(origin => ({
          id: crypto.randomUUID(),
          batch: origin.batchNo,
          itemCode: origin.itemCode ?? "",
          itemName: origin.itemName ?? "",
          warehouse: origin.warehouseCode ?? "",
          warehouseName: origin.warehouseName ?? "",
          grOrigin: origin.grOrigin ?? "",
          nofAnimals: origin.animalQty ? String(origin.animalQty) : "",
          breed: origin.breed ?? card.breed ?? "",
          onHandQty: Number(origin.onHandSnapshot ?? origin.animalQty ?? 0),
          manufacturingDate: origin.manufacturingDate ?? "",
          expiryDate: origin.expiryDate ?? "",
        }));

        setOriginRows(rows.length > 0 ? rows : [newOriginRow()]);
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

  function updateForm<K extends keyof AddFlockForm>(key: K, value: AddFlockForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function updateFlockStartDate(value: string) {
    setForm(current => ({
      ...current,
      flockStartDate: value,
      age: String(calculateFlockAgeFromStartDate(value)),
    }));
  }

  function updateOriginRow(id: string, changes: Partial<FlockOriginRow>) {
    setOriginRows(current => current.map(row =>
      row.id === id ? { ...row, ...changes } : row
    ));
  }

  function updateBreed(value: string) {
    updateForm("breed", value);
    setOriginRows(current => current.map(row => ({ ...row, breed: value })));
  }

  function openOriginBatchSelection(rowId: string) {
    setOriginBatchSelectionRowId(rowId);
    setOriginBatchDialogOpen(true);
  }

  function selectOriginBatch(batch: FarmOriginBatchOption) {
    if (!originBatchSelectionRowId) return;

    updateOriginRow(originBatchSelectionRowId, {
      batch: batch.batchNumber,
      itemCode: batch.itemCode,
      itemName: batch.itemName,
      warehouse: batch.warehouseCode,
      warehouseName: batch.warehouseName,
      grOrigin: batch.grOrigin,
      nofAnimals: String(batch.onHandQty),
      onHandQty: batch.onHandQty,
      manufacturingDate: batch.manufacturingDate,
      expiryDate: batch.expiryDate,
    });
    setOriginBatchDialogOpen(false);
    setOriginBatchSelectionRowId(null);
  }

  async function handleSave() {
    const firstOrigin = originRows[0];

    if (!routePayload?.farmId || !routePayload.buildingKey) {
      toast("Unable to read selected building.");
      return;
    }

    if (!form.flockStartDate || !form.broilerType || !form.breed || !firstOrigin?.batch.trim()) {
      toast("Please complete required flock fields.");
      return;
    }

    setSaving(true);

    try {
      const flockAge = calculateFlockAgeFromStartDate(form.flockStartDate);
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
        flockCode: form.flockId,
        trialCode: form.trialCode,
        cycleNumber: form.cycleNumber,
        animalQty: Number(form.nofAnimals || 0) || totalOriginAnimals,
        feedMill: form.feedMill,
        stockingDensity: Number(form.stockingDensity || 0) || null,
        stockingDensityByWeight: Number(form.stockingDensityByWeight || 0) || null,
        sex: form.sex,
        origins: originRows.map((row, index) => ({
          lineNo: index + 1,
          itemCode: row.itemCode,
          itemName: row.itemName,
          batchNo: row.batch,
          warehouseCode: row.warehouse,
          warehouseName: row.warehouseName,
          grOrigin: row.grOrigin,
          animalQty: Number(row.nofAnimals || 0),
          onHandSnapshot: row.onHandQty,
          breed: form.breed,
          manufacturingDate: row.manufacturingDate,
          expiryDate: row.expiryDate,
        })),
      });

      toast(`Cycle saved: ${savedCard.cardNo}`);
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
                <label className="text-sm font-medium">Cycle start date</label>
                <Input
                  type="date"
                  value={form.flockStartDate}
                  onChange={event => updateFlockStartDate(event.target.value)}
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
                <label className="text-sm font-medium">Type of broiler *</label>
                <Select value={form.broilerType} onValueChange={value => updateForm("broilerType", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {broilerTypeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Breed *</label>
                <SearchableCombobox
                  items={breedComboOptions}
                  value={form.breed}
                  onValueChange={updateBreed}
                  placeholder="Select breed"
                  showCode={false}
                  className="w-full"
                />
              </div>

              <div className="grid gap-2 md:col-span-2">
                <label className="text-sm font-medium">Guideline</label>
                <Input
                  value={form.guideline}
                  onChange={event => updateForm("guideline", event.target.value)}
                  placeholder="Select or enter guideline"
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
                ["flockId", "Cycle ID", "Enter the flock ID"],
                ["trialCode", "Trial code", "Enter the trial code"],
                ["cycleNumber", "Cycle number", "Enter the cycle number"],
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

          <section className="rounded-lg border">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Placement</h2>
              <Button type="button" size="sm" variant="outline" onClick={() => setOriginRows(current => [...current, newOriginRow()])}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            <div className="overflow-hidden">
              <table className="w-full table-fixed border-collapse text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-[20%] border-r px-3 py-2">Batch *</th>
                    <th className="w-[18%] border-r px-3 py-2">Warehouse</th>
                    <th className="w-[18%] border-r px-3 py-2">GR Origin</th>
                    <th className="w-[16%] border-r px-3 py-2">Number of animals</th>
                    <th className="w-[22%] border-r px-3 py-2">Breed</th>
                    <th className="w-[6%] px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {originRows.map(row => (
                    <tr key={row.id} className="border-t">
                      <td className="border-r p-1 align-middle">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 w-full justify-between rounded-sm px-2 font-normal"
                          onClick={() => openOriginBatchSelection(row.id)}
                        >
                          <span className={row.batch ? "truncate font-medium" : "truncate text-muted-foreground"}>
                            {row.batch || "Select batch"}
                          </span>
                          <MousePointerClick className="ml-2 size-4 shrink-0 text-muted-foreground" />
                        </Button>
                      </td>
                      <td className="border-r p-1 align-middle">
                        <Input value={row.warehouse} readOnly className="h-8 rounded-sm border-0 bg-transparent shadow-none focus-visible:ring-1" />
                      </td>
                      <td className="border-r p-1 align-middle">
                        <Input value={row.grOrigin} readOnly className="h-8 rounded-sm border-0 bg-transparent shadow-none focus-visible:ring-1" />
                      </td>
                      <td className="border-r p-1 align-middle">
                        <Input type="number" min={0} value={row.nofAnimals} onChange={event => updateOriginRow(row.id, { nofAnimals: event.target.value })} className="h-8 rounded-sm border-0 bg-transparent text-right shadow-none focus-visible:ring-1" />
                      </td>
                      <td className="border-r p-1 align-middle">
                        <Input value={form.breed || row.breed} readOnly className="h-8 rounded-sm border-0 bg-transparent shadow-none focus-visible:ring-1" />
                      </td>
                      <td className="p-1 text-center align-middle">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          disabled={originRows.length === 1}
                          onClick={() => setOriginRows(current => current.filter(item => item.id !== row.id))}
                        >
                          <Minus className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      <Dialog
        open={originBatchDialogOpen}
        onOpenChange={(open) => {
          setOriginBatchDialogOpen(open);
          if (!open) setOriginBatchSelectionRowId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-hidden sm:max-w-6xl [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>Select Origin Batch</DialogTitle>
            <DialogDescription>
              Choose the batch used for this flock origin from the selected farm warehouses.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="grid gap-2 text-sm sm:grid-cols-4">
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Farm</div>
                <div className="truncate font-semibold text-foreground">{farmInfo?.name || routePayload?.farmName || "-"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Building</div>
                <div className="truncate font-semibold text-foreground">
                  {selectedBuilding?.code || routePayload?.buildingCode || "-"}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Current Batch</div>
                <div className="truncate font-semibold text-foreground">{selectedOriginRow?.batch || "-"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Available On Hand</div>
                <div className="font-semibold tabular-nums text-foreground">
                  {loadingOriginBatches ? "Loading..." : formatQuantity(totalOriginOnHand)}
                </div>
              </div>
            </div>
          </div>

          {loadingOriginBatches ? (
            <div className="flex items-center justify-center gap-2 rounded-md border bg-muted/40 px-3 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading farm batches...
            </div>
          ) : originBatchError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              {originBatchError}
            </div>
          ) : originBatchRows.length === 0 ? (
            <div className="rounded-md border bg-muted/40 px-3 py-10 text-center text-sm text-muted-foreground">
              No available batches were found in this farm warehouse setup.
            </div>
          ) : (
            <div className="w-full max-w-full overflow-hidden rounded-md border">
              <div className="w-full">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_88px_76px_76px_minmax(0,1fr)_76px] gap-2 bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  <div>Batch</div>
                  <div>Item</div>
                  <div>Warehouse</div>
                  <div className="text-right">On hand</div>
                  <div>MFG</div>
                  <div>EXP</div>
                  <div>GR Origin</div>
                  <div />
                </div>

                <div className="max-h-[50vh] overflow-y-auto">
                  {originBatchRows.map(batch => (
                    <div
                      key={batch.id}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_88px_76px_76px_minmax(0,1fr)_76px] gap-2 border-t px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground">{batch.batchNumber}</div>
                        <div className="truncate text-xs text-muted-foreground">{batch.id}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{batch.itemName || batch.itemCode}</div>
                        <div className="truncate text-xs text-muted-foreground">{batch.itemCode}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{batch.warehouseName || batch.warehouseCode}</div>
                        <div className="truncate text-xs text-muted-foreground">{batch.warehouseCode}</div>
                      </div>
                      <div className="text-right font-semibold tabular-nums text-foreground">
                        {formatQuantity(batch.onHandQty)}
                      </div>
                      <div className="text-muted-foreground">{formatDateValue(batch.manufacturingDate)}</div>
                      <div className="text-muted-foreground">{formatDateValue(batch.expiryDate)}</div>
                      <div className="min-w-0 truncate text-muted-foreground">{batch.grOrigin || "-"}</div>
                      <div className="flex justify-end">
                        <Button type="button" size="sm" onClick={() => selectOriginBatch(batch)}>
                          Select
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
