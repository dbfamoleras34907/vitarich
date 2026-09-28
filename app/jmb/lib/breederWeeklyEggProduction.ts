import { breederAgeDays } from "./breederAge";
import { cobbEggProductionTarget } from "./data/queries/cobb500BreederEggProduction";
import type { EggLaying } from "./data/repositories/breederEggLaying";

type Placement = {
  id: number; farm_id: number; farm_name: string | null;
  building_id: number; building_no: string | null;
  placement_date: string; f_endingbalance: number | null;
};
type Population = {
  id: number; placement_id: number; daterec: string;
  inv_female: number | null; trans_in_female: number | null; trans_out_female: number | null;
  mc_female: number | null; cull_female: number | null; kitchen_female: number | null; condem_female: number | null;
};
type Egg = Pick<EggLaying, "id" | "placement_id" | "farm_id" | "building_id" | "date_laying" | "tep_collection" | "hatching_egg" | "is_active">;

export type EggRangeFigures = {
  totalEggs: number | null;
  goodEggs: number | null;
  standardEggs: number | null;
  averageLiveFemales: number | null;
  productionPercent: number | null;
  standardPercent: number | null;
  eggsPerHen: number | null;
  standardEggsPerHen: number | null;
  hatchRecovery: number | null;
};

export type EggRangeBuilding = EggRangeFigures & {
  key: string; farmName: string; buildingName: string;
  from: string; to: string;
  recordedDays: number; daysInRange: number;
  partial: boolean; issue: string | null;
};
export type EggRangeProduction = {
  buildings: EggRangeBuilding[];
  totals: EggRangeFigures;
  excludedRecords: number;
};

const nonnegative = (value: number | null) => value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const ratio = (numerator: number | null, denominator: number | null, scale = 1) => numerator != null && denominator != null && denominator > 0 ? numerator / denominator * scale : null;
function figures(totalEggs: number | null, goodEggs: number | null, standardEggs: number | null, females: number | null, femaleDays: number | null): EggRangeFigures {
  return {
    totalEggs, goodEggs, standardEggs, averageLiveFemales: females,
    productionPercent: ratio(totalEggs, femaleDays, 100), standardPercent: ratio(standardEggs, femaleDays, 100),
    eggsPerHen: ratio(totalEggs, females), standardEggsPerHen: ratio(standardEggs, females),
    hatchRecovery: ratio(goodEggs, totalEggs, 100),
  };
}
export const emptyEggRangeProduction = (): EggRangeProduction => ({ buildings: [], excludedRecords: 0, totals: figures(null, null, null, null, null) });

/** Production-date-range totals per building.
 * Egg Laying is building-level, even though its header references one pen.
 * Actuals and standards use the same recorded production dates. Missing dates
 * remain visible as partial coverage; they are never invented as zero output.
 */
