import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";

import { breederAgeDays } from "./breederAge";
import {
  closingFemalePopulation,
  type EggCollectionPlacement,
  type EggCollectionPopulation,
} from "./breederWeeklyEggProduction";
import type { EggLaying } from "./data/repositories/breederEggLaying";

type ForecastEgg = Pick<EggLaying, "id" | "placement_id" | "date_laying" | "tep_collection" | "hatching_egg" | "classb" | "junior" | "is_active">;

export type EggCollectionForecastPoint = {
  weekStart: string;
  weekEnd: string;
  aiw: number | null;
  wip: number | null;
  actualTep: number | null;
  actualHatchingEgg: number | null;
  forecastTep: number | null;
  forecastHatchingEgg: number | null;
};

export type EggCollectionForecastReportRow = {
  weekStart: string;
  weekEnd: string;
  source: "actual" | "forecast";
  aiw: number | null;
  wip: number | null;
  femalePopulation: number | null;
  depletionRatePercent: number | null;
  tep: number | null;
  hatchingEgg: number | null;
  hatchingWeekPercent: number | null;
  dropPercent: number | null;
  hatchingEggRecoveryPercent: number | null;
  recordedDays: number | null;
};

export type EggCollectionForecastHeader = {
  farmName: string | null;
  ageAtFivePercentDays: number | null;
  henHoused: number | null;
  tepPerHenHoused: number | null;
  hatchingEggPerHenHoused: number | null;
  hatchingEggRecoveryPercent: number | null;
};

export type EggCollectionForecast = {
  points: EggCollectionForecastPoint[];
  reportRows: EggCollectionForecastReportRow[];
  header: EggCollectionForecastHeader;
  actualThrough: string | null;
  message: string | null;
};

const FORECAST_START_WEEK = 31;
const FORECAST_END_WEEK = 65;
const FORECAST_END_WIP = 43;
const DEFAULT_DEPLETION_RATE_PERCENT = 0.4;
const DEFAULT_HW_DROP_PERCENT = -0.1;
const WEEK_STARTS_ON_FRIDAY = 5;
const EMPTY_FORECAST_HEADER: EggCollectionForecastHeader = {
  farmName: null,
  ageAtFivePercentDays: null,
  henHoused: null,
  tepPerHenHoused: null,
  hatchingEggPerHenHoused: null,
  hatchingEggRecoveryPercent: null,
};

