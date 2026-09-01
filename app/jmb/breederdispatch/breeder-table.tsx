"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Bird,
  ChevronDown,
  ClipboardList,
  Eye,
  Loader2,
  MapPin,
  Plus,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  cancelBreederDispatch,
  listBreederDispatches,
  type BreederDispatchRecord,
} from "./new/api";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH");
}

function statusClass(status: BreederDispatchRecord["status"]) {
  if (status === "Posted") return "bg-emerald-100 text-emerald-700";
  if (status === "Cancelled") return "bg-stone-200 text-stone-600";
  return "bg-amber-100 text-amber-800";
}

export default function BreederDispatchTable() {
  const router = useRouter();
  const { setValue } = useGlobalContext();
  const [records, setRecords] = useState<BreederDispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [farmFilter, setFarmFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [cancelRecord, setCancelRecord] = useState<BreederDispatchRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => { void refreshSessionx(router); }, [router]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRecords(await listBreederDispatches());
    } catch (loadError) {
      console.error(loadError);
      setError("Unable to load breeder dispatches. Run breeder_dispatch_tables.sql, then dispatch_category_sources.sql, in Supabase.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); router.prefetch("/jmb/breederdispatch/new"); }, [load, router]);
  useEffect(() => setValue("loading_g", loading || working), [loading, setValue, working]);

  const farms = useMemo(() => {
    const unique = new Map<number, BreederDispatchRecord>();
    records.forEach((record) => unique.set(record.farm_id, record));
    return [
      { code: "__all__", name: "All farms" },
      ...[...unique.values()].map((record) => ({
        code: String(record.farm_id),
        name: record.farm_code ? `${record.farm_code} - ${record.farm_name}` : record.farm_name,
      })),
    ];
  }, [records]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (farmFilter && farmFilter !== "__all__" && String(record.farm_id) !== farmFilter) return false;
      if (statusFilter !== "All" && record.status !== statusFilter) return false;
      return !query || [record.document_no, record.farm_name, record.destination, record.hauler_name, record.plate_number]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [farmFilter, records, search, statusFilter]);
  const posted = records.filter((record) => record.status === "Posted");
  const postedUnits = posted.reduce((sum, record) => sum + Number(record.total_qty), 0);

  async function confirmCancel() {
    if (!cancelRecord || !cancelReason.trim()) return;
    setWorking(true); setError("");
    try {
      await cancelBreederDispatch(cancelRecord.id, cancelReason);
      setCancelRecord(null); setCancelReason(""); await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel dispatch.");
    } finally { setWorking(false); }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-10">
      <div className="mt-4 px-4"><Breadcrumb SecondPreviewPageName="Breeder" CurrentPageName="Dispatch" /></div>
      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/30 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Bird className="size-5" /></div>
              <div><h1 className="text-xl font-semibold">Breeder dispatch</h1><p className="text-sm text-muted-foreground">Population Record and Egg Laying dispatch register</p></div>
            </div>
            <Button onClick={() => router.push("/jmb/breederdispatch/new")}><Plus className="size-4" />New dispatch</Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat icon={<ClipboardList className="size-3.5" />} label="Posted documents" value={posted.length} />
            <Stat icon={<MapPin className="size-3.5" />} label="Farms dispatched" value={new Set(posted.map((row) => row.farm_id)).size} />
            <Stat icon={<Bird className="size-3.5" />} label="Units dispatched" value={postedUnits} />
          </div>
        </div>
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-end">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search document, farm, destination, hauler, or plate..." className="pl-9" /></div>
          <SearchableCombobox label="Farm" items={farms} value={farmFilter} onValueChange={setFarmFilter} placeholder="All farms" showCode className="w-full lg:w-72" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm lg:w-40"><option>All</option><option>Draft</option><option>Posted</option><option>Cancelled</option></select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
        {error ? <div className="m-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Document</TableHead><TableHead>Farm</TableHead><TableHead>Destination / transport</TableHead><TableHead className="text-right">Population</TableHead><TableHead className="text-right">Egg Laying</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={8} className="h-32 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : null}
            {!loading && filtered.map((record) => (
              <TableRow key={record.id} className={record.status === "Cancelled" ? "opacity-60" : ""}>
                <TableCell>{formatDate(record.dispatch_date)}</TableCell>
                <TableCell><div className="font-mono text-xs">{record.document_no}</div><div className="text-xs text-muted-foreground">{record.line_count} categor{record.line_count === 1 ? "y" : "ies"}</div></TableCell>
                <TableCell><div className="font-medium">{record.farm_name}</div><div className="text-xs text-muted-foreground">{record.farm_code || "-"}</div></TableCell>
                <TableCell><div className="font-medium">{record.destination}</div><div className="text-xs text-muted-foreground">{[record.hauler_name, record.plate_number].filter(Boolean).join(" · ") || "-"}</div></TableCell>
                <TableCell className="text-right tabular-nums">{Number(record.population_qty).toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(record.egg_qty).toLocaleString()}</TableCell>
                <TableCell><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(record.status)}`}>{record.status}</span></TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">Actions<ChevronDown className="size-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => window.open(`/jmb/breederdispatch/${record.id}/print`, "_blank")}><Printer className="size-4" />Print</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => router.push(`/jmb/breederdispatch/new?id=${record.id}`)}><Eye className="size-4" />View</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" disabled={record.status !== "Posted"} onSelect={() => { setCancelRecord(record); setCancelReason(""); }}><Ban className="size-4" />Cancel</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!loading && !filtered.length ? <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">No breeder dispatches found.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
        <div className="border-t px-4 py-3 text-sm text-muted-foreground">Showing {filtered.length} of {records.length} dispatches</div>
      </section>
      <Dialog open={Boolean(cancelRecord)} onOpenChange={(open) => { if (!open && !working) setCancelRecord(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Cancel breeder dispatch?</DialogTitle><DialogDescription>The reserved Population Record and Egg Laying quantities will become available for dispatch again.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label required>Cancellation reason</Label><Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setCancelRecord(null)} disabled={working}>Keep dispatch</Button><Button variant="destructive" onClick={() => void confirmCancel()} disabled={working || !cancelReason.trim()}>{working ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}Cancel dispatch</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-lg border bg-background p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{Number(value).toLocaleString()}</div></div>;
}
