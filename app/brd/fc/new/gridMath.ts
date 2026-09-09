import docStandard from "@/app/json/doc_standard.json";
import { bodyWeightByReferenceProfile } from "./broilerBodyWeightStandards";
import { standardAdgColumnIndex as defaultStandardAdgColumnIndex } from "./flockCardGridConfig";

export type GridValues = string[][];

type BreedStandard = {
  breed: string;
  reference_profile_id: string;
};

type ReferenceProfile = {
  daily_feed_intake_g_per_bird_by_day: Record<string, number>;
};

const breedStandards = docStandard.breed_standards as BreedStandard[];
const referenceProfiles = docStandard.reference_profiles as Record<string, ReferenceProfile>;

export function calculateFeedDailyPerBird({
  numberOfAnimals,
  cumulativeTotal,
  dailyKgFlock,
}: {
  numberOfAnimals: number;
  cumulativeTotal: number;
  dailyKgFlock: number;
}) {
  const remainingBirds = numberOfAnimals - cumulativeTotal;

  if (dailyKgFlock === 0 || remainingBirds <= 0) return 0;

  return (dailyKgFlock * 1000) / remainingBirds;
}

function normalizeBreed(value: string) {
  return value.trim().toUpperCase().replaceAll(/[^A-Z0-9]+/g, " ");
}

function getBreedStandard(breed: string) {
  const normalizedBreed = normalizeBreed(breed);
  const exactStandard = breedStandards.find(
    standard => normalizeBreed(standard.breed) === normalizedBreed
  );

  if (exactStandard) return exactStandard;

  return breedStandards.find(standard => normalizeBreed(standard.breed) === "UNKNOWN") ?? null;
}

export function getFeedGuidelineGramsPerBird(age: number, breed: string) {
  const profileId = getBreedStandard(breed)?.reference_profile_id;
  return profileId
    ? referenceProfiles[profileId]?.daily_feed_intake_g_per_bird_by_day[String(age)] ?? 0
    : 0;
}

export function calculateWaterDailyPerBird({
  numberOfAnimals,
  cumulativeTotal,
  dailyLitersFlock,
}: {
  numberOfAnimals: number;
  cumulativeTotal: number;
  dailyLitersFlock: number;
}) {
  const remainingBirds = numberOfAnimals - cumulativeTotal;

  if (dailyLitersFlock === 0 || remainingBirds <= 0) return 0;

  return (dailyLitersFlock * 1000) / remainingBirds;
}

export function getWaterGuidelineMillilitersPerBird(age: number, breed: string) {
  // Hubbard publishes Water = Feed x 1.70; Aviagen gives 1.6-1.8 L/kg at 21 C.
  return getFeedGuidelineGramsPerBird(age, breed) * 1.7;
}

export function getBodyWeightGuidelineGrams(age: number, breed: string) {
  const profileId = getBreedStandard(breed)?.reference_profile_id;
  return profileId ? bodyWeightByReferenceProfile[profileId]?.[age] ?? 0 : 0;
}

export function getAverageDailyGainGuidelineGrams(age: number, breed: string) {
  if (age <= 0) return 0;

  const placementWeight = getBodyWeightGuidelineGrams(0, breed);
  const bodyWeight = getBodyWeightGuidelineGrams(age, breed);
  if (placementWeight <= 0 || bodyWeight <= 0) return 0;

  return Number(((bodyWeight - placementWeight) / age).toFixed(1));
}

