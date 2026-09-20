/**
 * Human time.
 *
 * "2 hours ago" rather than a timestamp, because everything in this product is
 * conversational and a date-time stamp reads as a log file. Falls back to a real date
 * past a week, where relative time stops being useful.
 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);

  if (seconds < 45) return "just now";
  if (seconds < 90) return "a minute ago";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;

  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: days > 300 ? "numeric" : undefined,
  });
}

/** "SAT 17 OCT" — the way a date gets said out loud when picking a weekend. */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  return date
    .toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "8/9 are in" — the count phrasing this product uses everywhere. */
export function ratio(part: number, total: number): string {
  return `${part}/${total}`;
}
