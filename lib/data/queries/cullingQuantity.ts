export function parseCullingQuantity(value: string): number {
  const text = value.trim();
  if (!text) return 0;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) return Number.NaN;
  const quantity = Number(text.replaceAll(",", ""));
  return Number.isSafeInteger(quantity) ? quantity : Number.NaN;
}

export function formatCullingQuantity(value: string): string {
  if (!value.trim()) return "";
  const quantity = parseCullingQuantity(value);
  return Number.isFinite(quantity) ? quantity.toLocaleString("en-US") : value;
}
