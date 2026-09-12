"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Save, X } from "lucide-react";
import { parseCullingQuantity, formatCullingQuantity } from "@/lib/data/queries/cullingQuantity";
import { cullingAge } from "@/lib/data/queries/breederCullingAge";
import { groupCullingBuildings, type CullingBuilding } from "@/lib/data/queries/breederCullingBuildings";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { createBreederCleanups, getBreederCleanupById, getUserInfo, listBreederFarms,
  listBreederCleanupCycles, updateBreederCleanup, type BreederFarm, type BreederCleanupInput,
  type BreederCleanupRow } from "./api";

type RowInput = { cycleKey: string; date_of_culling: string; body_weight: string; buyer_name: string; hauler_name: string; hauler_plate_number: string; remarks: string; female_cleanup_qty: string; male_cleanup_qty: string };
const fields = ["date_of_culling", "female_cleanup_qty", "male_cleanup_qty", "body_weight", "buyer_name", "hauler_name", "hauler_plate_number", "remarks"] as const;
const columns = ["#", "Building", "Cycle #", "Age", "Date of Culling", "Female", "Male", "Body Weights", "Buyer Name", "Hauler Name", "Plate Number", "Remarks"];
const emptyRow = (cycleKey: string): RowInput => ({ cycleKey, date_of_culling: new Date().toLocaleDateString("en-CA"), body_weight: "", buyer_name: "", hauler_name: "", hauler_plate_number: "", remarks: "", female_cleanup_qty: "", male_cleanup_qty: "" });
const amount = parseCullingQuantity;
function displayAmount(value: string) { const parsed = amount(value); return Number.isFinite(parsed) ? parsed : 0; }

