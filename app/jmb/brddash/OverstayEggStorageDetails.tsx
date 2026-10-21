"use client";

import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { CalendarDays, Warehouse } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BreederEggStorageRow, BreederEggStorageSummary } from "@/app/jmb/lib/data/repositories/breederEggStorage";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

type StorageGroup = {
  key: string;
  label: string;
  remainingQuantity: number;
  warningQuantity: number;
  criticalQuantity: number;
  oldestAgeDays: number;
  buildingCount: number;
};

function displayDate(value: string) {
  return format(parseISO(value), "MMM d, yyyy");
}

function groupRows(rows: readonly BreederEggStorageRow[], weekly: boolean, threshold: number, criticalThreshold: number) {
  const groups = new Map<string, StorageGroup & { buildings: Set<string> }>();
  for (const row of rows) {
    const sourceDate = row.sourceDate.slice(0, 10);
    const key = weekly ? format(startOfWeek(parseISO(sourceDate), { weekStartsOn: 1 }), "yyyy-MM-dd") : sourceDate;
    const label = weekly ? `${displayDate(key)} – ${format(addDays(parseISO(key), 6), "MMM d, yyyy")}` : displayDate(key);
    const group = groups.get(key) ?? {
      key,
      label,
      remainingQuantity: 0,
      warningQuantity: 0,
      criticalQuantity: 0,
      oldestAgeDays: 0,
      buildingCount: 0,
      buildings: new Set<string>(),
    };
    group.remainingQuantity += row.remainingQuantity;
    if (row.ageDays >= threshold && row.ageDays < criticalThreshold) group.warningQuantity += row.remainingQuantity;
    if (row.ageDays >= criticalThreshold) group.criticalQuantity += row.remainingQuantity;
    group.oldestAgeDays = Math.max(group.oldestAgeDays, row.ageDays);
    group.buildings.add(`${row.buildingId ?? row.buildingName}`);
    group.buildingCount = group.buildings.size;
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => right.key.localeCompare(left.key));
}

function BreakdownTable({ rows, weekly, threshold, criticalThreshold }: { rows: readonly BreederEggStorageRow[]; weekly: boolean; threshold: number; criticalThreshold: number }) {
  const groups = groupRows(rows, weekly, threshold, criticalThreshold);
  return (
      <Table containerClassName="max-h-[440px] overflow-auto rounded-md border" className="min-w-[760px] text-sm">
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-30 [&_th]:bg-muted [&_th]:shadow-sm">
          <TableRow>
            <TableHead className="w-14 text-center">#</TableHead>
            <TableHead>{weekly ? "Collection week" : "Collection date"}</TableHead>
            <TableHead className="text-right">Remaining eggs</TableHead>
            <TableHead className="text-right">Warning {threshold}–{criticalThreshold - 1}</TableHead>
            <TableHead className="text-right">Critical {criticalThreshold}+</TableHead>
            <TableHead className="text-right">Oldest age</TableHead>
            <TableHead className="text-right">Buildings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group, index) => (
            <TableRow key={group.key}>
              <TableCell className="text-center font-medium tabular-nums text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="whitespace-nowrap font-medium">{group.label}</TableCell>
              <TableCell className="text-right tabular-nums">{integer.format(group.remainingQuantity)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-amber-700 dark:text-amber-400">{integer.format(group.warningQuantity)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-destructive">{integer.format(group.criticalQuantity)}</TableCell>
              <TableCell className="text-right tabular-nums">{group.oldestAgeDays} days</TableCell>
              <TableCell className="text-right tabular-nums">{group.buildingCount}</TableCell>
            </TableRow>
          ))}
          {!groups.length ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No undispatched Egg Laying inventory as of this date.</TableCell></TableRow> : null}
        </TableBody>
      </Table>
  );
}

export default function OverstayEggStorageDetails({
  open,
  onOpenChange,
  summary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: BreederEggStorageSummary | null;
}) {
  const threshold = summary?.overstayAgeDays ?? 4;
  const criticalThreshold = summary?.criticalAgeDays ?? 8;
  const rows = summary?.rows ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Warehouse className="size-5 text-amber-700" />Overstay Egg Storage</DialogTitle>
          <DialogDescription>
            Remaining Egg Laying inventory as of {summary ? displayDate(summary.asOf) : "the selected date"}. Storage is normal through day 3, warning from days {threshold}–{criticalThreshold - 1}, and critical at {criticalThreshold}+ days. Only Posted dispatches dated on or before the snapshot reduce inventory.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Overstay eggs ({threshold}+ days)</p><p className="mt-1 text-lg font-semibold tabular-nums">{integer.format(summary?.overstayQuantity ?? 0)}</p><p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Warning {threshold}–{criticalThreshold - 1}: {integer.format(summary?.warningQuantity ?? 0)}</p><p className="mt-1 text-xs text-destructive">Critical {criticalThreshold}+: {integer.format(summary?.criticalQuantity ?? 0)}</p></div>
          <div className="rounded-md border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Undispatched eggs</p><p className="mt-1 text-lg font-semibold tabular-nums">{integer.format(summary?.totalRemainingQuantity ?? 0)}</p></div>
          <div className="rounded-md border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Oldest storage</p><p className="mt-1 text-lg font-semibold tabular-nums">{summary?.oldestAgeDays == null ? "—" : `${summary.oldestAgeDays} days`}</p></div>
        </div>
        <Tabs defaultValue="daily" className="min-h-0">
          <TabsList className="mb-3"><TabsTrigger value="daily"><CalendarDays />Daily</TabsTrigger><TabsTrigger value="weekly">Weekly</TabsTrigger></TabsList>
          <TabsContent value="daily" className="min-h-0"><BreakdownTable rows={rows} weekly={false} threshold={threshold} criticalThreshold={criticalThreshold} /></TabsContent>
          <TabsContent value="weekly" className="min-h-0"><BreakdownTable rows={rows} weekly threshold={threshold} criticalThreshold={criticalThreshold} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
