"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bird, ListPlus, Loader2, Save, Send, Trash2, X } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  createBreederDispatch,
  EGG_CATEGORIES,
  POPULATION_CATEGORIES,
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
  customer_name: string;
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
const WALK_IN_DESTINATION = "__walk_in_customer__";
let nextRowId = 1;

function emptyRow(): DispatchRow {
  return {
    id: nextRowId++,
    destination: "",
    customer_name: "",
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
    value: String(farm.farm_id),
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
      } else if (key === "destination" && value !== WALK_IN_DESTINATION) {
        next.customer_name = "";
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
      if (row.destination === WALK_IN_DESTINATION && !row.customer_name.trim()) throw new Error(`${lineLabel}: Customer Name is required for a walk-in customer.`);
      const destinationFarm = row.destination === WALK_IN_DESTINATION
        ? null
        : hatcheryFarms.find((farm) => String(farm.farm_id) === row.destination);
      if (row.destination !== WALK_IN_DESTINATION && !destinationFarm) throw new Error(`${lineLabel}: Select an active Hatchery destination farm.`);
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
        destination: row.destination === WALK_IN_DESTINATION
          ? `Walk-in Customer - ${row.customer_name.trim()}`
          : destinationFarm!.farm_name,
        farm_destination_id: destinationFarm?.farm_id ?? null,
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
    <div className="h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-slate-100 p-4 dark:bg-background">
      <form onSubmit={(event) => { event.preventDefault(); void save(false); }} className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
        <header className="min-w-0 shrink-0 border-b px-4 py-3">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Breeder / Dispatch</div>
              <h1 className="text-lg font-semibold">Breeder Multiple Dispatch</h1>
              <p className="text-xs text-muted-foreground">Enter and save several dispatch transactions in one tabular worksheet.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/jmb/breederdispatch")} disabled={saving}><X className="size-4" />Cancel</Button>
              <Button type="submit" variant="outline" disabled={saving || loading || loadingItems}><Save className="size-4" />Save drafts</Button>
              <Button type="button" onClick={() => void save(true)} disabled={saving || loading || loadingItems}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Post multiple</Button>
            </div>
          </div>
        </header>

        <fieldset disabled={loading || loadingItems || saving} className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto bg-slate-50/60 p-4 dark:bg-background/40">
          <div className="mx-auto w-full min-w-0 max-w-[1900px] space-y-4">
            {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <section className="w-full min-w-0 max-w-full rounded-lg border bg-white p-4 shadow-sm dark:bg-card">
              <div className="mb-4 flex items-start gap-2"><Bird className="mt-0.5 size-4" /><div><h2 className="text-sm font-medium">Transaction header</h2><p className="text-xs text-muted-foreground">The dispatch date and breeder farm apply to every row below.</p></div></div>
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <div className="min-w-0 space-y-2"><Label required>Dispatch date</Label><Input className="w-full min-w-0" type="date" value={dispatchDate} onChange={(event) => { setDispatchDate(event.target.value); resetSources(); }} /></div>
                <div className="min-w-0 space-y-2"><Label required>Breeder farm</Label><SearchableCombobox items={farms.map((farm) => ({ code: String(farm.farm_id), name: farm.farm_code ? `${farm.farm_code} - ${farm.farm_name}` : farm.farm_name }))} value={farmId} onValueChange={(value) => { setFarmId(value); resetSources(); }} placeholder="Select farm" showCode className="w-full min-w-0 max-w-full" /></div>
              </div>
            </section>

            <section className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
              <div className="flex min-w-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><h2 className="text-sm font-medium">Dispatch transactions</h2><p className="text-xs text-muted-foreground">Each table row creates one breeder dispatch document.</p></div>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setRows((current) => [...current, emptyRow()])}><ListPlus className="size-4" />Add row</Button>
              </div>
              <div className="max-h-[520px] w-full min-w-0 max-w-full overflow-auto bg-white dark:bg-card">
                <table className="fc-grid-table min-w-[1835px] w-full table-fixed border-separate border-spacing-0 caption-bottom text-sm">
                  <colgroup>
                    <col style={{ width: 50 }} />
                    <col style={{ width: 160 }} />
                    <col style={{ width: 200 }} />
                    <col style={{ width: 145 }} />
                    <col style={{ width: 105 }} />
                    <col style={{ width: 120 }} />
                    <col style={{ width: 220 }} />
                    <col style={{ width: 190 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 120 }} />
                    <col style={{ width: 120 }} />
                    <col style={{ width: 195 }} />
                    <col style={{ width: 60 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ height: 36 }}>
                      {["#", "Data Source *", "Category *", "Production Date *", "Available", "Dispatch Qty *", "Destination Transfer *", "Customer Name", "Hauler", "Plate Number", "Truck Seal", "Remarks", "Action"].map((label, index) => (
                        <th
                          key={label}
                          scope="col"
                          style={index === 1 ? { left: 50 } : undefined}
                          className={`fc-grid-header fc-grid-header-border fc-grid-border-r sticky top-0 px-1 text-center text-xs font-semibold leading-tight ${index === 0 ? "left-0 z-40" : index === 1 ? "z-40 fc-grid-age-header" : "z-30"}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => {
                      const availableCategories = new Set(farmItems.filter((item) => item.source_type === row.source_type).map((item) => item.category));
                      const categoryOptions = (row.source_type === "Population Record" ? POPULATION_CATEGORIES : row.source_type === "Egg Laying" ? EGG_CATEGORIES : []).filter(([category]) => availableCategories.has(category));
                      const productionDates = [...new Set(farmItems.filter((item) => item.source_type === row.source_type && item.category === row.category).map((item) => item.source_date.slice(0, 10)))].sort().reverse();
                      const available = availableFor(row);
                      const divider = rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider";
                      const editableCell = `fc-grid-cell fc-grid-cell-editable fc-grid-border-r p-0 ${divider}`;
                      const inputClass = "h-8 min-w-0 rounded-none border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0";
                      const selectClass = "h-8 w-full min-w-0 border-0 bg-transparent px-1 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50";
                      return (
                        <tr key={row.id} className="fc-grid-row border-0">
                          <td className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r sticky left-0 z-20 p-0 text-center font-semibold tabular-nums ${divider}`}><div className="flex h-8 items-center justify-center">{rowIndex + 1}</div></td>
                          <td style={{ left: 50 }} className={`${editableCell} sticky z-20`}><select data-fc-cell="true" aria-label={`Row ${rowIndex + 1} Data Source`} className={selectClass} value={row.source_type} onChange={(event) => updateRow(row.id, "source_type", event.target.value as DispatchRow["source_type"])}><option value="">Select source</option><option value="Population Record">Population Record</option><option value="Egg Laying">Egg Laying</option></select></td>
                          <td className={editableCell}><select data-fc-cell="true" aria-label={`Row ${rowIndex + 1} Category`} className={selectClass} value={row.category} onChange={(event) => updateRow(row.id, "category", event.target.value)} disabled={!row.source_type}><option value="">Select category</option>{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
                          <td className={editableCell}><select data-fc-cell="true" aria-label={`Row ${rowIndex + 1} Production Date`} className={selectClass} value={row.production_date} onChange={(event) => updateRow(row.id, "production_date", event.target.value)} disabled={!row.category}><option value="">Select date</option>{productionDates.map((date) => <option key={date} value={date}>{new Date(`${date}T00:00:00`).toLocaleDateString("en-PH")}</option>)}</select></td>
                          <td className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 text-center font-semibold tabular-nums ${divider}`}><div className="flex h-8 items-center justify-center">{available.toLocaleString()}</div></td>
                          <td className={editableCell}><Input aria-label={`Row ${rowIndex + 1} Dispatch Quantity`} className={`${inputClass} [appearance:textfield] text-center tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} type="number" min="1" max={available || undefined} step="1" value={row.dispatch_qty} onFocus={(event) => event.target.select()} onChange={(event) => updateRow(row.id, "dispatch_qty", event.target.value)} placeholder="0" /></td>
                          <td className={editableCell}><select data-fc-cell="true" aria-label={`Row ${rowIndex + 1} Destination Transfer`} className={selectClass} value={row.destination} onChange={(event) => updateRow(row.id, "destination", event.target.value)}><option value="">Select destination</option>{destinationOptions.map((option) => <option key={`${option.value}:${option.label}`} value={option.value}>{option.label}</option>)}<option value={WALK_IN_DESTINATION}>Walk-in Customer</option></select></td>
                          <td className={row.destination === WALK_IN_DESTINATION ? editableCell : `fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 ${divider}`}><Input aria-label={`Row ${rowIndex + 1} Customer Name`} className={inputClass} value={row.customer_name} onChange={(event) => updateRow(row.id, "customer_name", event.target.value)} disabled={row.destination !== WALK_IN_DESTINATION} placeholder={row.destination === WALK_IN_DESTINATION ? "Required" : "Farm transfer"} maxLength={150} /></td>
                          <td className={editableCell}><Input aria-label={`Row ${rowIndex + 1} Hauler`} className={inputClass} value={row.hauler_name} onChange={(event) => updateRow(row.id, "hauler_name", event.target.value)} /></td>
                          <td className={editableCell}><Input aria-label={`Row ${rowIndex + 1} Plate Number`} className={inputClass} value={row.plate_number} onChange={(event) => updateRow(row.id, "plate_number", event.target.value)} /></td>
                          <td className={editableCell}><Input aria-label={`Row ${rowIndex + 1} Truck Seal`} className={inputClass} value={row.truck_seal} onChange={(event) => updateRow(row.id, "truck_seal", event.target.value)} /></td>
                          <td className={editableCell}><Input aria-label={`Row ${rowIndex + 1} Remarks`} className={inputClass} value={row.remarks} onChange={(event) => updateRow(row.id, "remarks", event.target.value)} maxLength={250} /></td>
                          <td className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 text-center ${divider}`}><Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove row ${rowIndex + 1}`} disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((currentRow) => currentRow.id !== row.id))} className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="fc-grid-footer-cell sticky bottom-0 left-0 z-40 h-9 text-center font-semibold">#</td>
                      <td style={{ left: 50 }} className="fc-grid-footer-cell fc-grid-footer-age sticky bottom-0 z-40 px-2 text-left text-xs font-semibold">{rows.length} row{rows.length === 1 ? "" : "s"}</td>
                      <td colSpan={3} className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0 px-2 text-left text-xs font-semibold">Total Dispatch Quantity</td>
                      <td className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0 text-center font-semibold tabular-nums">{rows.reduce((sum, row) => sum + quantity(row.dispatch_qty), 0).toLocaleString()}</td>
                      <td colSpan={7} className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
