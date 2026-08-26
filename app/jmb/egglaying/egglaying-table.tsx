"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, Egg, Hash, Loader2, Search, UsersRound } from "lucide-react";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Breadcrumb from "@/lib/Breadcrumb";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  getUserInfo,
  listBreederFarms,
  listFarmLocationLookup,
  type BreederFarm,
  type FarmLocationLookup,
} from "@/app/jmb/placement/new/api";
import { listLayingPlacements, type LayingPlacement } from "./new/api";

type LayingPlacementGroup = {
  id: number;
  placement_date: string;
  dr_no: string;
  farm_id: number | null;
  farm_name: string;
  building_id: number | null;
  building_no: string;
  net_placement: number;
  age_days: number;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatNumber(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return Number(value).toLocaleString("en-PH");
}

function getAgeInDays(placementDate?: string | null, endDate = new Date()) {
  if (!placementDate) return 0;
  const start = new Date(`${placementDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.max(0, Math.floor((endUtc - startUtc) / 86_400_000));
}

function formatAge(days: number) {
  const safeDays = Number(days);
  if (!Number.isFinite(safeDays)) return "0/0";
  const wholeDays = Math.max(0, Math.floor(safeDays));
  return `${Math.floor(wholeDays / 7)}/${wholeDays % 7}`;
}

function getPlacementNet(row: LayingPlacement) {
  return Number(row.f_endingbalance ?? 0) + Number(row.m_endingbalance ?? 0);
}

function groupPlacementsByFarmBuilding(rows: LayingPlacement[]) {
  const groups = new Map<string, LayingPlacementGroup>();
  for (const row of rows) {
    const key = [row.farm_id ?? row.farm_name, row.building_id ?? row.building_no].join("|");
    const existing = groups.get(key);
    const rowAgeDays = getAgeInDays(row.placement_date);
    if (!existing) {
      groups.set(key, {
        id: row.id,
        placement_date: row.placement_date,
        dr_no: row.dr_no,
        farm_id: row.farm_id ?? null,
        farm_name: row.farm_name,
        building_id: row.building_id ?? null,
        building_no: row.building_no,
        net_placement: getPlacementNet(row),
        age_days: rowAgeDays,
      });
      continue;
    }
    const existingDate = new Date(`${existing.placement_date}T00:00:00`);
    const rowDate = new Date(`${row.placement_date}T00:00:00`);
    const useOlderPlacement = !Number.isNaN(rowDate.getTime()) &&
      (Number.isNaN(existingDate.getTime()) || rowDate < existingDate);
    groups.set(key, {
      ...existing,
      id: useOlderPlacement ? row.id : existing.id,
      placement_date: useOlderPlacement ? row.placement_date : existing.placement_date,
      dr_no: useOlderPlacement ? row.dr_no : existing.dr_no,
      net_placement: existing.net_placement + getPlacementNet(row),
      age_days: Math.max(existing.age_days, rowAgeDays),
    });
  }
  return Array.from(groups.values()).sort((left, right) =>
    left.building_no.localeCompare(right.building_no, undefined, { numeric: true }),
  );
}

export default function EggLayingTable() {
  const router = useRouter();
  const { setValue } = useGlobalContext();
  const [items, setItems] = useState<LayingPlacement[]>([]);
  const [farms, setFarms] = useState<BreederFarm[]>([]);
  const [locations, setLocations] = useState<FarmLocationLookup[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { refreshSessionx(router); }, [router]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listLayingPlacements(),
      listBreederFarms(),
      listFarmLocationLookup(),
      getUserInfo().catch(() => []),
    ])
      .then(([placementRows, farmRows, locationRows, defaultFarmRows]) => {
        if (cancelled) return;
        setItems(placementRows);
        setFarms(farmRows);
        setLocations(locationRows);
        const defaultFarmId = defaultFarmRows[0]?.id;
        const defaultBreederFarm = farmRows.find((farm) => Number(farm.id) === Number(defaultFarmId));
        if (defaultBreederFarm) setSelectedFarmId(String(defaultBreederFarm.id));
      })
      .catch((loadError) => {
        console.error("Unable to load egg laying buildings.", loadError);
        if (!cancelled) setError("Unable to load egg laying buildings.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    router.prefetch("/jmb/egglaying/new");
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => { setValue("loading_g", loading); }, [loading, setValue]);

  const effectiveFarmId = selectedFarmId || (farms[0] ? String(farms[0].id) : "");
  const selectedFarm = farms.find((farm) => String(farm.id) === effectiveFarmId) ?? null;
  const farmOptions = useMemo(() => farms.map((farm) => ({
    code: String(farm.id),
    name: farm.code ? `${farm.code} - ${farm.name}` : farm.name,
  })), [farms]);
  const groupedItems = useMemo(() => groupPlacementsByFarmBuilding(items).filter(
    (item) => String(item.farm_id) === effectiveFarmId,
  ), [effectiveFarmId, items]);
  const farmBuildingCount = useMemo(() => new Set(locations
    .filter((location) => String(location.farm_id) === effectiveFarmId)
    .map((location) => location.building_id)).size, [effectiveFarmId, locations]);
  const totalBirdCount = useMemo(() => groupedItems.reduce(
    (sum, item) => sum + item.net_placement, 0,
  ), [groupedItems]);
  const firstStartDate = useMemo(() => groupedItems.map(
    (item) => item.placement_date,
  ).filter(Boolean).sort()[0] ?? "", [groupedItems]);

  function openEggCollection(item: LayingPlacementGroup) {
    router.push(`/jmb/egglaying/new?placementId=${item.id}&netPlacement=${item.net_placement}`);
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-8 text-stone-950 dark:bg-background dark:text-foreground">
      <div className="px-4 mt-4">
        <Breadcrumb SecondPreviewPageName="Breeder" CurrentPageName="Egg Laying List" />
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
              <SummaryCard icon={<Building2 className="size-3.5" />} label="Buildings" value={loading ? "..." : formatNumber(farmBuildingCount)} />
              <SummaryCard icon={<Hash className="size-3.5" />} label="Occupied" value={loading ? "..." : formatNumber(groupedItems.length)} />
              <SummaryCard icon={<UsersRound className="size-3.5" />} label="Birds" value={loading ? "..." : formatNumber(totalBirdCount)} />
              <SummaryCard icon={<CalendarDays className="size-3.5" />} label="First start" value={loading ? "..." : formatDate(firstStartDate)} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap">
          <FarmDetail label="Farm code" value={selectedFarm?.code} className="border-r" />
          <FarmDetail label="Farm" value={selectedFarm?.name} className="border-r" />
          <FarmDetail label="Farm Address" value={selectedFarm?.address} className="min-w-[260px] flex-1 border-r" />
          <FarmDetail label="Assigned TA" value={selectedFarm?.assigned_ta} className="min-w-[180px]" />
        </div>
      </section>

      <section className="m-3 mt-5 overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
        <div className="border-b bg-muted/20 px-5 py-3">
          <h2 className="text-sm font-semibold">Buildings Laying Production</h2>
          <p className="text-xs text-muted-foreground">
            Breeder placement buildings available for egg collection at the selected farm.
          </p>
        </div>
        {loading ? (
          <EmptyState><Loader2 className="size-4 animate-spin" /> Loading buildings...</EmptyState>
        ) : error ? (
          <div className="p-4 text-sm text-amber-700">{error}</div>
        ) : !selectedFarm ? (
          <EmptyState><Search className="size-5" /> Select a breeder farm first.</EmptyState>
        ) : groupedItems.length === 0 ? (
          <EmptyState><Search className="size-5" /> No placement buildings found.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="min-w-[1250px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[70px]">#</TableHead>
                    <TableHead className="w-[150px]">Placement Date</TableHead>
                    <TableHead className="w-[150px]">DR No.</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead className="w-[100px]">Age</TableHead>
                    <TableHead className="w-[130px]">Status</TableHead>
                    <TableHead className="w-[170px] text-right">Net of Placement</TableHead>
                    <TableHead className="w-[190px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedItems.map((item, index) => {
                    const isLaying = item.age_days >= 26 * 7;
                    return (
                      <TableRow key={`${item.farm_id}-${item.building_id ?? item.building_no}`}>
                        <TableCell className="tabular-nums">{formatNumber(index + 1)}</TableCell>
                        <TableCell className="tabular-nums">{formatDate(item.placement_date)}</TableCell>
                        <TableCell className="font-medium">{item.dr_no || "-"}</TableCell>
                        <TableCell><div className="text-base font-semibold">{item.building_no || "-"}</div></TableCell>
                        <TableCell className="font-medium tabular-nums">{formatAge(item.age_days)}</TableCell>
                        <TableCell>
                          <span className={isLaying
                            ? "inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                            : "inline-flex rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700"}>
                            {isLaying ? "Laying" : "Growing"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatNumber(item.net_placement)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button type="button" size="sm" variant="outline" onClick={() => openEggCollection(item)} className="border-emerald-700 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
                              <Egg className="size-4" /> Egg Collection
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="py-6 text-center text-sm font-medium">
              Showing {groupedItems.length} of {groupedItems.length}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function FarmDetail({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={`px-5 py-3 ${className}`}>
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value || "-"}</div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">{children}</div>;
}
