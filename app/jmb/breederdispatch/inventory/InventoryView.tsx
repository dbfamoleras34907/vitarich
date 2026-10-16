"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Building2, CalendarDays, Database, Loader2, RefreshCw } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { listBreederFarms, type BreederFarm } from "@/app/jmb/placement/new/api";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/ui/table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { compareNaturalText } from "@/lib/utils/naturalSort";
import { formatFarmNameCode } from "@/lib/utils/farmDisplay";
import {
  dispatchCategoryOrder,
  getDefaultFarm,
  listAvailableDispatchItems,
  listBreederDispatchBuildings,
  type AvailableDispatchItem,
  type BreederDispatchBuilding,
  type DispatchSourceType,
} from "../new/api";

type InventoryGroup = {
  key: string;
  buildingName: string;
  sourceType: DispatchSourceType;
  category: string;
  categoryLabel: string;
  firstSourceDate: string;
  lastSourceDate: string;
  sourceRecords: number;
  totalInventory: number;
  totalDispatch: number;
  remainingQuantity: number;
};

const today = () => new Date().toLocaleDateString("en-CA");
const ALL_BUILDINGS_VALUE = "__all_buildings__";
const monthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-CA");
};

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH");
}

export default function InventoryView() {
  const router = useRouter();
  const { setValue } = useGlobalContext();
  const [farms, setFarms] = useState<BreederFarm[]>([]);
  const [buildings, setBuildings] = useState<BreederDispatchBuilding[]>([]);
  const [farmId, setFarmId] = useState("");
  const [buildingId, setBuildingId] = useState(ALL_BUILDINGS_VALUE);
  const [dataFrom, setDataFrom] = useState(monthStart);
  const [dataTo, setDataTo] = useState(today);
  const [items, setItems] = useState<AvailableDispatchItem[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { void refreshSessionx(router); }, [router]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([listBreederFarms(), getDefaultFarm(), listBreederDispatchBuildings()])
      .then(([availableFarms, defaultFarm, availableBuildings]) => {
        if (cancelled) return;
        setFarms(availableFarms);
        setBuildings(availableBuildings);
        const selectedFarm = availableFarms.find((farm) => farm.id === defaultFarm?.id) ?? availableFarms[0];
        setFarmId(selectedFarm ? String(selectedFarm.id) : "");
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) setError("Unable to load your assigned Breeder farms.");
      })
      .finally(() => { if (!cancelled) setLoadingSetup(false); });
    return () => { cancelled = true; };
  }, []);

  const loadInventory = useCallback(async () => {
    if (!farmId || !dataTo) return;
    setLoadingInventory(true);
    setError("");
    try {
      setItems(await listAvailableDispatchItems(dataTo, Number(farmId), true));
    } catch (loadError) {
      console.error(loadError);
      setError("Unable to load remaining dispatch inventory.");
    } finally {
      setLoadingInventory(false);
    }
  }, [dataTo, farmId]);

  useEffect(() => { void loadInventory(); }, [loadInventory]);
  useEffect(() => setValue("loading_g", loadingSetup || loadingInventory), [loadingInventory, loadingSetup, setValue]);

  const farmBuildings = useMemo(
    () => buildings.filter((building) => String(building.farm_id) === farmId),
    [buildings, farmId],
  );
  const filteredItems = useMemo(() => items.filter((item) => {
    const sourceDate = item.source_date.slice(0, 10);
    return (buildingId === ALL_BUILDINGS_VALUE || String(item.building_id) === buildingId)
      && (!dataFrom || sourceDate >= dataFrom)
      && (!dataTo || sourceDate <= dataTo);
  }), [buildingId, dataFrom, dataTo, items]);
  const groups = useMemo(() => {
    const byKey = new Map<string, InventoryGroup>();
    filteredItems.forEach((item) => {
      const key = `${item.building_id ?? item.building_name}:${item.source_type}:${item.category}`;
      const current = byKey.get(key) ?? {
        key,
        buildingName: item.building_name || "-",
        sourceType: item.source_type,
        category: item.category,
        categoryLabel: item.category_label,
        firstSourceDate: item.source_date,
        lastSourceDate: item.source_date,
        sourceRecords: 0,
        totalInventory: 0,
        totalDispatch: 0,
        remainingQuantity: 0,
      };
      current.firstSourceDate = current.firstSourceDate < item.source_date ? current.firstSourceDate : item.source_date;
      current.lastSourceDate = current.lastSourceDate > item.source_date ? current.lastSourceDate : item.source_date;
      current.sourceRecords += 1;
      current.totalInventory += Number(item.source_quantity);
      current.totalDispatch += Number(item.dispatch_quantity);
      current.remainingQuantity += Number(item.source_available);
      byKey.set(key, current);
    });
    return [...byKey.values()]
      .sort((left, right) =>
      compareNaturalText(left.buildingName, right.buildingName)
      || left.sourceType.localeCompare(right.sourceType)
      || dispatchCategoryOrder(left.sourceType, left.category) - dispatchCategoryOrder(right.sourceType, right.category),
      );
  }, [filteredItems]);
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(groups.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedGroups = useMemo(() => groups.slice((currentPage - 1) * pageSize, currentPage * pageSize), [currentPage, groups]);
  const remainingTotal = groups.reduce((sum, group) => sum + group.remainingQuantity, 0);
  const buildingCount = new Set(groups.map((group) => group.buildingName)).size;
  const sourceRecordCount = groups.reduce((sum, group) => sum + group.sourceRecords, 0);
  const eggLayingTotal = filteredItems
    .filter((item) => item.source_type === "Egg Laying")
    .reduce((sum, item) => sum + item.source_quantity, 0);
  const populationTotal = filteredItems
    .filter((item) => item.source_type === "Population Record")
    .reduce((sum, item) => sum + item.source_quantity, 0);
  const totalInventory = eggLayingTotal + populationTotal;
  const totalDispatch = filteredItems.reduce((sum, item) => sum + item.dispatch_quantity, 0);
  const isLoading = loadingSetup || loadingInventory;

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-10">
      <div className="mt-4 px-4"><Breadcrumb SecondPreviewPageName="Breeder" CurrentPageName="Dispatch Inventory Record" /></div>
      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/30 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Boxes className="size-5" /></div>
              <div><h1 className="text-xl font-semibold">Dispatch Inventory Record</h1><p className="text-sm text-muted-foreground">Population Record and Egg Laying inventory, including zero balances, grouped by building, data source, and category.</p></div>
            </div>
            <Button variant="outline" onClick={() => router.push("/jmb/breederdispatch")}>Back to dispatches</Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Stat icon={<Boxes className="size-3.5" />} label="Remaining quantity" value={remainingTotal} />
            <Stat icon={<Building2 className="size-3.5" />} label="Buildings in records" value={buildingCount} />
            <Stat icon={<Database className="size-3.5" />} label="Source records" value={sourceRecordCount} />
            <Stat icon={<Database className="size-3.5" />} label="Total Egg Laying" value={eggLayingTotal} />
            <Stat icon={<Boxes className="size-3.5" />} label="Total Population" value={populationTotal} />
            <Stat icon={<Boxes className="size-3.5" />} label="Total inventory" value={totalInventory} />
            <Stat icon={<Boxes className="size-3.5" />} label="Total dispatch" value={totalDispatch} />
          </div>
        </div>
        <div className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-5 xl:items-end">
          <SearchableCombobox label="Farm" items={farms.map((farm) => ({ code: String(farm.id), name: formatFarmNameCode(farm.name, farm.code) }))} value={farmId} onValueChange={(value) => { setFarmId(value); setBuildingId(ALL_BUILDINGS_VALUE); setPage(1); }} placeholder="Select farm" showCode codePosition="suffix" className="w-full" />
          <SearchableCombobox label="Building" items={[{ code: ALL_BUILDINGS_VALUE, name: "All buildings" }, ...farmBuildings.map((building) => ({ code: String(building.building_id), name: building.building_name }))]} value={buildingId} onValueChange={(value) => { setBuildingId(value); setPage(1); }} placeholder="All buildings" className="w-full" disabled={!farmId} />
          <label className="space-y-2 text-sm font-medium"><span>Data date from</span><Input type="date" max={dataTo || undefined} value={dataFrom} onChange={(event) => { setDataFrom(event.target.value); setPage(1); }} /></label>
          <label className="space-y-2 text-sm font-medium"><span>Data date to</span><Input type="date" min={dataFrom || undefined} max={today()} value={dataTo} onChange={(event) => { setDataTo(event.target.value); setPage(1); }} /></label>
          <Button variant="outline" onClick={() => void loadInventory()} disabled={isLoading || !farmId || !dataTo}><RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
        <div className="border-b bg-muted/20 px-4 py-2 text-xs text-muted-foreground"><CalendarDays className="mr-1 inline size-3.5" />Source dates are filtered by the selected range. Remaining quantities exclude every posted dispatch; drafts do not reduce them and cancelled dispatches release them.</div>
        {error ? <div className="m-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]"><TableHeader><TableRow><TableHead className="w-14 text-center">#</TableHead><TableHead>Building</TableHead><TableHead>Data source</TableHead><TableHead>Category</TableHead><TableHead>Source date range</TableHead><TableHead className="text-right">Source records</TableHead><TableHead className="text-right">Total Inventory</TableHead><TableHead className="text-right">Total Dispatch</TableHead><TableHead className="text-right">Remaining inventory</TableHead></TableRow></TableHeader><TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="h-32 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : null}
            {!isLoading && paginatedGroups.map((group, index) => <TableRow key={group.key}><TableCell className="text-center font-medium tabular-nums text-muted-foreground">{(currentPage - 1) * pageSize + index + 1}</TableCell><TableCell className="font-medium">{group.buildingName}</TableCell><TableCell>{group.sourceType}</TableCell><TableCell>{group.categoryLabel}</TableCell><TableCell className="whitespace-nowrap">{group.firstSourceDate === group.lastSourceDate ? formatDate(group.firstSourceDate) : `${formatDate(group.firstSourceDate)} - ${formatDate(group.lastSourceDate)}`}</TableCell><TableCell className="text-right tabular-nums">{group.sourceRecords.toLocaleString()}</TableCell><TableCell className="text-right tabular-nums">{group.totalInventory.toLocaleString()}</TableCell><TableCell className="text-right tabular-nums">{group.totalDispatch.toLocaleString()}</TableCell><TableCell className="text-right font-semibold tabular-nums">{group.remainingQuantity.toLocaleString()}</TableCell></TableRow>)}
            {!isLoading && !groups.length ? <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">No inventory records for the selected farm and data date range.</TableCell></TableRow> : null}
          </TableBody></Table>
        </div>
        <TablePagination page={currentPage} pageSize={pageSize} totalItems={groups.length} itemLabel="inventory groups" onPageChange={setPage} />
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-lg border bg-background p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{value.toLocaleString()}</div></div>;
}
