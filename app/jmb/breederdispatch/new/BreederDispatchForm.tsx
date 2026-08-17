"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bird, Loader2, Save, Send, Truck, X } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  createBreederDispatch,
  getBreederDispatchById,
  getDefaultFarm,
  listAvailableBreederFlocks,
  updateBreederDispatch,
  type AvailableBreederFlock,
  type BreederDispatchInput,
  type BreederDispatchLine,
  type DispatchStatus,
} from "./api";

const today = () => new Date().toLocaleDateString("en-CA");

type FormState = {
  dispatch_date: string;
  farm_id: string;
  destination: string;
  hauler_name: string;
  plate_number: string;
  truck_seal: string;
  remarks: string;
};

type QuantityState = Record<number, { male: string; female: string; remarks: string }>;

const initialForm = (): FormState => ({
  dispatch_date: today(),
  farm_id: "",
  destination: "",
  hauler_name: "",
  plate_number: "",
  truck_seal: "",
  remarks: "",
});

function number(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function BreederDispatchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setValue } = useGlobalContext();
  const dispatchId = Number(searchParams.get("id"));
  const isEdit = Number.isInteger(dispatchId) && dispatchId > 0;
  const [form, setForm] = useState<FormState>(initialForm);
  const [flocks, setFlocks] = useState<AvailableBreederFlock[]>([]);
  const [quantities, setQuantities] = useState<QuantityState>({});
  const [documentNo, setDocumentNo] = useState("");
  const [status, setStatus] = useState<DispatchStatus>("Draft");
  const [loading, setLoading] = useState(true);
  const [loadingFlocks, setLoadingFlocks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const readOnly = isEdit && status !== "Draft";

  useEffect(() => { void refreshSessionx(router); }, [router]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const request = isEdit ? getBreederDispatchById(dispatchId) : getDefaultFarm();
    request
      .then((result) => {
        if (cancelled) return;
        if (isEdit) {
          const record = result as Awaited<ReturnType<typeof getBreederDispatchById>>;
          setDocumentNo(record.document_no);
          setStatus(record.status);
          setForm({
            dispatch_date: record.dispatch_date.slice(0, 10),
            farm_id: String(record.farm_id),
            destination: record.destination,
            hauler_name: record.hauler_name ?? "",
            plate_number: record.plate_number ?? "",
            truck_seal: record.truck_seal ?? "",
            remarks: record.remarks ?? "",
          });
          setQuantities(Object.fromEntries(record.lines.map((line) => [line.placement_id, {
            male: String(line.male_qty), female: String(line.female_qty), remarks: line.remarks ?? "",
          }])));
          if (record.status !== "Draft") {
            setFlocks(record.lines.map((line) => ({
              ...lineToFlock(line),
              farm_id: record.farm_id,
              farm_code: record.farm_code,
              farm_name: record.farm_name,
            })));
          }
        } else {
          const defaultFarm = result as Awaited<ReturnType<typeof getDefaultFarm>>;
          if (defaultFarm?.id) setForm((current) => ({ ...current, farm_id: String(defaultFarm.id) }));
        }
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) setError("Unable to load breeder dispatch details.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dispatchId, isEdit]);

  useEffect(() => {
    if (loading || readOnly || !form.dispatch_date) return;
    let cancelled = false;
    setLoadingFlocks(true);
    listAvailableBreederFlocks(form.dispatch_date)
      .then((rows) => {
        if (cancelled) return;
        setFlocks(rows);
        setForm((current) => {
          if (current.farm_id && rows.some((row) => String(row.farm_id) === current.farm_id)) return current;
          return { ...current, farm_id: rows[0] ? String(rows[0].farm_id) : "" };
        });
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) setError("Unable to load available breeder flock cards.");
      })
      .finally(() => { if (!cancelled) setLoadingFlocks(false); });
    return () => { cancelled = true; };
  }, [form.dispatch_date, loading, readOnly]);
  useEffect(() => setValue("loading_g", loading || loadingFlocks || saving), [loading, loadingFlocks, saving, setValue]);

  const farms = useMemo(() => {
    const unique = new Map<number, AvailableBreederFlock>();
    flocks.forEach((flock) => unique.set(flock.farm_id, flock));
    return [...unique.values()].sort((a, b) => a.farm_name.localeCompare(b.farm_name));
  }, [flocks]);
  const farmOptions = farms.map((farm) => ({
    code: String(farm.farm_id),
    name: farm.farm_code ? `${farm.farm_code} - ${farm.farm_name}` : farm.farm_name,
  }));
  const selectedFarm = farms.find((farm) => String(farm.farm_id) === form.farm_id) ?? flocks.find((flock) => String(flock.farm_id) === form.farm_id) ?? null;
  const farmFlocks = useMemo(() => flocks.filter((flock) => String(flock.farm_id) === form.farm_id), [flocks, form.farm_id]);
  const selectedLines = useMemo(() => farmFlocks.filter((flock) => {
    const quantity = quantities[flock.id];
    return number(quantity?.male) + number(quantity?.female) > 0;
  }), [farmFlocks, quantities]);
  const totals = selectedLines.reduce((total, flock) => ({
    male: total.male + number(quantities[flock.id]?.male),
    female: total.female + number(quantities[flock.id]?.female),
  }), { male: 0, female: 0 });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateQuantity(placementId: number, key: "male" | "female" | "remarks", value: string) {
    setQuantities((current) => ({
      ...current,
      [placementId]: { ...(current[placementId] ?? { male: "0", female: "0", remarks: "" }), [key]: value },
    }));
  }

  function validate() {
    if (!form.dispatch_date || !form.farm_id) return "Dispatch date and breeder farm are required.";
    if (!form.destination.trim()) return "Destination is required.";
    if (!selectedLines.length) return "Enter a male or female dispatch quantity for at least one flock card.";
    for (const flock of selectedLines) {
      const male = number(quantities[flock.id]?.male);
      const female = number(quantities[flock.id]?.female);
      if (![male, female].every((value) => Number.isInteger(value) && value >= 0)) return "Dispatch quantities must be non-negative whole numbers.";
      if (male > flock.male_available || female > flock.female_available) return `Quantity exceeds the available birds in ${flock.building_no} / ${flock.pen_no}.`;
    }
    return "";
  }

  function payload(): BreederDispatchInput {
    if (!selectedFarm) throw new Error("Select a breeder farm.");
    return {
      dispatch_date: form.dispatch_date,
      farm_id: selectedFarm.farm_id,
      farm_code: selectedFarm.farm_code,
      farm_name: selectedFarm.farm_name,
      destination: form.destination.trim(),
      hauler_name: form.hauler_name.trim() || null,
      plate_number: form.plate_number.trim() || null,
      truck_seal: form.truck_seal.trim() || null,
      remarks: form.remarks.trim() || null,
      lines: selectedLines.map((flock, index) => ({
        line_no: index + 1,
        placement_id: flock.id,
        placement_date: flock.placement_date,
        building_id: flock.building_id,
        building_name: flock.building_no,
        pen_id: flock.pen_id,
        pen_name: flock.pen_no,
        dr_no: flock.dr_no || null,
        male_available: flock.male_available,
        female_available: flock.female_available,
        male_qty: number(quantities[flock.id]?.male),
        female_qty: number(quantities[flock.id]?.female),
        avg_body_weight_male: flock.avg_body_weight_male,
        avg_body_weight_female: flock.avg_body_weight_female,
        remarks: quantities[flock.id]?.remarks.trim() || null,
      })),
    };
  }

  async function save(post: boolean) {
    if (readOnly) return;
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    if (post && !window.confirm("Post this dispatch? Posted quantities will be applied to the breeder flock cards.")) return;
    setSaving(true); setError("");
    try {
      const input = payload();
      if (isEdit) await updateBreederDispatch(dispatchId, input, post);
      else await createBreederDispatch(input, post);
      router.push("/jmb/breederdispatch");
      router.refresh();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Unable to save breeder dispatch.");
    } finally { setSaving(false); }
  }

  return (
    <div className="h-screen w-full bg-slate-100 p-4 dark:bg-background">
      <form onSubmit={(event) => { event.preventDefault(); void save(false); }} className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
        <header className="shrink-0 border-b bg-white px-4 py-3 dark:bg-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Breeder / Dispatch</div><h1 className="truncate text-lg font-semibold">{readOnly ? "View Breeder Dispatch" : isEdit ? "Edit Breeder Dispatch" : "New Breeder Dispatch"}</h1><p className="truncate text-xs text-muted-foreground">{selectedFarm?.farm_name || "Select breeder farm"}{documentNo ? ` · ${documentNo}` : ""}{isEdit ? ` · ${status}` : ""}</p></div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/jmb/breederdispatch")} disabled={saving}><X className="size-4" />{readOnly ? "Close" : "Cancel"}</Button>
              {!readOnly ? <><Button type="submit" variant="outline" disabled={saving || loading}><Save className="size-4" />Save draft</Button><Button type="button" onClick={() => void save(true)} disabled={saving || loading}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Post dispatch</Button></> : null}
            </div>
          </div>
        </header>

        <fieldset disabled={loading || loadingFlocks || saving || readOnly} className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 dark:bg-background/40">
          <div className="mx-auto max-w-[1800px] overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card">
            {error ? <div className="m-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {loading ? <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading dispatch...</div> : (
              <>
                <section className="space-y-4 p-5">
                  <SectionHeading icon={<Bird className="size-4" />} title="Dispatch Details" description="Select the dispatch date and the breeder farm whose flock cards will be issued." />
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Dispatch date" required><Input type="date" value={form.dispatch_date} onChange={(event) => { update("dispatch_date", event.target.value); setQuantities({}); }} /></Field>
                    <Field label="Breeder farm" required><SearchableCombobox items={farmOptions} value={form.farm_id} onValueChange={(value) => { update("farm_id", value); setQuantities({}); }} placeholder="Select farm" showCode className="w-full" /></Field>
                    <Field label="Destination" required><Input value={form.destination} onChange={(event) => update("destination", event.target.value)} maxLength={200} placeholder="Delivery destination" /></Field>
                  </div>
                </section>
                <Divider />
                <section className="space-y-4 p-5">
                  <SectionHeading icon={<Truck className="size-4" />} title="Transport" description="Record delivery and vehicle traceability using the same details as the Broiler delivery workflow." />
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Hauler"><Input value={form.hauler_name} onChange={(event) => update("hauler_name", event.target.value)} maxLength={150} /></Field>
                    <Field label="Plate number"><Input value={form.plate_number} onChange={(event) => update("plate_number", event.target.value)} maxLength={50} /></Field>
                    <Field label="Truck seal"><Input value={form.truck_seal} onChange={(event) => update("truck_seal", event.target.value)} maxLength={50} /></Field>
                  </div>
                </section>
                <Divider />
                <section className="space-y-4 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><SectionHeading icon={<Bird className="size-4" />} title="Flock-card Allocation" description="Enter whole-bird quantities. Availability includes placement balance and posted flock-card activity through the dispatch date." /><div className="grid grid-cols-3 gap-2 text-right text-sm"><Summary label="Male" value={totals.male} /><Summary label="Female" value={totals.female} /><Summary label="Total" value={totals.male + totals.female} /></div></div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table className="min-w-[1050px]"><TableHeader><TableRow><TableHead>Building / pen</TableHead><TableHead>Placement / DR</TableHead><TableHead className="text-right">Male available</TableHead><TableHead className="w-36">Male dispatch</TableHead><TableHead className="text-right">Female available</TableHead><TableHead className="w-36">Female dispatch</TableHead><TableHead>Line remarks</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {loadingFlocks ? <TableRow><TableCell colSpan={7} className="h-28 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : null}
                        {!loadingFlocks && farmFlocks.map((flock) => <TableRow key={flock.id}><TableCell><div className="font-medium">{flock.building_no}</div><div className="text-xs text-muted-foreground">Pen {flock.pen_no}</div></TableCell><TableCell><div>{flock.placement_date}</div><div className="text-xs text-muted-foreground">{flock.dr_no || `Placement ${flock.id}`}</div></TableCell><TableCell className="text-right tabular-nums">{flock.male_available.toLocaleString()}</TableCell><TableCell><Input type="number" min="0" max={flock.male_available} step="1" value={quantities[flock.id]?.male ?? ""} onChange={(event) => updateQuantity(flock.id, "male", event.target.value)} placeholder="0" /></TableCell><TableCell className="text-right tabular-nums">{flock.female_available.toLocaleString()}</TableCell><TableCell><Input type="number" min="0" max={flock.female_available} step="1" value={quantities[flock.id]?.female ?? ""} onChange={(event) => updateQuantity(flock.id, "female", event.target.value)} placeholder="0" /></TableCell><TableCell><Input value={quantities[flock.id]?.remarks ?? ""} onChange={(event) => updateQuantity(flock.id, "remarks", event.target.value)} maxLength={250} /></TableCell></TableRow>)}
                        {!loadingFlocks && !farmFlocks.length ? <TableRow><TableCell colSpan={7} className="h-28 text-center text-muted-foreground">No breeder flock cards have available birds for this farm and date.</TableCell></TableRow> : null}
                      </TableBody>
                    </Table>
                  </div>
                </section>
                <Divider />
                <section className="p-5"><Field label="Dispatch remarks"><Textarea value={form.remarks} onChange={(event) => update("remarks", event.target.value)} maxLength={500} className="min-h-20" /></Field></section>
              </>
            )}
          </div>
        </fieldset>
      </form>
    </div>
  );
}