export function computeGridValues({
  gridValues,
  numberOfAnimals,
  feedDailyKgColumnIndex,
  feedDailyPerBirdColumnIndex,
  feedGuidelineColumnIndex,
  waterGuidelineColumnIndex,
  bodyGuidelineColumnIndex = 15,
  standardAdgColumnIndex = defaultStandardAdgColumnIndex,
  waterDailyLitersColumnIndex = 12,
  waterDailyPerBirdColumnIndex = 13,
  cumulativeTotalColumnIndex = 6,
  breed,
}: {
  gridValues: GridValues;
  numberOfAnimals: number;
  feedDailyKgColumnIndex: number;
  feedDailyPerBirdColumnIndex: number;
  feedGuidelineColumnIndex: number;
  waterGuidelineColumnIndex: number;
  bodyGuidelineColumnIndex?: number;
  standardAdgColumnIndex?: number;
  waterDailyLitersColumnIndex?: number;
  waterDailyPerBirdColumnIndex?: number;
  cumulativeTotalColumnIndex?: number;
  breed: string;
}) {
  let cumulativeTotal = 0;

  return gridValues.map((row, rowIndex) => {
    const computedRow = [...row];

    const mortalityTotal = getNumericValue(row[0]) + getNumericValue(row[1]);
    const selectionTotal = getNumericValue(row[3]) + getNumericValue(row[4]);
    const rowTotal = mortalityTotal + selectionTotal;
    const hasMortalityTotal = [0, 1].some(
      (colIndex) => (row[colIndex] ?? "").trim() !== ""
    );
    const hasRowTotal = [0, 1, 3, 4].some(
      (colIndex) => (row[colIndex] ?? "").trim() !== ""
    );

    computedRow[2] = hasMortalityTotal ? formatTotal(mortalityTotal) : "";
    computedRow[5] = hasRowTotal ? formatTotal(rowTotal) : "";

    if (hasRowTotal) {
      cumulativeTotal += rowTotal;
      computedRow[cumulativeTotalColumnIndex] = formatTotal(cumulativeTotal);
    } else {
      computedRow[cumulativeTotalColumnIndex] = "";
    }

    computedRow[feedGuidelineColumnIndex] = formatComputedValue(
      getFeedGuidelineGramsPerBird(rowIndex, breed)
    );
    computedRow[waterGuidelineColumnIndex] = formatComputedValue(
      getWaterGuidelineMillilitersPerBird(rowIndex, breed)
    );
    computedRow[bodyGuidelineColumnIndex] = formatComputedValue(
      getBodyWeightGuidelineGrams(rowIndex, breed)
    );
    computedRow[standardAdgColumnIndex] = formatComputedValue(
      getAverageDailyGainGuidelineGrams(rowIndex, breed)
    );

    if ((row[feedDailyKgColumnIndex] ?? "").trim() !== "") {
      computedRow[feedDailyPerBirdColumnIndex] = formatComputedValue(
        calculateFeedDailyPerBird({
          numberOfAnimals,
          cumulativeTotal,
          dailyKgFlock: getNumericValue(row[feedDailyKgColumnIndex]),
        })
      );
    } else {
      computedRow[feedDailyPerBirdColumnIndex] = "";
    }

    if ((row[waterDailyLitersColumnIndex] ?? "").trim() !== "") {
      computedRow[waterDailyPerBirdColumnIndex] = formatComputedValue(
        calculateWaterDailyPerBird({
          numberOfAnimals,
          cumulativeTotal,
          dailyLitersFlock: getNumericValue(row[waterDailyLitersColumnIndex]),
        })
      );
    } else {
      computedRow[waterDailyPerBirdColumnIndex] = "";
    }

    return computedRow;
  });
}

export function computeColumnTotals({
  computedGridValues,
  dataColumnCount,
  excludedColumnIndexes = [],
}: {
  computedGridValues: GridValues;
  dataColumnCount: number;
  excludedColumnIndexes?: number[];
}) {
  const excludedColumns = new Set(excludedColumnIndexes);

  return Array.from({ length: dataColumnCount }, (_, colIndex) => {
    if (excludedColumns.has(colIndex)) return "";

    let hasValue = false;

    const total = computedGridValues.reduce((sum, row) => {
      const cellValue = row[colIndex] ?? "";
      const numericValue = Number(cellValue.replaceAll(",", ""));

      if (Number.isNaN(numericValue) || cellValue.trim() === "") {
        return sum;
      }

      hasValue = true;
      return sum + numericValue;
    }, 0);

    return hasValue ? formatTotal(total) : "";
  });
}

export function formatTotal(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(3).replace(/\.?0+$/, "");
}

export function getNumericValue(value: string) {
  const numericValue = Number(value.replaceAll(",", ""));

  return Number.isNaN(numericValue) || value.trim() === ""
    ? 0
    : numericValue;
}

function formatComputedValue(value: number) {
  return value === 0 ? "" : formatTotal(value);
}
