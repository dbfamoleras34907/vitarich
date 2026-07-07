import docStandard from "@/app/json/doc_standard.json";

export type GridValues = string[][];

type BreedStandard = {
  breed: string;
  daily_feed_intake_g_per_bird_by_day: Record<string, number>;
};

const breedStandards = docStandard.breed_standards as BreedStandard[];

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
  return getBreedStandard(breed)?.daily_feed_intake_g_per_bird_by_day[String(age)] ?? 0;
}

export function computeGridValues({
  gridValues,
  numberOfAnimals,
  feedDailyKgColumnIndex,
  feedDailyPerBirdColumnIndex,
  feedGuidelineColumnIndex,
  breed,
}: {
  gridValues: GridValues;
  numberOfAnimals: number;
  feedDailyKgColumnIndex: number;
  feedDailyPerBirdColumnIndex: number;
  feedGuidelineColumnIndex: number;
  breed: string;
}) {
  let cumulativeTotal = 0;

  return gridValues.map((row, rowIndex) => {
    const computedRow = [...row];

    const mortalityTotal = getNumericValue(row[0]) + getNumericValue(row[1]);
    const selectionTotal = getNumericValue(row[3]) + getNumericValue(row[4]);
    const rowTotal = mortalityTotal + selectionTotal;
    const hasRowTotal = [0, 1, 3, 4].some(
      (colIndex) => row[colIndex].trim() !== ""
    );

    computedRow[2] = formatComputedValue(mortalityTotal);
    computedRow[5] = formatComputedValue(rowTotal);

    if (hasRowTotal) {
      cumulativeTotal += rowTotal;
      computedRow[6] = formatComputedValue(cumulativeTotal);
    } else {
      computedRow[6] = "";
    }

    computedRow[feedGuidelineColumnIndex] = formatComputedValue(
      getFeedGuidelineGramsPerBird(rowIndex, breed)
    );

    if (row[feedDailyKgColumnIndex].trim() !== "") {
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
    if (colIndex === 6 || excludedColumns.has(colIndex)) return "";

    let hasValue = false;

    const total = computedGridValues.reduce((sum, row) => {
      const numericValue = Number(row[colIndex].replaceAll(",", ""));

      if (Number.isNaN(numericValue) || row[colIndex].trim() === "") {
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
