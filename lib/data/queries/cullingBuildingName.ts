export function cullingBuildingName(name?: string | null, code?: string | null): string {
  let label = name?.trim() ?? "";
  const prefix = code?.trim();
  if (prefix && label.toLowerCase().startsWith(prefix.toLowerCase())) {
    const remainder = label.slice(prefix.length);
    if (/^\s*[-–—]\s*/.test(remainder)) label = remainder.replace(/^\s*[-–—]\s*/, "");
  }
  return label.replace(/^BD-\d+\s*[-–—]\s*/i, "").trim() || "Unknown building";
}