export default function CleanupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const cleanupId = Number(search.get("id") ?? 0);
  const isEdit = Number.isInteger(cleanupId) && cleanupId > 0;
  const { setValue } = useGlobalContext();
  const [farms, setFarms] = useState<BreederFarm[]>([]);
  const [farmId, setFarmId] = useState("");
  const [groups, setGroups] = useState<CullingBuilding[]>([]);
  const [rows, setRows] = useState<Record<number, RowInput>>({});
  const [record, setRecord] = useState<BreederCleanupRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addAnother, setAddAnother] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const saveRequest = useRef<{ snapshot: string; key: string } | null>(null);

  useEffect(() => { void refreshSessionx(router); }, [router]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([isEdit ? getBreederCleanupById(cleanupId) : Promise.resolve(null), listBreederFarms(), getUserInfo().catch(() => [])])
      .then(async ([saved, farmRows, defaults]) => {
        const memberIds = saved ? saved.cycle_ids ?? [saved.cycle_id] : undefined;
        const cycles = await listBreederCleanupCycles(memberIds);
        if (cancelled) return;
        const options = groupCullingBuildings(cycles.filter(cycle => saved ? memberIds!.includes(cycle.id) : !!cycle.placement_date));
        if (saved && options.length) {
          options[0] = { ...options[0], cycle_id: saved.cycle_id, female_system_balance: saved.female_system_balance, male_system_balance: saved.male_system_balance };
          setRows({ [saved.building_id]: { ...emptyRow(options[0].key), date_of_culling: saved.date_of_culling ?? "", body_weight: saved.body_weight ?? "", buyer_name: saved.buyer_name ?? "", hauler_name: saved.hauler_name ?? "", hauler_plate_number: saved.hauler_plate_number ?? "", remarks: saved.remarks ?? "", female_cleanup_qty: saved.female_cleanup_qty.toLocaleString("en-US"), male_cleanup_qty: saved.male_cleanup_qty.toLocaleString("en-US") } });
        }
        if (saved && !options.length) throw new Error("The saved building cycles could not be loaded.");
        setRecord(saved); setGroups(options); setFarms(farmRows);
        setFarmId(String(saved?.farm_id ?? farmRows.find(farm => farm.id === Number(defaults[0]?.id))?.id ?? farmRows[0]?.id ?? ""));
      }).catch(loadError => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load Terminal Culling buildings."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cleanupId, isEdit]);
  useEffect(() => setValue("loading_g", loading || saving), [loading, saving, setValue]);

  const buildingRows = useMemo(() => {
    const buildings = new Map<number, CullingBuilding[]>();
    for (const group of groups.filter(group => String(group.farm_id) === farmId)) buildings.set(group.building_id, [...(buildings.get(group.building_id) ?? []), group]);
    return [...buildings.entries()].map(([id, options]) => {
      const row = rows[id] ?? emptyRow(options[0].key);
      return { row, options, building: options.find(option => option.key === row.cycleKey) ?? options[0] };
    });
  }, [farmId, groups, rows]);
  function updateRow(building: CullingBuilding, field: keyof RowInput, value: string) {
    setRows(current => ({ ...current, [building.building_id]: { ...(current[building.building_id] ?? emptyRow(building.key)), [field]: value } }));
  }
  function updateQuantity(building: CullingBuilding, field: keyof RowInput, event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const raw = input.value;
    const digitsBeforeCursor = raw.slice(0, input.selectionStart ?? raw.length).replace(/\D/g, "").length;
    const formatted = formatCullingQuantity(raw.replaceAll(",", ""));
    updateRow(building, field, formatted);
    let cursor = 0;
    let digits = 0;
    while (cursor < formatted.length && digits < digitsBeforeCursor) {
      if (/\d/.test(formatted[cursor])) digits++;
      cursor++;
    }
    requestAnimationFrame(() => {
      if (document.activeElement === input) input.setSelectionRange(cursor, cursor);
    });
  }
  function moveCell(event: KeyboardEvent<HTMLInputElement>, row: number, column: number) {
    const offset = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[event.key];
    if (!offset) return;
    const input = tableRef.current?.querySelector<HTMLInputElement>(`[data-grid-row="${row + offset[0]}"][data-grid-column="${column + offset[1]}"]`);
    if (!input || input.disabled) return;
    event.preventDefault(); input.focus(); if (input.type !== "date") input.select();
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const inputs: BreederCleanupInput[] = [];
      for (const { building, row } of buildingRows) {
        const female = amount(row.female_cleanup_qty), male = amount(row.male_cleanup_qty);
        if (![female, male].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error(`${building.building_name}: culling quantities must be non-negative whole numbers.`);
        if (female + male === 0) continue;
        inputs.push({ cycle_id: building.cycle_id, cycle_ids: building.cycle_ids, record_scope: record?.record_scope ?? "building", female_cleanup_qty: female, male_cleanup_qty: male, date_of_culling: row.date_of_culling || null, body_weight: row.body_weight || null, buyer_name: row.buyer_name || null, hauler_name: row.hauler_name || null, hauler_plate_number: row.hauler_plate_number || null, remarks: row.remarks || null });
      }
      if (!inputs.length) throw new Error("Enter culling quantities for at least one building.");
      if (isEdit) await updateBreederCleanup(cleanupId, inputs[0]);
      else {
        const snapshot = JSON.stringify(inputs);
        if (saveRequest.current?.snapshot !== snapshot) saveRequest.current = { snapshot, key: crypto.randomUUID() };
        await createBreederCleanups(inputs, saveRequest.current.key); saveRequest.current = null;
        if (addAnother) {
          setRows({});
          setSuccess(`${inputs.length} building record${inputs.length === 1 ? "" : "s"} saved.`);
          const refreshed = await listBreederCleanupCycles();
          setGroups(groupCullingBuildings(refreshed.filter(cycle => !!cycle.placement_date)));
          return;
        }
      }
      router.push("/jmb/cleanup"); router.refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save Terminal Culling."); }
    finally { setSaving(false); }
  }
  const totals = buildingRows.reduce((sum, { building, row }) => {
    const female = displayAmount(row.female_cleanup_qty), male = displayAmount(row.male_cleanup_qty);
    return sum.map((value, index) => value + [building.female_system_balance, female, building.female_system_balance - female, building.male_system_balance, male, building.male_system_balance - male][index]);
  }, [0, 0, 0, 0, 0, 0]);

  return <div className="min-h-screen bg-slate-100 p-2 dark:bg-background">
    <form onSubmit={submit} className="overflow-hidden rounded-lg border bg-white dark:bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div><h1 className="text-lg font-semibold">{isEdit ? "Edit" : "New"} Breeder Terminal Culling</h1><p className="text-xs text-muted-foreground">{buildingRows.length} building{buildingRows.length === 1 ? "" : "s"}</p></div>
        <div className="flex items-center gap-2">{!isEdit && <Label className="mr-2 flex gap-2 font-normal"><Checkbox checked={addAnother} onCheckedChange={value => setAddAnother(value === true)} disabled={saving} />Add another</Label>}<Button type="button" variant="outline" onClick={() => router.push("/jmb/cleanup")} disabled={saving}><X className="size-4" />Cancel</Button><Button type="submit" disabled={loading || saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? "Saving..." : isEdit ? "Update" : "Save"}</Button></div>
      </header>
      <fieldset disabled={loading || saving} className="min-w-0 space-y-4 p-3">
        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}
        <div className="max-w-md space-y-2"><Label>Breeder Farm</Label>{isEdit ? <div className="rounded-md border bg-muted/30 px-3 py-2">{farms.find(farm => String(farm.id) === farmId)?.name ?? farmId}</div> : <SearchableCombobox items={farms.map(farm => ({ code: String(farm.id), name: farm.name }))} value={farmId} onValueChange={value => { setFarmId(value); setRows({}); }} placeholder="Select breeder farm" className="w-full" />}</div>
        <section className="space-y-3"><div><h2 className="text-sm font-medium">Population Record</h2><p className="text-xs text-muted-foreground">Enter one row per building. Age is calculated from placement to Date of Culling. Condemn Variance is balance minus culling quantity and may be negative.</p></div>
          <div className="max-h-[520px] w-full overflow-auto bg-white dark:bg-card">
            <table ref={tableRef} className="fc-grid-table min-w-[1490px] w-full table-fixed border-separate border-spacing-0 caption-bottom text-sm">
              <colgroup>{[50, 100, 50, 45, 110, 96, 96, 96, 96, 96, 96, 85, 100, 100, 90, undefined].map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
              <thead>
                <tr style={{ height: 28 }}>{columns.map((label, index) => {
                  const grouped = label === "Female" || label === "Male";
                  return <th key={label} scope={grouped ? "colgroup" : "col"} colSpan={grouped ? 3 : 1} rowSpan={grouped ? 1 : 2} style={index === 1 ? { left: 50 } : undefined} className={`fc-grid-header fc-grid-header-border fc-grid-border-r sticky top-0 px-1 text-center text-xs font-semibold leading-tight ${label === "Female" ? "!bg-pink-100 !text-pink-900" : label === "Male" ? "!bg-sky-100 !text-sky-900" : ""} ${index === 0 ? "left-0 z-40" : index === 1 ? "z-40 fc-grid-age-header" : "z-30"}`}>{label}</th>;
                })}</tr>
                <tr style={{ height: 36 }}>{["Female", "Male"].flatMap(sex => ["Balance", "Culling Qty", "Condemn Variance"].map(label => <th key={sex + label} scope="col" className={`fc-grid-header fc-grid-header-border fc-grid-border-r sticky top-[28px] z-30 px-1 text-center text-xs font-semibold leading-tight ${sex === "Female" ? "!bg-pink-100 !text-pink-900" : "!bg-sky-100 !text-sky-900"}`}>{label}</th>))}</tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={16} className="h-32 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></td></tr>}
                {!loading && buildingRows.map(({ building, row, options }, rowIndex) => {
                  const divider = rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider";
                  const read = `fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 text-center text-xs ${divider}`;
                  const edit = `fc-grid-cell fc-grid-cell-editable fc-grid-border-r p-0 ${divider}`;
                  const renderInput = (field: typeof fields[number], column: number, type = "text") => <td key={field} className={edit}><Input aria-label={`${field.replaceAll("_", " ")} for ${building.building_name}`} type={type === "number" ? "text" : type} inputMode={type === "number" ? "numeric" : undefined} onBlur={type === "number" ? () => updateRow(building, field, formatCullingQuantity(row[field])) : undefined} value={row[field]} data-grid-row={rowIndex} data-grid-column={column} onChange={event => type === "number" ? updateQuantity(building, field, event) : updateRow(building, field, event.target.value)} onKeyDown={event => moveCell(event, rowIndex, column)} onFocus={event => { if (type !== "date") event.target.select(); }} className="h-8 min-w-0 rounded-none border-0 bg-transparent px-1 text-center text-xs shadow-none focus-visible:ring-0" /></td>;
                  return <tr key={building.building_id} className="fc-grid-row border-0">
                    <td className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r sticky left-0 z-20 p-0 text-center text-xs font-semibold tabular-nums ${divider}`}><div className="flex h-8 items-center justify-center">{rowIndex + 1}</div></td>
                    <td style={{ left: 50 }} className={`fc-grid-age sticky z-20 px-1 text-center text-xs font-semibold ${divider}`}>{building.building_name}</td>
                    <td className={read}>{isEdit || options.length === 1 ? building.cycle_no : <select aria-label={`Cycle for ${building.building_name}`} value={building.key} onChange={event => setRows(current => ({ ...current, [building.building_id]: emptyRow(event.target.value) }))} className="h-8 w-full bg-transparent text-center">{options.map(option => <option key={option.key} value={option.key}>{option.cycle_no}</option>)}</select>}</td>
                    <td className={read}>{cullingAge(building.placement_date, row.date_of_culling) ?? "-"}</td>
                    {renderInput("date_of_culling", 0, "date")}
                    <td className={read}>{building.female_system_balance.toLocaleString("en-US")}</td>{renderInput("female_cleanup_qty", 1, "number")}<td className={read}>{(building.female_system_balance - displayAmount(row.female_cleanup_qty)).toLocaleString("en-US")}</td>
                    <td className={read}>{building.male_system_balance.toLocaleString("en-US")}</td>{renderInput("male_cleanup_qty", 2, "number")}<td className={read}>{(building.male_system_balance - displayAmount(row.male_cleanup_qty)).toLocaleString("en-US")}</td>
                    {fields.slice(3).map((field, index) => renderInput(field, index + 3))}
                  </tr>;
                })}
                {!loading && !buildingRows.length && <tr><td colSpan={16} className="h-24 text-center text-muted-foreground">No active building placements found.</td></tr>}
              </tbody>
              <tfoot><tr><td className="fc-grid-footer-cell sticky bottom-0 left-0 z-40 h-9 px-1 text-center font-semibold">#</td><td style={{ left: 50 }} className="fc-grid-footer-cell fc-grid-footer-age sticky bottom-0 z-40 px-1 text-center font-semibold">Total</td><td colSpan={3} className="fc-grid-footer-cell sticky bottom-0 text-center text-xs">{buildingRows.length} building{buildingRows.length === 1 ? "" : "s"}</td>{totals.map((value, index) => <td key={index} className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0 text-center font-semibold tabular-nums">{value.toLocaleString("en-US")}</td>)}<td colSpan={5} className="fc-grid-footer-cell sticky bottom-0" /></tr></tfoot>
            </table>
          </div>
        </section>
      </fieldset>
    </form>
  </div>;
}
