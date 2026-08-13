"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Pill, Plus, Save } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  createMedication,
  getDefaultFarm,
  listMedicationLocations,
  MEDICATION_ROUTES,
  type FarmLocation,
  type MedicationScope,
} from "./api";

const today = () => new Date().toLocaleDateString("en-CA");

type FormState = {
  medication_date: string;
  farm_id: string;
  scope: MedicationScope;
  building_id: string;
  medication_brand: string;
  medication_type: string;
  dosage: string;
  unit: string;
  indication: string;
  treatment_period_days: string;
  route: string;
  prescribed_by: string;
  administered_by: string;
  remarks: string;
};

const initialForm = (): FormState => ({
  medication_date: today(),
  farm_id: "",
  scope: "Farm",
  building_id: "",
  medication_brand: "",
  medication_type: "",
  dosage: "",
  unit: "",
  indication: "",
  treatment_period_days: "1",
  route: "",
  prescribed_by: "",
  administered_by: "",
  remarks: "",
});

export default function MedicationForm() {
  const router = useRouter();
  const { setValue } = useGlobalContext();
  const [locations, setLocations] = useState<FarmLocation[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [selectedPenIds, setSelectedPenIds] = useState<number[]>([]);
  const [addAnother, setAddAnother] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMedicationLocations(), getDefaultFarm().catch(() => null)])
      .then(([rows, defaultFarm]) => {
        if (cancelled) return;
        setLocations(rows);
        const defaultId = Number(defaultFarm?.id);
        const available = rows.some((row) => row.farm_id === defaultId);
        const firstFarmId = rows[0]?.farm_id;
        setForm((current) => ({
          ...current,
          farm_id: String(available ? defaultId : firstFarmId ?? ""),
        }));
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) setError("Unable to load breeder farms, buildings, and pens.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => setValue("loading_g", loading || saving), [loading, saving, setValue]);

  const farms = useMemo(() => {
    const unique = new Map<number, FarmLocation>();
    locations.forEach((row) => unique.set(row.farm_id, row));
    return [...unique.values()].sort((a, b) => a.farm_name.localeCompare(b.farm_name));
  }, [locations]);

  const buildings = useMemo(() => {
    const unique = new Map<number, FarmLocation>();
    locations
      .filter((row) => String(row.farm_id) === form.farm_id)
      .forEach((row) => unique.set(row.building_id, row));
    return [...unique.values()].sort((a, b) => a.building_name.localeCompare(b.building_name, undefined, { numeric: true }));
  }, [form.farm_id, locations]);

  const pens = useMemo(
    () =>
      locations
        .filter((row) => String(row.building_id) === form.building_id)
        .filter((row, index, all) => all.findIndex((candidate) => candidate.pen_id === row.pen_id) === index)
        .sort((a, b) => a.pen_name.localeCompare(b.pen_name, undefined, { numeric: true })),
    [form.building_id, locations],
  );

  const farmOptions = farms.map((farm) => ({
    code: String(farm.farm_id),
    name: farm.farm_code ? `${farm.farm_code} - ${farm.farm_name}` : farm.farm_name,
  }));
  const buildingOptions = buildings.map((building) => ({
    code: String(building.building_id),
    name: building.building_code
      ? `${building.building_code} - ${building.building_name}`
      : building.building_name,
  }));

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeFarm(value: string) {
    setForm((current) => ({ ...current, farm_id: value, building_id: "" }));
    setSelectedPenIds([]);
  }

  function changeScope(value: MedicationScope) {
    setForm((current) => ({
      ...current,
      scope: value,
      building_id: value === "Farm" ? "" : current.building_id,
    }));
    setSelectedPenIds([]);
  }

  function togglePen(penId: number, checked: boolean) {
    setSelectedPenIds((current) =>
      checked ? [...new Set([...current, penId])] : current.filter((id) => id !== penId),
    );
  }

  function validate() {
    if (!form.medication_date) return "Date is required.";
    if (!form.farm_id) return "Farm is required.";
    if (form.scope !== "Farm" && !form.building_id) return "Building is required.";
    if (form.scope === "Selected Pens" && selectedPenIds.length === 0) return "Select at least one pen.";
    if (form.scope === "All Pens" && pens.length === 0) return "The selected building has no pens.";
    if (!form.medication_brand.trim()) return "Medication brand is required.";
    if (!form.medication_type.trim()) return "Medication type is required.";
    if (!(Number(form.dosage) > 0)) return "Dosage must be greater than zero.";
    if (!form.unit.trim()) return "Unit is required.";
    if (!form.indication.trim()) return "Indication is required.";
    if (!Number.isInteger(Number(form.treatment_period_days)) || Number(form.treatment_period_days) < 1) {
      return "Treatment period must be at least one whole day.";
    }
    if (!form.route) return "Route is required.";
    return "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const farm = farms.find((row) => String(row.farm_id) === form.farm_id)!;
    const building = buildings.find((row) => String(row.building_id) === form.building_id) ?? null;
    const targetPens = form.scope === "All Pens"
      ? pens
      : form.scope === "Selected Pens"
        ? pens.filter((pen) => selectedPenIds.includes(pen.pen_id))
        : [];

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await createMedication({
        medication_date: form.medication_date,
        farm_id: farm.farm_id,
        farm_code: farm.farm_code,
        farm_name: farm.farm_name,
        scope: form.scope,
        building_id: building?.building_id ?? null,
        building_code: building?.building_code ?? null,
        building_name: building?.building_name ?? null,
        medication_brand: form.medication_brand.trim(),
        medication_type: form.medication_type.trim(),
        dosage: Number(form.dosage),
        unit: form.unit.trim(),
        indication: form.indication.trim(),
        treatment_period_days: Number(form.treatment_period_days),
        route: form.route,
        prescribed_by: form.prescribed_by.trim() || null,
        administered_by: form.administered_by.trim() || null,
        remarks: form.remarks.trim() || null,
        targets: targetPens.map((pen) => ({
          building_id: pen.building_id,
          building_code: pen.building_code,
          building_name: pen.building_name,
          pen_id: pen.pen_id,
          pen_code: pen.pen_code,
          pen_name: pen.pen_name,
        })),
      });

      if (!addAnother) {
        router.push("/jmb/medication");
        router.refresh();
        return;
      }

      setSuccess(`${saved.document_no} was added.`);
      setForm((current) => ({
        ...initialForm(),
        medication_date: current.medication_date,
        farm_id: current.farm_id,
        scope: current.scope,
        building_id: current.building_id,
        route: current.route,
        administered_by: current.administered_by,
      }));
      setSelectedPenIds([]);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Unable to save medication.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-10">
      <div className="mt-4 px-4">
        <Breadcrumb SecondPreviewPageName="Medication" CurrentPageName="Add Medication" />
      </div>

      <form onSubmit={submit} className="mx-auto mt-6 max-w-5xl overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b bg-muted/30 px-6 py-5">
          <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Pill className="size-5" /></div>
          <div>
            <h1 className="text-xl font-semibold">Add medication</h1>
            <p className="text-sm text-muted-foreground">Record a breeder medication by farm, building, or pen.</p>
          </div>
        </div>

        <div className="space-y-7 p-6">
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="size-4" />{success}</div> : null}

          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="medication-date" required>Date</Label><Input id="medication-date" type="date" value={form.medication_date} onChange={(e) => update("medication_date", e.target.value)} /></div>
            <div className="space-y-2"><Label required>Breeder farm</Label><SearchableCombobox items={farmOptions} value={form.farm_id} onValueChange={changeFarm} placeholder={loading ? "Loading farms..." : "Select farm"} showCode className="w-full" /></div>
          </section>

          <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
            <div><h2 className="font-semibold">Medication coverage</h2><p className="text-sm text-muted-foreground">Choose where this medication applies.</p></div>
            <RadioGroup value={form.scope} onValueChange={(value) => changeScope(value as MedicationScope)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(["Farm", "Building", "Selected Pens", "All Pens"] as MedicationScope[]).map((scope) => (
                <Label key={scope} htmlFor={`scope-${scope}`} className="flex cursor-pointer items-center gap-3 rounded-md border bg-background p-3 font-normal">
                  <RadioGroupItem id={`scope-${scope}`} value={scope} />{scope}
                </Label>
              ))}
            </RadioGroup>

            {form.scope !== "Farm" ? (
              <div className="space-y-2"><Label required>Building</Label><SearchableCombobox items={buildingOptions} value={form.building_id} onValueChange={(value) => { update("building_id", value); setSelectedPenIds([]); }} placeholder="Select building" showCode className="w-full" /></div>
            ) : null}

            {form.scope === "All Pens" && form.building_id ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">This medication will be applied to all {pens.length} current pen{pens.length === 1 ? "" : "s"} in the selected building.</div>
            ) : null}

            {form.scope === "Selected Pens" && form.building_id ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label required>Select pens</Label><span className="text-xs text-muted-foreground">{selectedPenIds.length} selected</span></div>
                <div className="grid max-h-52 gap-2 overflow-y-auto rounded-md border bg-background p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pens.map((pen) => (
                    <Label key={pen.pen_id} htmlFor={`pen-${pen.pen_id}`} className="flex cursor-pointer gap-2 rounded-md border p-3 font-normal">
                      <Checkbox id={`pen-${pen.pen_id}`} checked={selectedPenIds.includes(pen.pen_id)} onCheckedChange={(checked) => togglePen(pen.pen_id, checked === true)} />
                      <span>{pen.pen_code ? `${pen.pen_code} - ` : ""}{pen.pen_name}</span>
                    </Label>
                  ))}
                  {!pens.length ? <p className="text-sm text-muted-foreground">No pens found.</p> : null}
                </div>
              </div>
            ) : null}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="brand" required>Medication brand</Label><Input id="brand" maxLength={150} placeholder="Medication brand" value={form.medication_brand} onChange={(e) => update("medication_brand", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="type" required>Medication type</Label><Input id="type" maxLength={100} placeholder="e.g. Antibiotic, vitamin, dewormer" value={form.medication_type} onChange={(e) => update("medication_type", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="dosage" required>Dosage</Label><Input id="dosage" type="number" min="0" step="any" placeholder="Dosage" value={form.dosage} onChange={(e) => update("dosage", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="unit" required>Unit</Label><Input id="unit" maxLength={100} placeholder="e.g. mL/bird, g/L water" value={form.unit} onChange={(e) => update("unit", e.target.value)} /><p className="text-xs text-muted-foreground">{form.unit.length}/100 characters</p></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="indication" required>Indication</Label><Input id="indication" maxLength={250} placeholder="Reason for medication" value={form.indication} onChange={(e) => update("indication", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="period" required>Treatment period (days)</Label><Input id="period" type="number" min="1" step="1" value={form.treatment_period_days} onChange={(e) => update("treatment_period_days", e.target.value)} /></div>
            <div className="space-y-2"><Label required>Route</Label><Select value={form.route} onValueChange={(value) => update("route", value)}><SelectTrigger className="w-full"><SelectValue placeholder="Select route" /></SelectTrigger><SelectContent>{MEDICATION_ROUTES.map((route) => <SelectItem key={route} value={route}>{route}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="prescribed">Prescribed by</Label><Input id="prescribed" maxLength={150} placeholder="Veterinarian or authorized prescriber" value={form.prescribed_by} onChange={(e) => update("prescribed_by", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="administered">Administered by</Label><Input id="administered" maxLength={150} placeholder="Person who administered medication" value={form.administered_by} onChange={(e) => update("administered_by", e.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="remarks">Remarks</Label><Textarea id="remarks" maxLength={500} placeholder="Additional instructions or observations" value={form.remarks} onChange={(e) => update("remarks", e.target.value)} /></div>
          </section>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Label htmlFor="add-another" className="flex cursor-pointer gap-2 font-normal"><Checkbox id="add-another" checked={addAnother} onCheckedChange={(checked) => setAddAnother(checked === true)} />Add another after saving</Label>
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => router.push("/jmb/medication")} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving || loading}>{saving ? <Loader2 className="size-4 animate-spin" /> : addAnother ? <Plus className="size-4" /> : <Save className="size-4" />}{saving ? "Saving..." : "Add medication"}</Button></div>
        </div>
      </form>
    </main>
  );
}
