"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListPlus, Loader2, Save, Trash2, X } from "lucide-react";
import { parseCullingQuantity, formatCullingQuantity } from "@/lib/data/queries/cullingQuantity";
import { cullingAge } from "@/lib/data/queries/breederCullingAge";
import { groupCullingBuildings, type CullingBuilding } from "@/lib/data/queries/breederCullingBuildings";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { TableCopyDownCell } from "@/components/ui/TableCopyDownCell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTableCopyDown } from "@/hooks/useTableCopyDown";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { createBreederCleanups, getBreederCleanupById, getUserInfo, listBreederFarms,
  listBreederCleanupCycles, updateBreederCleanup, type BreederFarm, type BreederCleanupInput,
  type BreederCleanupRow } from "./api";

type RowInput = {
  id: string;
  cycleKey: string;
  date_of_culling: string;
  dr_no: string;
  body_weight: string;
  buyer_name: string;
  hauler_name: string;
  hauler_plate_number: string;
  remarks: string;
  female_cleanup_qty: string;
  male_cleanup_qty: string;
};
type CopyColumn = Exclude<keyof RowInput, "id" | "cycleKey">;

const fields: CopyColumn[] = ["date_of_culling", "female_cleanup_qty", "male_cleanup_qty", "dr_no", "body_weight", "buyer_name", "hauler_name", "hauler_plate_number", "remarks"];
const columns = ["#", "Building", "Age", "Date of Culling", "Female", "Male", "TS/DR #", "Body Weights", "Buyer Name", "Hauler Name", "Plate Number", "Remarks", "Action"];
const amount = parseCullingQuantity;
const today = () => new Date().toLocaleDateString("en-CA");
const createRowId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const emptyRow = (dateOfCulling = today()): RowInput => ({ id: createRowId(), cycleKey: "", date_of_culling: dateOfCulling, dr_no: "", body_weight: "", buyer_name: "", hauler_name: "", hauler_plate_number: "", remarks: "", female_cleanup_qty: "", male_cleanup_qty: "" });

