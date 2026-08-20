"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bird, Boxes, Loader2, Save, Send, Truck, X } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  createBreederDispatch, dispatchItemKey, EGG_CATEGORIES, getBreederDispatchById, getDefaultFarm,
  listAvailableDispatchItems, listHatcheryFarms, POPULATION_CATEGORIES, updateBreederDispatch,
  type AvailableDispatchItem, type BreederDispatchInput, type DispatchSourceType, type DispatchStatus,
  type HatcheryFarmLookup,
} from "./api";

const today = () => new Date().toLocaleDateString("en-CA");
type FormState = { dispatch_date: string; farm_id: string; destination: string; hauler_name: string; plate_number: string; truck_seal: string; remarks: string };
type QuantityState = Record<string, { quantity: string; remarks: string }>;
type DispatchCategoryGroup = {
  key: string; source_type: DispatchSourceType; category: string; category_label: string;
  source_available: number; items: AvailableDispatchItem[];
};
const initialForm = (): FormState => ({ dispatch_date: today(), farm_id: "", destination: "", hauler_name: "", plate_number: "", truck_seal: "", remarks: "" });
const number = (value: string | number | null | undefined) => { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; };
const categoryKey = (sourceType: DispatchSourceType, category: string) => `${sourceType}:${category}`;
const formatDate = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH");
};

