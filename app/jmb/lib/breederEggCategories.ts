export const EGG_DISPATCH_CATEGORIES = [
  ["hatching_egg", "Hatching Egg (<54g)"],
  ["classb", "Class B (<52g - 53g)"],
  ["junior", "Junior (<49g - 51g)"],
  ["table_egg", "Table Egg"],
  ["jumbo", "Jumbo"],
  ["crack", "Crack"],
  ["condemn", "Condemn"],
] as const;

export type EggDispatchCategory = (typeof EGG_DISPATCH_CATEGORIES)[number][0];

type EggCategorySource = {
  hatching_egg: number | null;
  classb: number | null;
  junior: number | null;
  table_egg_dirty: number | null;
  table_egg_misshapen: number | null;
  table_egg_off_size: number | null;
  table_egg_thin_shell: number | null;
  jumbo: number | null;
  crack: number | null;
  condemn: number | null;
};

function nonnegative(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Returns the dispatchable quantity for one Egg Laying category. */
export function eggDispatchQuantity(row: EggCategorySource, category: EggDispatchCategory) {
  if (category === "table_egg") {
    return nonnegative(row.table_egg_dirty) + nonnegative(row.table_egg_misshapen)
      + nonnegative(row.table_egg_off_size) + nonnegative(row.table_egg_thin_shell);
  }
  return nonnegative(row[category]);
}
