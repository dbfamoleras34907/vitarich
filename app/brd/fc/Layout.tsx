"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  FileSpreadsheet,
  Hash,
  Pencil,
  Loader2,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { getUserFarms } from "@/app/admin/user/new/api";
import { encryptData } from "@/app/utils/supabase/url-encryption";
import {
  getFarmBuildingsForFlockCard,
  type FarmBuildingListRow,
} from "./api";

type FeedWarehouseAssociation = {
  id?: number | null;
  whse_code?: string | null;
  whse_name?: string | null;
  is_default_feed?: boolean | null;
};

type FeedFarm = {
  id: number;
  code: string;
  name: string | null;
  farm_id?: number | null;
  farm_code?: string | null;
  farm_name?: string | null;
  address?: string | null;
  farm_type?: string | null;
  contact_person?: string | null;
  associated_warehouses?: FeedWarehouseAssociation[] | string[] | null;
};

const asArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? value as T[] : [];

function normalizeFarmCode(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeFarm(farm: FeedFarm, masterFarms: FeedFarm[] = []): FeedFarm | null {
  const code = normalizeFarmCode(farm.code ?? farm.farm_code);
  if (!code) return null;

  const masterFarm = masterFarms.find(candidate => normalizeFarmCode(candidate.code) === code);
  const id = farm.id ?? farm.farm_id ?? masterFarm?.id ?? null;

  if (id == null) return null;

  return {
    ...masterFarm,
    ...farm,
    id,
    code,
    name: farm.name ?? farm.farm_name ?? masterFarm?.name ?? code,
    associated_warehouses: farm.associated_warehouses ?? masterFarm?.associated_warehouses ?? null,
  };
}

function getBuildingStatusClass(status: string) {
  const value = status.trim().toLowerCase();

  if (["active", "occupied", "in use", "growing"].includes(value)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  }

  if (["inactive", "closed", "maintenance"].includes(value)) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-border dark:bg-background dark:text-muted-foreground";
}

function formatDateValue(value: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatNumber(value: number) {
  return value.toLocaleString("en-PH");
}

export default function Layout() {
  const router = useRouter();
  const { getValue, setValue } = useGlobalContext();
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [fallbackAssignedFarms, setFallbackAssignedFarms] = useState<FeedFarm[]>([]);
  const [buildings, setBuildings] = useState<FarmBuildingListRow[]>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [buildingError, setBuildingError] = useState("");

  const farmMaster = useMemo(() => {
    const goodsReceiptReferences = getValue("goodsReceiptReferences") as
      | { farms?: FeedFarm[] }
      | undefined;

    const referenceFarms = asArray<FeedFarm>(goodsReceiptReferences?.farms);
    return referenceFarms.length
      ? referenceFarms
      : asArray<FeedFarm>(getValue("getFarmDB"));
  }, [getValue]);

  const sessionUser = getValue("UserInfoAuthSession")?.[0] as
    | { id?: number | string; users_farms?: unknown[] }
    | undefined;

  const assignedFarmCodes = useMemo(
    () => asArray<unknown>(sessionUser?.users_farms).map(normalizeFarmCode).filter(Boolean),
    [sessionUser?.users_farms],
  );

  const farms = useMemo(() => {
    const normalizedMasterFarms = farmMaster
      .map(farm => normalizeFarm(farm, farmMaster))
      .filter((farm): farm is FeedFarm => Boolean(farm));

    if (assignedFarmCodes.length > 0) {
      const assignedCodeSet = new Set(assignedFarmCodes);
      return normalizedMasterFarms.filter(farm => assignedCodeSet.has(farm.code));
    }

    return fallbackAssignedFarms
      .map(farm => normalizeFarm(farm, farmMaster))
      .filter((farm): farm is FeedFarm => Boolean(farm));
  }, [assignedFarmCodes, fallbackAssignedFarms, farmMaster]);

  const effectiveSelectedFarmId = useMemo(() => {
    if (selectedFarmId) return selectedFarmId;

    const defaultFarmId = getValue("DefaultFarmId");
    const defaultFarm = farms.find(farm => String(farm.id) === String(defaultFarmId));

    return defaultFarm ? String(defaultFarm.id) : farms[0] ? String(farms[0].id) : "";
  }, [farms, getValue, selectedFarmId]);

  const selectedFarm = useMemo(
    () => farms.find(farm => String(farm.id) === effectiveSelectedFarmId) ?? null,
    [effectiveSelectedFarmId, farms],
  );

  const farmOptions = useMemo(
    () => farms.map(farm => ({
      code: String(farm.id),
      name: farm.code ? `${farm.code} - ${farm.name ?? ""}` : farm.name ?? String(farm.id),
    })),
    [farms],
  );

  const visibleBuildings = useMemo(() => {
    return [...buildings].sort((left, right) =>
      left.code.localeCompare(right.code) || left.name.localeCompare(right.name)
    );
  }, [buildings]);

  const occupiedCount = useMemo(
    () => visibleBuildings.filter(building => building.flockCard).length,
    [visibleBuildings],
  );
  const totalBirdCount = useMemo(
    () => visibleBuildings.reduce((sum, building) => sum + (building.flockCard?.animalQty ?? 0), 0),
    [visibleBuildings],
  );
  const nextStartDate = useMemo(() => {
    const dates = visibleBuildings
      .map(building => building.flockCard?.startDate ?? "")
      .filter(Boolean)
      .sort();

    return dates[0] ?? "";
  }, [visibleBuildings]);

  useEffect(() => {
    if (assignedFarmCodes.length > 0 || !sessionUser?.id) return;

    let cancelled = false;

    getUserFarms(Number(sessionUser.id))
      .then(farms => {
        if (!cancelled) setFallbackAssignedFarms(Array.isArray(farms) ? farms as FeedFarm[] : []);
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) setFallbackAssignedFarms([]);
      });

    return () => {
      cancelled = true;
    };
  }, [assignedFarmCodes.length, sessionUser?.id]);

  useEffect(() => {
    if (!selectedFarm) {
      return;
    }

    const farmId = selectedFarm.id;
    let cancelled = false;

    async function loadBuildings() {
      setLoadingBuildings(true);
      setBuildingError("");

      try {
        const rows = await getFarmBuildingsForFlockCard(farmId);
        if (!cancelled) setBuildings(rows);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setBuildings([]);
          setBuildingError("Unable to load buildings for this farm.");
        }
      } finally {
        if (!cancelled) setLoadingBuildings(false);
      }
    }

    void loadBuildings();

    return () => {
      cancelled = true;
    };
  }, [selectedFarm]);

  function openFlockForm(building: FarmBuildingListRow) {
    if (!selectedFarm) return;

    const encryptedBuildingId = encryptData({
      farmId: selectedFarm.id,
      farmCode: selectedFarm.code,
      farmName: selectedFarm.name,
      farmAddress: selectedFarm.address,
      farmType: selectedFarm.farm_type,
      farmContact: selectedFarm.contact_person,
      buildingKey: building.key,
      buildingCode: building.code,
      buildingName: building.name,
      cardId: building.flockCard?.id ?? null,
    });

    router.push(`/brd/fc/${encryptedBuildingId}/add-flock`);
  }

  function openFlockCardSheet(building: FarmBuildingListRow) {
    if (!selectedFarm) return;

    setValue("brdFcNewContext", {
      farmId: selectedFarm.id,
      farmCode: selectedFarm.code,
      farmName: selectedFarm.name,
      farmAddress: selectedFarm.address,
      farmType: selectedFarm.farm_type,
      farmContact: selectedFarm.contact_person,
      buildingKey: building.key,
      buildingId: building.id,
      buildingCode: building.code,
      buildingName: building.name,
      flockCardId: building.flockCard?.id ?? null,
      cardNo: building.flockCard?.cardNo ?? "",
      flockAge: building.flockCard?.age ?? null,
      flockStartDate: building.flockCard?.startDate ?? "",
      flockCode: building.flockCard?.flockCode || building.flockCard?.cardNo || "",
      animalQty: building.flockCard?.animalQty ?? null,
      breed: building.flockCard?.breed ?? "",
    });

    router.push("/brd/fc/new");
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-8 text-stone-950 dark:bg-background dark:text-foreground">
      <div className="flex items-center justify-between gap-3 px-4 mt-4">
        <Breadcrumb
          SecondPreviewPageName="Breeder"
          SecondPreviewPageLink="/brd"
          FirstPreviewsPageName="Flock Card"
          FirstPreviewsPageLink="/brd/fc"
          CurrentPageName="Flock Card"
        />
      </div>

      <section className="m-3 mt-6 overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
        <div className="border-b bg-muted/30 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-2">
              <label className="text-sm font-semibold">Farm</label>
              <SearchableCombobox
                items={farmOptions}
                value={effectiveSelectedFarmId}
                onValueChange={setSelectedFarmId}
                placeholder="Select farm..."
                showCode
                className="w-full min-w-[280px] lg:w-[420px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Building2 className="size-3.5" />
                  Buildings
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{loadingBuildings ? "..." : formatNumber(visibleBuildings.length)}</div>
              </div>
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Hash className="size-3.5" />
                  Occupied
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(occupiedCount)}</div>
              </div>
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <UsersRound className="size-3.5" />
                  Birds
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(totalBirdCount)}</div>
              </div>
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  First start
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{formatDateValue(nextStartDate)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex">
          {[
            ["Farm code", selectedFarm?.code || "-"],
            ["Company", "Vitarich"],
            ["Complex", selectedFarm?.farm_type || "-"],
            ["Contact", selectedFarm?.contact_person || "-"],
            ["Location", selectedFarm?.address || "-"],
          ].map(([label, value]) => (
            <div key={label} className="border-r px-5 py-3 last:border-r-0">
              <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
              <div className="mt-1 truncate font-medium">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="m-3 mt-5 overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
        <div className="flex items-center justify-between border-b bg-muted/20 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">Buildings</h2>
            <p className="text-xs text-muted-foreground">Active flock placements for the selected farm.</p>
          </div>
        </div>

        <div className="grid min-w-[1040px] grid-cols-[minmax(150px,1fr)_100px_140px_minmax(140px,1fr)_130px_150px_180px] border-b bg-muted/50 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
          <div>Building</div>
          <div>Age</div>
          <div>Start date</div>
          <div>Code</div>
          <div className="pr-5 text-right">Count</div>
          <div className="border-l pl-5">Status</div>
          <div className="text-right">Action</div>
        </div>

        {loadingBuildings ? (
          <div className="flex items-center justify-center gap-2 bg-white px-4 py-10 text-sm text-muted-foreground dark:bg-card">
            <Loader2 className="size-4 animate-spin" />
            Loading buildings...
          </div>
        ) : buildingError ? (
          <div className="bg-white p-4 dark:bg-card">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            {buildingError}
            </div>
          </div>
        ) : !selectedFarm ? (
          <div className="flex flex-col items-center justify-center gap-2 bg-white px-4 py-12 text-center text-sm text-muted-foreground dark:bg-card">
            <Search className="size-5" />
            Select a farm first.
          </div>
        ) : visibleBuildings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 bg-white px-4 py-12 text-center text-sm text-muted-foreground dark:bg-card">
            <Search className="size-5" />
            No buildings found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1040px] divide-y bg-white dark:bg-card">
              {visibleBuildings.map((building, index) => {
                const flockCard = building.flockCard;
                const hasFlockCard = Boolean(flockCard);

                return (
                <div
                  key={`${building.key || "building"}:${building.id ?? building.code}:${building.flockCard?.id ?? "empty"}:${index}`}
                  className="grid grid-cols-[minmax(150px,1fr)_100px_140px_minmax(140px,1fr)_130px_150px_180px] items-center px-4 py-3 text-sm transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold">{building.code || index + 1}</div>
                    <div className="truncate text-xs text-muted-foreground">{building.name || "-"}</div>
                  </div>
                  <div className="font-medium">{flockCard ? `${flockCard.age}d` : "-"}</div>
                  <div className="tabular-nums">{flockCard ? formatDateValue(flockCard.startDate) : "-"}</div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{flockCard?.flockCode || flockCard?.cardNo || "-"}</div>
                  </div>
                  <div className="pr-5 text-right font-medium tabular-nums">
                    {flockCard ? flockCard.animalQty.toLocaleString("en-PH") : "-"}
                  </div>
                  <div className="min-w-0 border-l pl-5">
                    <span className={`inline-flex max-w-full rounded border px-2 py-0.5 text-xs font-semibold ${getBuildingStatusClass(flockCard ? "occupied" : building.status)}`}>
                      <span className="truncate">{flockCard ? "Occupied" : building.status || "No status"}</span>
                    </span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openFlockCardSheet(building)}
                    >
                      <FileSpreadsheet className="size-4" />
                      Card
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openFlockForm(building)}
                    >
                      {hasFlockCard ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                      {hasFlockCard ? "Edit" : "Add Flock"}
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
            <div className="py-6 text-center text-sm font-medium">
              Showing {visibleBuildings.length} of {buildings.length}
            </div>
          </div>
        )}
      </section>

    </main>
  );
}
