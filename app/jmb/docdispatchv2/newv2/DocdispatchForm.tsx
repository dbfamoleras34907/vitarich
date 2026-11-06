"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Save, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Breadcrumb from "@/lib/Breadcrumb";
import SearchableDropdown from "@/lib/SearchableDropdown";
import SearchableCombobox from "@/components/SearchableCombobox";
import RequiredLabel from "@/components/RequiredLabel";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import {
  createDispatchDoc,
  generateNextDrNo,
  getDispatchDocById,
  listAvailableDispatchDocItems,
  listDistinctHaulers,
  type DispatchDocAvailability,
  type DispatchDocItemInsert,
  updateDispatchDoc,
} from "./api";
import {
  listBroilerFarmOptions,
  type BroilerFarmOption,
} from "@/lib/data/repositories/farmOptions.client";

type FormState = {
  doc_date: string;
  dr_no: string;
  farm_name: string;
  destination_farm_code: string;
  address: string;
  hauler_name: string;
  hauler_plate_no: string;
  truck_seal_no: string;
  chick_van_temp_c: string;
  number_of_fans: string;
  remarks: string;
};

function todayYMD() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function nonNegativeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function optionalNumber(value: string) {
  return value.trim() === "" ? null : nonNegativeNumber(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value);
}

export default function DocdispatchForm() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = useMemo(() => {
    const id = Number(params.get("id"));
    return Number.isInteger(id) && id > 0 ? id : null;
  }, [params]);
  const isEdit = editId !== null;

  const [form, setForm] = useState<FormState>({
    doc_date: todayYMD(), dr_no: "", farm_name: "", destination_farm_code: "", address: "",
    hauler_name: "", hauler_plate_no: "", truck_seal_no: "", chick_van_temp_c: "", number_of_fans: "", remarks: "",
  });
  const [status, setStatus] = useState<"Draft" | "Posted">("Draft");
  const [rows, setRows] = useState<DispatchDocAvailability[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [haulers, setHaulers] = useState<string[]>([]);
  const [farms, setFarms] = useState<BroilerFarmOption[]>([]);
  const [loading, setLoading] = useState(Boolean(editId));
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState("");
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);

  const readOnly = status === "Posted";
  const selectedBatchSet = useMemo(() => new Set(selectedBatches), [selectedBatches]);
  const selectedItems = useMemo<DispatchDocItemInsert[]>(() => rows.flatMap((row) => {
    if (!selectedBatchSet.has(row.doc_batch_code)) return [];
    const qty = nonNegativeNumber(quantities[row.key] ?? "");
    return qty > 0 ? [{ doc_batch_code: row.doc_batch_code, sku_name: row.sku_name, classification: row.classification, uom: row.uom, qty }] : [];
  }), [quantities, rows, selectedBatchSet]);
  const totalQty = useMemo(() => selectedItems.reduce((total, item) => total + item.qty, 0), [selectedItems]);
  const selectedKeys = useMemo(() => new Set(selectedItems.map((item) => `${item.doc_batch_code}::${item.sku_name}`)), [selectedItems]);
  const batchOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.doc_batch_code)))
    .map((batchCode) => ({ code: batchCode, name: batchCode })), [rows]);
  const visibleRows = useMemo(() => rows.filter((row) => selectedBatchSet.has(row.doc_batch_code)), [rows, selectedBatchSet]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeFarm(code: string, farm: BroilerFarmOption) {
    setForm((current) => ({ ...current, destination_farm_code: code, farm_name: farm.name, address: farm.address ?? "" }));
  }

  function changeSelectedBatches(nextBatches: string[]) {
    const nextBatchSet = new Set(nextBatches);
    setQuantities((current) => Object.fromEntries(Object.entries(current).filter(([key]) => {
      const batchCode = key.split("::", 1)[0];
      return nextBatchSet.has(batchCode);
    })));
    setSelectedBatches(nextBatches);
  }

  function validate() {
    if (!form.doc_date) return "Dispatch date is required.";
    if (!form.dr_no.trim()) return "Delivery Receipt No. is still being generated. Please try again.";
    if (!form.destination_farm_code.trim()) return "Destination Farm is required.";
    if (!selectedItems.length) return "Enter a positive dispatch quantity for at least one DOC line.";
    for (const item of selectedItems) {
      const row = rows.find((candidate) => candidate.key === `${item.doc_batch_code}::${item.sku_name}`);
      if (!row || item.qty > row.available_qty) return `${item.doc_batch_code} / ${item.sku_name} exceeds the available DOC balance.`;
    }
    return "";
  }

  async function save(post: boolean) {
    const validationError = validate();
    if (validationError) { setReviewOpen(false); setError(validationError); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        doc_date: form.doc_date, dr_no: form.dr_no.trim(), farm_name: form.farm_name,
        destination_farm_code: form.destination_farm_code.trim(), address: form.address.trim() || null,
        hauler_name: form.hauler_name.trim() || null, hauler_plate_no: form.hauler_plate_no.trim() || null,
        truck_seal_no: form.truck_seal_no.trim() || null, chick_van_temp_c: optionalNumber(form.chick_van_temp_c),
        number_of_fans: optionalNumber(form.number_of_fans), remarks: form.remarks.trim() || null, items: selectedItems,
      };
      if (editId) await updateDispatchDoc(editId, payload, post);
      else await createDispatchDoc(payload, post);
      router.push("/jmb/docdispatchv2");
      router.refresh();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Unable to save DOC Dispatch.");
    } finally {
      setSaving(false);
    }
  }

  function requestReview() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError("");
    setReviewOpen(true);
  }

  useEffect(() => { refreshSessionx(router); }, [router]);

  useEffect(() => {
    let active = true;
    void Promise.all([listBroilerFarmOptions(), listDistinctHaulers(), listAvailableDispatchDocItems()])
      .then(([farmOptions, haulerOptions, availableRows]) => {
        if (!active) return;
        setFarms(farmOptions); setHaulers(haulerOptions); setRows(availableRows);
      })
      .catch((loadError) => {
        console.error(loadError);
        if (active) setError("Unable to load the dispatchable DOC balance. Refresh and try again.");
      })
      .finally(() => { if (active) setReferenceLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isEdit || !form.doc_date) return;
    let active = true;
    void generateNextDrNo(form.doc_date)
      .then((drNo) => { if (active) updateForm("dr_no", drNo); })
      .catch((generationError) => console.error(generationError));
    return () => { active = false; };
  }, [form.doc_date, isEdit]);

  useEffect(() => {
    if (!editId) return;
    let active = true;
    void getDispatchDocById(editId)
      .then((record) => {
        if (!active || !record) return;
        const { header, items } = record;
        setForm({
          doc_date: header.doc_date, dr_no: header.dr_no ?? "", farm_name: header.farm_name ?? "", destination_farm_code: header.destination_farm_code ?? "", address: header.address ?? "",
          hauler_name: header.hauler_name ?? "", hauler_plate_no: header.hauler_plate_no ?? "", truck_seal_no: header.truck_seal_no ?? "",
          chick_van_temp_c: header.chick_van_temp_c == null ? "" : String(header.chick_van_temp_c), number_of_fans: header.number_of_fans == null ? "" : String(header.number_of_fans), remarks: header.remarks ?? "",
        });
        setStatus(header.status ?? "Draft");
        setQuantities(Object.fromEntries(items.map((item) => [`${item.doc_batch_code}::${item.sku_name}`, String(item.qty ?? 0)])));
        setSelectedBatches(Array.from(new Set(items.map((item) => item.doc_batch_code))));
      })
      .catch((loadError) => { console.error(loadError); if (active) setError("Unable to load this Delivery Receipt."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [editId]);

  return <div className="w-full px-3 py-3 sm:px-4 lg:px-6 lg:py-4">
    <Breadcrumb SecondPreviewPageName="Hatchery" FirstPreviewsPageName="DOC Dispatch" CurrentPageName={readOnly ? "View Delivery Receipt" : isEdit ? "Edit Delivery Receipt" : "New Delivery Receipt"} showTitle={false} />
    <Card className="mt-2 w-full border shadow-sm"><CardContent className="p-0">
      <header className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hatchery / DOC Dispatch</div><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h1 className="text-lg font-semibold tracking-tight">{readOnly ? "Delivery Receipt" : isEdit ? "Edit Delivery Receipt" : "New Delivery Receipt"}</h1><span className="text-xs text-muted-foreground">{form.dr_no || "Generating receipt no."}</span><span className="rounded-full border px-2 py-0.5 text-xs font-medium">{status}</span></div></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => router.push("/jmb/docdispatchv2")} disabled={saving}><X className="size-4" />{readOnly ? "Close" : "Cancel"}</Button>{!readOnly && <><Button type="button" variant="outline" size="sm" onClick={() => void save(false)} disabled={saving || loading || referenceLoading}><Save className="size-4" />Save draft</Button><Button type="button" size="sm" onClick={requestReview} disabled={saving || loading || referenceLoading}><Send className="size-4" />Post</Button></>}</div></header>
      <div className="space-y-4 p-3 sm:p-4">
        {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        {loading ? <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading delivery receipt…</div> : <fieldset disabled={saving || readOnly} className="space-y-4 disabled:opacity-75">
          <section className="rounded-md border bg-card p-3 sm:p-4"><div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><h2 className="text-sm font-semibold">Delivery details</h2><p className="text-xs text-muted-foreground">Select the destination first; transport details are optional.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-1"><Label>Delivery Receipt No.</Label><Input value={form.dr_no} disabled /></div><div className="space-y-1"><RequiredLabel>Date</RequiredLabel><Input type="date" value={form.doc_date} onChange={(event) => updateForm("doc_date", event.target.value)} /></div><div className="space-y-1 xl:col-span-2"><RequiredLabel>Destination Farm</RequiredLabel><SearchableDropdown list={farms} codeLabel="code" nameLabel="name" value={form.destination_farm_code} placeholder="Select Broiler farm" onChange={changeFarm} disabled={referenceLoading} /></div><div className="space-y-1 md:col-span-2"><Label>Address</Label><Input value={form.address} disabled /></div><div className="space-y-1"><Label>Hauler</Label><Input list="hatchery-dispatch-haulers" value={form.hauler_name} onChange={(event) => updateForm("hauler_name", event.target.value)} placeholder="Optional" /><datalist id="hatchery-dispatch-haulers">{haulers.map((hauler) => <option key={hauler} value={hauler} />)}</datalist></div><div className="space-y-1"><Label>Plate number</Label><Input value={form.hauler_plate_no} onChange={(event) => updateForm("hauler_plate_no", event.target.value)} placeholder="Optional" /></div><div className="space-y-1"><Label>Truck seal</Label><Input value={form.truck_seal_no} onChange={(event) => updateForm("truck_seal_no", event.target.value)} placeholder="Optional" /></div><div className="space-y-1"><Label>Chick van temp (°C)</Label><Input type="number" min="0" value={form.chick_van_temp_c} onChange={(event) => updateForm("chick_van_temp_c", event.target.value)} placeholder="Optional" /></div><div className="space-y-1"><Label>No. of fans</Label><Input type="number" min="0" value={form.number_of_fans} onChange={(event) => updateForm("number_of_fans", event.target.value)} placeholder="Optional" /></div></div></section>
          <section className="rounded-md border bg-card"><div className="space-y-3 border-b px-3 py-3 sm:px-4"><div><h2 className="text-sm font-semibold">DOC batch selection</h2><p className="mt-0.5 text-xs text-muted-foreground">Search and select one or more DOC batches. Only selected batches appear in the allocation table.</p></div><SearchableCombobox multiple items={batchOptions} value={selectedBatches} onValueChange={changeSelectedBatches} placeholder="Search and select DOC batches" showSelectionCount disabled={referenceLoading} className="min-h-10 w-full" /></div><div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_220px] sm:p-4"><div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">DOC batch</th><th className="px-3 py-2 text-left font-medium">SKU</th><th className="px-3 py-2 text-right font-medium">Available</th><th className="px-3 py-2 text-left font-medium">UoM</th><th className="w-36 px-3 py-2 text-right font-medium">Dispatch qty</th></tr></thead><tbody className="divide-y">{referenceLoading && <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 size-4 animate-spin" />Loading available DOC…</td></tr>}{!referenceLoading && visibleRows.map((row) => {
            const dispatchQty = nonNegativeNumber(quantities[row.key] ?? "");
            const exceedsAvailable = dispatchQty > row.available_qty;
            return <tr key={row.key} className={selectedKeys.has(row.key) ? "bg-primary/5" : ""}><td className="px-3 py-2 font-medium">{row.doc_batch_code}</td><td className="px-3 py-2">{row.sku_name}</td><td className={`px-3 py-2 text-right tabular-nums ${exceedsAvailable ? "bg-destructive/10 font-medium text-destructive" : ""}`}>{formatQuantity(row.available_qty)}</td><td className="px-3 py-2 text-muted-foreground">{row.uom}</td><td className="px-3 py-1.5"><Input className="h-8 text-right tabular-nums" type="number" min="0" max={row.available_qty} step="1" value={quantities[row.key] ?? ""} onChange={(event) => setQuantities((current) => ({ ...current, [row.key]: event.target.value }))} placeholder="0" aria-label={`Dispatch quantity for ${row.doc_batch_code} ${row.sku_name}`} /></td></tr>;
          })}{!referenceLoading && !visibleRows.length && <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">Select one or more DOC batches to begin allocation.</td></tr>}</tbody></table></div><aside className="space-y-3 rounded-md border bg-muted/20 p-3"><h3 className="text-sm font-semibold">Dispatch summary</h3><div className="flex justify-between text-sm"><span className="text-muted-foreground">Selected batches</span><strong className="tabular-nums">{selectedBatches.length}</strong></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Selected lines</span><strong className="tabular-nums">{selectedItems.length}</strong></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Total DOC</span><strong className="tabular-nums">{formatQuantity(totalQty)}</strong></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Destination</span><strong className="max-w-28 truncate text-right">{form.destination_farm_code || "—"}</strong></div><div className="rounded-md bg-primary/10 px-2.5 py-2 text-xs text-foreground"><div className="flex gap-1.5"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /><span>{selectedItems.length ? "Quantity will be revalidated at posting." : "Enter a dispatch quantity to continue."}</span></div></div></aside></div></section>
          <section className="rounded-md border bg-card p-3 sm:p-4"><Label>Remarks</Label><Textarea className="mt-1 min-h-20" value={form.remarks} onChange={(event) => updateForm("remarks", event.target.value)} placeholder="Optional dispatch notes" /></section>
        </fieldset>}
      </div>
      {!readOnly && <footer className="flex flex-col gap-2 border-t bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"><p className="text-xs text-muted-foreground">Posting locks the receipt and makes eligible Saleable DOC available to the destination&apos;s receiving workflow.</p><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void save(false)} disabled={saving || loading || referenceLoading}><Save className="size-4" />Save draft</Button><Button type="button" size="sm" onClick={requestReview} disabled={saving || loading || referenceLoading}><Send className="size-4" />Post</Button></div></footer>}
    </CardContent></Card>
    {reviewOpen && <div role="dialog" aria-modal="true" aria-labelledby="dispatch-review-title" className="fixed inset-0 z-50 flex items-end bg-black/40 p-3 sm:items-center sm:justify-center"><Card className="w-full max-w-lg"><CardContent className="space-y-4 p-4"><div><h2 id="dispatch-review-title" className="text-base font-semibold">Review Delivery Receipt</h2><p className="mt-1 text-sm text-muted-foreground">Confirm the quantities before this receipt is posted and locked.</p></div><div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm"><div className="flex justify-between gap-3"><span className="text-muted-foreground">Destination</span><strong>{form.farm_name || form.destination_farm_code}</strong></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Selected lines</span><strong>{selectedItems.length}</strong></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Total DOC</span><strong>{formatQuantity(totalQty)} PCS</strong></div></div><div className="rounded-md bg-primary/10 px-3 py-2 text-sm"><div className="flex gap-2"><CheckCircle2 className="size-4 shrink-0 text-primary" /><span>Posting performs the final server-side DOC balance check and creates the receiving handoff.</span></div></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setReviewOpen(false)} disabled={saving}>Back to edit</Button><Button type="button" onClick={() => void save(true)} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Post Delivery Receipt</Button></div></CardContent></Card></div>}
  </div>;
}
