export function formatDateTime(
  dateStr?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "";

  const date = new Date(dateStr);

  if (isNaN(date.getTime())) return "";

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Manila", // remove if you want user's local time
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  return new Intl.DateTimeFormat(
    "en-US",
    options ?? defaultOptions
  ).format(date);
}