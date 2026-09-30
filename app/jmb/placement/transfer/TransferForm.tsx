"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, Ban, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Pencil } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { usePermission } from "@/hooks/usePermission";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  loadBreederTransfers,
  cancelBreederTransfer,
  editBreederTransfer,
  type BreederTransfer, type TransferPlacement,
} from "./api";

type EditForm = {
  male_qty: string;
  female_qty: string;
  correctionReason: string;
};

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH");
}

function placementLabel(placement: TransferPlacement) {
  return `${placement.farm_name} / ${placement.building_no} / ${placement.pen_no}`;
}

function historyLabel(value: BreederTransfer["source"]) {
  return value ? `${value.farm_name} / ${value.building_no} / ${value.pen_no}` : "-";
}

function matchesHistoryLocation(
  location: BreederTransfer["source"],
  farmId: number | null,
  buildingId: string,
  penId: string,
) {
  return location != null
    && location.farm_id === farmId
    && (!buildingId || String(location.building_id) === buildingId)
    && (!penId || String(location.pen_id) === penId);
}

export default function TransferForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setValue } = useGlobalContext();
  const editDenied = usePermission("/jmb/placement/edit");
  const voidDenied = usePermission("/jmb/placement/void");
  const requestedSource = searchParams.get("sourcePlacementId") ?? "";
  const [placements, setPlacements] = useState<TransferPlacement[]>([]);
  const [transfers, setTransfers] = useState<BreederTransfer[]>([]);
  const [sourcePlacementId, setSourcePlacementId] = useState(requestedSource);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  const [historyBuildingId, setHistoryBuildingId] = useState("");
  const [historyPenId, setHistoryPenId] = useState("");
  const [historyStatus, setHistoryStatus] = useState<"" | BreederTransfer["status"]>("");
  const [historyPage, setHistoryPage] = useState(1);
  const [editing, setEditing] = useState<BreederTransfer | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [voiding, setVoiding] = useState<BreederTransfer | null>(null);
  const [voidReason, setVoidReason] = useState("");

  useEffect(() => { void refreshSessionx(router); }, [router]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await loadBreederTransfers();
      setPlacements(result.placements.sort((a, b) => placementLabel(a).localeCompare(placementLabel(b), undefined, { numeric: true })));
      setTransfers(result.transfers);
      setSourcePlacementId((current) => result.placements.some((row) => String(row.id) === current)
        ? current
        : result.placements[0] ? String(result.placements[0].id) : "");
    } catch (loadError) {
      setError(`${loadError instanceof Error ? loadError.message : "Unable to load bird transfers."} Run breeder_transfer_tables.sql in Supabase if this feature has not been installed.`);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => setValue("loading_g", loading || working), [loading, setValue, working]);

  const source = placements.find((row) => String(row.id) === sourcePlacementId) ?? null;
  const editSource = editing
    ? placements.find((placement) => placement.id === editing.source_placement_id) ?? null
    : null;
  const editMaleAvailable = editing && editSource
    ? editSource.male_available + editing.male_qty
    : null;
  const editFemaleAvailable = editing && editSource
    ? editSource.female_available + editing.female_qty
    : null;
  const historyFarmId = source?.farm_id ?? null;
  const farmTransfers = useMemo(() => transfers.filter((transfer) => historyFarmId != null && (transfer.source?.farm_id === historyFarmId || transfer.destination?.farm_id === historyFarmId)), [historyFarmId, transfers]);
  const historyLocations = useMemo(() => farmTransfers.flatMap((transfer) => [transfer.source, transfer.destination]).filter((location): location is NonNullable<BreederTransfer["source"]> => location != null && location.farm_id === historyFarmId), [farmTransfers, historyFarmId]);
  const historyBuildings = useMemo(() => [...new Map(historyLocations.map((location) => [location.building_id, location.building_no])).entries()].sort((left, right) => left[1].localeCompare(right[1], undefined, { numeric: true })), [historyLocations]);
  const historyPens = useMemo(() => [...new Map(historyLocations.filter((location) => !historyBuildingId || String(location.building_id) === historyBuildingId).map((location) => [location.pen_id, location.pen_no])).entries()].sort((left, right) => left[1].localeCompare(right[1], undefined, { numeric: true })), [historyBuildingId, historyLocations]);
  const filteredTransfers = useMemo(() => farmTransfers.filter((transfer) => {
    if (historyFromDate && transfer.transfer_date < historyFromDate) return false;
    if (historyToDate && transfer.transfer_date > historyToDate) return false;
    if (historyStatus && transfer.status !== historyStatus) return false;
    return matchesHistoryLocation(transfer.source, historyFarmId, historyBuildingId, historyPenId)
      || matchesHistoryLocation(transfer.destination, historyFarmId, historyBuildingId, historyPenId);
  }), [farmTransfers, historyBuildingId, historyFarmId, historyFromDate, historyPenId, historyStatus, historyToDate]);
  const historyPageSize = 10;
  const historyPageCount = Math.max(1, Math.ceil(filteredTransfers.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, historyPageCount);
  const paginatedTransfers = useMemo(() => {
    const start = (currentHistoryPage - 1) * historyPageSize;
    return filteredTransfers.slice(start, start + historyPageSize);
  }, [currentHistoryPage, filteredTransfers]);

  function transferDirection(transfer: BreederTransfer): "In" | "Out" {
    if (historyBuildingId || historyPenId) {
      if (matchesHistoryLocation(transfer.source, historyFarmId, historyBuildingId, historyPenId)) return "Out";
      return "In";
    }
    if (transfer.source_placement_id === Number(sourcePlacementId)) return "Out";
    if (transfer.destination_placement_id === Number(sourcePlacementId)) return "In";
    return transfer.source?.farm_id === historyFarmId ? "Out" : "In";
  }

  function openEdit(transfer: BreederTransfer) {
    setError("");
    setEditing(transfer);
    setEditForm({
      male_qty: String(transfer.male_qty),
      female_qty: String(transfer.female_qty),
      correctionReason: "",
    });
  }

  async function saveEdit() {
    if (!editing || !editForm) return;
    const maleQty = Number(editForm.male_qty);
    const femaleQty = Number(editForm.female_qty);
    if (!Number.isInteger(maleQty) || !Number.isInteger(femaleQty) || maleQty < 0 || femaleQty < 0 || maleQty + femaleQty <= 0) return setError("Enter a positive whole-number male or female quantity.");
    if (!editForm.correctionReason.trim()) return setError("Edit reason is required.");
    setWorking(true); setError("");
    try {
      await editBreederTransfer(editing.id, {
        male_qty: maleQty,
        female_qty: femaleQty,
      }, editForm.correctionReason.trim());
      setEditing(null); setEditForm(null); await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to edit bird transfer.");
    } finally { setWorking(false); }
  }

  async function confirmVoid() {
    if (!voiding || !voidReason.trim()) return;
    setWorking(true); setError("");
    try {
      await cancelBreederTransfer(voiding.id, voidReason.trim());
      setVoiding(null); setVoidReason(""); await load();
    } catch (voidError) {
      setError(voidError instanceof Error ? voidError.message : "Unable to void bird transfer.");
    } finally { setWorking(false); }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-10">
      <div className="mt-4 px-4"><Breadcrumb SecondPreviewPageName="Placement" CurrentPageName="Transfer History" /></div>
      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-muted/30 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div><h1 className="flex items-center gap-2 text-xl font-semibold"><ArrowLeftRight className="size-5 text-primary" />Transfer History</h1><p className="text-sm text-muted-foreground">Review all transfer transactions for {source?.farm_name || "the selected farm"}.</p></div>
          <Button type="button" variant="outline" onClick={() => router.push(sourcePlacementId ? `/jmb/placement/card?placementId=${sourcePlacementId}` : "/jmb/placement")}><ArrowLeft className="size-4" />Return to Population Record</Button>
        </div>
        {error ? <div className="m-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="p-5"><h2 className="font-semibold">Transfer Transactions</h2><p className="mb-3 text-xs text-muted-foreground">Showing transactions where {source?.farm_name || "the selected farm"} is the source, destination, or both.</p>
          <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Field label="From date"><Input type="date" max={historyToDate || undefined} value={historyFromDate} onChange={(event) => { setHistoryFromDate(event.target.value); setHistoryPage(1); }} /></Field><Field label="To date"><Input type="date" min={historyFromDate || undefined} value={historyToDate} onChange={(event) => { setHistoryToDate(event.target.value); setHistoryPage(1); }} /></Field><Field label="Building"><select value={historyBuildingId} onChange={(event) => { setHistoryBuildingId(event.target.value); setHistoryPenId(""); setHistoryPage(1); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">All buildings</option>{historyBuildings.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field><Field label="Pen"><select value={historyPenId} onChange={(event) => { setHistoryPenId(event.target.value); setHistoryPage(1); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">All pens</option>{historyPens.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field><Field label="Status"><select value={historyStatus} onChange={(event) => { setHistoryStatus(event.target.value as "" | BreederTransfer["status"]); setHistoryPage(1); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">All statuses</option><option value="Draft">Draft</option><option value="Posted">Posted</option><option value="Cancelled">Cancelled</option></select></Field></div>
          <div className="overflow-x-auto rounded-md border"><Table className="min-w-[1200px]"><TableHeader><TableRow><TableHead>Date / Transfer #</TableHead><TableHead>Transfer</TableHead><TableHead>Source</TableHead><TableHead>Destination</TableHead><TableHead className="text-right">Male</TableHead><TableHead className="text-right">Female</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {loading ? <TableRow><TableCell colSpan={9} className="h-28 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : null}
            {!loading && paginatedTransfers.map((transfer) => <TableRow key={transfer.id} className={transfer.status === "Cancelled" ? "opacity-60" : ""}><TableCell><div>{formatDate(transfer.transfer_date)}</div><div className="font-mono text-xs text-muted-foreground">{transfer.transfer_no}</div></TableCell><TableCell><TransferBadge direction={transferDirection(transfer)} /></TableCell><TableCell>{historyLabel(transfer.source)}</TableCell><TableCell>{historyLabel(transfer.destination)}</TableCell><TableCell className="text-right tabular-nums">{Number(transfer.male_qty).toLocaleString()}</TableCell><TableCell className="text-right tabular-nums">{Number(transfer.female_qty).toLocaleString()}</TableCell><TableCell><div>{transfer.reason}</div>{transfer.cancellation_reason ? <div className="text-xs text-red-600">Cancelled: {transfer.cancellation_reason}</div> : null}</TableCell><TableCell><Status value={transfer.status} /></TableCell><TableCell className="text-right">{transfer.status === "Posted" ? <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={working}>Actions <ChevronDown className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={editDenied} onSelect={() => openEdit(transfer)}><Pencil className="size-4" />Edit</DropdownMenuItem><DropdownMenuItem variant="destructive" disabled={voidDenied} onSelect={() => { setVoiding(transfer); setVoidReason(""); }}><Ban className="size-4" />Void</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : <span className="text-xs text-muted-foreground">—</span>}</TableCell></TableRow>)}
            {!loading && !filteredTransfers.length ? <TableRow><TableCell colSpan={9} className="h-28 text-center text-muted-foreground">No transfer transactions found for the selected farm and filters.</TableCell></TableRow> : null}
          </TableBody></Table></div>
          {!loading && filteredTransfers.length ? <div className="flex flex-col gap-3 border-x border-b px-3 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Showing {(currentHistoryPage - 1) * historyPageSize + 1}-{Math.min(currentHistoryPage * historyPageSize, filteredTransfers.length)} of {filteredTransfers.length} transactions</span><div className="flex flex-wrap gap-2"><Button type="button" size="icon" variant="outline" onClick={() => setHistoryPage(1)} disabled={currentHistoryPage === 1} aria-label="Latest page" title="Latest page"><ChevronsLeft className="size-4" /></Button><Button type="button" size="icon" variant="outline" onClick={() => setHistoryPage((page) => Math.max(1, page - 1))} disabled={currentHistoryPage === 1} aria-label="Previous page" title="Previous page"><ChevronLeft className="size-4" /></Button><span className="flex h-9 items-center px-2">Page {currentHistoryPage} of {historyPageCount}</span><Button type="button" size="icon" variant="outline" onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))} disabled={currentHistoryPage === historyPageCount} aria-label="Next page" title="Next page"><ChevronRight className="size-4" /></Button><Button type="button" size="icon" variant="outline" onClick={() => setHistoryPage(historyPageCount)} disabled={currentHistoryPage === historyPageCount} aria-label="Last page" title="Last page"><ChevronsRight className="size-4" /></Button></div></div> : null}
        </div>
      </section>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open && !working) { setEditing(null); setEditForm(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit bird transfer</DialogTitle><DialogDescription>Saving creates an audited correction: the original transfer is cancelled and a corrected posted transfer replaces it.</DialogDescription></DialogHeader>
          {editForm ? <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Transfer date"><Input type="date" value={editing?.transfer_date.slice(0, 10) ?? ""} readOnly className="bg-muted/40" /></Field>
            <Field label="Source building / pen"><Input value={historyLabel(editing?.source ?? null)} readOnly className="bg-muted/40" /></Field>
            <Field label="Destination building"><Input value={editing?.destination?.building_no ?? "-"} readOnly className="bg-muted/40" /></Field>
            <Field label="Destination pen"><Input value={editing?.destination?.pen_no ?? "-"} readOnly className="bg-muted/40" /></Field>
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <div className="rounded-md border bg-muted/20 px-3 py-2"><div className="text-xs text-muted-foreground">Male available</div><div className="font-semibold tabular-nums">{editMaleAvailable == null ? "—" : Number(editMaleAvailable).toLocaleString()}</div></div>
              <div className="rounded-md border bg-muted/20 px-3 py-2"><div className="text-xs text-muted-foreground">Female available</div><div className="font-semibold tabular-nums">{editFemaleAvailable == null ? "—" : Number(editFemaleAvailable).toLocaleString()}</div></div>
            </div>
            <Field label="Male quantity"><Input type="number" min="0" max={editMaleAvailable ?? undefined} step="1" value={editForm.male_qty} onChange={(event) => setEditForm({ ...editForm, male_qty: event.target.value })} disabled={working} /></Field>
            <Field label="Female quantity"><Input type="number" min="0" max={editFemaleAvailable ?? undefined} step="1" value={editForm.female_qty} onChange={(event) => setEditForm({ ...editForm, female_qty: event.target.value })} disabled={working} /></Field>
            <div className="sm:col-span-2"><Field label="Reason"><Input value={editing?.reason ?? ""} readOnly className="bg-muted/40" /></Field></div>
            <div className="sm:col-span-2"><Field label="Remarks"><Textarea value={editing?.remarks ?? ""} readOnly className="bg-muted/40" /></Field></div>
            <div className="sm:col-span-2"><Field label="Edit reason" required><Textarea value={editForm.correctionReason} onChange={(event) => setEditForm({ ...editForm, correctionReason: event.target.value })} disabled={working} placeholder="Explain why the posted transfer is being corrected." /></Field></div>
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => { setEditing(null); setEditForm(null); }} disabled={working}>Cancel</Button><Button onClick={() => void saveEdit()} disabled={working}>{working ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}Save correction</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(voiding)} onOpenChange={(open) => { if (!open && !working) setVoiding(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void bird transfer?</DialogTitle><DialogDescription>This reverses Transfer Out from the source pen and Transfer In to the destination pen.</DialogDescription></DialogHeader>
          <Field label="Void reason" required><Textarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} disabled={working} /></Field>
          <DialogFooter><Button variant="outline" onClick={() => setVoiding(null)} disabled={working}>Keep transfer</Button><Button variant="destructive" onClick={() => void confirmVoid()} disabled={working || !voidReason.trim()}>{working ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}Void transfer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="space-y-2"><Label required={required}>{label}</Label>{children}</label>; }
function Status({ value }: { value: BreederTransfer["status"] }) { const color = value === "Posted" ? "bg-emerald-100 text-emerald-700" : value === "Cancelled" ? "bg-stone-200 text-stone-600" : "bg-amber-100 text-amber-800"; return <span className={`rounded-full px-2 py-1 text-xs font-medium ${color}`}>{value}</span>; }
function TransferBadge({ direction }: { direction: "In" | "Out" }) { return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${direction === "In" ? "bg-sky-100 text-sky-700" : "bg-orange-100 text-orange-700"}`}>Transfer {direction}</span>; }