function numeric(value: number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function weekKey(date: string) {
  return format(startOfWeek(parseISO(date), { weekStartsOn: WEEK_STARTS_ON_FRIDAY }), "yyyy-MM-dd");
}

function weekEnd(weekStart: string) {
  return format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
}

function standardForAgeWeek(ageWeek: number) {
  if (ageWeek < FORECAST_START_WEEK || ageWeek > FORECAST_END_WEEK) return null;
  const herPercent = ageWeek <= 50 ? 96.5 : ageWeek === 65 ? 97 : 96;
  return { herPercent };
}

function sumEggs(rows: readonly ForecastEgg[], metric: "tep" | "hatching") {
  return rows.reduce((total, row) => total + (metric === "tep"
    ? numeric(row.tep_collection)
    : numeric(row.hatching_egg) + numeric(row.classb) + numeric(row.junior)), 0);
}

function average(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sameNumber(values: readonly (number | null)[]) {
  if (!values.length || values.some(value => value == null)) return null;
  const first = values[0]!;
  return values.every(value => value === first) ? first : null;
}

function sameString(values: readonly (string | null)[]) {
  if (!values.length || values.some(value => value == null)) return null;
  const first = values[0]!;
  return values.every(value => value === first) ? first : null;
}

function ageWeek(placement: EggCollectionPlacement, date: string) {
  const days = breederAgeDays(placement.placement_date, date);
  return days == null || days < 0 ? null : Math.ceil(days / 7);
}

function populationByPlacement(rows: readonly EggCollectionPopulation[]) {
  const byPlacement = new Map<number, EggCollectionPopulation[]>();
  for (const row of rows) {
    const placementRows = byPlacement.get(Number(row.placement_id)) ?? [];
    placementRows.push(row);
    byPlacement.set(Number(row.placement_id), placementRows);
  }
  byPlacement.forEach(placementRows => placementRows.sort((left, right) => left.daterec.localeCompare(right.daterec) || left.id - right.id));
  return byPlacement;
}

type FarmFivePercent = {
  date: string;
  henHoused: number;
  ageDays: number | null;
};

function firstFarmFivePercent(placements: readonly EggCollectionPlacement[], eggs: readonly ForecastEgg[], populations: ReadonlyMap<number, readonly EggCollectionPopulation[]>) {
  const dailyTep = new Map<string, number>();
  for (const egg of eggs) {
    const date = dateKey(egg.date_laying);
    dailyTep.set(date, (dailyTep.get(date) ?? 0) + numeric(egg.tep_collection));
  }
  for (const [date, tep] of [...dailyTep.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const placed = placements.filter(placement => placement.placement_date.slice(0, 10) <= date);
    const females = placed.map(placement => closingFemalePopulation(placement, populations.get(Number(placement.id)) ?? [], date));
    if (!females.length || females.some(female => female == null)) continue;
    const henHoused = females.reduce<number>((total, female) => total + (female ?? 0), 0);
    if (henHoused > 0 && tep / henHoused >= 0.05) {
      const weightedAgeDays = placed.reduce((total, placement, index) => {
        const ageDays = breederAgeDays(placement.placement_date, date);
        return total + (ageDays ?? 0) * (females[index] ?? 0);
      }, 0) / henHoused;
      return { date, henHoused, ageDays: Math.round(weightedAgeDays) } satisfies FarmFivePercent;
    }
  }
  return null;
}

function wipForWeek(weekStart: string, fivePercentDate: string | null) {
  if (fivePercentDate == null) return null;
  const startingWeek = weekKey(fivePercentDate);
  const days = differenceInCalendarDays(parseISO(weekStart), parseISO(startingWeek));
  return days < 0 ? null : Math.floor(days / 7) + 1;
}

type PlacementActualWeek = {
  femalePopulation: number | null;
  hatchingWeekPercent: number | null;
};

function forecastDepletionRate(weeks: readonly PlacementActualWeek[]) {
  const rates: number[] = [];
  for (let index = 1; index < weeks.length; index += 1) {
    const previous = weeks[index - 1].femalePopulation;
    const current = weeks[index].femalePopulation;
    if (previous != null && previous > 0 && current != null) rates.push((previous - current) / previous * 100);
  }
  const recent = rates.slice(-3);
  return recent.length === 3 && average(recent) > DEFAULT_DEPLETION_RATE_PERCENT ? average(recent) : DEFAULT_DEPLETION_RATE_PERCENT;
}

function forecastHwDrop(weeks: readonly PlacementActualWeek[]) {
  const drops: number[] = [];
  for (let index = 1; index < weeks.length; index += 1) {
    const previous = weeks[index - 1].hatchingWeekPercent;
    const current = weeks[index].hatchingWeekPercent;
    if (previous != null && current != null) drops.push(current - previous);
  }
  const recent = drops.slice(-3);
  return recent.length === 3 && average(recent) > DEFAULT_HW_DROP_PERCENT ? average(recent) : DEFAULT_HW_DROP_PERCENT;
}

function forecastHeader(
  placements: readonly EggCollectionPlacement[],
  reportRows: readonly EggCollectionForecastReportRow[],
  atFivePercent: FarmFivePercent | null,
): EggCollectionForecastHeader {
  const totalTep = reportRows.reduce((total, row) => total + numeric(row.tep), 0);
  const totalHatchingEgg = reportRows.reduce((total, row) => total + numeric(row.hatchingEgg), 0);

  return {
    farmName: sameString(placements.map(placement => placement.farm_name?.trim() || null)),
    ageAtFivePercentDays: atFivePercent?.ageDays ?? null,
    henHoused: atFivePercent?.henHoused ?? null,
    tepPerHenHoused: atFivePercent?.henHoused != null && atFivePercent.henHoused > 0 ? totalTep / atFivePercent.henHoused : null,
    hatchingEggPerHenHoused: atFivePercent?.henHoused != null && atFivePercent.henHoused > 0 ? totalHatchingEgg / atFivePercent.henHoused : null,
    hatchingEggRecoveryPercent: totalTep > 0 ? totalHatchingEgg / totalTep * 100 : null,
  };
}

/** Builds the Friday-to-Thursday chart and its workbook-style verification report. */
export function calculateEggCollectionForecast(input: {
  from: string;
  to: string;
  placements: readonly EggCollectionPlacement[];
  activePlacementIds: ReadonlySet<number>;
  performance: readonly EggCollectionPopulation[];
  eggs: readonly ForecastEgg[];
}): EggCollectionForecast {
  const placements = input.placements.filter(placement => input.activePlacementIds.has(Number(placement.id)));
  if (!placements.length) return { points: [], reportRows: [], header: EMPTY_FORECAST_HEADER, actualThrough: null, message: "No active breeder placement is available for forecasting." };

  const placementById = new Map(placements.map(placement => [Number(placement.id), placement]));
  const eligibleEggs = input.eggs.filter(egg => egg.is_active && egg.placement_id != null
    && placementById.has(Number(egg.placement_id)) && dateKey(egg.date_laying) <= input.to);

  const eggsByPlacement = new Map<number, ForecastEgg[]>();
  for (const egg of eligibleEggs) {
    const records = eggsByPlacement.get(Number(egg.placement_id)) ?? [];
    records.push(egg);
    eggsByPlacement.set(Number(egg.placement_id), records);
  }
  eggsByPlacement.forEach(rows => rows.sort((left, right) => dateKey(left.date_laying).localeCompare(dateKey(right.date_laying)) || left.id - right.id));
  const populations = populationByPlacement(input.performance);
  const farmFivePercent = firstFarmFivePercent(placements, eligibleEggs, populations);
  const reportStart = farmFivePercent == null ? input.from : weekKey(farmFivePercent.date);
  const visibleEggs = eligibleEggs.filter((egg) => {
    const date = dateKey(egg.date_laying);
    const wip = wipForWeek(weekKey(date), farmFivePercent?.date ?? null);
    return date >= reportStart && (wip == null || wip <= FORECAST_END_WIP);
  });
  const latestActualDate = visibleEggs.map(egg => dateKey(egg.date_laying)).sort().at(-1) ?? null;
  const actual = new Map<string, { tep: number; hatchingEgg: number; dates: Set<string>; placementIds: Set<number> }>();
  for (const egg of visibleEggs) {
    const placementId = Number(egg.placement_id);
    const week = weekKey(dateKey(egg.date_laying));
    const row = actual.get(week) ?? { tep: 0, hatchingEgg: 0, dates: new Set<string>(), placementIds: new Set<number>() };
    row.tep += numeric(egg.tep_collection);
    row.hatchingEgg += numeric(egg.hatching_egg) + numeric(egg.classb) + numeric(egg.junior);
    row.dates.add(dateKey(egg.date_laying));
    row.placementIds.add(placementId);
    actual.set(week, row);
  }

  const actualReportRows: EggCollectionForecastReportRow[] = [];
  let previousActualPopulation: number | null = null;
  let previousActualHw: number | null = null;
  for (const [start, row] of [...actual.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const contributingPlacements = [...row.placementIds]
      .map(placementId => placementById.get(placementId))
      .filter((placement): placement is EggCollectionPlacement => placement != null);
    const populationsAtEnd = contributingPlacements.map(placement => closingFemalePopulation(placement, populations.get(Number(placement.id)) ?? [], weekEnd(start)));
    const femalePopulation = populationsAtEnd.every(population => population != null)
      ? populationsAtEnd.reduce<number>((total, population) => total + (population ?? 0), 0)
      : null;
    const hatchingWeekPercent = femalePopulation != null && femalePopulation > 0 ? row.tep / femalePopulation / 7 * 100 : null;
    const aiw = sameNumber(contributingPlacements.map(placement => ageWeek(placement, start)));
    const wip = wipForWeek(start, farmFivePercent?.date ?? null);
    actualReportRows.push({
      weekStart: start,
      weekEnd: weekEnd(start),
      source: "actual",
      aiw,
      wip,
      femalePopulation,
      depletionRatePercent: previousActualPopulation != null && previousActualPopulation > 0 && femalePopulation != null
        ? (previousActualPopulation - femalePopulation) / previousActualPopulation * 100
        : null,
      tep: row.tep,
      hatchingEgg: row.hatchingEgg,
      hatchingWeekPercent,
      dropPercent: previousActualHw != null && hatchingWeekPercent != null ? hatchingWeekPercent - previousActualHw : null,
      hatchingEggRecoveryPercent: row.tep > 0 ? row.hatchingEgg / row.tep * 100 : null,
      recordedDays: row.dates.size,
    });
    if (femalePopulation != null) previousActualPopulation = femalePopulation;
    if (hatchingWeekPercent != null) previousActualHw = hatchingWeekPercent;
  }

  const forecast = new Map<string, { openingPopulation: number; femalePopulation: number; tep: number; hatchingEgg: number; aiws: (number | null)[]; wips: (number | null)[] }>();
  let skippedBeforeStandard = false;
  let skippedWithoutActualRecord = false;
  const forecastStart = latestActualDate == null ? null : format(addDays(parseISO(weekKey(latestActualDate)), 7), "yyyy-MM-dd");
  if (forecastStart != null) {
    for (const placement of placements) {
      const placementId = Number(placement.id);
      const placementRows = eggsByPlacement.get(placementId) ?? [];
      const visibleRows = placementRows.filter((egg) => {
        const date = dateKey(egg.date_laying);
        const wip = wipForWeek(weekKey(date), farmFivePercent?.date ?? null);
        return date >= reportStart && (wip == null || wip <= FORECAST_END_WIP);
      });
      const latestPlacementDate = visibleRows.map(egg => dateKey(egg.date_laying)).sort().at(-1) ?? null;
      if (latestPlacementDate == null) {
        skippedWithoutActualRecord = true;
        continue;
      }
      let females = closingFemalePopulation(placement, populations.get(placementId) ?? [], latestPlacementDate);
      if (females == null || females <= 0) continue;

      const baselineDates = [...new Set(placementRows.filter(egg => dateKey(egg.date_laying) <= latestPlacementDate).map(egg => dateKey(egg.date_laying)))].sort().slice(-7);
      const baselineDateSet = new Set(baselineDates);
      const baselineTep = sumEggs(placementRows.filter(egg => baselineDateSet.has(dateKey(egg.date_laying))), "tep");
      let hw = baselineTep > 0 && baselineDates.length > 0 ? baselineTep / females / baselineDates.length * 100 : null;
      const historyRows = placementRows.filter(egg => dateKey(egg.date_laying) <= latestPlacementDate);
      const placementWeeks = [...new Map(historyRows.map(row => [weekKey(dateKey(row.date_laying)), null])).keys()].sort().map((start): PlacementActualWeek => {
        const weekRows = historyRows.filter(row => weekKey(dateKey(row.date_laying)) === start);
        const femalePopulation = closingFemalePopulation(placement, populations.get(placementId) ?? [], weekEnd(start));
        return { femalePopulation, hatchingWeekPercent: femalePopulation != null && femalePopulation > 0 ? sumEggs(weekRows, "tep") / femalePopulation / 7 * 100 : null };
      });
      const depletionRatePercent = forecastDepletionRate(placementWeeks);
      const dropPercent = forecastHwDrop(placementWeeks);

      for (let offset = 0; offset < FORECAST_END_WIP; offset += 1) {
        const start = format(addDays(parseISO(forecastStart), offset * 7), "yyyy-MM-dd");
        const wip = wipForWeek(start, farmFivePercent?.date ?? null);
        if (wip != null && wip > FORECAST_END_WIP) break;
        const aiw = ageWeek(placement, start);
        if (aiw == null || aiw > FORECAST_END_WEEK) break;
        const standard = standardForAgeWeek(aiw);
        if (!standard || hw == null) {
          skippedBeforeStandard = true;
          continue;
        }
        const openingPopulation = females;
        females *= 1 - depletionRatePercent / 100;
        hw += dropPercent;
        const tep = females * hw / 100 * 7;
        const hatchingEgg = tep * standard.herPercent / 100;
        const row = forecast.get(start) ?? { openingPopulation: 0, femalePopulation: 0, tep: 0, hatchingEgg: 0, aiws: [], wips: [] };
        row.openingPopulation += openingPopulation;
        row.femalePopulation += females;
        row.tep += tep;
        row.hatchingEgg += hatchingEgg;
        row.aiws.push(aiw);
        row.wips.push(wip);
        forecast.set(start, row);
      }
    }
  }

  const forecastReportRows = [...forecast.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([start, row]): EggCollectionForecastReportRow => ({
    weekStart: start,
    weekEnd: weekEnd(start),
    source: "forecast",
    aiw: sameNumber(row.aiws),
    wip: sameNumber(row.wips),
    femalePopulation: row.femalePopulation,
    depletionRatePercent: row.openingPopulation > 0 ? (row.openingPopulation - row.femalePopulation) / row.openingPopulation * 100 : null,
    tep: row.tep,
    hatchingEgg: row.hatchingEgg,
    hatchingWeekPercent: row.femalePopulation > 0 ? row.tep / row.femalePopulation / 7 * 100 : null,
    dropPercent: null,
    hatchingEggRecoveryPercent: row.tep > 0 ? row.hatchingEgg / row.tep * 100 : null,
    recordedDays: null,
  }));
  for (let index = 0; index < forecastReportRows.length; index += 1) {
    const previous = index === 0 ? actualReportRows.at(-1)?.hatchingWeekPercent ?? null : forecastReportRows[index - 1].hatchingWeekPercent;
    const current = forecastReportRows[index].hatchingWeekPercent;
    forecastReportRows[index].dropPercent = previous != null && current != null ? current - previous : null;
  }

  const reportRows = [...actualReportRows, ...forecastReportRows].sort((left, right) => left.weekStart.localeCompare(right.weekStart));
  const reportByWeek = new Map(reportRows.map(row => [row.weekStart, row]));
  const periods = [...new Set([...actual.keys(), ...forecast.keys()])].sort();
  const points = periods.map((weekStart) => {
    const actualRow = actual.get(weekStart);
    const forecastRow = forecast.get(weekStart);
    return {
      weekStart,
      weekEnd: weekEnd(weekStart),
      aiw: reportByWeek.get(weekStart)?.aiw ?? null,
      wip: reportByWeek.get(weekStart)?.wip ?? null,
      actualTep: actualRow?.tep ?? null,
      actualHatchingEgg: actualRow?.hatchingEgg ?? null,
      forecastTep: forecastRow?.tep ?? null,
      forecastHatchingEgg: forecastRow?.hatchingEgg ?? null,
    };
  });

  const message = !points.length
    ? "No actual Egg Collection rows or forecastable active placement was found."
    : !forecast.size
      ? "No 3-month forecast is available. It requires a recent Egg Collection record and an active placement within the AIW 31–65 standard."
    : skippedWithoutActualRecord
      ? "Only placements with a saved Egg Collection record are included in the forecast."
    : skippedBeforeStandard
      ? "Some active placements are outside the AIW 31–65 standard or do not have enough saved production data."
      : null;
  return { points, reportRows, header: forecastHeader(placements, reportRows, farmFivePercent), actualThrough: latestActualDate, message };
}