export function calculateEggRangeProduction(input: {
  from: string; to: string; farmId?: number;
  placements: readonly Placement[]; performance: readonly Population[]; eggs: readonly Egg[];
}): EggRangeProduction {
  const result = emptyEggRangeProduction();
  const placements = input.placements.filter(p => !input.farmId || Number(p.farm_id) === input.farmId);
  const byId = new Map(placements.map(p => [Number(p.id), p]));
  const buildingKey = (p: Placement) => `${p.farm_id}:${p.building_id}`;
  const populations = new Map<number, Population[]>();
  for (const record of input.performance) {
    const id = Number(record.placement_id);
    if (!byId.has(id)) continue;
    const rows = populations.get(id) ?? [];
    rows.push(record);
    populations.set(id, rows);
  }
  populations.forEach(rows => rows.sort((a, b) => a.daterec.localeCompare(b.daterec) || a.id - b.id));
  function femalesOn(p: Placement, date: string) {
    if (p.placement_date.slice(0, 10) > date) return 0;
    const rows = populations.get(Number(p.id)) ?? [];
    const latest = rows.findLast(row => row.daterec.slice(0, 10) <= date);
    if (!latest) return nonnegative(p.f_endingbalance);
    const opening = nonnegative(latest.inv_female);
    if (opening == null) return null;
    return nonnegative(opening + Number(latest.trans_in_female ?? 0) - Number(latest.trans_out_female ?? 0)
      - Number(latest.mc_female ?? 0) - Number(latest.cull_female ?? 0)
      - Number(latest.kitchen_female ?? 0) - Number(latest.condem_female ?? 0));
  }
  const eggsByBuilding = new Map<string, Egg[]>();
  const seen = new Set<number>();
  for (const egg of input.eggs) {
    const date = egg.date_laying.slice(0, 10);
    if (!egg.is_active || date < input.from || date > input.to || seen.has(egg.id)) continue;
    if (input.farmId && Number(egg.farm_id) !== input.farmId) continue;
    seen.add(egg.id);
    const p = byId.get(Number(egg.placement_id));
    if (!p || Number(egg.farm_id) !== Number(p.farm_id) || Number(egg.building_id) !== Number(p.building_id)
      || breederAgeDays(p.placement_date, date) == null) { result.excludedRecords++; continue; }
    const rows = eggsByBuilding.get(buildingKey(p)) ?? [];
    rows.push(egg);
    eggsByBuilding.set(buildingKey(p), rows);
  }
  const exposures: (number | null)[] = [];
  for (const [key, eggs] of eggsByBuilding) {
    eggs.sort((a, b) => a.date_laying.localeCompare(b.date_laying) || a.id - b.id);
    const anchor = byId.get(Number(eggs[eggs.length - 1].placement_id))!;
    const from = input.from;
    const to = input.to;
    const records = eggs;
    const days = [...new Set(records.map(egg => egg.date_laying.slice(0, 10)))];
    const pens = placements.filter(p => buildingKey(p) === key);
    const duplicateDates = records.length !== days.length;
    let invalidEggs = duplicateDates;
    let totalEggs = 0, goodEggs = 0, standardEggs = 0, femaleDays = 0;
    let populationAvailable = true, standardAvailable = true;
    for (const egg of records) {
      const tep = nonnegative(egg.tep_collection);
      // Egg Laying saves a blank classification as null, meaning zero eggs.
      const good = nonnegative(egg.hatching_egg ?? 0);
      if (tep == null || good == null || good > tep) invalidEggs = true;
      totalEggs += tep ?? 0;
      goodEggs += good ?? 0;
    }
    for (const date of days) {
      for (const p of pens) {
        const females = femalesOn(p, date);
        if (females == null) { populationAvailable = false; continue; }
        femaleDays += females;
        if (!females) continue;
        const standard = cobbEggProductionTarget(breederAgeDays(p.placement_date, date));
        if (!standard) standardAvailable = false;
        else standardEggs += females * standard.totalEggPercent / 100;
      }
    }
    const exposure = populationAvailable ? femaleDays : null;
    exposures.push(exposure);
    const daysInRange = breederAgeDays(from, to)!;
    result.buildings.push({
      key, farmName: anchor.farm_name || "Unspecified farm", buildingName: anchor.building_no || "Unspecified building",
      from, to, recordedDays: days.length, daysInRange, partial: days.length < daysInRange,
      issue: duplicateDates ? "Duplicate production dates need review." : invalidEggs ? "Invalid egg counts need review."
        : !populationAvailable ? "Female population unavailable." : !standardAvailable ? "Standard available for weeks 24–65 only." : femaleDays === 0 ? "No live females recorded." : null,
      ...figures(invalidEggs ? null : totalEggs, invalidEggs ? null : goodEggs,
        populationAvailable && standardAvailable && femaleDays > 0 ? standardEggs : null,
        exposure == null ? null : exposure / days.length, exposure),
    });
  }
  function sum(values: (number | null)[]) {
    return values.length && values.every(value => value != null) ? values.reduce<number>((total, value) => total + value!, 0) : null;
  }
  result.totals = figures(sum(result.buildings.map(b => b.totalEggs)), sum(result.buildings.map(b => b.goodEggs)),
    sum(result.buildings.map(b => b.standardEggs)), sum(result.buildings.map(b => b.averageLiveFemales)), sum(exposures));
  result.buildings.sort((a, b) => a.farmName.localeCompare(b.farmName) || a.buildingName.localeCompare(b.buildingName, undefined, { numeric: true }));
  return result;
}
