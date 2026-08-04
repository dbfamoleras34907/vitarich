"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search } from "lucide-react";
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
  const female = row.f_endingbalance ?? row.f_beg - row.f_doa - row.f_reject - row.f_shortcount;
  const male = row.m_endingbalance ?? row.m_beg - row.m_doa - row.m_reject - row.m_shortcount;
  return Number(female) + Number(male);
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
    Promise.all([listPlacements(), listBreederFarms(), listFarmLocationLookup()])
      .then(([placementRows, farmRows, locationRows]) => {
        if (cancelled) return;
        setPlacements(placementRows);
        setFarms(farmRows);
        setLocations(locationRows);
      })
      .catch((loadError) => {
        console.error("Unable to load breeder placement buildings.", loadError);
        if (!cancelled) setError("Unable to load buildings for this farm.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    router.prefetch("/jmb/placement/new");
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    setValue("loading_g", loading);
  }, [loading, setValue]);

  const effectiveFarmId = selectedFarmId || (farms[0] ? String(farms[0].id) : "");
  const selectedFarm = farms.find((farm) => String(farm.id) === effectiveFarmId) ?? null;
  const farmOptions = useMemo(
    () => farms.map((farm) => ({
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

  function buildingPlacements(buildingId: number) {
    return placements.filter((placement) => placement.building_id === buildingId);
  }

  function openNewPlacement(building: FarmLocationLookup) {
    const query = new URLSearchParams({
      farmId: String(building.farm_id),
      buildingId: String(building.building_id),
    });
    router.push(`/jmb/placement/new?${query.toString()}`);
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-8 text-stone-950 dark:bg-background dark:text-foreground">
      <div className="px-4 mt-4">
        <Breadcrumb SecondPreviewPageName="Breeder" CurrentPageName="Placement List" />
      </div>

      <section className="m-3 mt-6 overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
        <div className="border-b bg-muted/30 px-5 py-4">
          <div className="max-w-[420px] space-y-2">
            <label className="text-sm font-semibold">Breeder Farm</label>
            <SearchableCombobox
              items={farmOptions}
              value={effectiveFarmId}
              onValueChange={setSelectedFarmId}
              placeholder="Select breeder farm..."
              showCode
              className="w-full"
            />
          </div>
        </div>
        <div className="flex">
          <div className="border-r px-5 py-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Farm code</div>
            <div className="mt-1 font-medium">{selectedFarm?.code || "-"}</div>
          </div>
          <div className="px-5 py-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Farm</div>
            <div className="mt-1 font-medium">{selectedFarm?.name || "-"}</div>
          </div>
        </div>
      </section>

      <section className="m-3 mt-5 overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
        <div className="border-b bg-muted/20 px-5 py-3">
          <h2 className="text-sm font-semibold">Buildings</h2>
          <p className="text-xs text-muted-foreground">Breeder placements for the selected farm.</p>
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
                  <TableHead>Building</TableHead>
                  <TableHead className="w-[130px]">Start Date</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="w-[130px] text-right">Count</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[190px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buildings.map((building) => {
                  const rows = buildingPlacements(building.building_id);
                  const latest = [...rows].sort((a, b) => b.placement_date.localeCompare(a.placement_date))[0];
                  const count = rows.reduce((sum, row) => sum + endingCount(row), 0);
                  return (
                    <TableRow key={building.building_id}>
                      <TableCell>
                        <div className="text-base font-semibold">{building.building_code || building.building_no}</div>
                        <div className="text-xs text-muted-foreground">{building.building_no}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatDate(latest?.placement_date)}</TableCell>
                      <TableCell className="font-medium">{latest?.dr_no || "-"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{rows.length ? count.toLocaleString("en-PH") : "-"}</TableCell>
                      <TableCell>
                        <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button type="button" size="sm" variant="outline" onClick={() => openNewPlacement(building)} className="border-emerald-700 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
                            <Plus className="size-4" /> New Placement
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="py-6 text-center text-sm font-medium">Showing {buildings.length} of {buildings.length}</div>
          </>
        )}
      </section>
    </main>
  );
}
