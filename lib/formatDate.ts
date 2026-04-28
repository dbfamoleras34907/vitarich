export function formatDateTime(
  dateStr?: string | null,
  formatType: "Mmmddyyyy" | "mmddyyyy" = "Mmmddyyyy",
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "";

  const date = new Date(dateStr);

  // Check if date is valid
  if (isNaN(date.getTime())) return "";

  // 1. Handle "mmddyyyy" (numeric format: 04/21/2026)
  if (formatType === "mmddyyyy") {
    const numericOptions: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Manila",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      ...options, // Allow overrides
    };
    return new Intl.DateTimeFormat("en-US", numericOptions).format(date);
  }

  // 2. Handle "Mmmddyyyy" (Default format: Apr 21, 2026, 12:00 AM)
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  };

  return new Intl.DateTimeFormat("en-US", defaultOptions).format(date);
}