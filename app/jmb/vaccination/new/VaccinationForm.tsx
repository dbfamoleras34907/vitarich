"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Save, ShieldCheck, X } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { createVaccination, getDefaultFarm, getVaccinationById, listVaccinationLocations, updateVaccination, VACCINATION_ROUTES, type FarmLocation, type VaccinationScope } from "./api";

const today = () => new Date().toLocaleDateString("en-CA");
type FormState = {
  vaccination_date: string; farm_id: string; scope: VaccinationScope; building_id: string;
  vaccine_brand: string; vaccine_type: string; disease_target: string; dosage: string; unit: string; route: string;
  booster_no: string; next_dose_date: string; batch_number: string; manufacturing_date: string; expiry_date: string;
  birds_before: string; birds_vaccinated: string; birds_missed: string; administered_by: string; supervised_by: string; remarks: string;
  cold_chain_verified: boolean; label_verified: boolean; expiry_verified: boolean;
};
const initialForm = (): FormState => ({
  vaccination_date: today(), farm_id: "", scope: "Farm", building_id: "", vaccine_brand: "", vaccine_type: "",
  disease_target: "", dosage: "", unit: "", route: "", booster_no: "1", next_dose_date: "", batch_number: "",
  manufacturing_date: "", expiry_date: "", birds_before: "0", birds_vaccinated: "0", birds_missed: "0",
  administered_by: "", supervised_by: "", remarks: "", cold_chain_verified: false, label_verified: false, expiry_verified: false,
});

