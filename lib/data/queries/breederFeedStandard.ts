/** Existing farm-supplied schedule used by Breeder Reports, in grams/bird/day. */
export const STANDARD_FEED_BY_WEEK: Readonly<Record<number, number>> = {
  21: 118, 22: 121, 23: 124, 24: 127, 25: 130,
};

/** Report weeks run from day 1 to day 7, day 8 to day 14, and so on. */
export function breederFeedStandard(ageDays: number | null) {
  if (ageDays == null || !Number.isInteger(ageDays) || ageDays < 1) return null;
  const week = Math.ceil(ageDays / 7);
  const gramsPerBird = STANDARD_FEED_BY_WEEK[week];
  return gramsPerBird == null ? null : { week, gramsPerBird };
}