function displayAmount(value: string) {
  const parsed = amount(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowHasValue(row: RowInput) {
  // Every new row starts with today's date, so that default alone must not
  // make an unused added row fail the batch save.
  return fields.some(field => field !== "date_of_culling" && row[field].trim() !== "");
}

function quantityLabel(field: CopyColumn) {
  return field === "female_cleanup_qty" ? "Female Culling Qty" : "Male Culling Qty";
}

export default function CleanupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const cleanupId = Number(search.get("id") ?? 0);
  const isEdit = Number.isInteger(cleanupId) && cleanupId > 0;
  const { setValue } = useGlobalContext();
  const [farms, setFarms] = useState<BreederFarm[]>([]);
  const [farmId, setFarmId] = useState("");
  const [groups, setGroups] = useState<CullingBuilding[]>([]);
  const [rows, setRows] = useState<RowInput[]>(() => [emptyRow()]);
  const [record, setRecord] = useState<BreederCleanupRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addAnother, setAddAnother] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const saveRequest = useRef<{ snapshot: string; key: string } | null>(null);

  useEffect(() => {
    // Fast Refresh can retain a duplicated row ID from an earlier component revision.
    setRows(current => {
      const seen = new Set<string>();
      let changed = false;
      const unique = current.map(row => {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          return row;
        }
        changed = true;
        const id = createRowId();
        seen.add(id);
        return { ...row, id };
      });
      return changed ? unique : current;
    });
  }, []);

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
        if (saved && !options.length) throw new Error("The saved building cycles could not be loaded.");
        if (saved) {
          const savedBuilding = options.find(option => option.cycle_ids.includes(saved.cycle_id));
          if (!savedBuilding) throw new Error("The saved building cycle could not be loaded.");
          const adjusted = { ...savedBuilding, cycle_id: saved.cycle_id, female_system_balance: saved.female_system_balance, male_system_balance: saved.male_system_balance };
          const index = options.findIndex(option => option.key === adjusted.key);
          options[index] = adjusted;
          setRows([{
            ...emptyRow(saved.date_of_culling ?? today()), cycleKey: adjusted.key,
            dr_no: saved.dr_no ?? "", body_weight: saved.body_weight ?? "", buyer_name: saved.buyer_name ?? "",
            hauler_name: saved.hauler_name ?? "", hauler_plate_number: saved.hauler_plate_number ?? "",
            remarks: saved.remarks ?? "", female_cleanup_qty: saved.female_cleanup_qty.toLocaleString("en-US"),
            male_cleanup_qty: saved.male_cleanup_qty.toLocaleString("en-US"),
          }]);
        }
        setRecord(saved); setGroups(options); setFarms(farmRows);
        setFarmId(String(saved?.farm_id ?? farmRows.find(farm => farm.id === Number(defaults[0]?.id))?.id ?? farmRows[0]?.id ?? ""));
      }).catch(loadError => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load Terminal Culling buildings."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cleanupId, isEdit]);
  useEffect(() => setValue("loading_g", loading || saving), [loading, saving, setValue]);

  const buildingOptions = useMemo(() => groups.filter(group => String(group.farm_id) === farmId), [farmId, groups]);
  const groupByKey = useMemo(() => new Map(buildingOptions.map(group => [group.key, group])), [buildingOptions]);
  const rowsWithBuildings = useMemo(() => rows.map(row => ({ row, building: groupByKey.get(row.cycleKey) ?? null })), [groupByKey, rows]);

  function updateRow(id: string, field: CopyColumn | "cycleKey", value: string) {
    setRows(current => current.map(row => row.id === id ? { ...row, [field]: value } : row));
  }

  function selectBuilding(id: string, cycleKey: string) {
    // Quantities belong to the former building's inventory and must not carry
    // into a newly selected building.
    setRows(current => current.map(row => row.id === id
      ? { ...row, cycleKey, female_cleanup_qty: "", male_cleanup_qty: "" }
      : row));
  }

  function quantityLimit(building: CullingBuilding, field: CopyColumn) {
    return field === "female_cleanup_qty" ? building.female_system_balance : building.male_system_balance;
  }

  function quantityFits(building: CullingBuilding, field: CopyColumn, value: string) {
    const parsed = amount(value);
    return !Number.isFinite(parsed) || parsed <= quantityLimit(building, field);
  }

  function updateQuantity(row: RowInput, building: CullingBuilding, field: CopyColumn, event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const raw = input.value;
    const digitsBeforeCursor = raw.slice(0, input.selectionStart ?? raw.length).replace(/\D/g, "").length;
    const formatted = formatCullingQuantity(raw.replaceAll(",", ""));
    const parsed = amount(formatted);
    const limit = quantityLimit(building, field);
    if (Number.isFinite(parsed) && parsed > limit) {
      setError(`Row ${rows.findIndex(item => item.id === row.id) + 1}: ${quantityLabel(field)} cannot exceed the available inventory of ${limit.toLocaleString("en-US")}.`);
      return;
    }
    setError("");
    updateRow(row.id, field, formatted);
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

  function isCopyEditable(field: CopyColumn, row: RowInput) {
    return (field !== "female_cleanup_qty" && field !== "male_cleanup_qty") || groupByKey.has(row.cycleKey);
  }

  const copyDown = useTableCopyDown({
    rows,
    columns: fields,
    disabled: loading || saving || isEdit,
    isEditable: isCopyEditable,
    getValue: (field, row) => row[field],
    onCopy: (field, targets, value) => {
      const text = String(value ?? "");
      if (field === "female_cleanup_qty" || field === "male_cleanup_qty") {
        const invalid = targets.find(target => {
          const building = groupByKey.get(target.cycleKey);
          return !building || !quantityFits(building, field, text);
        });
        if (invalid) {
          const building = groupByKey.get(invalid.cycleKey);
          setError(`Row ${rows.findIndex(row => row.id === invalid.id) + 1}: ${quantityLabel(field)} cannot exceed the available inventory of ${(building ? quantityLimit(building, field) : 0).toLocaleString("en-US")}.`);
          return;
        }
      }
      const targetIds = new Set(targets.map(target => target.id));
      setRows(current => current.map(row => targetIds.has(row.id) ? { ...row, [field]: text } : row));
    },
  });

  function copyCellProps(rowIndex: number, field: CopyColumn) {
    return {
      canCopyDown: !isEdit && isCopyEditable(field, rows[rowIndex]) && rows.slice(rowIndex + 1).some(row => isCopyEditable(field, row)),
      onCopyDown: () => copyDown.copyToBottom(rowIndex, fields.indexOf(field)),
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const inputs: BreederCleanupInput[] = [];
      const selectedKeys = new Set<string>();
      for (const [rowIndex, { row, building }] of rowsWithBuildings.entries()) {
        const lineLabel = `Row ${rowIndex + 1}`;
        if (!building) {
          if (rowHasValue(row)) throw new Error(`${lineLabel}: Building is required.`);
          continue;
        }
        if (selectedKeys.has(building.key)) throw new Error(`${lineLabel}: This building and cycle has already been selected.`);
        selectedKeys.add(building.key);
        const female = amount(row.female_cleanup_qty), male = amount(row.male_cleanup_qty);
        if (![female, male].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error(`${lineLabel}: Culling quantities must be non-negative whole numbers.`);
        if (female > building.female_system_balance) throw new Error(`${lineLabel}: Female Culling Qty cannot exceed the available inventory of ${building.female_system_balance.toLocaleString("en-US")}.`);
        if (male > building.male_system_balance) throw new Error(`${lineLabel}: Male Culling Qty cannot exceed the available inventory of ${building.male_system_balance.toLocaleString("en-US")}.`);
        if (female + male === 0) throw new Error(`${lineLabel}: Enter at least one Culling Qty.`);
        inputs.push({ cycle_id: building.cycle_id, cycle_ids: building.cycle_ids, record_scope: record?.record_scope ?? "building", female_cleanup_qty: female, male_cleanup_qty: male, date_of_culling: row.date_of_culling || null, dr_no: row.dr_no || null, body_weight: row.body_weight || null, buyer_name: row.buyer_name || null, hauler_name: row.hauler_name || null, hauler_plate_number: row.hauler_plate_number || null, remarks: row.remarks || null });
      }
      if (!inputs.length) throw new Error("Add at least one Terminal Culling row with a culling quantity.");
      if (isEdit) await updateBreederCleanup(cleanupId, inputs[0]);
      else {
        const snapshot = JSON.stringify(inputs);
        if (saveRequest.current?.snapshot !== snapshot) saveRequest.current = { snapshot, key: crypto.randomUUID() };
        await createBreederCleanups(inputs, saveRequest.current.key); saveRequest.current = null;
        if (addAnother) {
          setRows([emptyRow()]);
          setSuccess(`${inputs.length} Terminal Culling record${inputs.length === 1 ? "" : "s"} saved.`);
          const refreshed = await listBreederCleanupCycles();
          setGroups(groupCullingBuildings(refreshed.filter(cycle => !!cycle.placement_date)));
          return;
        }
      }
      router.push("/jmb/cleanup"); router.refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save Terminal Culling."); }
    finally { setSaving(false); }
  }

  const totals = rowsWithBuildings.reduce((sum, { building, row }) => {
    if (!building) return sum;
    const female = displayAmount(row.female_cleanup_qty), male = displayAmount(row.male_cleanup_qty);
    return sum.map((value, index) => value + [building.female_system_balance, female, building.female_system_balance - female, building.male_system_balance, male, building.male_system_balance - male][index]);
  }, [0, 0, 0, 0, 0, 0]);
  const selectedKeys = new Set(rows.map(row => row.cycleKey).filter(Boolean));

  return <div className="min-h-screen bg-slate-100 p-2 dark:bg-background">
    <form onSubmit={submit} className="overflow-hidden rounded-lg border bg-white dark:bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div><h1 className="text-lg font-semibold">{isEdit ? "Edit" : "New"} Breeder Terminal Culling</h1><p className="text-xs text-muted-foreground">{rows.length} transaction row{rows.length === 1 ? "" : "s"}</p></div>
        <div className="flex items-center gap-2">{!isEdit && <Label className="mr-2 flex gap-2 font-normal"><Checkbox checked={addAnother} onCheckedChange={value => setAddAnother(value === true)} disabled={saving} />Add another</Label>}<Button type="button" variant="outline" onClick={() => router.push("/jmb/cleanup")} disabled={saving}><X className="size-4" />Cancel</Button><Button type="submit" disabled={loading || saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? "Saving..." : isEdit ? "Update" : "Save"}</Button></div>
      </header>
      <fieldset disabled={loading || saving} className="min-w-0 space-y-4 p-3">
        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}
        <div className="max-w-md space-y-2"><Label>Breeder Farm</Label>{isEdit ? <div className="rounded-md border bg-muted/30 px-3 py-2">{farms.find(farm => String(farm.id) === farmId)?.name ?? farmId}</div> : <SearchableCombobox items={farms.map(farm => ({ code: String(farm.id), name: farm.name }))} value={farmId} onValueChange={value => { setFarmId(value); setRows([emptyRow()]); setError(""); }} placeholder="Select breeder farm" className="w-full" />}</div>
        <section className="space-y-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-medium">Population Record</h2><p className="text-xs text-muted-foreground">Select a building for each transaction row. Culling Qty cannot exceed the available Female or Male inventory. Right-click an editable cell and choose Copy down to fill rows below.</p></div>{!isEdit && <Button type="button" variant="outline" size="sm" onClick={() => setRows(current => [...current, emptyRow(current.at(-1)?.date_of_culling)])}><ListPlus className="size-4" />Add Row</Button>}</div>
          <div className="max-h-[520px] w-full overflow-auto bg-white dark:bg-card">
            <table ref={tableRef} className="fc-grid-table min-w-[1650px] w-full table-fixed border-separate border-spacing-0 caption-bottom text-sm">
              <colgroup>{[50, 150, 50, 110, 96, 96, 96, 96, 96, 105, 110, 110, 100, 100, 100, 90, 60].map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
              <thead>
                <tr style={{ height: 28 }}>{columns.map((label, index) => {
                  const grouped = label === "Female" || label === "Male";
                  return <th key={label} scope={grouped ? "colgroup" : "col"} colSpan={grouped ? 3 : 1} rowSpan={grouped ? 1 : 2} style={index === 1 ? { left: 50 } : undefined} className={`fc-grid-header fc-grid-header-border fc-grid-border-r sticky top-0 px-1 text-center text-xs font-semibold leading-tight ${label === "Female" ? "!bg-pink-100 !text-pink-900" : label === "Male" ? "!bg-sky-100 !text-sky-900" : ""} ${index === 0 ? "left-0 z-40" : index === 1 ? "z-40 fc-grid-age-header" : "z-30"}`}>{label}</th>;
                })}</tr>
                <tr style={{ height: 36 }}>{["Female", "Male"].flatMap(sex => ["Balance", "Culling Qty", "Condemn Variance"].map(label => <th key={sex + label} scope="col" className={`fc-grid-header fc-grid-header-border fc-grid-border-r sticky top-[28px] z-30 px-1 text-center text-xs font-semibold leading-tight ${sex === "Female" ? "!bg-pink-100 !text-pink-900" : "!bg-sky-100 !text-sky-900"}`}>{label}</th>))}</tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={17} className="h-32 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></td></tr>}
                {!loading && rowsWithBuildings.map(({ building, row }, rowIndex) => {
                  const divider = rowIndex % 5 === 4 ? "fc-grid-row-divider-strong" : "fc-grid-row-divider";
                  const read = `fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 text-center text-xs ${divider}`;
                  const edit = `fc-grid-cell fc-grid-cell-editable fc-grid-border-r p-0 ${divider}`;
                  const renderInput = (field: CopyColumn, column: number, type = "text") => <TableCopyDownCell key={field} data-copy-down-row={rowIndex} className={edit} {...copyCellProps(rowIndex, field)}><Input aria-label={`Row ${rowIndex + 1} ${field.replaceAll("_", " ")}`} disabled={(field === "female_cleanup_qty" || field === "male_cleanup_qty") && !building} type={type === "number" ? "text" : type} inputMode={type === "number" ? "numeric" : undefined} onBlur={type === "number" ? () => updateRow(row.id, field, formatCullingQuantity(row[field])) : undefined} value={row[field]} data-grid-row={rowIndex} data-grid-column={column} onChange={event => type === "number" && building ? updateQuantity(row, building, field, event) : updateRow(row.id, field, event.target.value)} onKeyDown={event => moveCell(event, rowIndex, column)} onFocus={event => { if (type !== "date") event.target.select(); }} className="h-8 min-w-0 rounded-none border-0 bg-transparent px-1 text-center text-xs shadow-none focus-visible:ring-0" /></TableCopyDownCell>;
                  return <tr key={row.id} className="fc-grid-row border-0">
                    <td className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r sticky left-0 z-20 p-0 text-center text-xs font-semibold tabular-nums ${divider}`}><div className="flex h-8 items-center justify-center">{rowIndex + 1}</div></td>
                    <td style={{ left: 50 }} className={`fc-grid-age sticky z-20 p-0 text-center text-xs font-semibold ${divider}`}><select aria-label={`Building for row ${rowIndex + 1}`} value={row.cycleKey} onChange={event => { selectBuilding(row.id, event.target.value); setError(""); }} className="h-8 w-full bg-transparent px-1 text-center text-xs"><option value="">Select building</option>{buildingOptions.map(option => <option key={option.key} value={option.key} disabled={option.key !== row.cycleKey && selectedKeys.has(option.key)}>{option.building_name}</option>)}</select></td>
                    <td className={read}>{building ? cullingAge(building.placement_date, row.date_of_culling) ?? "-" : "-"}</td>
                    {renderInput("date_of_culling", 0, "date")}
                    <td className={read}>{building?.female_system_balance.toLocaleString("en-US") ?? "-"}</td>{renderInput("female_cleanup_qty", 1, "number")}<td className={read}>{building ? (building.female_system_balance - displayAmount(row.female_cleanup_qty)).toLocaleString("en-US") : "-"}</td>
                    <td className={read}>{building?.male_system_balance.toLocaleString("en-US") ?? "-"}</td>{renderInput("male_cleanup_qty", 2, "number")}<td className={read}>{building ? (building.male_system_balance - displayAmount(row.male_cleanup_qty)).toLocaleString("en-US") : "-"}</td>
                    {fields.slice(3).map((field, index) => renderInput(field, index + 3))}
                    <td className={`fc-grid-cell fc-grid-cell-readonly fc-grid-border-r p-0 text-center ${divider}`}><Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove row ${rowIndex + 1}`} disabled={isEdit || rows.length === 1} onClick={() => setRows(current => current.filter(currentRow => currentRow.id !== row.id))} className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></Button></td>
                  </tr>;
                })}
                {!loading && !buildingOptions.length && <tr><td colSpan={17} className="h-24 text-center text-muted-foreground">No active building placements found for this farm.</td></tr>}
              </tbody>
              <tfoot><tr><td className="fc-grid-footer-cell sticky bottom-0 left-0 z-40 h-9 px-1 text-center font-semibold">#</td><td style={{ left: 50 }} className="fc-grid-footer-cell fc-grid-footer-age sticky bottom-0 z-40 px-1 text-center font-semibold">Total</td><td colSpan={2} className="fc-grid-footer-cell sticky bottom-0 text-center text-xs">{rows.length} row{rows.length === 1 ? "" : "s"}</td>{totals.map((value, index) => <td key={index} className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0 text-center font-semibold tabular-nums">{value.toLocaleString("en-US")}</td>)}<td colSpan={7} className="fc-grid-footer-cell sticky bottom-0" /></tr></tfoot>
            </table>
          </div>
        </section>
      </fieldset>
    </form>
  </div>;
}
