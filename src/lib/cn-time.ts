/** Compact relative time — "2m", "3h", "yesterday", "Apr 28". */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;

  if (diffMs < min) return "now";
  if (diffMs < hr) return `${Math.floor(diffMs / min)}m`;
  if (diffMs < day) return `${Math.floor(diffMs / hr)}h`;
  if (diffMs < 2 * day) return "yesterday";
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
