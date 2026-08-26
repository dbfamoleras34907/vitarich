"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, Loader2 } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  loadBreederTransfers,
  type BreederTransfer, type TransferPlacement,
} from "./api";

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
  const requestedSource = searchParams.get("sourcePlacementId") ?? "";
  const [placements, setPlacements] = useState<TransferPlacement[]>([]);
  const [transfers, setTransfers] = useState<BreederTransfer[]>([]);
  const [sourcePlacementId, setSourcePlacementId] = useState(requestedSource);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  const [historyBuildingId, setHistoryBuildingId] = useState("");
  const [historyPenId, setHistoryPenId] = useState("");

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
  useEffect(() => setValue("loading_g", loading), [loading, setValue]);

  const source = placements.find((row) => String(row.id) === sourcePlacementId) ?? null;
  const historyFarmId = source?.farm_id ?? null;
  const farmTransfers = useMemo(() => transfers.filter((transfer) => historyFarmId != null && (transfer.source?.farm_id === historyFarmId || transfer.destination?.farm_id === historyFarmId)), [historyFarmId, transfers]);
  const historyLocations = useMemo(() => farmTransfers.flatMap((transfer) => [transfer.source, transfer.destination]).filter((location): location is NonNullable<BreederTransfer["source"]> => location != null && location.farm_id === historyFarmId), [farmTransfers, historyFarmId]);
  const historyBuildings = useMemo(() => [...new Map(historyLocations.map((location) => [location.building_id, location.building_no])).entries()].sort((left, right) => left[1].localeCompare(right[1], undefined, { numeric: true })), [historyLocations]);
  const historyPens = useMemo(() => [...new Map(historyLocations.filter((location) => !historyBuildingId || String(location.building_id) === historyBuildingId).map((location) => [location.pen_id, location.pen_no])).entries()].sort((left, right) => left[1].localeCompare(right[1], undefined, { numeric: true })), [historyBuildingId, historyLocations]);
  const filteredTransfers = useMemo(() => farmTransfers.filter((transfer) => {
    if (historyFromDate && transfer.transfer_date < historyFromDate) return false;
    if (historyToDate && transfer.transfer_date > historyToDate) return false;
    return matchesHistoryLocation(transfer.source, historyFarmId, historyBuildingId, historyPenId)
      || matchesHistoryLocation(transfer.destination, historyFarmId, historyBuildingId, historyPenId);
  }), [farmTransfers, historyBuildingId, historyFarmId, historyFromDate, historyPenId, historyToDate]);

  function transferDirection(transfer: BreederTransfer): "In" | "Out" {
    if (historyBuildingId || historyPenId) {
      if (matchesHistoryLocation(transfer.source, historyFarmId, historyBuildingId, historyPenId)) return "Out";
      return "In";
    }
    if (transfer.source_placement_id === Number(sourcePlacementId)) return "Out";
    if (transfer.destination_placement_id === Number(sourcePlacementId)) return "In";
    return transfer.source?.farm_id === historyFarmId ? "Out" : "In";
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
          <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Field label="From date"><Input type="date" max={historyToDate || undefined} value={historyFromDate} onChange={(event) => setHistoryFromDate(event.target.value)} /></Field><Field label="To date"><Input type="date" min={historyFromDate || undefined} value={historyToDate} onChange={(event) => setHistoryToDate(event.target.value)} /></Field><Field label="Building"><select value={historyBuildingId} onChange={(event) => { setHistoryBuildingId(event.target.value); setHistoryPenId(""); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">All buildings</option>{historyBuildings.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field><Field label="Pen"><select value={historyPenId} onChange={(event) => setHistoryPenId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">All pens</option>{historyPens.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field></div>
          <div className="overflow-x-auto rounded-md border"><Table className="min-w-[1100px]"><TableHeader><TableRow><TableHead>Date / Transfer #</TableHead><TableHead>Transfer</TableHead><TableHead>Source</TableHead><TableHead>Destination</TableHead><TableHead className="text-right">Male</TableHead><TableHead className="text-right">Female</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
            {loading ? <TableRow><TableCell colSpan={8} className="h-28 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : null}
            {!loading && filteredTransfers.map((transfer) => <TableRow key={transfer.id} className={transfer.status === "Cancelled" ? "opacity-60" : ""}><TableCell><div>{formatDate(transfer.transfer_date)}</div><div className="font-mono text-xs text-muted-foreground">{transfer.transfer_no}</div></TableCell><TableCell><TransferBadge direction={transferDirection(transfer)} /></TableCell><TableCell>{historyLabel(transfer.source)}</TableCell><TableCell>{historyLabel(transfer.destination)}</TableCell><TableCell className="text-right tabular-nums">{Number(transfer.male_qty).toLocaleString()}</TableCell><TableCell className="text-right tabular-nums">{Number(transfer.female_qty).toLocaleString()}</TableCell><TableCell><div>{transfer.reason}</div>{transfer.cancellation_reason ? <div className="text-xs text-red-600">Cancelled: {transfer.cancellation_reason}</div> : null}</TableCell><TableCell><Status value={transfer.status} /></TableCell></TableRow>)}
            {!loading && !filteredTransfers.length ? <TableRow><TableCell colSpan={8} className="h-28 text-center text-muted-foreground">No transfer transactions found for the selected farm and filters.</TableCell></TableRow> : null}
          </TableBody></Table></div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="space-y-2"><Label required={required}>{label}</Label>{children}</label>; }
function Status({ value }: { value: BreederTransfer["status"] }) { const color = value === "Posted" ? "bg-emerald-100 text-emerald-700" : value === "Cancelled" ? "bg-stone-200 text-stone-600" : "bg-amber-100 text-amber-800"; return <span className={`rounded-full px-2 py-1 text-xs font-medium ${color}`}>{value}</span>; }
function TransferBadge({ direction }: { direction: "In" | "Out" }) { return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${direction === "In" ? "bg-sky-100 text-sky-700" : "bg-orange-100 text-orange-700"}`}>Transfer {direction}</span>; }
