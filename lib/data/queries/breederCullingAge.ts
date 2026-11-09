import { breederAgeDays, type BreederAgePlacement } from "@/lib/utils/breederPlacement";

/** Uses the shared Breeder convention: the age-anchor date is day one (0.1). */
export function cullingAge(placement: BreederAgePlacement | null | undefined, cullingDate?: string | null): number | null {
  return cullingDate ? breederAgeDays(placement, cullingDate) : null;
}
