export const formatNumber = (
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string => {
  if (value === null || value === undefined) return "0";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
};
