import { rows } from "./flockCardGridConfig";

const round = (value: number, decimals = 0) => Number(value.toFixed(decimals));
const randomBetween = (minimum: number, maximum: number) =>
  minimum + Math.random() * (maximum - minimum);
const randomWhole = (minimum: number, maximum: number) =>
  Math.floor(randomBetween(minimum, maximum + 1));

function sampleValue(currentValue: string | undefined, value: number) {
  return String(currentValue ?? "").trim() === "" ? String(value) : String(currentValue);
}

export function populateSensibleSampleData({
  gridValues,
  currentFlockAge,
  numberOfAnimals,
  lockedMortalityRowIndexes = [],
  devMode,
}: {
  gridValues: string[][];
  currentFlockAge: number | null;
  numberOfAnimals: number;
  lockedMortalityRowIndexes?: number[];
  devMode: boolean;
}) {
  if (!devMode || currentFlockAge == null) return gridValues;

  const lockedMortalityRows = new Set(lockedMortalityRowIndexes);

  return gridValues.map((gridRow, rowIndex) => {
    const age = rows[rowIndex]?.age ?? rowIndex;
    if (age > currentFlockAge) return gridRow;

    const nextRow = [...gridRow];
    const estimatedFeedPerBird = Math.min(14 + age * 3.15, 132);
    const dailyFeedKg = estimatedFeedPerBird * Math.max(numberOfAnimals, 0) / 1000;
    const bodyWeight = 42 + 10 * age + 1.25 * age * age;
    const targetTemperature = Math.max(21.5, 32.5 - age * 0.3);
    const mortalityAm = randomWhole(1, age < 7 ? 4 : 2);
    const mortalityPm = randomWhole(0, age < 7 ? 3 : 2);
    const thinningAm = age >= 21 ? randomWhole(1, age >= 30 ? 12 : 4) : 0;
    const thinningPm = age >= 21 ? randomWhole(0, age >= 30 ? 8 : 3) : 0;

    if (!lockedMortalityRows.has(rowIndex)) {
      nextRow[0] = String(mortalityAm);
      nextRow[1] = String(mortalityPm);
      nextRow[3] = String(thinningAm);
      nextRow[4] = String(thinningPm);
    }
    nextRow[8] = sampleValue(nextRow[8], round(dailyFeedKg * randomBetween(0.96, 1.04), 2));
    nextRow[12] = sampleValue(nextRow[12], round(dailyFeedKg * randomBetween(1.65, 1.9), 1));
    nextRow[14] = sampleValue(nextRow[14], round(bodyWeight * randomBetween(0.96, 1.04)));
    nextRow[16] = sampleValue(nextRow[16], round(targetTemperature - randomBetween(0.8, 1.5), 1));
    nextRow[17] = sampleValue(nextRow[17], round(targetTemperature + randomBetween(0.8, 1.5), 1));
    nextRow[18] = sampleValue(nextRow[18], randomWhole(55, 65));
    nextRow[19] = sampleValue(nextRow[19], randomWhole(66, 78));
    nextRow[20] = sampleValue(nextRow[20], randomWhole(4, 14));
    nextRow[21] = sampleValue(nextRow[21], round(randomBetween(8, 18), 1));
    nextRow[22] = sampleValue(nextRow[22], round(randomBetween(2, 8), 1));
    nextRow[23] = sampleValue(nextRow[23], round(randomBetween(58, 72), 1));

    return nextRow;
  });
}
