export const WEIGHTS_PER_SEX = 50;

export function validSampleWeight(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function calculateWeightSamples(weights: readonly number[]) {
  if (weights.length !== WEIGHTS_PER_SEX || !weights.every(validSampleWeight)) return null;
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(total)) return null;
  const mean = total / weights.length;
  // Inclusive +/-10% of the unrounded mean (Cobb Breeder Management Guide).
  const tolerance = Number.EPSILON * mean * 8;
  const withinRange = weights.filter(weight => weight >= mean * 0.9 - tolerance
    && weight <= mean * 1.1 + tolerance).length;
  return { sampleCount: weights.length, mean, withinRange, uniformity: withinRange / weights.length * 100 };
}

/** Paste one column of gram weights; reject invalid cells and oversized pastes. */
export function parseWeightPaste(text: string, remaining: number): string[] {
  const values = text.trim().split(/[\s,;]+/);
  if (!text.trim() || values.length > remaining) throw new Error(`Paste up to ${remaining} weights into this column.`);
  if (values.some(value => !/^\d+(?:\.\d+)?$/.test(value) || !validSampleWeight(Number(value)))) {
    throw new Error("Use positive weights in grams, separated by lines, tabs, commas, or spaces.");
  }
  return values;
}