function lineToFlock(line: BreederDispatchLine): AvailableBreederFlock {
  return {
    id: line.placement_id, created_at: "", created_by: null, updated_at: null, updated_by: null,
    placement_date: line.placement_date, dr_no: line.dr_no ?? "", file_attached: null,
    farm_id: 0, farm_code: null, farm_name: "", building_id: line.building_id, pen_id: line.pen_id,
    building_no: line.building_name, pen_no: line.pen_name, f_source: null, f_beg: line.female_available,
    f_doa: 0, f_reject: 0, f_shortcount: 0, f_endingbalance: line.female_available, f_remarks: null,
    m_source: null, m_beg: line.male_available, m_doa: 0, m_reject: 0, m_shortcount: 0,
    m_endingbalance: line.male_available, m_remarks: null, avg_bodyw: null, remarks: null,
    male_available: line.male_available, female_available: line.female_available,
    avg_body_weight_male: line.avg_body_weight_male, avg_body_weight_female: line.avg_body_weight_female,
  };
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-2"><Label required={required}>{label}</Label>{children}</div>;
}
function SectionHeading({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div><h3 className="flex items-center gap-2 text-sm font-medium">{icon}{title}</h3><p className="text-xs text-muted-foreground">{description}</p></div>;
}
function Divider() { return <div className="h-px bg-border" />; }
function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border bg-muted/20 px-3 py-2"><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold tabular-nums">{value.toLocaleString()}</div></div>;
}
