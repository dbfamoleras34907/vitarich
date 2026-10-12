/**
 * A transferred flock may arrive at a building after its original placement
 * date. Keep its physical receiving date separate while calculating age from
 * the original flock-date anchor.
 */
export function breederAgeAnchorDate(placement: {
  placement_date?: string | null;
  age_anchor_date?: string | null;
}) {
  return String(
    placement.age_anchor_date ?? placement.placement_date ?? "",
  ).slice(0, 10);
}
