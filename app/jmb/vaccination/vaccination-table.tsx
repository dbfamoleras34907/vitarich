"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, MapPin, Pencil, Plus, RefreshCw, Search, ShieldCheck, Syringe } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { cancelVaccination, listVaccinations, type VaccinationRecord } from "./new/api";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH");
}

export default function VaccinationTable() {
  const router = useRouter();
  const { setValue } = useGlobalContext();
  const [records, setRecords] = useState<VaccinationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [farmFilter, setFarmFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("Posted");
  const [cancelRecord, setCancelRecord] = useState<VaccinationRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => { void refreshSessionx(router); }, [router]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setRecords(await listVaccinations()); }
    catch (loadError) { console.error(loadError); setError("Unable to load vaccination records. Run vaccination_tables.sql in Supabase if this module is new."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); router.prefetch("/jmb/vaccination/new"); }, [load, router]);
  useEffect(() => setValue("loading_g", loading || cancelling), [loading, cancelling, setValue]);

  const farms = useMemo(() => {
    const unique = new Map<number, VaccinationRecord>(); records.forEach((row) => unique.set(row.farm_id, row));
    return [{ code: "__all__", name: "All farms" }, ...[...unique.values()].map((row) => ({ code: String(row.farm_id), name: row.farm_code ? `${row.farm_code} - ${row.farm_name}` : row.farm_name }))];
  }, [records]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((row) => {
      if (farmFilter && farmFilter !== "__all__" && String(row.farm_id) !== farmFilter) return false;
      if (statusFilter !== "All" && row.status !== statusFilter) return false;
      return !query || [row.document_no, row.farm_name, row.building_name, row.target_names, row.vaccine_brand, row.vaccine_type, row.disease_target, row.batch_number, row.route].some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [farmFilter, records, search, statusFilter]);
  const posted = records.filter((row) => row.status === "Posted");
  const vaccinatedBirds = posted.reduce((sum, row) => sum + Number(row.birds_vaccinated), 0);
  const activeFarmCount = new Set(posted.map((row) => row.farm_id)).size;

  async function confirmCancel() {
    if (!cancelRecord || !cancelReason.trim()) return;
    setCancelling(true); setError("");
    try { await cancelVaccination(cancelRecord.id, cancelReason); setCancelRecord(null); setCancelReason(""); await load(); }
    catch (cancelError) { console.error(cancelError); setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel vaccination."); }
    finally { setCancelling(false); }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-10">
      <div className="mt-4 px-4"><Breadcrumb SecondPreviewPageName="Breeder" CurrentPageName="Vaccination" /></div>
      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/30 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Syringe className="size-5" /></div><div><h1 className="text-xl font-semibold">Breeder vaccination</h1><p className="text-sm text-muted-foreground">Farm, building, and pen vaccination register</p></div></div><Button onClick={() => router.push("/jmb/vaccination/new")}><Plus className="size-4" />Add vaccination</Button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat icon={<ShieldCheck className="size-3.5" />} label="Active records" value={posted.length} />
            <Stat icon={<MapPin className="size-3.5" />} label="Farms covered" value={activeFarmCount} />
            <Stat icon={<Syringe className="size-3.5" />} label="Birds vaccinated" value={vaccinatedBirds} />
          </div>
        </div>
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-end"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vaccine, disease, batch, farm, building, or pen..." className="pl-9" /></div><SearchableCombobox label="Farm" items={farms} value={farmFilter} onValueChange={setFarmFilter} placeholder="All farms" showCode className="w-full lg:w-72" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm lg:w-40"><option>Posted</option><option>Cancelled</option><option>All</option></select><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div>
        {error ? <div className="m-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Document</TableHead><TableHead>Farm / location</TableHead><TableHead>Vaccine</TableHead><TableHead>Disease</TableHead><TableHead>Batch</TableHead><TableHead>Birds</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
          {loading ? <TableRow><TableCell colSpan={9} className="h-32 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : null}
          {!loading && filtered.map((row) => <TableRow key={row.id} className={row.status === "Cancelled" ? "opacity-60" : ""}><TableCell>{formatDate(row.vaccination_date)}</TableCell><TableCell className="font-mono text-xs">{row.document_no}</TableCell><TableCell><div className="font-medium">{row.farm_name}</div><div className="max-w-64 truncate text-xs text-muted-foreground">{row.scope}: {row.target_names || row.building_name || row.farm_name}</div></TableCell><TableCell><div className="font-medium">{row.vaccine_brand}</div><div className="text-xs text-muted-foreground">{row.vaccine_type} · {row.dosage} {row.unit} · {row.route}</div></TableCell><TableCell>{row.disease_target}</TableCell><TableCell><div className="font-mono text-xs">{row.batch_number}</div><div className="text-xs text-muted-foreground">Exp {formatDate(row.expiry_date)}</div></TableCell><TableCell><div className="tabular-nums">{Number(row.birds_vaccinated).toLocaleString()}</div><div className="text-xs text-muted-foreground">{row.birds_missed} missed</div></TableCell><TableCell><span className={`rounded-full px-2 py-1 text-xs font-medium ${row.status === "Posted" ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-600"}`}>{row.status}</span></TableCell><TableCell><div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={() => router.push(`/jmb/vaccination/new?id=${row.id}`)} className="border-emerald-700 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"><Pencil className="size-4" />Edit/View</Button>{row.status === "Posted" ? <Button size="sm" variant="outline" className="text-red-600" onClick={() => { setCancelRecord(row); setCancelReason(""); }}><Ban className="size-4" />Cancel</Button> : null}</div></TableCell></TableRow>)}
          {!loading && !filtered.length ? <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">No vaccination records found.</TableCell></TableRow> : null}
        </TableBody></Table><div className="border-t px-4 py-3 text-sm text-muted-foreground">Showing {filtered.length} of {records.length} records</div>
      </section>
      <Dialog open={Boolean(cancelRecord)} onOpenChange={(open) => { if (!open && !cancelling) setCancelRecord(null); }}><DialogContent><DialogHeader><DialogTitle>Cancel vaccination record?</DialogTitle><DialogDescription>The record remains in history. Create a new record for corrections.</DialogDescription></DialogHeader><div className="space-y-2"><Label required>Cancellation reason</Label><Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why is this vaccination being cancelled?" /></div><DialogFooter><Button variant="outline" onClick={() => setCancelRecord(null)} disabled={cancelling}>Keep record</Button><Button variant="destructive" onClick={() => void confirmCancel()} disabled={cancelling || !cancelReason.trim()}>{cancelling ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}Cancel record</Button></DialogFooter></DialogContent></Dialog>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-lg border bg-background p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{value.toLocaleString()}</div></div>;
}
