// Cobb500 Fast Feather 2026, printed page 14, verified 2026-09-23.
// %HW is the daily production percentage averaged over the flock-age week.
// The guide's Total Eggs/HH column is CUMULATIVE, not weekly production.
export const COBB_EGG_PRODUCTION_SOURCE = "https://www.cobbgenetics.com/assets/Cobb-Files/Cobb-500FF-Breeder-Management-Supplement_Global-6-2026.pdf";
export const COBB_EGG_PRODUCTION_LABEL = "COBB 500 Fast Feather (2026)";

// Weeks 24 through 65; do not extrapolate to ages outside the published guide.
const totalEggPercent = [
  3.0, 22.0, 53.0, 73.5, 82.2, 85.1, 86.0, 85.8, 84.8, 84.1,
  82.8, 81.9, 80.9, 79.9, 79.1, 78.1, 77.0, 75.9, 74.8, 73.6,
  72.4, 71.2, 70.2, 69.0, 67.8, 66.6, 65.4, 64.1, 62.8, 61.5,
  60.1, 58.7, 57.6, 56.2, 54.9, 53.2, 51.7, 49.8, 48.5, 46.9,
  45.3, 43.7,
] as const;

export function cobbEggProductionTarget(ageDays: number | null) {
  if (ageDays == null || !Number.isInteger(ageDays) || ageDays < 1) return null;
  // Week 31 covers ages 30.1 through 31.0, including the last day.
  const week = Math.ceil(ageDays / 7);
  if (week < 24 || week > 65) return null;
  const percent = totalEggPercent[week - 24];
  return { week, totalEggPercent: percent, eggsPerLiveHenWeek: percent / 100 * 7 };
}
