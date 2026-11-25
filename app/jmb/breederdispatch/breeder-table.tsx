"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Bird,
  Boxes,
  ChevronDown,
  ClipboardList,
  Eye,
  Loader2,
  ListPlus,
  MapPin,
  Pencil,
  Printer,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import BreederListParameters, {
  useBreederListParameters,
} from "@/components/breeder/BreederListParameters";
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
import { TablePagination } from "@/components/ui/table-pagination";
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
import { attachProcessListAttributions } from "@/lib/data/repositories/processListAttribution";
import { getErrorMessage } from "@/lib/errorMessage";
import {
  cancelBreederDispatch,
  canCorrectPostedBreederDispatch,
  correctPostedBreederDispatchDate,
  deleteBreederDispatchDraft,
  getBreederDispatchSummary,
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
  const parameters = useBreederListParameters();
  const [records, setRecords] = useState<BreederDispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{ posted: number; farms: number; units: number } | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const requestVersion = useRef(0);
  const [cancelRecord, setCancelRecord] = useState<BreederDispatchRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [discardRecord, setDiscardRecord] = useState<BreederDispatchRecord | null>(null);
  const [correctionRecord, setCorrectionRecord] = useState<BreederDispatchRecord | null>(null);
  const [correctedDispatchDate, setCorrectedDispatchDate] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [canCorrectPosted, setCanCorrectPosted] = useState(false);

  useEffect(() => { void refreshSessionx(router); }, [router]);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const result = await listBreederDispatches({ farmId: parameters.farmId, dateFrom: parameters.dateFrom, dateTo: parameters.dateTo, status: statusFilter, search, page, pageSize: 15 });
      const rows = await attachProcessListAttributions(result.records);
      if (version !== requestVersion.current) return;
      setRecords(rows);
      setTotal(result.total);
      if (page > Math.max(1, Math.ceil(result.total / 15))) setPage(Math.max(1, Math.ceil(result.total / 15)));
    } catch (loadError) {
      if (version !== requestVersion.current) return;
      console.error(loadError);
      setRecords([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load breeder dispatches. Please refresh and try again.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [parameters.farmId, parameters.dateFrom, parameters.dateTo, statusFilter, search, page]);
  const loadSummary = useCallback(async () => {
    try { setSummary(await getBreederDispatchSummary()); setSummaryError(false); }
    catch (summaryLoadError) { console.error(summaryLoadError); setSummary(null); setSummaryError(true); }
  }, []);
  useEffect(() => {
    const versionRef = requestVersion;
    const timer = setTimeout(() => void load(), 250);
    return () => { clearTimeout(timer); versionRef.current++; };
  }, [load]);
  useEffect(() => {
    void loadSummary();
    void canCorrectPostedBreederDispatch().then(setCanCorrectPosted).catch(() => setCanCorrectPosted(false));
    router.prefetch("/jmb/breederdispatch/new");
    router.prefetch("/jmb/breederdispatch/multiple");
  }, [loadSummary, router]);
  useEffect(() => { setPage(1); }, [parameters.farmId, parameters.dateFrom, parameters.dateTo, statusFilter, search]);
  useEffect(() => setValue("loading_g", loading || working), [loading, setValue, working]);

  const pageSize = 15;
  const currentPage = page;

  async function confirmCancel() {
    if (!cancelRecord || !cancelReason.trim()) return;
    setWorking(true); setError("");
    try {
      await cancelBreederDispatch(cancelRecord.id, cancelReason);
      setCancelRecord(null); setCancelReason(""); await Promise.all([load(), loadSummary()]);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel dispatch.");
    } finally { setWorking(false); }
  }

  async function confirmDiscard() {
    if (!discardRecord) return;
    setWorking(true); setError("");
    try {
      await deleteBreederDispatchDraft(discardRecord.id);
      setDiscardRecord(null); await Promise.all([load(), loadSummary()]);
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : "Unable to discard draft dispatch.");
    } finally { setWorking(false); }
  }

  async function confirmDateCorrection() {
    if (!correctionRecord || !correctedDispatchDate || !correctionReason.trim()) return;
    setWorking(true); setError("");
    try {
      await correctPostedBreederDispatchDate(correctionRecord.id, correctedDispatchDate, correctionReason);
      setCorrectionRecord(null); setCorrectedDispatchDate(""); setCorrectionReason(""); await Promise.all([load(), loadSummary()]);
    } catch (correctionError) {
      setError(getErrorMessage(correctionError, "Unable to correct dispatch date."));
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
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => router.push("/jmb/breederdispatch/inventory")}><Boxes className="size-4" />Dispatch Inventory Record</Button>
              <Button variant="outline" onClick={() => router.push("/jmb/breederdispatch/multiple")}><ListPlus className="size-4" />New dispatch</Button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat icon={<ClipboardList className="size-3.5" />} label="Posted documents" value={summary?.posted} />
            <Stat icon={<MapPin className="size-3.5" />} label="Farms dispatched" value={summary?.farms} />
            <Stat icon={<Bird className="size-3.5" />} label="Units dispatched" value={summary?.units} />
          </div>
        </div>
        <div className="flex flex-col gap-3 border-b p-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search document, farm, destination, hauler, or plate..." className="pl-9" /></div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <BreederListParameters {...parameters}>
              <div className="space-y-2 lg:w-40"><Label>Status</Label><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option>All</option><option>Draft</option><option>Posted</option><option>Cancelled</option></select></div>
            </BreederListParameters>
            <Button variant="outline" onClick={() => { void load(); void loadSummary(); }} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
          </div>
        </div>
        {error ? <div className="m-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {summaryError ? <div className="m-4 text-sm text-destructive">Unable to load dispatch totals. Refresh to try again.</div> : null}
        <Table>
          <TableHeader><TableRow><TableHead className="w-14 text-center">#</TableHead><TableHead>Date</TableHead><TableHead>Document</TableHead><TableHead>Farm</TableHead><TableHead>Building</TableHead><TableHead>Destination / transport</TableHead><TableHead className="text-right">Population</TableHead><TableHead className="text-right">Egg Laying</TableHead><TableHead>Status</TableHead><TableHead>Created by</TableHead><TableHead>Assigned TA</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={12} className="h-32 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : null}
            {!loading && records.map((record, index) => (
              <TableRow key={record.id} className={record.status === "Cancelled" ? "opacity-60" : ""}>
                <TableCell className="text-center font-medium tabular-nums text-muted-foreground">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                <TableCell>{formatDate(record.dispatch_date)}</TableCell>
                <TableCell><div className="font-mono text-xs">{record.document_no}</div><div className="text-xs text-muted-foreground">{record.line_count} categor{record.line_count === 1 ? "y" : "ies"}</div></TableCell>
                <TableCell><div className="font-medium">{record.farm_name}</div><div className="text-xs text-muted-foreground">{record.farm_code || "-"}</div></TableCell>
                <TableCell><span className="block max-w-48 truncate" title={record.building_names?.join(", ")}>{record.building_names?.join(", ") || "-"}</span></TableCell>
                <TableCell><div className="font-medium">{record.destination}</div><div className="text-xs text-muted-foreground">{[record.hauler_name, record.plate_number].filter(Boolean).join(" · ") || "-"}</div></TableCell>
                <TableCell className="text-right tabular-nums">{Number(record.population_qty).toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(record.egg_qty).toLocaleString()}</TableCell>
                <TableCell><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(record.status)}`}>{record.status}</span></TableCell>
                <TableCell>{record.createdByName}</TableCell>
                <TableCell><span className="block max-w-40 truncate" title={record.assignedTaLabel}>{record.assignedTaLabel}</span></TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">Actions<ChevronDown className="size-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => window.open(`/jmb/breederdispatch/${record.id}/print`, "_blank")}><Printer className="size-4" />Print</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => router.push(`/jmb/breederdispatch/multiple?id=${record.id}`)}><Eye className="size-4" />{record.status === "Draft" ? "Continue / Post" : "View"}</DropdownMenuItem>
                      {record.status === "Draft" ? <DropdownMenuItem variant="destructive" disabled={working} onSelect={() => setDiscardRecord(record)}><Trash2 className="size-4" />Discard draft</DropdownMenuItem> : null}
                      {record.status === "Posted" && canCorrectPosted ? <DropdownMenuItem disabled={working} onSelect={() => { setCorrectionRecord(record); setCorrectedDispatchDate(record.dispatch_date.slice(0, 10)); setCorrectionReason(""); }}><Pencil className="size-4" />Correct dispatch date</DropdownMenuItem> : null}
                      {record.status === "Posted" ? <DropdownMenuItem variant="destructive" disabled={working} onSelect={() => { setCancelRecord(record); setCancelReason(""); }}><Ban className="size-4" />Cancel</DropdownMenuItem> : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!loading && !error && !records.length ? <TableRow><TableCell colSpan={12} className="h-32 text-center text-muted-foreground">No breeder dispatches found.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
        <TablePagination page={currentPage} pageSize={pageSize} totalItems={total} itemLabel="dispatches" onPageChange={setPage} />
      </section>
      <Dialog open={Boolean(cancelRecord)} onOpenChange={(open) => { if (!open && !working) setCancelRecord(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Cancel breeder dispatch?</DialogTitle><DialogDescription>The reserved Population Record and Egg Laying quantities will become available for dispatch again.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label required>Cancellation reason</Label><Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setCancelRecord(null)} disabled={working}>Keep dispatch</Button><Button variant="destructive" onClick={() => void confirmCancel()} disabled={working || !cancelReason.trim()}>{working ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}Cancel dispatch</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(discardRecord)} onOpenChange={(open) => { if (!open && !working) setDiscardRecord(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Discard draft breeder dispatch?</DialogTitle><DialogDescription>This draft has not reserved Population Record or Egg Laying quantities. It will be permanently removed.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDiscardRecord(null)} disabled={working}>Keep draft</Button><Button variant="destructive" onClick={() => void confirmDiscard()} disabled={working}>{working ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}Discard draft</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(correctionRecord)} onOpenChange={(open) => { if (!open && !working) setCorrectionRecord(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Correct posted dispatch date</DialogTitle><DialogDescription>This Super Admin correction keeps the document posted, preserves its quantities, and records the old and new date.</DialogDescription></DialogHeader>
          <div className="space-y-3"><div className="space-y-2"><Label>Current dispatch date</Label><Input value={formatDate(correctionRecord?.dispatch_date)} readOnly className="bg-muted/40" /></div><div className="space-y-2"><Label required>Corrected dispatch date</Label><Input type="date" value={correctedDispatchDate} onChange={(event) => setCorrectedDispatchDate(event.target.value)} disabled={working} /></div><div className="space-y-2"><Label required>Correction reason</Label><Textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} disabled={working} placeholder="Explain why the posted date is being corrected." /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setCorrectionRecord(null)} disabled={working}>Keep posted date</Button><Button onClick={() => void confirmDateCorrection()} disabled={working || !correctedDispatchDate || !correctionReason.trim()}>{working ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}Save correction</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return <div className="rounded-lg border bg-background p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{value == null ? "—" : value.toLocaleString()}</div></div>;
}
