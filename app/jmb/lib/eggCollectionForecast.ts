import { addDays, format, parseISO, startOfWeek } from "date-fns";

import { breederAgeDays } from "./breederAge";
import {
  closingFemalePopulation,
  type EggCollectionPlacement,
  type EggCollectionPopulation,
} from "./breederWeeklyEggProduction";
import type { EggLaying } from "./data/repositories/breederEggLaying";

type ForecastEgg = Pick<EggLaying, "id" | "placement_id" | "date_laying" | "tep_collection" | "hatching_egg" | "is_active">;

export type EggCollectionForecastPoint = {
  weekStart: string;
  weekEnd: string;
  actualTep: number | null;
  actualHatchingEgg: number | null;
  forecastTep: number | null;
  forecastHatchingEgg: number | null;
};

export type EggCollectionForecast = {
  points: EggCollectionForecastPoint[];
  actualThrough: string | null;
  message: string | null;
};

const FORECAST_START_WEEK = 31;
const FORECAST_END_WEEK = 65;
const FORECAST_WEEKS = 13;
const DEPLETION_RATE_PERCENT = 0.4;

function numeric(value: number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function weekKey(date: string) {
  return format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function standardForAgeWeek(ageWeek: number) {
  if (ageWeek < FORECAST_START_WEEK || ageWeek > FORECAST_END_WEEK) return null;
  const hwDrop = ageWeek <= 49 ? -1 : ageWeek <= 59 ? -1.1 : -1.2;
  const herPercent = ageWeek <= 50 ? 96.5 : ageWeek === 65 ? 97 : 96;
  return { depletionRatePercent: DEPLETION_RATE_PERCENT, hwDrop, herPercent };
}

function sumEggs(rows: readonly ForecastEgg[], metric: "tep" | "hatching") {
  return rows.reduce((total, row) => total + numeric(metric === "tep" ? row.tep_collection : row.hatching_egg), 0);
}

/**
 * Builds the dashboard's weekly Actual-versus-Forecast series. The supplied
 * standard is intentionally the confirmed workbook curve: AIW 31–49 drops
 * 1.0 HW point, AIW 50–59 drops 1.1, AIW 60–65 drops 1.2; depletion is 0.4%.
 * The latest saved Egg Collection record is the workbook gate: its F Pop'n
 * and calculated HW seed the next seven-day forecast period.
 */
export function calculateEggCollectionForecast(input: {
  from: string;
  to: string;
  placements: readonly EggCollectionPlacement[];
  activePlacementIds: ReadonlySet<number>;
  performance: readonly EggCollectionPopulation[];
  eggs: readonly ForecastEgg[];
}): EggCollectionForecast {
  const placements = input.placements.filter(placement => input.activePlacementIds.has(Number(placement.id)));
  if (!placements.length) return { points: [], actualThrough: null, message: "No active breeder placement is available for forecasting." };

  const activePlacementIds = new Set(placements.map(placement => Number(placement.id)));
  const eligibleEggs = input.eggs.filter(egg => egg.is_active && egg.placement_id != null
    && activePlacementIds.has(Number(egg.placement_id))
    && dateKey(egg.date_laying) >= input.from && dateKey(egg.date_laying) <= input.to);
  const latestActualDate = eligibleEggs.map(egg => dateKey(egg.date_laying)).sort().at(-1) ?? null;
  const forecastStart = latestActualDate == null
    ? weekKey(input.to)
    : format(addDays(parseISO(latestActualDate), 1), "yyyy-MM-dd");

  const actual = new Map<string, { tep: number; hatchingEgg: number }>();
  for (const egg of eligibleEggs) {
    const placementId = Number(egg.placement_id);
    if (!input.activePlacementIds.has(placementId)) continue;
    const week = weekKey(dateKey(egg.date_laying));
    const row = actual.get(week) ?? { tep: 0, hatchingEgg: 0 };
    row.tep += numeric(egg.tep_collection);
    row.hatchingEgg += numeric(egg.hatching_egg);
    actual.set(week, row);
  }

  const populationByPlacement = new Map<number, EggCollectionPopulation[]>();
  for (const record of input.performance) {
    const records = populationByPlacement.get(Number(record.placement_id)) ?? [];
    records.push(record);
    populationByPlacement.set(Number(record.placement_id), records);
  }
  populationByPlacement.forEach(records => records.sort((left, right) => left.daterec.localeCompare(right.daterec) || left.id - right.id));

  const eggsByPlacement = new Map<number, ForecastEgg[]>();
  for (const egg of eligibleEggs) {
    const records = eggsByPlacement.get(Number(egg.placement_id)) ?? [];
    records.push(egg);
    eggsByPlacement.set(Number(egg.placement_id), records);
  }

  const forecast = new Map<string, { tep: number; hatchingEgg: number }>();
  let skippedBeforeStandard = false;
  let skippedWithoutActualRecord = false;
  for (const placement of placements) {
    const placementId = Number(placement.id);
    const placementActualRows = eggsByPlacement.get(placementId) ?? [];
    const latestPlacementDate = placementActualRows.map(egg => dateKey(egg.date_laying)).sort().at(-1) ?? null;
    if (latestPlacementDate == null) {
      skippedWithoutActualRecord = true;
      continue;
    }
    const populationDate = latestPlacementDate;
    let females = closingFemalePopulation(placement, populationByPlacement.get(placementId) ?? [], populationDate);
    if (females == null || females <= 0) continue;

    const baselineDates = [...new Set(placementActualRows.map(egg => dateKey(egg.date_laying)))].sort().slice(-7);
    const baselineDateSet = new Set(baselineDates);
    const baselineTep = sumEggs(placementActualRows.filter(egg => baselineDateSet.has(dateKey(egg.date_laying))), "tep");
    let hw = baselineTep > 0 && baselineDates.length > 0
      ? baselineTep / females / baselineDates.length * 100
      : null;

    for (let offset = 0; offset < FORECAST_WEEKS; offset += 1) {
      const weekStart = format(addDays(parseISO(forecastStart), offset * 7), "yyyy-MM-dd");
      const ageDays = breederAgeDays(placement.placement_date, weekStart);
      const ageWeek = ageDays == null ? null : Math.ceil(ageDays / 7);
      if (ageWeek == null || ageWeek > FORECAST_END_WEEK) break;
      const standard = standardForAgeWeek(ageWeek);
      if (!standard) {
        skippedBeforeStandard = true;
        continue;
      }
      if (hw == null) {
        skippedBeforeStandard = true;
        continue;
      }
      females *= 1 - standard.depletionRatePercent / 100;
      hw += standard.hwDrop;
      const tep = females * hw / 100 * 7;
      const hatchingEgg = tep * standard.herPercent / 100;
      const row = forecast.get(weekStart) ?? { tep: 0, hatchingEgg: 0 };
      row.tep += tep;
      row.hatchingEgg += hatchingEgg;
      forecast.set(weekStart, row);
    }
  }

  const periods = [...new Set([...actual.keys(), ...forecast.keys()])].sort();
  const points = periods.map((weekStart) => {
    const actualRow = actual.get(weekStart);
    const forecastRow = forecast.get(weekStart);
    return {
      weekStart,
      weekEnd: format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd"),
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
      ? "Some active placements are outside the AIW 31–65 standard or do not have recent Egg Collection data."
      : null;
  return { points, actualThrough: latestActualDate, message };
}