export default function BreederDispatchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setValue } = useGlobalContext();
  const dispatchId = Number(searchParams.get("id"));
  const isEdit = Number.isInteger(dispatchId) && dispatchId > 0;
  const [form, setForm] = useState<FormState>(initialForm);
  const [items, setItems] = useState<AvailableDispatchItem[]>([]);
  const [hatcheryFarms, setHatcheryFarms] = useState<HatcheryFarmLookup[]>([]);
  const [quantities, setQuantities] = useState<QuantityState>({});
  const [sourceFilter, setSourceFilter] = useState<"All" | DispatchSourceType>("All");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [productionFromDate, setProductionFromDate] = useState("");
  const [productionToDate, setProductionToDate] = useState("");
  const [documentNo, setDocumentNo] = useState("");
  const [status, setStatus] = useState<DispatchStatus>("Draft");
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const readOnly = isEdit && status !== "Draft";

  useEffect(() => { void refreshSessionx(router); }, [router]);
  useEffect(() => {
    let cancelled = false; setLoading(true);
    Promise.all([isEdit ? getBreederDispatchById(dispatchId) : getDefaultFarm(), listHatcheryFarms()]).then(([result, destinationFarms]) => {
      if (cancelled) return;
      setHatcheryFarms(destinationFarms);
      if (isEdit) {
        const record = result as Awaited<ReturnType<typeof getBreederDispatchById>>;
        setDocumentNo(record.document_no); setStatus(record.status);
        setForm({ dispatch_date: record.dispatch_date.slice(0, 10), farm_id: String(record.farm_id), destination: record.destination, hauler_name: record.hauler_name ?? "", plate_number: record.plate_number ?? "", truck_seal: record.truck_seal ?? "", remarks: record.remarks ?? "" });
        const groupedQuantities: QuantityState = {};
        record.lines.forEach((line) => {
          const key = categoryKey(line.source_type, line.category);
          groupedQuantities[key] = {
            quantity: String(number(groupedQuantities[key]?.quantity) + number(line.dispatch_qty)),
            remarks: groupedQuantities[key]?.remarks || line.remarks || "",
          };
        });
        setQuantities(groupedQuantities);
        if (record.status !== "Draft") setItems(record.lines.map(lineToItem(record)));
      } else {
        const farm = result as Awaited<ReturnType<typeof getDefaultFarm>>;
        if (farm?.id) setForm((current) => ({ ...current, farm_id: String(farm.id) }));
      }
    }).catch((loadError) => { console.error(loadError); if (!cancelled) setError("Unable to load breeder dispatch details."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dispatchId, isEdit]);

  useEffect(() => {
    if (loading || readOnly || !form.dispatch_date) return;
    let cancelled = false; setLoadingItems(true);
    listAvailableDispatchItems(form.dispatch_date).then((rows) => {
      if (cancelled) return; setItems(rows);
      setForm((current) => current.farm_id && rows.some((row) => String(row.farm_id) === current.farm_id) ? current : { ...current, farm_id: rows[0] ? String(rows[0].farm_id) : "" });
    }).catch((loadError) => { console.error(loadError); if (!cancelled) setError("Unable to load dispatchable Population Record and Egg Laying quantities."); })
      .finally(() => { if (!cancelled) setLoadingItems(false); });
    return () => { cancelled = true; };
  }, [form.dispatch_date, loading, readOnly]);
  useEffect(() => setValue("loading_g", loading || loadingItems || saving), [loading, loadingItems, saving, setValue]);

  const farms = useMemo(() => {
    const unique = new Map<number, AvailableDispatchItem>(); items.forEach((item) => unique.set(item.farm_id, item));
    return [...unique.values()].sort((a, b) => a.farm_name.localeCompare(b.farm_name));
  }, [items]);
  const selectedFarm = farms.find((farm) => String(farm.farm_id) === form.farm_id) ?? null;
  const destinationOptions = useMemo(() => {
    const options = hatcheryFarms.map((farm) => ({
      code: farm.farm_name,
      name: farm.farm_code ? `${farm.farm_code} - ${farm.farm_name}` : farm.farm_name,
    }));
    if (form.destination && !options.some((option) => option.code === form.destination)) {
      options.push({ code: form.destination, name: form.destination });
    }
    return options;
  }, [form.destination, hatcheryFarms]);
  const farmItems = useMemo(() => items.filter((item) => {
    if (String(item.farm_id) !== form.farm_id) return false;
    const productionDate = item.source_date.slice(0, 10);
    return (!productionFromDate || productionDate >= productionFromDate)
      && (!productionToDate || productionDate <= productionToDate);
  }), [form.farm_id, items, productionFromDate, productionToDate]);
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, DispatchCategoryGroup>();
    farmItems.forEach((item) => {
      const key = categoryKey(item.source_type, item.category);
      const group = groups.get(key) ?? { key, source_type: item.source_type, category: item.category, category_label: item.category_label, source_available: 0, items: [] };
      group.source_available += number(item.source_available);
      group.items.push(item);
      groups.set(key, group);
    });
    return [...groups.values()].sort((a, b) => a.source_type.localeCompare(b.source_type) || a.category_label.localeCompare(b.category_label));
  }, [farmItems]);
  const categories = useMemo(() => {
    const base = sourceFilter === "Population Record" ? POPULATION_CATEGORIES : sourceFilter === "Egg Laying" ? EGG_CATEGORIES : [...POPULATION_CATEGORIES, ...EGG_CATEGORIES];
    return [...new Map(base.map(([value, label]) => [value, label])).entries()];
  }, [sourceFilter]);
  const visibleGroups = categoryGroups.filter((group) => (sourceFilter === "All" || group.source_type === sourceFilter) && (!categoryFilter.length || categoryFilter.includes(group.category)));
  const selectedGroups = categoryGroups.filter((group) => number(quantities[group.key]?.quantity) > 0);
  const totals = selectedGroups.reduce((sum, group) => ({ ...sum, [group.source_type]: sum[group.source_type] + number(quantities[group.key]?.quantity) }), { "Population Record": 0, "Egg Laying": 0 } as Record<DispatchSourceType, number>);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function updateQuantity(key: string, field: "quantity" | "remarks", value: string) { setQuantities((current) => ({ ...current, [key]: { ...(current[key] ?? { quantity: "", remarks: "" }), [field]: value } })); }
  function resetAllocation() { setQuantities({}); setSourceFilter("All"); setCategoryFilter([]); setProductionFromDate(""); setProductionToDate(""); }

  function validate() {
    if (!form.dispatch_date || !form.farm_id) return "Dispatch date and breeder farm are required.";
    if (productionFromDate && productionToDate && productionFromDate > productionToDate) return "Production date From must not be later than To.";
    if (!form.destination.trim()) return "Destination is required.";
    if (!selectedGroups.length) return "Enter a dispatch quantity for at least one category.";
    for (const group of selectedGroups) {
      const quantity = number(quantities[group.key]?.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) return "Dispatch quantities must be positive whole numbers.";
      if (quantity > group.source_available) return `${group.category_label} exceeds the available ${group.source_type} inventory.`;
    }
    return "";
  }

  function payload(): BreederDispatchInput {
    if (!selectedFarm) throw new Error("Select a breeder farm.");
    const allocatedLines = selectedGroups.flatMap((group) => {
      let remaining = number(quantities[group.key]?.quantity);
      return [...group.items].sort((a, b) => a.source_date.localeCompare(b.source_date) || a.source_record_id - b.source_record_id).flatMap((item) => {
        if (remaining <= 0) return [];
        const dispatchQuantity = Math.min(remaining, item.source_available);
        remaining -= dispatchQuantity;
        return [{ source_type: item.source_type, source_record_id: item.source_record_id, source_date: item.source_date, category: item.category, category_label: item.category_label, placement_id: item.placement_id, placement_date: item.placement_date, building_id: item.building_id, building_name: item.building_name, pen_id: item.pen_id, pen_name: item.pen_name, dr_no: item.dr_no, source_available: item.source_available, dispatch_qty: dispatchQuantity, remarks: quantities[group.key]?.remarks.trim() || null }];
      });
    });
    return { dispatch_date: form.dispatch_date, farm_id: selectedFarm.farm_id, farm_code: selectedFarm.farm_code, farm_name: selectedFarm.farm_name, destination: form.destination.trim(), hauler_name: form.hauler_name.trim() || null, plate_number: form.plate_number.trim() || null, truck_seal: form.truck_seal.trim() || null, remarks: form.remarks.trim() || null,
      lines: allocatedLines.map((line, index) => ({ ...line, line_no: index + 1 })) };
  }

  async function save(post: boolean) {
    if (readOnly) return; const message = validate(); if (message) { setError(message); return; }
    if (post && !window.confirm("Post this dispatch? The quantities will be reserved from their Population Record or Egg Laying categories.")) return;
    setSaving(true); setError("");
    try { const input = payload(); if (isEdit) await updateBreederDispatch(dispatchId, input, post); else await createBreederDispatch(input, post); router.push("/jmb/breederdispatch"); router.refresh(); }
    catch (saveError) { console.error(saveError); setError(saveError instanceof Error ? saveError.message : "Unable to save breeder dispatch."); }
    finally { setSaving(false); }
  }

  return <div className="h-screen w-full bg-slate-100 p-4 dark:bg-background">
    <form onSubmit={(event) => { event.preventDefault(); void save(false); }} className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
      <header className="shrink-0 border-b px-4 py-3"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Breeder / Dispatch</div><h1 className="text-lg font-semibold">{readOnly ? "View Breeder Dispatch" : isEdit ? "Edit Breeder Dispatch" : "New Breeder Dispatch"}</h1><p className="text-xs text-muted-foreground">{selectedFarm?.farm_name || "Select breeder farm"}{documentNo ? ` · ${documentNo}` : ""}{isEdit ? ` · ${status}` : ""}</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => router.push("/jmb/breederdispatch")} disabled={saving}><X className="size-4" />{readOnly ? "Close" : "Cancel"}</Button>{!readOnly && <><Button type="submit" variant="outline" disabled={saving || loading}><Save className="size-4" />Save draft</Button><Button type="button" onClick={() => void save(true)} disabled={saving || loading}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Post dispatch</Button></>}</div>
      </div></header>
      <fieldset disabled={loading || loadingItems || saving || readOnly} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 dark:bg-background/40">
        <div className="mx-auto max-w-[1800px] overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
          {error && <div className="m-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {loading ? <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading dispatch...</div> : <>
            <section className="space-y-4 p-5"><SectionHeading icon={<Bird className="size-4" />} title="Dispatch Details" description="Select the dispatch date and breeder farm." /><div className="grid gap-4 md:grid-cols-2">
              <Field label="Dispatch date" required><Input type="date" value={form.dispatch_date} onChange={(e) => { update("dispatch_date", e.target.value); resetAllocation(); }} /></Field>
              <Field label="Breeder farm" required><SearchableCombobox items={farms.map((farm) => ({ code: String(farm.farm_id), name: farm.farm_code ? `${farm.farm_code} - ${farm.farm_name}` : farm.farm_name }))} value={form.farm_id} onValueChange={(value) => { update("farm_id", value); resetAllocation(); }} placeholder="Select farm" showCode className="w-full" /></Field>
            </div></section><Divider />
            <section className="space-y-4 p-5"><SectionHeading icon={<Truck className="size-4" />} title="Transport" description="Record the transfer destination and vehicle traceability." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Destination Transfer" required><SearchableCombobox items={destinationOptions} value={form.destination} onValueChange={(value) => update("destination", value)} placeholder="Select hatchery farm" className="w-full" /></Field><Field label="Hauler"><Input value={form.hauler_name} onChange={(e) => update("hauler_name", e.target.value)} /></Field><Field label="Plate number"><Input value={form.plate_number} onChange={(e) => update("plate_number", e.target.value)} /></Field><Field label="Truck seal"><Input value={form.truck_seal} onChange={(e) => update("truck_seal", e.target.value)} /></Field></div></section><Divider />
            <section className="space-y-4 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><SectionHeading icon={<Boxes className="size-4" />} title="Dispatch Categories" description="Available inventory is summed per category across source records, less quantities from posted dispatch transactions." /><div className="grid grid-cols-3 gap-2 text-right"><Summary label="Population" value={totals["Population Record"]} /><Summary label="Eggs" value={totals["Egg Laying"]} /><Summary label="Total" value={totals["Population Record"] + totals["Egg Laying"]} /></div></div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Field label="Data source"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value as typeof sourceFilter); setCategoryFilter([]); }}><option>All</option><option>Population Record</option><option>Egg Laying</option></select></Field><SearchableCombobox multiple label="Category" items={categories.map(([value, label]) => ({ code: value, name: label }))} value={categoryFilter} onValueChange={setCategoryFilter} placeholder="All categories" className="w-full" /><Field label="Production date from"><Input type="date" max={productionToDate || form.dispatch_date || undefined} value={productionFromDate} onChange={(e) => setProductionFromDate(e.target.value)} /></Field><Field label="Production date to"><Input type="date" min={productionFromDate || undefined} max={form.dispatch_date || undefined} value={productionToDate} onChange={(e) => setProductionToDate(e.target.value)} /></Field></div>
              <div className="overflow-x-auto rounded-md border"><Table className="min-w-[900px]"><TableHeader><TableRow><TableHead>Data source</TableHead><TableHead>Prod. Date</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Available inventory</TableHead><TableHead className="w-44">Dispatch quantity</TableHead><TableHead>Line remarks</TableHead></TableRow></TableHeader><TableBody>
                {loadingItems && <TableRow><TableCell colSpan={6} className="h-28 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow>}
                {!loadingItems && visibleGroups.map((group) => { const productionDates = group.items.map((item) => item.source_date.slice(0, 10)).sort(); const firstDate = productionDates[0]; const lastDate = productionDates.at(-1); return <TableRow key={group.key}><TableCell className="font-medium">{group.source_type}</TableCell><TableCell className="whitespace-nowrap">{firstDate === lastDate ? formatDate(firstDate) : `${formatDate(firstDate)} - ${formatDate(lastDate ?? firstDate)}`}</TableCell><TableCell>{group.category_label}</TableCell><TableCell className="text-right font-medium tabular-nums">{group.source_available.toLocaleString()}</TableCell><TableCell><Input type="number" min="0" max={group.source_available} step="1" value={quantities[group.key]?.quantity ?? ""} onChange={(e) => updateQuantity(group.key, "quantity", e.target.value)} placeholder="0" /></TableCell><TableCell><Input value={quantities[group.key]?.remarks ?? ""} onChange={(e) => updateQuantity(group.key, "remarks", e.target.value)} maxLength={250} /></TableCell></TableRow>; })}
                {!loadingItems && !visibleGroups.length && <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No dispatchable inventory for this farm, source, category, and production date range.</TableCell></TableRow>}
              </TableBody></Table></div>
            </section><Divider /><section className="p-5"><Field label="Dispatch remarks"><Textarea value={form.remarks} onChange={(e) => update("remarks", e.target.value)} maxLength={500} className="min-h-20" /></Field></section>
          </>}
        </div>
      </fieldset>
    </form>
  </div>;
}

function lineToItem(record: Awaited<ReturnType<typeof getBreederDispatchById>>) { return (line: Awaited<ReturnType<typeof getBreederDispatchById>>["lines"][number]): AvailableDispatchItem => ({ ...line, key: dispatchItemKey(line.source_type, line.source_record_id, line.category), farm_id: record.farm_id, farm_code: record.farm_code, farm_name: record.farm_name }); }
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <div className="space-y-2"><Label required={required}>{label}</Label>{children}</div>; }
function SectionHeading({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) { return <div><h3 className="flex items-center gap-2 text-sm font-medium">{icon}{title}</h3><p className="text-xs text-muted-foreground">{description}</p></div>; }
function Divider() { return <div className="h-px bg-border" />; }
function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-md border bg-muted/20 px-3 py-2"><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold tabular-nums">{value.toLocaleString()}</div></div>; }
