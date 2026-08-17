"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  FileSpreadsheet,
  Hash,
  Loader2,
  Pencil,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Breadcrumb from "@/lib/Breadcrumb";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  listBreederFarms,
  listFarmLocationLookup,
  listPlacements,
  getUserInfo,
  type BreederFarm,
  type FarmLocationLookup,
  type Placement,
} from "./new/api";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function endingCount(row: Placement) {
  const female =
    row.f_endingbalance ??
    row.f_beg - row.f_doa - row.f_reject - row.f_shortcount;
  const male =
    row.m_endingbalance ??
    row.m_beg - row.m_doa - row.m_reject - row.m_shortcount;
  return Number(female) + Number(male);
}

function formatNumber(value: number) {
  return value.toLocaleString("en-PH");
}

export default function PlacementTable() {
  const router = useRouter();
  const { setValue } = useGlobalContext();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [farms, setFarms] = useState<BreederFarm[]>([]);
  const [locations, setLocations] = useState<FarmLocationLookup[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listPlacements(),
      listBreederFarms(),
      listFarmLocationLookup(),
      getUserInfo().catch(() => []),
    ])
      .then(([placementRows, farmRows, locationRows, defaultFarmRows]) => {
        if (cancelled) return;
        setPlacements(placementRows);
        setFarms(farmRows);
        setLocations(locationRows);
        const defaultFarmId = defaultFarmRows[0]?.id;
        const defaultBreederFarm = farmRows.find(
          (farm) => Number(farm.id) === Number(defaultFarmId),
        );
        if (defaultBreederFarm) {
          setSelectedFarmId(String(defaultBreederFarm.id));
        }
      })
      .catch((loadError) => {
        console.error("Unable to load breeder placement buildings.", loadError);
        if (!cancelled) setError("Unable to load buildings for this farm.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    router.prefetch("/jmb/placement/new");
    router.prefetch("/jmb/placement/card");
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    setValue("loading_g", loading);
  }, [loading, setValue]);

  const effectiveFarmId =
    selectedFarmId || (farms[0] ? String(farms[0].id) : "");
  const selectedFarm =
    farms.find((farm) => String(farm.id) === effectiveFarmId) ?? null;
  const farmOptions = useMemo(
    () =>
      farms.map((farm) => ({
        code: String(farm.id),
        name: farm.code ? `${farm.code} - ${farm.name}` : farm.name,
      })),
    [farms],
  );
  const buildings = useMemo(() => {
    const unique = new Map<number, FarmLocationLookup>();
    locations
      .filter((location) => String(location.farm_id) === effectiveFarmId)
      .forEach((location) => unique.set(location.building_id, location));
    return [...unique.values()].sort((left, right) =>
      (left.building_code || left.building_no).localeCompare(
        right.building_code || right.building_no,
        undefined,
        { numeric: true },
      ),
    );
  }, [effectiveFarmId, locations]);
  const selectedFarmPlacements = useMemo(
    () =>
      placements.filter(
        (placement) => String(placement.farm_id) === effectiveFarmId,
      ),
    [effectiveFarmId, placements],
  );
  const occupiedCount = useMemo(
    () =>
      new Set(selectedFarmPlacements.map((placement) => placement.building_id))
        .size,
    [selectedFarmPlacements],
  );
  const totalBirdCount = useMemo(
    () =>
      selectedFarmPlacements.reduce(
        (sum, placement) => sum + endingCount(placement),
        0,
      ),
    [selectedFarmPlacements],
  );
  const firstStartDate = useMemo(
    () =>
      selectedFarmPlacements
        .map((placement) => placement.placement_date)
        .filter(Boolean)
        .sort()[0] ?? "",
    [selectedFarmPlacements],
  );

  function buildingPlacements(buildingId: number) {
    return placements.filter(
      (placement) => placement.building_id === buildingId,
    );
  }

  function openPlacement(
    building: FarmLocationLookup,
    placement?: Placement,
  ) {
    if (placement) {
      router.push(`/jmb/placement/new?id=${placement.id}`);
      return;
    }

    const query = new URLSearchParams({
      farmId: String(building.farm_id),
      buildingId: String(building.building_id),
    });
    router.push(`/jmb/placement/new?${query.toString()}`);
  }

  function openCard(placement: Placement) {
    router.push(`/jmb/placement/card?placementId=${placement.id}`);
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-8 text-stone-950 dark:bg-background dark:text-foreground">
      <div className="px-4 mt-4">
        <Breadcrumb
          SecondPreviewPageName="Breeder"
          CurrentPageName="Placement List"
        />
      </div>

      <section className="m-3 mt-6 overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
        <div className="border-b bg-muted/30 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-2">
              <label className="text-sm font-semibold">Breeder Farm</label>
              <SearchableCombobox
                items={farmOptions}
                value={effectiveFarmId}
                onValueChange={setSelectedFarmId}
                placeholder="Select breeder farm..."
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
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {loading ? "..." : formatNumber(buildings.length)}
                </div>
              </div>
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Hash className="size-3.5" />
                  Occupied
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {loading ? "..." : formatNumber(occupiedCount)}
                </div>
              </div>
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <UsersRound className="size-3.5" />
                  Birds
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {loading ? "..." : formatNumber(totalBirdCount)}
                </div>
              </div>
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  First start
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {loading ? "..." : formatDate(firstStartDate)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex">
          <div className="border-r px-5 py-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Farm code
            </div>
            <div className="mt-1 font-medium">{selectedFarm?.code || "-"}</div>
          </div>
          <div className="px-5 py-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Farm
            </div>
            <div className="mt-1 font-medium">{selectedFarm?.name || "-"}</div>
          </div>
        </div>
      </section>

      <section className="m-3 mt-5 overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
        <div className="border-b bg-muted/20 px-5 py-3">
          <h2 className="text-sm font-semibold">Buildings</h2>
          <p className="text-xs text-muted-foreground">
            Breeder placements for the selected farm.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading buildings...
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-amber-700">{error}</div>
        ) : !selectedFarm ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
            <Search className="size-5" /> Select a breeder farm first.
          </div>
        ) : buildings.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
            <Search className="size-5" /> No buildings found.
          </div>
        ) : (
          <>
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Building Name</TableHead>
                  <TableHead className="w-[130px]">Start Date</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="w-[130px] text-right">Count</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[260px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buildings.map((building) => {
                  const rows = buildingPlacements(building.building_id);
                  const latest = [...rows].sort(
                    (a, b) =>
                      b.placement_date.localeCompare(a.placement_date) ||
                      b.id - a.id,
                  )[0];
                  const count = rows.reduce(
                    (sum, row) => sum + endingCount(row),
                    0,
                  );
                  return (
                    <TableRow key={building.building_id}>
                      <TableCell>
                        <div className="text-base font-semibold">
                          {building.building_name || building.building_no}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(latest?.placement_date)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {latest?.dr_no || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {rows.length ? count.toLocaleString("en-PH") : "-"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {latest ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openCard(latest)}
                            >
                              <FileSpreadsheet className="size-4" /> Growing
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openPlacement(building, latest)}
                            className="border-emerald-700 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            {latest ? (
                              <Pencil className="size-4" />
                            ) : (
                              <Plus className="size-4" />
                            )}
                            {latest ? "Edit/View" : "New Placement"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="py-6 text-center text-sm font-medium">
              Showing {buildings.length} of {buildings.length}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
