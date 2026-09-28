/**
 * Sort labels containing numbers by their numeric value: Pen 2 before Pen 10.
 */
export function compareNaturalText(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}
