"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bird, ListPlus, Loader2, Save, Send, Trash2, X } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  createBreederDispatch,
  getDefaultFarm,
  listAvailableDispatchItems,
  listHatcheryFarms,
  type AvailableDispatchItem,
  type BreederDispatchInput,
  type DispatchSourceType,
  type HatcheryFarmLookup,
} from "../new/api";

type DispatchRow = {
  id: number;
  destination: string;
  hauler_name: string;
  plate_number: string;
  truck_seal: string;
  source_type: "" | DispatchSourceType;
  category: string;
  production_date: string;
  dispatch_qty: string;
  remarks: string;
};

const today = () => new Date().toLocaleDateString("en-CA");
let nextRowId = 1;

function emptyRow(): DispatchRow {
  return {
    id: nextRowId++,
    destination: "",
    hauler_name: "",
    plate_number: "",
    truck_seal: "",
    source_type: "",
    category: "",
    production_date: "",
    dispatch_qty: "",
    remarks: "",
  };
}

const quantity = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sourceCategoryKey = (row: Pick<DispatchRow, "source_type" | "category" | "production_date">) =>
  `${row.source_type}:${row.category}:${row.production_date}`;

export default function MultipleBreederDispatchForm() {
  const router = useRouter();
  const { setValue } = useGlobalContext();
  const [dispatchDate, setDispatchDate] = useState(today);
  const [farmId, setFarmId] = useState("");
  const [items, setItems] = useState<AvailableDispatchItem[]>([]);
  const [hatcheryFarms, setHatcheryFarms] = useState<HatcheryFarmLookup[]>([]);
  const [rows, setRows] = useState<DispatchRow[]>(() => [emptyRow()]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void refreshSessionx(router); }, [router]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getDefaultFarm(), listHatcheryFarms()])
      .then(([farm, destinations]) => {
        if (cancelled) return;
        setHatcheryFarms(destinations);
        if (farm?.id) setFarmId(String(farm.id));
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) setError("Unable to load breeder dispatch setup.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (loading || !dispatchDate) return;
    let cancelled = false;
    setLoadingItems(true);
    setError("");
    listAvailableDispatchItems(dispatchDate)
      .then((available) => {
        if (cancelled) return;
        setItems(available);
        setFarmId((current) => current && available.some((item) => String(item.farm_id) === current)
          ? current
          : available[0] ? String(available[0].farm_id) : "");
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) setError("Unable to load dispatchable Population Record and Egg Laying quantities.");
      })
      .finally(() => { if (!cancelled) setLoadingItems(false); });
    return () => { cancelled = true; };
  }, [dispatchDate, loading]);

  useEffect(() => setValue("loading_g", loading || loadingItems || saving), [loading, loadingItems, saving, setValue]);

  const farms = useMemo(() => {
    const unique = new Map<number, AvailableDispatchItem>();
    items.forEach((item) => unique.set(item.farm_id, item));
    return [...unique.values()].sort((left, right) => left.farm_name.localeCompare(right.farm_name));
  }, [items]);
  const selectedFarm = farms.find((farm) => String(farm.farm_id) === farmId) ?? null;
  const farmItems = useMemo(() => items.filter((item) => String(item.farm_id) === farmId), [farmId, items]);
  const destinationOptions = hatcheryFarms.map((farm) => ({
    value: farm.farm_name,
    label: farm.farm_code ? `${farm.farm_code} - ${farm.farm_name}` : farm.farm_name,
  }));

  function updateRow<K extends keyof DispatchRow>(id: number, key: K, value: DispatchRow[K]) {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, [key]: value };
      if (key === "source_type") {
        next.category = "";
        next.production_date = "";
        next.dispatch_qty = "";
      } else if (key === "category") {
        next.production_date = "";
        next.dispatch_qty = "";
      } else if (key === "production_date") {
        next.dispatch_qty = "";
      }
      return next;
    }));
  }

  function resetSources() {
    setRows((current) => current.map((row) => ({
      ...row,
      source_type: "",
      category: "",
      production_date: "",
      dispatch_qty: "",
    })));
  }

  function rowItems(row: DispatchRow) {
    return farmItems.filter((item) => item.source_type === row.source_type
      && item.category === row.category
      && item.source_date.slice(0, 10) === row.production_date);
  }

  function availableFor(row: DispatchRow) {
    const total = rowItems(row).reduce((sum, item) => sum + quantity(item.source_available), 0);
    const usedByOtherRows = rows.reduce((sum, other) => other.id !== row.id && sourceCategoryKey(other) === sourceCategoryKey(row)
      ? sum + quantity(other.dispatch_qty)
      : sum, 0);
    return Math.max(0, total - usedByOtherRows);
  }

  function buildPayloads(): BreederDispatchInput[] {
    if (!dispatchDate) throw new Error("Dispatch date is required.");
    if (!selectedFarm) throw new Error("Breeder farm is required.");
    if (!rows.length) throw new Error("Add at least one dispatch row.");

    const remaining = new Map(farmItems.map((item) => [item.key, quantity(item.source_available)]));
    return rows.map((row, rowIndex) => {
      const lineLabel = `Row ${rowIndex + 1}`;
      if (!row.destination.trim()) throw new Error(`${lineLabel}: Destination Transfer is required.`);
      if (!row.source_type) throw new Error(`${lineLabel}: Data Source is required.`);
      if (!row.category) throw new Error(`${lineLabel}: Category is required.`);
      if (!row.production_date) throw new Error(`${lineLabel}: Production Date is required.`);
      const requested = quantity(row.dispatch_qty);
      if (!Number.isInteger(requested) || requested <= 0) throw new Error(`${lineLabel}: Dispatch Quantity must be a positive whole number.`);

      let unallocated = requested;
      const lines: BreederDispatchInput["lines"] = [];
      const matching = rowItems(row).sort((left, right) => left.source_record_id - right.source_record_id);
      for (const item of matching) {
        const itemRemaining = remaining.get(item.key) ?? 0;
        if (unallocated <= 0 || itemRemaining <= 0) continue;
        const allocated = Math.min(unallocated, itemRemaining);
        remaining.set(item.key, itemRemaining - allocated);
        unallocated -= allocated;
        lines.push({
          line_no: lines.length + 1,
          source_type: item.source_type,
          source_record_id: item.source_record_id,
          source_date: item.source_date,
          category: item.category,
          category_label: item.category_label,
          placement_id: item.placement_id,
          placement_date: item.placement_date,
          building_id: item.building_id,
          building_name: item.building_name,
          pen_id: item.pen_id,
          pen_name: item.pen_name,
          dr_no: item.dr_no,
          source_available: item.source_available,
          dispatch_qty: allocated,
          remarks: row.remarks.trim() || null,
        });
      }
      if (unallocated > 0) throw new Error(`${lineLabel}: Dispatch Quantity exceeds the remaining inventory for this source, category, and production date.`);

      return {
        dispatch_date: dispatchDate,
        farm_id: selectedFarm.farm_id,
        farm_code: selectedFarm.farm_code,
        farm_name: selectedFarm.farm_name,
        destination: row.destination.trim(),
        hauler_name: row.hauler_name.trim() || null,
        plate_number: row.plate_number.trim() || null,
        truck_seal: row.truck_seal.trim() || null,
        remarks: row.remarks.trim() || null,
        lines,
      };
    });
  }

  async function save(post: boolean) {
    let payloads: BreederDispatchInput[];
    try {
      payloads = buildPayloads();
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Complete all required dispatch fields.");
      return;
    }
    if (post && !window.confirm(`Post ${payloads.length} breeder dispatch transaction${payloads.length === 1 ? "" : "s"}? The quantities will be reserved immediately.`)) return;

    setSaving(true);
    setError("");
    let completed = 0;
    try {
      for (const payload of payloads) {
        await createBreederDispatch(payload, post);
        completed += 1;
      }
      router.push("/jmb/breederdispatch");
      router.refresh();
    } catch (saveError) {
      console.error(saveError);
      const detail = saveError instanceof Error ? saveError.message : "Unable to save multiple breeder dispatches.";
      if (completed) {
        setRows((current) => current.slice(completed));
        try {
          setItems(await listAvailableDispatchItems(dispatchDate));
        } catch (refreshError) {
          console.error(refreshError);
        }
      }
      setError(completed ? `${completed} transaction${completed === 1 ? " was" : "s were"} saved before processing stopped. Only the unsaved rows remain below. ${detail}` : detail);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-screen w-full bg-slate-100 p-4 dark:bg-background">
      <form onSubmit={(event) => { event.preventDefault(); void save(false); }} className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
        <header className="shrink-0 border-b px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Breeder / Dispatch</div>
              <h1 className="text-lg font-semibold">Breeder Multiple Dispatch</h1>
              <p className="text-xs text-muted-foreground">Enter and save several dispatch transactions in one tabular worksheet.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/jmb/breederdispatch")} disabled={saving}><X className="size-4" />Cancel</Button>
              <Button type="submit" variant="outline" disabled={saving || loading || loadingItems}><Save className="size-4" />Save drafts</Button>
              <Button type="button" onClick={() => void save(true)} disabled={saving || loading || loadingItems}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Post multiple</Button>
            </div>
          </div>
        </header>

        <fieldset disabled={loading || loadingItems || saving} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 dark:bg-background/40">
          <div className="mx-auto max-w-[1900px] space-y-4">
            {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <section className="rounded-lg border bg-white p-4 shadow-sm dark:bg-card">
              <div className="mb-4 flex items-start gap-2"><Bird className="mt-0.5 size-4" /><div><h2 className="text-sm font-medium">Transaction header</h2><p className="text-xs text-muted-foreground">The dispatch date and breeder farm apply to every row below.</p></div></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label required>Dispatch date</Label><Input type="date" value={dispatchDate} onChange={(event) => { setDispatchDate(event.target.value); resetSources(); }} /></div>
                <div className="space-y-2"><Label required>Breeder farm</Label><SearchableCombobox items={farms.map((farm) => ({ code: String(farm.farm_id), name: farm.farm_code ? `${farm.farm_code} - ${farm.farm_name}` : farm.farm_name }))} value={farmId} onValueChange={(value) => { setFarmId(value); resetSources(); }} placeholder="Select farm" showCode className="w-full" /></div>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
              <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="text-sm font-medium">Dispatch transactions</h2><p className="text-xs text-muted-foreground">Each table row creates one breeder dispatch document.</p></div>
                <Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, emptyRow()])}><ListPlus className="size-4" />Add row</Button>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[1950px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-56">Destination Transfer *</TableHead>
                      <TableHead className="w-44">Hauler</TableHead>
                      <TableHead className="w-36">Plate Number</TableHead>
                      <TableHead className="w-36">Truck Seal</TableHead>
                      <TableHead className="w-44">Data Source *</TableHead>
                      <TableHead className="w-52">Category *</TableHead>
                      <TableHead className="w-44">Production Date *</TableHead>
                      <TableHead className="w-32 text-right">Available</TableHead>
                      <TableHead className="w-40">Dispatch Qty *</TableHead>
                      <TableHead className="w-56">Remarks</TableHead>
                      <TableHead className="w-16 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const categoryOptions = [...new Map(farmItems.filter((item) => item.source_type === row.source_type).map((item) => [item.category, item.category_label])).entries()];
                      const productionDates = [...new Set(farmItems.filter((item) => item.source_type === row.source_type && item.category === row.category).map((item) => item.source_date.slice(0, 10)))].sort().reverse();
                      const available = availableFor(row);
                      return (
                        <TableRow key={row.id}>
                          <TableCell><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={row.destination} onChange={(event) => updateRow(row.id, "destination", event.target.value)}><option value="">Select destination</option>{destinationOptions.map((option) => <option key={`${option.value}:${option.label}`} value={option.value}>{option.label}</option>)}</select></TableCell>
                          <TableCell><Input value={row.hauler_name} onChange={(event) => updateRow(row.id, "hauler_name", event.target.value)} /></TableCell>
                          <TableCell><Input value={row.plate_number} onChange={(event) => updateRow(row.id, "plate_number", event.target.value)} /></TableCell>
                          <TableCell><Input value={row.truck_seal} onChange={(event) => updateRow(row.id, "truck_seal", event.target.value)} /></TableCell>
                          <TableCell><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={row.source_type} onChange={(event) => updateRow(row.id, "source_type", event.target.value as DispatchRow["source_type"])}><option value="">Select source</option><option value="Population Record">Population Record</option><option value="Egg Laying">Egg Laying</option></select></TableCell>
                          <TableCell><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={row.category} onChange={(event) => updateRow(row.id, "category", event.target.value)} disabled={!row.source_type}><option value="">Select category</option>{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></TableCell>
                          <TableCell><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={row.production_date} onChange={(event) => updateRow(row.id, "production_date", event.target.value)} disabled={!row.category}><option value="">Select production date</option>{productionDates.map((date) => <option key={date} value={date}>{new Date(`${date}T00:00:00`).toLocaleDateString("en-PH")}</option>)}</select></TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{available.toLocaleString()}</TableCell>
                          <TableCell><Input type="number" min="1" max={available || undefined} step="1" value={row.dispatch_qty} onChange={(event) => updateRow(row.id, "dispatch_qty", event.target.value)} placeholder="0" /></TableCell>
                          <TableCell><Input value={row.remarks} onChange={(event) => updateRow(row.id, "remarks", event.target.value)} maxLength={250} /></TableCell>
                          <TableCell className="text-right"><Button type="button" size="icon" variant="ghost" aria-label={`Remove row ${rows.indexOf(row) + 1}`} disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((currentRow) => currentRow.id !== row.id))}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="border-t px-4 py-3 text-sm text-muted-foreground">{rows.length} transaction row{rows.length === 1 ? "" : "s"} · {rows.reduce((sum, row) => sum + quantity(row.dispatch_qty), 0).toLocaleString()} total units</div>
            </section>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
