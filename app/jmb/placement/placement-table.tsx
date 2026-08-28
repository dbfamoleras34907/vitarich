"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  Egg,
  FileSpreadsheet,
  Hash,
  Loader2,
  Pencil,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  listBreederCycles,
  listBuildingHistory,
  listFarmLocationLookup,
  listPlacements,
  getUserInfo,
  type BreederFarm,
  type BreederCycle,
  type BuildingHistoryRow,
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
  const [breederCycles, setBreederCycles] = useState<BreederCycle[]>([]);
  const [buildingHistory, setBuildingHistory] = useState<BuildingHistoryRow[]>(
    [],
  );
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
      listBreederCycles(),
      listBreederFarms(),
      listFarmLocationLookup(),
      getUserInfo().catch(() => []),
    ])
      .then(
        async ([
          placementRows,
          cycleRows,
          farmRows,
          locationRows,
          defaultFarmRows,
        ]) => {
          const historyRows = await listBuildingHistory(placementRows);
          if (cancelled) return;
          setPlacements(placementRows);
          setBreederCycles(cycleRows);
          setBuildingHistory(historyRows);
          setFarms(farmRows);
          setLocations(locationRows);
          const defaultFarmId = defaultFarmRows[0]?.id;
          const defaultBreederFarm = farmRows.find(
            (farm) => Number(farm.id) === Number(defaultFarmId),
          );
          if (defaultBreederFarm) {
            setSelectedFarmId(String(defaultBreederFarm.id));
          }
        },
      )
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
  const selectedFarmHistory = useMemo(
    () =>
      buildingHistory.filter(
        (record) => String(record.farm_id) === effectiveFarmId,
      ),
    [buildingHistory, effectiveFarmId],
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

  function openPlacement(
    building: FarmLocationLookup,
    placement?: Placement,
    cycleNo?: number,
  ) {
    if (placement) {
      router.push(`/jmb/placement/new?id=${placement.id}`);
      return;
    }

    const query = new URLSearchParams({
      farmId: String(building.farm_id),
      buildingId: String(building.building_id),
    });
    if (cycleNo) query.set("cycleNo", String(cycleNo));
    router.push(`/jmb/placement/new?${query.toString()}`);
  }

  function openCard(placement: Placement) {
    router.push(`/jmb/placement/card?placementId=${placement.id}`);
  }

  function openHistory(record: BuildingHistoryRow, mode: "growing" | "laying") {
    const query = new URLSearchParams({
      mode,
      farmId: String(record.farm_id),
      buildingId: String(record.building_id),
      placementDate: record.placement_date,
    });
    if (record.cycle_no != null) query.set("cycleNo", String(record.cycle_no));
    router.push(`/jmb/placement/history?${query.toString()}`);
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
                className="w-full min-w-70 lg:w-105"
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
        <div className="flex flex-wrap">
          <div className="border-r px-5 py-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Farm code
            </div>
            <div className="mt-1 font-medium">{selectedFarm?.code || "-"}</div>
          </div>
          <div className="border-r px-5 py-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Farm
            </div>
            <div className="mt-1 font-medium">{selectedFarm?.name || "-"}</div>
          </div>
          <div className="min-w-65flex-1 border-r px-5 py-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Farm Address
            </div>
            <div className="mt-1 font-medium">
              {selectedFarm?.address || "-"}
            </div>
          </div>
          <div className="min-w-45 px-5 py-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Assigned TA
            </div>
            <div className="mt-1 font-medium">
              {selectedFarm?.assigned_ta || "-"}
            </div>
          </div>
        </div>
      </section>

      <section className="m-3 mt-5 overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
        <div className="border-b bg-muted/20 px-5 py-3">
          <h2 className="text-sm font-semibold">Buildings Active Cycle</h2>
          <p className="text-xs text-muted-foreground">
            Active breeder cycles from the cycle register for the selected farm.
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
            <Table className="min-w-225">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Building Name</TableHead>
                  <TableHead className="w-32.5">Start Date</TableHead>
                  <TableHead className="w-32.5">Cycle #</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="w-35 text-right">Total Birds</TableHead>
                  <TableHead className="w-32.5">Status</TableHead>
                  <TableHead className="w-64 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buildings.map((building) => {
                  const allBuildingCycles = breederCycles.filter(
                    (cycle) => cycle.building_id === building.building_id,
                  );
                  const buildingCycles = allBuildingCycles.filter(
                    (cycle) => cycle.status.toLowerCase() === "active",
                  );
                  const cycleNo = buildingCycles.length
                    ? Math.max(
                        ...buildingCycles.map((cycle) =>
                          Number(cycle.cycle_no),
                        ),
                      )
                    : null;
                  const nextCycleNo = allBuildingCycles.length
                    ? Math.max(
                        ...allBuildingCycles.map((cycle) =>
                          Number(cycle.cycle_no),
                        ),
                      ) + 1
                    : 1;
                  const currentCycles = buildingCycles.filter(
                    (cycle) => Number(cycle.cycle_no) === cycleNo,
                  );
                  const currentCycleIds = new Set(
                    currentCycles.map((cycle) => Number(cycle.id)),
                  );
                  const rows = placements.filter(
                    (placement) =>
                      placement.building_id === building.building_id &&
                      !!placement.cycle_id &&
                      currentCycleIds.has(Number(placement.cycle_id)),
                  );
                  const latest = [...rows].sort(
                    (a, b) =>
                      b.placement_date.localeCompare(a.placement_date) ||
                      b.id - a.id,
                  )[0];
                  const totalBirds = rows.reduce(
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
                      <TableCell className="font-medium tabular-nums">
                        {cycleNo ?? "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {latest?.remarks || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {rows.length ? totalBirds.toLocaleString("en-PH") : "-"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          {currentCycles[0]?.status ?? "No Active Cycle"}
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
                            onClick={() =>
                              openPlacement(
                                building,
                                latest,
                                cycleNo ?? nextCycleNo,
                              )
                            }
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

      <section className="m-3 mt-5 overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
        <div className="border-b bg-muted/20 px-5 py-3">
          <h2 className="text-sm font-semibold">Buildings History</h2>
          <p className="text-xs text-muted-foreground">
            Placement, production, loss, and clean-up totals by building cycle.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading building
            history...
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-amber-700">{error}</div>
        ) : !selectedFarm ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
            <Search className="size-5" /> Select a breeder farm first.
          </div>
        ) : selectedFarmHistory.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
            <Search className="size-5" /> No building history found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="min-w-532.5">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Building Name</TableHead>
                    <TableHead className="w-32.5">Placement Date</TableHead>
                    <TableHead className="w-22.5">Cycle #</TableHead>
                    <TableHead className="w-35 text-right">
                      Total Placement
                    </TableHead>
                    <TableHead className="w-25 text-right">DOA</TableHead>
                    <TableHead className="w-27.5 text-right">Rejects</TableHead>
                    <TableHead className="w-32.5 text-right">
                      Short Count
                    </TableHead>
                    <TableHead className="w-32.5 text-right">
                      Total Birds
                    </TableHead>
                    <TableHead className="w-42.5 text-right">
                      Total Egg Production
                    </TableHead>
                    <TableHead className="w-35 text-right">
                      Total Mortality
                    </TableHead>
                    <TableHead className="w-27.5 text-right">Culls</TableHead>
                    <TableHead className="w-27.5 text-right">Kitchen</TableHead>
                    <TableHead className="w-27.5 text-right">Condem</TableHead>
                    <TableHead className="w-35 text-right">
                      Total Clean Up
                    </TableHead>
                    <TableHead className="w-37.5 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedFarmHistory.map((record) => (
                    <TableRow key={record.key}>
                      <TableCell className="font-semibold">
                        {record.building_name || "-"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(record.placement_date)}
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {record.cycle_no ?? "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(record.total_placement)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(record.doa)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(record.rejects)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(record.short_count)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(record.total_birds)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(record.total_egg_production)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(record.total_mortality)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(record.culls)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(record.kitchen)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(record.condem)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatNumber(record.total_cleanup)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="sm" variant="outline">
                              View <ChevronDown className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => openHistory(record, "growing")}
                            >
                              <FileSpreadsheet className="size-4" /> View
                              Growing
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => openHistory(record, "laying")}
                            >
                              <Egg className="size-4" /> View Laying
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="py-6 text-center text-sm font-medium">
              Showing {selectedFarmHistory.length} history record
              {selectedFarmHistory.length === 1 ? "" : "s"}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
