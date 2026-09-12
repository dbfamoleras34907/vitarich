// Weekly metric targets, indexed from week 1. Checked 2026-09-11.
// Female: Cobb500 Fast Feather 2026, printed pages 6 and 10 (metric guide,
// which is more precise than the rounded values in the recording sheet).
// Male: Cobb MX Male 2026, printed pages 20-21.
export const COBB_BODY_WEIGHT_SOURCES = {
  female: "https://www.cobbgenetics.com/assets/Cobb-Files/Cobb-500FF-Breeder-Management-Supplement_Global-6-2026.pdf",
  male: "https://www.cobbgenetics.com/assets/Cobb-Files/Cobb-MX-Male-Supplement-4-9-2026.pdf",
} as const;

const femaleGrams = [
  145, 280, 405, 520, 630, 740, 840, 940, 1030, 1120,
  1210, 1300, 1390, 1490, 1590, 1690, 1830, 1980, 2140, 2300,
  2450, 2600, 2850, 3000, 3130, 3260, 3360, 3460, 3540, 3600,
  3645, 3680, 3715, 3750, 3780, 3810, 3835, 3860, 3880, 3900,
  3920, 3940, 3960, 3980, 4000, 4020, 4040, 4060, 4080, 4095,
  4110, 4125, 4140, 4150, 4160, 4170, 4180, 4190, 4200, 4210,
  4220, 4230, 4240, 4250, 4260,
] as const;

const maleGrams = [
  150, 350, 545, 725, 870, 1010, 1130, 1245, 1360, 1470,
  1580, 1710, 1845, 1975, 2110, 2240, 2385, 2535, 2680, 2840,
  3000, 3190, 3360, 3500, 3620, 3750, 3870, 3960, 4030, 4090,
  4140, 4180, 4210, 4235, 4260, 4285, 4310, 4335, 4360, 4385,
  4410, 4435, 4460, 4485, 4510, 4535, 4560, 4585, 4610, 4635,
  4660, 4680, 4700, 4720, 4740, 4760, 4780, 4800, 4820, 4840,
  4860, 4880, 4900, 4920, 4940,
] as const;

/** Compare against the completed week's published target; never extrapolate. */
export function cobbBodyWeightTarget(sex: "male" | "female", ageDays: number | null) {
  if (ageDays == null || !Number.isInteger(ageDays) || ageDays < 7 || ageDays > 455) return null;
  const week = Math.floor(ageDays / 7);
  return { week, grams: (sex === "male" ? maleGrams : femaleGrams)[week - 1] };
}
