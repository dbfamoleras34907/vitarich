/**
 * A transferred flock may arrive at a building after its original placement
 * date. Keep its physical receiving date separate while calculating age from
 * the original flock-date anchor.
 */
export function breederAgeAnchorDate(placement: {
  placement_date?: string | null;
  age_anchor_date?: string | null;
}) {
  const dateValue = (value: string | null | undefined) => {
    const date = String(value ?? "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  };
  const placementDate = dateValue(placement.placement_date);
  const ageAnchorDate = dateValue(placement.age_anchor_date);

  // Transferred flocks retain an earlier age anchor, but an anchor after the
  // physical placement date is invalid and would postpone an empty card.
  if (ageAnchorDate && (!placementDate || ageAnchorDate <= placementDate)) {
    return ageAnchorDate;
  }
  return placementDate || ageAnchorDate;
}

export type BreederAgePlacement = string | {
  placement_date?: string | null;
  age_anchor_date?: string | null;
};

/** Breeder age starts at 0.1 on the age-anchor date. */
export function breederAgeDays(placement: BreederAgePlacement | null | undefined, recordDate: string): number | null {
  const calendarDay = (value: string | undefined) => {
    const date = value?.slice(0, 10) ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Number.NaN;
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
      ? timestamp : Number.NaN;
  };
  const anchorDate = typeof placement === "string"
    ? placement
    : breederAgeAnchorDate(placement ?? {});
  const days = (calendarDay(recordDate) - calendarDay(anchorDate)) / 86_400_000 + 1;
  return Number.isInteger(days) && days >= 1 ? days : null;
}