export default function VaccinationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setValue } = useGlobalContext();
  const vaccinationId = Number(searchParams.get("id"));
  const isEdit = Number.isInteger(vaccinationId) && vaccinationId > 0;
  const [locations, setLocations] = useState<FarmLocation[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [selectedPenIds, setSelectedPenIds] = useState<number[]>([]);
  const [addAnother, setAddAnother] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [documentNo, setDocumentNo] = useState("");
  const [recordStatus, setRecordStatus] = useState<"Posted" | "Cancelled" | "">("");
  const readOnly = isEdit && recordStatus === "Cancelled";

  useEffect(() => { void refreshSessionx(router); }, [router]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listVaccinationLocations(),
      isEdit ? getVaccinationById(vaccinationId) : getDefaultFarm().catch(() => null),
    ])
      .then(([rows, recordOrDefaultFarm]) => {
        if (cancelled) return;
        setLocations(rows);
        if (isEdit) {
          const record = recordOrDefaultFarm as Awaited<ReturnType<typeof getVaccinationById>>;
          setDocumentNo(record.document_no);
          setRecordStatus(record.status);
          setForm({
            vaccination_date: record.vaccination_date.slice(0, 10),
            farm_id: String(record.farm_id),
            scope: record.scope,
            building_id: record.building_id == null ? "" : String(record.building_id),
            vaccine_brand: record.vaccine_brand,
            vaccine_type: record.vaccine_type,
            disease_target: record.disease_target,
            dosage: String(record.dosage),
            unit: record.unit,
            route: record.route,
            booster_no: String(record.booster_no),
            next_dose_date: record.next_dose_date?.slice(0, 10) ?? "",
            batch_number: record.batch_number,
            manufacturing_date: record.manufacturing_date?.slice(0, 10) ?? "",
            expiry_date: record.expiry_date.slice(0, 10),
            birds_before: String(record.birds_before),
            birds_vaccinated: String(record.birds_vaccinated),
            birds_missed: String(record.birds_missed),
            administered_by: record.administered_by ?? "",
            supervised_by: record.supervised_by ?? "",
            remarks: record.remarks ?? "",
            cold_chain_verified: record.cold_chain_verified,
            label_verified: record.label_verified,
            expiry_verified: record.expiry_verified,
          });
          setSelectedPenIds(record.targets.map((target) => target.pen_id));
          return;
        }
        const defaultFarm = recordOrDefaultFarm as Awaited<ReturnType<typeof getDefaultFarm>>;
        const defaultId = Number(defaultFarm?.id);
        setForm((current) => ({ ...current, farm_id: String(rows.some((row) => row.farm_id === defaultId) ? defaultId : rows[0]?.farm_id ?? "") }));
      })
      .catch((loadError) => { console.error(loadError); if (!cancelled) setError("Unable to load breeder locations."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isEdit, vaccinationId]);
  useEffect(() => setValue("loading_g", loading || saving), [loading, saving, setValue]);

  const farms = useMemo(() => {
    const unique = new Map<number, FarmLocation>(); locations.forEach((row) => unique.set(row.farm_id, row));
    return [...unique.values()].sort((a, b) => a.farm_name.localeCompare(b.farm_name));
  }, [locations]);
  const buildings = useMemo(() => {
    const unique = new Map<number, FarmLocation>();
    locations.filter((row) => String(row.farm_id) === form.farm_id).forEach((row) => unique.set(row.building_id, row));
    return [...unique.values()].sort((a, b) => a.building_name.localeCompare(b.building_name, undefined, { numeric: true }));
  }, [form.farm_id, locations]);
  const pens = useMemo(() => locations.filter((row) => String(row.building_id) === form.building_id)
    .filter((row, index, all) => all.findIndex((candidate) => candidate.pen_id === row.pen_id) === index)
    .sort((a, b) => a.pen_name.localeCompare(b.pen_name, undefined, { numeric: true })), [form.building_id, locations]);
  const farmOptions = farms.map((farm) => ({ code: String(farm.farm_id), name: farm.farm_code ? `${farm.farm_code} - ${farm.farm_name}` : farm.farm_name }));
  const buildingOptions = buildings.map((building) => ({ code: String(building.building_id), name: building.building_code ? `${building.building_code} - ${building.building_name}` : building.building_name }));
  const selectedFarm = farms.find((farm) => String(farm.farm_id) === form.farm_id) ?? null;
  const selectedBuilding = buildings.find((building) => String(building.building_id) === form.building_id) ?? null;
  const targetPenCount = form.scope === "All Pens" ? pens.length : form.scope === "Selected Pens" ? selectedPenIds.length : 0;
  const locationSummary = form.scope === "Farm"
    ? "Entire farm"
    : form.scope === "Building"
      ? selectedBuilding?.building_name || "Select building"
      : `${selectedBuilding?.building_name || "Select building"} · ${targetPenCount} pen${targetPenCount === 1 ? "" : "s"}`;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function setScope(scope: VaccinationScope) { setForm((current) => ({ ...current, scope, building_id: scope === "Farm" ? "" : current.building_id })); setSelectedPenIds([]); }
  function togglePen(id: number, checked: boolean) { setSelectedPenIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)); }

  function validate() {
    if (!form.vaccination_date || !form.farm_id) return "Date and farm are required.";
    if (form.scope !== "Farm" && !form.building_id) return "Building is required.";
    if (form.scope === "Selected Pens" && !selectedPenIds.length) return "Select at least one pen.";
    if (form.scope === "All Pens" && !pens.length) return "The selected building has no pens.";
    if (!form.vaccine_brand.trim() || !form.vaccine_type.trim() || !form.disease_target.trim()) return "Vaccine brand, type, and disease target are required.";
    if (!(Number(form.dosage) > 0) || !form.unit.trim() || !form.route) return "Valid dosage, unit, and route are required.";
    if (!(Number(form.booster_no) > 0)) return "Dose/booster number must be greater than zero.";
    if (!form.batch_number.trim() || !form.expiry_date) return "Batch number and expiry date are required.";
    if (form.expiry_date < form.vaccination_date) return "Expired vaccine cannot be recorded.";
    if (form.manufacturing_date && form.manufacturing_date > form.expiry_date) return "Manufacturing date cannot be after expiry date.";
    const before = Number(form.birds_before), vaccinated = Number(form.birds_vaccinated), missed = Number(form.birds_missed);
    if ([before, vaccinated, missed].some((value) => !Number.isInteger(value) || value < 0)) return "Bird counts must be non-negative whole numbers.";
    if (vaccinated + missed > before) return "Vaccinated plus missed birds cannot exceed birds before vaccination.";
    if (!form.label_verified || !form.expiry_verified || !form.cold_chain_verified) return "Complete all vaccine safety verifications before posting.";
    return "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); if (readOnly) return; const validationError = validate(); if (validationError) { setError(validationError); return; }
    const farm = farms.find((row) => String(row.farm_id) === form.farm_id)!;
    const building = buildings.find((row) => String(row.building_id) === form.building_id) ?? null;
    const targetPens = form.scope === "All Pens" ? pens : form.scope === "Selected Pens" ? pens.filter((pen) => selectedPenIds.includes(pen.pen_id)) : [];
    setSaving(true); setError(""); setSuccess("");
    try {
      const payload = {
        vaccination_date: form.vaccination_date, farm_id: farm.farm_id, farm_code: farm.farm_code, farm_name: farm.farm_name,
        scope: form.scope, building_id: building?.building_id ?? null, building_code: building?.building_code ?? null, building_name: building?.building_name ?? null,
        vaccine_brand: form.vaccine_brand.trim(), vaccine_type: form.vaccine_type.trim(), disease_target: form.disease_target.trim(), dosage: Number(form.dosage),
        unit: form.unit.trim(), route: form.route, booster_no: Number(form.booster_no), next_dose_date: form.next_dose_date || null,
        batch_number: form.batch_number.trim(), manufacturing_date: form.manufacturing_date || null, expiry_date: form.expiry_date,
        birds_before: Number(form.birds_before), birds_vaccinated: Number(form.birds_vaccinated), birds_missed: Number(form.birds_missed),
        administered_by: form.administered_by.trim() || null, supervised_by: form.supervised_by.trim() || null,
        cold_chain_verified: form.cold_chain_verified, label_verified: form.label_verified, expiry_verified: form.expiry_verified,
        remarks: form.remarks.trim() || null,
        targets: targetPens.map((pen) => ({ building_id: pen.building_id, building_code: pen.building_code, building_name: pen.building_name, pen_id: pen.pen_id, pen_code: pen.pen_code, pen_name: pen.pen_name })),
      };
      const saved = isEdit
        ? await updateVaccination(vaccinationId, payload)
        : await createVaccination(payload);
      if (isEdit || !addAnother) { router.push("/jmb/vaccination"); router.refresh(); return; }
      setSuccess(`${saved.document_no} was added.`);
      setForm((current) => ({ ...initialForm(), vaccination_date: current.vaccination_date, farm_id: current.farm_id, scope: current.scope, building_id: current.building_id, administered_by: current.administered_by }));
      setSelectedPenIds([]);
    } catch (saveError) { console.error(saveError); setError(saveError instanceof Error ? saveError.message : "Unable to save vaccination."); }
    finally { setSaving(false); }
  }

  return (
    <div className="h-screen w-full bg-slate-100 p-4 dark:bg-background">
      <form onSubmit={submit} className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
        <header className="shrink-0 border-b bg-white px-4 py-3 dark:bg-card">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Farm / Vaccination</div>
                  <h1 className="truncate text-lg font-semibold text-foreground">{readOnly ? "View Vaccination" : isEdit ? "Edit Vaccination" : "New Vaccination"}</h1>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedFarm?.farm_name || "Select farm"} &gt; {locationSummary}
                    {form.disease_target ? ` · ${form.disease_target}` : ""}
                    {documentNo ? ` · ${documentNo}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {!isEdit ? <Label className="mr-2 flex cursor-pointer gap-2 font-normal"><Checkbox checked={addAnother} onCheckedChange={(checked) => setAddAnother(checked === true)} />Add another</Label> : null}
                  <Button type="button" variant="outline" onClick={() => router.push("/jmb/vaccination")} disabled={saving}><X className="size-4" />{readOnly ? "Close" : "Cancel"}</Button>
                  {!readOnly ? <Button type="submit" disabled={saving || loading}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? "Saving..." : isEdit ? "Update" : "Save"}</Button> : null}
                </div>
              </div>
        </header>

        <fieldset disabled={loading || saving || readOnly} className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 [scrollbar-color:#a8a29e_transparent] [scrollbar-width:thin] dark:bg-background/40 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-400/70 [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="mx-auto max-w-[1800px] overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm dark:border-border dark:bg-card">
            {error ? <div className="m-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="m-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

            <section className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Vaccination date" required><Input type="date" value={form.vaccination_date} onChange={(e) => update("vaccination_date", e.target.value)} /></Field>
              <Field label="Breeder farm" required><SearchableCombobox items={farmOptions} value={form.farm_id} onValueChange={(value) => { update("farm_id", value); update("building_id", ""); setSelectedPenIds([]); }} placeholder="Select farm" showCode className="w-full" /></Field>
              <Field label="Disease target" required><Input value={form.disease_target} onChange={(e) => update("disease_target", e.target.value)} placeholder="Disease or pathogen target" maxLength={200} /></Field>
            </section>

            <SectionDivider />
            <section className="space-y-4 p-5">
              <SectionHeading title="Vaccination Coverage" description="Choose the farm, building, or pens covered by this vaccination." />
              <RadioGroup value={form.scope} onValueChange={(value) => setScope(value as VaccinationScope)} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(["Farm", "Building", "Selected Pens", "All Pens"] as VaccinationScope[]).map((scope) => <Label key={scope} className="flex cursor-pointer gap-3 rounded-md border bg-slate-50 p-3 font-normal dark:bg-background/40"><RadioGroupItem value={scope} />{scope}</Label>)}</RadioGroup>
              {form.scope !== "Farm" ? <div className="max-w-xl"><Field label="Building" required><SearchableCombobox items={buildingOptions} value={form.building_id} onValueChange={(value) => { update("building_id", value); setSelectedPenIds([]); }} placeholder="Select building" showCode className="w-full" /></Field></div> : null}
              {form.scope === "All Pens" && form.building_id ? <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">All {pens.length} current pen{pens.length === 1 ? "" : "s"} will be included.</div> : null}
              {form.scope === "Selected Pens" && form.building_id ? <div className="grid max-h-52 gap-2 overflow-y-auto rounded-md border bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 dark:bg-background/40">{pens.map((pen) => <Label key={pen.pen_id} className="flex cursor-pointer gap-2 rounded-md border bg-white p-3 font-normal dark:bg-card"><Checkbox checked={selectedPenIds.includes(pen.pen_id)} onCheckedChange={(checked) => togglePen(pen.pen_id, checked === true)} />{pen.pen_code ? `${pen.pen_code} - ` : ""}{pen.pen_name}</Label>)}</div> : null}
            </section>

            <SectionDivider />
            <section className="space-y-4 p-5">
              <SectionHeading title="Vaccine Details" description="Record product, dosage, route, schedule, and batch traceability." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Vaccine brand" required><Input value={form.vaccine_brand} onChange={(e) => update("vaccine_brand", e.target.value)} placeholder="Vaccine brand" maxLength={150} /></Field>
                <Field label="Vaccine type" required><Input value={form.vaccine_type} onChange={(e) => update("vaccine_type", e.target.value)} placeholder="Live, inactivated, recombinant..." maxLength={100} /></Field>
                <Field label="Batch / lot number" required><Input value={form.batch_number} onChange={(e) => update("batch_number", e.target.value)} maxLength={100} /></Field>
                <Field label="Dosage" required><Input type="number" min="0" step="any" value={form.dosage} onChange={(e) => update("dosage", e.target.value)} /></Field>
                <Field label="Unit" required><Input value={form.unit} onChange={(e) => update("unit", e.target.value)} placeholder="e.g. dose/bird, mL/bird" maxLength={100} /></Field>
                <Field label="Route" required><Select value={form.route} onValueChange={(value) => update("route", value)}><SelectTrigger className="w-full"><SelectValue placeholder="Select route" /></SelectTrigger><SelectContent>{VACCINATION_ROUTES.map((route) => <SelectItem key={route} value={route}>{route}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Dose / booster number" required><Input type="number" min="1" step="1" value={form.booster_no} onChange={(e) => update("booster_no", e.target.value)} /></Field>
                <Field label="Next dose date"><Input type="date" min={form.vaccination_date} value={form.next_dose_date} onChange={(e) => update("next_dose_date", e.target.value)} /></Field>
                <Field label="Manufacturing date"><Input type="date" value={form.manufacturing_date} onChange={(e) => update("manufacturing_date", e.target.value)} /></Field>
                <Field label="Expiry date" required><Input type="date" min={form.vaccination_date} value={form.expiry_date} onChange={(e) => update("expiry_date", e.target.value)} /></Field>
              </div>
            </section>

            <SectionDivider />
            <section className="space-y-4 p-5">
              <SectionHeading title="Bird Reconciliation" description="Reconcile the flock population covered by this activity." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Birds before" required><Input type="number" min="0" step="1" value={form.birds_before} onChange={(e) => update("birds_before", e.target.value)} /></Field>
                <Field label="Birds vaccinated" required><Input type="number" min="0" step="1" value={form.birds_vaccinated} onChange={(e) => update("birds_vaccinated", e.target.value)} /></Field>
                <Field label="Birds missed" required><Input type="number" min="0" step="1" value={form.birds_missed} onChange={(e) => update("birds_missed", e.target.value)} /></Field>
              </div>
            </section>

            <SectionDivider />
            <section className="space-y-4 p-5">
              <SectionHeading title="Administration and Verification" description="Identify responsible personnel and complete the required vaccine checks." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Administered by"><Input value={form.administered_by} onChange={(e) => update("administered_by", e.target.value)} maxLength={150} /></Field>
                <Field label="Supervised by"><Input value={form.supervised_by} onChange={(e) => update("supervised_by", e.target.value)} maxLength={150} /></Field>
                <Field label="Remarks" wide><Textarea value={form.remarks} onChange={(e) => update("remarks", e.target.value)} maxLength={500} className="min-h-20" /></Field>
              </div>
              <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-amber-900"><ShieldCheck className="size-4" />Required safety verification</div><div className="grid gap-3 md:grid-cols-3">{([['label_verified','Product and label verified'],['expiry_verified','Batch and expiry verified'],['cold_chain_verified','Cold chain verified']] as const).map(([key, label]) => <Label key={key} className="flex cursor-pointer gap-2 font-normal text-amber-950"><Checkbox checked={form[key]} onCheckedChange={(checked) => update(key, checked === true)} />{label}</Label>)}</div></div>
            </section>
          </div>
        </fieldset>
      </form>
    </div>
  );
}

function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return <div className={`space-y-2 ${wide ? "md:col-span-2" : ""}`}><Label required={required}>{label}</Label>{children}</div>;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div><h3 className="text-sm font-medium">{title}</h3><p className="text-xs text-muted-foreground">{description}</p></div>;
}

function SectionDivider() {
  return <div className="h-px bg-border" />;
}
