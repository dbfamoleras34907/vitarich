"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { format } from "date-fns";
import { Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePermission } from "@/hooks/usePermission";
import { calculateWeightSamples, parseWeightPaste, validSampleWeight, WEIGHTS_PER_SEX } from "@/app/jmb/lib/breederWeightSamples";
import { listBreederWeightSamples, saveBreederWeightSamples, type BreederWeightSampleRecord } from "@/app/jmb/lib/data/repositories/breederWeightSamples";
import type { Placement } from "../new/api";

const emptyWeights = () => Array<string>(WEIGHTS_PER_SEX).fill("");
type Sex = "male" | "female";

export default function WeightSamplesDialog({ placement, disabled }: { placement: Placement; disabled: boolean }) {
  const saveDenied = usePermission("/jmb/placement/insert");
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loaded, setLoaded] = useState<{ date: string; record: BreederWeightSampleRecord | null } | null>(null);
  const [weights, setWeights] = useState({ male: emptyWeights(), female: emptyWeights() });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [reload, setReload] = useState(0);
  const request = useRef<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoaded(null);
    setWeights({ male: emptyWeights(), female: emptyWeights() });
    setError(null);
    listBreederWeightSamples({ placementIds: [placement.id], from: date, to: date })
      .then(result => {
        if (cancelled) return;
        if (!result.available) throw new Error("Weight sample storage is not installed yet. Please apply breeder_weight_samples.sql.");
        const record = result.records[0] ?? null;
        setLoaded({ date, record });
        setWeights({ male: record?.male_weights.map(String) ?? emptyWeights(), female: record?.female_weights.map(String) ?? emptyWeights() });
        setDirty(false);
        request.current = null;
      }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load samples."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, placement.id, date, reload]);

  const stats = { male: calculateWeightSamples(weights.male.map(Number)), female: calculateWeightSamples(weights.female.map(Number)) };
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${placement.placement_date.slice(0, 10)}T00:00:00Z`)) / 86400000) + 1;
  const today = format(new Date(), "yyyy-MM-dd");
  const validDate = Number.isInteger(days) && days >= 1 && date <= today;
  const ready = !loading && !saving && loaded?.date === date;

  function paste(event: ClipboardEvent<HTMLInputElement>, sex: Sex, index: number) {
    event.preventDefault();
    try {
      const values = parseWeightPaste(event.clipboardData.getData("text/plain"), WEIGHTS_PER_SEX - index);
      setWeights(current => ({ ...current, [sex]: current[sex].map((value, offset) => values[offset - index] ?? value) }));
      setDirty(true);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Unable to paste weights."); }
  }

  async function save() {
    if (!ready || saveDenied || !stats.male || !stats.female || !validDate) return;
    const input = { placementId: placement.id, date, male: weights.male.map(Number), female: weights.female.map(Number), expectedRevision: loaded.record?.revision ?? 0 };
    const signature = JSON.stringify(input);
    if (request.current?.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
    setSaving(true);
    setError(null);
    try {
      const record = await saveBreederWeightSamples({ ...input, requestKey: request.current.key });
      setLoaded({ date, record });
      setDirty(false);
      request.current = null;
      toast.success("Saved 50 male and 50 female weight samples.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save weight samples."); }
    finally { setSaving(false); }
  }

  function changeOpen(next: boolean) {
    if (saving) return;
    if (!next && dirty && !window.confirm("Discard unsaved weight samples?")) return;
    setOpen(next);
  }

  return <>
    <Button type="button" variant="outline" disabled={disabled} onClick={() => setOpen(true)}><Scale className="size-4" /> Weight Samples</Button>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Body Weight Samples</DialogTitle>
          <DialogDescription>{placement.farm_name} / {placement.building_no} / {placement.pen_no}. Enter 50 individual weights per sex in grams. Samples save separately from the Population Record Post.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label htmlFor="weight-sample-date">Weighing date</label>
          <Input id="weight-sample-date" type="date" className="w-40" value={date} min={placement.placement_date.slice(0, 10)} max={today} disabled={saving} onChange={event => {
            if (dirty && !window.confirm("Discard unsaved weight samples and change date?")) return;
            setDate(event.target.value);
          }} />
          <span className="font-medium text-blue-600">Age {validDate ? `${Math.floor(days / 7)}.${days % 7}` : "—"} (Weeks.Day)</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {(["male", "female"] as const).map(sex => <div key={sex} className="rounded-md border bg-muted/40 p-2">
            <div className="font-semibold capitalize">{sex} · {weights[sex].filter(value => value.trim() !== "" && validSampleWeight(Number(value))).length}/50 samples</div>
            <div>Average: {stats[sex]?.mean.toFixed(2) ?? "—"} g</div>
            <div>Uniformity: {stats[sex]?.uniformity.toFixed(2) ?? "—"}%</div>
          </div>)}
        </div>
        <p className="text-xs text-muted-foreground">Uniformity counts birds within ±10% of their sex&apos;s average weight. Paste one column of weights into either sex&apos;s first cell.</p>
        {error && <div role="alert" className="text-sm text-destructive">{error} <Button type="button" variant="link" size="sm" disabled={saving || loading} onClick={() => {
          if (!dirty || window.confirm("Discard unsaved changes and reload saved samples?")) setReload(value => value + 1);
        }}>Reload</Button></div>}
        <div className="min-h-0 flex-1 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted"><tr><th className="w-12 p-2">#</th><th>Male (g)</th><th>Female (g)</th></tr></thead>
            <tbody>{Array.from({ length: WEIGHTS_PER_SEX }, (_, index) => <tr key={index} className="border-t">
              <td className="text-center text-muted-foreground">{index + 1}</td>
              {(["male", "female"] as const).map(sex => <td key={sex} className="px-1 py-0.5"><Input type="number" min="0" step="any" inputMode="decimal" className="h-8 text-right tabular-nums" aria-label={`${sex} sample ${index + 1} in grams`} disabled={!ready || saveDenied} value={weights[sex][index]} onPaste={event => paste(event, sex, index)} onChange={event => {
                const value = event.target.value;
                setWeights(current => ({ ...current, [sex]: current[sex].map((previous, offset) => offset === index ? value : previous) }));
                setDirty(true);
              }} /></td>)}
            </tr>)}</tbody>
          </table>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => changeOpen(false)}>Close</Button>
          <Button type="button" onClick={save} disabled={!ready || saveDenied || !dirty || !stats.male || !stats.female || !validDate}>
            {(loading || saving) && <Loader2 className="size-4 animate-spin" />} {saving ? "Saving..." : "Save Samples"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
