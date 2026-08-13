"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarDays, Eye, Loader2, MapPin, Pill, Plus, RefreshCw, Search } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { cancelMedication, listMedications, type MedicationRecord } from "./new/api";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH");
}

function details(record: MedicationRecord) {
  return [
    ["Document", record.document_no],
    ["Date", formatDate(record.medication_date)],
    ["Treatment end", formatDate(record.treatment_end_date)],
    ["Farm", record.farm_code ? `${record.farm_code} - ${record.farm_name}` : record.farm_name],
    ["Coverage", record.scope],
    ["Building", record.building_name || "All farm buildings"],
    ["Target pens", record.target_names || "-"],
    ["Medication brand", record.medication_brand],
    ["Medication type", record.medication_type],
    ["Dosage", `${record.dosage} ${record.unit}`],
    ["Indication", record.indication],
    ["Treatment period", `${record.treatment_period_days} day${record.treatment_period_days === 1 ? "" : "s"}`],
    ["Route", record.route],
    ["Prescribed by", record.prescribed_by || "-"],
    ["Administered by", record.administered_by || "-"],
    ["Remarks", record.remarks || "-"],
    ["Status", record.status],
  ];
}

export default function MedicationTable() {
  const router = useRouter();
  const { setValue } = useGlobalContext();
  const [records, setRecords] = useState<MedicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [farmFilter, setFarmFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("Posted");
  const [viewRecord, setViewRecord] = useState<MedicationRecord | null>(null);
  const [cancelRecord, setCancelRecord] = useState<MedicationRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    void refreshSessionx(router);
  }, [router]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRecords(await listMedications());
    } catch (loadError) {
      console.error(loadError);
      setError("Unable to load medication records. Run medication_tables.sql in Supabase if this module is new.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    router.prefetch("/jmb/medication/new");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setValue("loading_g", loading || cancelling), [loading, cancelling, setValue]);

  const farms = useMemo(() => {
    const unique = new Map<number, MedicationRecord>();
    records.forEach((row) => unique.set(row.farm_id, row));
    return [
      { code: "__all__", name: "All farms" },
      ...[...unique.values()].map((row) => ({
        code: String(row.farm_id),
        name: row.farm_code ? `${row.farm_code} - ${row.farm_name}` : row.farm_name,
      })),
    ];
  }, [records]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((row) => {
      if (farmFilter && farmFilter !== "__all__" && String(row.farm_id) !== farmFilter) return false;
      if (statusFilter !== "All" && row.status !== statusFilter) return false;
      if (!query) return true;
      return [row.document_no, row.farm_name, row.building_name, row.target_names, row.medication_brand, row.medication_type, row.indication, row.route]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [farmFilter, records, search, statusFilter]);

  const postedCount = records.filter((row) => row.status === "Posted").length;
  const activeFarmCount = new Set(records.filter((row) => row.status === "Posted").map((row) => row.farm_id)).size;
  const thisMonthCount = records.filter((row) => {
    const date = new Date(`${row.medication_date}T00:00:00`);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  async function confirmCancel() {
    if (!cancelRecord) return;
    if (!cancelReason.trim()) {
      setError("Cancellation reason is required.");
      return;
    }
    setCancelling(true);
    setError("");
    try {
      await cancelMedication(cancelRecord.id, cancelReason);
      setCancelRecord(null);
      setCancelReason("");
      await load();
    } catch (cancelError) {
      console.error(cancelError);
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel medication.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-10">
      <div className="mt-4 px-4"><Breadcrumb SecondPreviewPageName="Breeder" CurrentPageName="Medication" /></div>

      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/30 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Pill className="size-5" /></div>
              <div><h1 className="text-xl font-semibold">Breeder medication</h1><p className="text-sm text-muted-foreground">Farm, building, and pen treatment register</p></div>
            </div>
            <Button onClick={() => router.push("/jmb/medication/new")}><Plus className="size-4" />Add medication</Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-background p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Pill className="size-3.5" />Active records</div><div className="mt-1 text-xl font-semibold">{postedCount.toLocaleString()}</div></div>
            <div className="rounded-lg border bg-background p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-3.5" />Farms covered</div><div className="mt-1 text-xl font-semibold">{activeFarmCount.toLocaleString()}</div></div>
            <div className="rounded-lg border bg-background p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />Records this month</div><div className="mt-1 text-xl font-semibold">{thisMonthCount.toLocaleString()}</div></div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medication, indication, farm, building, or pen..." className="pl-9" /></div>
          <SearchableCombobox items={farms} value={farmFilter} onValueChange={setFarmFilter} placeholder="All farms" showCode className="w-full lg:w-72" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm lg:w-40"><option>Posted</option><option>Cancelled</option><option>All</option></select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
        </div>

        {error ? <div className="m-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Document</TableHead><TableHead>Farm / location</TableHead><TableHead>Medication</TableHead><TableHead>Dosage</TableHead><TableHead>Period</TableHead><TableHead>Route</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={9} className="h-32 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></TableCell></TableRow> : null}
            {!loading && filtered.map((row) => (
              <TableRow key={row.id} className={row.status === "Cancelled" ? "opacity-60" : ""}>
                <TableCell className="whitespace-nowrap">{formatDate(row.medication_date)}</TableCell>
                <TableCell className="font-mono text-xs">{row.document_no}</TableCell>
                <TableCell><div className="font-medium">{row.farm_name}</div><div className="max-w-72 truncate text-xs text-muted-foreground" title={row.target_names ?? ""}>{row.scope}: {row.target_names || row.building_name || row.farm_name}</div></TableCell>
                <TableCell><div className="font-medium">{row.medication_brand}</div><div className="text-xs text-muted-foreground">{row.medication_type} · {row.indication}</div></TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{Number(row.dosage).toLocaleString()} {row.unit}</TableCell>
                <TableCell className="whitespace-nowrap">{row.treatment_period_days} day{row.treatment_period_days === 1 ? "" : "s"}</TableCell>
                <TableCell>{row.route}</TableCell>
                <TableCell><span className={`rounded-full px-2 py-1 text-xs font-medium ${row.status === "Posted" ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-600"}`}>{row.status}</span></TableCell>
                <TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setViewRecord(row)}><Eye className="size-4" />View</Button>{row.status === "Posted" ? <Button size="sm" variant="outline" className="text-red-600" onClick={() => { setCancelRecord(row); setCancelReason(""); }}><Ban className="size-4" />Cancel</Button> : null}</div></TableCell>
              </TableRow>
            ))}
            {!loading && filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">No medication records found.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
        <div className="border-t px-4 py-3 text-sm text-muted-foreground">Showing {filtered.length} of {records.length} records</div>
      </section>

      <Dialog open={Boolean(viewRecord)} onOpenChange={(open) => !open && setViewRecord(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Medication details</DialogTitle><DialogDescription>Complete treatment record and coverage.</DialogDescription></DialogHeader>{viewRecord ? <div className="grid gap-x-6 gap-y-4 py-2 sm:grid-cols-2">{details(viewRecord).map(([label, value]) => <div key={label} className={label === "Remarks" || label === "Target pens" ? "sm:col-span-2" : ""}><div className="text-xs font-medium uppercase text-muted-foreground">{label}</div><div className="mt-1 whitespace-pre-wrap text-sm">{value}</div></div>)}</div> : null}<DialogFooter><Button variant="outline" onClick={() => setViewRecord(null)}>Close</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={Boolean(cancelRecord)} onOpenChange={(open) => { if (!open && !cancelling) setCancelRecord(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Cancel medication record?</DialogTitle><DialogDescription>This preserves the record in history but marks it cancelled. Create a new record for corrections.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="cancel-reason" required>Cancellation reason</Label><Textarea id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why is this record being cancelled?" /></div><DialogFooter><Button variant="outline" onClick={() => setCancelRecord(null)} disabled={cancelling}>Keep record</Button><Button variant="destructive" onClick={() => void confirmCancel()} disabled={cancelling || !cancelReason.trim()}>{cancelling ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}Cancel record</Button></DialogFooter></DialogContent>
      </Dialog>
    </main>
  );
}
