"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Save, X } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  createBreederCleanups,
  getBreederCleanupById,
  getUserInfo,
  listBreederFarms,
  listBreederCleanupCycles,
  listBreederCleanupPenBalances,
  listFarmLocationLookup,
  updateBreederCleanup,
  type BreederFarm,
  type BreederCleanupCycle,
  type BreederCleanupInput,
  type BreederCleanupPenBalance,
  type FarmLocationLookup,
} from "./api";

type CleanupRowInput = {
  female_cleanup_qty: string;
  male_cleanup_qty: string;
  reason: string;
  remarks: string;
};

const emptyRow = (): CleanupRowInput => ({
  female_cleanup_qty: "",
  male_cleanup_qty: "",
  reason: "",
  remarks: "",
});

function quantity(value: string) {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function validQuantity(value: string) {
  const parsed = quantity(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CleanupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setValue } = useGlobalContext();
  const cleanupId = Number(searchParams.get("id") ?? 0);
  const isEdit = Number.isInteger(cleanupId) && cleanupId > 0;
  const [cycles, setCycles] = useState<BreederCleanupCycle[]>([]);
  const [penBalances, setPenBalances] = useState<BreederCleanupPenBalance[]>([]);
  const [farms, setFarms] = useState<BreederFarm[]>([]);
  const [locations, setLocations] = useState<FarmLocationLookup[]>([]);
  const [farmId, setFarmId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [rows, setRows] = useState<Record<number, CleanupRowInput>>({});
  const [editingCycleId, setEditingCycleId] = useState<number | null>(null);
  const [addAnother, setAddAnother] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { void refreshSessionx(router); }, [router]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const recordPromise = isEdit ? getBreederCleanupById(cleanupId) : Promise.resolve(null);
    Promise.all([
      recordPromise,
      listBreederFarms(),
      listFarmLocationLookup(),
      getUserInfo().catch(() => []),
      listBreederCleanupPenBalances(),
    ])
      .then(async ([record, farmRows, locationRows, defaultFarmRows, balanceRows]) => {
        const options = await listBreederCleanupCycles(record?.cycle_id);
        if (cancelled) return;
        setFarms(farmRows);
        setLocations(locationRows);
        setPenBalances(balanceRows);
        const normalized = record ? options.map((cycle) => cycle.id === record.cycle_id ? {
          ...cycle,
          female_system_balance: record.female_system_balance,
          male_system_balance: record.male_system_balance,
        } : cycle) : options;
        setCycles(normalized);
        if (record) {
          const cycle = normalized.find((item) => item.id === record.cycle_id);
          setEditingCycleId(record.cycle_id);
          setFarmId(String(record.farm_id));
          setBuildingId(String(record.building_id));
          setRows({
            [record.pen_id]: {
              female_cleanup_qty: String(record.female_cleanup_qty),
              male_cleanup_qty: String(record.male_cleanup_qty),
              reason: record.reason,
              remarks: record.remarks ?? "",
            },
          });
          if (!cycle) setError("The clean-up cycle is no longer available.");
          return;
        }
        const defaultFarmId = Number(defaultFarmRows[0]?.id);
        const preferredFarm = farmRows.find((farm) => farm.id === defaultFarmId) ?? farmRows[0];
        const preferredFarmId = preferredFarm ? String(preferredFarm.id) : "";
        const preferredBuilding = locationRows.find((location) => String(location.farm_id) === preferredFarmId);
        setFarmId(preferredFarmId);
        setBuildingId(preferredBuilding ? String(preferredBuilding.building_id) : "");
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) setError("Unable to load breeder clean-up locations.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cleanupId, isEdit]);
  useEffect(() => setValue("loading_g", loading || saving), [loading, saving, setValue]);

  const buildings = useMemo(() => {
    const unique = new Map<number, FarmLocationLookup>();
    locations.filter((location) => String(location.farm_id) === farmId).forEach((location) => unique.set(location.building_id, location));
    return [...unique.values()].sort((left, right) => left.building_name.localeCompare(right.building_name, undefined, { numeric: true }));
  }, [farmId, locations]);
  const penRows = useMemo(() => {
    const unique = new Map<number, FarmLocationLookup>();
    locations
      .filter((location) => String(location.farm_id) === farmId && String(location.building_id) === buildingId)
      .forEach((location) => unique.set(location.pen_id, location));
    return [...unique.values()]
      .map((location) => {
        const matchingCycles = cycles.filter((item) => item.pen_id === location.pen_id && item.farm_id === location.farm_id && item.building_id === location.building_id);
        const cycle = matchingCycles.find((item) => item.id === editingCycleId) ?? matchingCycles.find((item) => item.status.toLowerCase() === "active") ?? matchingCycles[0] ?? null;
        const liveBalance = penBalances.find((item) => item.pen_id === location.pen_id && item.farm_id === location.farm_id && item.building_id === location.building_id) ?? null;
        const editingBalance = cycle?.id === editingCycleId ? {
          farm_id: location.farm_id,
          building_id: location.building_id,
          pen_id: location.pen_id,
          female_system_balance: cycle.female_system_balance,
          male_system_balance: cycle.male_system_balance,
        } : null;
        const balance = editingBalance ?? liveBalance;
        return {
          location,
          cycle: cycle && balance ? { ...cycle, female_system_balance: balance.female_system_balance, male_system_balance: balance.male_system_balance } : cycle,
          balance,
        };
      })
      .sort((left, right) => left.location.pen_name.localeCompare(right.location.pen_name, undefined, { numeric: true }));
  }, [buildingId, cycles, editingCycleId, farmId, locations, penBalances]);
  const farmOptions = farms.map((farm) => ({ code: String(farm.id), name: farm.code ? `${farm.code} - ${farm.name}` : farm.name }));
  const buildingOptions = buildings.map((building) => ({ code: String(building.building_id), name: building.building_name }));
  const selectedFarm = farms.find((farm) => String(farm.id) === farmId) ?? null;
  const selectedBuilding = buildings.find((building) => String(building.building_id) === buildingId) ?? null;

  function rowValue(cycleId: number) {
    return rows[cycleId] ?? emptyRow();
  }
  function updateRow(cycleId: number, key: keyof CleanupRowInput, value: string) {
    setRows((current) => ({ ...current, [cycleId]: { ...(current[cycleId] ?? emptyRow()), [key]: value } }));
  }
  function setFarm(value: string) {
    const firstBuilding = locations.find((location) => String(location.farm_id) === value);
    setFarmId(value);
    setBuildingId(firstBuilding ? String(firstBuilding.building_id) : "");
    setRows({});
  }
  function setBuilding(value: string) {
    setBuildingId(value);
    setRows({});
  }

  function handleCleanupGridKeyDown(event: React.KeyboardEvent<HTMLTableElement>) {
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    const offset = movement[event.key];
    if (!offset) return;

    const target = event.target as HTMLElement;
    const currentCell = target.closest("td");
    const currentRow = currentCell?.parentElement;
    const tableBody = currentRow?.parentElement;
    if (!currentCell || !currentRow || !tableBody || tableBody.tagName !== "TBODY") return;

    const tableRows = Array.from(tableBody.querySelectorAll("tr"));
    const rowCells = Array.from(currentRow.querySelectorAll("td"));
    const rowIndex = tableRows.indexOf(currentRow as HTMLTableRowElement);
    const columnIndex = rowCells.indexOf(currentCell as HTMLTableCellElement);
    const nextRow = tableRows[rowIndex + offset[0]];
    let nextColumnIndex = columnIndex + offset[1];
    let nextInput: HTMLInputElement | null = null;
    while (nextRow && nextColumnIndex >= 0 && nextColumnIndex < rowCells.length) {
      const nextCell = nextRow.querySelectorAll("td")[nextColumnIndex];
      nextInput = nextCell?.querySelector<HTMLInputElement>("input:not([disabled])") ?? null;
      if (nextInput || offset[1] === 0) break;
      nextColumnIndex += offset[1];
    }
    if (!nextInput) return;

    event.preventDefault();
    nextInput.focus();
    nextInput.select();
  }

  function rowPayload(item: { location: FarmLocationLookup; cycle: BreederCleanupCycle | null }): BreederCleanupInput | null {
    const { location, cycle } = item;
    const row = rowValue(location.pen_id);
    const female = quantity(row.female_cleanup_qty);
    const male = quantity(row.male_cleanup_qty);
    if (Number.isNaN(female) || Number.isNaN(male)) throw new Error(`Pen ${location.pen_name}: quantities must be non-negative whole numbers.`);
    if (female + male <= 0) return null;
    if (!cycle) throw new Error(`Pen ${location.pen_name}: no active breeder cycle or placement was found.`);
    if (female > cycle.female_system_balance) throw new Error(`Pen ${location.pen_name}: female clean-up quantity exceeds the system balance.`);
    if (male > cycle.male_system_balance) throw new Error(`Pen ${location.pen_name}: male clean-up quantity exceeds the system balance.`);
    if (cycle.female_system_balance - female !== 0 || cycle.male_system_balance - male !== 0) {
      throw new Error(`Pen ${location.pen_name}: female and male balances must both be zero before saving.`);
    }
    if (!row.reason.trim()) throw new Error(`Pen ${location.pen_name}: reason is required.`);
    return { cycle_id: cycle.id, female_cleanup_qty: female, male_cleanup_qty: male, reason: row.reason.trim(), remarks: row.remarks.trim() || null };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      if (!farmId || !buildingId) throw new Error("Breeder farm and building are required.");
      const inputs = penRows.map(rowPayload).filter((input): input is BreederCleanupInput => input !== null);
      if (!inputs.length) throw new Error("Enter a female or male clean-up quantity for at least one pen.");
      if (isEdit) {
        const current = inputs.find((input) => input.cycle_id === editingCycleId);
        if (!current || inputs.length !== 1) throw new Error("Only the original pen can be updated from this record.");
        await updateBreederCleanup(cleanupId, current);
      } else {
        const saved = await createBreederCleanups(inputs);
        if (addAnother) {
          setSuccess(`${saved.length} clean-up record${saved.length === 1 ? "" : "s"} saved.`);
          setRows({});
          return;
        }
      }
      router.push("/jmb/cleanup");
      router.refresh();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Unable to save breeder clean-up.");
    } finally { setSaving(false); }
  }

  return (
    <div className="h-screen w-full bg-slate-100 p-4 dark:bg-background">
      <form onSubmit={submit} className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
        <header className="shrink-0 border-b bg-white px-4 py-3 dark:bg-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Farm / Breeder Clean-Up</div><h1 className="truncate text-lg font-semibold text-foreground">{isEdit ? "Edit Breeder Clean-Up" : "New Breeder Clean-Up"}</h1><p className="truncate text-xs text-muted-foreground">{selectedFarm?.name || "Select farm"} &gt; {selectedBuilding?.building_name || "Select building"} · {penRows.length} pen{penRows.length === 1 ? "" : "s"}</p></div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {!isEdit ? <Label className="mr-2 flex cursor-pointer gap-2 font-normal"><Checkbox checked={addAnother} onCheckedChange={(checked) => setAddAnother(checked === true)} />Add another</Label> : null}
              <Button type="button" variant="outline" onClick={() => router.push("/jmb/cleanup")} disabled={saving}><X className="size-4" />Cancel</Button>
              <Button type="submit" disabled={saving || loading}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? "Saving..." : isEdit ? "Update" : "Save"}</Button>
            </div>
          </div>
        </header>

        <fieldset disabled={loading || saving} className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 [scrollbar-color:#a8a29e_transparent] [scrollbar-width:thin] dark:bg-background/40 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-400/70 [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="mx-auto max-w-[1800px] overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm dark:border-border dark:bg-card">
            {error ? <div className="m-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="m-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

            <section className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              <Field label="Breeder Farm" required>{isEdit ? <ReadOnlyValue value={selectedFarm?.name || `Farm ${farmId}`} /> : <SearchableCombobox items={farmOptions} value={farmId} onValueChange={setFarm} placeholder="Select breeder farm" showCode className="w-full" />}</Field>
              <Field label="Building" required>{isEdit ? <ReadOnlyValue value={selectedBuilding?.building_name || `Building ${buildingId}`} /> : <SearchableCombobox items={buildingOptions} value={buildingId} onValueChange={setBuilding} placeholder="Select building" showCode={false} className="w-full" />}</Field>
            </section>

            <SectionDivider />
            <section className="space-y-3 p-5">
              <SectionHeading title="Population Record" description="Enter clean-up quantities, reason, and remarks for each pen. Blank rows will not be saved." />
              <div className="overflow-x-auto border border-slate-300 bg-white">
                <table
                  className="w-full min-w-[1600px] table-fixed border-collapse text-sm"
                  onKeyDownCapture={handleCleanupGridKeyDown}
                >
                  <thead><tr>
                    <th className="w-[130px] border-b border-r border-slate-300 bg-slate-100 px-2 py-2 text-left font-semibold">Pen #</th>
                    <th className="w-[100px] border-b border-r border-slate-300 bg-slate-100 px-2 py-2 text-left font-semibold">Cycle #</th>
                    <th className="w-[190px] border-b border-r border-slate-300 !bg-pink-100 px-2 py-2 text-left font-semibold text-pink-900">Female Total Inventory Balance</th>
                    <th className="w-[165px] border-b border-r border-slate-300 !bg-pink-100 px-2 py-2 text-left font-semibold text-pink-900">Female Clean-up Qty</th>
                    <th className="w-[165px] border-b border-r border-slate-300 !bg-pink-100 px-2 py-2 text-left font-semibold text-pink-900">Female Balance</th>
                    <th className="w-[190px] border-b border-r border-slate-300 !bg-sky-100 px-2 py-2 text-left font-semibold text-sky-900">Male Total Inventory Balance</th>
                    <th className="w-[165px] border-b border-r border-slate-300 !bg-sky-100 px-2 py-2 text-left font-semibold text-sky-900">Male Clean-up Qty</th>
                    <th className="w-[165px] border-b border-r border-slate-300 !bg-sky-100 px-2 py-2 text-left font-semibold text-sky-900">Male Balance</th>
                    <th className="w-[210px] border-b border-r border-slate-300 bg-slate-100 px-2 py-2 text-left font-semibold">Reason</th>
                    <th className="w-[240px] border-b border-slate-300 bg-slate-100 px-2 py-2 text-left font-semibold">Remarks</th>
                  </tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={10} className="h-32 text-center text-muted-foreground"><Loader2 className="mx-auto size-5 animate-spin" /></td></tr> : null}
                    {!loading && penRows.map(({ location, cycle, balance }) => {
                      const row = rowValue(location.pen_id);
                      const locked = isEdit && cycle?.id !== editingCycleId;
                      const femaleBalance = balance?.female_system_balance ?? cycle?.female_system_balance ?? 0;
                      const maleBalance = balance?.male_system_balance ?? cycle?.male_system_balance ?? 0;
                      const femaleCleanup = quantity(row.female_cleanup_qty);
                      const maleCleanup = quantity(row.male_cleanup_qty);
                      return <tr key={location.pen_id}>
                        <td className="h-10 border-b border-r border-slate-300 bg-slate-100 px-2"><div className="font-semibold">{location.pen_name}</div><div className="text-[10px] text-muted-foreground">{cycle ? "Active placement" : balance ? "Cycle not linked" : "No active placement"}</div></td>
                        <td className="h-10 border-b border-r border-slate-300 bg-slate-100 px-2 font-semibold tabular-nums">{cycle?.cycle_no ?? "-"}</td>
                        <BalanceCell value={femaleBalance} tone="female" />
                        <InputCell value={row.female_cleanup_qty} onChange={(value) => updateRow(location.pen_id, "female_cleanup_qty", value)} max={femaleBalance} disabled={locked} tone="female" />
                        <CalculatedBalanceCell value={Number.isFinite(femaleCleanup) ? femaleBalance - femaleCleanup : femaleBalance} tone="female" />
                        <BalanceCell value={maleBalance} tone="male" />
                        <InputCell value={row.male_cleanup_qty} onChange={(value) => updateRow(location.pen_id, "male_cleanup_qty", value)} max={maleBalance} disabled={locked} tone="male" />
                        <CalculatedBalanceCell value={Number.isFinite(maleCleanup) ? maleBalance - maleCleanup : maleBalance} tone="male" />
                        <TextCell value={row.reason} onChange={(value) => updateRow(location.pen_id, "reason", value)} placeholder="Enter reason" disabled={locked} />
                        <TextCell value={row.remarks} onChange={(value) => updateRow(location.pen_id, "remarks", value)} placeholder="Optional" disabled={locked} last />
                      </tr>;
                    })}
                    {!loading && !penRows.length ? <tr><td colSpan={10} className="h-32 text-center text-muted-foreground">No pens were found for this building.</td></tr> : null}
                  </tbody>
                  {penRows.length ? <tfoot><tr className="bg-slate-100 font-semibold">
                    <td className="border-r border-t border-slate-300 px-2 py-2">Total</td>
                    <td className="border-r border-t border-slate-300 bg-slate-100 px-2 py-2">-</td>
                    <TotalCell value={penRows.reduce((sum, item) => sum + (item.balance?.female_system_balance ?? item.cycle?.female_system_balance ?? 0), 0)} tone="female" />
                    <TotalCell value={penRows.reduce((sum, item) => sum + validQuantity(rowValue(item.location.pen_id).female_cleanup_qty), 0)} tone="female" />
                    <TotalCell value={penRows.reduce((sum, item) => sum + (item.balance?.female_system_balance ?? item.cycle?.female_system_balance ?? 0) - validQuantity(rowValue(item.location.pen_id).female_cleanup_qty), 0)} tone="female" />
                    <TotalCell value={penRows.reduce((sum, item) => sum + (item.balance?.male_system_balance ?? item.cycle?.male_system_balance ?? 0), 0)} tone="male" />
                    <TotalCell value={penRows.reduce((sum, item) => sum + validQuantity(rowValue(item.location.pen_id).male_cleanup_qty), 0)} tone="male" />
                    <TotalCell value={penRows.reduce((sum, item) => sum + (item.balance?.male_system_balance ?? item.cycle?.male_system_balance ?? 0) - validQuantity(rowValue(item.location.pen_id).male_cleanup_qty), 0)} tone="male" />
                    <td colSpan={2} className="border-t border-slate-300 px-2 py-2 text-muted-foreground">{penRows.filter((item) => validQuantity(rowValue(item.location.pen_id).female_cleanup_qty) + validQuantity(rowValue(item.location.pen_id).male_cleanup_qty) > 0).length} row(s) to save</td>
                  </tr></tfoot> : null}
                </table>
              </div>
            </section>
          </div>
        </fieldset>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <div className="space-y-2"><Label required={required}>{label}</Label>{children}</div>; }
function SectionHeading({ title, description }: { title: string; description: string }) { return <div><h3 className="text-sm font-medium">{title}</h3><p className="text-xs text-muted-foreground">{description}</p></div>; }
function SectionDivider() { return <div className="h-px bg-border" />; }
function ReadOnlyValue({ value }: { value: string }) { return <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm">{value}</div>; }
type ColumnTone = "female" | "male";
function BalanceCell({ value }: { value: number; tone: ColumnTone }) { return <td className="h-10 border-b border-r border-slate-300 bg-slate-100 px-3 text-right font-semibold tabular-nums">{value.toLocaleString()}</td>; }
function CalculatedBalanceCell({ value }: { value: number; tone: ColumnTone }) { return <td className="h-10 border-b border-r border-slate-300 bg-slate-100 px-3 text-right font-semibold tabular-nums">{value.toLocaleString()}</td>; }
function TotalCell({ value }: { value: number; tone: ColumnTone }) { return <td className="border-r border-t border-slate-300 bg-slate-100 px-2 py-2 text-right tabular-nums">{value.toLocaleString()}</td>; }
function InputCell({ value, onChange, max, disabled }: { value: string; onChange: (value: string) => void; max: number; disabled: boolean; tone: ColumnTone }) { return <td className={`h-10 border-b border-r border-slate-300 p-0 ${disabled ? "bg-slate-100" : "bg-white"}`}><Input type="number" min="0" max={max} step="1" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder="0" className="h-10 rounded-none border-0 bg-transparent text-right shadow-none disabled:cursor-not-allowed disabled:opacity-100 focus-visible:ring-2" /></td>; }
function TextCell({ value, onChange, placeholder, disabled, last = false }: { value: string; onChange: (value: string) => void; placeholder: string; disabled: boolean; last?: boolean }) { return <td className={`h-10 border-b border-slate-300 p-0 ${last ? "" : "border-r"} ${disabled ? "bg-slate-100" : "bg-white"}`}><Input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder={placeholder} className="h-10 rounded-none border-0 bg-transparent shadow-none disabled:cursor-not-allowed disabled:opacity-100 focus-visible:ring-2" /></td>; }
